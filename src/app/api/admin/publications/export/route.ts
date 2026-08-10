import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { ids } = await req.json() as { ids?: string[] };

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }

  // Max 1000 to avoid unbounded queries
  const safeIds = ids.slice(0, 1000);

  const pubs = await prisma.publication.findMany({
    where: { id: { in: safeIds } },
    select: {
      id: true,
      externalPostId: true,
      accountUsername: true,
      entityName: true,
      rawTitle: true,
      publishedAt: true,
      createdAt: true,
      canonicalUrl: true,
      originalUrl: true,
      reviewStatus: true,
      importStatus: true,
      platform: { select: { name: true } },
      sports: { select: { sport: { select: { name: true } } } },
      entityTypes: { select: { entityType: { select: { name: true } } } },
      contentFormat: { select: { name: true } },
      competitions: { select: { competition: { select: { name: true } } } },
      classifications: { select: { classification: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const header = [
    "id", "externalPostId", "platform", "accountUsername", "entityName",
    "rawTitle", "sport", "entityType", "format", "competitions", "classifications",
    "publishedAt", "createdAt", "canonicalUrl", "originalUrl",
    "reviewStatus", "importStatus",
  ];

  function esc(v: unknown): string {
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
  }

  const rows = pubs.map((p: typeof pubs[number]) => [
    p.id,
    p.externalPostId,
    p.platform.name,
    p.accountUsername ?? "",
    p.entityName ?? "",
    p.rawTitle ?? "",
    p.sports.map((s: { sport: { name: string } }) => s.sport.name).join("|"),
    p.entityTypes.map((e: { entityType: { name: string } }) => e.entityType.name).join("|"),
    p.contentFormat?.name ?? "",
    p.competitions.map((c: { competition: { name: string } }) => c.competition.name).join("|"),
    p.classifications.map((c: { classification: { name: string } }) => c.classification.name).join("|"),
    p.publishedAt?.toISOString() ?? "",
    p.createdAt.toISOString(),
    p.canonicalUrl,
    p.originalUrl ?? "",
    p.reviewStatus ?? "legacy",
    p.importStatus ?? "",
  ].map(esc).join(","));

  const csv = [header.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="scp-export-${new Date().toISOString().slice(0,10)}.csv"`,
    },
  });
}
