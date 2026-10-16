#!/usr/bin/env node
// Deep analysis helpers for the Content Library (imported posts, table content_ideas).
//
//   node library/analysis.mjs next [N]            → the N newest posts without analysis, as JSON (id, url, caption, tags)
//   Analyses are stored in ai_analyses (global, shared). Members unlock them with AI credits (supabase/billing.sql).
//   node library/analysis.mjs cover <id>          → saves the post's image to media/<id>/cover.jpg (photos / carousels)
//   node library/analysis.mjs save <id> <file>    → validates an analysis JSON and stores it on the post
//
// Analysis format (adapted from instagram-research-tool's ReelEntry, MIT, Manthan Patel). Shown in the library's analysis pop-up.
// {
//   "summary": "1–2 sentences: what the post shows",
//   "whyItWorks": "2–3 sentences: why it works / what makes it worth studying",
//   "hook": { "text", "category", "template", "whyItWorks" },
//   "format": { "category", "type", "visualLayout", "pacing" },
//   "angle": { "topic", "angle" },
//   "visualBreakdown": [ { "t": 0, "shot": "", "onScreenText": "", "why": "" } ],
//   "scrollStoppers": [ { "t": 0, "moment": "", "why": "" } ],
//   "replicable": { "is": true, "howToAdapt": "how a club / brand can recreate it with its own assets" },
//   "topics": ["behind-the-scenes", "kit"],
//   "moment": "matchday|signing|kit|sponsor|behind_the_scenes|fans|milestone|community|ticketing|training|humour|other",
//   "style": "talking_head|pov|meme|graphic|montage|interview|challenge|vlog|live_action|other",
//   "language": "es",
//   "basis": "video" | "image"      // what the analysis is based on
// }
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";
import { igEmbed } from "./instagram.mjs";

loadEnv();
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const [cmd, a, b] = process.argv.slice(2);

if (cmd === "next") {
  const n = Number(a) || 10;
  const { data: rows, error } = await db
    .from("content_ideas")
    .select("id,url,title,published_at,ai_analyses(id),content_idea_tags(idea_catalog(category,name))")
    .is("unavailable_at", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(n * 10);
  if (error) throw error;
  const data = rows.filter((r) => !(r.ai_analyses || []).length).slice(0, n);
  const out = data.map(({ content_idea_tags: t, ai_analyses: _a, title, ...p }) => {
    const tags = {};
    for (const { idea_catalog: v } of t || []) if (v) (tags[v.category] ||= []).push(v.name);
    return { ...p, caption: title, tags };
  });
  console.log(JSON.stringify(out, null, 2));
} else if (cmd === "cover") {
  // Photos and carousels: the image Instagram's embed page shows (first slide for carousels)
  const { data: post, error } = await db.from("content_ideas").select("url").eq("id", a).single();
  if (error) throw error;
  const { image } = await igEmbed(post.url);
  if (!image) { console.error("No image found (removed post, not Instagram, or a video without a cover)."); process.exit(1); }
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "media", String(a));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "cover.jpg");
  fs.writeFileSync(file, Buffer.from(await (await fetch(image)).arrayBuffer()));
  console.log(file);
} else if (cmd === "save") {
  const analysis = JSON.parse(fs.readFileSync(b, "utf8"));
  const missing = ["summary", "whyItWorks", "hook", "format", "angle", "basis"].filter((k) => analysis[k] == null);
  if (missing.length) { console.error(`Missing fields: ${missing.join(", ")}`); process.exit(1); }
  // Global analysis (prompt v1). "batch" = made by the scheduled task with the Claude Code subscription: no API cost.
  const { error } = await db.rpc("complete_generation", { p_post_id: Number(a), p_prompt_version: "v1", p_result: analysis, p_model: "claude (scheduled task)", p_input_tokens: null, p_output_tokens: null, p_cost_usd: 0, p_source: "batch" });
  if (error) throw error;
  console.log(`Saved analysis for ${a}.`);
} else {
  console.error("Usage: node library/analysis.mjs next [N] | cover <id> | save <id> <analysis.json>");
  process.exit(2);
}
