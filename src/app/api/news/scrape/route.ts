import { NextRequest, NextResponse } from "next/server";

function detectPlatform(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("instagram.com")) return "Instagram";
    if (host.includes("tiktok.com")) return "TikTok";
    if (host.includes("twitter.com") || host.includes("x.com")) return "X";
    if (host.includes("youtube.com") || host.includes("youtu.be")) return "YouTube";
    if (host.includes("facebook.com") || host.includes("fb.com")) return "Facebook";
    if (host.includes("linkedin.com")) return "LinkedIn";
    return null;
  } catch {
    return null;
  }
}

function getMeta(html: string, property: string): string | null {
  const ogMatch = html.match(new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"))
    ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"));
  if (ogMatch) return ogMatch[1].trim();

  const nameMatch = html.match(new RegExp(`<meta[^>]+name=["']${property.replace("og:", "")}["'][^>]+content=["']([^"']+)["']`, "i"))
    ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property.replace("og:", "")}["']`, "i"));
  if (nameMatch) return nameMatch[1].trim();

  return null;
}

function getTitle(html: string): string | null {
  return getMeta(html, "og:title")
    ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim()
    ?? null;
}

function getExcerpt(html: string): string | null {
  return getMeta(html, "og:description")
    ?? getMeta(html, "description")
    ?? html.match(/<p[^>]*>([^<]{40,})<\/p>/i)?.[1]?.replace(/\s+/g, " ").trim()
    ?? null;
}

function getImage(html: string, baseUrl: string): string | null {
  const ogImg = getMeta(html, "og:image");
  if (ogImg) {
    if (ogImg.startsWith("http")) return ogImg;
    try { return new URL(ogImg, baseUrl).href; } catch { return ogImg; }
  }
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) {
    const src = imgMatch[1];
    if (src.startsWith("http")) return src;
    try { return new URL(src, baseUrl).href; } catch { return src; }
  }
  return null;
}

function getPublishedAt(html: string): string | null {
  return getMeta(html, "article:published_time")
    ?? getMeta(html, "og:article:published_time")
    ?? getMeta(html, "datePublished")
    ?? null;
}

export async function POST(request: NextRequest) {
  const { url } = await request.json();
  if (!url?.trim()) return NextResponse.json({ error: "URL required" }, { status: 400 });

  let html: string;
  try {
    const res = await fetch(url.trim(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SCPBot/1.0)",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10000),
      redirect: "follow",
    });
    if (!res.ok) return NextResponse.json({ error: `HTTP ${res.status}` }, { status: 400 });
    html = await res.text();
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }

  const title = getTitle(html);
  if (!title) return NextResponse.json({ error: "Could not extract title from this URL" }, { status: 422 });

  return NextResponse.json({
    title,
    excerpt: getExcerpt(html),
    imageUrl: getImage(html, url.trim()),
    platform: detectPlatform(url.trim()),
    publishedAt: getPublishedAt(html),
  });
}
