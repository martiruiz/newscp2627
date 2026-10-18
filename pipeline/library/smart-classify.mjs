#!/usr/bin/env node
// Smart filters for Instagram posts: Instagram's own data (exact format, size → aspect ratio, duration, views) + AI labels
// from the image and the caption.
//
//   node library/smart-classify.mjs --eval
//       Re-labels the posts you reviewed in Admin → Smart filters with the current AI (image + caption) and compares the
//       accuracy before (stored labels) and after. Synchronous, a few cents. Writes nothing to the library.
//
//   node library/smart-classify.mjs --prepare --from 2026-10-01 [--to 2026-10-31] [--limit 1000]
//       Reads Instagram's data for unlabelled Instagram posts, slowly (≈1 post / 1.2 s), saves format / aspect ratio /
//       duration / views to the library and the image to library/.smart-cache/ for the AI.
//   node library/smart-classify.mjs --submit        sends the prepared posts to the Batch API (50% off, < 24 h)
//   node library/smart-classify.mjs --collect       writes the finished batches' labels into the library
//
// Needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY in pipeline/.env and supabase/smart-filters.sql.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";
import { igMeta } from "./instagram.mjs";
import { AI_CATEGORIES } from "./taxonomy.mjs";
import { VERSION, MODEL, requestParams, parseAnswer, fetchImage, cost } from "./smart-ai.mjs";

loadEnv();
const env = (k) => process.env[k] || "";
const argv = process.argv.slice(2);
const arg = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const claude = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(HERE, ".smart-cache");
fs.mkdirSync(CACHE, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadPosts(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await db.from("content_ideas").select("id,url,title,published_at,media_type,content_idea_tags(idea_catalog(category,name))").in("id", ids.slice(i, i + 100));
    if (error) throw error;
    for (const p of data) {
      const tags = {};
      for (const { idea_catalog: v } of p.content_idea_tags || []) if (v) (tags[v.category] ||= []).push(v.name);
      out.push({ ...p, tags });
    }
  }
  return out;
}

// ---------- --eval: reviewed posts, before vs after ----------
if (argv.includes("--eval")) {
  let q = db.from("smart_review").select("post_id,ai,gold,ai_b,ai_b_version,verdicts,batch").eq("status", "done");
  if (arg("--batch")) q = q.eq("batch", arg("--batch"));
  const { data: gold, error } = await q;
  if (error) throw error;
  const posts = new Map((await loadPosts(gold.map((g) => g.post_id))).map((p) => [p.id, p]));
  console.log(`Re-labelling ${gold.length} reviewed posts with ${MODEL} (${VERSION}: image + caption)…`);
  let usd = 0, cacheRead = 0, inTok = 0, withImg = 0;
  const after = new Map();
  const queue = [...gold];
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (queue.length) {
      const g = queue.shift();
      const p = posts.get(g.post_id);
      if (!p) continue;
      const meta = await igMeta(p.url);
      const image = meta.status === "ok" && !argv.includes("--no-image") ? await fetchImage(meta.image) : null;
      if (image) withImg++;
      try {
        const msg = await claude.messages.create(requestParams({ ...p, media_type: meta.media_type }, image));
        after.set(g.post_id, parseAnswer(msg));
        usd += cost(msg.usage); cacheRead += msg.usage.cache_read_input_tokens || 0; inTok += msg.usage.input_tokens || 0;
      } catch (e) { console.log(`  ✗ ${g.post_id}: ${e.message}`); }
      process.stdout.write(".");
      await sleep(800);
    }
  }));
  console.log(`\n${after.size} labelled · ${withImg} with image · $${usd.toFixed(4)} · cache read ${cacheRead.toLocaleString()} tokens (${inTok.toLocaleString()} uncached)`);
  const norm = (x) => String(x).normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();
  const S = (v) => new Set([].concat(v || []).map(norm).filter(Boolean));
  const score = (pred, key) => {
    let tp = 0, fp = 0, fn = 0;
    for (const g of gold) {
      if (!after.has(g.post_id)) continue;
      const a = S(pred(g)[key]), t = S(g.gold[key]);
      // free-text names (opponent, sponsor, city): "Spurs" = "San Antonio Spurs"
      const free = AI_CATEGORIES.find((c) => c.key === key)?.free;
      const match = (x, set) => set.has(x) || (free && [...set].some((y) => y.includes(x) || x.includes(y)));
      for (const x of a) match(x, t) ? tp++ : fp++;
      for (const x of t) if (!match(x, a)) fn++;
    }
    return { p: tp + fp ? tp / (tp + fp) : null, r: tp + fn ? tp / (tp + fn) : null };
  };
  const f = (v) => (v == null ? "  —" : `${String(Math.round(v * 100)).padStart(3)}%`);
  console.log(`\n${"Filter".padEnd(22)} precision before → after   recall before → after`);
  for (const c of AI_CATEGORIES) {
    if (c.key === "city") continue; // new filter: not in the reviewed set yet
    const b = score((g) => g.ai, c.key), a = score((g) => after.get(g.post_id), c.key);
    console.log(`${c.label.padEnd(22)} ${f(b.p)} → ${f(a.p)}            ${f(b.r)} → ${f(a.r)}`);
  }
  // Against your blind decisions (Compare): for each decided filter, does this run give the answer you picked?
  const decided = gold.filter((g) => g.verdicts && g.ai_b);
  if (decided.length) {
    const nn = (v) => [].concat(v || []).map(norm).filter(Boolean).sort().join("|");
    console.log(`\nAgainst your Compare decisions (old vs ${decided[0].ai_b_version}) — share of decided filters where each version gives your answer:`);
    console.log(`${"Filter".padEnd(22)} old    ${String(decided[0].ai_b_version).padEnd(7)} this run   (decisions)`);
    for (const c of AI_CATEGORIES) {
      let n = 0, okOld = 0, okB = 0, okNow = 0;
      for (const g of decided) {
        const pick = g.verdicts?.[c.key]?.pick;
        if (!pick || pick === "none" || !after.has(g.post_id)) continue;
        const right = pick === "old" ? [g.ai[c.key]] : pick === "new" ? [g.ai_b[c.key]] : [g.ai[c.key], g.ai_b[c.key]];
        const ok = (v) => right.some((r) => nn(r) === nn(v));
        n++; okOld += ok(g.ai[c.key]); okB += ok(g.ai_b[c.key]); okNow += ok(after.get(g.post_id)[c.key]);
      }
      if (n) console.log(`${c.label.padEnd(22)} ${String(Math.round(100 * okOld / n)).padStart(3)}%   ${String(Math.round(100 * okB / n)).padStart(3)}%    ${String(Math.round(100 * okNow / n)).padStart(3)}%      (${n})`);
    }
  }
  const cities = [...after.values()].flatMap((x) => x.city || []);
  console.log(`\nCity (new): ${cities.length} found — ${[...new Set(cities)].slice(0, 20).join(", ")}`);
  fs.writeFileSync(path.join(HERE, "smart-eval-after.json"), JSON.stringify(Object.fromEntries(after), null, 2));
  // --save-b: keep these labels as version B for the blind comparison in Admin → Smart filters → Compare
  if (argv.includes("--save-b")) {
    const tag = `${VERSION}${argv.includes("--no-image") ? "-text" : ""}`;
    for (const [id, labels] of after) {
      const { error: e } = await db.from("smart_review").update({ ai_b: labels, ai_b_version: tag, verdicts: null }).eq("post_id", id);
      if (e) { console.log(/ai_b/.test(e.message) ? "Run the new lines of supabase/smart-review.sql first." : e.message); break; }
    }
    console.log(`Saved as version B (${tag}) for Admin → Smart filters → Compare.`);
  }
  process.exit(0);
}

