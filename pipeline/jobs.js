// SCP Jobs: every day the newest offers on Jobs In Football (RSS, ~50 a day) are screened by Claude Haiku; the roles in
// sports digital marketing (social, content, design, video, marketing, partnerships) are published straight away on the
// Jobs page (Martí, 26/10: no review needed); they can still be hidden or edited in Admin → Jobs.
//   node jobs.js            → screen and save
//   node jobs.js --dry-run  → screen and list (no Supabase writes)
// Env: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import { stripHtml } from "./fetch.js";

const DRY = process.argv.includes("--dry-run");
const FEED = "https://www.jobsinfootball.com/rss";
const client = new Anthropic();
const db = DRY ? null : createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const MODES = ["onsite", "hybrid", "remote"], TYPES = ["full-time", "part-time", "internship", "freelance"];
const AREAS = ["social", "content", "design", "video", "marketing", "partnerships", "other"];
const SCHEMA = {
  type: "object", additionalProperties: false, required: ["keep", "company", "location", "work_mode", "job_type", "area", "summary"],
  properties: {
    keep: { type: "boolean" }, company: { type: "string" }, location: { type: "string" },
    work_mode: { type: "string", enum: MODES }, job_type: { type: "string", enum: TYPES }, area: { type: "string", enum: AREAS }, summary: { type: "string" },
  },
};
const Result = z.object({ keep: z.boolean(), company: z.string(), location: z.string(), work_mode: z.enum(MODES), job_type: z.enum(TYPES), area: z.enum(AREAS), summary: z.string() });
const SYSTEM = `You screen job offers for the Jobs page of Sports Content Playbook, read by people who work in sports digital marketing.
keep = true only for roles in social media, content, copywriting, graphic or presentation design, video, digital marketing, brand/marketing, communications, fan engagement, CRM, or partnerships/sponsorship. Coaches, scouts, analysts, medical, legal, finance, operations, hospitality and admin roles: keep = false.
Also fill in, from the offer only (never invent): the company, the location ("City, Country"), work mode, job type, the area that fits best, and a two-sentence summary in English (what the job is and what they ask for).`;

const usage = { input: 0, output: 0 };
async function screen(item) {
  const res = await client.messages.create({
    model: "claude-haiku-5-5",
    max_tokens: 1500,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: `Title: ${item.title}\n\n${item.body.slice(0, 2500)}` }],
  });
  usage.input += res.usage.input_tokens ?? 0;
  usage.output += res.usage.output_tokens ?? 0;
  const t = res.content.find((b) => b.type === "text");
  const ok = t && Result.safeParse(JSON.parse(t.text));
  return ok?.success ? ok.data : null;
}

const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const res = await fetch(FEED, { headers: { "User-Agent": "Mozilla/5.0 (compatible; SCPJobsBot/1.0; +https://sportscontentplaybook.com)" }, signal: AbortSignal.timeout(30000) });
if (!res.ok) throw new Error(`${res.status} ${FEED}`);
const items = asArray(new XMLParser().parse(await res.text()).rss?.channel?.item)
  .map((it) => ({ title: stripHtml(it.title), url: String(it.link || "").trim(), body: stripHtml(it.description || "") }))
  .filter((it) => it.title && it.url);

// offers already in "jobs" are skipped (runs are daily and the feed holds about one day, so little is screened twice)
const known = new Set();
if (db) {
  const { data, error } = await db.from("jobs").select("apply_url");
  if (error) throw error;
  data.forEach((j) => known.add(j.apply_url));
}

let added = 0, out = 0;
for (const item of items.filter((i) => !known.has(i.url))) {
  let r;
  try { r = await screen(item); } catch (e) { console.warn(`  ! ${item.title}: ${e.message}`); continue; }
  if (!r) continue;
  if (!r.keep) { out++; continue; }
  if (DRY) { console.log(`  · ${item.title} · ${r.company} · ${r.location} · ${r.area}`); continue; }
  const expires = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const { error } = await db.from("jobs").insert({ title: item.title, company: r.company, location: r.location || null, work_mode: r.work_mode, job_type: r.job_type, area: r.area, summary: r.summary, apply_url: item.url, published: true, expires_at: expires });
  if (error) { console.warn(`  ! ${item.title}: ${error.message}`); continue; }
  console.log(`  + ${item.title} · ${r.company}`);
  added++;
}
// list price: Claude Haiku 5.5 $1 / $5 per MTok
console.log(`\nDone. ${items.length} in the feed, ${added} published, ${out} not about marketing.`);
console.log(`Claude: ${usage.input} + ${usage.output} tokens ≈ $${((usage.input * 1 + usage.output * 5) / 1e6).toFixed(2)}`);
