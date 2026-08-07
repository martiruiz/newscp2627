import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return NextResponse.json(notifications);
}

export async function PATCH(req: NextRequest) {
  const { id } = await req.json();
  if (id === "all") {
    await prisma.notification.updateMany({ data: { read: true } });
  } else {
    await prisma.notification.update({ where: { id }, data: { read: true } });
  }
  return NextResponse.json({ ok: true });
}
