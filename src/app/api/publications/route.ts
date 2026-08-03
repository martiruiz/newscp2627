import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "18");
  const sport = searchParams.get("sport");
  const competition = searchParams.get("competition");
  const entityType = searchParams.get("entityType");
  const entityName = searchParams.get("entityName");
  const format = searchParams.get("format");
  const platform = searchParams.get("platform");
  const saved = searchParams.get("saved");
  const classification = searchParams.get("classification");
  const contentCategory = searchParams.get("contentCategory");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const search = searchParams.get("search");
  const order = searchParams.get("order") || "latest";

  const userId = await getCurrentUserId();
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (sport) {
    const slugs = sport.split(",").filter(Boolean);
    if (slugs.length === 1) {
      where.sport = { slug: slugs[0] };
    } else if (slugs.length > 1) {
      where.sport = { slug: { in: slugs } };
    }
  }

  if (competition) {
    const slugs = competition.split(",").filter(Boolean);
    if (slugs.length === 1) {
      where.competitions = { some: { competition: { slug: slugs[0] } } };
    } else if (slugs.length > 1) {
      where.competitions = { some: { competition: { slug: { in: slugs } } } };
    }
  }

  if (entityType) {
    const slugs = entityType.split(",").filter(Boolean);
    if (slugs.length === 1) {
      where.entityType = { slug: slugs[0] };
    } else if (slugs.length > 1) {
      where.entityType = { slug: { in: slugs } };
    }
  }

  if (entityName) {
    const names = entityName.split(",").filter(Boolean);
    if (names.length === 1) {
      where.entityName = { contains: names[0] };
    } else if (names.length > 1) {
      where.OR = names.map((n) => ({ entityName: { contains: n } }));
    }
  }

  if (format) {
    const slugs = format.split(",").filter(Boolean);
    if (slugs.length === 1) {
      where.contentFormat = { slug: slugs[0] };
    } else if (slugs.length > 1) {
      where.contentFormat = { slug: { in: slugs } };
    }
  }

  if (platform) {
    const slugs = platform.split(",").filter(Boolean);
    if (slugs.length === 1) {
      where.platform = { slug: slugs[0] };
    } else if (slugs.length > 1) {
      where.platform = { slug: { in: slugs } };
    }
  }

  if (classification) {
    const slugs = classification.split(",").filter(Boolean);
    if (slugs.length === 1) {
      where.classifications = { some: { classification: { slug: slugs[0] } } };
    } else if (slugs.length > 1) {
      where.classifications = { some: { classification: { slug: { in: slugs } } } };
    }
  }

  if (contentCategory) {
    const slugs = contentCategory.split(",").filter(Boolean);
    if (slugs.length === 1) {
      where.contentCategories = { some: { contentCategory: { slug: slugs[0] } } };
    } else if (slugs.length > 1) {
      where.contentCategories = { some: { contentCategory: { slug: { in: slugs } } } };
    }
  }

  if (saved === "true") {
    where.savedBy = { some: { userId } };
  }

  if (dateFrom || dateTo) {
    where.publishedAt = {};
    if (dateFrom) where.publishedAt.gte = new Date(dateFrom);
    if (dateTo) where.publishedAt.lte = new Date(dateTo + "T23:59:59Z");
  }

  if (search) {
    where.OR = [
      { accountUsername: { contains: search } },
      { entityName: { contains: search } },
      { externalPostId: { contains: search } },
    ];
  }

  const orderBy = order === "latest"
    ? { publishedAt: "desc" as const }
    : { createdAt: "desc" as const };

  const [publications, total] = await Promise.all([
    prisma.publication.findMany({
      where,
      include: {
        platform: true,
        sport: true,
        contentFormat: true,
        entityType: true,
        competitions: { include: { competition: true } },
        classifications: { include: { classification: true } },
        savedBy: {
          where: { userId },
          select: { id: true },
        },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.publication.count({ where }),
  ]);

  const formatted = publications.map((pub) => ({
    id: pub.id,
    externalPostId: pub.externalPostId,
    canonicalUrl: pub.canonicalUrl,
    embedUrl: pub.embedUrl,
    accountUsername: pub.accountUsername,
    publishedAt: pub.publishedAt,
    platform: pub.platform.name,
    sport: pub.sport?.name || null,
    entityType: pub.entityType?.name || null,
    entityName: pub.entityName,
    contentFormat: pub.contentFormat?.name || null,
    competitions: pub.competitions.map((c) => c.competition.name),
    classifications: pub.classifications.map((c) => c.classification.name),
    isSaved: pub.savedBy.length > 0,
  }));

  return NextResponse.json({
    publications: formatted,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + limit < total,
    },
  });
}
