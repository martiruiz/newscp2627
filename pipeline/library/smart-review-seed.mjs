#!/usr/bin/env node
// Builds the review set for Admin → Smart filters from the last sample (library/smart-filters-sample.json):
// every post the AI gave a rare label (matchday graphics, kit, transfer, away city, sponsor, crisis, season moment,
// outcome, collab) first, then random posts up to the size. The AI's labels are stored as the starting point.
//   cd pipeline && node library/smart-review-seed.mjs --size 100 --batch "2026-10 v1"
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";

loadEnv();
const args = process.argv.slice(2);
const SIZE = Number(args[args.indexOf("--size") + 1]) || 100;
const BATCH = args.includes("--batch") ? args[args.indexOf("--batch") + 1] : new Date().toISOString().slice(0, 10);
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
// --blind --from 2026-10-01: new random Instagram posts, no AI labels shown (unbiased review set)
if (args.includes("--blind")) {
  const FROM = args.includes("--from") ? args[args.indexOf("--from") + 1] : null;
  const { data: ig } = await db.from("idea_catalog").select("id").eq("category", "platform").eq("name", "Instagram").single();
  const { data: existing } = await db.from("smart_review").select("post_id");
  const taken = new Set((existing || []).map((r) => r.post_id));
  const picked = [];
  for (let i = 0; picked.length < SIZE && i < 20; i++) {
    const { data: page, error } = await db.rpc("library_ideas", { p_order: "random", p_seed: `${Date.now()}-${i}`, p_limit: 100, p_from: FROM, p_filters: { platform: { ids: [ig.id] } } });
    if (error) throw error;
    for (const p of page.data || []) if (picked.length < SIZE && !taken.has(p.id) && (p.title || "").trim().length > 15) { taken.add(p.id); picked.push(p.id); }
  }
  const { error } = await db.from("smart_review").insert(picked.map((id) => ({ post_id: id, ai: {}, batch: BATCH, status: "todo" })));
  if (error) { console.error(error.message); process.exit(1); }
  console.log(`Blind review set "${BATCH}": ${picked.length} new Instagram posts (no AI labels shown).`);
  process.exit(0);
}
const sample = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "smart-filters-sample.json"), "utf8"));
const rows = sample.rows.filter((r) => r.ai && r.id);

const RARE = ["matchday_graphic", "kit", "transfer", "crisis", "sponsor", "season_moment", "outcome", "collab", "comms"];
const has = (r, k) => [].concat(r.ai[k] || []).filter(Boolean).length > 0;
const awayCity = (r) => [].concat(r.ai.location || []).includes("Away city");
// rarest first, so each rare filter gets as many examples as possible
const picked = new Map();
for (const k of RARE) for (const r of rows) if (has(r, k) && picked.size < SIZE * 0.6) picked.set(r.id, r);
for (const r of rows) if (awayCity(r) && picked.size < SIZE * 0.65) picked.set(r.id, r);
const rest = rows.filter((r) => !picked.has(r.id)).sort(() => Math.random() - 0.5);
for (const r of rest) { if (picked.size >= SIZE) break; picked.set(r.id, r); }

const payload = [...picked.values()].map((r) => ({ post_id: r.id, ai: r.ai, batch: BATCH, status: "todo" }));
const { error } = await db.from("smart_review").upsert(payload, { onConflict: "post_id", ignoreDuplicates: true });
if (error) { console.error(/does not exist|schema cache/i.test(error.message) ? "Run supabase/smart-review.sql first." : error.message); process.exit(1); }
const count = (k) => payload.filter((p) => [].concat(p.ai[k] || []).filter(Boolean).length).length;
console.log(`Review set "${BATCH}": ${payload.length} posts`);
console.log(RARE.concat(["location"]).map((k) => `${k} ${count(k)}`).join(" · "));
