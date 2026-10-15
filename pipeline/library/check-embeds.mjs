#!/usr/bin/env node
// Finds imported posts (content_ideas) that no longer exist on Instagram and marks them unavailable,
// so the Content Library hides them. Posts that come back are un-marked.
//
//   node library/check-embeds.mjs            → checks posts never checked, or last checked over 7 days ago
//   node library/check-embeds.mjs --all      → checks every post
//
// How: Instagram's embed page (the same one the library shows) says "may be broken" for removed / private posts.
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (pipeline/.env locally, GitHub secrets in Actions).
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";

loadEnv();
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ALL = process.argv.includes("--all");
const CONCURRENCY = 6;
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  // Without these Instagram serves a generic error page for every post
  "Sec-Fetch-Dest": "iframe",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "cross-site",
};

async function status(url) {
  const m = /instagram\.com\/(?:[\w.]+\/)?(p|reel|tv)\/([\w-]+)/.exec(url || "");
  if (!m) return "skip"; // other platforms: not checked yet
  try {
    const res = await fetch(`https://www.instagram.com/${m[1]}/${m[2]}/embed/`, { headers: HEADERS, signal: AbortSignal.timeout(25000) });
    const html = await res.text();
    if (html.includes("may be broken")) return "broken";
    if (/EmbeddedMedia|EmbedSidecar|EmbedVideo/.test(html)) return "ok";
  } catch {}
  return "unknown"; // rate limited / network: leave as is, retry next run
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
let i = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (i < posts.length) {
    const p = posts[i++];
    const s = await status(p.url);
    if (s === "ok" || s === "broken") found[s].push(p.id); else found[s]++;
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
console.log(`OK: ${found.ok.length} · unavailable: ${found.broken.length} · couldn't check: ${found.unknown} · other platforms: ${found.skip}`);
