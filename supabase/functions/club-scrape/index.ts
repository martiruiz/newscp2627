// Supabase Edge Function "club-scrape": Admin → My Club → "Scrape now" for a player's or sponsor's Instagram that isn't
// scraped yet. Bright Data (Web Scraper API, Instagram posts, discover by profile URL) collects its latest posts; they come
// back as the same rows as the daily scraping CSV, and the admin imports them the same way (only in that club's My Club).
// Superadmins only. Two steps, because Bright Data collects in the background (usually 1–3 minutes):
//   POST { action: "start", platform: "instagram" | "tiktok", handle, num }   → { snapshot_id }
//   POST { action: "cancel", snapshot_id }  → { cancelled: true }
//   POST { action: "status", platform, snapshot_id, handle }  → { status: "running" } | { status: "ready", rows, fields } | { status: "failed", error }
// Secret (Supabase → Edge Functions → Secrets): BRIGHTDATA_API_KEY. SUPABASE_URL, SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
const env = (k: string) => Deno.env.get(k) ?? "";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const BD = "https://api.brightdata.com/datasets/v3";
const IG_POSTS = "gd_lk5ns7kz21pck8jpis";   // Bright Data: Instagram posts (discover by profile URL)
const TT_POSTS = "gd_lu702nij2f790tmv9h";   // Bright Data: TikTok posts (discover by profile URL)
const bd = (path: string, init: RequestInit = {}) =>
  fetch(`${BD}${path}`, { ...init, headers: { Authorization: `Bearer ${env("BRIGHTDATA_API_KEY")}`, "Content-Type": "application/json", ...(init.headers || {}) } });

async function superadmin(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const u = await fetch(`${env("SUPABASE_URL")}/auth/v1/user`, { headers: { apikey: env("SUPABASE_ANON_KEY"), Authorization: `Bearer ${token}` } });
  const user = u.ok ? await u.json() : null;
  if (!user?.id) return false;
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const r = await fetch(`${env("SUPABASE_URL")}/rest/v1/profiles?select=role&id=eq.${user.id}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  return r.ok && (await r.json())[0]?.role === "superadmin";
}

// Instagram's shortcode carries the exact time ((media id >> 23) + Instagram's epoch); Bright Data gives the day only
const IG_ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
function igTime(code: string) {
  try { let n = 0n; for (const c of code.slice(0, 11)) n = n * 64n + BigInt(IG_ABC.indexOf(c)); const ms = Number(n >> 23n) + 1314220021721; return ms > 1.3e12 && ms < Date.now() + 864e5 ? new Date(ms).toISOString() : null; } catch { return null; }
}
const isoOf = (v: unknown) => { const t = typeof v === "number" ? (v < 1e12 ? v * 1000 : v) : Date.parse(String(v ?? "")); return Number.isFinite(t) ? new Date(t).toISOString() : null; };

// one Bright Data post → one row of the import (same columns as the daily scraping CSV)
type Rec = Record<string, any>;
const first = (o: Rec, ...ks: string[]) => { for (const k of ks) if (o?.[k] != null && o[k] !== "") return o[k]; return null; };
// a count Bright Data gives (views, likes…), or null when it hasn't got it
const count = (o: Rec, ...ks: string[]) => { const v = Number(first(o, ...ks)); return Number.isFinite(v) && v >= 0 ? Math.round(v) : null; };
function toRow(p: Rec, handle: string) {
  const url = String(first(p, "url", "post_url", "permalink") || "");
  const code = String(first(p, "shortcode") || /instagram\.com\/(?:[\w.]+\/)?(?:p|reels?|tv)\/([\w-]+)/.exec(url)?.[1] || "");
  if (!code) return null;
  const type = String(first(p, "content_type", "product_type", "media_type") || "").toLowerCase();
  const tags = first(p, "post_hashtags", "hashtags");
  return {
    external_id: code,
    url: `https://www.instagram.com/${/reel|clips|video/.test(type) || /\/reels?\//.test(url) ? "reel" : "p"}/${code}/`,
    embed: `<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/p/${code}" data-instgrm-captioned></blockquote>`,
    title: String(first(p, "description", "caption", "text") || "").trim(),
    published_at: igTime(code) || isoOf(first(p, "date_posted", "datetime", "timestamp", "taken_at")),
    media_id: first(p, "post_id", "pk", "media_id"),
    account: String(first(p, "user_posted", "owner_username", "username") || handle).replace(/^@/, "").toLowerCase(),
    cover: first(p, "thumbnail", "image_url", "display_url"),
    hashtags: Array.isArray(tags) ? tags.join(",") : tags || "",
    followers: first(p, "followers", "account_followers"),
    profile_name: first(p, "profile_name", "full_name"),
    verified: first(p, "is_verified", "verified"),
    profile_image: first(p, "profile_image_link", "profile_pic_url"),
    format: /carousel|sidecar/.test(type) ? "Carousel" : /reel|clips|video/.test(type) ? "Reel" : type ? "Images" : "",
    platform: "Instagram",
    // its numbers as Bright Data read them (Instagram shows no views for photos and carousels)
    views: count(p, "video_play_count", "video_view_count", "views") || null,   // 0 for a photo or carousel: no views likes: count(p, "likes", "like_count"), comments: count(p, "num_comments", "comments_count"), shares: null,
  };
}

