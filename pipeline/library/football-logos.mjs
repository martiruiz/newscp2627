#!/usr/bin/env node
// Club and competition logos from football-logos.cc for the catalog values without a logo (decided by the SCP team on
// 2026-10-20, knowing the site's licence is for non-commercial use: logo_source keeps the page of each one so they can be
// found and removed if ever asked). The site's image sitemap lists every logo (700 × 700 PNG) with its name; a value
// takes the logo whose name matches (exact name first, then the name without "FC", "CF"…, only when that is unique).
// Copied to Storage (bucket "logos", public) → idea_catalog.logo_url.
//
//   cd pipeline && node library/football-logos.mjs [--category club|competition] [--limit 30] [--dry]
import zlib from "node:zlib";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";

loadEnv();
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const argv = process.argv.slice(2);
const arg = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const DRY = argv.includes("--dry"), LIMIT = Number(arg("--limit") || 1e9);
const CATS = arg("--category") ? [arg("--category")] : ["club", "competition"];
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- the site's logos: page, image, name ----------
const gz = await fetch("https://football-logos.cc/image-sitemap.xml.gz", { headers: { "User-Agent": UA } }).then((r) => r.arrayBuffer());
const xml = zlib.gunzipSync(Buffer.from(gz)).toString("utf8");
const logos = [];
for (const u of xml.split("<url>").slice(1)) {
  const page = /<loc>([^<]+)<\/loc>/.exec(u)?.[1];
  const imgs = [...u.matchAll(/<image:loc>([^<]+)<\/image:loc>\s*<image:title>([^<]+)<\/image:title>/g)].map((m) => ({ src: m[1], title: m[2].replace(/&amp;/g, "&") }));
  // the main version (not "--white", "--no-text", "--unofficial"…)
  const main = imgs.find((i) => !/--/.test(i.src.split("/").pop())) || imgs[0];
  if (page && main) logos.push({ page, src: main.src, name: main.title.replace(/\s+Logo$/i, "").trim(), kind: /\/tournaments\/|league|liga|cup|serie|division|championship|bundesliga|ligue|eredivisie|primeira/i.test(page) ? "competition" : "club" });
}
const fold = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const exact = (t) => fold(t).replace(/[^a-z0-9]/g, "");
const bare = (t) => fold(t).replace(/[^a-z0-9 ]+/g, " ").replace(/\b(fc|cf|afc|sc|ac|as|ss|ssc|cd|ud|sd|rc|rcd|bc|bk|fk|sk|club|de|the|f c|calcio|football|futbol)\b/g, " ").replace(/\s+/g, "");
const byExact = new Map(), byBare = new Map();
for (const l of logos) {
  byExact.set(exact(l.name), [...(byExact.get(exact(l.name)) || []), l]);
  byBare.set(bare(l.name), [...(byBare.get(bare(l.name)) || []), l]);
}
// checked by hand on the first run: wrong or doubtful matches (a national team ≠ a club, another sport, a mislabelled image)
const SKIP = new Set(["qatar", "sandiego", "deportivoalaves"]);
const pick = (v) => {
  if (SKIP.has(exact(v.name))) return null;
  const e = (byExact.get(exact(v.name)) || []).filter((l) => l.kind === v.category);
  if (e.length === 1) return e[0];
  const b = (byBare.get(bare(v.name)) || []).filter((l) => l.kind === v.category);
  return b.length === 1 && bare(v.name).length >= 4 ? b[0] : null;   // ambiguous ("Barcelona": Spain or Ecuador) → none
};
console.log(`${logos.length} logos on football-logos.cc`);

let done = 0, none = 0;
for (const cat of CATS) {
  const values = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from("idea_catalog").select("id,category,name,logo_url").eq("category", cat).is("logo_url", null).order("id").range(from, from + 999);
    values.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  for (const v of values) {
    if (done >= LIMIT) break;
    const l = pick(v);
    if (!l) { none++; continue; }
    done++;
    console.log(`✓ ${cat} ${v.name} → ${l.name}  ${l.page}`);
    if (DRY) continue;
    const img = await fetch(l.src, { headers: { "User-Agent": UA } }).catch(() => null);
    if (!img?.ok) { console.log("  image not available"); continue; }
    const file = `fl/${cat}-${v.id}.png`;
    const { error } = await db.storage.from("logos").upload(file, Buffer.from(await img.arrayBuffer()), { contentType: "image/png", upsert: true, cacheControl: "31536000" });
    if (error) throw new Error(`storage: ${error.message}`);
    const url = `${db.storage.from("logos").getPublicUrl(file).data.publicUrl}?v=${Date.now().toString(36)}`;
    await db.from("idea_catalog").update({ logo_url: url, logo_source: l.page }).eq("id", v.id);
    await sleep(400);
  }
}
console.log(`Done: ${done} ${DRY ? "matches" : "logos"}, ${none} without a match.`);
