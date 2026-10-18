#!/usr/bin/env node
// Club and competition crests from TheSportsDB (official badges, transparent PNG, same style everywhere).
// For each catalog value: TheSportsDB search by name → the team / league whose name (or alternate name) matches →
// its badge (250 px "small" version) copied to Storage (bucket "logos", public) → idea_catalog.logo_url, with the
// TheSportsDB page in logo_source. Values TheSportsDB doesn't know keep their logo (then: ig-avatars.mjs --not-sportsdb).
//
//   cd pipeline && node library/sportsdb-logos.mjs [--category club|competition] [--limit 50] [--top 12] [--dry] [--compare]
//   --top N      only the N values with most posts per category (for a test)
//   --dry        prints what it would pick, writes nothing
//   --compare    with --dry: writes mockups/logos-compare.html (current logo vs TheSportsDB badge)
// Key: SPORTSDB_KEY in pipeline/.env (their free test key "123" if unset; production use needs their paid key).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";

loadEnv();
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const KEY = process.env.SPORTSDB_KEY || "123";
const API = `https://www.thesportsdb.com/api/v1/json/${KEY}`;
const argv = process.argv.slice(2);
const arg = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const DRY = argv.includes("--dry"), COMPARE = argv.includes("--compare");
const LIMIT = Number(arg("--limit") || 1e9), TOP = Number(arg("--top") || 0);
const CATS = arg("--category") ? [arg("--category")] : ["competition", "club"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HERE = path.dirname(fileURLToPath(import.meta.url));

async function api(q) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`${API}/${q}`);
    if (r.status === 429) { await sleep(20000); continue; }
    await sleep(2100);   // free key: ~30 requests a minute
    if (!r.ok) return null;
    return r.json().catch(() => null);
  }
  return null;
}

// "FC Barcelona" ≈ "Barcelona" ≈ "Futbol Club Barcelona"
const norm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9 ]+/g, " ").replace(/\b(fc|cf|afc|sc|ac|as|ss|ssc|cd|ud|sd|rc|rcd|bc|bk|fk|sk|club|de|the|football|futbol|calcio|f c)\b/g, " ").replace(/\s+/g, " ").trim();
// leagues are named with their country or organiser in front ("Spanish La Liga", "UEFA Champions League")
const bare = (t) => norm(t).replace(/\b(english|spanish|italian|german|french|portuguese|dutch|belgian|scottish|american|uefa|fifa|conmebol)\b/g, " ").replace(/\s+/g, "");
const names = (o, keys) => keys.flatMap((k) => String(o[k] || "").split(",")).map(norm).filter(Boolean);
const same = (a, list) => list.some((b) => b === a || (Math.min(a.length, b.length) / Math.max(a.length, b.length) >= 0.6 && (a.includes(b) || b.includes(a))));

async function teamBadge(name) {
  const d = await api(`searchteams.php?t=${encodeURIComponent(name)}`);
  const n = norm(name);
  // exact name first (strTeam, then alternates), then a close one; ties → the most followed team on TheSportsDB
  const list = (d?.teams || []).filter((x) => x.strBadge);
  const score = (x) => norm(x.strTeam) === n ? 3 : names(x, ["strTeamAlternate", "strTeamShort"]).includes(n) ? 2 : same(n, names(x, ["strTeam", "strTeamAlternate"])) ? 1 : 0;
  const t = list.filter((x) => score(x) > 0).sort((a, b) => score(b) - score(a) || Number(b.intLoved || 0) - Number(a.intLoved || 0))[0];
  return t ? { badge: `${t.strBadge}/small`, page: `https://www.thesportsdb.com/team/${t.idTeam}`, match: t.strTeam } : null;
}
let leagues = null;
async function leagueBadge(name) {
  leagues ||= (await api("all_leagues.php"))?.leagues || [];
  const n = norm(name);
  const b = bare(name);
  const l = leagues.find((x) => [x.strLeague, ...String(x.strLeagueAlternate || "").split(",")].some((y) => y && bare(y) === b))
    || leagues.find((x) => same(n, names(x, ["strLeague", "strLeagueAlternate"])));
  if (!l) return null;
  const d = await api(`lookupleague.php?id=${l.idLeague}`);
  const full = d?.leagues?.[0];
  return full?.strBadge ? { badge: `${full.strBadge}/small`, page: `https://www.thesportsdb.com/league/${l.idLeague}`, match: l.strLeague } : null;
}

