import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Distinct usernames for autocomplete
  if (searchParams.has("distinctUsernames")) {
    const rows = await prisma.publication.findMany({
      where: { accountUsername: { not: null } },
      select: { accountUsername: true },
      distinct: ["accountUsername"],
      orderBy: { accountUsername: "asc" },
    });
    return NextResponse.json({
      usernames: rows.map((r) => r.accountUsername).filter(Boolean),
    });
  }

  // Single item fetch
  const singleId = searchParams.get("id");
  if (singleId && !searchParams.has("page")) {
    const pub = await prisma.publication.findUnique({
      where: { id: singleId },
      include: {
        platform: { select: { id: true, name: true } },
        sports: { include: { sport: { select: { id: true, name: true } } } },
        contentFormat: { select: { id: true, name: true } },
        entityTypes: { include: { entityType: { select: { id: true, name: true } } } },
        competitions: { include: { competition: { select: { id: true, name: true } } } },
        classifications: { include: { classification: { select: { id: true, name: true } } } },
        contentCategories: { include: { contentCategory: { select: { id: true, name: true } } } },
      },
    });
    if (!pub) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      id: pub.id,
      externalPostId: pub.externalPostId,
      rawTitle: pub.rawTitle,
      publishedAt: pub.publishedAt,
      embedUrl: pub.embedUrl,
      canonicalUrl: pub.canonicalUrl,
      originalUrl: pub.originalUrl,
      accountUsername: pub.accountUsername,
      platformId: pub.platformId,
      platform: pub.platform.name,
      sportId: pub.sports[0]?.sport.id ?? null,
      sportIds: pub.sports.map((s) => s.sport.id),
      sports: pub.sports.map((s) => s.sport.name),
      entityTypeId: pub.entityTypes[0]?.entityType.id ?? null,
      entityTypeIds: pub.entityTypes.map((e) => e.entityType.id),
      entityTypes: pub.entityTypes.map((e) => e.entityType.name),
      entityName: pub.entityName,
      contentFormatId: pub.contentFormatId,
      format: pub.contentFormat?.name ?? null,
      competitions: pub.competitions.map((c) => ({ id: c.competition.id, name: c.competition.name })),
      classifications: pub.classifications.map((c) => ({ id: c.classification.id, name: c.classification.name })),
      contentCategories: pub.contentCategories.map((c) => ({ id: c.contentCategory.id, name: c.contentCategory.name })),
      reviewStatus: pub.reviewStatus,
      reviewedAt: pub.reviewedAt,
      importStatus: pub.importStatus,
      importError: pub.importError,
      createdAt: pub.createdAt,
    });
  }

  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const sport = searchParams.get("sport");
  const entity = searchParams.get("entity");
  const competition = searchParams.get("competition");
  const club = searchParams.get("club");
  const format = searchParams.get("format");
  const platform = searchParams.get("platform");
  const search = searchParams.get("search");
  const externalId = searchParams.get("externalId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const createdAfter = searchParams.get("createdAfter");
  const incompleteOnly = searchParams.get("incomplete") === "1";
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  function multiSlug(raw: string) {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (sport) {
    const slugs = multiSlug(sport);
    where.sports = { some: { sport: slugs.length === 1 ? { slug: slugs[0] } : { slug: { in: slugs } } } };
  }
  if (entity) {
    const slugs = multiSlug(entity);
    where.entityTypes = { some: { entityType: slugs.length === 1 ? { slug: slugs[0] } : { slug: { in: slugs } } } };
  }
  if (competition) {
    const slugs = multiSlug(competition);
    where.competitions = slugs.length === 1
      ? { some: { competition: { slug: slugs[0] } } }
      : { some: { competition: { slug: { in: slugs } } } };
  }
  if (club) {
    const clubs = club.split(",").map((s) => s.trim()).filter(Boolean);
    where.entityName = clubs.length === 1 ? clubs[0] : { in: clubs };
  }
  if (format) {
    const slugs = multiSlug(format);
    where.contentFormat = slugs.length === 1 ? { slug: slugs[0] } : { slug: { in: slugs } };
  }
  if (platform) {
    const slugs = multiSlug(platform);
    where.platform = slugs.length === 1 ? { slug: slugs[0] } : { slug: { in: slugs } };
  }
  if (externalId) where.externalPostId = { contains: externalId };

  if (search) {
    where.OR = [
      { rawTitle: { contains: search } },
      { accountUsername: { contains: search } },
      { entityName: { contains: search } },
    ];
  }

  if (dateFrom || dateTo) {
    where.publishedAt = {};
    if (dateFrom) where.publishedAt.gte = new Date(dateFrom);
    if (dateTo) where.publishedAt.lte = new Date(dateTo + "T23:59:59Z");
  }

  if (createdAfter) {
    where.createdAt = { gte: new Date(createdAfter) };
  }

  if (incompleteOnly) {
    where.OR = [
      { sports: { none: {} } },
      { accountUsername: null },
      { entityName: null },
    ];
  }

  const [publications, total] = await Promise.all([
    prisma.publication.findMany({
      where,
      include: {
        platform: { select: { name: true } },
        sports: { include: { sport: { select: { name: true } } } },
        contentFormat: { select: { name: true } },
        entityTypes: { include: { entityType: { select: { name: true } } } },
        competitions: { include: { competition: { select: { name: true } } } },
        classifications: { include: { classification: { select: { id: true, name: true, slug: true } } } },
      },
      orderBy: { publishedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.publication.count({ where }),
  ]);

  return NextResponse.json({
    publications: publications.map((p) => ({
      id: p.id,
      externalPostId: p.externalPostId,
      rawTitle: p.rawTitle,
      publishedAt: p.publishedAt,
      platform: p.platform.name,
      sport: p.sports[0]?.sport.name ?? null,
      entity: p.entityTypes[0]?.entityType.name ?? null,
      entityName: p.entityName,
      accountUsername: p.accountUsername,
      format: p.contentFormat?.name ?? null,
      competitions: p.competitions.map((c) => c.competition.name),
      canonicalUrl: p.canonicalUrl,
      embedUrl: p.embedUrl,
      originalUrl: p.originalUrl,
      classificationIds: p.classifications.map((c) => c.classification.id),
      classificationSlugs: p.classifications.map((c) => c.classification.slug),
      reviewStatus: p.reviewStatus,
      importStatus: p.importStatus,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    externalPostId, canonicalUrl, embedUrl, originalUrl,
    platformId, sportIds = [], entityTypeIds = [], contentFormatId,
    entityName, accountUsername, rawTitle, publishedAt,
    competitionIds = [], classificationIds = [], contentCategoryIds = [],
  } = body;

  if (!externalPostId || !canonicalUrl || !platformId) {
    return NextResponse.json({ error: "Missing required fields: externalPostId, canonicalUrl, platformId" }, { status: 400 });
  }

  const pub = await prisma.publication.create({
    data: {
      externalPostId: String(externalPostId),
      canonicalUrl,
      embedUrl: embedUrl || canonicalUrl,
      originalUrl: originalUrl || null,
      platformId,
      contentFormatId: contentFormatId || null,
      entityName: entityName?.trim() || null,
      accountUsername: accountUsername?.trim() || null,
      rawTitle: rawTitle?.trim() || null,
      publishedAt: publishedAt ? new Date(publishedAt) : null,
    },
  });

  if (sportIds.length > 0) {
    await prisma.publicationSport.createMany({
      data: sportIds.map((sId: string) => ({ publicationId: pub.id, sportId: sId })),
    });
  }
  if (entityTypeIds.length > 0) {
    await prisma.publicationEntityType.createMany({
      data: entityTypeIds.map((eId: string) => ({ publicationId: pub.id, entityTypeId: eId })),
    });
  }
  if (competitionIds.length > 0) {
    await prisma.publicationCompetition.createMany({
      data: competitionIds.map((cId: string) => ({ publicationId: pub.id, competitionId: cId })),
    });
  }
  if (classificationIds.length > 0) {
    await prisma.publicationClassification.createMany({
      data: classificationIds.map((cId: string) => ({ publicationId: pub.id, classificationId: cId })),
    });
  }
  if (contentCategoryIds.length > 0) {
    await prisma.publicationContentCategory.createMany({
      data: contentCategoryIds.map((cId: string) => ({ publicationId: pub.id, contentCategoryId: cId })),
    });
  }

  return NextResponse.json({ id: pub.id });
}

export async function PATCH(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const body = await request.json();

  // ── Bulk update ──────────────────────────────────────────────────────────
  if (searchParams.get("bulk") === "true") {
    const {
      ids,
      // scalar fields (only sent if explicitly selected)
      entityName, accountUsername, contentFormatId, platformId,
      sportIds,        // string[] | undefined — replaces sports for all selected
      entityTypeIds,   // string[] | undefined
      competitionIds,  // string[] | undefined
      // classification bulk
      classificationAction,  // "add" | "remove" — never "set" for bulk
      classificationIds: classIds,
      // review
      reviewStatus,
      // archive
      archived,
    } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Missing ids" }, { status: 400 });
    }

    // Process in batches of 50 to avoid SQLite lock issues
    const BATCH = 50;
    let done = 0;
    const errors: { id: string; error: string }[] = [];

    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH);

      await prisma.$transaction(async (tx) => {
        // Scalar fields
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = {};
        if ("entityName" in body) data.entityName = typeof entityName === "string" ? (entityName.trim() || null) : null;
        if ("accountUsername" in body) data.accountUsername = typeof accountUsername === "string" ? (accountUsername.trim() || null) : null;
        if ("contentFormatId" in body) data.contentFormatId = contentFormatId || null;
        if ("platformId" in body) data.platformId = platformId || null;
        if ("reviewStatus" in body) { data.reviewStatus = reviewStatus; data.reviewedAt = new Date(); }
        if ("archived" in body) data.archivedAt = archived ? new Date() : null;

        if (Object.keys(data).length > 0) {
          await tx.publication.updateMany({ where: { id: { in: batch } }, data });
        }

        // Sports (replace)
        if (Array.isArray(sportIds)) {
          await tx.publicationSport.deleteMany({ where: { publicationId: { in: batch } } });
          if (sportIds.length > 0) {
            await tx.publicationSport.createMany({
              data: batch.flatMap((pid) => sportIds.map((sid: string) => ({ publicationId: pid, sportId: sid }))),
              skipDuplicates: true,
            });
          }
        }

        // Entity types (replace)
        if (Array.isArray(entityTypeIds)) {
          await tx.publicationEntityType.deleteMany({ where: { publicationId: { in: batch } } });
          if (entityTypeIds.length > 0) {
            await tx.publicationEntityType.createMany({
              data: batch.flatMap((pid) => entityTypeIds.map((eid: string) => ({ publicationId: pid, entityTypeId: eid }))),
              skipDuplicates: true,
            });
          }
        }

        // Competitions (replace)
        if (Array.isArray(competitionIds)) {
          await tx.publicationCompetition.deleteMany({ where: { publicationId: { in: batch } } });
          if (competitionIds.length > 0) {
            await tx.publicationCompetition.createMany({
              data: batch.flatMap((pid) => competitionIds.map((cid: string) => ({ publicationId: pid, competitionId: cid }))),
              skipDuplicates: true,
            });
          }
        }

        // Classifications — add or remove (never full replace in bulk)
        if (classificationAction === "add" && Array.isArray(classIds) && classIds.length > 0) {
          await tx.publicationClassification.createMany({
            data: batch.flatMap((pid) => classIds.map((cid: string) => ({ publicationId: pid, classificationId: cid }))),
            skipDuplicates: true,
          });
        } else if (classificationAction === "remove" && Array.isArray(classIds) && classIds.length > 0) {
          await tx.publicationClassification.deleteMany({
            where: { publicationId: { in: batch }, classificationId: { in: classIds } },
          });
        }
      }).then(() => { done += batch.length; })
        .catch((e) => { batch.forEach((bid) => errors.push({ id: bid, error: (e as Error).message })); });
    }

    return NextResponse.json({
      ok: errors.length === 0,
      done,
      total: ids.length,
      errors: errors.slice(0, 20),
    });
  }

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const { sportIds, entityTypeIds, contentFormatId, platformId, entityName, rawTitle, publishedAt, competitionIds, classificationIds, contentCategoryIds, accountUsername } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if ("contentFormatId" in body) data.contentFormatId = contentFormatId || null;
  if ("platformId" in body) data.platformId = platformId;
  if ("entityName" in body) data.entityName = entityName?.trim() || null;
  if ("rawTitle" in body) data.rawTitle = rawTitle?.trim() || null;
  if ("publishedAt" in body) data.publishedAt = publishedAt ? new Date(publishedAt) : null;
  if ("accountUsername" in body) data.accountUsername = accountUsername?.trim() || null;

  await prisma.publication.update({ where: { id }, data });

  if (Array.isArray(sportIds)) {
    await prisma.publicationSport.deleteMany({ where: { publicationId: id } });
    if (sportIds.length > 0) {
      await prisma.publicationSport.createMany({
        data: sportIds.map((sId: string) => ({ publicationId: id, sportId: sId })),
      });
    }
  }

  if (Array.isArray(entityTypeIds)) {
    await prisma.publicationEntityType.deleteMany({ where: { publicationId: id } });
    if (entityTypeIds.length > 0) {
      await prisma.publicationEntityType.createMany({
        data: entityTypeIds.map((eId: string) => ({ publicationId: id, entityTypeId: eId })),
      });
    }
  }

  if (Array.isArray(competitionIds)) {
    await prisma.publicationCompetition.deleteMany({ where: { publicationId: id } });
    if (competitionIds.length > 0) {
      await prisma.publicationCompetition.createMany({
        data: competitionIds.map((cId: string) => ({ publicationId: id, competitionId: cId })),
      });
    }
  }

  if (Array.isArray(classificationIds)) {
    await prisma.publicationClassification.deleteMany({ where: { publicationId: id } });
    if (classificationIds.length > 0) {
      await prisma.publicationClassification.createMany({
        data: classificationIds.map((cId: string) => ({ publicationId: id, classificationId: cId })),
      });
    }
  }

  if (Array.isArray(contentCategoryIds)) {
    await prisma.publicationContentCategory.deleteMany({ where: { publicationId: id } });
    if (contentCategoryIds.length > 0) {
      await prisma.publicationContentCategory.createMany({
        data: contentCategoryIds.map((cId: string) => ({ publicationId: id, contentCategoryId: cId })),
      });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await prisma.publication.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
