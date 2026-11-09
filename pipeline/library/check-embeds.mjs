#!/usr/bin/env node
// Finds imported posts (content_ideas) that no longer exist on Instagram and marks them unavailable,
// so the Content Library hides them. Posts that come back are un-marked.
// Also stores each post's media shape (media_ratio = height / width) so library cards keep their real size.
//
//   node library/check-embeds.mjs              → checks 1,500 Instagram posts: never checked first (newest first), then the ones last checked over 7 days ago
//   node library/check-embeds.mjs --limit 50   → another batch size
//   node library/check-embeds.mjs --dry        → checks and reports, writes nothing
//
// How: Instagram's embed page (the same one the library shows) says "may be broken" for removed / private posts (see instagram.mjs).
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (pipeline/.env locally, GitHub secrets in Actions).
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";
import { igEmbed, igRef } from "./instagram.mjs";

loadEnv();
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const arg = (name) => process.argv[process.argv.indexOf(name) + 1];
const LIMIT = process.argv.includes("--limit") ? Number(arg("--limit")) : 1500;
const DRY = process.argv.includes("--dry");
const CONCURRENCY = 6;

async function status(url) {
  if (!igRef(url)) return { s: "skip" }; // other platforms: not checked yet
  const r = await igEmbed(url);
  return { s: r.status, ratio: r.ratio }; // "unknown" = rate limited / network: leave as is, retry next run
}

// Load one batch (supabase/check-embeds-index.sql keeps both queries fast): never checked, newest first; then the stalest checks
const since = new Date(Date.now() - 7 * 864e5).toISOString();
const ig = () => db.from("content_ideas").select("id,url").ilike("url", "%instagram.com%");
const take = async (query, n) => { // the API returns at most 1,000 rows per request
  let rows = [];
  for (let from = 0; from < n; from += 1000) {
    const { data, error } = await query().range(from, Math.min(from + 1000, n) - 1);
    if (error) throw error;
    rows = rows.concat(data);
    if (data.length < Math.min(1000, n - from)) break;
  }
  return rows;
};
let posts = await take(() => ig().is("checked_at", null).order("published_at", { ascending: false, nullsFirst: false }).order("id", { ascending: false }), LIMIT);
if (posts.length < LIMIT) posts = posts.concat(await take(() => ig().lt("checked_at", since).order("checked_at").order("id"), LIMIT - posts.length));
console.log(`Checking ${posts.length} post(s)${DRY ? " (dry run: nothing is written)" : ""}…`);

const found = { ok: [], broken: [], unknown: 0, skip: 0 };
const ratios = new Map(); // ratio -> ids
let i = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (i < posts.length) {
    const p = posts[i++];
    const { s, ratio } = await status(p.url);
    if (s === "ok" || s === "broken") found[s].push(p.id); else found[s]++;
    if (DRY && s === "broken") console.log(`  unavailable: ${p.url}`);
    if (ratio) ratios.set(ratio, [...(ratios.get(ratio) || []), p.id]);
  }
}));

const now = new Date().toISOString();
const update = async (ids, fields) => {
  if (DRY) return;
  for (let k = 0; k < ids.length; k += 200) {
    const { error } = await db.from("content_ideas").update(fields).in("id", ids.slice(k, k + 200));
    if (error) throw error;
  }
};
await update(found.broken, { unavailable_at: now, checked_at: now });
await update(found.ok, { unavailable_at: null, checked_at: now });
for (const [ratio, ids] of ratios) await update(ids, { media_ratio: ratio });
console.log(`OK: ${found.ok.length} · unavailable: ${found.broken.length} · couldn't check: ${found.unknown} · other platforms: ${found.skip}`);
