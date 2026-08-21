import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();

  const plan = await prisma.contentPlan.findUnique({ where: { id } });
  if (!plan || plan.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const phases = await prisma.contentPlanPhase.findMany({
    where: { planId: id },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { items: true } } },
  });

  return NextResponse.json(phases.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  })));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();

  const plan = await prisma.contentPlan.findUnique({ where: { id } });
  if (!plan || plan.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { label, phaseKey, description, sortOrder, anchorType, startOffsetMinutes, endOffsetMinutes, startsAt, endsAt } = body;

  if (!label?.trim()) return NextResponse.json({ error: "Label required" }, { status: 400 });

  const phase = await prisma.contentPlanPhase.create({
    data: {
      planId: id,
      label: label.trim(),
      phaseKey: phaseKey || null,
      description: description || null,
      sortOrder: sortOrder ?? 0,
      anchorType: anchorType || "absolute",
      startOffsetMinutes: startOffsetMinutes ?? null,
      endOffsetMinutes: endOffsetMinutes ?? null,
      startsAt: startsAt || null,
      endsAt: endsAt || null,
    },
  });

  return NextResponse.json({
    ...phase,
    createdAt: phase.createdAt.toISOString(),
    updatedAt: phase.updatedAt.toISOString(),
  }, { status: 201 });
}
