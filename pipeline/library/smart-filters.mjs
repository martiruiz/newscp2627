#!/usr/bin/env node
// Smart filters (taxonomy.mjs): classify Content Library posts with keyword rules + Claude.
//
//   node library/smart-filters.mjs --sample 50     test: random posts, rules vs AI side by side, real API cost and the
//                                                    estimate for the whole library → library/smart-filters-sample.html
//                                                    (nothing is written to the database)
//
// Needs in pipeline/.env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY. Model: AI_CLASSIFY_MODEL
// (default claude-haiku-5-5, $0.10 / $0.50 per million input / output tokens; half price with the Batch API).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";
import { CATEGORIES, VALUES, applyRules, canonicalBrand } from "./taxonomy.mjs";

loadEnv();
const env = (k) => process.env[k] || "";
const args = process.argv.slice(2);
const SAMPLE = Number(args[args.indexOf("--sample") + 1]) || 0;
const FROM = args.includes("--from") ? args[args.indexOf("--from") + 1] : null; // e.g. 2026-10-01
if (!SAMPLE) { console.error("Usage: node library/smart-filters.mjs --sample 50"); process.exit(1); }
for (const k of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_API_KEY"]) if (!env(k)) { console.error(`Missing ${k} in pipeline/.env`); process.exit(1); }

const MODEL = env("AI_CLASSIFY_MODEL") || "claude-haiku-5-5";
const PRICE_IN = Number(env("AI_CLASSIFY_PRICE_IN") || 0.10), PRICE_OUT = Number(env("AI_CLASSIFY_PRICE_OUT") || 0.50); // USD per MTok
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const claude = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });

// ---------- AI ----------
const arr = (values) => ({ type: "array", items: values ? { type: "string", enum: values } : { type: "string" } });
const SCHEMA = {
  type: "object", additionalProperties: false,
  properties: Object.fromEntries(CATEGORIES.map((c) => [c.key, c.single ? { type: "string", enum: VALUES[c.key] } : arr(c.free ? null : VALUES[c.key])])),
  required: CATEGORIES.map((c) => c.key),
};
const SYSTEM = `You label social media posts from sports clubs, leagues, federations, athletes and sports brands for a content research platform used by social media managers, designers, press officers, marketing and sponsorship teams.
You get the caption, the publication date, the format (image, carousel, video…) and the post's existing tags. Return the labels that clearly apply, using ONLY the allowed values. An empty list is better than a guess; usually 0-2 values per list.

- moment: the campaign moment(s) of the post.
- matchday_graphic: only for designed graphics (template images, not plain photos or videos) of a match: poster, countdown, squad list (call-up / convocatoria / convocats), starting XI (line-up / alineación / onze), half-time score, goal graphic, full-time / final score, MOTM vote, fixture or schedule, weekly recap, standings, stats card, quote card, birthday graphic, signing graphic. Use the format and the caption ("XI", "FT", "HT", "convocatoria", a score…) to judge; if it is clearly a video or a photo, leave it empty.
- kit: only when a kit is being announced or promoted (launch, reveal, "available now", jersey drop). Not when players just wear the kit.
- transfer: signings, contract renewals/extensions, loans and departures of players or coaches. NOT in-match substitutions (🔄, "change", "sustitución").
- outcome: the result for the posting team when the post is about a finished match (win / draw / loss).
- season_moment: opening day, derby (big local or historic rivalry), cup final, title celebration, promotion, relegation, European qualification, last game, pre-season.
- opponent: the rival team's usual name when the post is about a specific match (e.g. "Real Madrid", "AC Milan"). Empty otherwise.
- location: "Away city" when the content is about the city where an away match is played (sightseeing, landmarks, the team's arrival, local culture); "Home city", "Stadium", "Training ground" when the place is the clear focus.
- goal: the business goal the post clearly serves (tickets, merchandise, memberships, sponsor value, app, community, recruitment). "Engagement" only for posts built to get interactions (polls, questions, contests); "Fan growth" only for explicit follow / subscribe asks. Leave it empty for ordinary match content.
- comms: official press-type communication only.
- crisis: sensitive communication (apologies, racism or abuse, sanctions, serious injuries, incidents, condolences).
- team: which team or audience the post is about.
- angle: the storytelling angle(s).
- collab: collaborations (with players, other clubs, creators or brands; athlete takeovers; reposted fan content).
- cta: calls to action written in the caption.
- sponsor: commercial brands promoted, thanked or tagged (official brand name, e.g. "Spotify", "Emirates"). Not the club, the league, broadcasters' sports accounts, players or media.
- sponsor_sector: the sector of each sponsor.
- sponsor_integration: how the sponsor appears (logo on the graphic, "presented by" segment, co-branded post, product placement, activation / event, giveaway).
- language: the main language of the caption ("Emoji only" if there are no words).`;

