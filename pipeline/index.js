// SCP Social News pipeline
//   node index.js            → fetch, edit with Claude, save to Supabase
//   node index.js --dry-run  → only fetch and list new articles (no Claude, no Supabase writes)
//
// Env: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { SOURCES, ITEMS_PER_SOURCE, MAX_AGE_HOURS } from "./sources.js";
import { readSource, parseDate, pageImages } from "./fetch.js";

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
      if (source.triage && !(await editor.worthEditing(item))) {
        // not for us: stored as not relevant so it isn't screened again
        const { error } = await db.from("news").insert({ url: item.url, source_name: source.name, platform: "other", title: item.title, paragraphs: [], relevant: false, published_at: toIso(item.published) ?? new Date().toISOString() });
        if (error) throw error;
        console.log(`  – (triage) ${item.title}`);
        continue;
      }
      // every news item is published with its picture: the article's preview, or for a newsletter the one of each story
      const many = (source.stories || 1) > 1;
      const pics = await pageImages(item.url).catch(() => ({ og: null, list: [] }));
      const stories = await editArticle(item, source.name, source.stories || 1, many ? pics.list : []);
      if (!stories) { skipped++; continue; }
      // a newsletter with several stories: the 2nd, 3rd… keep the article's URL with #2, #3… (the URL must be unique)
      for (const [i, edited] of stories.entries()) {
        const image = many ? pics.list[edited.image - 1]?.src : pics.og;
        if (edited.relevant && !image) { edited.relevant = false; console.warn(`  ! no picture for "${edited.title}": not published`); }
        const { error } = await db.from("news").insert({
          url: i ? `${item.url}#${i + 1}` : item.url,
          source_name: source.name,
          platform: edited.platform,
          title: edited.title,
          paragraphs: edited.relevant ? edited.paragraphs : [],
          relevant: edited.relevant,
          image_url: image || "",
          published_at: toIso(item.published) ?? new Date().toISOString(),
        });
        if (error) throw error;
        console.log(`  ${edited.relevant ? "✓" : "–"} [${edited.platform}] ${edited.title}`);
        if (edited.relevant) added++;
      }
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
  const { input, output, triageInput, triageOutput } = editor.usage;
  // list prices: Claude Opus 5.5 $4 / $20 per MTok (writing), Claude Haiku 5.5 $1 / $5 per MTok (triage)
  const cost = (input * 4 + output * 20 + triageInput * 1 + triageOutput * 5) / 1e6;
  console.log(`Claude usage: ${input} + ${output} tokens (writing), ${triageInput} + ${triageOutput} (triage) ≈ $${cost.toFixed(2)}`);
}
