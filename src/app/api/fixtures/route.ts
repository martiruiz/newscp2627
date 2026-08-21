import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET() {
  const userId = await getCurrentUserId();
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM "Fixture" WHERE userId = ? ORDER BY kickoffAt ASC`,
    userId
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  const body = await req.json();
  const {
    sport, homeTeam, awayTeam, homeCrest, awayCrest,
    competition, matchday, venue, kickoffAt, timezone,
    durationMin, status, notes,
  } = body;

  if (!homeTeam?.trim()) return NextResponse.json({ error: "homeTeam required" }, { status: 400 });
  if (!awayTeam?.trim()) return NextResponse.json({ error: "awayTeam required" }, { status: 400 });

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "Fixture" (id, userId, sport, homeTeam, awayTeam, homeCrest, awayCrest, competition, matchday, venue, kickoffAt, timezone, durationMin, status, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, userId,
    sport || null, homeTeam.trim(), awayTeam.trim(),
    homeCrest || null, awayCrest || null,
    competition || null, matchday || null, venue || null,
    kickoffAt || null, timezone || "Europe/Madrid",
    durationMin || null, status || "scheduled",
    notes || null, now, now
  );

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM "Fixture" WHERE id = ?`, id
  );
  return NextResponse.json(rows[0], { status: 201 });
}
