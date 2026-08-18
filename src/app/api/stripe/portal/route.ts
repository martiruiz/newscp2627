import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST() {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("scp_admin_session");
  if (!adminCookie?.value) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [userId] = adminCookie.value.split(":");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.stripeCustomerId) {
    return NextResponse.json({ error: "No subscription found" }, { status: 404 });
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${base}/account?tab=subscription`,
  });

  return NextResponse.json({ url: session.url });
}
