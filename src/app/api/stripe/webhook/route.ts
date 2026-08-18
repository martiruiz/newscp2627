import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

function planFromPriceId(priceId: string): string {
  const proMonthly = process.env.STRIPE_PRICE_PRO_MONTHLY;
  const proAnnual = process.env.STRIPE_PRICE_PRO_ANNUAL;
  const basicMonthly = process.env.STRIPE_PRICE_BASIC_MONTHLY;
  const basicAnnual = process.env.STRIPE_PRICE_BASIC_ANNUAL;
  const weekly = process.env.STRIPE_PRICE_WEEKLY;
  if (priceId === proMonthly || priceId === proAnnual) return "pro";
  if (priceId === basicMonthly || priceId === basicAnnual) return "basic";
  if (priceId === weekly) return "weekly";
  return "free";
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig || !WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature or secret" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const subscriptionId = session.subscription as string;
      if (!subscriptionId) break;

      const sub = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ["items.data.price"],
      }) as unknown as Stripe.Subscription & { current_period_end: number };
      const userId = sub.metadata?.userId;
      if (!userId) break;
      const priceId = (sub.items.data[0]?.price as Stripe.Price)?.id ?? "";
      const plan = planFromPriceId(priceId);
      const expiresAt = new Date(sub.current_period_end * 1000);

      await prisma.user.update({
        where: { id: userId },
        data: { plan, stripeSubscriptionId: subscriptionId, planExpiresAt: expiresAt },
      });
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription & { current_period_end: number };
      const userId = sub.metadata?.userId;
      if (!userId) break;

      const priceId = (sub.items.data[0]?.price as Stripe.Price)?.id ?? "";
      const plan = sub.status === "active" || sub.status === "trialing"
        ? planFromPriceId(priceId)
        : "free";
      const expiresAt = new Date(sub.current_period_end * 1000);

      await prisma.user.update({
        where: { id: userId },
        data: { plan, planExpiresAt: expiresAt },
      });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription & { current_period_end: number };
      const userId = sub.metadata?.userId;
      if (!userId) break;

      await prisma.user.update({
        where: { id: userId },
        data: { plan: "free", stripeSubscriptionId: null, planExpiresAt: null },
      });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (!customerId) break;

      const user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId } });
      if (user) {
        await prisma.user.update({ where: { id: user.id }, data: { plan: "free" } });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
