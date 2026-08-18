import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const like = `%${q}%`;
  const limit = 4;

  const [news, blog, jobs, publications] = await Promise.all([
    prisma.newsArticle.findMany({
      where: { OR: [{ title: { contains: q } }, { excerpt: { contains: q } }] },
      select: { id: true, title: true, platform: true, publishedAt: true },
      orderBy: { publishedAt: "desc" },
      take: limit,
    }),
    prisma.blogPost.findMany({
      where: { OR: [{ title: { contains: q } }, { subtitle: { contains: q } }, { category: { contains: q } }] },
      select: { id: true, title: true, subtitle: true, category: true },
      orderBy: { publishedAt: "desc" },
      take: limit,
    }),
    prisma.jobPosting.findMany({
      where: {
        active: true,
        OR: [{ title: { contains: q } }, { company: { contains: q } }],
      },
      select: { id: true, title: true, company: true, jobType: true, sourceUrl: true },
      take: limit,
    }),
    prisma.publication.findMany({
      where: {
        archivedAt: null,
        OR: [
          { accountUsername: { contains: q } },
          { entityName: { contains: q } },
          { rawTitle: { contains: q } },
        ],
      },
      select: {
        id: true,
        accountUsername: true,
        entityName: true,
        rawTitle: true,
        platform: { select: { name: true } },
      },
      orderBy: { publishedAt: "desc" },
      take: limit,
    }),
  ]);

  return NextResponse.json({
    results: {
      news: news.map((n) => ({ id: n.id, label: n.title, sub: n.platform ?? "", href: `/news?article=${n.id}`, type: "news" })),
      blog: blog.map((b) => ({ id: b.id, label: b.title, sub: b.category ?? b.subtitle ?? "", href: `/news?tab=blog&post=${b.id}`, type: "blog" })),
      jobs: jobs.map((j) => ({ id: j.id, label: j.title, sub: j.company, href: j.sourceUrl, external: true, type: "job" })),
      content: publications.map((p) => ({
        id: p.id,
        label: p.rawTitle || p.accountUsername || p.entityName || "Publicació",
        sub: `@${p.accountUsername ?? ""} · ${p.platform?.name ?? ""}`,
        href: `/feed?highlight=${p.id}`,
        type: "content",
      })),
    },
  });
}