// ---------- --seed-verify 30 --batch "2026-10 verify v6" --from 2026-10-01: new posts labelled by the current AI,
// to confirm / reject label by label in Admin → Smart filters ----------
if (argv.includes("--seed-verify")) {
  const N = Number(arg("--seed-verify")) || 30, BATCH = arg("--batch") || `verify ${VERSION}`, FROM = arg("--from");
  const { data: ig } = await db.from("idea_catalog").select("id").eq("category", "platform").eq("name", "Instagram").single();
  const { data: existing } = await db.from("smart_review").select("post_id");
  const taken = new Set((existing || []).map((r) => r.post_id));
  const ids = [];
  for (let i = 0; ids.length < N && i < 20; i++) {
    const { data: page, error } = await db.rpc("library_ideas", { p_order: "random", p_seed: `${Date.now()}-${i}`, p_limit: 100, p_from: FROM, p_filters: { platform: { ids: [ig.id] } } });
    if (error) throw error;
    for (const p of page.data || []) if (ids.length < N && !taken.has(p.id) && (p.title || "").trim().length > 15) { taken.add(p.id); ids.push(p.id); }
  }
  const posts = await loadPosts(ids);
  let usd = 0;
  const rows = [];
  for (const p of posts) {
    const meta = await igMeta(p.url);
    const image = meta.status === "ok" ? await fetchImage(meta.image) : null;
    try {
      const msg = await claude.messages.create(requestParams({ ...p, media_type: meta.media_type }, image));
      rows.push({ post_id: p.id, ai: parseAnswer(msg), batch: BATCH, status: "todo" });
      usd += cost(msg.usage);
    } catch (e) { console.log(`  ✗ ${p.id}: ${e.message}`); }
    process.stdout.write(".");
    await sleep(900);
  }
  const { error } = await db.from("smart_review").insert(rows);
  if (error) throw error;
  console.log(`\nVerify set "${BATCH}": ${rows.length} posts labelled by ${VERSION} · $${usd.toFixed(4)}`);
  process.exit(0);
}

