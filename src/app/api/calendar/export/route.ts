import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import * as XLSX from "xlsx";

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  const body = await req.json().catch(() => ({}));
  const { from, to, status } = body as { from?: string; to?: string; status?: string };

  const where: Record<string, unknown> = { userId };
  if (from && to) where.plannedDate = { gte: from, lte: to };
  else if (from) where.plannedDate = { gte: from };
  if (status) where.status = status;

  const items = await prisma.calendarItem.findMany({
    where,
    orderBy: [{ plannedDate: "asc" }, { plannedTime: "asc" }],
  });

  const STATUS_LABELS: Record<string, string> = {
    planned: "Planned",
    in_production: "In Production",
    ready: "Ready to Publish",
    published: "Published",
  };

  const rows = items.map((item) => {
    const platforms = JSON.parse(item.platforms || "[]") as string[];
    return {
      Date: item.plannedDate,
      Time: item.plannedTime || "",
      Title: item.title,
      Status: STATUS_LABELS[item.status] || item.status,
      Platforms: platforms.join(", "),
      Creator: item.creatorName || "",
      Sport: item.sport || "",
      Format: item.contentFormat || "",
      Notes: item.notes || "",
      "Reference URL": item.referenceUrl || "",
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  const colWidths = [
    { wch: 12 }, { wch: 8 }, { wch: 40 }, { wch: 16 }, { wch: 24 },
    { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 40 }, { wch: 40 },
  ];
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, "Content Calendar");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const filename = `content-calendar${from ? `-${from}` : ""}${to ? `-to-${to}` : ""}.xlsx`;

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
