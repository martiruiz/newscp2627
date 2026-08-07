import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notify";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const category = searchParams.get("category")?.trim() ?? "";
  const days = searchParams.get("days");

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { title: { contains: search } },
      { subtitle: { contains: search } },
      { content: { contains: search } },
    ];
  }

  if (category) {
    where.category = category;
  }

  if (days && days !== "all") {
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days, 10));
    where.publishedAt = { gte: since };
  }

  const posts = await prisma.blogPost.findMany({
    where,
    orderBy: { publishedAt: "desc" },
  });

  const categories = await prisma.blogPost.findMany({
    select: { category: true },
    distinct: ["category"],
    where: { category: { not: null } },
  });

  return NextResponse.json({
    posts,
    categories: categories.map((c) => c.category).filter(Boolean),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, subtitle, category, publishedAt, content, imageUrl, imageAlt, keywords, embed1, embed2, embed3, embed4, embed5 } = body;

  if (!title?.trim()) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  if (!content?.trim()) return NextResponse.json({ error: "Content is required." }, { status: 400 });

  const post = await prisma.blogPost.create({
    data: {
      title: title.trim(),
      subtitle: subtitle?.trim() || null,
      category: category?.trim() || null,
      publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
      content: content.trim(),
      imageUrl: imageUrl?.trim() || null,
      imageAlt: imageAlt?.trim() || null,
      keywords: keywords?.trim() || null,
      embed1: embed1?.trim() || null,
      embed2: embed2?.trim() || null,
      embed3: embed3?.trim() || null,
      embed4: embed4?.trim() || null,
      embed5: embed5?.trim() || null,
    },
  });

  createNotification(
    "Nou article al blog",
    `"${post.title}" ja és visible a la secció Blog.`,
    "blog"
  ).catch(() => {});
  return NextResponse.json(post, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, title, subtitle, category, publishedAt, content, imageUrl, imageAlt, keywords, embed1, embed2, embed3, embed4, embed5 } = body;

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (title !== undefined && !title?.trim()) return NextResponse.json({ error: "Title cannot be empty." }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title.trim();
  if (subtitle !== undefined) data.subtitle = subtitle?.trim() || null;
  if (category !== undefined) data.category = category?.trim() || null;
  if (publishedAt !== undefined) data.publishedAt = publishedAt ? new Date(publishedAt) : null;
  if (content !== undefined) data.content = content.trim();
  if (imageUrl !== undefined) data.imageUrl = imageUrl?.trim() || null;
  if (imageAlt !== undefined) data.imageAlt = imageAlt?.trim() || null;
  if (keywords !== undefined) data.keywords = keywords?.trim() || null;
  if (embed1 !== undefined) data.embed1 = embed1?.trim() || null;
  if (embed2 !== undefined) data.embed2 = embed2?.trim() || null;
  if (embed3 !== undefined) data.embed3 = embed3?.trim() || null;
  if (embed4 !== undefined) data.embed4 = embed4?.trim() || null;
  if (embed5 !== undefined) data.embed5 = embed5?.trim() || null;

  const post = await prisma.blogPost.update({ where: { id }, data });
  return NextResponse.json(post);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.blogPost.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
