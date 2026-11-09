#!/usr/bin/env node
// Covers for the Instagram posts of the last 6 months with none (≈350,000 IG posts in all have none): the library shows them as
// Instagram's embed (an iframe per card: slow, and "may be broken" when Instagram throttles). Instagram blocks the
// covers Edge Function (Supabase's servers), but not GitHub Actions: the daily check-embeds already reads the same page.
//
//   node library/ig-covers-backlog.mjs --since 2026-05-09               → posts published since then: up to 4,000 or 50 minutes
//   node library/ig-covers-backlog.mjs --since 2026-05-09 --limit 200   → a test batch
//
// Takes posts with no cover never tried (cover_url and cover_at null), the most recently published first, through the
// partial index of supabase/ig-covers-backlog.sql (posts leave it as they get done, so it stays fast).
//   image found     → copied to Storage "covers" + cover_url, cover_at, and Instagram's type / size / length / views
//   "may be broken" → flagged (unavailable_at → gone_at, supabase/gone-not-hidden.sql: the post stays in the library)
//   no answer       → left as it is: the next run tries it again
// If Instagram starts holding us back (more than half of the last 40 without an answer) the run stops there.
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (pipeline/.env locally, GitHub secrets in Actions).
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";
import { igMeta } from "./instagram.mjs";
import { storeCover } from "./covers.mjs";

loadEnv();
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const arg = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : null);
const LIMIT = Number(arg("--limit")) || 4000;
const MINUTES = Number(arg("--minutes")) || 50;
const SINCE = arg("--since");
if (!/^\d{4}-\d{2}-\d{2}$/.test(SINCE || "")) throw new Error("--since YYYY-MM-DD is required");
const LANES = 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const t0 = Date.now();
const n = { done: 0, gone: 0, unknown: 0, failed: 0 };
const recent = [];   // last 40 answers: true = Instagram answered
let stop = "";

// the next page of posts to do, newest first (keyset on published_at, id, so the ones left as they are aren't taken again)
let cursor = null;
async function nextPage() {
  let q = db.from("content_ideas").select("id,url,published_at")
    .is("cover_url", null).is("cover_at", null).is("unavailable_at", null).is("gone_at", null).ilike("url", "%instagram.com%").gte("published_at", SINCE)
    .order("published_at", { ascending: false }).order("id", { ascending: false }).limit(200);
  if (cursor) q = q.or(`published_at.lt."${cursor.published_at}",and(published_at.eq."${cursor.published_at}",id.lt.${cursor.id})`);
  const { data, error } = await q;
  if (error) throw error;
  if (data.length) cursor = data[data.length - 1];
  return data;
}

async function one(p) {
  const now = new Date().toISOString();
  const c = await igMeta(p.url).catch(() => ({ status: "unknown" }));
  recent.push(c.status !== "unknown"); if (recent.length > 40) recent.shift();
  if (recent.length === 40 && recent.filter(Boolean).length < 20) stop = "Instagram is holding us back";
  if (c.status === "broken") {
    n.gone++;
    await db.from("content_ideas").update({ unavailable_at: now, cover_at: now }).eq("id", p.id);
    return;
  }
  if (c.status !== "ok" || !c.image) { n.unknown++; return; }
  const stored = await storeCover(p.id, c.image).catch(() => null);
  if (!stored) { n.failed++; return; }
  const { error } = await db.from("content_ideas").update({ cover_url: stored.url, cover_at: now }).eq("id", p.id);
  if (error) throw error;
  if (c.media_type && c.width && c.height) {
    await db.rpc("apply_ig_meta", { p_rows: [{ id: p.id, media_type: c.media_type, width: c.width, height: c.height, duration: c.duration, views: c.views }] });
  }
  n.done++;
}

let taken = 0;
while (!stop) {
  if (taken >= LIMIT) break;
  if (Date.now() - t0 > MINUTES * 60000) { stop = `${MINUTES} minutes`; break; }
  const page = (await nextPage()).slice(0, LIMIT - taken);
  if (!page.length) { stop = "no posts left"; break; }
  taken += page.length;
  let i = 0;
  await Promise.all(Array.from({ length: LANES }, async () => {
    while (i < page.length && !stop) { await one(page[i++]); await sleep(400); }
  }));
  console.log(`${n.done} covers · ${n.gone} flagged as gone · ${n.unknown} no answer · ${n.failed} image not copied · ${Math.round((Date.now() - t0) / 1000)} s`);
}
console.log(`Done${stop ? ` (${stop})` : ""}: ${n.done} covers, ${n.gone} flagged as gone, ${n.unknown} no answer (tried again next run), ${n.failed} image not copied.`);
