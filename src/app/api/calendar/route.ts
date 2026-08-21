import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

function parseItem(item: {
  id: string; userId: string; sourceContentId: string | null;
  sourceType: string; title: string; plannedDate: string; plannedTime: string | null;
  status: string; platforms: string; notes: string | null; referenceUrl: string | null;
  thumbnailUrl: string | null; creatorName: string | null; sport: string | null;
  contentFormat: string | null; collaborators: string;
  hook: string | null; script: string | null; cta: string | null;
  createdAt: Date; updatedAt: Date;
}) {
  return {
    ...item,
    platforms: JSON.parse(item.platforms || "[]"),
    collaborators: JSON.parse(item.collaborators || "[]"),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const status = searchParams.get("status");
  const platform = searchParams.get("platform");

  const planId = searchParams.get("planId");
  const where: Record<string, unknown> = { userId };
  if (from) where.plannedDate = { gte: from };
  if (from && to) where.plannedDate = { gte: from, lte: to };
  if (status) where.status = status;
  if (planId) where.planId = planId;

  const items = await prisma.calendarItem.findMany({
    where,
    orderBy: [{ plannedDate: "asc" }, { plannedTime: "asc" }],
  });

  let parsed = items.map(parseItem);
  if (platform) {
    parsed = parsed.filter((i) => i.platforms.includes(platform));
  }

  // Enrich with hubPhase (not in cached Prisma client)
  if (parsed.length > 0) {
    try {
      const ids = parsed.map((i) => `'${i.id.replace(/'/g, "''")}'`).join(",");
      const rows = await prisma.$queryRawUnsafe<{ id: string; hubPhase: string | null }[]>(
        `SELECT id, hubPhase FROM "CalendarItem" WHERE id IN (${ids})`
      );
      const hubPhaseMap: Record<string, string | null> = {};
      for (const r of rows) hubPhaseMap[r.id] = r.hubPhase;
      parsed = parsed.map((i) => ({ ...i, hubPhase: hubPhaseMap[i.id] ?? null }));
    } catch { /* non-critical */ }
  }

  return NextResponse.json(parsed);
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  const body = await req.json();

  const { title, plannedDate, plannedTime, status, platforms, notes, referenceUrl,
    thumbnailUrl, creatorName, sport, contentFormat, sourceContentId, sourceType,
    collaborators, hook, script, cta, planId, phaseId, hubPhase } = body;

  if (!title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });
  if (!plannedDate) return NextResponse.json({ error: "Date required" }, { status: 400 });

  const item = await prisma.calendarItem.create({
    data: {
      userId,
      title: title.trim(),
      plannedDate,
      plannedTime: plannedTime || null,
      status: status || "planned",
      platforms: JSON.stringify(Array.isArray(platforms) ? platforms : []),
      notes: notes || null,
      referenceUrl: referenceUrl || null,
      thumbnailUrl: thumbnailUrl || null,
      creatorName: creatorName || null,
      sport: sport || null,
      contentFormat: contentFormat || null,
      sourceContentId: sourceContentId || null,
      sourceType: sourceType || "custom",
      collaborators: JSON.stringify(Array.isArray(collaborators) ? collaborators : []),
      hook: hook || null,
      script: script || null,
      cta: cta || null,
      planId: planId || null,
      phaseId: phaseId || null,
    },
  });

  // Set hubPhase via raw SQL (field may not be in cached Prisma client)
  if (hubPhase) {
    try {
      await prisma.$executeRawUnsafe(`UPDATE "CalendarItem" SET "hubPhase" = ? WHERE id = ?`, hubPhase, item.id);
    } catch { /* non-critical */ }
  }

  const result = { ...parseItem(item), hubPhase: hubPhase || null };
  return NextResponse.json(result, { status: 201 });
}
