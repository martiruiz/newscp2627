#!/usr/bin/env node
// Covers for the Content Library: one clean image per post, copied to Supabase Storage (bucket "covers", public), so
// the library shows tidy cards instead of embedded pages. Platform links expire, our copies don't.
//   Instagram  embed page (first image / reel cover) + exact format, size, duration, views (apply_ig_meta)
//   TikTok     oEmbed thumbnail            YouTube  i.ytimg.com thumbnail (Shorts too)
//   X          syndication (photo or video poster, size, duration)
//   Facebook   post plugin page image      LinkedIn embed page image / video cover
//
//   cd pipeline && node library/covers.mjs --from 2026-10-01 [--to 2026-10-31] [--platform Instagram] [--limit 500]
//   Posts that already have a cover are skipped; Instagram goes slowly (≈1 post / 1.2 s) so it isn't blocked.
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in pipeline/.env and supabase/covers.sql.
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";
import { igMeta } from "./instagram.mjs";

loadEnv();
const env = (k) => process.env[k] || "";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

// Embed pages answer properly only to an iframe-like request (node:https: fetch() adds headers that get an error page)
function page(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "en-US,en;q=0.9", "Sec-Fetch-Dest": "iframe", "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Site": "cross-site" }, timeout: 20000 }, (res) => {
      let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => resolve(res.statusCode === 200 ? d : ""));
    }).on("error", () => resolve("")).on("timeout", function () { this.destroy(); resolve(""); });
  });
}
const amp = (s) => s?.replace(/&amp;/g, "&");

