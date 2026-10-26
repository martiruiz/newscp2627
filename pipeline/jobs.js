// SCP Jobs: once a week Claude searches the web for open roles in sports digital marketing and adds them to the "jobs"
// table HIDDEN (published = false). Martí reviews them in Admin → Jobs and publishes the good ones.
//   node jobs.js            → search and save
//   node jobs.js --dry-run  → search and list (no Supabase writes)
// Env: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const DRY = process.argv.includes("--dry-run");
const MAX = 12;
const client = new Anthropic();
const db = DRY ? null : createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const Job = z.object({
  title: z.string().min(3),
  company: z.string().min(1),
  location: z.string().nullable(),
  work_mode: z.enum(["onsite", "hybrid", "remote"]),
  job_type: z.enum(["full-time", "part-time", "internship", "freelance"]),
  area: z.enum(["social", "content", "design", "video", "marketing", "partnerships", "other"]),
  summary: z.string().min(10),
  apply_url: z.string().url(),
});

const today = new Date().toISOString().slice(0, 10);
const PROMPT = `Today is ${today}. Find up to ${MAX} job offers that are open right now in sports digital marketing: social media, content, design, video, marketing or partnerships/sponsorship roles at sports clubs, leagues, federations, athletes' agencies, sports brands or sports media.
Priority: Spain, then the rest of Europe, then remote roles. Only offers published in the last 3 weeks, each with a direct link to the offer (the club's or company's careers page, or the job board page of that offer). Never invent an offer, a company or a link: if you can't confirm it in a search result, leave it out.
Answer only with JSON: {"jobs": [{"title", "company", "location" ("City, Country" or null), "work_mode" (onsite|hybrid|remote), "job_type" (full-time|part-time|internship|freelance), "area" (social|content|design|video|marketing|partnerships|other), "summary" (two sentences in English: what the job is and what they ask for), "apply_url"}]}`;

async function search() {
  const messages = [{ role: "user", content: PROMPT }];
  let res, usage = { input: 0, output: 0, searches: 0 };
  for (let turn = 0; turn < 6; turn++) {
    res = await client.messages.create({
      model: "claude-sonnet-5-5",
      max_tokens: 16000,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 20 }],
      messages,
    });
    usage.input += res.usage.input_tokens ?? 0;
    usage.output += res.usage.output_tokens ?? 0;
    usage.searches += res.usage.server_tool_use?.web_search_requests ?? 0;
    if (res.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: res.content });   // long search: let it carry on
  }
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const jobs = [];
  for (const j of JSON.parse(json || '{"jobs":[]}').jobs || []) {
    const ok = Job.safeParse(j);
    if (ok.success) jobs.push(ok.data); else console.warn(`  ! skipped (invalid): ${j?.title}`);
  }
  // list prices: Claude Sonnet 5.5 $3 / $15 per MTok, web search $10 per 1,000 searches
  console.log(`Claude: ${usage.input} + ${usage.output} tokens, ${usage.searches} searches ≈ $${((usage.input * 3 + usage.output * 15) / 1e6 + usage.searches * 0.01).toFixed(2)}`);
  return jobs;
}

// the link must open (some job boards block robots: a 403 is kept, a 404 / gone page is not)
async function linkWorks(url) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; SCPJobsBot/1.0; +https://sportscontentplaybook.com)" }, redirect: "follow", signal: AbortSignal.timeout(15000) });
    return r.ok || r.status === 403 || r.status === 429;
  } catch { return false; }
}

const found = await search();
const known = new Set();
if (db) {
  const { data, error } = await db.from("jobs").select("apply_url,title,company");
  if (error) throw error;
  for (const j of data) { known.add(j.apply_url); known.add(`${j.title}|${j.company}`.toLowerCase()); }
}
let added = 0;
for (const j of found) {
  if (known.has(j.apply_url) || known.has(`${j.title}|${j.company}`.toLowerCase())) { console.log(`  = already there: ${j.title} · ${j.company}`); continue; }
  if (!(await linkWorks(j.apply_url))) { console.log(`  ! link doesn't open, skipped: ${j.apply_url}`); continue; }
  if (DRY) { console.log(`  · ${j.title} · ${j.company} · ${j.location ?? ""} · ${j.apply_url}`); continue; }
  const expires = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const { error } = await db.from("jobs").insert({ ...j, published: false, expires_at: expires });
  if (error) { console.warn(`  ! ${j.title}: ${error.message}`); continue; }
  console.log(`  + ${j.title} · ${j.company} (hidden until reviewed)`);
  added++;
}
console.log(`\nDone. ${found.length} found, ${added} added for review in Admin → Jobs.`);
