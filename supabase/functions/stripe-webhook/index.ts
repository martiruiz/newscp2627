// Supabase Edge Function "stripe-webhook": the only place where payments give access.
// The signature is verified with STRIPE_WEBHOOK_SECRET. Every event is logged in stripe_events (processing → processed /
// failed with the error; Stripe retries failures) and applied idempotently:
//   checkout.session.completed            → subscription (+ private link use, discount redemption) or AI pack credits
//   customer.subscription.*               → full subscription state (re-read from Stripe: safe with out-of-order events)
//   customer.subscription.trial_will_end  → "trial ending" e-mail with Stripe's exact first charge
//   invoice.*                             → invoices, failed payments, payments needing authentication, recoveries
//   subscription_schedule.*               → scheduled downgrades / interval changes
//   customer.updated                      → "billing details updated" e-mail
// Deploy with --no-verify-jwt.
import { env, isoOf, json, kickEmails, rest, rpc, Stripe, stripe } from "../_shared/stripe.ts";
import { syncInvoice, syncSubscription, userOf } from "../_shared/sync.ts";

async function grantPack(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid" || !session.metadata?.pack_key) return;
  const customer = typeof session.customer === "string" ? session.customer : session.customer?.id || "";
  const user = await userOf(customer, session.metadata.user_id || session.client_reference_id || undefined);
  if (!user) throw new Error(`No member for checkout ${session.id}`);
  await rpc("grant_pack", { p_user: user, p_pack_key: session.metadata.pack_key, p_price: (session.amount_total ?? 0) / 100, p_source: "stripe", p_ref: session.id });
}

async function checkoutCompleted(s: Stripe.Checkout.Session, event: Stripe.Event) {
  if (s.mode === "payment") return grantPack(s);
  if (s.mode !== "subscription" || !s.subscription) return;
  const subId = typeof s.subscription === "string" ? s.subscription : s.subscription.id;
  await syncSubscription(subId, { eventId: event.id, eventCreated: event.created, extra: { checkout_session: s.id } });
  // discount redemption (one row per checkout)
  if (s.metadata?.discount_id) {
    const user = s.metadata.user_id || s.client_reference_id;
    await rest("billing_discount_redemptions", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" },
      body: JSON.stringify({ discount_id: s.metadata.discount_id, user_id: user, subscription_id: subId, checkout_session: s.id }) });
    const [d] = await rest(`billing_discounts?select=times_redeemed&id=eq.${s.metadata.discount_id}`);
    const n = (await rest(`billing_discount_redemptions?select=id&discount_id=eq.${s.metadata.discount_id}`)).length;
    if (d) await rest(`billing_discounts?id=eq.${s.metadata.discount_id}`, { method: "PATCH", body: JSON.stringify({ times_redeemed: n }) });
  }
}

async function trialWillEnd(sub: Stripe.Subscription, event: Stripe.Event) {
  const user = await userOf(typeof sub.customer === "string" ? sub.customer : sub.customer.id, sub.metadata?.user_id);
  if (!user) return;
  // Stripe's exact first charge after the trial (prorated to the 1st for monthly plans)
  let amount: number | null = null, currency = sub.currency, at = isoOf(sub.trial_end);
  try {
    // deno-lint-ignore no-explicit-any
    const inv: any = await (stripe.invoices as any).createPreview({ customer: sub.customer, subscription: sub.id });
    amount = inv.amount_due / 100; currency = inv.currency; at = isoOf(inv.next_payment_attempt || inv.period_end) || at;
  } catch (e) { console.error("preview", e); }
  await rpc("billing_enqueue_email", { p_template: "trial_ending", p_user: user, p_vars: { first_charge_amount: amount, first_charge_currency: currency, first_charge_at: at, trial_end: isoOf(sub.trial_end) },
    p_dedupe: `trial_ending:${sub.id}:${sub.trial_end}` });
}

async function customerUpdated(c: Stripe.Customer, event: Stripe.Event) {
  // deno-lint-ignore no-explicit-any
  const prev = (event.data as any).previous_attributes || {};
  if (!["address", "name", "email", "tax_exempt", "invoice_settings", "shipping"].some((k) => k in prev)) return;
  const user = await userOf(c.id, c.metadata?.user_id);
  if (user) await rpc("billing_enqueue_email", { p_template: "billing_details_updated", p_user: user, p_vars: {}, p_dedupe: `billing_details:${event.id}` });
}

async function handle(event: Stripe.Event) {
  const o = event.data.object as unknown as Record<string, unknown>;
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return checkoutCompleted(event.data.object as Stripe.Checkout.Session, event);
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
    case "customer.subscription.pending_update_applied":
    case "customer.subscription.pending_update_expired":
      return syncSubscription(event.data.object as Stripe.Subscription, { eventId: event.id, eventCreated: event.created });
    case "customer.subscription.deleted":
      return syncSubscription(event.data.object as Stripe.Subscription, { eventId: event.id, eventCreated: event.created, deleted: true });
    case "customer.subscription.trial_will_end":
      return trialWillEnd(event.data.object as Stripe.Subscription, event);
    case "invoice.paid":
    case "invoice.payment_succeeded":
      return syncInvoice(event.data.object as Stripe.Invoice, "paid", event.id);
    case "invoice.payment_failed":
      return syncInvoice(event.data.object as Stripe.Invoice, "payment_failed", event.id);
    case "invoice.payment_action_required":
      return syncInvoice(event.data.object as Stripe.Invoice, "action_required", event.id);
    case "invoice.created":
    case "invoice.finalized":
    case "invoice.updated":
    case "invoice.voided":
    case "invoice.marked_uncollectible":
      return syncInvoice(event.data.object as Stripe.Invoice, "update", event.id);
    case "subscription_schedule.created":
    case "subscription_schedule.updated":
    case "subscription_schedule.released":
    case "subscription_schedule.canceled":
    case "subscription_schedule.completed": {
      const sub = (o.subscription as string) || null;
      if (sub) return syncSubscription(sub, { eventId: event.id, eventCreated: event.created });
      return;
    }
    case "customer.updated":
      return customerUpdated(event.data.object as Stripe.Customer, event);
    default:
      return "ignored";
  }
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
  const objectId = (event.data.object as { id?: string })?.id || null;
  const go = await rpc("billing_event_begin", { p_id: event.id, p_type: event.type, p_object: objectId, p_livemode: event.livemode, p_created: isoOf(event.created) });
  if (go === "skip") return json({ received: true, duplicate: true });

  try {
    const r = await handle(event);
    await rpc("billing_event_end", { p_id: event.id, p_status: r === "ignored" ? "ignored" : "processed" });
    kickEmails();
    return json({ received: true });
  } catch (e) {
    console.error(event.type, e);
    await rpc("billing_event_end", { p_id: event.id, p_status: "failed", p_error: String((e as Error)?.message || e).slice(0, 500) }).catch(() => {});
    return json({ error: "Webhook handler failed" }, 500); // Stripe retries with backoff
  }
});
