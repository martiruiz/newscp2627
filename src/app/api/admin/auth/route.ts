import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

const COOKIE = "scp_admin_session";

function sessionToken(userId: string, role: string) {
  return `${userId}:${role}`;
}

function parseSession(value: string) {
  const [userId, role] = value.split(":");
  return { userId, role };
}

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE)?.value;
  if (!raw) return NextResponse.json({ user: null }, { status: 401 });

  const { userId } = parseSession(raw);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password, action } = body;
  if (!email || !password) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  // Setup first superadmin: only allowed if no real users exist
  if (action === "setup") {
    const realUsers = await prisma.user.count({ where: { password: { not: "not-used" } } });
    if (realUsers > 0) return NextResponse.json({ error: "Setup already complete" }, { status: 403 });
    if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    const user = await prisma.user.upsert({
      where: { email: email.trim().toLowerCase() },
      create: { email: email.trim().toLowerCase(), password, role: "ROLE_SUPERADMIN" },
      update: { password, role: "ROLE_SUPERADMIN" },
    });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE, sessionToken(user.id, user.role), COOKIE_OPTS);
    return res;
  }

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || user.password !== password || user.password === "not-used") {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  // Only superadmins can log in to the admin panel
  if (user.role !== "ROLE_SUPERADMIN") {
    return NextResponse.json({ error: "Access denied. Super administrator required." }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true, user: { id: user.id, email: user.email, role: user.role } });
  res.cookies.set(COOKIE, sessionToken(user.id, user.role), COOKIE_OPTS);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { maxAge: 0, path: "/" });
  return res;
}
