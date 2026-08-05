import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("videoId");
  if (!videoId) return NextResponse.json({ error: "Missing videoId" }, { status: 400 });

  try {
    const url = `https://www.tiktok.com/oembed?url=https://www.tiktok.com/video/${videoId}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return NextResponse.json({ thumb: null });
    const data = await res.json();
    return NextResponse.json({ thumb: data.thumbnail_url ?? null, title: data.title ?? null });
  } catch {
    return NextResponse.json({ thumb: null });
  }
}
