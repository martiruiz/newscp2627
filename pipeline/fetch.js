// Fetching and parsing of sources (RSS feeds and sitemaps + article pages)
import { XMLParser } from "fast-xml-parser";

const UA = "Mozilla/5.0 (compatible; SCPNewsBot/1.0; +https://sportscontentplaybook.com)";
const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

// Date.parse doesn't know zone abbreviations like "CEST"
const ZONES = { CEST: "+0200", CET: "+0100", BST: "+0100", EEST: "+0300", EET: "+0200", EDT: "-0400", EST: "-0500", PDT: "-0700", PST: "-0800" };
export const parseDate = (d) => {
  if (!d) return NaN;
  const s = String(d).replace(/\b(CEST|CET|BST|EEST|EET|EDT|EST|PDT|PST)\b/, (z) => ZONES[z]);
  return Date.parse(s);
};

const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const text = (v) => (typeof v === "object" && v !== null ? v["#text"] ?? "" : v ?? "");

const decode = (s) =>
  String(s)
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

export const stripHtml = (html) =>
  decode(
    String(html)
      .replace(/<(script|style|noscript|svg|nav|footer|header|form)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/(p|h[1-6]|li|blockquote)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();

/** RSS 2.0 / Atom → [{ url, title, published, body }] */
export async function readRss(source, limit, cutoff = 0) {
  const doc = xml.parse(await get(source.url));
  const items = doc.rss ? asArray(doc.rss.channel?.item) : asArray(doc.feed?.entry);
  const out = items.slice(0, limit).map((it) => ({
    url: typeof it.link === "object" ? it.link.href ?? text(it.link) : text(it.link),
    title: stripHtml(text(it.title)),
    published: it.pubDate || it.published || it.updated || it["dc:date"] || null,
    body: stripHtml(text(it["content:encoded"]) || text(it.description) || text(it.summary) || text(it.content)),
  }));
  // Feeds that only carry a teaser: read the article page instead (only for articles in the window)
  for (const item of out) {
    const t = parseDate(item.published);
    if (item.body.length >= 600 || !item.url || (cutoff && !(t >= cutoff))) continue;
    try {
      item.body = articleText(await get(item.url)) || item.body;
    } catch (err) {
      console.warn(`  ! ${item.url}: ${err.message}`);
    }
  }
  return out;
}

const articleText = (html) =>
  stripHtml(html.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html);

const meta = (html, prop) =>
  html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)`, "i"))?.[1] ??
  html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, "i"))?.[1];

/** Sitemap (newest first by <lastmod>) → article pages → [{ url, title, published, body }] */
export async function readSitemap(source, limit, cutoff = 0) {
  const doc = xml.parse(await get(source.url));
  const urls = asArray(doc.urlset?.url)
    .filter((u) => !source.match || String(u.loc).includes(source.match))
    // lastmod is a date (no time): keep anything modified on or after the cutoff day
    .filter((u) => !cutoff || !u.lastmod || Date.parse(u.lastmod) >= cutoff - 86400000)
    .sort((a, b) => String(b.lastmod ?? "").localeCompare(String(a.lastmod ?? "")))
    .slice(0, limit);

  const out = [];
  for (const u of urls) {
    try {
      const html = await get(u.loc);
      out.push({
        url: u.loc,
        title: decode(meta(html, "og:title") ?? html.match(/<title>([^<]*)/i)?.[1] ?? ""),
        published: meta(html, "article:published_time") ?? u.lastmod ?? null,
        body: articleText(html),
      });
    } catch (err) {
      console.warn(`  ! ${u.loc}: ${err.message}`);
    }
  }
  return out;
}

/** The article's pictures: its preview (og:image) and the ones in the text with a caption [{ src, alt }] (a newsletter has one per news item) */
export async function pageImages(url) {
  const html = await get(url.replace(/#.*$/, ""));
  const abs = (src) => new URL(decode(src), url).href;
  const og = meta(html, "og:image") ?? meta(html, "twitter:image");
  const list = [...html.matchAll(/<img\b[^>]*>/gi)]
    .map((m) => ({ src: m[0].match(/\ssrc=["']([^"']+)/i)?.[1], alt: decode(m[0].match(/\salt=["']([^"']*)/i)?.[1] ?? "").trim() }))
    .filter((i) => i.src && i.alt && !/profile_picture|avatar|logo|icon/i.test(i.src))
    .map((i) => ({ src: abs(i.src), alt: i.alt }));
  return { og: og ? abs(og) : null, list };
}

export function readSource(source, limit, cutoff) {
  return source.type === "rss" ? readRss(source, limit, cutoff) : readSitemap(source, limit, cutoff);
}
