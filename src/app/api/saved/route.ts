import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { publicationId } = await request.json();
  const userId = await getCurrentUserId();

  if (!publicationId) {
    return NextResponse.json({ error: "publicationId required" }, { status: 400 });
  }

  const existing = await prisma.savedPost.findUnique({
    where: { userId_publicationId: { userId, publicationId } },
  });

  if (existing) {
    await prisma.savedPost.delete({ where: { id: existing.id } });
    return NextResponse.json({ saved: false });
  }

  await prisma.savedPost.create({
    data: { userId, publicationId },
  });

  return NextResponse.json({ saved: true });
}
