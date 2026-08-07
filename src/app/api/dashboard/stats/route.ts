import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET() {
  const userId = await getCurrentUserId();

  const [totalPublications, folders, savedPosts, platformCounts] = await Promise.all([
    prisma.publication.count(),
    prisma.savedFolder.count({ where: { userId } }),
    prisma.savedPost.count({ where: { folder: { userId } } }),
    prisma.publication.groupBy({
      by: ["platformId"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 1,
    }),
  ]);

  let topPlatform = "—";
  if (platformCounts[0]) {
    const plat = await prisma.platform.findUnique({ where: { id: platformCounts[0].platformId } });
    topPlatform = plat?.name ?? "—";
  }

  return NextResponse.json({ totalPublications, folders, savedPosts, topPlatform });
}
