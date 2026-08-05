import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { publicationId, folderId } = await request.json();
  const userId = await getCurrentUserId();

  if (!publicationId) {
    return NextResponse.json({ error: "publicationId required" }, { status: 400 });
  }

  // Find existing saved post for this user+publication
  const existing = await prisma.savedPost.findFirst({
    where: { userId, publicationId },
  });

  if (folderId) {
    // Validate folder belongs to user
    const folder = await prisma.savedFolder.findFirst({ where: { id: folderId, userId } });
    if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 });

    if (existing) {
      // Update to assign this folder
      await prisma.savedPost.update({ where: { id: existing.id }, data: { folderId } });
    } else {
      // Create new saved post with folder
      await prisma.savedPost.create({ data: { userId, publicationId, folderId } });
    }
    return NextResponse.json({ saved: true });
  }

  // No folderId — toggle general save
  if (existing) {
    await prisma.savedPost.delete({ where: { id: existing.id } });
    return NextResponse.json({ saved: false });
  }

  await prisma.savedPost.create({ data: { userId, publicationId } });
  return NextResponse.json({ saved: true });
}
