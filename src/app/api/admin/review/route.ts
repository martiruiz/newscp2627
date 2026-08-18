import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const [newContent, missingInfo, withErrors] = await Promise.all([
    // New: publications with reviewStatus = "pending"
    prisma.publication.count({ where: { reviewStatus: "pending" } }),
    // Missing info: mandatory fields empty AND not explicitly approved
    // Note: { not: "approved" } excludes NULLs in SQL, so we must OR with null explicitly
    prisma.publication.count({
      where: {
        AND: [
          {
            OR: [
              { reviewStatus: null },
              { reviewStatus: { not: "approved" } },
            ],
          },
          {
            OR: [
              { sports: { none: {} } },
              { accountUsername: null },
              { entityName: null },
            ],
          },
        ],
      },
    }),
    // Errors: importStatus = error
    prisma.publication.count({ where: { importStatus: "error" } }),
  ]);

  return NextResponse.json({
    newContent,
    missingInfo,
    withErrors,
    totalPending: newContent + missingInfo + withErrors,
  });
}

export async function PATCH(request: NextRequest) {
  const { id, reviewStatus } = await request.json();
  if (!id || !["approved", "rejected", "pending"].includes(reviewStatus)) {
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }

  const pub = await prisma.publication.update({
    where: { id },
    data: {
      reviewStatus,
      reviewedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, reviewStatus: pub.reviewStatus });
}