async function classify(post) {
  const tags = Object.entries(post.tags || {}).map(([k, v]) => `${k}: ${v.map((x) => x.name).join(", ")}`).join("; ");
  const res = await claude.messages.create({
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: "disabled" },
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: `Date: ${String(post.published_at || "").slice(0, 10)}\nPlatform / format: ${(post.tags?.platform || []).map((x) => x.name).join(", ") || "?"} / ${(post.tags?.format || []).map((x) => x.name).join(", ") || "?"}\nExisting tags: ${tags || "none"}\nCaption:\n${(post.title || "(no caption)").slice(0, 1500)}` }],
  });
  if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") throw new Error(`stopped: ${res.stop_reason}`);
  const text = res.content.find((b) => b.type === "text")?.text || "{}";
  const out = JSON.parse(text);
  out.sponsor = [...new Set((out.sponsor || []).map(canonicalBrand).filter(Boolean))];
  out.opponent = [...new Set((out.opponent || []).map((x) => String(x).trim()).filter(Boolean))];
  return { out, usage: res.usage };
}

// ---------- Sample ----------
// Random posts with a caption, several shuffles of 100 until the sample is complete (no duplicates)
const posts = [], seen = new Set();
for (let i = 0; posts.length < SAMPLE && i < 30; i++) {
  const { data: page, error } = await db.rpc("library_ideas", { p_order: "random", p_seed: `${Date.now()}-${i}`, p_limit: 100, p_from: FROM });
  if (error) throw error;
  for (const p of page.data || []) {
    if (posts.length >= SAMPLE || seen.has(p.id) || (p.title || "").trim().length <= 20) continue;
    seen.add(p.id); posts.push(p);
  }
}
console.log(`Classifying ${posts.length} posts with rules + ${MODEL}…`);

const rows = [];
let tin = 0, tout = 0, failed = 0;
const queue = [...posts];
async function worker() {
  while (queue.length) {
    const p = queue.shift();
    const rules = applyRules(p);
    let ai = null, err = null;
    try {
      const r = await classify(p);
      ai = r.out;
      tin += r.usage.input_tokens; tout += r.usage.output_tokens;
    } catch (e) { err = e.message; failed++; }
    rows.push({ p, rules, ai, err });
    process.stdout.write(".");
  }
}
const t0 = Date.now();
await Promise.all(Array.from({ length: 5 }, worker));
console.log(`\nDone in ${((Date.now() - t0) / 1000).toFixed(0)}s`);

