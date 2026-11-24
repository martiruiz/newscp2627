#!/usr/bin/env node
// My Club: profile pictures of the people linked to a club (players, sponsors, competitors…) that have none yet — no
// photo of their own, no catalog logo, no Instagram logo in the catalog. Their Instagram (else TikTok) picture, the same
// way as creator-avatars.mjs, copied to Storage (bucket "logos", folder "club-people") → club_people.photo_url.
//
//   cd pipeline && node library/club-photos.mjs [--club 5] [--all] [--limit 50]
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

const CLUB = arg("--club");
let q = db.from("club_people").select("id,name,club_id,photo_url,catalog_value_id").eq("active", true);
if (CLUB) q = q.eq("club_id", Number(CLUB));
const { data: people, error } = await q;
if (error) throw error;
const { data: accs } = await db.from("club_person_accounts").select("person_id,platform,handle").in("person_id", people.map((p) => p.id)).in("platform", ["instagram", "tiktok"]);
let done = 0, failed = 0;
for (const p of people.slice(0, LIMIT)) {
  if (!ALL && p.photo_url) continue;
  if (!ALL && p.catalog_value_id) {   // the catalog's logo, or its Instagram logo, is already shown
    const { data: v } = await db.from("idea_catalog").select("logo_url").eq("id", p.catalog_value_id).maybeSingle();
    if (v?.logo_url) continue;
  }
  const mine = (accs || []).filter((a) => a.person_id === p.id).sort((a, b) => (a.platform === "instagram" ? -1 : 1) - (b.platform === "instagram" ? -1 : 1));
  if (!ALL && mine[0]?.platform === "instagram") {
    const { data: ig } = await db.rpc("ig_photo", { p_handle: mine[0].handle });
    if (ig) continue;
  }
  let ok = false;
  for (const a of mine) {
    try {
      const pic = await picture(a.platform, a.handle);
      await sleep(1500);
      if (!pic) continue;
      const img = await get(pic, { "User-Agent": UA }, true);
      if (img.status !== 200 || !img.body.length) continue;
      const file = `club-people/${p.id}.jpg`;
      const { error: e } = await db.storage.from("logos").upload(file, img.body, { contentType: img.type.split(";")[0], upsert: true, cacheControl: "31536000" });
      if (e) throw new Error(`storage: ${e.message}`);
      const url = `${db.storage.from("logos").getPublicUrl(file).data.publicUrl}?v=${Date.now().toString(36)}`;
      await db.from("club_people").update({ photo_url: url }).eq("id", p.id);
      ok = true;
      console.log(`✓ ${p.name} (@${a.handle})`);
      break;
    } catch (e) { console.log(`· ${p.name} @${a.handle}: ${e.message}`); }
  }
  if (ok) done++; else { failed++; console.log(`· ${p.name}: no public picture`); }
}
console.log(`Done: ${done} pictures, ${failed} without one.`);
