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
      where.sports = { some: { sport: { slug: slugs[0] } } };
    } else if (slugs.length > 1) {
      where.sports = { some: { sport: { slug: { in: slugs } } } };
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
      where.entityTypes = { some: { entityType: { slug: slugs[0] } } };
    } else if (slugs.length > 1) {
      where.entityTypes = { some: { entityType: { slug: { in: slugs } } } };
    }
  }

  if (entityName) {
    // Each name is trimmed; `contains` matches it even inside comma-separated entityName values.
    // mode:'insensitive' handles "FC Barcelona" == "Fc Barcelona".
    const names = entityName.split(",").map((n) => n.trim()).filter(Boolean);
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
    const allSlugs = platform.split(",").filter(Boolean);
    const hasShorts = allSlugs.includes("youtube-shorts");
    const hasYoutube = allSlugs.includes("youtube");
    const realSlugs = hasShorts
      ? [...new Set([...allSlugs.filter((s) => s !== "youtube-shorts"), "youtube"])]
      : allSlugs;

    if (!hasShorts) {
      if (realSlugs.length === 1) where.platform = { slug: realSlugs[0] };
      else if (realSlugs.length > 1) where.platform = { slug: { in: realSlugs } };
    } else if (hasYoutube) {
      // Both Shorts and full YouTube → show all YouTube (+ any other selected platforms)
      if (realSlugs.length === 1) where.platform = { slug: realSlugs[0] };
      else if (realSlugs.length > 1) where.platform = { slug: { in: realSlugs } };
    } else {
      // Shorts only (no full YouTube), possibly with other platforms
      const nonYoutubeSlugs = realSlugs.filter((s) => s !== "youtube");
      const shortsUrlCondition = {
        OR: [
          { canonicalUrl: { contains: "/shorts/" } },
          { embedUrl: { contains: "/shorts/" } },
        ],
      };
      if (nonYoutubeSlugs.length === 0) {
        // Only Shorts selected
        where.platform = { slug: "youtube" };
        if (!where.AND) where.AND = [];
        where.AND.push(shortsUrlCondition);
      } else {
        // Shorts + other platforms (e.g., instagram + youtube-shorts)
        if (!where.AND) where.AND = [];
        where.AND.push({
          OR: [
            { platform: { slug: { in: nonYoutubeSlugs } } },
            { AND: [{ platform: { slug: "youtube" } }, shortsUrlCondition] },
          ],
        });
      }
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
      { competitions: { some: { competition: { name: { contains: search } } } } },
      { entityTypes: { some: { entityType: { name: { contains: search } } } } },
    ];
  }

  const include = {
    platform: true,
    sports: { include: { sport: true } },
    contentFormat: true,
    entityTypes: { include: { entityType: true } },
    competitions: { include: { competition: true } },
    classifications: { include: { classification: true } },
    savedBy: { where: { userId }, select: { id: true } },
  } as const;

  let publications;
  let total: number;

  if (order === "random") {
    const [allIds, countResult] = await Promise.all([
      prisma.publication.findMany({ where, select: { id: true } }),
      prisma.publication.count({ where }),
    ]);
    total = countResult;
    const seed = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    const shuffled = allIds
      .map((r, i) => ({ id: r.id, sort: Math.sin(seed + i) }))
      .sort((a, b) => a.sort - b.sort)
      .map((r) => r.id);
    const pageIds = shuffled.slice(skip, skip + limit);
    publications = await prisma.publication.findMany({
      where: { id: { in: pageIds } },
      include,
    });
    const idxMap = new Map(pageIds.map((id, i) => [id, i]));
    publications.sort((a, b) => (idxMap.get(a.id) ?? 0) - (idxMap.get(b.id) ?? 0));
  } else {
    const [pubs, countResult] = await Promise.all([
      prisma.publication.findMany({
        where,
        include,
        orderBy: { publishedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.publication.count({ where }),
    ]);
    publications = pubs;
    total = countResult;
  }

  const formatted = publications.map((pub) => ({
    id: pub.id,
    externalPostId: pub.externalPostId,
    canonicalUrl: pub.canonicalUrl,
    embedUrl: pub.embedUrl,
    originalUrl: pub.originalUrl,
    accountUsername: pub.accountUsername,
    publishedAt: pub.publishedAt,
    platform: pub.platform.name,
    sports: pub.sports.map((s) => s.sport.name),
    entityTypes: pub.entityTypes.map((e) => e.entityType.name),
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
