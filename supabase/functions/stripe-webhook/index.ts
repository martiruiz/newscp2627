// Supabase Edge Function "stripe-webhook": the only place where payments give access.
// Stripe calls it on every subscription / payment change; the signature is verified with STRIPE_WEBHOOK_SECRET.
//   checkout.session.completed (subscription) / customer.subscription.* → subscriptions row (plan, monthly/yearly, status)
//   checkout.session.completed / async_payment_succeeded (pack, paid)   → AI pack credits (once per Checkout session)
// Every handler is idempotent; processed event ids are stored in stripe_events. Deploy with --no-verify-jwt.
import { env, json, rest, rpc, Stripe, stripe } from "../_shared/stripe.ts";

const STATUS: Record<string, string | null> = {
  trialing: "trialing", active: "active", past_due: "past_due", unpaid: "past_due",
  canceled: "canceled", incomplete_expired: "canceled", paused: "canceled", incomplete: null,
};
const iso = (unix?: number | null) => (unix ? new Date(unix * 1000).toISOString() : null);

async function userOf(customerId: string, metaUser?: string) {
  if (metaUser) return metaUser;
  const [row] = await rest(`stripe_customers?select=user_id&customer_id=eq.${encodeURIComponent(customerId)}`);
  return row?.user_id || null;
}

async function applySubscription(sub: Stripe.Subscription, deleted = false) {
  // Events can arrive out of order: always apply the subscription as it is now
  if (!deleted) sub = await stripe.subscriptions.retrieve(sub.id);
  const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const user = await userOf(customer, sub.metadata?.user_id);
  if (!user) throw new Error(`No member for customer ${customer}`);
  const item = sub.items.data[0];
  const price = item?.price?.id;
  const [byMonth] = await rest(`plans?select=key&stripe_price_month=eq.${encodeURIComponent(price)}`);
  const [byYear] = byMonth ? [null] : await rest(`plans?select=key&stripe_price_year=eq.${encodeURIComponent(price)}`);
  const plan = byMonth?.key || byYear?.key;
  if (!plan) throw new Error(`Price ${price} isn't linked to any plan`);
  const status = deleted ? "canceled" : STATUS[sub.status];
  if (!status) return; // incomplete: the first payment hasn't gone through yet, no access
  // deno-lint-ignore no-explicit-any
  const periodEnd = (sub as any).current_period_end ?? (item as any)?.current_period_end;
  await rpc("stripe_apply_subscription", {
    p_user: user, p_plan: plan, p_interval: byYear ? "year" : "month", p_status: status,
    p_customer: customer, p_subscription: sub.id, p_started: iso(sub.start_date), p_period_end: iso(periodEnd),
  });
}

async function grantPack(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid" || !session.metadata?.pack_key) return;
  const customer = typeof session.customer === "string" ? session.customer : session.customer?.id || "";
  const user = await userOf(customer, session.metadata.user_id || session.client_reference_id || undefined);
  if (!user) throw new Error(`No member for checkout ${session.id}`);
  await rpc("grant_pack", { p_user: user, p_pack_key: session.metadata.pack_key, p_price: (session.amount_total ?? 0) / 100, p_source: "stripe", p_ref: session.id });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, req.headers.get("stripe-signature") ?? "", env("STRIPE_WEBHOOK_SECRET"), undefined, Stripe.createSubtleCryptoProvider());
  } catch {
    return json({ error: "Invalid signature" }, 400);
  }
  const seen = await rest(`stripe_events?select=id&id=eq.${encodeURIComponent(event.id)}`);
  if (seen?.length) return json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.mode === "payment") await grantPack(s);
        if (s.mode === "subscription" && s.subscription) {
          await applySubscription({ id: typeof s.subscription === "string" ? s.subscription : s.subscription.id } as Stripe.Subscription);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
        await applySubscription(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await applySubscription(event.data.object as Stripe.Subscription, true);
        break;
    }
    await rest("stripe_events", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify({ id: event.id, type: event.type }) });
    return json({ received: true });
  } catch (e) {
    console.error(event.type, e);
    return json({ error: "Webhook handler failed" }, 500); // Stripe retries
  }
});