// ---------- Report ----------
const cost = (tin * PRICE_IN + tout * PRICE_OUT) / 1e6;
const ok = rows.filter((r) => r.ai);
const perPost = ok.length ? cost / ok.length : 0;
const { data: totals } = await db.from("library_totals").select("n").eq("key", "library").maybeSingle();
const library = Number(totals?.n || 540000);
const coverage = (src) => Object.fromEntries(CATEGORIES.map((c) => [c.key, rows.filter((r) => (src === "rules" ? r.rules[c.key].size : (r.ai ? [].concat(r.ai[c.key] || []).filter(Boolean).length : 0))).length]));
const covRules = coverage("rules"), covAi = coverage("ai");
let agree = 0, compared = 0;
for (const r of ok) for (const c of CATEGORIES) {
  const a = new Set([].concat(r.ai[c.key] || []).filter(Boolean)), b = r.rules[c.key];
  if (!a.size && !b.size) continue;
  compared++;
  if ([...b].some((x) => a.has(x)) || (!b.size && !a.size)) agree++;
}
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const chips = (vals, cls) => [...vals].filter(Boolean).map((v) => `<span class="c ${cls}">${esc(v)}</span>`).join("") || `<span class="none">—</span>`;
const html = `<!doctype html><meta charset="utf-8"><title>Smart filters · sample of ${rows.length}</title>
<style>body{font:14px/1.5 Inter,system-ui,sans-serif;margin:32px;color:#121b33;background:#f6f7fb}h1{font-size:24px;margin:0 0 6px}
.k{display:flex;flex-wrap:wrap;gap:12px;margin:18px 0}.k div{background:#fff;border:1px solid #e3e7ef;border-radius:12px;padding:12px 16px;min-width:150px}.k b{display:block;font-size:22px}
table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #e3e7ef;border-radius:12px;overflow:hidden}td,th{border-top:1px solid #eef1f6;padding:8px 10px;vertical-align:top;text-align:left}
th{background:#f0f2f7;font-size:12px;text-transform:uppercase;letter-spacing:.04em}.cap{max-width:340px;color:#3b4660;font-size:12.5px}.c{display:inline-block;margin:1px 3px 1px 0;padding:1px 7px;border-radius:10px;font-size:12px}
.r{background:#e7eefc;color:#2a4fb3}.a{background:#e6f7ee;color:#137a43}.none{color:#b0b8c8}.cat{font-weight:600;font-size:12px;color:#5b6680;white-space:nowrap}a{color:#2a4fb3}</style>
<h1>Smart filters · test on ${rows.length} random posts${FROM ? ` since ${esc(FROM)}` : ""}</h1>
<p>Blue = keyword rules (free). Green = AI (${esc(MODEL)}). Nothing has been written to the database.</p>
<div class="k">
<div>Posts analysed<b>${rows.length}</b>${failed ? `${failed} AI errors` : ""}</div>
<div>Real AI cost<b>$${cost.toFixed(4)}</b>${tin.toLocaleString()} in · ${tout.toLocaleString()} out tokens</div>
<div>Per post<b>$${perPost.toFixed(5)}</b></div>
<div>All ${library.toLocaleString()} posts<b>$${(perPost * library).toFixed(0)}</b>standard API</div>
<div>All posts with Batch API<b>$${(perPost * library / 2).toFixed(0)}</b>50% off, ready in &lt;24h</div>
<div>Rules agree with AI<b>${compared ? Math.round((agree / compared) * 100) : 0}%</b>of labelled categories</div>
</div>
<table><tr><th>Category</th>${CATEGORIES.map((c) => `<th>${c.label}</th>`).join("")}</tr>
<tr><td class="cat">Posts with a label · rules</td>${CATEGORIES.map((c) => `<td>${covRules[c.key]}/${rows.length}</td>`).join("")}</tr>
<tr><td class="cat">Posts with a label · AI</td>${CATEGORIES.map((c) => `<td>${covAi[c.key]}/${rows.length}</td>`).join("")}</tr></table>
<h2 style="margin-top:28px">What the AI found (values × number of posts)</h2>
<table>${CATEGORIES.map((c) => {
  const m = {};
  for (const r of ok) for (const v of [].concat(r.ai[c.key] || []).filter(Boolean)) m[v] = (m[v] || 0) + 1;
  const n = ok.filter((r) => [].concat(r.ai[c.key] || []).filter(Boolean).length).length;
  return `<tr><td class="cat">${c.label}<br><span style="font-weight:400">${n}/${ok.length} posts</span></td><td>${Object.entries(m).sort((a, b) => b[1] - a[1]).map(([v, k]) => `<span class="c a">${esc(v)} · ${k}</span>`).join("") || `<span class="none">—</span>`}</td></tr>`;
}).join("")}
<tr><td class="cat">Hashtags (rules, free)</td><td>${(() => { const m = {}; for (const r of rows) for (const h of r.rules.hashtags || []) m[h] = (m[h] || 0) + 1; return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([h, k]) => `<span class="c r">${esc(h)} · ${k}</span>`).join(""); })()}</td></tr></table>
<h2 style="margin-top:28px">Post by post</h2>
<table><tr><th>Post</th>${CATEGORIES.map((c) => `<th>${c.label}</th>`).join("")}</tr>
${rows.map((r) => `<tr><td class="cap"><a href="${esc(r.p.url)}" target="_blank">${esc(String(r.p.published_at || "").slice(0, 10))}</a> · ${esc((r.p.tags?.club || r.p.tags?.competition || [])[0]?.name || "")}<br>${esc((r.p.title || "").slice(0, 220))}${(r.p.title || "").length > 220 ? "…" : ""}${r.err ? `<br><b style="color:#c33">AI error: ${esc(r.err)}</b>` : ""}</td>
${CATEGORIES.map((c) => `<td>${chips(r.rules[c.key], "r")}<br>${r.ai ? chips([].concat(r.ai[c.key] || []), "a") : ""}</td>`).join("")}</tr>`).join("")}
</table>`;
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "smart-filters-sample.html");
fs.writeFileSync(out, html);
fs.writeFileSync(out.replace(/\.html$/, ".json"), JSON.stringify({ model: MODEL, tokens: { in: tin, out: tout }, cost, perPost, library, rows: rows.map((r) => ({ id: r.p.id, url: r.p.url, rules: Object.fromEntries(Object.entries(r.rules).map(([k, v]) => [k, [...v]])), ai: r.ai, err: r.err })) }, null, 2));
console.log(`Real cost: $${cost.toFixed(4)} (${tin} in / ${tout} out tokens) · $${perPost.toFixed(5)} per post`);
console.log(`Estimate for ${library.toLocaleString()} posts: $${(perPost * library).toFixed(0)} (standard) · $${(perPost * library / 2).toFixed(0)} (Batch API)`);
console.log(`Report: ${out}`);
