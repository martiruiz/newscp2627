#!/usr/bin/env node
// Builds library/smart-examples.json from your blind Compare decisions (Admin → Smart filters → Compare): for the
// borderline cases, the caption and the labels you chose, mapped to the current filters. smart-ai.mjs puts them in the
// (cached) system prompt so the AI follows your criteria.   cd pipeline && node library/smart-examples.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";
import { AI_CATEGORIES, AI_VALUES } from "./taxonomy.mjs";

loadEnv();
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data } = await db.from("smart_review").select("post_id,ai,ai_b,verdicts").not("verdicts", "is", null);
const { data: posts } = await db.from("content_ideas").select("id,title,media_type,content_idea_tags(idea_catalog(category,name))").in("id", data.map((r) => r.post_id));

// Old labels → current filters (merged and removed values)
const MERGE = { "Live match": "Match coverage", "Post-match": "Match coverage" };
const toCurrent = (key, vals) => {
  const cat = AI_CATEGORIES.find((c) => c.key === key);
  const list = [].concat(vals || []).map((v) => MERGE[v] || v).filter((v) => cat?.free || (AI_VALUES[key] || []).includes(v));
  return cat?.single ? (list[0] || "") : [...new Set(list)];
};

const examples = [];
for (const r of data) {
  const p = posts.find((x) => x.id === r.post_id);
  if (!p) continue;
  const labels = {};
  for (const c of AI_CATEGORIES) {
    const pick = r.verdicts?.[c.key]?.pick;
    if (!pick || pick === "none" || c.key === "city") continue;
    const chosen = pick === "old" ? r.ai[c.key] : pick === "new" ? r.ai_b[c.key] : r.ai_b[c.key];
    const before = toCurrent(c.key, pick === "old" ? r.ai_b[c.key] : r.ai[c.key]);
    const after = toCurrent(c.key, chosen);
    if (JSON.stringify(after) === JSON.stringify(before)) continue; // the merge made both answers the same
    labels[c.key] = after;
  }
  if (!Object.keys(labels).length) continue;
  const fmt = (p.content_idea_tags || []).map((t) => t.idea_catalog).find((v) => v?.category === "format")?.name;
  examples.push({ caption: (p.title || "").replace(/\s+/g, " ").trim().slice(0, 220), format: p.media_type || fmt || "", labels });
}
// Most informative first: posts teaching several filters at once
examples.sort((a, b) => Object.keys(b.labels).length - Object.keys(a.labels).length);
const keep = examples.slice(0, 30);
fs.writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "smart-examples.json"), JSON.stringify(keep, null, 2));
const per = {};
for (const e of keep) for (const k of Object.keys(e.labels)) per[k] = (per[k] || 0) + 1;
console.log(`${keep.length} examples (from ${examples.length} posts with decisions) · ${Object.entries(per).map(([k, n]) => `${k} ${n}`).join(" · ")}`);
