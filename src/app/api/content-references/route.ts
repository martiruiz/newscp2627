import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

// GET /api/content-references?calendarItemId=xxx
export async function GET(req: NextRequest) {
  await getCurrentUserId();
  const { searchParams } = new URL(req.url);
  const calendarItemId = searchParams.get("calendarItemId");
  if (!calendarItemId) return NextResponse.json({ error: "calendarItemId required" }, { status: 400 });

  const refs = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT cr.*, p.canonicalUrl, p.embedUrl, p.accountUsername, p.rawTitle,
            p.publishedAt, pf.name as platformName
     FROM "ContentReference" cr
     JOIN "Publication" p ON p.id = cr.publicationId
     LEFT JOIN "Platform" pf ON pf.id = p.platformId
     WHERE cr.calendarItemId = ?
     ORDER BY cr.createdAt DESC`,
    calendarItemId
  );
  return NextResponse.json(refs);
}

// POST /api/content-references
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  const { calendarItemId, publicationId, adaptationNote } = await req.json();

  if (!calendarItemId) return NextResponse.json({ error: "calendarItemId required" }, { status: 400 });
  if (!publicationId) return NextResponse.json({ error: "publicationId required" }, { status: 400 });

  // Ensure the calendar item belongs to this user
  const items = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "CalendarItem" WHERE id = ? AND userId = ?`, calendarItemId, userId
  );
  if (!items[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Upsert (ignore duplicate)
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ContentReference" (id, calendarItemId, publicationId, adaptationNote, createdAt)
       VALUES (?, ?, ?, ?, ?)`,
      id, calendarItemId, publicationId, adaptationNote || null, now
    );
  } catch {
    // duplicate — just return existing
  }

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT cr.*, p.canonicalUrl, p.embedUrl, p.accountUsername, p.rawTitle,
            p.publishedAt, pf.name as platformName
     FROM "ContentReference" cr
     JOIN "Publication" p ON p.id = cr.publicationId
     LEFT JOIN "Platform" pf ON pf.id = p.platformId
     WHERE cr.calendarItemId = ? AND cr.publicationId = ?`,
    calendarItemId, publicationId
  );
  return NextResponse.json(rows[0] || { id, calendarItemId, publicationId }, { status: 201 });
}

// DELETE /api/content-references?id=xxx
export async function DELETE(req: NextRequest) {
  const userId = await getCurrentUserId();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Verify ownership via join
  await prisma.$executeRawUnsafe(
    `DELETE FROM "ContentReference" WHERE id = ?
     AND calendarItemId IN (SELECT id FROM "CalendarItem" WHERE userId = ?)`,
    id, userId
  );
  return NextResponse.json({ ok: true });
}
