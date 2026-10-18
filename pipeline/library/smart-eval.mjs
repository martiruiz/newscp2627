#!/usr/bin/env node
// Accuracy of the AI labels against the reviewed ones (Admin → Smart filters): precision / recall per filter,
// the values it marks wrongly and the ones it misses.   cd pipeline && node library/smart-eval.mjs
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";
import { CATEGORIES } from "./taxonomy.mjs";
loadEnv();
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data } = await db.from("smart_review").select("post_id,status,ai,gold,note");
const done = data.filter((r) => r.status === "done" && r.gold);
console.log(`total ${data.length} · done ${done.length} · skipped ${data.filter((r) => r.status === "skipped").length}`);
const S = (v) => new Set([].concat(v || []).map((x) => String(x).trim().toLowerCase()).filter(Boolean));
for (const c of CATEGORIES) {
  let tp = 0, fp = 0, fn = 0; const fpv = {}, fnv = {};
  for (const r of done) { const a = S(r.ai[c.key]), g = S(r.gold[c.key]);
    for (const x of a) g.has(x) ? tp++ : (fp++, fpv[x] = (fpv[x] || 0) + 1);
    for (const x of g) if (!a.has(x)) { fn++; fnv[x] = (fnv[x] || 0) + 1; } }
  const p = tp + fp ? Math.round(100 * tp / (tp + fp)) : "-", rc = tp + fn ? Math.round(100 * tp / (tp + fn)) : "-";
  const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k}×${v}`).join(", ");
  console.log(`${c.label.padEnd(20)} P ${String(p).padStart(3)}%  R ${String(rc).padStart(3)}%  tp ${tp} fp ${fp} fn ${fn}  | wrong: ${top(fpv)} | missed: ${top(fnv)}`);
}
const notes = data.filter((r) => r.note).map((r) => `${r.post_id}: ${r.note}`);
if (notes.length) console.log("\nNOTES:\n" + notes.join("\n"));
