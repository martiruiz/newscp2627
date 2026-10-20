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
let done = 0, failed = 0, lastId = 0;
while (done + failed < LIMIT) {
  const { data: rows, error } = await db.from("content_ideas").select("id,cover_url").eq("account_platform", "facebook").not("cover_url", "is", null).is("media_ratio", null).gt("id", lastId).order("id").limit(100);
  if (error) throw error;
  if (!rows?.length) break;
  lastId = rows[rows.length - 1].id;
  const out = [];
  await Promise.all(rows.map(async (r) => {
    const res = await fetch(r.cover_url).catch(() => null);
    const size = res?.ok ? imageSize(new Uint8Array(await res.arrayBuffer())) : null;
    if (size) out.push({ id: r.id, ...size }); else failed++;
  }));
  if (out.length) { const { error: e } = await db.rpc("apply_media_shape", { p_rows: out }); if (e) throw e; done += out.length; }
  console.log(`${done} shapes · ${failed} unreadable`);
}
console.log(`Done: ${done} Facebook posts with their shape, ${failed} unreadable.`);
