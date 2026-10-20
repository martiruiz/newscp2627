// Supabase Edge Function "views": the current views of a YouTube or TikTok post, read from its public page when a
// member plays the video in the Content Library (js/library.js). POST { id } → { views }. Any signed-in member;
// each post is read from the platform at most every 6 hours (content_ideas.views_at, supabase/views-refresh.sql).
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
const env = (k: string) => Deno.env.get(k) ?? "";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const service = { apikey: env("SUPABASE_SERVICE_ROLE_KEY"), Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" };
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const FRESH_MS = 6 * 3600 * 1000;

async function signedIn(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const r = await fetch(`${env("SUPABASE_URL")}/auth/v1/user`, { headers: { apikey: env("SUPABASE_ANON_KEY"), Authorization: `Bearer ${token}` } });
  return r.ok && !!(await r.json())?.id;
}
const page = async (url: string) => {
  const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" } }).catch(() => null);
  return r?.ok ? await r.text() : "";
};
async function viewsOf(url: string): Promise<number | null> {
  let m;
  if (/tiktok\.com\//.test(url)) {
    const html = await page(url);
    return Number(/"stats":\{[^}]*?"playCount":(\d+)/.exec(html)?.[1] || /"statsV2":\{[^}]*?"playCount":"(\d+)"/.exec(html)?.[1]) || null;
  }
  if ((m = /(?:shorts\/|v=|youtu\.be\/)([\w-]{11})/.exec(url))) {
    // YouTube's own player API (the watch page shows a cookie-consent page to servers in Europe)
    const r = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": UA },
      body: JSON.stringify({ videoId: m[1], context: { client: { clientName: "WEB", clientVersion: "2.20241010.00.00", hl: "en", gl: "US" } } }) }).catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    if (Number(j?.videoDetails?.viewCount)) return Number(j.videoDetails.viewCount);
    const html = await page(`https://www.youtube.com/watch?v=${m[1]}`);
    return Number(/"videoDetails":\{.*?"viewCount":"(\d+)"/s.exec(html)?.[1]) || null;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!(await signedIn(req))) return json({ error: "Sign in" }, 401);
  const { id } = await req.json().catch(() => ({}));
  if (!Number(id)) return json({ error: "id" }, 400);
  const rows = await (await fetch(`${env("SUPABASE_URL")}/rest/v1/content_ideas?select=id,url,views,views_at&id=eq.${Number(id)}`, { headers: service })).json();
  const p = rows?.[0];
  if (!p || !/tiktok\.com|youtu/.test(p.url || "")) return json({ views: p?.views ?? null });
  if (p.views_at && Date.now() - new Date(p.views_at).getTime() < FRESH_MS) return json({ views: p.views, fresh: true });
  const views = await viewsOf(p.url);
  if (views == null) return json({ views: p.views });
  await fetch(`${env("SUPABASE_URL")}/rest/v1/content_ideas?id=eq.${p.id}`, { method: "PATCH", headers: service, body: JSON.stringify({ views, views_at: new Date().toISOString() }) });
  return json({ views, updated: true });
});
