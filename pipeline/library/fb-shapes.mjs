#!/usr/bin/env node
// Shape of the Facebook posts (vertical / horizontal…) from their stored cover → apply_media_shape (supabase/media-shape.sql):
// width, height, ratio and the "Shape" filter value. Only posts with a cover and no shape yet.
//   cd pipeline && node library/fb-shapes.mjs [--limit 500]
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";
import { imageSize } from "./image-size.mjs";

loadEnv();
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const LIMIT = Number(process.argv.includes("--limit") ? process.argv[process.argv.indexOf("--limit") + 1] : 1e9);
const { data: top } = await db.from("content_ideas").select("id").order("id", { ascending: false }).limit(1);
const MAX = top?.[0]?.id || 0, STEP = 20000;   // id windows (by primary key): a filter over the whole table times out
let done = 0, failed = 0;
for (let from = 0; from <= MAX && done + failed < LIMIT; from += STEP) {
  const { data: rows, error } = await db.from("content_ideas").select("id,cover_url").gte("id", from).lt("id", from + STEP).eq("account_platform", "facebook").not("cover_url", "is", null).is("media_ratio", null).limit(2000);
  if (error) throw error;
  if (!rows?.length) continue;
  for (let k = 0; k < rows.length; k += 20) await batch(rows.slice(k, k + 20));   // 20 at a time: more makes some downloads fail
}
console.log(`Done: ${done} Facebook posts with their shape, ${failed} unreadable.`);
async function batch(rows) {
  const out = [];
  await Promise.all(rows.map(async (r) => {
    const res = await fetch(r.cover_url).catch(() => null);
    const size = res?.ok ? imageSize(new Uint8Array(await res.arrayBuffer())) : null;
    if (size) out.push({ id: r.id, ...size }); else failed++;
  }));
  if (out.length) { const { error: e } = await db.rpc("apply_media_shape", { p_rows: out }); if (e) throw e; done += out.length; }
  console.log(`${done} shapes · ${failed} unreadable`);
}
