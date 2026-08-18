import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function startOf(unit: "day" | "week" | "month"): Date {
  const d = new Date();
  if (unit === "day") {
    d.setHours(0, 0, 0, 0);
  } else if (unit === "week") {
    const day = d.getDay();
    d.setDate(d.getDate() - ((day + 6) % 7));
    d.setHours(0, 0, 0, 0);
  } else {
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
  }
  return d;
}

export async function GET() {
  const now = new Date();
  const todayStart = startOf("day");
  const weekStart = startOf("week");
  const monthStart = startOf("month");
  const daysAgo7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalPublications,
    importedToday,
    importedWeek,
    importedMonth,
    withErrors,
    incomplete,
    importBatches,
    byPlatform,
    bySport,
    classificationCounts,
    recentBatches,
    staleAccounts,
  ] = await Promise.all([
    // Total
    prisma.publication.count(),

    // Rows processed today / week / month (from ImportBatch, not just new publications)
    prisma.importBatch.aggregate({ where: { createdAt: { gte: todayStart } }, _sum: { importedRows: true, updatedRows: true, skippedRows: true } }),
    prisma.importBatch.aggregate({ where: { createdAt: { gte: weekStart } }, _sum: { importedRows: true, updatedRows: true, skippedRows: true } }),
    prisma.importBatch.aggregate({ where: { createdAt: { gte: monthStart } }, _sum: { importedRows: true, updatedRows: true, skippedRows: true } }),

    // With errors
    prisma.publication.count({
      where: { importStatus: "error" },
    }),

    // Incomplete: missing sport OR accountUsername OR entityName
    prisma.publication.count({
      where: {
        OR: [
          { sports: { none: {} } },
          { accountUsername: null },
          { entityName: null },
        ],
      },
    }),

    // Import batches summary
    prisma.importBatch.groupBy({
      by: ["status"],
      _count: { id: true },
    }),

    // Distribution by platform
    prisma.publication.groupBy({
      by: ["platformId"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),

    // Distribution by sport (top 10)
    prisma.publicationSport.groupBy({
      by: ["sportId"],
      _count: { publicationId: true },
      orderBy: { _count: { publicationId: "desc" } },
      take: 10,
    }),

    // Classification counts (Top Picks, Replicable, Overperforming)
    prisma.publicationClassification.groupBy({
      by: ["classificationId"],
      _count: { publicationId: true },
    }),

    // Last 8 import batches
    prisma.importBatch.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        filename: true,
        status: true,
        importedRows: true,
        updatedRows: true,
        skippedRows: true,
        invalidRows: true,
        failedRows: true,
        totalRows: true,
        createdAt: true,
        completedAt: true,
        processingTime: true,
      },
    }),

    // Stale accounts: accounts with publications but none in last 7 days
    prisma.$queryRaw<{ accountUsername: string; lastPub: Date; total: bigint }[]>`
      SELECT p."accountUsername", MAX(p."publishedAt") as "lastPub", COUNT(*) as total
      FROM "Publication" p
      WHERE p."accountUsername" IS NOT NULL
      GROUP BY p."accountUsername"
      HAVING MAX(p."publishedAt") < ${daysAgo7}
      ORDER BY "lastPub" ASC
      LIMIT 10
    `,
  ]);

  // Resolve platform names
  const platformIds = byPlatform.map((p) => p.platformId);
  const platforms = await prisma.platform.findMany({
    where: { id: { in: platformIds } },
    select: { id: true, name: true },
  });
  const platformMap = new Map(platforms.map((p) => [p.id, p.name]));

  // Resolve sport names
  const sportIds = bySport.map((s) => s.sportId);
  const sports = await prisma.sport.findMany({
    where: { id: { in: sportIds } },
    select: { id: true, name: true },
  });
  const sportMap = new Map(sports.map((s) => [s.id, s.name]));

  // Resolve classification names
  const classIds = classificationCounts.map((c) => c.classificationId);
  const classifications = await prisma.classification.findMany({
    where: { id: { in: classIds } },
    select: { id: true, name: true, slug: true },
  });
  const classMap = new Map(classifications.map((c) => [c.id, c]));

  // Import batch status map
  const batchStatusMap: Record<string, number> = {};
  for (const b of importBatches) {
    batchStatusMap[b.status] = b._count.id;
  }

  return NextResponse.json({
    totalPublications,
    ingestion: {
      today: (importedToday._sum.importedRows ?? 0) + (importedToday._sum.updatedRows ?? 0) + (importedToday._sum.skippedRows ?? 0),
      week: (importedWeek._sum.importedRows ?? 0) + (importedWeek._sum.updatedRows ?? 0) + (importedWeek._sum.skippedRows ?? 0),
      month: (importedMonth._sum.importedRows ?? 0) + (importedMonth._sum.updatedRows ?? 0) + (importedMonth._sum.skippedRows ?? 0),
    },
    quality: {
      withErrors,
      incomplete,
    },
    importBatches: {
      active: batchStatusMap["processing"] ?? 0,
      completed: batchStatusMap["completed"] ?? 0,
      failed: batchStatusMap["failed"] ?? 0,
    },
    byPlatform: byPlatform.map((p) => ({
      name: platformMap.get(p.platformId) ?? p.platformId,
      count: p._count.id,
    })),
    bySport: bySport.map((s) => ({
      name: sportMap.get(s.sportId) ?? s.sportId,
      count: s._count.publicationId,
    })),
    classifications: classificationCounts.map((c) => ({
      name: classMap.get(c.classificationId)?.name ?? c.classificationId,
      slug: classMap.get(c.classificationId)?.slug ?? "",
      count: c._count.publicationId,
    })),
    recentBatches,
    staleAccounts: staleAccounts.map((a) => ({
      username: a.accountUsername,
      lastPub: a.lastPub,
      total: Number(a.total),
    })),
  });
}
