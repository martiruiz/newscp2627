// Supabase Edge Function "idea-from-url": Admin → Content ideas → Add. From the link of a post, everything the editor
// needs, so a new idea is filled by itself: the clean link, its external id, the embed code (same shapes as the imports),
// the caption as title, the publish date, the account, the platform and the format.
// POST { url } (superadmins only) → { url, external_id, embed, title, published_at, account, account_platform, platform, format }
// Dates: Instagram, TikTok and X carry the time in the post id; YouTube from its page; Facebook has none (left empty).
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
const env = (k: string) => Deno.env.get(k) ?? "";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

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

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const IFRAME = { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9", "Sec-Fetch-Dest": "iframe", "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Site": "cross-site" };
const page = async (url: string, headers: Record<string, string> = IFRAME) => {
  const r = await fetch(url, { headers }).catch(() => null);
  return r?.ok ? await r.text() : "";
};
const getJson = async (url: string) => { const r = await fetch(url).catch(() => null); return r?.ok ? await r.json().catch(() => null) : null; };
const unhtml = (s: string) => s.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim();
const iso = (ms: number) => (Number.isFinite(ms) && ms > 1.1e12 && ms < Date.now() + 864e5 ? new Date(ms).toISOString() : null);
const ytEmbed = (id: string) => `<iframe width='560' height='315' src='https://www.youtube.com/embed/${id}' frameborder='0' allowfullscreen></iframe>`;
const fbEmbed = (url: string) => `<iframe src="https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}&width=500" width="500" height="600" style="border:none;overflow:hidden;background:white;" scrolling="no" frameborder="0" allowfullscreen="true" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"></iframe>`;

type Idea = { url: string; external_id: string; embed: string; title?: string | null; published_at?: string | null; account?: string | null;
  account_platform?: string | null; platform: string; format?: string | null };

// Instagram: the id is the shortcode, the time is in the media id behind it ((id >> 23) + Instagram's epoch)
const IG_ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
function igTime(code: string) {
  try { let n = 0n; for (const c of code.slice(0, 11)) n = n * 64n + BigInt(IG_ABC.indexOf(c)); return iso(Number(n >> 23n) + 1314220021721); } catch { return null; }
}
async function instagram(kind: string, code: string): Promise<Idea> {
  const html = await page(`https://www.instagram.com/${kind}/${code}/embed/captioned/`);
  const typename = /__typename\\*"\s*:\s*\\*"(Graph\w+|XDT\w+)/.exec(html)?.[1] || "";
  const product = /product_type\\*"\s*:\s*\\*"(\w+)/.exec(html)?.[1] || "";
  const video = /Video/.test(typename) || /is_video\\*"\s*:\s*true/.test(html.slice(0, 400000));
  const format = /Sidecar/.test(typename) ? "Carousel" : kind === "reel" || (video && (product === "clips" || !product)) ? "Reel" : video ? "Video" : html ? "Images" : null;
  // the caption: the page's caption block, or the post's data in the page (escaped JSON)
  const cap = /class="Caption">([\s\S]*?)<\/div>/.exec(html)?.[1];
  let title = cap ? unhtml(cap.replace(/<a class="CaptionUsername"[\s\S]*?<\/a>/, "").replace(/<div class="CaptionComments"[\s\S]*$/, ""))
    .replace(/\s*View all( [\d,.]+)? comments?$/i, "").trim() || null : null;
  const raw = !title && /edge_media_to_caption\\*"\s*:\s*\{\\*"edges\\*"\s*:\s*\[\{\\*"node\\*"\s*:\s*\{\\*"text\\*"\s*:\s*\\*"(.*?)\\*"\}/.exec(html)?.[1];
  if (raw) { let t = raw; while (/\\\\/.test(t)) t = t.replace(/\\\\/g, "\\"); try { title = JSON.parse(`"${t}"`); } catch { title = null; } }
  const account = /class="CaptionUsername"[^>]*>([^<]+)</.exec(html)?.[1]?.trim()
    || /\\*"owner\\*"\s*:\s*\{[^}]*?\\*"username\\*"\s*:\s*\\*"([\w.]+)/.exec(html)?.[1] || null;
  return { url: `https://www.instagram.com/${kind === "reel" ? "reel" : "p"}/${code}/`, external_id: code, platform: "Instagram", format,
    embed: `<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/p/${code}" data-instgrm-captioned></blockquote>`,
    title, published_at: igTime(code), account, account_platform: account ? "instagram" : null };
}
async function tiktok(url: string): Promise<Idea | null> {
  if (!/\/video\/\d+/.test(url)) {   // short links (vm.tiktok.com, /t/…) → the video's own link
    const r = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" }).catch(() => null);
    url = r?.url || url;
  }
  const m = /tiktok\.com\/@([\w.-]+)\/(?:video|photo)\/(\d+)/.exec(url);
  if (!m) return null;
  const [, handle, id] = m, link = `https://www.tiktok.com/@${handle}/video/${id}`;
  const o = await getJson(`https://www.tiktok.com/oembed?url=${encodeURIComponent(link)}`);
  let title: string | null = o?.title || null;
  if (!title) {   // oEmbed refused (rate limit): the caption from the video's own page
    const html = await page(link, { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" });
    const d = new RegExp(`"id":"${id}","desc":"((?:[^"\\\\]|\\\\.)*)"`).exec(html)?.[1];
    if (d) try { title = JSON.parse(`"${d}"`) || null; } catch { title = null; }
  }
  return { url: link, external_id: id, platform: "TikTok", format: "Video",
    embed: `<blockquote class="tiktok-embed" cite="${link}" data-video-id="${id}"><section><a href="${link}"></a></section></blockquote><script async src="https://www.tiktok.com/embed.js"></script>`,
    title, published_at: iso(Number(BigInt(id) >> 32n) * 1000), account: (o?.author_unique_id || handle).toLowerCase(), account_platform: "tiktok" };
}
async function x(handle: string, id: string): Promise<Idea> {
  const token = ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");
  const j = await getJson(`https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=${token}&lang=en`);
  const md = (j?.mediaDetails || [])[0];
  const account = j?.user?.screen_name || handle;
  const text = j?.text ? String(j.text).replace(/\s*https:\/\/t\.co\/\w+$/, "").trim() : null;
  return { url: `https://x.com/${account}/status/${id}`, external_id: id, platform: "X", format: md ? (md.type === "photo" ? "Images" : "Video") : null,
    embed: `<blockquote class="twitter-tweet"><a href="https://twitter.com/${account}/status/${id}#m"></a></blockquote><script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>`,
    title: text, published_at: iso(Number((BigInt(id) >> 22n) + 1288834974657n)), account: account.toLowerCase(), account_platform: "x" };
}
async function youtube(id: string, short: boolean): Promise<Idea> {
  const watch = `https://www.youtube.com/watch?v=${id}`;
  const [o, html] = await Promise.all([getJson(`https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`), page(watch, { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" })]);
  const date = /"(?:uploadDate|publishDate)":"([^"]+)"/.exec(html)?.[1] || /itemprop="(?:uploadDate|datePublished)" content="([^"]+)"/.exec(html)?.[1];
  const handle = /youtube\.com\/@([\w.-]+)/.exec(o?.author_url || "")?.[1] || null;
  return { url: watch, external_id: id, platform: "YouTube", format: short ? "Shorts" : "Video", embed: ytEmbed(id), title: o?.title || null,
    published_at: date ? iso(Date.parse(date)) : null, account: handle?.toLowerCase() || null, account_platform: handle ? "youtube" : null };
}
function facebook(url: string): Idea | null {
  const u = new URL(url);
  const clean = `https://www.facebook.com${u.pathname.replace(/\/+$/, "")}${u.pathname.startsWith("/watch") && u.searchParams.get("v") ? `?v=${u.searchParams.get("v")}` : ""}`;
  const id = u.searchParams.get("v") || u.searchParams.get("story_fbid") || /(pfbid\w+|\d{6,})\/?$/.exec(u.pathname)?.[1];
  if (!id) return null;
  const page1 = u.pathname.split("/").filter(Boolean)[0];
  const account = page1 && !["reel", "watch", "share", "photo", "photo.php", "permalink.php", "story.php", "video.php"].includes(page1) ? page1.toLowerCase() : null;
  return { url: clean, external_id: id.replace(/^pfbid/, ""), platform: "Facebook", format: /\/(reel|videos?|watch)\b/.test(u.pathname) ? "Video" : null,
    embed: fbEmbed(clean), title: null, published_at: null, account, account_platform: account ? "facebook" : null };
}

async function fromUrl(raw: string): Promise<Idea | null> {
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  let m;
  if ((m = /instagram\.com\/(?:[\w.]+\/)?(p|reels?|tv)\/([\w-]+)/.exec(url))) return instagram(m[1].startsWith("reel") ? "reel" : m[1], m[2]);
  if (/tiktok\.com\//.test(url)) return tiktok(url.split("?")[0]);
  if ((m = /(?:twitter|x)\.com\/(\w+)\/status(?:es)?\/(\d+)/.exec(url))) return x(m[1], m[2]);
  if ((m = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/.exec(url))) return youtube(m[1], /\/shorts\//.test(url));
  if (/facebook\.com\/|fb\.watch\//.test(url)) {
    if (/fb\.watch|\/share\//.test(url)) { const r = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" }).catch(() => null); if (r?.url) url = r.url; }
    return facebook(url);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!(await superadmin(req))) return json({ error: "Not allowed" }, 403);
  const { url } = await req.json().catch(() => ({}));
  if (!url || typeof url !== "string") return json({ error: "Paste the link of a post." }, 400);
  const idea = await fromUrl(url).catch(() => null);
  return idea ? json(idea) : json({ error: "That link isn't a post from Instagram, TikTok, X, YouTube or Facebook." }, 422);
});
