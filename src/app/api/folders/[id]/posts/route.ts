import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const folder = await prisma.savedFolder.findFirst({ where: { id, userId } });
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const posts = await prisma.savedPost.findMany({
    where: { userId, folderId: id },
    include: {
      publication: {
        include: {
          platform: true,
          sport: true,
          entityType: true,
          contentFormat: true,
          competitions: { include: { competition: true } },
          classifications: { include: { classification: true } },
          savedBy: { where: { userId }, select: { id: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const publications = posts.map((p) => {
    const pub = p.publication;
    return {
      id: pub.id,
      externalPostId: pub.externalPostId,
      canonicalUrl: pub.canonicalUrl,
      embedUrl: pub.embedUrl,
      accountUsername: pub.accountUsername,
      publishedAt: pub.publishedAt?.toISOString() ?? null,
      platform: pub.platform.name,
      sport: pub.sport?.name ?? null,
      entityType: pub.entityType?.name ?? null,
      entityName: pub.entityName,
      contentFormat: pub.contentFormat?.name ?? null,
      competitions: pub.competitions.map((c) => c.competition.name),
      classifications: pub.classifications.map((c) => c.classification.name),
      isSaved: true,
    };
  });

  return NextResponse.json({ folder: { id: folder.id, name: folder.name }, publications });
}
