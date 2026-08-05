import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const userId = await getCurrentUserId();
  const folder = await prisma.savedFolder.findFirst({ where: { id, userId } });
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const updated = await prisma.savedFolder.update({ where: { id }, data: { name: name.trim() } });
  return NextResponse.json({ id: updated.id, name: updated.name });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const folder = await prisma.savedFolder.findFirst({ where: { id, userId } });
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.savedFolder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
