import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { MATCHDAY_PHASES } from "@/lib/relative-time";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parsePlan(plan: Record<string, any>) {
  return {
    ...plan,
    platforms: JSON.parse(plan.platforms || "[]"),
    contentPillars: JSON.parse(plan.contentPillars || "[]"),
    teamMembers: JSON.parse(plan.teamMembers || "[]"),
    sponsors: JSON.parse(plan.sponsors || "[]"),
    kpis: JSON.parse(plan.kpis || "[]"),
    createdAt: plan.createdAt instanceof Date ? plan.createdAt.toISOString() : plan.createdAt,
    updatedAt: plan.updatedAt instanceof Date ? plan.updatedAt.toISOString() : plan.updatedAt,
    phases: plan.phases?.map((p: Record<string, unknown>) => ({
      ...p,
      createdAt: p.createdAt instanceof Date ? (p.createdAt as Date).toISOString() : p.createdAt,
      updatedAt: p.updatedAt instanceof Date ? (p.updatedAt as Date).toISOString() : p.updatedAt,
    })),
  };
}

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const archived = searchParams.get("archived") === "true";

  const where: Record<string, unknown> = { userId };
  if (!archived) where.archivedAt = null;
  if (status) where.status = status;
  if (type) where.type = type;

  const plans = await prisma.contentPlan.findMany({
    where,
    include: {
      phases: { orderBy: { sortOrder: "asc" } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Enrich with hub columns via raw SQL (they may not be in the cached generated client)
  let hubMap: Record<string, Record<string, unknown>> = {};
  try {
    const ids = plans.map((p) => `'${p.id.replace(/'/g, "''")}'`).join(",");
    if (ids) {
      const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT id, collaborationEnabled, guestOrgName, guestOrgEmail, inviteToken, hubStatus, secondaryObjective, teamMembers, sponsors, kpis, clientName, coverageIntensity, colorScheme, parentPlanId, opponentCrest, teamHandle, opponentHandle FROM "ContentPlan" WHERE id IN (${ids})`
      );
      for (const row of rows) {
        hubMap[row.id as string] = {
          collaborationEnabled: Boolean(row.collaborationEnabled),
          guestOrgName: row.guestOrgName ?? null,
          guestOrgEmail: row.guestOrgEmail ?? null,
          inviteToken: row.inviteToken ?? null,
          hubStatus: row.hubStatus ?? null,
          secondaryObjective: row.secondaryObjective ?? null,
          teamMembers: (() => { try { return JSON.parse((row.teamMembers as string) || "[]"); } catch { return []; } })(),
          sponsors: (() => { try { return JSON.parse((row.sponsors as string) || "[]"); } catch { return []; } })(),
          kpis: (() => { try { return JSON.parse((row.kpis as string) || "[]"); } catch { return []; } })(),
          clientName: row.clientName ?? null,
          coverageIntensity: row.coverageIntensity ?? null,
          colorScheme: row.colorScheme ?? null,
          parentPlanId: row.parentPlanId ?? null,
          opponentCrest: row.opponentCrest ?? null,
          teamHandle: row.teamHandle ?? null,
          opponentHandle: row.opponentHandle ?? null,
        };
      }
    }
  } catch { /* columns may not exist in old DB */ }

  // Compute real readiness stats per plan
  let statsMap: Record<string, Record<string, unknown>> = {};
  try {
    const ids = plans.map((p) => `'${p.id.replace(/'/g, "''")}'`).join(",");
    if (ids) {
      const statRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
        SELECT
          planId,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
          SUM(CASE WHEN approvalStatus = 'approved' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN approvalStatus = 'pending_approval' THEN 1 ELSE 0 END) as pendingApproval,
          SUM(CASE WHEN status = 'in_production' THEN 1 ELSE 0 END) as inProduction,
          SUM(CASE WHEN status = 'planned' THEN 1 ELSE 0 END) as planned,
          SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END) as ready,
          SUM(CASE WHEN (title IS NOT NULL AND title != '') AND (plannedDate IS NOT NULL) AND (platforms != '[]') THEN 1 ELSE 0 END) as readinessScore
        FROM "CalendarItem"
        WHERE planId IN (${ids})
        GROUP BY planId
      `);
      for (const row of statRows) {
        const total = Number(row.total) || 0;
        const score = total > 0 ? Math.round((Number(row.readinessScore) / total) * 100) : 0;
        statsMap[row.planId as string] = {
          itemStats: {
            total,
            published: Number(row.published) || 0,
            approved: Number(row.approved) || 0,
            pendingApproval: Number(row.pendingApproval) || 0,
            inProduction: Number(row.inProduction) || 0,
            planned: Number(row.planned) || 0,
            ready: Number(row.ready) || 0,
            readinessScore: score,
          },
        };
      }
    }
  } catch { /* non-critical */ }

  return NextResponse.json(plans.map((p) => ({ ...parsePlan(p), ...(hubMap[p.id] || {}), ...(statsMap[p.id] || {}) })));
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  const body = await req.json();

  const {
    name, type, sport, startDate, endDate, timezone,
    eventStartAt, eventEndAt, team, opponent, competition, venue, homeAway,
    mainObjective, secondaryObjective, targetAudience, platforms, contentPillars,
    teamMembers, sponsors, kpis, clientName, coverageIntensity, colorScheme,
    parentPlanId, ownerId, approverId, notes, phases, opponentCrest,
  } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
  if (!startDate) return NextResponse.json({ error: "Start date required" }, { status: 400 });
  if (!endDate) return NextResponse.json({ error: "End date required" }, { status: 400 });

  // Create with only fields the cached Prisma client knows about
  const plan = await prisma.contentPlan.create({
    data: {
      userId,
      name: name.trim(),
      type: type || "custom",
      sport: sport || null,
      startDate,
      endDate,
      timezone: timezone || "Europe/Madrid",
      eventStartAt: eventStartAt || null,
      eventEndAt: eventEndAt || null,
      team: team || null,
      opponent: opponent || null,
      competition: competition || null,
      venue: venue || null,
      homeAway: homeAway || null,
      mainObjective: mainObjective || null,
      targetAudience: targetAudience || null,
      platforms: JSON.stringify(Array.isArray(platforms) ? platforms : []),
      contentPillars: JSON.stringify(Array.isArray(contentPillars) ? contentPillars : []),
      ownerId: ownerId || null,
      approverId: approverId || null,
      status: "draft",
      notes: notes || null,
    },
  });

  // Update extra columns that exist in DB but not in the cached generated client
  const extraCols: Record<string, unknown> = {
    secondaryObjective: secondaryObjective || null,
    teamMembers: JSON.stringify(Array.isArray(teamMembers) ? teamMembers : []),
    sponsors: JSON.stringify(Array.isArray(sponsors) ? sponsors : []),
    kpis: JSON.stringify(Array.isArray(kpis) ? kpis : []),
    clientName: clientName || null,
    coverageIntensity: coverageIntensity || null,
    colorScheme: colorScheme || null,
    parentPlanId: parentPlanId || null,
    opponentCrest: opponentCrest || null,
  };
  try {
    const sets = Object.keys(extraCols).map((k) => `"${k}" = ?`).join(", ");
    await prisma.$executeRawUnsafe(
      `UPDATE "ContentPlan" SET ${sets} WHERE id = ?`,
      ...Object.values(extraCols), plan.id
    );
  } catch { /* non-critical — extra fields */ }

  // Create phases if provided
  if (Array.isArray(phases) && phases.length > 0) {
    await prisma.contentPlanPhase.createMany({
      data: phases.map((ph, i) => ({
        planId: plan.id,
        phaseKey: ph.phaseKey || null,
        label: ph.label,
        description: ph.description || null,
        sortOrder: i,
        anchorType: ph.anchorType || "absolute",
        startOffsetMinutes: ph.startOffsetMinutes ?? null,
        endOffsetMinutes: ph.endOffsetMinutes ?? null,
        startsAt: ph.startsAt || null,
        endsAt: ph.endsAt || null,
        enabled: ph.enabled !== false,
      })),
    });
  }

  // Auto-create calendar items for matchday plans
  if (type === "matchday" && Array.isArray(phases) && phases.length > 0) {
    const createdPhases = await prisma.contentPlanPhase.findMany({
      where: { planId: plan.id }, orderBy: { sortOrder: "asc" },
    });
    const calendarItems: {
      userId: string; sourceType: string; title: string;
      plannedDate: string; plannedTime: string; status: string;
      platforms: string; collaborators: string; planId: string; phaseId: string;
    }[] = [];
    for (const phase of createdPhases) {
      if (!phase.startsAt || !phase.endsAt) continue;
      const def = MATCHDAY_PHASES.find((p) => p.phaseKey === phase.phaseKey);
      if (!def) continue;
      const startMs = new Date(phase.startsAt).getTime();
      const endMs = new Date(phase.endsAt).getTime();
      const items = def.suggestedContent;
      const count = items.length;
      const interval = count > 1 ? (endMs - startMs) / (count - 1) : 0;
      for (let i = 0; i < count; i++) {
        const ts = startMs + Math.round(interval * i);
        const d = new Date(ts);
        calendarItems.push({
          userId, sourceType: "custom", title: items[i],
          plannedDate: d.toISOString().slice(0, 10),
          plannedTime: `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`,
          status: "planned",
          platforms: JSON.stringify(Array.isArray(platforms) ? platforms : []),
          collaborators: "[]", planId: plan.id, phaseId: phase.id,
        });
      }
    }
    if (calendarItems.length > 0) {
      await prisma.calendarItem.createMany({ data: calendarItems });
    }
  }

  const full = await prisma.contentPlan.findUnique({
    where: { id: plan.id },
    include: { phases: { orderBy: { sortOrder: "asc" } }, _count: { select: { items: true } } },
  });

  // Enrich with hub-specific extra columns so the response matches GET /api/plans
  let hubExtra: Record<string, unknown> = {};
  try {
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT collaborationEnabled, guestOrgName, guestOrgEmail, inviteToken, hubStatus, secondaryObjective, teamMembers, sponsors, kpis, clientName, coverageIntensity, colorScheme, parentPlanId, opponentCrest FROM "ContentPlan" WHERE id = ?`, plan.id
    );
    if (rows[0]) {
      const r = rows[0];
      hubExtra = {
        collaborationEnabled: Boolean(r.collaborationEnabled),
        guestOrgName: r.guestOrgName ?? null,
        guestOrgEmail: r.guestOrgEmail ?? null,
        inviteToken: r.inviteToken ?? null,
        hubStatus: r.hubStatus ?? null,
        opponentCrest: r.opponentCrest ?? null,
      };
    }
  } catch { /* non-critical */ }

  return NextResponse.json({ ...parsePlan(full!), ...hubExtra }, { status: 201 });
}