// → { image, media_type?, width?, height?, duration?, views?, broken? }
export async function coverFor(url) {
  let m;
  if (/instagram\.com\//.test(url)) {
    const r = await igMeta(url);
    if (r.status === "broken") return { broken: true };
    return r.status === "ok" ? r : null;
  }
  if (/tiktok\.com\//.test(url)) {
    const r = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`).catch(() => null);
    if (r?.status === 404 || r?.status === 400) return { broken: true };
    const j = r?.ok ? await r.json().catch(() => null) : null;
    return j?.thumbnail_url ? { image: j.thumbnail_url, media_type: "video", width: j.thumbnail_width, height: j.thumbnail_height } : null;
  }
  if ((m = /(?:shorts\/|v=|youtu\.be\/)([\w-]{11})/.exec(url))) {
    for (const q of ["maxresdefault", "hqdefault"]) {
      const img = `https://i.ytimg.com/vi/${m[1]}/${q}.jpg`;
      const h = await fetch(img, { method: "HEAD" }).catch(() => null);
      if (h?.ok) return { image: img, media_type: "video" };
    }
    return null;
  }
  if ((m = /(?:twitter|x)\.com\/[^/]+\/status\/(\d+)/.exec(url))) {
    const token = ((Number(m[1]) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");
    const r = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${m[1]}&token=${token}&lang=en`).catch(() => null);
    if (r?.status === 404) return { broken: true };
    const j = r?.ok ? await r.json().catch(() => null) : null;
    const md = (j?.mediaDetails || [])[0];
    const card = j?.card?.binding_values?.thumbnail_image_large?.image_value?.url || j?.card?.binding_values?.photo_image_full_size_large?.image_value?.url;
    if (md?.media_url_https) return {
      image: `${md.media_url_https}?name=small`, media_type: md.type === "photo" ? "image" : "video",
      width: md.original_info?.width, height: md.original_info?.height, duration: md.video_info?.duration_millis ? md.video_info.duration_millis / 1000 : null,
    };
    return card ? { image: card, media_type: "image" } : null;
  }
  if (/facebook\.com\//.test(url)) {
    const html = await page(`https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}&width=500`);
    // post images (not the page's profile picture, which is a small square: s160x160 / s200x200 or /t39.30808-1/)
    const imgs = [...html.matchAll(/(?:src|content)="(https:\/\/scontent[^"]+)"/g)].map((x) => amp(x[1]))
      .filter((u) => !/\/t39\.30808-1\/|s\d{2,3}x\d{2,3}[&_]/.test(u));
    return imgs[0] ? { image: imgs[0], media_type: /\/(reel|videos?)\//.test(url) || /<video|playable_url/.test(html) ? "video" : "image" } : null;
  }
  if ((m = /linkedin\.com\/feed\/update\/(urn:li:[\w:]+)/.exec(url))) {
    const html = await page(`https://www.linkedin.com/embed/feed/update/${m[1]}?collapsed=1`);
    const imgs = [...html.matchAll(/(https:\/\/media\.licdn\.com\/dms\/image\/[^"'\s)]+)/g)].map((x) => amp(x[1])).filter((u) => !/company-logo|profile-displayphoto/.test(u));
    return imgs[0] ? { image: imgs[0], media_type: /<video/.test(html) ? "video" : "image" } : null;
  }
  return null;
}

// Download and store in Storage → public URL
export async function storeCover(id, imageUrl) {
  const r = await fetch(imageUrl, { headers: { "User-Agent": UA } }).catch(() => null);
  if (!r?.ok) return null;
  const type = (r.headers.get("content-type") || "image/jpeg").split(";")[0];
  if (!/^image\/(jpeg|png|webp|avif)$/.test(type)) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" }[type];
  const path = `${Math.floor(id / 1000)}/${id}.${ext}`;
  const { error } = await db.storage.from("covers").upload(path, buf, { contentType: type, upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(`storage: ${error.message}`);
  return { url: db.storage.from("covers").getPublicUrl(path).data.publicUrl, data: buf.toString("base64"), type };
}

// ---------- CLI ----------
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const argv = process.argv.slice(2);
  const arg = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
  const FROM = arg("--from"), TO = arg("--to"), LIMIT = Number(arg("--limit") || 1e9), ONLY = arg("--platform");
  // --latest 48: just the newest posts of the library (what members see first), any platform
  if (argv.includes("--latest")) {
    const N = Number(arg("--latest")) || 48;
    let done = 0;
    for (let off = 0; off < N; off += 100) {
      const { data: pg, error } = await db.rpc("library_ideas", { p_limit: Math.min(100, N - off), p_offset: off });
      if (error) throw error;
      for (const r of (pg.data || []).filter((x) => !x.cover_url)) {
        const ig = /instagram\.com/.test(r.url || "");
        const c = await coverFor(r.url);
        if (c?.broken) { await db.from("content_ideas").update({ unavailable_at: new Date().toISOString() }).eq("id", r.id); continue; }
        const stored = c?.image ? await storeCover(r.id, c.image).catch(() => null) : null;
        if (!stored) { process.stdout.write("·"); continue; }
        await db.from("content_ideas").update({ cover_url: stored.url, cover_at: new Date().toISOString(), ...(!ig && c.media_type ? { media_type: c.media_type } : {}), ...(!ig && c.width && c.height ? { media_width: c.width, media_height: c.height, media_ratio: Math.round((c.height / c.width) * 10000) / 10000 } : {}), ...(!ig && c.duration ? { duration_s: c.duration } : {}) }).eq("id", r.id);
        if (ig) await db.rpc("apply_ig_meta", { p_rows: [{ id: r.id, media_type: c.media_type, width: c.width, height: c.height, duration: c.duration, views: c.views }] });
        done++; process.stdout.write("+");
        await sleep(ig ? 1200 : 300);
      }
    }
    console.log(`\n${done} covers for the newest ${N} posts.`);
    process.exit(0);
  }
  const { data: cat } = await db.from("idea_catalog").select("id,name").eq("category", "platform");
  const platforms = (cat || []).filter((p) => !ONLY || p.name.toLowerCase() === ONLY.toLowerCase());
  let done = 0, broken = 0, missing = 0;
  for (const pf of platforms) {
    const slow = pf.name === "Instagram" ? 1200 : pf.name === "Facebook" || pf.name === "LinkedIn" ? 800 : 150;
    let offset = 0;
    while (done < LIMIT) {
      const { data: pageRows, error } = await db.rpc("library_ideas", { p_filters: { platform: { ids: [pf.id] } }, p_from: FROM, p_to: TO, p_limit: 100, p_offset: offset });
      if (error) throw error;
      const rows = (pageRows.data || []).filter((r) => !r.cover_url);
      if (!(pageRows.data || []).length) break;
      offset += pageRows.data.length;
      const metas = [];
      for (const r of rows) {
        if (done >= LIMIT) break;
        const c = await coverFor(r.url);
        if (c?.broken) { broken++; await db.from("content_ideas").update({ unavailable_at: new Date().toISOString() }).eq("id", r.id); await sleep(slow); continue; }
        const stored = c?.image ? await storeCover(r.id, c.image).catch(() => null) : null;
        if (!stored) { missing++; await sleep(slow); continue; }
        await db.from("content_ideas").update({ cover_url: stored.url, cover_at: new Date().toISOString(), ...(c.media_type && pf.name !== "Instagram" ? { media_type: c.media_type } : {}), ...(c.width && c.height && pf.name !== "Instagram" ? { media_width: c.width, media_height: c.height, media_ratio: Math.round((c.height / c.width) * 10000) / 10000 } : {}), ...(c.duration && pf.name !== "Instagram" ? { duration_s: c.duration } : {}) }).eq("id", r.id);
        if (pf.name === "Instagram") metas.push({ id: r.id, media_type: c.media_type, width: c.width, height: c.height, duration: c.duration, views: c.views });
        done++;
        await sleep(slow);
      }
      if (metas.length) { const { error: e } = await db.rpc("apply_ig_meta", { p_rows: metas }); if (e) console.log(`  ig meta: ${e.message}`); }
      console.log(`${pf.name}: ${done} covers · ${missing} without image · ${broken} removed from the platform`);
    }
  }
  console.log(`Done: ${done} covers.`);
}
