import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET() {
  const userId = await getCurrentUserId();
  const folders = await prisma.savedFolder.findMany({
    where: { userId },
    include: {
      posts: {
        orderBy: { createdAt: "desc" },
        include: {
          publication: { include: { platform: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    folders.map((f) => ({
      id: f.id,
      name: f.name,
      createdAt: f.createdAt,
      count: f.posts.length,
      coverPlatforms: f.posts
        .slice(0, 4)
        .map((p) => p.publication?.platform?.name)
        .filter(Boolean) as string[],
      coverImages: f.posts.slice(0, 4).map((p) => {
        const pub = p.publication;
        if (!pub) return null;
        const platform = pub.platform?.name?.toLowerCase();
        if (platform === "youtube") {
          return `https://img.youtube.com/vi/${pub.externalPostId}/mqdefault.jpg`;
        }
        return null;
      }),
    }))
  );
}

export async function POST(request: NextRequest) {
  const { name } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const userId = await getCurrentUserId();
  try {
    const folder = await prisma.savedFolder.create({ data: { name: name.trim(), userId } });
    return NextResponse.json({ id: folder.id, name: folder.name, count: 0, coverPlatforms: [], coverImages: [], createdAt: folder.createdAt });
  } catch {
    return NextResponse.json({ error: "Folder already exists" }, { status: 409 });
  }
}
