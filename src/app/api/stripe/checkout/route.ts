import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { stripe, PLANS, type PlanKey } from "@/lib/stripe";

export const dynamic = "force-dynamic";

async function getCurrentUser() {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("scp_admin_session");
  if (!adminCookie?.value) return null;
  const [userId] = adminCookie.value.split(":");
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId } });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { planKey } = (await request.json()) as { planKey: PlanKey };
  const plan = PLANS[planKey];
  if (!plan || !plan.priceId) {
    return NextResponse.json({ error: "Invalid plan or Stripe not configured" }, { status: 400 });
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  let customerId = user.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name ?? undefined,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: plan.priceId, quantity: 1 }],
    success_url: `${base}/account?tab=subscription&success=1`,
    cancel_url: `${base}/account?tab=subscription`,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { userId: user.id, planId: plan.id },
    },
  });

  return NextResponse.json({ url: session.url });
}
