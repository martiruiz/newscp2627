import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET() {
  const userId = await getCurrentUserId();
  const folders = await prisma.savedFolder.findMany({
    where: { userId },
    include: { posts: { select: { id: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(
    folders.map((f) => ({ id: f.id, name: f.name, count: f.posts.length, createdAt: f.createdAt }))
  );
}

export async function POST(request: NextRequest) {
  const { name } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const userId = await getCurrentUserId();
  try {
    const folder = await prisma.savedFolder.create({ data: { name: name.trim(), userId } });
    return NextResponse.json({ id: folder.id, name: folder.name, count: 0 });
  } catch {
    return NextResponse.json({ error: "Folder already exists" }, { status: 409 });
  }
}