let values = [];
for (const cat of CATS) {
  if (TOP) {
    const { data } = await db.rpc("catalog_with_counts");
    const ids = (data || []).filter((r) => r.category === cat).sort((a, b) => Number(b.ideas) - Number(a.ideas)).slice(0, TOP).map((r) => Number(r.id));
    const { data: rows } = await db.from("idea_catalog").select("id,category,name,logo_url,logo_source").in("id", ids);
    values.push(...ids.map((id) => rows.find((r) => r.id === id)).filter(Boolean));
  } else {
    const { data } = await db.from("idea_catalog").select("id,category,name,logo_url,logo_source").eq("category", cat).order("id");
    values.push(...(data || []));
  }
}

const results = [];
let done = 0, missing = 0;
for (const v of values) {
  if (done + missing >= LIMIT) break;
  if (/thesportsdb\.com/.test(v.logo_source || "") && !argv.includes("--refresh")) continue;
  const hit = v.category === "competition" ? await leagueBadge(v.name) : await teamBadge(v.name);
  results.push({ ...v, hit });
  if (!hit) { missing++; console.log(`· ${v.category} ${v.name}: not in TheSportsDB`); continue; }
  console.log(`✓ ${v.category} ${v.name} → ${hit.match}`);
  done++;
  if (DRY) continue;
  const img = await fetch(hit.badge);
  if (!img.ok) { console.log(`  badge not available (${img.status})`); continue; }
  const file = `sdb/${v.category}-${v.id}.png`;
  const { error } = await db.storage.from("logos").upload(file, Buffer.from(await img.arrayBuffer()), { contentType: "image/png", upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(`storage: ${error.message}`);
  const url = `${db.storage.from("logos").getPublicUrl(file).data.publicUrl}?v=${Date.now().toString(36)}`;
  await db.from("idea_catalog").update({ logo_url: url, logo_source: hit.page }).eq("id", v.id);
}
console.log(`Done: ${done} badges from TheSportsDB, ${missing} not found.`);

if (COMPARE) {
  const cell = (src, cls = "") => src ? `<span class="c ${cls}"><img src="${src}" alt=""></span>` : `<span class="c none">—</span>`;
  const rows = results.map((r) => `<tr><td><b>${r.name}</b><small>${r.category}</small></td><td>${cell(r.logo_url)}</td><td>${cell(r.hit?.badge)}</td><td><small>${r.hit ? r.hit.match : "not found → Instagram"}</small></td></tr>`).join("");
  fs.writeFileSync(path.join(HERE, "../../mockups/logos-compare.html"), `<!doctype html><html><head><meta charset="utf-8"><title>Logos · now vs TheSportsDB</title>
<link rel="stylesheet" href="../css/fonts.css?v=1"><style>
body{margin:0;padding:40px;background:#0b1020;color:#fff;font-family:Inter,system-ui,sans-serif}h1{font-size:24px;margin:0 0 6px}p{color:#b4c0d3;margin:0 0 24px;font-size:14px}
table{border-collapse:collapse;width:100%;max-width:900px}th{text-align:left;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#b4c0d3;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.12)}
td{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.06);vertical-align:middle}td b{display:block;font-size:14px}td small{color:#8b98ae;font-size:12px}
.c{display:inline-grid;place-items:center;width:44px;height:44px;border-radius:50%;background:#f4f6fb;box-shadow:0 0 0 1px rgba(255,255,255,.16)}.c img{width:32px;height:32px;object-fit:contain}.c.none{background:#0d1426;color:#8b98ae}
.big .c{width:64px;height:64px}.big .c img{width:46px;height:46px}
</style></head><body><h1>Logos · now vs TheSportsDB</h1><p>Each logo as it would look in the library circle. Not found in TheSportsDB → the Instagram profile picture.</p>
<table><thead><tr><th>Club / competition</th><th>Now</th><th>TheSportsDB</th><th>Match</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
  console.log("Wrote mockups/logos-compare.html");
}
