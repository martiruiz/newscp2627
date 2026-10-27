// Supabase Edge Function "fb-shape": the real shape of Facebook posts, so their library cards fit the embed (no empty
// space under a landscape photo, no cut video). Facebook's embed doesn't tell the page its height, and most Facebook
// posts have no stored cover (the cover is what gave the shape until now).
// POST { ids: [content idea ids] } (up to 12) → for each Facebook post with no media_ratio yet: the image of its embed,
// its width / height read from the first bytes → public.apply_media_shape (media_width, media_height, media_ratio).
// A post Facebook no longer shows (deleted or private) gets unavailable_at, like the covers function does: it leaves the
// library and waits in Content ideas to be reviewed or deleted. Returns { [id]: ratio }, -1 for those. Public (the library calls it as cards load): it only reads ids, only touches Facebook posts
// that have no shape yet, and every answer is stored, so each post is fetched once.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
const env = (k: string) => Deno.env.get(k) ?? "";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const service = { apikey: env("SUPABASE_SERVICE_ROLE_KEY"), Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" };
const rest = async (path: string, init: RequestInit = {}) => {
  const r = await fetch(`${env("SUPABASE_URL")}/rest/v1/${path}`, { ...init, headers: { ...service, ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`${path.split("?")[0]}: ${r.status}`);
  return r.status === 204 ? null : r.json().catch(() => null);
};
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const IFRAME = { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9", "Sec-Fetch-Dest": "iframe", "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Site": "cross-site" };

// width / height of a JPEG, PNG or WebP from its first bytes (same reader as the covers function)
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

async function shapeOf(url: string) {
  const video = /\/(reel|videos?)\//.test(url);
  const r = await fetch(`https://www.facebook.com/plugins/${video ? "video" : "post"}.php?href=${encodeURIComponent(url)}&show_text=false&width=500`, { headers: IFRAME }).catch(() => null);
  const html = r?.ok ? await r.text() : "";
  // deleted or made private: Facebook's embed says so instead of showing the post
  if (/This Facebook post is no longer available|Video Unavailable/.test(html)) return { gone: true };
  // photo and link posts: the embed draws its image at the size written on it (link previews are always a 1.91:1 crop)
  const tag = html.match(/<img class="scaledImageFit[^"]*"[^>]*>/)?.[0] || "";
  const w = Number(tag.match(/ width="(\d+)"/)?.[1]), h = Number(tag.match(/ height="(\d+)"/)?.[1]);
  if (w > 0 && h > 0) return { width: w, height: h };
  const img = [...html.matchAll(/(?:src|content)="(https:\/\/scontent[^"]+)"/g)].map((x) => x[1].replace(/&amp;/g, "&")).filter((u) => !/\/t39\.30808-1\/|s\d{2,3}x\d{2,3}[&_]/.test(u))[0];
  if (!img) return null;
  const ir = await fetch(img, { headers: { "User-Agent": UA, Range: "bytes=0-65535" } }).catch(() => null);
  if (!ir?.ok) return null;
  return imageSize(new Uint8Array(await ir.arrayBuffer()));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await req.json().catch(() => ({}));
  const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(Number).filter((n: number) => Number.isInteger(n) && n > 0))].slice(0, 12);
  if (!ids.length) return json({});
  try {
    const rows = await rest(`content_ideas?select=id,url&id=in.(${ids.join(",")})&media_ratio=is.null&url=ilike.*facebook.com*`);
    const out: Record<string, number> = {}, sizes: { id: number; width: number; height: number }[] = [], gone: number[] = [];
    await Promise.all((rows || []).map(async (p: { id: number; url: string }) => {
      const s = await shapeOf(p.url);
      if (s && "gone" in s) { gone.push(p.id); out[p.id] = -1; return; }
      if (s?.width && s?.height) { sizes.push({ id: p.id, ...s }); out[p.id] = Math.round((s.height / s.width) * 10000) / 10000; }
    }));
    if (sizes.length) await rest("rpc/apply_media_shape", { method: "POST", body: JSON.stringify({ p_rows: sizes }) });
    if (gone.length) await rest(`content_ideas?id=in.(${gone.join(",")})`, { method: "PATCH", body: JSON.stringify({ unavailable_at: new Date().toISOString() }) });
    return json(out);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
