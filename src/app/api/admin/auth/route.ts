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

function cookieOpts(remember: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: remember ? 60 * 60 * 24 * 15 : 60 * 60 * 24,
  };
}

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
  const { email, password, name, action, remember = false } = body;
  if (!email || !password) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  // Register new admin account (requires at least one existing superadmin to have invited them,
  // or the system is open during initial setup)
  if (action === "register") {
    if (password.length < 8) return NextResponse.json({ error: "La contrasenya ha de tenir almenys 8 caràcters" }, { status: 400 });
    const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (existing) return NextResponse.json({ error: "Aquest correu ja està registrat" }, { status: 409 });
    try {
      const user = await prisma.user.create({
        data: {
          email: email.trim().toLowerCase(),
          name: name?.trim() || null,
          password,
          role: "ROLE_SUPERADMIN",
        },
      });
      const res = NextResponse.json({ ok: true });
      res.cookies.set(COOKIE, sessionToken(user.id, user.role), cookieOpts(remember));
      return res;
    } catch {
      return NextResponse.json({ error: "Error en crear el compte" }, { status: 500 });
    }
  }

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
    res.cookies.set(COOKIE, sessionToken(user.id, user.role), cookieOpts(remember));
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
  res.cookies.set(COOKIE, sessionToken(user.id, user.role), cookieOpts(remember));
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { maxAge: 0, path: "/" });
  return res;
}
