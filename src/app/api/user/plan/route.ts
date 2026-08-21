import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getOrCreateDefaultUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function resolveUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  // 1. Prefer the admin session cookie (set by /admin/login)
  const adminCookie = cookieStore.get("scp_admin_session");
  if (adminCookie?.value) {
    const [id] = adminCookie.value.split(":");
    return id || null;
  }
  // 2. Fall back to the user-facing identity cookie
  const userCookie = cookieStore.get("scp_user_id");
  return userCookie?.value ?? null;
}

export async function GET() {
  // Ensure default user exists and has super admin flag
  const defaultUser = await getOrCreateDefaultUser();

  const userId = (await resolveUserId()) ?? defaultUser.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      planExpiresAt: true,
      email: true,
      name: true,
      superAdmin: true,
      onboardingCompleted: true,
    },
  });

  if (!user) return NextResponse.json({ plan: "free", hasSubscription: false });

  return NextResponse.json({
    plan: user.plan ?? "free",
    hasSubscription: !!user.stripeSubscriptionId,
    planExpiresAt: user.planExpiresAt,
    email: user.email,
    name: user.name,
    superAdmin: user.superAdmin ?? false,
    onboardingCompleted: user.onboardingCompleted ?? false,
  });
}
