import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // Public endpoint: just check if setup is needed
  if (searchParams.get("check") === "setup") {
    const count = await prisma.user.count({ where: { password: { not: "not-used" } } });
    return NextResponse.json({ needsSetup: count === 0 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, name: true, role: true, plan: true, createdAt: true },
  });
  return NextResponse.json({ users });
}

const VALID_ROLES = ["ROLE_USER", "ROLE_ADMIN"];
const VALID_PLANS = ["free", "basic_monthly", "basic_annual", "pro_monthly", "pro_annual"];

export async function POST(request: NextRequest) {
  const { email, password, role, plan } = await request.json();
  if (!email || !password) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });

  const userRole = VALID_ROLES.includes(role) ? role : "ROLE_USER";
  const userPlan = VALID_PLANS.includes(plan) ? plan : "free";

  try {
    const user = await prisma.user.create({
      data: { email: email.trim().toLowerCase(), password, role: userRole, plan: userPlan },
      select: { id: true, email: true, role: true, plan: true, createdAt: true },
    });
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "Email already exists" }, { status: 409 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  if (id === "default-user") return NextResponse.json({ error: "Cannot delete default user" }, { status: 403 });

  try {
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
}
