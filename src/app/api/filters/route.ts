import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function slugArray(value: string | null): string[] {
  if (!value) return [];
  return value.split(",").filter(Boolean);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildWhere(params: Record<string, string[]>): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  const { sport, competition, entityType, format, platform, classification, contentCategory } = params;

  if (sport?.length) {
    where.sport = sport.length === 1 ? { slug: sport[0] } : { slug: { in: sport } };
  }
  if (competition?.length) {
    where.competitions = {
      some: {
        competition: competition.length === 1
          ? { slug: competition[0] }
          : { slug: { in: competition } },
      },
    };
  }
  if (entityType?.length) {
    where.entityType = entityType.length === 1 ? { slug: entityType[0] } : { slug: { in: entityType } };
  }
  if (format?.length) {
    where.contentFormat = format.length === 1 ? { slug: format[0] } : { slug: { in: format } };
  }
  if (platform?.length) {
    where.platform = platform.length === 1 ? { slug: platform[0] } : { slug: { in: platform } };
  }
  if (classification?.length) {
    where.classifications = { some: { classification: classification.length === 1 ? { slug: classification[0] } : { slug: { in: classification } } } };
  }
  if (contentCategory?.length) {
    where.contentCategories = { some: { contentCategory: contentCategory.length === 1 ? { slug: contentCategory[0] } : { slug: { in: contentCategory } } } };
  }
  return where;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const allParams = {
    sport: slugArray(searchParams.get("sport")),
    competition: slugArray(searchParams.get("competition")),
    entityType: slugArray(searchParams.get("entityType")),
    format: slugArray(searchParams.get("format")),
    platform: slugArray(searchParams.get("platform")),
    classification: slugArray(searchParams.get("classification")),
    contentCategory: slugArray(searchParams.get("contentCategory")),
  };

  const hasFilters = Object.values(allParams).some((v) => v.length > 0);

  const HAS_PUBS = { publications: { some: {} } } as const;

  if (!hasFilters) {
    const [sports, entityTypes, formats, platforms, classifications, contentCategories, competitions, rawClubs] = await Promise.all([
      prisma.sport.findMany({ where: HAS_PUBS, orderBy: { name: "asc" }, include: { _count: { select: { publications: true } } } }),
      prisma.entityType.findMany({ where: HAS_PUBS, orderBy: { name: "asc" }, include: { _count: { select: { publications: true } } } }),
      prisma.contentFormat.findMany({ where: HAS_PUBS, orderBy: { name: "asc" }, include: { _count: { select: { publications: true } } } }),
      prisma.platform.findMany({ where: HAS_PUBS, orderBy: { name: "asc" }, include: { _count: { select: { publications: true } } } }),
      prisma.classification.findMany({ where: { publications: { some: {} } }, orderBy: { name: "asc" }, include: { _count: { select: { publications: true } } } }),
      prisma.contentCategory.findMany({ where: { publications: { some: {} } }, orderBy: { name: "asc" }, include: { _count: { select: { publications: true } } } }),
      prisma.competition.findMany({ where: { publications: { some: {} } }, orderBy: { name: "asc" }, include: { _count: { select: { publications: true } } } }),
      prisma.publication.groupBy({
        by: ["entityName"],
        where: { entityType: { slug: "clubs" }, entityName: { not: null } },
        _count: true,
        orderBy: { _count: { entityName: "desc" } },
      }),
    ]);

    const entityNames = await prisma.publication.groupBy({
      by: ["entityName"],
      where: { entityName: { not: null } },
      _count: true,
      orderBy: { _count: { entityName: "desc" } },
    });

    return NextResponse.json({
      sports: sports.map((s) => ({ name: s.name, slug: s.slug, count: s._count.publications })),
      entityTypes: entityTypes.map((e) => ({ name: e.name, slug: e.slug, count: e._count.publications })),
      formats: formats.map((f) => ({ name: f.name, slug: f.slug, count: f._count.publications })),
      platforms: platforms.map((p) => ({ name: p.name, slug: p.slug, count: p._count.publications })),
      classifications: classifications.map((c) => ({ name: c.name, slug: c.slug, count: c._count.publications })),
      contentCategories: contentCategories.map((c) => ({ name: c.name, slug: c.slug, count: c._count.publications })),
      competitions: competitions.map((c) => ({ name: c.name, slug: c.slug, count: c._count.publications })),
      clubs: rawClubs.filter((c) => c.entityName).map((c) => ({ name: c.entityName!, count: c._count })),
      entityNames: entityNames.filter((e) => e.entityName).map((e) => ({ name: e.entityName!, count: e._count })),
    });
  }

  // Contextual counts: for each facet, count with all OTHER filters applied (exclude own dimension)
  const withoutSport = buildWhere({ ...allParams, sport: [] });
  const withoutCompetition = buildWhere({ ...allParams, competition: [] });
  const withoutEntityType = buildWhere({ ...allParams, entityType: [] });
  const withoutFormat = buildWhere({ ...allParams, format: [] });
  const withoutPlatform = buildWhere({ ...allParams, platform: [] });
  const withoutClassification = buildWhere({ ...allParams, classification: [] });
  const withoutContentCategory = buildWhere({ ...allParams, contentCategory: [] });
  const fullWhere = buildWhere(allParams);

  const [allSports, allEntityTypes, allFormats, allPlatforms, allClassifications, allContentCategories, allCompetitions] = await Promise.all([
    prisma.sport.findMany({ where: HAS_PUBS, orderBy: { name: "asc" }, select: { name: true, slug: true } }),
    prisma.entityType.findMany({ where: HAS_PUBS, orderBy: { name: "asc" }, select: { name: true, slug: true } }),
    prisma.contentFormat.findMany({ where: HAS_PUBS, orderBy: { name: "asc" }, select: { name: true, slug: true } }),
    prisma.platform.findMany({ where: HAS_PUBS, orderBy: { name: "asc" }, select: { name: true, slug: true } }),
    prisma.classification.findMany({ where: { publications: { some: {} } }, orderBy: { name: "asc" }, select: { name: true, slug: true } }),
    prisma.contentCategory.findMany({ where: { publications: { some: {} } }, orderBy: { name: "asc" }, select: { name: true, slug: true } }),
    prisma.competition.findMany({ where: { publications: { some: {} } }, orderBy: { name: "asc" }, select: { name: true, slug: true } }),
  ]);

  const [sportCounts, entityTypeCounts, formatCounts, platformCounts, classificationCounts, entityNames] = await Promise.all([
    prisma.publication.groupBy({ by: ["sportId"], where: withoutSport, _count: true }),
    prisma.publication.groupBy({ by: ["entityTypeId"], where: withoutEntityType, _count: true }),
    prisma.publication.groupBy({ by: ["contentFormatId"], where: withoutFormat, _count: true }),
    prisma.publication.groupBy({ by: ["platformId"], where: withoutPlatform, _count: true }),
    prisma.publication.findMany({
      where: withoutClassification,
      select: { classifications: { select: { classification: { select: { slug: true } } } } },
    }),
    prisma.publication.groupBy({
      by: ["entityName"],
      where: { ...fullWhere, entityName: { not: null } },
      _count: true,
      orderBy: { _count: { entityName: "desc" } },
    }),
  ]);

  // Competition contextual counts (based on all filters except competition itself)
  const pubsForCompetitions = await prisma.publication.findMany({
    where: withoutCompetition,
    select: { competitions: { select: { competition: { select: { slug: true } } } } },
  });
  const competitionCountMap = new Map<string, number>();
  for (const pub of pubsForCompetitions) {
    for (const pc of pub.competitions) {
      competitionCountMap.set(pc.competition.slug, (competitionCountMap.get(pc.competition.slug) || 0) + 1);
    }
  }

  // Clubs contextual counts (based on all filters, restricted to clubs entityType)
  const baseForClubs = buildWhere({ ...allParams, entityType: [] });
  const clubCounts = await prisma.publication.groupBy({
    by: ["entityName"],
    where: { ...baseForClubs, entityType: { slug: "clubs" }, entityName: { not: null } },
    _count: true,
    orderBy: { _count: { entityName: "desc" } },
  });

  const sportIdMap = await prisma.sport.findMany({ select: { id: true, slug: true } });
  const entityTypeIdMap = await prisma.entityType.findMany({ select: { id: true, slug: true } });
  const formatIdMap = await prisma.contentFormat.findMany({ select: { id: true, slug: true } });
  const platformIdMap = await prisma.platform.findMany({ select: { id: true, slug: true } });

  const sportCountMap = new Map(sportCounts.map((s) => {
    const match = sportIdMap.find((m) => m.id === s.sportId);
    return [match?.slug, s._count] as const;
  }));
  const entityTypeCountMap = new Map(entityTypeCounts.map((e) => {
    const match = entityTypeIdMap.find((m) => m.id === e.entityTypeId);
    return [match?.slug, e._count] as const;
  }));
  const formatCountMap = new Map(formatCounts.map((f) => {
    const match = formatIdMap.find((m) => m.id === f.contentFormatId);
    return [match?.slug, f._count] as const;
  }));
  const platformCountMap = new Map(platformCounts.map((p) => {
    const match = platformIdMap.find((m) => m.id === p.platformId);
    return [match?.slug, p._count] as const;
  }));

  const classCountMap = new Map<string, number>();
  for (const pub of classificationCounts) {
    for (const c of pub.classifications) {
      classCountMap.set(c.classification.slug, (classCountMap.get(c.classification.slug) || 0) + 1);
    }
  }

  const contentCatCounts = await prisma.publication.findMany({
    where: buildWhere({ ...allParams, contentCategory: [] }),
    select: { contentCategories: { select: { contentCategory: { select: { slug: true } } } } },
  });
  const catCountMap = new Map<string, number>();
  for (const pub of contentCatCounts) {
    for (const c of pub.contentCategories) {
      catCountMap.set(c.contentCategory.slug, (catCountMap.get(c.contentCategory.slug) || 0) + 1);
    }
  }

  return NextResponse.json({
    sports: allSports.map((s) => ({ name: s.name, slug: s.slug, count: sportCountMap.get(s.slug) || 0 })),
    entityTypes: allEntityTypes.map((e) => ({ name: e.name, slug: e.slug, count: entityTypeCountMap.get(e.slug) || 0 })),
    formats: allFormats.map((f) => ({ name: f.name, slug: f.slug, count: formatCountMap.get(f.slug) || 0 })),
    platforms: allPlatforms.map((p) => ({ name: p.name, slug: p.slug, count: platformCountMap.get(p.slug) || 0 })),
    classifications: allClassifications.map((c) => ({ name: c.name, slug: c.slug, count: classCountMap.get(c.slug) || 0 })),
    contentCategories: allContentCategories.map((c) => ({ name: c.name, slug: c.slug, count: catCountMap.get(c.slug) || 0 })),
    competitions: allCompetitions.map((c) => ({ name: c.name, slug: c.slug, count: competitionCountMap.get(c.slug) || 0 })),
    clubs: clubCounts.filter((c) => c.entityName).map((c) => ({ name: c.entityName!, count: c._count })),
    entityNames: entityNames.filter((e) => e.entityName).map((e) => ({ name: e.entityName!, count: e._count })),
  });
}
