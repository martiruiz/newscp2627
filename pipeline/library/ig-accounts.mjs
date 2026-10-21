#!/usr/bin/env node
// The account (username) of the Instagram posts that don't have one: their URL (instagram.com/p/…) and the import's
// embed don't carry it, but the post's embed page does ("UsernameText"). Saved in content_ideas.account, which links the
// post to its profile in Admin → Scraped profiles (and so to the creators' data: type, language, followers…).
// Read with curl: Instagram only serves the embed with the iframe's request headers, which Node's fetch rewrites.
// Picks up where it left off (only posts still without an account). Free; ~2–3 s per post.
//
//   cd pipeline && node library/ig-accounts.mjs [--creators] [--limit 500]
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";

loadEnv();
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const argv = process.argv.slice(2);
const arg = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const LIMIT = Number(arg("--limit") || 1e9), CREATORS = argv.includes("--creators");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const HEADERS = ["Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language: en-US,en;q=0.9", "Sec-Fetch-Dest: iframe", "Sec-Fetch-Mode: navigate", "Sec-Fetch-Site: cross-site"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const embed = (code) => { try { return execFileSync("curl", ["-s", "--max-time", "25", "-A", UA, ...HEADERS.flatMap((h) => ["-H", h]), `https://www.instagram.com/p/${code}/embed/captioned/`], { maxBuffer: 5e7 }).toString(); } catch { return ""; } };

// the posts to read: Instagram, no account (only the Content Creators' ones with --creators), newest first
let ids = null;
if (CREATORS) {
  const cc = (await db.from("idea_catalog").select("id").eq("category", "entity").eq("name", "Content Creators").single()).data.id;
  ids = [];
  for (let f = 0; ; f += 1000) { const { data } = await db.from("content_idea_tags").select("idea_id").eq("value_id", cc).order("idea_id").range(f, f + 999); ids.push(...data.map((r) => r.idea_id)); if (data.length < 1000) break; }
}
const todo = [];
for (let i = 0; ids ? i < ids.length : true; i += ids ? 300 : 1000) {
  let q = db.from("content_ideas").select("id,url").eq("account_platform", "instagram").is("account", null).is("unavailable_at", null);
  q = ids ? q.in("id", ids.slice(i, i + 300)) : q.order("id", { ascending: false }).range(i, i + 999);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  todo.push(...data);
  if (!ids && data.length < 1000) break;
}
todo.sort((a, b) => b.id - a.id);
console.log(`${todo.length} Instagram posts without an account${CREATORS ? " (Content Creators)" : ""}`);

let done = 0, none = 0, misses = 0;
const t0 = Date.now();
for (const p of todo.slice(0, LIMIT)) {
  const code = /instagram\.com\/(?:[\w.]+\/)?(?:p|reel|tv)\/([\w-]+)/.exec(p.url || "")?.[1];
  if (!code) { none++; continue; }
  const html = embed(code);
  const user = /class="UsernameText"[^>]*>([\w.]+)</.exec(html)?.[1] || /\\*"username\\*"\s*:\s*\\*"([\w.]+)/.exec(html)?.[1];
  if (user) {
    misses = 0; done++;
    const { error } = await db.from("content_ideas").update({ account: user.toLowerCase() }).eq("id", p.id);
    if (error) throw new Error(error.message);
  } else {
    none++; misses++;
    // many misses in a row: Instagram is serving the empty page (too many requests) → wait, then go on
    if (misses >= 15) { console.log(`  ${misses} misses in a row: waiting 10 min`); await sleep(600000); misses = 0; }
  }
  const n = done + none;
  if (n % 100 === 0) console.log(`${n}/${Math.min(todo.length, LIMIT)} · ${done} accounts · ${none} not read · ${Math.round((Date.now() - t0) / n)} ms/post`);
  await sleep(1000);
}
console.log(`ALL DONE: ${done} accounts saved, ${none} not read`);
