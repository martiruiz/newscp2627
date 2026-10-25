#!/usr/bin/env node
// Fills content_ideas.url from the embed code in batches (supabase/post-urls.sql → backfill_post_urls).
//   cd pipeline && node library/backfill-urls.mjs
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";
loadEnv();
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let total = 0, size = 20000;
for (;;) {
  const t = Date.now();
  const { data, error } = await db.rpc("backfill_post_urls", { p_limit: size });
  if (error) {
    if (/timeout/i.test(error.message) && size > 2000) { size = Math.floor(size / 2); console.log(`timeout → batch of ${size}`); continue; }
    throw error;
  }
  total += data;
  console.log(`+${data} links (${total} total) · ${Date.now() - t} ms`);
  if (!data) break;
}
console.log(`Done: ${total} posts now have their link.`);
