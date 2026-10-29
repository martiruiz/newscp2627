#!/usr/bin/env node
// Smart filters, automatic and for every platform (GitHub Action "Smart filters"): the AI labels (smart-ai.mjs: Claude Haiku,
// the post's cover from Storage + its caption) for the posts that don't have them, written into the library's filters.
//
//   node library/smart-auto.mjs --eval            accuracy per filter on the posts reviewed in Admin → Smart filters (a few cents)
//   node library/smart-auto.mjs --test 100        labels 100 pending posts right away (writes them) → real cost per 1,000 posts
//   node library/smart-auto.mjs --run [--from YYYY-MM-DD] [--limit N]
//        collects the finished batches into the library, then sends the pending posts (imported since --from; default
//        the last 7 days) to the Batch API (half price, < 24 h). A post is never sent twice (table smart_batches).
//
// Needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY and supabase/smart-auto.sql.
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";
import { AI_CATEGORIES, AI_VALUES } from "./taxonomy.mjs";
import { VERSION, MODEL, requestParams, parseAnswer, fetchImage, cost } from "./smart-ai.mjs";

loadEnv();
const argv = process.argv.slice(2);
const arg = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const claude = new Anthropic();

async function loadPosts(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await db.from("content_ideas").select("id,url,title,published_at,media_type,cover_url,content_idea_tags(source,idea_catalog(category,name))").in("id", ids.slice(i, i + 100));
    if (error) throw error;
    for (const p of data) {
      const tags = {};   // the import's tags only: the AI's own earlier labels are not given back to it
      for (const { source, idea_catalog: v } of p.content_idea_tags || []) if (v && source !== "ai") (tags[v.category] ||= []).push(v.name);
      out.push({ ...p, tags });
    }
  }
  return out;
}
const request = async (p) => requestParams(p, await fetchImage(p.cover_url));
const per1000 = (usd, n) => (n ? (usd / n) * 1000 : 0).toFixed(2);

// the posts without AI labels, newest first (not removed, not already in a batch on its way)
async function pending(from, limit) {
  const { data: open } = await db.from("smart_batches").select("post_ids").is("collected_at", null);
  const sent = new Set((open || []).flatMap((b) => b.post_ids));
  const ids = [];
  for (let last = null; ids.length < limit; ) {
    let q = db.from("content_ideas").select("id").is("smart_at", null).is("unavailable_at", null).gte("created_at", from).order("id", { ascending: false }).limit(1000);
    if (last) q = q.lt("id", last);
    const { data, error } = await q;
    if (error) throw error;
    if (!data.length) break;
    for (const r of data) if (!sent.has(r.id) && ids.length < limit) ids.push(r.id);
    last = data.at(-1).id;
  }
  return ids;
}

// ---------- --eval: the reviewed posts, labelled again, against your answers ----------
if (argv.includes("--eval")) {
  const { data: gold, error } = await db.from("smart_review").select("post_id,gold,ai").eq("status", "done");
  if (error) throw error;
  const posts = await loadPosts(gold.map((g) => g.post_id));
  let usd = 0, withImg = 0;
  const after = new Map();
  for (const p of posts) {
    const params = await request(p);
    if (params.messages[0].content.length > 1) withImg++;
    try { const msg = await claude.messages.create(params); after.set(p.id, parseAnswer(msg)); usd += cost(msg.usage); }
    catch (e) { console.log(`  ✗ ${p.id}: ${e.message}`); }
  }
  const norm = (x) => String(x).normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();
  const S = (v) => new Set([].concat(v || []).map(norm).filter(Boolean));
  console.log(`${after.size} reviewed posts labelled by ${MODEL} (${withImg} with their cover) · $${usd.toFixed(4)}\n`);
  // your answers were given with an earlier version of the filters: values the platform's filters no longer have can't be
  // given by the AI, so they are left out (or mapped to today's value when there is an obvious one)
  const SAME = { "post-match": "match coverage", "live match": "match coverage", "preseason / tour": null };
  const today = (c, v) => {
    if (c.free || !AI_VALUES[c.key]) return v;
    const ok = new Set(AI_VALUES[c.key].map(norm));
    return [...S(v)].map((x) => (x in SAME ? SAME[x] : x)).filter((x) => x && ok.has(x));
  };
  for (const g of gold) if (g.gold) for (const c of AI_CATEGORIES) if (c.key in g.gold) g.gold[c.key] = today(c, g.gold[c.key]);
  // before = the labels the reviewed posts had (the earlier AI), now = this run
  const score = (pred, c) => {
    let tp = 0, fp = 0, fn = 0;
    for (const g of gold) {
      if (!after.has(g.post_id) || !g.gold || !(c.key in g.gold)) continue;
      const a = S((pred(g) || {})[c.key]), t = S(g.gold[c.key]);
      const match = (x, set) => set.has(x) || (c.free && [...set].some((y) => y.includes(x) || x.includes(y)));
      for (const x of a) match(x, t) ? tp++ : fp++;
      for (const x of t) if (!match(x, a)) fn++;
    }
    return { tp, fp, fn };
  };
  const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : "—").padStart(5);
  console.log(`${"Filter".padEnd(24)} precision before → now   recall before → now   (labels you gave)`);
  const T = { b: { tp: 0, fp: 0, fn: 0 }, a: { tp: 0, fp: 0, fn: 0 } };
  for (const c of AI_CATEGORIES) {
    const b = score((g) => g.ai, c), a = score((g) => after.get(g.post_id), c);
    for (const k of ["tp", "fp", "fn"]) { T.b[k] += b[k]; T.a[k] += a[k]; }
    console.log(`${c.label.padEnd(24)} ${pct(b.tp, b.tp + b.fp)} → ${pct(a.tp, a.tp + a.fp)}           ${pct(b.tp, b.tp + b.fn)} → ${pct(a.tp, a.tp + a.fn)}        (${a.tp + a.fn})`);
  }
  // the disagreements, to tune the prompt: post id, filter, the AI's answer → yours
  if (argv.includes("--diff")) for (const g of gold) {
    const a = after.get(g.post_id);
    if (!a || !g.gold) continue;
    const p = posts.find((x) => x.id === g.post_id);
    const lines = AI_CATEGORIES.filter((c) => c.key in g.gold && [...S(a[c.key])].sort().join("|") !== [...S(g.gold[c.key])].sort().join("|"))
      .map((c) => `   ${c.key}: AI ${JSON.stringify([...S(a[c.key])])} · you ${JSON.stringify([...S(g.gold[c.key])])}`);
    if (lines.length) console.log(`\n#${g.post_id} ${p.url}\n   caption: ${(p.title || "").replace(/\s+/g, " ").slice(0, 300)}\n${lines.join("\n")}`);
  }
  console.log(`${"All filters".padEnd(24)} ${pct(T.b.tp, T.b.tp + T.b.fp)} → ${pct(T.a.tp, T.a.tp + T.a.fp)}           ${pct(T.b.tp, T.b.tp + T.b.fn)} → ${pct(T.a.tp, T.a.tp + T.a.fn)}`);
  process.exit(0);
}

