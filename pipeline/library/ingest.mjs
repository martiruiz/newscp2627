#!/usr/bin/env node
// Load posts into the Content Library (Supabase table "posts") and recompute outlier scores.
//
//   node library/ingest.mjs <file.json|folder> [...] [--source brightdata] [--dry-run]
//
// Accepted input (each file: an array of items, or { "posts": [...] }):
//   - Normalized posts (the SCP format, see library/README.md)
//   - Metricool competitor rows (from library/metricool.mjs)
//   - Bright Data exports: add their field mapping in adapters.mjs once we have a sample
//
// Env (pipeline/.env or the shell): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Post ids and the id-from-URL rules are adapted from instagram-research-tool (MIT, Manthan Patel).
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { toPost } from "./adapters.mjs";
import { loadEnv } from "./env.mjs";

loadEnv();
const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const sourceFlag = args.includes("--source") ? args[args.indexOf("--source") + 1] : null;
const inputs = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--source");
if (!inputs.length) {
  console.error("Usage: node library/ingest.mjs <file.json|folder> [...] [--source name] [--dry-run]");
  process.exit(2);
}

const files = inputs.flatMap((p) =>
  fs.statSync(p).isDirectory()
    ? fs.readdirSync(p).filter((f) => f.endsWith(".json")).map((f) => path.join(p, f))
    : [p]
);

const posts = new Map();
let skipped = 0;
for (const file of files) {
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const items = Array.isArray(raw) ? raw : raw.posts ?? raw.data ?? raw.items ?? [];
  for (const item of items) {
    const post = toPost(item, sourceFlag);
    if (!post) { skipped++; continue; }
    posts.set(post.id, { ...posts.get(post.id), ...post }); // same post twice → merged, latest wins
  }
}
console.log(`${files.length} file(s): ${posts.size} posts, ${skipped} items skipped (no recognisable URL).`);

if (DRY) {
  for (const p of [...posts.values()].slice(0, 5)) console.log(JSON.stringify(p));
  process.exit(0);
}

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Accounts first (posts reference them by handle)
const accounts = new Map();
for (const p of posts.values()) accounts.set(`${p.platform}:${p.account_handle}`, { platform: p.platform, handle: p.account_handle });
await upsert("accounts", [...accounts.values()], "platform,handle", true);

// Posts in batches. Classification and analysis columns are never overwritten by a metrics refresh.
await upsert("posts", [...posts.values()], "id");

const oldest = [...posts.values()].map((p) => p.posted_at).filter(Boolean).sort()[0];
const { data: scored, error } = await db.rpc("refresh_outliers", oldest ? { since: oldest } : {});
if (error) throw error;
console.log(`Outlier scores refreshed for ${scored} posts.`);

async function upsert(table, rows, onConflict, ignoreDuplicates = false) {
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + BATCH), { onConflict, ignoreDuplicates });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`  ${table}: ${rows.length} upserted`);
}