// ---------- --prepare: Instagram data + images, slowly ----------
if (argv.includes("--prepare")) {
  const from = arg("--from"), to = arg("--to"), limit = Number(arg("--limit") || 1e9);
  const { data: cat } = await db.from("idea_catalog").select("id").eq("category", "platform").eq("name", "Instagram").single();
  let done = 0, broken = 0, offset = 0;
  while (done < limit) {
    const { data: page, error } = await db.rpc("library_ideas", { p_filters: { platform: { ids: [cat.id] } }, p_from: from, p_to: to, p_limit: 100, p_offset: offset });
    if (error) throw error;
    const rows = page.data || [];
    if (!rows.length) break;
    offset += rows.length;
    const ids = rows.map((r) => r.id);
    const { data: state } = await db.from("content_ideas").select("id,meta_at,smart_at").in("id", ids);
    const todo = rows.filter((r) => { const s = state.find((x) => x.id === r.id); return !s?.smart_at && !fs.existsSync(path.join(CACHE, `${r.id}.json`)); });
    const metas = [];
    for (const r of todo) {
      if (done >= limit) break;
      const meta = await igMeta(r.url);
      if (meta.status === "broken") { broken++; await db.from("content_ideas").update({ unavailable_at: new Date().toISOString() }).eq("id", r.id); continue; }
      if (meta.status !== "ok") { await sleep(3000); continue; }
      const image = await fetchImage(meta.image);
      fs.writeFileSync(path.join(CACHE, `${r.id}.json`), JSON.stringify({ id: r.id, media_type: meta.media_type, image }));
      metas.push({ id: r.id, media_type: meta.media_type, width: meta.width, height: meta.height, duration: meta.duration, views: meta.views });
      done++;
      await sleep(1200);
    }
    if (metas.length) { const { error: e2 } = await db.rpc("apply_ig_meta", { p_rows: metas }); if (e2) throw e2; }
    console.log(`prepared ${done}${broken ? ` · ${broken} removed from Instagram` : ""}`);
  }
  console.log(`Done: ${done} posts ready for --submit.`);
  process.exit(0);
}

// ---------- --submit: prepared posts → Batch API ----------
if (argv.includes("--submit")) {
  const files = fs.readdirSync(CACHE).filter((f) => /^\d+\.json$/.test(f));
  const prepared = files.map((f) => JSON.parse(fs.readFileSync(path.join(CACHE, f), "utf8")));
  if (!prepared.length) { console.log("Nothing prepared. Run --prepare first."); process.exit(0); }
  const posts = new Map((await loadPosts(prepared.map((p) => p.id))).map((p) => [p.id, p]));
  const batches = [];
  for (let i = 0; i < prepared.length; i += 2000) {
    const requests = prepared.slice(i, i + 2000).filter((p) => posts.has(p.id))
      .map((p) => ({ custom_id: String(p.id), params: requestParams({ ...posts.get(p.id), media_type: p.media_type }, p.image) }));
    const b = await claude.messages.batches.create({ requests });
    batches.push(b.id);
    for (const p of prepared.slice(i, i + 2000)) fs.renameSync(path.join(CACHE, `${p.id}.json`), path.join(CACHE, `${p.id}.sent`));
    console.log(`Batch ${b.id}: ${requests.length} posts`);
  }
  const log = path.join(CACHE, "batches.json");
  const all = fs.existsSync(log) ? JSON.parse(fs.readFileSync(log, "utf8")) : [];
  fs.writeFileSync(log, JSON.stringify([...all, ...batches.map((id) => ({ id, at: new Date().toISOString(), collected: false }))], null, 2));
  console.log("Submitted. Run --collect later (most batches finish within an hour, at most 24 h).");
  process.exit(0);
}

// ---------- --collect: finished batches → library ----------
if (argv.includes("--collect")) {
  const log = path.join(CACHE, "batches.json");
  const all = fs.existsSync(log) ? JSON.parse(fs.readFileSync(log, "utf8")) : [];
  let usd = 0;
  for (const b of all.filter((x) => !x.collected)) {
    const info = await claude.messages.batches.retrieve(b.id);
    if (info.processing_status !== "ended") { console.log(`${b.id}: ${info.processing_status} (${info.request_counts.processing} processing)`); continue; }
    const rows = [];
    for await (const r of await claude.messages.batches.results(b.id)) {
      if (r.result.type !== "succeeded") continue;
      try {
        const labels = parseAnswer(r.result.message);
        rows.push({ id: Number(r.custom_id), version: VERSION, labels });
        usd += cost(r.result.message.usage, { batch: true });
      } catch {}
    }
    for (let i = 0; i < rows.length; i += 200) { const { error } = await db.rpc("apply_smart_labels", { p_rows: rows.slice(i, i + 200) }); if (error) throw error; }
    for (const r of rows) fs.rmSync(path.join(CACHE, `${r.id}.sent`), { force: true });
    b.collected = true;
    console.log(`${b.id}: ${rows.length} posts labelled`);
  }
  fs.writeFileSync(log, JSON.stringify(all, null, 2));
  if (usd) console.log(`Cost: $${usd.toFixed(2)}`);
  for (const part of ["values", "totals", "pairs"]) await db.rpc("refresh_library_stats", { p_part: part });
  process.exit(0);
}

console.log("Use --eval, --prepare, --submit or --collect (see the top of this file).");
