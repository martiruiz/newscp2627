import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const batches = await prisma.importBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(
    batches.map((b) => ({
      id: b.id,
      filename: b.filename,
      status: b.status,
      totalRows: b.totalRows,
      importedRows: b.importedRows,
      updatedRows: b.updatedRows,
      skippedRows: b.skippedRows,
      invalidRows: b.invalidRows,
      failedRows: b.failedRows,
      processingTime: b.processingTime,
      createdAt: b.createdAt,
      completedAt: b.completedAt,
    }))
  );
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing batch id" }, { status: 400 });
  }

  await prisma.publication.deleteMany({ where: { importBatchId: id } });
  await prisma.importBatch.delete({ where: { id } });

  return NextResponse.json({ deleted: true });
}
