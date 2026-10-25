#!/usr/bin/env node
// Logos for the Content Library filters (competition and club crests, sponsor logos) from Wikimedia Commons.
// For each catalog value without a logo: Wikidata search → the item's "logo image" (P154) → a 128 px PNG from Commons,
// copied to Storage (bucket "logos", public) → idea_catalog.logo_url, with the Commons file page in logo_source.
// The library credits "Logos: Wikimedia Commons" under the filters.
//
//   cd pipeline && node library/logos.mjs [--category club|competition|sponsor] [--limit 50] [--from-id 1234] [--dry]
//   --dry only prints what it would pick (no Storage, no database writes).
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in pipeline/.env and supabase/library-filters.sql.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";

loadEnv();
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Wikimedia asks every client to say who it is
const UA = "SportsContentPlaybook-logos/1.0 (Content Library filters; https://sportscontentplaybook.com)";
const wd = async (params) => {
  const r = await fetch(`https://www.wikidata.org/w/api.php?${new URLSearchParams({ format: "json", origin: "*", ...params })}`, { headers: { "User-Agent": UA } });
  return r.ok ? r.json() : null;
};

// Which Wikidata descriptions fit each filter (the first search hit is often a person or a city)
const FITS = {
  club: /club|team|franchise|football|soccer|basketball|baseball|hockey|handball|volleyball|rugby|sports|esports|f\.c\.|cf\b/i,
  competition: /league|cup|championship|competition|tournament|series|division|liga|trophy|grand prix|tour\b/i,
  sponsor: /company|brand|manufacturer|airline|bank|corporation|business|retailer|operator|beverage|brewery|multinational|bookmaker|platform|carmaker/i,
};
const AVOID = /given name|family name|surname|human settlement|city|municipality|village|commune|disambiguation|season|album|song|film/i;

// "FC Barcelona" ≈ "Barcelona" ≈ "Futbol Club Barcelona": compare names without accents, punctuation and club prefixes
const norm = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/[^a-z0-9 ]+/g, " ").replace(/\b(fc|cf|afc|sc|ac|as|ss|ssc|cd|ud|sd|rc|rcd|bc|bk|fk|sk|club|de|the|football|futbol|calcio|f c)\b/g, " ").replace(/\s+/g, " ").trim();
const sameName = (name, e) => {
  const n = norm(name);
  const names = [e?.labels?.en?.value, ...(e?.aliases?.en || []).map((a) => a.value)].filter(Boolean).map(norm);
  // exact, or one name inside the other when it is most of it ("Bologna" ≈ "Bologna 1909", not "Athletic" ≈ "Athletic Sparta Prague")
  return n && names.some((x) => x === n || (Math.min(x.length, n.length) / Math.max(x.length, n.length) >= 0.5 && (x.includes(n) || n.includes(x))));
};
// Several logos on one item: prefer the crest / emblem over wide wordmarks
const pickFile = (claims) => {
  const files = (claims || []).filter((c) => c.rank !== "deprecated").map((c) => c.mainsnak?.datavalue?.value).filter(Boolean);
  return files.find((f) => !/wordmark|text|wide|horizontal|banner/i.test(f)) || files[0];
};

export async function findLogo(name, category) {
  const hits = (await wd({ action: "wbsearchentities", search: name, language: "en", uselang: "en", type: "item", limit: "10" }))?.search || [];
  const ids = hits.filter((h) => !AVOID.test(h.description || "")).map((h) => h.id);
  if (!ids.length) return null;
  const ents = (await wd({ action: "wbgetentities", ids: ids.join("|"), props: "claims|descriptions|labels|aliases", languages: "en" }))?.entities || {};
  for (const id of ids) {
    const e = ents[id];
    const desc = e?.descriptions?.en?.value || "";
    const file = pickFile(e?.claims?.P154);
    if (!file || !FITS[category].test(desc) || !sameName(name, e)) continue;
    const title = file.replace(/ /g, "_");
    return {
      wikidata: id, description: desc, file,
      image: `https://commons.wikimedia.org/w/index.php?title=Special:FilePath/${encodeURIComponent(title)}&width=128`,
      source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(title)}`,
    };
  }
  return null;
}

async function store(value, logo) {
  const r = await fetch(logo.image, { headers: { "User-Agent": UA } }).catch(() => null);
  if (!r?.ok) return null;
  const type = (r.headers.get("content-type") || "").split(";")[0];
  if (!/^image\/(png|jpeg|webp)$/.test(type)) return null;
  const ext = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[type];
  const file = `${value.category}/${value.id}.${ext}`;
  const { error } = await db.storage.from("logos").upload(file, Buffer.from(await r.arrayBuffer()), { contentType: type, upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(`storage: ${error.message}`);
  return db.storage.from("logos").getPublicUrl(file).data.publicUrl;
}

// ---------- CLI ----------
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const argv = process.argv.slice(2);
  const arg = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
  const DRY = argv.includes("--dry");
  const LIMIT = Number(arg("--limit") || 1e9);
  const cats = arg("--category") ? [arg("--category")] : ["competition", "club", "sponsor"];
  const FROM = Number(arg("--from-id") || 0);   // carry on after a run that stopped (ids above this one only)
  // a thousand rows per request (Supabase's cap): all of them, not just the first thousand
  const values = [];
  for (let from = 0; ; from += 1000) {
    let q = db.from("idea_catalog").select("id,category,name").in("category", cats).gt("id", FROM).order("category").order("id").range(from, from + 999);
    if (!DRY) q = q.is("logo_url", null);
    const { data, error } = await q;
    if (error) { console.error(/logo_url/.test(error.message) ? "Run supabase/library-filters.sql first." : error.message); process.exit(1); }
    values.push(...data);
    if (data.length < 1000) break;
  }
  let found = 0, missing = 0;
  for (const v of values.slice(0, LIMIT)) {
    const logo = await findLogo(v.name, v.category).catch(() => null);
    if (!logo) { missing++; console.log(`  –  ${v.category}: ${v.name}`); await sleep(200); continue; }
    if (DRY) { found++; console.log(`  ✓  ${v.category}: ${v.name} → ${logo.file} (${logo.description})`); await sleep(200); continue; }
    const url = await store(v, logo).catch((e) => { console.log(`  !  ${v.name}: ${e.message}`); return null; });
    if (!url) { missing++; continue; }
    await db.from("idea_catalog").update({ logo_url: url, logo_source: logo.source }).eq("id", v.id);
    found++;
    console.log(`  ✓  ${v.category}: ${v.name}`);
    await sleep(300);
  }
  console.log(`\n${found} logos${DRY ? " found (dry run)" : " stored"} · ${missing} without a logo on Wikimedia Commons.`);
}
