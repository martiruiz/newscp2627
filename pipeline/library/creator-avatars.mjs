#!/usr/bin/env node
// Content creators' profile pictures (the creators' rows in the Content Library): Instagram's public profile embed page
// (instagram.com/{handle}/embed/, as profile-logos.mjs) or TikTok's profile page ("avatarLarger"). Copied to Storage
// (bucket "logos", public: their own URLs expire) → scraped_profiles.avatar_url. Only the creators without one (--all: every creator).
//
//   cd pipeline && node library/creator-avatars.mjs [--all] [--limit 50]
import https from "node:https";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";

loadEnv();
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const argv = process.argv.slice(2);
const arg = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const ALL = argv.includes("--all"), LIMIT = Number(arg("--limit") || 1e9);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const IFRAME = { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9", "Sec-Fetch-Dest": "iframe", "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Site": "cross-site" };
const get = (url, headers, binary = false) => new Promise((resolve, reject) => {
  const req = https.get(url, { headers, timeout: 25000 }, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { res.resume(); return resolve(get(new URL(res.headers.location, url).href, headers, binary)); }
    const chunks = [];
    res.on("data", (c) => chunks.push(c));
    res.on("end", () => { const b = Buffer.concat(chunks); resolve({ status: res.statusCode, body: b, text: b.toString("utf8"), type: res.headers["content-type"] || "image/jpeg" }); });
  });
  req.on("timeout", () => req.destroy(new Error("timeout")));
  req.on("error", reject);
});
// a URL inside a JSON string in the page: https:\/\/… or https:\u002F\u002F…, with \u0026 for &
const unescape = (s) => s.replace(/\\+\//g, "/").replace(/\\+u002F/gi, "/").replace(/\\+u0025/g, "%").replace(/\\+u0026/g, "&").replace(/&amp;/g, "&");
async function picture(platform, handle) {
  if (platform === "instagram") {
    const { status, text } = await get(`https://www.instagram.com/${encodeURIComponent(handle)}/embed/`, IFRAME);
    const m = status === 200 && /profile_pic_url\\*":\\*"([^"\\]*(?:\\+[^"\\][^"\\]*)*)/.exec(text);
    return m ? unescape(m[1]) : null;
  }
  if (platform === "tiktok") {
    const { status, text } = await get(`https://www.tiktok.com/@${encodeURIComponent(handle)}`, { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" });
    const m = status === 200 && /"avatarLarger":"([^"]+)"/.exec(text);
    return m ? unescape(m[1]) : null;
  }
  return null;
}

const { data: rows, error } = await db.from("scraped_profiles").select("id,platform,handle,avatar_url").eq("creator", true).eq("active", true);
if (error) throw error;
let done = 0, failed = 0;
for (const p of rows.filter((r) => ALL || !r.avatar_url).slice(0, LIMIT)) {
  try {
    const pic = await picture(p.platform, p.handle);
    await sleep(1500);
    if (!pic) { failed++; console.log(`· @${p.handle}: no public picture`); continue; }
    const img = await get(pic, { "User-Agent": UA }, true);
    if (img.status !== 200 || !img.body.length) { failed++; console.log(`· @${p.handle}: picture not available`); continue; }
    const file = `creators/${p.platform}-${p.handle}.jpg`;
    const { error: e } = await db.storage.from("logos").upload(file, img.body, { contentType: img.type.split(";")[0], upsert: true, cacheControl: "31536000" });
    if (e) throw new Error(`storage: ${e.message}`);
    const url = `${db.storage.from("logos").getPublicUrl(file).data.publicUrl}?v=${Date.now().toString(36)}`;
    await db.from("scraped_profiles").update({ avatar_url: url }).eq("id", p.id);
    done++;
    console.log(`✓ @${p.handle}`);
  } catch (e) { failed++; console.log(`· @${p.handle}: ${e.message}`); }
}
console.log(`Done: ${done} pictures, ${failed} failed.`);
