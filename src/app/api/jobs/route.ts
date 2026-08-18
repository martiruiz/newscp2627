import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const jobs = await prisma.jobPosting.findMany({
    where: { active: true },
    orderBy: [{ featured: "desc" }, { postedAt: "desc" }],
  });
  return NextResponse.json({ jobs });
}
