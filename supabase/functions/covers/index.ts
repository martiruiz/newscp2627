// Supabase Edge Function "covers": loads the covers of some posts (Admin → Import, after an import, with a progress bar).
// POST { ids: [content idea ids] } (up to 12 per call; superadmins only) → for each post: the image from its platform
// (same rules as pipeline/library/covers.mjs), copied to Storage (bucket "covers", public) → content_ideas.cover_url.
// A post with no image available gets cover_at (tried) and no cover; a removed post gets unavailable_at.
// A post imported with its image link from the scraping (content_ideas.cover_source, supabase/import-cover-source.sql)
// takes that image first, without asking the platform; the platform's page is then only tried for Instagram's extra data
// (type, size, length, views), and only when that fails it's used for the cover too.
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
const env = (k: string) => Deno.env.get(k) ?? "";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const service = { apikey: env("SUPABASE_SERVICE_ROLE_KEY"), Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}` };
const rest = async (path: string, init: RequestInit = {}) => {
  const r = await fetch(`${env("SUPABASE_URL")}/rest/v1/${path}`, { ...init, headers: { ...service, "Content-Type": "application/json", ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`${path.split("?")[0]}: ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json().catch(() => null);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function superadmin(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const u = await fetch(`${env("SUPABASE_URL")}/auth/v1/user`, { headers: { apikey: env("SUPABASE_ANON_KEY"), Authorization: `Bearer ${token}` } });
  const user = u.ok ? await u.json() : null;
  if (!user?.id) return false;
  const [p] = await rest(`profiles?select=role&id=eq.${user.id}`);
  return p?.role === "superadmin";
}

