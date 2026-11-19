#!/usr/bin/env node
// My Club: every Instagram / TikTok profile already scraped from My Club (its "Scrape") is scraped again every 12 hours,
// at 9:00 and 21:00 Madrid time (.github/workflows/club-rescrape.yml runs at both UTC hours of each, for summer and
// winter time; this script only works when it's 9 or 21 in Madrid, unless --now). Its last 10 posts: Bright Data
// through the Edge Function club-scrape (x-worker-key), imported the same way as Admin → My Club → "Scrape"
// (admin/js/core.js scrapeAndImport), and put in the club's My Club (club_mark_imported). New covers: covers.mjs --new.
//   cd pipeline && node library/club-rescrape.mjs [--now] [--dry] [--limit 5]
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (pipeline/.env or the environment) and supabase/my-club-rescrape.sql.
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";

loadEnv();
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY, URL = process.env.SUPABASE_URL;
const db = createClient(URL, KEY, { auth: { persistSession: false } });
const argv = process.argv.slice(2);
const DRY = argv.includes("--dry"), LIMIT = Number(argv[argv.indexOf("--limit") + 1]) || 1e9;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hour12: false }).format(new Date()));
if (!argv.includes("--now") && hour !== 9 && hour !== 21) { console.log(`It's ${hour}:00 in Madrid: the re-scrape runs at 9:00 and 21:00.`); process.exit(0); }

// the profiles: people's accounts and the clubs' own accounts, Instagram / TikTok, of active clubs, with posts already
const { data: clubs } = await db.from("clubs").select("id,name,accounts,active").eq("active", true);
const { data: people } = await db.from("club_people").select("id,club_id,active").eq("active", true);
const { data: accs } = await db.from("club_person_accounts").select("person_id,platform,handle").in("platform", ["instagram", "tiktok"]);
const clubOf = new Map((people || []).map((p) => [p.id, p.club_id]));
const live = new Map((clubs || []).map((c) => [c.id, c]));
const list = new Map();
for (const a of accs || []) { const c = live.get(clubOf.get(a.person_id)); if (c) list.set(`${a.platform}|${a.handle}`, { ...a, club: c, own: false }); }
for (const c of clubs || []) for (const a of c.accounts || []) if (["instagram", "tiktok"].includes(a.platform)) list.set(`${a.platform}|${a.handle}`, { platform: a.platform, handle: a.handle, club: c, own: true });
// scraped from My Club at least once (its "Scrape" button, or this script, leaves an import "Bright Data · @handle · …"):
// from then on, every 12 hours. Accounts that only come in the daily scraping file aren't collected twice.
const scraped = new Set();
for (let from = 0; ; from += 1000) {
  const { data } = await db.from("idea_imports").select("filename").like("filename", "Bright Data · @%").range(from, from + 999);
  for (const r of data || []) { const h = /^Bright Data · @([\w.]+) ·/.exec(r.filename || "")?.[1]; if (h) scraped.add(h.toLowerCase()); }
  if (!data || data.length < 1000) break;
}
const due = [...list.values()].filter((a) => scraped.has(a.handle.toLowerCase()));
const todo = due.slice(0, LIMIT);
console.log(`${todo.length} profiles to scrape again (${list.size} in My Club, ${due.length} scraped from My Club before).`);
if (DRY) { todo.forEach((a) => console.log(`  ${a.platform} @${a.handle} · ${a.club.name}${a.own ? " (club account)" : ""}`)); process.exit(0); }

const call = async (body) => {
  const r = await fetch(`${URL}/functions/v1/club-scrape`, { method: "POST", body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", "x-worker-key": KEY, Authorization: `Bearer ${KEY}` } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error(d.error || `club-scrape ${r.status}`);
  return d;
};

// the same steps as the admin's import (admin/js/core.js scrapeAndImport)
async function importRows(a, rows) {
  rows = rows.filter((r) => r.external_id && r.published_at).map((r) => (a.own ? { ...r, club: a.club.name } : r));
  if (!rows.length) return 0;
  const { data: imp, error: e1 } = await db.from("idea_imports").insert({ filename: `Bright Data · @${a.handle} · ${a.club.name} (every 12 h)`, total_rows: rows.length, status: "importing" }).select("id").single();
  if (e1) throw e1;
  const { data: out, error: e2 } = await db.rpc("import_content_ideas_batch", { p_import_id: imp.id, p_rows: rows });
  if (e2) throw e2;
  await db.rpc("set_idea_accounts", { p_rows: rows.map((r) => ({ external_id: r.external_id, account: r.account })) });
  const covers = rows.filter((r) => r.cover).map((r) => ({ external_id: r.external_id, cover: r.cover }));
  if (covers.length) await db.rpc("set_idea_cover_sources", { p_rows: covers });
  await db.rpc("set_idea_scrape_extras", { p_rows: rows.map((r) => ({ external_id: r.external_id, account: r.account, hashtags: r.hashtags, followers: r.followers, profile_name: r.profile_name, verified: r.verified, profile_image: r.profile_image })) });
  const now = new Date().toISOString();
  for (const r of rows) if (r.platform === "Instagram" && !r.views) r.views = null;   // a photo or carousel has no views
  for (const r of rows.filter((r) => [r.views, r.likes, r.comments, r.shares].some((v) => v != null))) {
    await db.from("content_ideas").update({ ...Object.fromEntries(["views", "likes", "comments", "shares"].filter((k) => r[k] != null).map((k) => [k, r[k]])), ...(r.views != null ? { views_at: now } : {}) }).eq("external_id", r.external_id);
  }
  await db.from("idea_imports").update({ status: out.created || out.replaced ? "completed" : "failed", rows_created: out.created, rows_replaced: out.replaced,
    error_count: out.errors?.length || 0, errors: out.errors || [], new_values: out.new_values_created || {}, completed_at: now }).eq("id", imp.id);
  await db.rpc("club_mark_imported", { p_external_ids: rows.map((r) => r.external_id) });
  return out.created || 0;
}

// start every collection (a few seconds apart), then collect and import each one as it's ready (40 minutes at most)
const jobs = [];
for (const a of todo) {
  try { const { snapshot_id } = await call({ action: "start", platform: a.platform, handle: a.handle, num: 10 }); jobs.push({ a, snap: snapshot_id }); }
  catch (e) { console.log(`  ✕ ${a.platform} @${a.handle}: ${e.message}`); }
  await sleep(1500);
}
let newPosts = 0, ok = 0;
const t0 = Date.now();
while (jobs.some((j) => !j.done) && Date.now() - t0 < 40 * 60000) {
  await sleep(20000);
  for (const j of jobs.filter((x) => !x.done)) {
    try {
      const r = await call({ action: "status", platform: j.a.platform, handle: j.a.handle, snapshot_id: j.snap });
      if (r.status === "running") continue;
      j.done = true;
      if (r.status === "failed") { console.log(`  ✕ ${j.a.platform} @${j.a.handle}: ${r.error}`); continue; }
      const n = await importRows(j.a, r.rows || []);
      newPosts += n; ok++;
      console.log(`  ✓ ${j.a.platform} @${j.a.handle} · ${j.a.club.name}: ${(r.rows || []).length} posts read, ${n} new`);
    } catch (e) { j.done = true; console.log(`  ✕ ${j.a.platform} @${j.a.handle}: ${e.message}`); }
  }
}
for (const j of jobs.filter((x) => !x.done)) console.log(`  … ${j.a.platform} @${j.a.handle}: Bright Data took more than 40 minutes, next run`);
console.log(`Done: ${ok} of ${todo.length} profiles, ${newPosts} new posts.`);
