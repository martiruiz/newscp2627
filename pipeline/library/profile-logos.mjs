#!/usr/bin/env node
// Logos for clubs, competitions and sponsors = the Instagram profile picture of their own account, taken from the
// profiles we scrape (Admin → Scraped profiles, table scraped_profiles). Free: Instagram's public profile embed page
// (instagram.com/{handle}/embed/) carries the profile picture (100 × 100).
// Matching: a club value ↔ an Instagram profile whose "club" column is that club and whose handle fits the name
// ("acmilan" ↔ AC Milan, not a player's account); a competition ↔ a profile with that competition and no club;
// a sponsor ↔ a brand profile (no club) whose handle starts with the brand ("adidasfootball" ↔ Adidas).
// The picture is copied to Storage (bucket "logos", public) → idea_catalog.logo_url, the profile in logo_source.
//
//   cd pipeline && node library/profile-logos.mjs [--category club|competition|sponsor] [--limit 50] [--dry] [--all]
//   --dry   prints the matches, writes nothing
//   --all   also replaces logos that came from elsewhere (Wikimedia); by default only values without a logo
import https from "node:https";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";

loadEnv();
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const argv = process.argv.slice(2);
const arg = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const DRY = argv.includes("--dry"), ALL = argv.includes("--all");
const LIMIT = Number(arg("--limit") || 1e9);
const CATS = arg("--category") ? [arg("--category")] : ["club", "competition", "sponsor"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9",
  "Sec-Fetch-Dest": "iframe", "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Site": "cross-site",
};
const get = (url, binary = false) => new Promise((resolve, reject) => {
  const req = https.get(url, { headers: HEADERS, timeout: 25000 }, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { res.resume(); return resolve(get(new URL(res.headers.location, url).href, binary)); }
    const chunks = [];
    res.on("data", (c) => chunks.push(c));
    res.on("end", () => { const b = Buffer.concat(chunks); resolve(binary ? { body: b, type: res.headers["content-type"] || "image/jpeg", status: res.statusCode } : { html: b.toString("utf8"), status: res.statusCode }); });
  });
  req.on("timeout", () => req.destroy(new Error("timeout")));
  req.on("error", reject);
});
// the picture URL sits in a JSON string inside a script: https:\\\/\\\/scontent…\\u00253D
const unescape = (s) => s.replace(/\\+\//g, "/").replace(/\\+u0025/g, "%").replace(/\\+u0026/g, "&").replace(/&amp;/g, "&");
async function profilePic(handle) {
  const { html, status } = await get(`https://www.instagram.com/${encodeURIComponent(handle)}/embed/`);
  if (status !== 200) return null;
  const m = /profile_pic_url\\*":\\*"([^"\\]*(?:\\+[^"\\][^"\\]*)*)/.exec(html);
  return m ? unescape(m[1]) : null;
}

// does the handle belong to the club / competition / brand itself? (same rule as ig-avatars.mjs)
const flat = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const bare = (t) => flat(t).replace(/[^a-z0-9]/g, "");
function fits(user, name) {
  const u = bare(user);
  const words = flat(name).replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length >= 4 && !/^(club|football|futbol|calcio|league|liga|sport|sports|team)$/.test(w));
  const initials = flat(name).split(/\s+/).map((w) => w[0]).join("");
  return u === bare(name) || words.some((w) => u.includes(w)) || (initials.length >= 2 && u.startsWith(initials));
}
// a brand's own account: its name, maybe followed by a usual suffix ("nikefootball", "dazn_es", "veloncc")
const SUFFIX = /^(football|futbol|futbolofficial|footballofficial|official|oficial|es|cc|tv|hq|global|sport|sports|team)?$/;
const brandFits = (user, name) => bare(user) === bare(name) || (bare(name).length >= 4 && bare(user).startsWith(bare(name)) && SUFFIX.test(bare(user).slice(bare(name).length)));

const profiles = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from("scraped_profiles").select("handle,club,competition,url").eq("platform", "instagram").range(from, from + 999);
  if (error) throw error;
  profiles.push(...(data || []).filter((p) => /^[\w.]+$/.test(p.handle)));   // a real handle (no spaces)
  if (!data || data.length < 1000) break;
}
function accountFor(v) {
  const n = bare(v.name);
  const exact = profiles.find((p) => bare(p.handle) === n);
  if (v.category === "club") return profiles.find((p) => bare(p.club) === n && fits(p.handle, v.name)) || exact;
  if (v.category === "competition") return profiles.find((p) => !p.club && bare(p.competition) === n && fits(p.handle, v.name)) || exact;
  return exact || profiles.find((p) => !p.club && brandFits(p.handle, v.name));
}

let done = 0, noAccount = 0, failed = 0;
for (const cat of CATS) {
  const values = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from("idea_catalog").select("id,category,name,logo_url,logo_source").eq("category", cat).order("id").range(from, from + 999);
    values.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  for (const v of values) {
    if (done >= LIMIT) break;
    if (v.logo_url && !ALL) continue;
    const p = accountFor(v);
    if (!p) { noAccount++; continue; }
    if (v.logo_url && /instagram\.com\/([\w.]+)/.exec(v.logo_source || "")?.[1]?.toLowerCase() === p.handle.toLowerCase()) continue;   // already this picture
    if (DRY) { done++; console.log(`✓ ${cat} ${v.name} → @${p.handle}`); continue; }
    try {
      const pic = await profilePic(p.handle);
      await sleep(1500);
      if (!pic) { failed++; console.log(`· ${cat} ${v.name}: @${p.handle} has no public picture`); continue; }
      const img = await get(pic, true);
      if (img.status !== 200 || !img.body.length) { failed++; console.log(`· ${cat} ${v.name}: picture not available`); continue; }
      const file = `ig/${cat}-${v.id}.jpg`;
      const { error } = await db.storage.from("logos").upload(file, img.body, { contentType: img.type.split(";")[0], upsert: true, cacheControl: "31536000" });
      if (error) throw new Error(`storage: ${error.message}`);
      const url = `${db.storage.from("logos").getPublicUrl(file).data.publicUrl}?v=${Date.now().toString(36)}`;
      await db.from("idea_catalog").update({ logo_url: url, logo_source: `https://www.instagram.com/${p.handle}/` }).eq("id", v.id);
      done++;
      console.log(`✓ ${cat} ${v.name} → @${p.handle}`);
    } catch (e) { failed++; console.log(`· ${cat} ${v.name}: ${e.message}`); }
  }
}
console.log(`Done: ${done} ${DRY ? "matches" : "logos from Instagram"}, ${noAccount} without an Instagram profile in scraped_profiles, ${failed} failed.`);