// ---------- the image of one post ----------
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const IFRAME = { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9", "Sec-Fetch-Dest": "iframe", "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Site": "cross-site" };
const page = async (url: string, headers: Record<string, string> = IFRAME) => {
  const r = await fetch(url, { headers }).catch(() => null);
  return r?.ok ? await r.text() : "";
};
const amp = (s?: string | null) => s?.replace(/&amp;/g, "&");
type Cover = { image?: string; media_type?: string; width?: number; height?: number; duration?: number; views?: number; broken?: boolean } | null;

async function instagram(url: string): Promise<Cover> {
  const m = /instagram\.com\/(?:[\w.]+\/)?(p|reel|tv)\/([\w-]+)/.exec(url);
  if (!m) return null;
  const html = await page(`https://www.instagram.com/${m[1]}/${m[2]}/embed/captioned/`);
  if (html.includes("may be broken")) return { broken: true };
  if (!/EmbeddedMedia|EmbedSidecar|EmbedVideo/.test(html)) return null;
  const un = (s?: string) => s?.replace(/\\+\//g, "/").replace(/\\+u0026/g, "&");
  const field = (name: string) => new RegExp(`\\\\*"${name}\\\\*"\\s*:\\s*([^,}]+)`).exec(html)?.[1];
  const typename = /__typename\\*"\s*:\s*\\*"(Graph\w+|XDT\w+)/.exec(html)?.[1] || "";
  const product = /product_type\\*"\s*:\s*\\*"(\w+)/.exec(html)?.[1] || "";
  const dims = /dimensions\\*"\s*:\s*\{\\*"height\\*"\s*:\s*(\d+),\s*\\*"width\\*"\s*:\s*(\d+)\}/.exec(html);
  const isVideo = /Video/.test(typename) || /is_video\\*"\s*:\s*true/.test(html.slice(0, 400000));
  const media_type = /Sidecar/.test(typename) ? "carousel" : isVideo ? (product === "clips" || !product ? "reel" : "video") : "image";
  const res = [...html.matchAll(/\\*"src\\*"\s*:\s*\\*"(https:[^"\\]+(?:\\+\/[^"\\]+)*)\\*"\s*,\s*\\*"config_width\\*"\s*:\s*(\d+)/g)]
    .map((x) => ({ src: un(x[1])!, w: Number(x[2]) })).sort((a, b) => a.w - b.w);
  const image = (res.find((r) => r.w >= 480) || res[0])?.src || amp(/class="EmbeddedMediaImage"[^>]*\ssrc="([^"]+)"/.exec(html)?.[1]);
  const pad = Number(/padding-bottom:\s*([\d.]+)%/.exec(html)?.[1]) || null;
  const width = dims ? Number(dims[2]) : pad && media_type === "image" ? 1080 : undefined;
  const height = dims ? Number(dims[1]) : pad && media_type === "image" ? Math.round(1080 * pad / 100) : undefined;
  return image ? { image, media_type, width, height, duration: Number(field("video_duration")) || undefined, views: Number(field("video_view_count")) || Number(field("video_play_count")) || undefined } : null;
}
async function tiktok(url: string): Promise<Cover> {
  const r = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`).catch(() => null);
  if (r?.status === 404 || r?.status === 400) return { broken: true };
  const j = r?.ok ? await r.json().catch(() => null) : null;
  if (j?.thumbnail_url) return { image: j.thumbnail_url, media_type: "video", width: j.thumbnail_width, height: j.thumbnail_height };
  // TikTok's oEmbed has no thumbnail since Oct 2026: the video's own page has the cover, size and length
  const id = /video\/(\d+)/.exec(url)?.[1];
  if (!id) return null;
  const html = await page(url, { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" });
  if (/"statusCode":10204\b/.test(html)) return { broken: true };
  const i = html.indexOf(`"video":{"id":"${id}"`);
  if (i < 0) return null;
  const v = html.slice(i, i + 6000);
  const raw = /"cover":"([^"]+)"/.exec(v)?.[1] || /"originCover":"([^"]+)"/.exec(v)?.[1];
  const num = (k: string) => Number(new RegExp(`"${k}":(\\d+)`).exec(v)?.[1]) || undefined;
  return raw ? { image: JSON.parse(`"${raw}"`), media_type: "video", width: num("width"), height: num("height"), duration: num("duration") } : null;
}
async function coverFor(url: string): Promise<Cover> {
  let m;
  if (/instagram\.com\//.test(url)) return instagram(url);
  if (/tiktok\.com\//.test(url)) return tiktok(url);
  if ((m = /(?:shorts\/|v=|youtu\.be\/)([\w-]{11})/.exec(url))) {
    for (const q of ["maxresdefault", "hqdefault"]) {
      const img = `https://i.ytimg.com/vi/${m[1]}/${q}.jpg`;
      const h = await fetch(img, { method: "HEAD" }).catch(() => null);
      if (h?.ok) return { image: img, media_type: "video" };
    }
    return null;
  }
  if ((m = /(?:twitter|x)\.com\/[^/]+\/status\/(\d+)/.exec(url))) {
    const token = ((Number(m[1]) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");
    const r = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${m[1]}&token=${token}&lang=en`).catch(() => null);
    if (r?.status === 404) return { broken: true };
    const j = r?.ok ? await r.json().catch(() => null) : null;
    const md = (j?.mediaDetails || [])[0];
    const card = j?.card?.binding_values?.thumbnail_image_large?.image_value?.url || j?.card?.binding_values?.photo_image_full_size_large?.image_value?.url;
    if (md?.media_url_https) return { image: `${md.media_url_https}?name=small`, media_type: md.type === "photo" ? "image" : "video",
      width: md.original_info?.width, height: md.original_info?.height, duration: md.video_info?.duration_millis ? md.video_info.duration_millis / 1000 : undefined };
    return card ? { image: card, media_type: "image" } : null;
  }
  if (/facebook\.com\//.test(url)) {
    const html = await page(`https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}&width=500`);
    const imgs = [...html.matchAll(/(?:src|content)="(https:\/\/scontent[^"]+)"/g)].map((x) => amp(x[1])!).filter((u) => !/\/t39\.30808-1\/|s\d{2,3}x\d{2,3}[&_]/.test(u));
    return imgs[0] ? { image: imgs[0], media_type: /\/(reel|videos?)\//.test(url) || /<video|playable_url/.test(html) ? "video" : "image" } : null;
  }
  if ((m = /linkedin\.com\/feed\/update\/(urn:li:[\w:]+)/.exec(url))) {
    const html = await page(`https://www.linkedin.com/embed/feed/update/${m[1]}?collapsed=1`);
    const imgs = [...html.matchAll(/(https:\/\/media\.licdn\.com\/dms\/image\/[^"'\s)]+)/g)].map((x) => amp(x[1])!).filter((u) => !/company-logo|profile-displayphoto/.test(u));
    return imgs[0] ? { image: imgs[0], media_type: /<video/.test(html) ? "video" : "image" } : null;
  }
  return null;
}

// width / height of a JPEG, PNG or WebP from its bytes (Facebook doesn't give the shape: the cover does)
function imageSize(b: Uint8Array): { width: number; height: number } | null {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength), str = (i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));
  if (b[0] === 0x89 && str(1, 3) === "PNG") return { width: dv.getUint32(16), height: dv.getUint32(20) };
  if (str(0, 4) === "RIFF" && str(8, 4) === "WEBP") {
    const t = str(12, 4);
    if (t === "VP8 ") return { width: dv.getUint16(26, true) & 0x3fff, height: dv.getUint16(28, true) & 0x3fff };
    if (t === "VP8L") { const v = dv.getUint32(21, true); return { width: (v & 0x3fff) + 1, height: ((v >> 14) & 0x3fff) + 1 }; }
    if (t === "VP8X") return { width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length - 9) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { height: dv.getUint16(i + 5), width: dv.getUint16(i + 7) };
      i += 2 + dv.getUint16(i + 2);
    }
  }
  return null;
}

// download → Storage "covers/{id/1000}/{id}.{ext}" → public URL (and its size)
async function store(id: number, imageUrl: string) {
  const r = await fetch(imageUrl, { headers: { "User-Agent": UA } }).catch(() => null);
  if (!r?.ok) return null;
  const type = (r.headers.get("content-type") || "image/jpeg").split(";")[0];
  const ext = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" } as Record<string, string>)[type];
  if (!ext) return null;
  const path = `${Math.floor(id / 1000)}/${id}.${ext}`;
  const bytes = new Uint8Array(await r.arrayBuffer());
  const up = await fetch(`${env("SUPABASE_URL")}/storage/v1/object/covers/${path}`, { method: "POST",
    headers: { ...service, "Content-Type": type, "x-upsert": "true", "Cache-Control": "max-age=31536000" }, body: bytes });
  if (!up.ok) throw new Error(`storage: ${up.status} ${await up.text()}`);
  return { url: `${env("SUPABASE_URL")}/storage/v1/object/public/covers/${path}`, size: imageSize(bytes) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!(await superadmin(req))) return json({ error: "Only superadmins" }, 403);
  const { ids } = await req.json().catch(() => ({ ids: [] }));
  const list = (Array.isArray(ids) ? ids : []).map(Number).filter(Boolean).slice(0, 12);
  if (!list.length) return json({ done: 0, no_image: 0, removed: 0 });
  let rows;
  try { rows = await rest(`content_ideas?select=id,url,cover_source&id=in.(${list.join(",")})`); }
  catch (_) { rows = await rest(`content_ideas?select=id,url&id=in.(${list.join(",")})`); }   // import-cover-source.sql not run yet
  let done = 0, noImage = 0, removed = 0;
  for (const p of rows) {
    const ig = /instagram\.com/.test(p.url || "");
    const now = new Date().toISOString();
    try {
      // the image from the scraping: copied straight away; its shape from the image itself
      const src = p.cover_source ? await store(p.id, p.cover_source).catch(() => null) : null;
      if (src?.url) {
        await rest(`content_ideas?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify({ cover_url: `${src.url}?v=${Date.now().toString(36)}`, cover_at: now }) });
        if (src.size) await rest("rpc/apply_media_shape", { method: "POST", body: JSON.stringify({ p_rows: [{ id: p.id, ...src.size }] }) }).catch(() => {});
        // Instagram's own data (reel / carousel, length, views) when its page answers; not needed for the cover
        if (ig) {
          const c = await coverFor(p.url || "").catch(() => null);
          if (c && !c.broken && c.media_type && c.width && c.height) await rest("rpc/apply_ig_meta", { method: "POST", body: JSON.stringify({ p_rows: [{ id: p.id, media_type: c.media_type, width: c.width, height: c.height, duration: c.duration, views: c.views }] }) }).catch(() => {});
        }
        done++;
        await sleep(ig ? 700 : 0);
        continue;
      }
      const c = await coverFor(p.url || "");
      if (c?.broken) { removed++; await rest(`content_ideas?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify({ unavailable_at: now, cover_at: now }) }); continue; }
      const st = c?.image ? await store(p.id, c.image) : null;
      const url = st?.url;
      if (!url) { noImage++; await rest(`content_ideas?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify({ cover_at: now }) }); continue; }
      const extra = !ig ? { ...(c!.media_type ? { media_type: c!.media_type } : {}), ...(c!.width && c!.height ? { media_width: c!.width, media_height: c!.height, media_ratio: Math.round((c!.height / c!.width) * 10000) / 10000 } : {}), ...(c!.duration ? { duration_s: c!.duration } : {}) } : {};
      await rest(`content_ideas?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify({ cover_url: `${url}?v=${Date.now().toString(36)}`, cover_at: now, ...extra }) });
      if (/facebook\.com/.test(p.url || "") && st?.size) await rest("rpc/apply_media_shape", { method: "POST", body: JSON.stringify({ p_rows: [{ id: p.id, ...st.size }] }) }).catch(() => {});   // supabase/media-shape.sql
      if (ig) await rest("rpc/apply_ig_meta", { method: "POST", body: JSON.stringify({ p_rows: [{ id: p.id, media_type: c!.media_type, width: c!.width, height: c!.height, duration: c!.duration, views: c!.views }] }) });
      done++;
    } catch (_) {
      noImage++;
      await rest(`content_ideas?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify({ cover_at: now }) }).catch(() => {});
    }
    await sleep(ig ? 700 : 250);
  }
  return json({ done, no_image: noImage, removed });
});
