import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildWhere(queue: string): any {
  switch (queue) {
    case "new":
      return { reviewStatus: "pending" };
    case "missing":
      return {
        AND: [
          {
            OR: [
              { reviewStatus: null },
              { reviewStatus: { not: "approved" } },
            ],
          },
          {
            OR: [
              { sports: { none: {} } },
              { accountUsername: null },
              { entityName: null },
            ],
          },
        ],
      };
    case "errors":
      return { importStatus: "error" };
    default:
      return {};
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const queue = searchParams.get("queue") ?? "";
  const cursor = searchParams.get("cursor") ?? null;
  const limit = 50;

  const where = buildWhere(queue);
  if (!where) return NextResponse.json({ error: "Unknown queue" }, { status: 400 });

  const [items, total] = await Promise.all([
    prisma.publication.findMany({
      where,
      include: {
        platform: { select: { name: true } },
        sports: { include: { sport: { select: { name: true } } } },
        entityTypes: { include: { entityType: { select: { name: true } } } },
        contentFormat: { select: { name: true } },
        competitions: { include: { competition: { select: { name: true } } } },
        classifications: { include: { classification: { select: { id: true, name: true, slug: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    prisma.publication.count({ where }),
  ]);

  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  return NextResponse.json({
    items: page.map((p) => ({
      id: p.id,
      externalPostId: p.externalPostId,
      rawTitle: p.rawTitle,
      publishedAt: p.publishedAt,
      createdAt: p.createdAt,
      platform: p.platform.name,
      accountUsername: p.accountUsername,
      sport: p.sports[0]?.sport.name ?? null,
      entity: p.entityTypes[0]?.entityType.name ?? null,
      entityName: p.entityName,
      format: p.contentFormat?.name ?? null,
      competitions: p.competitions.map((c) => c.competition.name),
      canonicalUrl: p.canonicalUrl,
      embedUrl: p.embedUrl,
      originalUrl: p.originalUrl,
      importStatus: p.importStatus,
      importError: p.importError,
      reviewStatus: p.reviewStatus,
      classificationIds: p.classifications.map((c) => c.classification.id),
      classificationSlugs: p.classifications.map((c) => c.classification.slug),
    })),
    total,
    nextCursor,
  });
}
