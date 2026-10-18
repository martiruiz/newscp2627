#!/usr/bin/env node
// Club and competition logos = their Instagram profile picture.
// For each catalog value: a few of its Instagram posts in the library → Instagram's public embed page names the account
// and its profile picture → the account that posted most of them is taken as the club's / competition's own (at least
// 2 of 3 posts must agree) → the picture is copied to Storage (bucket "logos", public) → idea_catalog.logo_url, with the
// Instagram profile in logo_source. Values without enough Instagram posts keep their current (Wikimedia) logo.
//
//   cd pipeline && node library/ig-avatars.mjs [--category club|competition] [--limit 50] [--only-missing] [--dry]
//   --dry only prints what it would pick. Slow on purpose (≈1 request / 1.5 s), like the other Instagram scripts.
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in pipeline/.env.
import https from "node:https";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";

loadEnv();
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const argv = process.argv.slice(2);
const arg = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const DRY = argv.includes("--dry");
const ONLY_MISSING = argv.includes("--only-missing");
const LIMIT = Number(arg("--limit") || 1e9);
const CATS = arg("--category") ? [arg("--category")] : ["competition", "club"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Sec-Fetch-Dest": "iframe", "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Site": "cross-site",
};
const get = (url, binary = false) => new Promise((resolve, reject) => {
  const req = https.get(url, { headers: HEADERS, timeout: 25000 }, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { res.resume(); return resolve(get(res.headers.location, binary)); }
    const chunks = [];
    res.on("data", (c) => chunks.push(c));
    res.on("end", () => { const b = Buffer.concat(chunks); resolve(binary ? { body: b, type: res.headers["content-type"] || "image/jpeg", status: res.statusCode } : b.toString("utf8")); });
  });
  req.on("timeout", () => req.destroy(new Error("timeout")));
  req.on("error", reject);
});
const unescape = (s) => s.replace(/\\\//g, "/").replace(/\\u0026/g, "&").replace(/&amp;/g, "&");

// Account and profile picture of one Instagram post (from its public embed page)
async function owner(url) {
  const m = /instagram\.com\/(?:[\w.]+\/)?(p|reel|tv)\/([\w-]+)/.exec(url || "");
  if (!m) return null;
  const html = await get(`https://www.instagram.com/${m[1]}/${m[2]}/embed/captioned/`);
  const user = /class="UsernameText"[^>]*>([^<]+)</.exec(html)?.[1] || /"owner":\{[^}]*"username":"([^"]+)"/.exec(html)?.[1];
  const avatar = /class="Avatar[^"]*"[^>]*>\s*<img[^>]+src="([^"]+)"/.exec(html)?.[1] || /"profile_pic_url":"([^"]+)"/.exec(html)?.[1];
  return user && avatar ? { user: user.trim(), avatar: unescape(avatar) } : null;
}

// Does the account name fit the club / competition? ("fcbarcelona" ↔ "FC Barcelona", "premierleague" ↔ "Premier League",
// not "sunderlandafc" ↔ "Premier League"): a long-enough word of the name, or its initials, must be in the handle
const flat = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function fits(user, name) {
  const u = flat(user).replace(/[^a-z0-9]/g, "");
  const words = flat(name).replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length >= 4 && !/^(club|football|futbol|calcio|league|liga|sport|sports|team)$/.test(w));
  const initials = flat(name).split(/\s+/).map((w) => w[0]).join("");
  if (u === flat(name).replace(/[^a-z0-9]/g, "")) return true;
  if (words.some((w) => u.includes(w))) return true;
  return initials.length >= 2 && u.startsWith(initials);
}

async function instagramPosts(valueId, n = 3) {
  const { data: tags } = await db.from("content_idea_tags").select("idea_id").eq("value_id", valueId).order("idea_id", { ascending: false }).limit(300);
  if (!tags?.length) return [];
  const { data } = await db.from("content_ideas").select("id,url").in("id", tags.map((t) => t.idea_id)).ilike("url", "%instagram.com%")
    .is("unavailable_at", null).order("published_at", { ascending: false }).limit(n);
  return data || [];
}

let q = db.from("idea_catalog").select("id,category,name,logo_url,logo_source").in("category", CATS).order("category").order("id");
const { data: values, error } = await q;
if (error) throw error;
let done = 0, kept = 0, checked = 0;
for (const v of values) {
  if (done >= LIMIT) break;
  if (ONLY_MISSING && v.logo_url) continue;
  if (/instagram\.com/.test(v.logo_source || "") && !argv.includes("--refresh")) continue;   // already from Instagram
  checked++;
  const posts = await instagramPosts(v.id, v.category === "competition" ? 10 : 4);
  const seen = [];
  for (const p of posts) {
    try { const o = await owner(p.url); if (o) seen.push(o); } catch { /* skip that post */ }
    await sleep(1500);
    if (seen.filter((o) => fits(o.user, v.name)).length >= 2) break;   // its own account, twice: enough
  }
  const votes = new Map();
  for (const o of seen) if (fits(o.user, v.name)) votes.set(o.user, [...(votes.get(o.user) || []), o]);
  const [best] = [...votes.values()].sort((a, b) => b.length - a.length);
  if (!best) { kept++; console.log(`· ${v.category} ${v.name}: no post from its own account (${[...new Set(seen.map((o) => "@" + o.user))].join(", ") || "none"}) — keeps its logo`); continue; }
  const { user, avatar } = best[0];
  if (DRY) { console.log(`✓ ${v.category} ${v.name} → @${user}`); done++; continue; }
  const img = await get(avatar, true);
  if (img.status !== 200 || !img.body.length) { kept++; console.log(`· ${v.name}: picture not available`); continue; }
  const file = `ig/${v.category}-${v.id}.jpg`;
  const { error: upErr } = await db.storage.from("logos").upload(file, img.body, { contentType: img.type.split(";")[0], upsert: true, cacheControl: "31536000" });
  if (upErr) throw new Error(`storage: ${upErr.message}`);
  const publicUrl = `${db.storage.from("logos").getPublicUrl(file).data.publicUrl}?v=${Date.now().toString(36)}`;
  await db.from("idea_catalog").update({ logo_url: publicUrl, logo_source: `https://www.instagram.com/${user}/` }).eq("id", v.id);
  done++;
  console.log(`✓ ${v.category} ${v.name} → @${user}`);
}
console.log(`Done: ${done} logos from Instagram, ${kept} kept their current logo (${checked} checked).`);
