// Supabase Edge Function "views-cron": every 10 minutes (pg_cron, supabase/views-cron.sql) reads the views of the posts
// that are due (views_due: last 7 days daily, 8–30 days weekly, 31–90 days monthly) and saves them.
// TikTok: the video page · YouTube: its player / "next" API · Instagram videos: the public embed page.
// Header x-cron-secret = CRON_SECRET. Slow on purpose (pauses between posts) so no platform blocks it; stops after ~110 s.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
const env = (k: string) => Deno.env.get(k) ?? "";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const service = { apikey: env("SUPABASE_SERVICE_ROLE_KEY"), Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" };
const rest = (path: string, init: RequestInit = {}) => fetch(`${env("SUPABASE_URL")}/rest/v1/${path}`, { ...init, headers: { ...service, ...(init.headers || {}) } });
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const IFRAME = { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9", "Sec-Fetch-Dest": "iframe", "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Site": "cross-site" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const get = async (url: string, headers: Record<string, string> = { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" }) => {
  const r = await fetch(url, { headers }).catch(() => null);
  return { status: r?.status || 0, html: r?.ok ? await r.text() : "" };
};

type Reading = { views?: number; removed?: boolean; throttled?: boolean } | null;
async function viewsOf(url: string): Promise<Reading> {
  let m;
  if (/tiktok\.com\//.test(url)) {
    const { status, html } = await get(url);
    if (status === 429) return { throttled: true };
    if (/"statusCode":10204\b/.test(html)) return { removed: true };
    const n = Number(/"stats":\{[^}]*?"playCount":(\d+)/.exec(html)?.[1] || /"statsV2":\{[^}]*?"playCount":"(\d+)"/.exec(html)?.[1]);
    return n ? { views: n } : null;
  }
  if ((m = /(?:shorts\/|v=|youtu\.be\/)([\w-]{11})/.exec(url))) {
    const body = JSON.stringify({ videoId: m[1], context: { client: { clientName: "WEB", clientVersion: "2.20241010.00.00", hl: "en", gl: "US" } } });
    const api = (ep: string) => fetch(`https://www.youtube.com/youtubei/v1/${ep}?prettyPrint=false`, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": UA }, body }).then((r) => (r.ok ? r.text() : "")).catch(() => "");
    const player = JSON.parse((await api("player")) || "{}");
    if (/ERROR/.test(player?.playabilityStatus?.status || "") && !player?.videoDetails) return { removed: true };
    let n = Number(player?.videoDetails?.viewCount);
    if (!n) n = Number((/"videoViewCountRenderer":\{"viewCount":\{"simpleText":"([\d,.\s]+)/.exec(await api("next"))?.[1] || "").replace(/\D/g, ""));
    return n ? { views: n } : null;
  }
  if ((m = /instagram\.com\/(?:[\w.]+\/)?(p|reel|tv)\/([\w-]+)/.exec(url))) {
    const { status, html } = await get(`https://www.instagram.com/${m[1]}/${m[2]}/embed/captioned/`, IFRAME);
    if (status === 429) return { throttled: true };
    if (html.includes("may be broken")) return { removed: true };
    const field = (name: string) => Number(new RegExp(`\\\\*"${name}\\\\*"\\s*:\\s*(\\d+)`).exec(html)?.[1]);
    const n = field("video_view_count") || field("video_play_count");
    return n ? { views: n } : null;
  }
  return null;
}

Deno.serve(async (req) => {
  if (!env("CRON_SECRET") || req.headers.get("x-cron-secret") !== env("CRON_SECRET")) return json({ error: "Not allowed" }, 403);
  const t0 = Date.now();
  const due = await (await rest("rpc/views_due", { method: "POST", body: JSON.stringify({ p_limit: 40 }) })).json();
  let done = 0, none = 0, removed = 0;
  const paused = new Set<string>();   // a platform that answered "too many requests" waits for the next run
  for (const p of Array.isArray(due) ? due : []) {
    if (Date.now() - t0 > 110000) break;
    const pf = /tiktok/.test(p.url) ? "tiktok" : /instagram/.test(p.url) ? "instagram" : "youtube";
    if (paused.has(pf)) continue;
    const v = await viewsOf(p.url).catch(() => null);
    const now = new Date().toISOString();
    if (v?.throttled) { paused.add(pf); continue; }
    if (v?.removed) { removed++; await rest(`content_ideas?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify({ unavailable_at: now }) }); }
    else if (v?.views) { done++; await rest(`content_ideas?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify({ views: v.views, views_at: now }) }); }
    else { none++; await rest(`content_ideas?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify({ views_at: now }) }); }   // try again at its next turn
    await sleep(pf === "youtube" ? 300 : 1500);
  }
  return json({ due: Array.isArray(due) ? due.length : 0, done, not_read: none, removed, paused: [...paused], ms: Date.now() - t0 });
});
