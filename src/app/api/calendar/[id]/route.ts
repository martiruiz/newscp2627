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

async function getOwnedItem(id: string, userId: string) {
  const item = await prisma.calendarItem.findUnique({ where: { id } });
  if (!item || item.userId !== userId) return null;
  return item;
}

async function getHubPhase(id: string): Promise<string | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<{ hubPhase: string | null }[]>(`SELECT hubPhase FROM "CalendarItem" WHERE id = ?`, id);
    return rows[0]?.hubPhase ?? null;
  } catch { return null; }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const item = await getOwnedItem(id, userId);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const hubPhase = await getHubPhase(id);
  return NextResponse.json({ ...parseItem(item), hubPhase });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const item = await getOwnedItem(id, userId);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { title, plannedDate, plannedTime, status, platforms, notes, referenceUrl,
    thumbnailUrl, creatorName, sport, contentFormat, collaborators, hook, script, cta } = body;

  const updated = await prisma.calendarItem.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: String(title).trim() }),
      ...(plannedDate !== undefined && { plannedDate }),
      ...(plannedTime !== undefined && { plannedTime: plannedTime || null }),
      ...(status !== undefined && { status }),
      ...(platforms !== undefined && { platforms: JSON.stringify(Array.isArray(platforms) ? platforms : []) }),
      ...(notes !== undefined && { notes: notes || null }),
      ...(referenceUrl !== undefined && { referenceUrl: referenceUrl || null }),
      ...(thumbnailUrl !== undefined && { thumbnailUrl: thumbnailUrl || null }),
      ...(creatorName !== undefined && { creatorName: creatorName || null }),
      ...(sport !== undefined && { sport: sport || null }),
      ...(contentFormat !== undefined && { contentFormat: contentFormat || null }),
      ...(collaborators !== undefined && { collaborators: JSON.stringify(Array.isArray(collaborators) ? collaborators : []) }),
      ...(hook !== undefined && { hook: hook || null }),
      ...(script !== undefined && { script: script || null }),
      ...(cta !== undefined && { cta: cta || null }),
    },
  });

  return NextResponse.json(parseItem(updated));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const item = await getOwnedItem(id, userId);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.calendarItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
