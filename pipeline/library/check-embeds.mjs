#!/usr/bin/env node
// Finds imported posts (content_ideas) that no longer exist on Instagram and marks them unavailable,
// so the Content Library hides them. Posts that come back are un-marked.
// Also stores each post's media shape (media_ratio = height / width) so library cards keep their real size.
//
//   node library/check-embeds.mjs            → checks posts never checked, or last checked over 7 days ago
//   node library/check-embeds.mjs --all      → checks every post
//
// How: Instagram's embed page (the same one the library shows) says "may be broken" for removed / private posts (see instagram.mjs).
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (pipeline/.env locally, GitHub secrets in Actions).
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";
import { igEmbed, igRef } from "./instagram.mjs";

loadEnv();
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ALL = process.argv.includes("--all");
const CONCURRENCY = 6;

async function status(url) {
  if (!igRef(url)) return { s: "skip" }; // other platforms: not checked yet
  const r = await igEmbed(url);
  return { s: r.status, ratio: r.ratio }; // "unknown" = rate limited / network: leave as is, retry next run
}

// Load the posts to check (1,000 per request)
const since = new Date(Date.now() - 7 * 864e5).toISOString();
let posts = [];
for (let from = 0; ; from += 1000) {
  let q = db.from("content_ideas").select("id,url,unavailable_at").order("id").range(from, from + 999);
  if (!ALL) q = q.or(`checked_at.is.null,checked_at.lt.${since}`);
  const { data, error } = await q;
  if (error) throw error;
  posts = posts.concat(data);
  if (data.length < 1000) break;
}
console.log(`Checking ${posts.length} post(s)…`);

const found = { ok: [], broken: [], unknown: 0, skip: 0 };
const ratios = new Map(); // ratio -> ids
let i = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (i < posts.length) {
    const p = posts[i++];
    const { s, ratio } = await status(p.url);
    if (s === "ok" || s === "broken") found[s].push(p.id); else found[s]++;
    if (ratio) ratios.set(ratio, [...(ratios.get(ratio) || []), p.id]);
  }
}));

const now = new Date().toISOString();
const update = async (ids, fields) => {
  for (let k = 0; k < ids.length; k += 200) {
    const { error } = await db.from("content_ideas").update(fields).in("id", ids.slice(k, k + 200));
    if (error) throw error;
  }
};
await update(found.broken, { unavailable_at: now, checked_at: now });
await update(found.ok, { unavailable_at: null, checked_at: now });
for (const [ratio, ids] of ratios) await update(ids, { media_ratio: ratio });
console.log(`OK: ${found.ok.length} · unavailable: ${found.broken.length} · couldn't check: ${found.unknown} · other platforms: ${found.skip}`);
