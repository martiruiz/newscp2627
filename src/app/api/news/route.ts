import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform");
  const search = searchParams.get("search");
  const days = searchParams.get("days");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (platform) {
    const platforms = platform.split(",").map((s) => s.trim()).filter(Boolean);
    where.platform = platforms.length === 1 ? platforms[0] : { in: platforms };
  }

  if (search) {
    where.OR = [
      { title: { contains: search } },
      { excerpt: { contains: search } },
    ];
  }

  if (days) {
    const d = parseInt(days);
    if (!isNaN(d)) {
      const since = new Date();
      since.setDate(since.getDate() - d);
      where.createdAt = { gte: since };
    }
  }

  const articles = await prisma.newsArticle.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ articles });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { url, title, excerpt, imageUrl, platform, publishedAt } = body;

  if (!url?.trim() || !title?.trim()) {
    return NextResponse.json({ error: "url and title are required" }, { status: 400 });
  }

  const existing = await prisma.newsArticle.findUnique({ where: { url: url.trim() } });
  if (existing) {
    return NextResponse.json({ error: "This URL has already been added" }, { status: 409 });
  }

  const article = await prisma.newsArticle.create({
    data: {
      url: url.trim(),
      title: title.trim(),
      excerpt: excerpt?.trim() || null,
      imageUrl: imageUrl?.trim() || null,
      platform: platform || null,
      publishedAt: publishedAt ? new Date(publishedAt) : null,
    },
  });

  return NextResponse.json(article);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await prisma.newsArticle.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
