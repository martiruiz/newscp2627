// Views, likes, comments and shares of a post, read from the platform's public pages (Edge Functions "views" and
// "views-cron"; pipeline/library/views.mjs does the same in Node).
//   TikTok: the video page's stats · YouTube: its player API (views) and "next" API (likes, comments)
//   Instagram: the public embed page (likes and comments of every post; views of videos)
export type Engagement = { views?: number; likes?: number; comments?: number; shares?: number; removed?: boolean; throttled?: boolean };
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const IFRAME = { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9", "Sec-Fetch-Dest": "iframe", "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Site": "cross-site" };
const get = async (url: string, headers: Record<string, string> = { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" }) => {
  const r = await fetch(url, { headers }).catch(() => null);
  return { status: r?.status || 0, html: r?.ok ? await r.text() : "" };
};
const num = (v: unknown) => { const n = Number(String(v ?? "").replace(/[^\d]/g, "")); return n > 0 ? n : undefined; };
// "2.4M" / "176" / "1,642" → number
const compact = (t?: string) => { if (!t) return undefined; const m = /([\d.,]+)\s*([KMB])?/i.exec(t); if (!m) return undefined;
  const n = Number(m[1].replace(/,/g, "")) * ({ K: 1e3, M: 1e6, B: 1e9 } as Record<string, number>)[(m[2] || "").toUpperCase()] || Number(m[1].replace(/,/g, ""));
  return n > 0 ? Math.round(n) : undefined; };

export async function engagementOf(url: string): Promise<Engagement | null> {
  let m;
  if (/tiktok\.com\//.test(url)) {
    const { status, html } = await get(url);
    if (status === 429) return { throttled: true };
    if (/"statusCode":10204\b/.test(html)) return { removed: true };
    const s = /"stats":\{([^}]*)\}/.exec(html)?.[1] || "";
    const f = (k: string) => num(new RegExp(`"${k}":"?(\\d+)`).exec(s)?.[1]);
    const e = { views: f("playCount"), likes: f("diggCount"), comments: f("commentCount"), shares: f("shareCount") };
    return e.views || e.likes ? e : null;
  }
  if ((m = /(?:shorts\/|v=|youtu\.be\/)([\w-]{11})/.exec(url))) {
    const body = JSON.stringify({ videoId: m[1], context: { client: { clientName: "WEB", clientVersion: "2.20241010.00.00", hl: "en", gl: "US" } } });
    const api = (ep: string) => fetch(`https://www.youtube.com/youtubei/v1/${ep}?prettyPrint=false`, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": UA }, body }).then((r) => (r.ok ? r.text() : "")).catch(() => "");
    const [pt, next] = await Promise.all([api("player"), api("next")]);
    const player = JSON.parse(pt || "{}");
    if (/ERROR/.test(player?.playabilityStatus?.status || "") && !player?.videoDetails) return { removed: true };
    const e = {
      views: num(player?.videoDetails?.viewCount) || num(/"videoViewCountRenderer":\{"viewCount":\{"simpleText":"([\d,.\s]+)/.exec(next)?.[1]),
      likes: num(/like this video along with ([\d,]+) other/.exec(next)?.[1]),
      comments: compact(/"commentsEntryPointHeaderRenderer".{0,1500}?"contextualInfo":\{"runs":\[\{"text":"([^"]+)"/s.exec(next)?.[1] || /"contextualInfo":\{"runs":\[\{"text":"([^"]+)"/.exec(next)?.[1]),
    };
    return e.views || e.likes ? e : null;
  }
  if ((m = /instagram\.com\/(?:[\w.]+\/)?(p|reel|tv)\/([\w-]+)/.exec(url))) {
    const { status, html } = await get(`https://www.instagram.com/${m[1]}/${m[2]}/embed/captioned/`, IFRAME);
    if (status === 429) return { throttled: true };
    if (html.includes("may be broken")) return { removed: true };
    const field = (re: string) => num(new RegExp(re).exec(html)?.[1]);
    const e = {
      views: field(`\\\\*"video_view_count\\\\*"\\s*:\\s*(\\d+)`) || field(`\\\\*"video_play_count\\\\*"\\s*:\\s*(\\d+)`),
      likes: field(`edge_liked_by\\\\*"\\s*:\\s*\\{\\\\*"count\\\\*"\\s*:\\s*(\\d+)`) || field(`edge_media_preview_like\\\\*"\\s*:\\s*\\{\\\\*"count\\\\*"\\s*:\\s*(\\d+)`),
      comments: field(`edge_media_to_comment\\\\*"\\s*:\\s*\\{\\\\*"count\\\\*"\\s*:\\s*(\\d+)`) || field(`edge_media_to_parent_comment\\\\*"\\s*:\\s*\\{\\\\*"count\\\\*"\\s*:\\s*(\\d+)`),
    };
    return e.views || e.likes ? e : null;
  }
  return null;
}
// the columns to save (only what was read)
export const engagementRow = (e: Engagement) => Object.fromEntries(Object.entries({ views: e.views, likes: e.likes, comments: e.comments, shares: e.shares }).filter(([, v]) => v));
