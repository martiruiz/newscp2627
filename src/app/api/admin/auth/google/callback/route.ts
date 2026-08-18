import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const COOKIE = "scp_admin_session";

export async function GET(request: NextRequest) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${base}/admin/login?error=google_denied`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${base}/admin/login?error=google_not_configured`);
  }

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${base}/api/admin/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    return NextResponse.redirect(`${base}/admin/login?error=google_token_failed`);
  }

  // Get Google user info
  const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const googleUser = await userRes.json();

  if (!googleUser.email) {
    return NextResponse.redirect(`${base}/admin/login?error=google_no_email`);
  }

  const email = googleUser.email.toLowerCase();

  // Find existing user
  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // Only allow first-time setup (no admins yet) or if the email is whitelisted
    const adminCount = await prisma.user.count({ where: { role: "ROLE_SUPERADMIN" } });
    if (adminCount > 0) {
      return NextResponse.redirect(`${base}/admin/login?error=not_invited`);
    }
    // Create first superadmin via Google
    user = await prisma.user.create({
      data: {
        email,
        name: googleUser.name ?? null,
        password: "google-oauth",
        role: "ROLE_SUPERADMIN",
      },
    });
  } else if (user.role !== "ROLE_SUPERADMIN") {
    return NextResponse.redirect(`${base}/admin/login?error=unauthorized`);
  }

  const token = `${user.id}:${user.role}`;
  const response = NextResponse.redirect(`${base}/admin/content-ideas`);
  response.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 15,
  });

  return response;
}
