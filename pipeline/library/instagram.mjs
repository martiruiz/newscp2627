// Instagram's public embed page (the one websites show in an iframe): post status, media shape, image and video URLs.
// Uses node:https instead of fetch(): fetch adds "Sec-Fetch-Mode: cors", and Instagram then answers with an error page.
import https from "node:https";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Sec-Fetch-Dest": "iframe",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "cross-site",
};

export const igRef = (url) => {
  const m = /instagram\.com\/(?:[\w.]+\/)?(p|reel|tv)\/([\w-]+)/.exec(url || "");
  return m ? { kind: m[1], code: m[2] } : null;
};

function get(url, timeout = 25000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: HEADERS, timeout }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

// → { status: "ok" | "broken" | "unknown", ratio, image, video }
export async function igEmbed(url, { captioned = false } = {}) {
  const ref = igRef(url);
  if (!ref) return { status: "unknown" };
  let html;
  try { html = await get(`https://www.instagram.com/${ref.kind}/${ref.code}/embed/${captioned ? "captioned/" : ""}`); } catch { return { status: "unknown" }; }
  if (html.includes("may be broken")) return { status: "broken" };
  if (!/EmbeddedMedia|EmbedSidecar|EmbedVideo/.test(html)) return { status: "unknown" };
  // Media box: padding-bottom 125% = 4:5, 133.3% = 3:4, 56.25% = 16:9 (reels report 125%: 9:16 letterboxed in 4:5)
  const pad = /padding-bottom:\s*([\d.]+)%/.exec(html);
  const image = /class="EmbeddedMediaImage"[^>]*\ssrc="([^"]+)"/.exec(html)?.[1]?.replaceAll("&amp;", "&") || null;
  const raw = /video_url\\+"\s*:\s*\\+"(.*?)\\+"/.exec(html)?.[1];
  const video = raw ? raw.replace(/\\+\//g, "/").replace(/\\+u0026/g, "&") : null; // JSON escaped twice inside the page
  return { status: "ok", ratio: pad ? Math.round(Number(pad[1]) * 10) / 1000 : null, image, video };
}

// Everything the smart filters need from one embed page:
// → { status, media_type: image | carousel | reel | video, width, height, duration, views, image (≈480px wide) }
// The page embeds Instagram's own post data as JSON escaped twice; we read a few fields from it.
export async function igMeta(url) {
  const ref = igRef(url);
  if (!ref) return { status: "unknown" };
  let html;
  try { html = await get(`https://www.instagram.com/${ref.kind}/${ref.code}/embed/captioned/`); } catch { return { status: "unknown" }; }
  if (html.includes("may be broken")) return { status: "broken" };
  if (!/EmbeddedMedia|EmbedSidecar|EmbedVideo/.test(html)) return { status: "unknown" };
  const un = (s) => s?.replace(/\\+\//g, "/").replace(/\\+u0026/g, "&");
  const field = (name, re = "[^,}]+") => new RegExp(`\\\\*"${name}\\\\*"\\s*:\\s*(${re})`).exec(html)?.[1];
  const typename = /__typename\\*"\s*:\s*\\*"(Graph\w+|XDT\w+)/.exec(html)?.[1] || "";
  const product = /product_type\\*"\s*:\s*\\*"(\w+)/.exec(html)?.[1] || "";
  const dims = /dimensions\\*"\s*:\s*\{\\*"height\\*"\s*:\s*(\d+),\s*\\*"width\\*"\s*:\s*(\d+)\}/.exec(html);
  const isVideo = /Video/.test(typename) || /is_video\\*"\s*:\s*true/.test(html.slice(0, 400000));
  const media_type = /Sidecar/.test(typename) ? "carousel" : isVideo ? (product === "clips" || !product ? "reel" : "video") : "image";
  // a small rendition for the AI (display_resources lists 640 / 750 / 1080 wide)
  const res = [...html.matchAll(/\\*"src\\*"\s*:\s*\\*"(https:[^"\\]+(?:\\+\/[^"\\]+)*)\\*"\s*,\s*\\*"config_width\\*"\s*:\s*(\d+)/g)]
    .map((m) => ({ src: un(m[1]), w: Number(m[2]) })).sort((a, b) => a.w - b.w);
  const small = res.find((r) => r.w >= 480) || res[0];
  const image = small?.src || /class="EmbeddedMediaImage"[^>]*\ssrc="([^"]+)"/.exec(html)?.[1]?.replaceAll("&amp;", "&") || null;
  // single photos: the size isn't in the data, but the media box keeps the photo's exact proportion
  const pad = Number(/padding-bottom:\s*([\d.]+)%/.exec(html)?.[1]) || null;
  const width = dims ? Number(dims[2]) : pad && media_type === "image" ? 1080 : null;
  const height = dims ? Number(dims[1]) : pad && media_type === "image" ? Math.round(1080 * pad / 100) : null;
  return {
    status: "ok", media_type, product, height, width,
    duration: Number(field("video_duration")) || null,
    views: Number(field("video_view_count")) || Number(field("video_play_count")) || null,
    image,
  };
}
