// Supabase Edge Function "followers-cron": every hour (pg_cron, supabase/creator-profiles.sql) reads the followers of
// ~10 content creators that are due (followers_due: not read in the last 7 days) from their public profile page and saves them.
//   Instagram: the page's preview text ("694K Followers, 558 Following…", rounded) · TikTok: "followerCount" in the page.
// Header x-cron-secret = the vault secret cron_secret (checked with the RPC cron_secret_ok). Slow on purpose (pauses
// between profiles) so no platform blocks it; stops after ~110 s.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

const env = (k: string) => Deno.env.get(k) ?? "";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const service = { apikey: env("SUPABASE_SERVICE_ROLE_KEY"), Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" };
const rest = (path: string, init: RequestInit = {}) => fetch(`${env("SUPABASE_URL")}/rest/v1/${path}`, { ...init, headers: { ...service, ...(init.headers || {}) } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

// "694K" → 694000 · "1.2M" → 1200000 · "12,345" → 12345
export const count = (s: string) => {
  const m = /^([\d.,]+)\s*([KMB])?$/i.exec(s.trim());
  if (!m) return null;
  const k = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] || "").toUpperCase() as "K" | "M" | "B"];
  return Math.round(k ? Number(m[1].replace(/,/g, "")) * k : Number(m[1].replace(/[.,]/g, "")));
};

type Read = { followers?: number | null; throttled?: boolean; gone?: boolean };
async function followersOf(platform: string, handle: string): Promise<Read> {
  if (platform === "instagram") {
    // the preview a link shows (what a chat app or a social network reads): no login needed
    const r = await fetch(`https://www.instagram.com/${encodeURIComponent(handle)}/`, { headers: { "User-Agent": "facebookexternalhit/1.1", "Accept-Language": "en-US,en;q=0.9" }, redirect: "follow" });
    if (r.status === 429) return { throttled: true };
    if (r.status === 404) return { gone: true };
    const html = await r.text();
    const m = /content="([\d.,]+[KMB]?) Followers/i.exec(html);
    return { followers: m ? count(m[1]) : null };
  }
  const r = await fetch(`https://www.tiktok.com/@${encodeURIComponent(handle)}`, { headers: { "User-Agent": BROWSER, "Accept-Language": "en-US,en;q=0.9" } });
  if (r.status === 429) return { throttled: true };
  const m = /"followerCount":(\d+)/.exec(await r.text());
  return { followers: m ? Number(m[1]) : null };
}

Deno.serve(async (req) => {
  const ok = await (await rest("rpc/cron_secret_ok", { method: "POST", body: JSON.stringify({ p_secret: req.headers.get("x-cron-secret") || "" }) })).json().catch(() => false);
  if (ok !== true) return json({ error: "Not allowed" }, 403);
  const t0 = Date.now();
  const due = await (await rest("rpc/followers_due", { method: "POST", body: JSON.stringify({ p_limit: 10 }) })).json();
  let done = 0, none = 0;
  const paused = new Set<string>(), read: Record<string, number | null> = {};
  for (const p of Array.isArray(due) ? due : []) {
    if (Date.now() - t0 > 110000) break;
    if (paused.has(p.platform)) continue;
    const v = await followersOf(p.platform, p.handle).catch(() => ({} as Read));
    if (v.throttled) { paused.add(p.platform); continue; }
    const now = new Date().toISOString();
    read[`${p.platform}:${p.handle}`] = v.followers ?? null;
    if (v.followers) { done++; await rest(`scraped_profiles?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify({ followers: v.followers, followers_at: now, followers_source: "profile" }) }); }
    else { none++; await rest(`scraped_profiles?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify({ followers_at: now }) }); }   // tried: again next week
    await sleep(4000);
  }
  return json({ due: Array.isArray(due) ? due.length : 0, done, not_read: none, paused: [...paused], read, ms: Date.now() - t0 });
});
