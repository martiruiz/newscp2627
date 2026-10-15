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
