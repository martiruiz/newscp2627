import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("scp_admin_session");
  if (!adminCookie?.value) {
    return NextResponse.json({ plan: "free", hasSubscription: false });
  }

  const [userId] = adminCookie.value.split(":");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, stripeCustomerId: true, stripeSubscriptionId: true, planExpiresAt: true, email: true, name: true, superAdmin: true, onboardingCompleted: true },
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
