#!/usr/bin/env node
// Views of TikTok and YouTube posts, read from the platform (same rules as the Edge Function "views"): TikTok's video
// page ("playCount"), YouTube's player API / "next" API / watch page. Writes content_ideas.views and views_at.
//
//   cd pipeline && node library/views.mjs --platform tiktok|youtube [--limit 200] [--all]
//   by default only posts without views; --all also the ones that have them (oldest reading first)
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in pipeline/.env and supabase/views-refresh.sql.
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";

loadEnv();
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const argv = process.argv.slice(2);
const arg = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const PF = arg("--platform"), LIMIT = Number(arg("--limit") || 1e9), ALL = argv.includes("--all");
if (!["tiktok", "youtube"].includes(PF)) { console.error("--platform tiktok|youtube"); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const page = async (url, extra = {}) => {
  const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", ...extra } }).catch(() => null);
  return { status: r?.status || 0, html: r?.ok ? await r.text() : "" };
};

// → { views } | { removed: true } | null
export async function viewsOf(url) {
  let m;
  if (/tiktok\.com\//.test(url)) {
    const { status, html } = await page(url);
    if (status === 429) return { throttled: true };
    if (/"statusCode":10204\b/.test(html)) return { removed: true };
    const n = Number(/"stats":\{[^}]*?"playCount":(\d+)/.exec(html)?.[1] || /"statsV2":\{[^}]*?"playCount":"(\d+)"/.exec(html)?.[1]);
    return n ? { views: n } : null;
  }
  if ((m = /(?:shorts\/|v=|youtu\.be\/)([\w-]{11})/.exec(url))) {
    const body = JSON.stringify({ videoId: m[1], context: { client: { clientName: "WEB", clientVersion: "2.20241010.00.00", hl: "en", gl: "US" } } });
    const api = (ep) => fetch(`https://www.youtube.com/youtubei/v1/${ep}?prettyPrint=false`, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": UA }, body }).then((r) => (r.ok ? r.text() : "")).catch(() => "");
    const player = JSON.parse((await api("player")) || "{}");
    if (/ERROR|UNPLAYABLE/.test(player?.playabilityStatus?.status || "") && !player?.videoDetails) return { removed: true };
    let n = Number(player?.videoDetails?.viewCount);
    if (!n) n = Number((/"videoViewCountRenderer":\{"viewCount":\{"simpleText":"([\d,.\s]+)/.exec(await api("next"))?.[1] || "").replace(/\D/g, ""));
    return n ? { views: n } : null;
  }
  return null;
}

const t0 = Date.now();
let done = 0, none = 0, removed = 0, throttled = 0, lastId = 0;
while (done + none + removed < LIMIT) {
  let q = db.from("content_ideas").select("id,url").eq("account_platform", PF).is("unavailable_at", null).gt("id", lastId).order("id").limit(200);
  if (!ALL) q = q.is("views", null);
  const { data: rows, error } = await q;
  if (error) throw error;
  if (!rows?.length) break;
  lastId = rows[rows.length - 1].id;
  for (const r of rows) {
    if (done + none + removed >= LIMIT) break;
    const v = await viewsOf(r.url);
    if (v?.throttled) { throttled++; console.log("  throttled: waiting 60 s"); await sleep(60000); continue; }
    if (v?.removed) { removed++; await db.from("content_ideas").update({ unavailable_at: new Date().toISOString() }).eq("id", r.id); }
    else if (v?.views) { done++; await db.from("content_ideas").update({ views: v.views, views_at: new Date().toISOString() }).eq("id", r.id); }
    else none++;
    await sleep(PF === "tiktok" ? 900 : 250);
  }
  console.log(`${PF}: ${done} views · ${none} not read · ${removed} removed · ${Math.round((Date.now() - t0) / 1000)} s`);
}
const secs = (Date.now() - t0) / 1000, n = done + none + removed;
console.log(`Done: ${done} views, ${none} not read, ${removed} removed, ${throttled} pauses · ${n ? (secs / n).toFixed(2) : 0} s per post`);
