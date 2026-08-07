import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("u");
  if (!username) return NextResponse.json({ error: "missing username" }, { status: 400 });

  try {
    const res = await fetch(`https://www.instagram.com/${encodeURIComponent(username)}/`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `instagram ${res.status}` }, { status: 502 });
    }

    const html = await res.text();

    // og:image contains the profile picture
    const match = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/);
    if (!match) {
      return NextResponse.json({ error: "no og:image" }, { status: 404 });
    }

    const imageUrl = match[1].replace(/&amp;/g, "&");

    // Proxy the image so the browser doesn't hit Instagram directly (avoids CORS/hotlink blocks)
    const imgRes = await fetch(imageUrl, {
      headers: {
        Referer: "https://www.instagram.com/",
        "User-Agent":
          "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!imgRes.ok) {
      return NextResponse.json({ error: `image fetch ${imgRes.status}` }, { status: 502 });
    }

    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const buffer = await imgRes.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // Cache 24h in CDN, 1h in browser
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
