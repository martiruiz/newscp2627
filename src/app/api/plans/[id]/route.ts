import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

async function getOwnedPlan(id: string, userId: string) {
  const plan = await prisma.contentPlan.findUnique({
    where: { id },
    include: {
      phases: { orderBy: { sortOrder: "asc" } },
      _count: { select: { items: true } },
    },
  });
  if (!plan || plan.userId !== userId) return null;
  return plan;
}

function serializePlan(plan: NonNullable<Awaited<ReturnType<typeof getOwnedPlan>>>, extra?: Record<string, unknown>) {
  return {
    ...plan,
    platforms: JSON.parse(plan.platforms || "[]"),
    contentPillars: JSON.parse(plan.contentPillars || "[]"),
    teamMembers: JSON.parse(((plan as unknown) as Record<string, string>).teamMembers || "[]"),
    sponsors: JSON.parse(((plan as unknown) as Record<string, string>).sponsors || "[]"),
    kpis: JSON.parse(((plan as unknown) as Record<string, string>).kpis || "[]"),
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
    phases: plan.phases.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    ...(extra || {}),
  };
}

async function getHubExtra(id: string): Promise<Record<string, unknown>> {
  try {
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT collaborationEnabled, guestOrgName, guestOrgEmail, inviteToken, hubStatus, secondaryObjective, teamMembers, sponsors, kpis, clientName, coverageIntensity, colorScheme, parentPlanId, opponentCrest, teamHandle, opponentHandle FROM "ContentPlan" WHERE id = ?`, id
    );
    if (rows[0]) {
      const r = rows[0];
      return {
        collaborationEnabled: Boolean(r.collaborationEnabled),
        guestOrgName: r.guestOrgName ?? null,
        guestOrgEmail: r.guestOrgEmail ?? null,
        inviteToken: r.inviteToken ?? null,
        hubStatus: r.hubStatus ?? null,
        secondaryObjective: r.secondaryObjective ?? null,
        teamMembers: (() => { try { return JSON.parse((r.teamMembers as string) || "[]"); } catch { return []; } })(),
        sponsors: (() => { try { return JSON.parse((r.sponsors as string) || "[]"); } catch { return []; } })(),
        kpis: (() => { try { return JSON.parse((r.kpis as string) || "[]"); } catch { return []; } })(),
        clientName: r.clientName ?? null,
        coverageIntensity: r.coverageIntensity ?? null,
        colorScheme: r.colorScheme ?? null,
        parentPlanId: r.parentPlanId ?? null,
        opponentCrest: r.opponentCrest ?? null,
        teamHandle: r.teamHandle ?? null,
        opponentHandle: r.opponentHandle ?? null,
      };
    }
  } catch { /* columns may not exist in old DB */ }
  return { collaborationEnabled: false, guestOrgName: null, guestOrgEmail: null, inviteToken: null, hubStatus: null };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const plan = await getOwnedPlan(id, userId);
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const extra = await getHubExtra(id);
  return NextResponse.json(serializePlan(plan, extra));
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const plan = await getOwnedPlan(id, userId);
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const {
    name, type, sport, startDate, endDate, timezone,
    eventStartAt, eventEndAt, team, opponent, competition, venue, homeAway,
    mainObjective, secondaryObjective, targetAudience, platforms, contentPillars,
    teamMembers, sponsors, kpis, clientName, coverageIntensity, colorScheme, parentPlanId,
    ownerId, approverId, status, notes, archivedAt,
    collaborationEnabled, guestOrgName, guestOrgEmail, inviteToken, hubStatus,
    teamHandle, opponentHandle, opponentCrest,
  } = body;

  // Handle hub-specific columns via raw SQL (they may not be in the cached generated client yet)
  const hubCols: Record<string, unknown> = {};
  if (collaborationEnabled !== undefined) hubCols.collaborationEnabled = collaborationEnabled ? 1 : 0;
  if (guestOrgName !== undefined) hubCols.guestOrgName = guestOrgName || null;
  if (guestOrgEmail !== undefined) hubCols.guestOrgEmail = guestOrgEmail || null;
  if (inviteToken !== undefined) hubCols.inviteToken = inviteToken || null;
  if (hubStatus !== undefined) hubCols.hubStatus = hubStatus || null;
  if (teamHandle !== undefined) hubCols.teamHandle = teamHandle || null;
  if (opponentHandle !== undefined) hubCols.opponentHandle = opponentHandle || null;
  if (opponentCrest !== undefined) hubCols.opponentCrest = opponentCrest || null;

  if (Object.keys(hubCols).length > 0) {
    const sets = Object.keys(hubCols).map((k) => `"${k}" = ?`).join(", ");
    const vals = [...Object.values(hubCols), id];
    await prisma.$queryRawUnsafe(`UPDATE "ContentPlan" SET ${sets}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ?`, ...vals);
  }

  const updated = await prisma.contentPlan.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: String(name).trim() }),
      ...(type !== undefined && { type }),
      ...(sport !== undefined && { sport: sport || null }),
      ...(startDate !== undefined && { startDate }),
      ...(endDate !== undefined && { endDate }),
      ...(timezone !== undefined && { timezone }),
      ...(eventStartAt !== undefined && { eventStartAt: eventStartAt || null }),
      ...(eventEndAt !== undefined && { eventEndAt: eventEndAt || null }),
      ...(team !== undefined && { team: team || null }),
      ...(opponent !== undefined && { opponent: opponent || null }),
      ...(competition !== undefined && { competition: competition || null }),
      ...(venue !== undefined && { venue: venue || null }),
      ...(homeAway !== undefined && { homeAway: homeAway || null }),
      ...(mainObjective !== undefined && { mainObjective: mainObjective || null }),
      ...(secondaryObjective !== undefined && { secondaryObjective: secondaryObjective || null }),
      ...(targetAudience !== undefined && { targetAudience: targetAudience || null }),
      ...(platforms !== undefined && { platforms: JSON.stringify(Array.isArray(platforms) ? platforms : []) }),
      ...(contentPillars !== undefined && { contentPillars: JSON.stringify(Array.isArray(contentPillars) ? contentPillars : []) }),
      ...(teamMembers !== undefined && { teamMembers: JSON.stringify(Array.isArray(teamMembers) ? teamMembers : []) }),
      ...(sponsors !== undefined && { sponsors: JSON.stringify(Array.isArray(sponsors) ? sponsors : []) }),
      ...(kpis !== undefined && { kpis: JSON.stringify(Array.isArray(kpis) ? kpis : []) }),
      ...(clientName !== undefined && { clientName: clientName || null }),
      ...(coverageIntensity !== undefined && { coverageIntensity: coverageIntensity || null }),
      ...(colorScheme !== undefined && { colorScheme: colorScheme || null }),
      ...(parentPlanId !== undefined && { parentPlanId: parentPlanId || null }),
      ...(ownerId !== undefined && { ownerId: ownerId || null }),
      ...(approverId !== undefined && { approverId: approverId || null }),
      ...(status !== undefined && { status }),
      ...(notes !== undefined && { notes: notes || null }),
      ...(archivedAt !== undefined && { archivedAt: archivedAt || null }),
    },
    include: {
      phases: { orderBy: { sortOrder: "asc" } },
      _count: { select: { items: true } },
    },
  });

  const extra = await getHubExtra(id);
  return NextResponse.json(serializePlan(updated, extra));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const plan = await getOwnedPlan(id, userId);
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Unlink calendar items from this plan (don't delete them)
  await prisma.calendarItem.updateMany({
    where: { planId: id },
    data: { planId: null, phaseId: null },
  });

  await prisma.contentPlan.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