// the account's profile picture, copied to Storage (bucket "logos", folder people/): the platforms' links expire in days
async function storeAvatar(platform: string, handle: string, src: string | null) {
  if (!src || !/^https:\/\//.test(src)) return null;
  const r = await fetch(src, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36" } }).catch(() => null);
  if (!r?.ok) return null;
  const type = (r.headers.get("content-type") || "image/jpeg").split(";")[0];
  const ext = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as Record<string, string>)[type];
  if (!ext) return null;
  const path = `people/${platform}-${handle.replace(/[^\w.-]/g, "")}.${ext}`;
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const up = await fetch(`${env("SUPABASE_URL")}/storage/v1/object/logos/${path}`, { method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": type, "x-upsert": "true", "Cache-Control": "max-age=604800" }, body: new Uint8Array(await r.arrayBuffer()) });
  return up.ok ? `${env("SUPABASE_URL")}/storage/v1/object/public/logos/${path}?v=${Date.now()}` : null;
}

// one Bright Data TikTok post → one row of the import (its id carries the exact time: id >> 32 = seconds)
function tiktokRow(p: Rec, handle: string) {
  const id = String(first(p, "post_id", "id") || /video\/(\d+)/.exec(String(first(p, "url") || ""))?.[1] || "");
  if (!/^\d{10,}$/.test(id)) return null;
  // the @ from the post's link, else the account asked for: Bright Data's "profile_username" can be the display name
  // ("Lamine Yamal"), which made a broken link and a post that didn't match the account
  const fromUrl = /tiktok\.com\/@([\w.]+)\//.exec(String(first(p, "url") || ""))?.[1];
  const named = String(first(p, "profile_username", "author", "username") || "").replace(/^@/, "").toLowerCase();
  const user = (fromUrl || (/^[\w.]{1,30}$/.test(named) ? named : "") || handle).toLowerCase();
  const link = `https://www.tiktok.com/@${user}/video/${id}`;
  const tags = first(p, "hashtags");
  let at: string | null = null; try { at = new Date(Number(BigInt(id) >> 32n) * 1000).toISOString(); } catch { at = isoOf(first(p, "create_time")); }
  return {
    external_id: id, url: link,
    embed: `<blockquote class="tiktok-embed" cite="${link}" data-video-id="${id}"><section><a href="${link}"></a></section></blockquote><script async src="https://www.tiktok.com/embed.js"></script>`,
    title: String(first(p, "description", "text") || "").trim(), published_at: at, media_id: null, account: user,
    cover: first(p, "preview_image", "cover_image", "cover", "thumbnail", "origin_cover"),
    hashtags: Array.isArray(tags) ? tags.map((t: any) => (typeof t === "string" ? t : t?.name || "")).filter(Boolean).join(",") : tags || "",
    followers: first(p, "profile_followers", "followers"), profile_name: first(p, "profile_name", "nickname"), verified: first(p, "is_verified"),
    profile_image: first(p, "profile_avatar", "avatar"), format: "Video", platform: "TikTok",
    views: count(p, "play_count", "views"), likes: count(p, "digg_count", "likes"), comments: count(p, "comment_count", "comments"), shares: count(p, "share_count", "shares"),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!(await superadmin(req))) return json({ error: "Not allowed" }, 403);
  if (!env("BRIGHTDATA_API_KEY")) return json({ error: "Bright Data isn't connected: set the BRIGHTDATA_API_KEY secret in Supabase." }, 503);
  const b = await req.json().catch(() => ({}));

  if (b.action === "start") {
    const tt = b.platform === "tiktok";
    const handle = String(b.handle || "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?(instagram|tiktok)\.com\/@?/, "").replace(/\/.*$/, "").toLowerCase();
    if (!/^[\w.]{1,30}$/.test(handle)) return json({ error: `That isn't a${tt ? " TikTok" : "n Instagram"} account.` }, 400);
    const num = Math.min(Math.max(Number(b.num) || 10, 1), 50);
    const input = [{ url: tt ? `https://www.tiktok.com/@${handle}` : `https://www.instagram.com/${handle}/`, num_of_posts: num }];
    const q = tt ? `?dataset_id=${TT_POSTS}&type=discover_new&discover_by=profile_url&include_errors=true` : `?dataset_id=${IG_POSTS}&type=discover_new&discover_by=url&include_errors=true`;
    let r = await bd(`/trigger${q}`, { method: "POST", body: JSON.stringify({ input }) });
    if (r.status === 400) r = await bd(`/trigger${q}`, { method: "POST", body: JSON.stringify(input) });   // older shape: a bare list
    const d = await r.json().catch(() => ({}));
    return d?.snapshot_id ? json({ snapshot_id: d.snapshot_id, handle, num }) : json({ error: `Bright Data: ${d?.error || d?.message || r.status}` }, 502);
  }

  if (b.action === "status") {
    const id = String(b.snapshot_id || "");
    if (!/^[\w-]{6,}$/.test(id)) return json({ error: "Missing snapshot" }, 400);
    const pr = await bd(`/progress/${id}`).then((x) => x.json()).catch(() => ({}));
    const bdState = { status: pr?.status ?? null, records: pr?.records ?? null, errors: pr?.errors ?? null };   // Bright Data's own state, to see where it is
    if (pr?.status === "failed") return json({ status: "failed", error: pr?.error || "Bright Data couldn't collect this account.", bd: bdState });
    if (pr?.status === "canceled" || pr?.status === "cancelled") return json({ status: "failed", error: "This collection was cancelled at Bright Data. Press Scrape again.", bd: bdState });
    if (pr?.status !== "ready") return json({ status: "running", bd: bdState });
    const recs = await bd(`/snapshot/${id}?format=json`).then((x) => x.json()).catch(() => null);
    if (!Array.isArray(recs)) return json({ status: "failed", error: "Bright Data gave no posts." });
    // posts come one per record, or inside a profile record (posts: [...])
    const posts = recs.flatMap((x: Rec) => (Array.isArray(x?.posts) ? x.posts.map((p: Rec) => ({ ...x, ...p, posts: undefined })) : [x]));
    const errors = posts.filter((p: Rec) => p?.error).map((p: Rec) => String(p.error));
    const rows = posts.filter((p: Rec) => !p?.error).map((p: Rec) => (b.platform === "tiktok" ? tiktokRow : toRow)(p, String(b.handle || ""))).filter(Boolean);
    const pic = (rows.find((r: Rec) => r?.profile_image) as Rec | undefined)?.profile_image || null;
    const avatar = await storeAvatar(b.platform === "tiktok" ? "tiktok" : "instagram", String(b.handle || (rows[0] as Rec)?.account || ""), pic).catch(() => null);
    return json({ status: "ready", rows, errors, avatar, fields: Object.keys(posts[0] || {}).slice(0, 60) });
  }

  // diagnosis (superadmins): the latest collections of both datasets as Bright Data lists them, and the raw progress of one
  if (b.action === "diag") {
    const list = async (ds: string) => (await bd(`/snapshots?dataset_id=${ds}&limit=15`).then(async (x) => (x.ok ? x.json() : { http: x.status, body: (await x.text()).slice(0, 300) })).catch((e) => ({ error: String(e) })));
    const raw = b.snapshot_id ? await bd(`/progress/${String(b.snapshot_id)}`).then(async (x) => ({ http: x.status, body: (await x.text()).slice(0, 800) })).catch((e) => ({ error: String(e) })) : null;
    return json({ instagram: await list(IG_POSTS), tiktok: await list(TT_POSTS), progress: raw });
  }

  // stop a collection at Bright Data (one stuck "running"): 400 = it wasn't running any more, also fine
  if (b.action === "cancel") {
    const id = String(b.snapshot_id || "");
    if (!/^[\w-]{6,}$/.test(id)) return json({ error: "Missing snapshot" }, 400);
    const r = await bd(`/snapshot/${id}/cancel`, { method: "POST" });
    return r.ok || r.status === 400 || r.status === 404 ? json({ cancelled: true, was_running: r.ok }) : json({ error: `Bright Data: ${r.status}` }, 502);
  }

  return json({ error: "Unknown action" }, 400);
});
