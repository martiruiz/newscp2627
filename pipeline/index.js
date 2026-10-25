// SCP Social News pipeline
//   node index.js            → fetch, edit with Claude, save to Supabase
//   node index.js --dry-run  → only fetch and list new articles (no Claude, no Supabase writes)
//
// Env: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { SOURCES, ITEMS_PER_SOURCE, MAX_AGE_HOURS } from "./sources.js";
import { readSource, parseDate } from "./fetch.js";

const DRY = process.argv.includes("--dry-run");
const cutoff = Date.now() - MAX_AGE_HOURS * 3600000;

const db = DRY
  ? null
  : createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

async function alreadyStored(urls) {
  if (!db || !urls.length) return new Set();
  const { data, error } = await db.from("news").select("url").in("url", urls);
  if (error) throw error;
  return new Set(data.map((r) => r.url));
}

const toIso = (d) => {
  const t = parseDate(d);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
};

let added = 0;
let skipped = 0;
const editor = DRY ? null : await import("./editor.js");
const editArticle = editor?.editArticle;

for (const source of SOURCES) {
  console.log(`\n▸ ${source.name}`);
  let items;
  try {
    items = await readSource(source, ITEMS_PER_SOURCE, cutoff);
  } catch (err) {
    console.warn(`  ! could not read source: ${err.message}`);
    continue;
  }

  items = items.filter((it) => it.url && it.title && it.body);
  items = items.filter((it) => {
    const t = toIso(it.published);
    return t && Date.parse(t) >= cutoff;
  });
  const known = await alreadyStored(items.map((it) => it.url));
  const fresh = items.filter((it) => !known.has(it.url));
  console.log(`  ${items.length} in the last ${MAX_AGE_HOURS}h, ${fresh.length} new`);

  for (const item of fresh) {
    if (DRY) {
      console.log(`  · ${item.title}  (${item.body.length} chars)`);
      continue;
    }
    try {
      const edited = await editArticle(item, source.name);
      if (!edited) { skipped++; continue; }
      const { error } = await db.from("news").insert({
        url: item.url,
        source_name: source.name,
        platform: edited.platform,
        title: edited.title,
        paragraphs: edited.relevant ? edited.paragraphs : [],
        relevant: edited.relevant,
        published_at: toIso(item.published) ?? new Date().toISOString(),
      });
      if (error) throw error;
      console.log(`  ${edited.relevant ? "✓" : "–"} [${edited.platform}] ${edited.title}`);
      if (edited.relevant) added++;
    } catch (err) {
      skipped++;
      if (err instanceof Anthropic.RateLimitError) {
        console.warn("  ! rate limited — stopping this run, the rest will be picked up next time");
        break;
      } else if (err instanceof Anthropic.APIError) {
        console.warn(`  ! Claude API error ${err.status}: ${err.message}`);
      } else {
        console.warn(`  ! ${item.url}: ${err.message}`);
      }
    }
  }
}

console.log(`\nDone. ${added} relevant stories published, ${skipped} skipped.`);
if (editor) {
  const { input, output } = editor.usage;
  // Claude Opus 5.5 list price: $4 / MTok input, $20 / MTok output
  const cost = (input * 4 + output * 20) / 1e6;
  console.log(`Claude usage: ${input} input + ${output} output tokens ≈ $${cost.toFixed(2)}`);
}
