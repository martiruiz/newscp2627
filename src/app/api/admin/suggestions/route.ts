import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function deduplicateCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const v of values) {
    const key = v.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(v);
    }
  }
  return result;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type");
  const q = (searchParams.get("q") ?? "").trim();

  if (!q) return NextResponse.json({ values: [] });

  if (type === "username") {
    const rows = await prisma.publication.findMany({
      where: { accountUsername: { contains: q } },
      select: { accountUsername: true },
      distinct: ["accountUsername"],
      take: 30,
      orderBy: { accountUsername: "asc" },
    });
    const raw = rows.map((r) => r.accountUsername).filter(Boolean) as string[];
    return NextResponse.json({ values: deduplicateCaseInsensitive(raw).slice(0, 10) });
  }

  if (type === "entity") {
    const rows = await prisma.publication.findMany({
      where: { entityName: { contains: q } },
      select: { entityName: true },
      distinct: ["entityName"],
      take: 50,
      orderBy: { entityName: "asc" },
    });
    // Split comma-separated entity names — "FC Barcelona, Rayo Vallecano" → two separate entries
    const expanded: string[] = [];
    for (const r of rows) {
      if (!r.entityName) continue;
      for (const part of r.entityName.split(",")) {
        const trimmed = part.trim();
        if (trimmed) expanded.push(trimmed);
      }
    }
    // Filter: keep only those that actually match the query after splitting
    const filtered = expanded.filter((v) => v.toLowerCase().includes(q.toLowerCase()));
    return NextResponse.json({ values: deduplicateCaseInsensitive(filtered).slice(0, 10) });
  }

  return NextResponse.json({ values: [] });
}
