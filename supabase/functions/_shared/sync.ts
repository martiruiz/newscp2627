// Stripe → SCP: apply a subscription / invoice to the database exactly as Stripe has it now.
// Used by stripe-webhook (every event), stripe-admin (reconcile one member) and billing-cron (daily reconciliation).
import { cents, isoOf, rest, rpc, Stripe, stripe } from "./stripe.ts";

export async function userOf(customerId: string, metaUser?: string | null) {
  if (metaUser) return metaUser;
  const [row] = await rest(`stripe_customers?select=user_id&customer_id=eq.${encodeURIComponent(customerId)}`);
  return row?.user_id || null;
}

// Price id → plan (current or past SCP prices, MemberPress legacy prices, older plans columns)
export async function planOfPrice(priceId: string) {
  const [m] = await rest(`membership_prices?select=plan_key,interval,currency&stripe_price_id=eq.${encodeURIComponent(priceId)}`);
  if (m) return m.plan_key as string;
  const [byMonth] = await rest(`plans?select=key&stripe_price_month=eq.${encodeURIComponent(priceId)}`);
  if (byMonth) return byMonth.key as string;
  const [byYear] = await rest(`plans?select=key&stripe_price_year=eq.${encodeURIComponent(priceId)}`);
  return (byYear?.key as string) || null;
}

const STATUSES = new Set(["active", "trialing", "past_due", "unpaid", "paused", "canceled", "incomplete", "incomplete_expired"]);

// Apply the subscription as it is in Stripe now. `extra` carries checkout data (session id, private link, code).
export async function syncSubscription(subOrId: string | Stripe.Subscription, opts: { eventId?: string; eventCreated?: number; deleted?: boolean; extra?: Record<string, unknown> } = {}) {
  const id = typeof subOrId === "string" ? subOrId : subOrId.id;
  let sub: Stripe.Subscription;
  try {
    sub = await stripe.subscriptions.retrieve(id, { expand: ["schedule"] });
  } catch (e) {
    if (opts.deleted && typeof subOrId !== "string") sub = subOrId; else throw e;
  }
  const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const user = await userOf(customer, sub.metadata?.user_id);
  if (!user) throw new Error(`No member for customer ${customer}`);
  const item = sub.items.data[0];
  const price = item?.price;
  const plan = price ? await planOfPrice(price.id) : null;
  if (!plan) throw new Error(`Price ${price?.id} isn't linked to any plan (link it in Memberships → Plans or Migration)`);
  // deno-lint-ignore no-explicit-any
  const anySub = sub as any, anyItem = item as any;
  const periodStart = anySub.current_period_start ?? anyItem?.current_period_start;
  const periodEnd = anySub.current_period_end ?? anyItem?.current_period_end;
  const status = opts.deleted ? "canceled" : STATUSES.has(sub.status) ? sub.status : "incomplete";

  // A scheduled downgrade / interval change (subscription schedule with a next phase)
  let pending: { plan?: string | null; interval?: string | null; at?: string | null } = {};
  const sched = typeof sub.schedule === "object" && sub.schedule ? sub.schedule as Stripe.SubscriptionSchedule : null;
  if (sched && sched.status === "active") {
    const next = sched.phases.find((ph) => ph.start_date > Math.floor(Date.now() / 1000));
    const nextPrice = next?.items?.[0]?.price;
    const nextId = typeof nextPrice === "string" ? nextPrice : nextPrice?.id;
    if (next && nextId && nextId !== price?.id) {
      const np = await stripe.prices.retrieve(nextId);
      pending = { plan: await planOfPrice(nextId), interval: np.recurring?.interval || null, at: isoOf(next.start_date) };
    }
  }

  const applied = await rpc("billing_apply_subscription", { p: {
    user, plan, interval: price?.recurring?.interval === "year" ? "year" : "month", status,
    customer, subscription: sub.id, price: price?.id, product: typeof price?.product === "string" ? price?.product : price?.product?.id,
    currency: sub.currency || price?.currency, amount: cents(price?.unit_amount ?? null),
    started: isoOf(sub.start_date), period_start: isoOf(periodStart), period_end: isoOf(periodEnd),
    trial_start: isoOf(sub.trial_start), trial_end: isoOf(sub.trial_end),
    cancel_at_period_end: sub.cancel_at_period_end, cancel_at: isoOf(sub.cancel_at), canceled_at: isoOf(sub.canceled_at), ended_at: isoOf(sub.ended_at),
    latest_invoice: typeof sub.latest_invoice === "string" ? sub.latest_invoice : sub.latest_invoice?.id,
    private_link: sub.metadata?.private_link || null,
    discount_code: sub.metadata?.discount_code || null,
    pending_plan: pending.plan || null, pending_interval: pending.interval || null, pending_at: pending.at || null,
    stripe_updated: isoOf(opts.eventCreated ?? Math.floor(Date.now() / 1000)), event_id: opts.eventId || null,
    ...(opts.extra || {}),
  } });
  // team seats = Stripe quantity (1 for single-user memberships)
  if (user) await rest(`subscriptions?user_id=eq.${user}&stripe_subscription_id=eq.${sub.id}`, { method: "PATCH", body: JSON.stringify({ seats: Math.max(1, item?.quantity || 1) }) }).catch((e) => console.error("seats", e));
  return applied;
}

export async function syncInvoice(inv: Stripe.Invoice, event: "paid" | "payment_failed" | "action_required" | "update", eventId?: string) {
  const customer = typeof inv.customer === "string" ? inv.customer : inv.customer?.id || "";
  // deno-lint-ignore no-explicit-any
  const anyInv = inv as any;
  const subId = typeof anyInv.subscription === "string" ? anyInv.subscription : anyInv.subscription?.id || anyInv.parent?.subscription_details?.subscription || null;
  const user = await userOf(customer, inv.subscription_details?.metadata?.user_id || null).catch(() => null);
  const tax = Array.isArray(anyInv.total_taxes) ? anyInv.total_taxes.reduce((s: number, t: { amount: number }) => s + t.amount, 0) : (anyInv.tax ?? null);
  const discounts = Array.isArray(anyInv.total_discount_amounts) ? anyInv.total_discount_amounts.reduce((s: number, d: { amount: number }) => s + d.amount, 0) : null;
  const pi = typeof anyInv.payment_intent === "string" ? anyInv.payment_intent : anyInv.payment_intent?.id || null;
  await rpc("billing_record_invoice", { p: {
    id: inv.id, user, customer, subscription: subId, number: inv.number, status: inv.status, billing_reason: inv.billing_reason,
    currency: inv.currency, subtotal: cents(inv.subtotal), tax: cents(tax), total: cents(inv.total), amount_due: cents(inv.amount_due),
    amount_paid: cents(inv.amount_paid), amount_remaining: cents(inv.amount_remaining), discount_total: cents(discounts),
    period_start: isoOf(inv.period_start), period_end: isoOf(inv.period_end), hosted_invoice_url: inv.hosted_invoice_url, invoice_pdf: inv.invoice_pdf,
    payment_intent: pi, attempt_count: inv.attempt_count, next_payment_attempt: isoOf(inv.next_payment_attempt), created: isoOf(inv.created),
    paid_at: isoOf(inv.status_transitions?.paid_at), event: event === "update" ? null : event, event_id: eventId || null,
  } });
}
