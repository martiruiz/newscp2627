import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM "Fixture" WHERE id = ? AND userId = ?`, id, userId
  );
  if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(rows[0]);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const body = await req.json();

  const allowed = ["sport","homeTeam","awayTeam","homeCrest","awayCrest","competition","matchday","venue","kickoffAt","timezone","durationMin","status","homeScore","awayScore","notes"];
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const key of allowed) {
    if (key in body) { sets.push(`"${key}" = ?`); vals.push(body[key]); }
  }
  if (!sets.length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  sets.push(`"updatedAt" = ?`);
  vals.push(new Date().toISOString(), id, userId);

  await prisma.$executeRawUnsafe(
    `UPDATE "Fixture" SET ${sets.join(", ")} WHERE id = ? AND userId = ?`,
    ...vals
  );

  // Propagate kickoff change to all linked plans
  if ("kickoffAt" in body || "homeTeam" in body || "awayTeam" in body) {
    const plans = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "ContentPlan" WHERE fixtureId = ?`, id
    );
    for (const plan of plans) {
      if ("kickoffAt" in body && body.kickoffAt) {
        const d = body.kickoffAt.slice(0, 10);
        await prisma.$executeRawUnsafe(
          `UPDATE "ContentPlan" SET startDate = ?, endDate = ?, eventStartAt = ?, updatedAt = ? WHERE id = ?`,
          d, d, body.kickoffAt, new Date().toISOString(), plan.id
        );
      }
      if ("homeTeam" in body || "awayTeam" in body) {
        const home = body.homeTeam;
        const away = body.awayTeam;
        const updates: string[] = [];
        const uvals: unknown[] = [];
        if (home !== undefined) { updates.push(`team = ?`); uvals.push(home); }
        if (away !== undefined) { updates.push(`opponent = ?`); uvals.push(away); }
        if (updates.length) {
          uvals.push(new Date().toISOString(), plan.id);
          await prisma.$executeRawUnsafe(
            `UPDATE "ContentPlan" SET ${updates.join(", ")}, updatedAt = ? WHERE id = ?`, ...uvals
          );
        }
      }
    }
  }

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM "Fixture" WHERE id = ?`, id
  );
  return NextResponse.json(rows[0]);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  await prisma.$executeRawUnsafe(
    `DELETE FROM "Fixture" WHERE id = ? AND userId = ?`, id, userId
  );
  return NextResponse.json({ ok: true });
}
