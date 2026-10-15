#!/usr/bin/env node
// Deep analysis helpers for the Content Library.
//
//   node library/analysis.mjs next [N]            → the N top outliers (last 7 days) without analysis, as JSON
//   node library/analysis.mjs save <id> <file>    → validate an analysis JSON and store it (+ labels) on the post
//
// Analysis format (adapted from instagram-research-tool's ReelEntry, MIT, Manthan Patel):
// {
//   "whyItWorks": "2–3 sentences: why this post outperformed",
//   "hook": { "text", "category", "template", "whyItWorks" },
//   "format": { "category", "type", "visualLayout", "pacing" },
//   "angle": { "topic", "angle" },
//   "visualBreakdown": [ { "t": 0, "shot": "", "onScreenText": "", "why": "" } ],
//   "scrollStoppers": [ { "t": 0, "moment": "", "why": "" } ],
//   "replicable": { "is": true, "howToAdapt": "how a club / brand can recreate it with its own assets" },
//   "topPick": true,
//   "sport": "football", "competition": "LaLiga", "entities": ["FC Barcelona"], "entityTypes": ["players", "staff"],
//   "topics": ["behind-the-scenes", "kit"],
//   "moment": "matchday|signing|kit|sponsor|behind_the_scenes|fans|milestone|community|ticketing|training|humour|other",
//   "style": "talking_head|pov|meme|graphic|montage|interview|challenge|vlog|live_action|other",
//   "language": "es",
//   "basis": "video" | "thumbnail"      // what the analysis is based on
// }
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";

loadEnv();
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const [cmd, a, b] = process.argv.slice(2);

if (cmd === "next") {
  const n = Number(a) || 10;
  const { data, error } = await db
    .from("posts")
    .select("id,url,platform,account_handle,format,caption,thumbnail_url,views,likes,comments,outlier_score,outlier_metric,posted_at")
    .is("analysis", null)
    .eq("suspicious", false)
    .gte("posted_at", new Date(Date.now() - 7 * 864e5).toISOString())
    .gte("outlier_score", 2)
    .order("outlier_score", { ascending: false })
    .limit(n);
  if (error) throw error;
  console.log(JSON.stringify(data, null, 2));
} else if (cmd === "save") {
  const analysis = JSON.parse(fs.readFileSync(b, "utf8"));
  const missing = ["whyItWorks", "hook", "format", "angle", "basis"].filter((k) => analysis[k] == null);
  if (missing.length) { console.error(`Missing fields: ${missing.join(", ")}`); process.exit(1); }
  const { data: post, error: e1 } = await db.from("posts").select("labels").eq("id", a).single();
  if (e1) throw e1;
  const labels = new Set(post.labels || []);
  analysis.topPick ? labels.add("top_pick") : labels.delete("top_pick");
  analysis.replicable?.is ? labels.add("replicable") : labels.delete("replicable");
  const { error } = await db.from("posts").update({
    analysis,
    analyzed_at: new Date().toISOString(),
    labels: [...labels],
    ...(analysis.sport && { sport: analysis.sport }),
    ...(analysis.competition && { competition: analysis.competition }),
    ...(analysis.entities && { entities: analysis.entities }),
    ...(analysis.entityTypes && { entity_types: analysis.entityTypes }),
    ...(analysis.topics && { topics: analysis.topics }),
    ...(analysis.moment && { moment: analysis.moment }),
    ...(analysis.style && { style: analysis.style }),
    ...(analysis.language && { language: analysis.language }),
  }).eq("id", a);
  if (error) throw error;
  console.log(`Saved analysis for ${a} (labels: ${[...labels].join(", ") || "none"}).`);
} else {
  console.error("Usage: node library/analysis.mjs next [N] | save <id> <analysis.json>");
  process.exit(2);
}