// ---------- --test N: labelled right away, real cost ----------
if (argv.includes("--test")) {
  const N = Number(arg("--test")) || 100;
  const posts = await loadPosts(await pending("2026-10-19", N));
  let usd = 0, withImg = 0;
  const rows = [];
  for (const p of posts) {
    const params = await request(p);
    if (params.messages[0].content.length > 1) withImg++;
    try { const msg = await claude.messages.create(params); rows.push({ id: p.id, version: VERSION, labels: parseAnswer(msg) }); usd += cost(msg.usage); }
    catch (e) { console.log(`  ✗ ${p.id}: ${e.message}`); }
  }
  const { error } = await db.rpc("apply_smart_labels", { p_rows: rows });
  if (error) throw error;
  for (const part of ["values", "totals", "pairs"]) await db.rpc("refresh_library_stats", { p_part: part });
  console.log(`${rows.length} posts labelled (${withImg} with their cover) · $${usd.toFixed(4)} → $${per1000(usd, rows.length)} per 1,000 posts ($${per1000(usd / 2, rows.length)} with the Batch API)`);
  process.exit(0);
}

// ---------- --run: collect the finished batches, send the pending posts ----------
if (argv.includes("--run")) {
  const { data: open, error } = await db.from("smart_batches").select("id").is("collected_at", null);
  if (error) throw error;
  let labelled = 0, spent = 0;
  for (const b of open) {
    const info = await claude.messages.batches.retrieve(b.id);
    if (info.processing_status !== "ended") { console.log(`${b.id}: ${info.processing_status}`); continue; }
    const rows = [];
    let usd = 0;
    for await (const r of await claude.messages.batches.results(b.id)) {
      if (r.result.type !== "succeeded") continue;
      try { rows.push({ id: Number(r.custom_id), version: VERSION, labels: parseAnswer(r.result.message) }); usd += cost(r.result.message.usage, { batch: true }); } catch {}
    }
    for (let i = 0; i < rows.length; i += 200) { const { error: e } = await db.rpc("apply_smart_labels", { p_rows: rows.slice(i, i + 200) }); if (e) throw e; }
    await db.from("smart_batches").update({ collected_at: new Date().toISOString(), labelled: rows.length, usd }).eq("id", b.id);
    labelled += rows.length; spent += usd;
    console.log(`${b.id}: ${rows.length} posts labelled · $${usd.toFixed(2)}`);
  }
  if (labelled) for (const part of ["values", "totals", "pairs"]) await db.rpc("refresh_library_stats", { p_part: part });

  const from = arg("--from") || new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const ids = await pending(from, Number(arg("--limit")) || 50000);
  // a batch may not exceed 256 MB: ~200 MB or 2,000 posts each
  const MAX_BYTES = 200 * 1024 * 1024, MAX_POSTS = 2000;
  let sent = 0, batch = [], bytes = 0;
  const flush = async () => {
    const b = await claude.messages.batches.create({ requests: batch });
    await db.from("smart_batches").insert({ id: b.id, post_ids: batch.map((r) => Number(r.custom_id)) });
    sent += batch.length;
    console.log(`Batch ${b.id}: ${batch.length} posts (${Math.round(bytes / 1048576)} MB)`);
    batch = []; bytes = 0;
  };
  for (let i = 0; i < ids.length; i += 100) {
    for (const p of await loadPosts(ids.slice(i, i + 100))) {
      const r = { custom_id: String(p.id), params: await request(p) };
      const size = JSON.stringify(r).length;
      if (batch.length && (bytes + size > MAX_BYTES || batch.length >= MAX_POSTS)) await flush();
      batch.push(r); bytes += size;
    }
  }
  if (batch.length) await flush();
  console.log(`\n${labelled} posts labelled ($${spent.toFixed(2)}) · ${sent} posts sent (imported since ${from}), collected on a later run`);
  process.exit(0);
}

console.log("Use --eval, --test N or --run (see the top of this file).");
