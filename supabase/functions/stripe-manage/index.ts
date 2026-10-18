// Supabase Edge Function "stripe-manage": the member manages their own subscription (Account → Billing & Membership).
//   { action: "summary" }                       → live details from Stripe: next charge (exact), card, schedule
//   { action: "cancel", reason? }               → cancel at the end of the paid period / trial (no new charges)
//   { action: "reactivate" }                    → undo a scheduled cancellation
//   { action: "preview_change", plan, interval} → what a change costs now and when it applies (Stripe's numbers)
//   { action: "change", plan, interval }        → upgrade now (prorated, applied only if the payment succeeds) or
//                                                  downgrade / yearly → monthly at the end of the period
//   { action: "undo_change" }                   → drop a scheduled downgrade
//   { action: "portal", flow? }                 → Stripe customer portal (card, billing details, invoices)
// The database is updated by the webhook from what Stripe confirms, never directly here.
import { audit, config, CORS, currentUser, json, rest, setting, siteUrl, stripe, Stripe } from "../_shared/stripe.ts";
import { syncSubscription } from "../_shared/sync.ts";

// deno-lint-ignore no-explicit-any
const preview = (args: any) => (stripe.invoices as any).createPreview(args);
const monthly = (p: { amount: number; interval: string }) => (p.interval === "year" ? p.amount / 12 : p.amount);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const user = await currentUser(req);
  if (!user?.id) return json({ error: "Sign in first" }, 401);
  const body = await req.json().catch(() => ({}));
  const site = siteUrl(req);

  try {
    const [cust] = await rest(`stripe_customers?select=customer_id&user_id=eq.${user.id}`);
    if (body.action === "portal") {
      if (!cust) return json({ error: "You don't have any payments yet" }, 404);
      const portalConfig = await config("portal_config");
      const flow = body.flow === "payment_method" ? { flow_data: { type: "payment_method_update" as const } } : {};
      const p = await stripe.billingPortal.sessions.create({ customer: cust.customer_id, return_url: `${site}/profile.html#billing`, ...(portalConfig ? { configuration: portalConfig } : {}), ...flow, locale: body.lang === "es" ? "es" : body.lang === "en" ? "en" : "auto" });
      return json({ url: p.url });
    }

    const [row] = await rest(`subscriptions?select=stripe_subscription_id,plan_key,status,billing_interval,currency,source&user_id=eq.${user.id}`);
    if (!row?.stripe_subscription_id || row.source !== "stripe") return json({ error: "You don't have a paid membership to manage." }, 404);
    const sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id, { expand: ["default_payment_method", "schedule", "latest_invoice"] });
    const item = sub.items.data[0];

    if (body.action === "summary") {
      let next = null;
      if (!["canceled", "incomplete_expired"].includes(sub.status) && !sub.cancel_at_period_end) {
        try { const inv = await preview({ customer: sub.customer, subscription: sub.id }); next = { amount: inv.amount_due / 100, currency: inv.currency, at: new Date(((inv.next_payment_attempt || inv.period_end) as number) * 1000).toISOString() }; } catch (e) { console.error(e); }
      }
      const pm = sub.default_payment_method as Stripe.PaymentMethod | null;
      const card = pm?.card ? { brand: pm.card.brand, last4: pm.card.last4, exp_month: pm.card.exp_month, exp_year: pm.card.exp_year } : null;
      const inv = sub.latest_invoice as Stripe.Invoice | null;
      return json({ status: sub.status, next, card, cancel_at_period_end: sub.cancel_at_period_end,
        open_invoice: inv && inv.status === "open" ? { amount: inv.amount_due / 100, currency: inv.currency, url: inv.hosted_invoice_url } : null });
    }

    if (body.action === "cancel") {
      if (["canceled", "incomplete_expired"].includes(sub.status)) return json({ error: "This membership has already ended." }, 409);
      // a scheduled change would bring the subscription back: release it first
      if (sub.schedule && typeof sub.schedule === "object") await stripe.subscriptionSchedules.release((sub.schedule as Stripe.SubscriptionSchedule).id);
      await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true, cancellation_details: { comment: String(body.reason || "").slice(0, 500) || undefined } });
      await audit(user.id, "member.cancel", user.id, sub.id, { reason: body.reason || null });
      await syncSubscription(sub.id);
      return json({ ok: true });
    }

    if (body.action === "reactivate") {
      if (!sub.cancel_at_period_end || ["canceled", "incomplete_expired"].includes(sub.status)) return json({ error: "There's nothing to reactivate." }, 409);
      await stripe.subscriptions.update(sub.id, { cancel_at_period_end: false });
      await audit(user.id, "member.reactivate", user.id, sub.id, {});
      await syncSubscription(sub.id);
      return json({ ok: true });
    }

    if (body.action === "undo_change") {
      if (sub.schedule && typeof sub.schedule === "object") await stripe.subscriptionSchedules.release((sub.schedule as Stripe.SubscriptionSchedule).id);
      await audit(user.id, "member.undo_change", user.id, sub.id, {});
      await syncSubscription(sub.id);
      return json({ ok: true });
    }

    if (body.action === "preview_change" || body.action === "change") {
      const interval = body.interval === "year" ? "year" : "month";
      if (!["active", "trialing", "past_due"].includes(sub.status)) return json({ error: "Your membership can't be changed right now." }, 409);
      if (sub.cancel_at_period_end) return json({ error: "Reactivate your membership first, then change the plan." }, 409);
      const [plan] = await rest(`plans?select=key,name,active,archived_at,visibility&key=eq.${encodeURIComponent(body.plan || "")}`);
      if (!plan || plan.archived_at || (!plan.active && plan.key !== row.plan_key) || (plan.visibility === "hidden" && plan.key !== row.plan_key)) return json({ error: "This plan isn't available." }, 404);
      const currency = sub.currency;   // the currency chosen at sign-up stays
      const [target] = await rest(`membership_prices?select=amount,interval,stripe_price_id&plan_key=eq.${plan.key}&currency=eq.${currency}&interval=eq.${interval}&active=eq.true&legacy=eq.false`);
      if (!target?.stripe_price_id) return json({ error: `This plan isn't sold ${interval === "year" ? "yearly" : "monthly"} in ${currency.toUpperCase()}.` }, 404);
      if (target.stripe_price_id === item.price.id) return json({ error: "That's already your plan." }, 409);
      const current = { amount: (item.price.unit_amount || 0) / 100, interval: item.price.recurring?.interval || "month" };
      // upgrade = more per month, or monthly → yearly; it applies now. Otherwise at the end of the current period.
      const upgrade = monthly(target) > monthly(current) || (current.interval === "month" && interval === "year");
      // deno-lint-ignore no-explicit-any
      const anySub = sub as any;
      const periodEnd = anySub.current_period_end ?? (item as any).current_period_end;

      const trialing = sub.status === "trialing";
      if (body.action === "preview_change") {
        // In the free trial any change applies now and nothing is charged today; the first charge (at the end of the
        // trial, prorated to the 1st) is calculated by Stripe with the new price
        if (trialing) {
          const inv = await preview({ customer: sub.customer, subscription: sub.id,
            subscription_details: { items: [{ id: item.id, price: target.stripe_price_id, quantity: item.quantity || 1 }], proration_behavior: "none" } });
          return json({ upgrade: true, trial: true, applies_at: new Date().toISOString(), charge_now: 0, currency, new_price: Number(target.amount), interval,
            first_charge: inv.amount_due / 100, first_charge_at: new Date(((inv.next_payment_attempt || inv.period_end) as number) * 1000).toISOString() });
        }
        if (!upgrade) return json({ upgrade: false, applies_at: new Date(periodEnd * 1000).toISOString(), charge_now: 0, currency, new_price: Number(target.amount), interval });
        const inv = await preview({ customer: sub.customer, subscription: sub.id,
          subscription_details: { items: [{ id: item.id, price: target.stripe_price_id, quantity: item.quantity || 1 }], proration_behavior: "always_invoice", proration_date: Math.floor(Date.now() / 1000) } });
        return json({ upgrade: true, applies_at: new Date().toISOString(), charge_now: inv.amount_due / 100, currency: inv.currency, new_price: Number(target.amount), interval,
          note: current.interval !== interval ? "Switching to yearly starts a new yearly period today." : "Your renewal date stays the same (the 1st)." });
      }

      if (trialing) {
        if (sub.schedule && typeof sub.schedule === "object") await stripe.subscriptionSchedules.release((sub.schedule as Stripe.SubscriptionSchedule).id);
        await stripe.subscriptions.update(sub.id, { items: [{ id: item.id, price: target.stripe_price_id, quantity: item.quantity || 1 }], proration_behavior: "none", metadata: { ...sub.metadata, plan_key: plan.key, interval } });
        await audit(user.id, "member.change_in_trial", user.id, sub.id, { to: plan.key, interval });
        await syncSubscription(sub.id);
        return json({ ok: true, applied: "now" });
      }
      if (upgrade) {
        if (sub.schedule && typeof sub.schedule === "object") await stripe.subscriptionSchedules.release((sub.schedule as Stripe.SubscriptionSchedule).id);
        // applied only if the prorated invoice is paid (otherwise Stripe keeps the old plan and returns the invoice)
        const updated = await stripe.subscriptions.update(sub.id, {
          items: [{ id: item.id, price: target.stripe_price_id, quantity: item.quantity || 1 }],
          proration_behavior: "always_invoice",
          payment_behavior: "pending_if_incomplete",
          metadata: { ...sub.metadata, plan_key: plan.key, interval },
          expand: ["latest_invoice"],
        });
        await audit(user.id, "member.upgrade", user.id, sub.id, { to: plan.key, interval });
        await syncSubscription(sub.id);
        // deno-lint-ignore no-explicit-any
        const pending = (updated as any).pending_update;
        const inv = updated.latest_invoice as Stripe.Invoice | null;
        if (pending && inv?.hosted_invoice_url) return json({ ok: false, action_required: true, url: inv.hosted_invoice_url, error: "Your bank needs you to confirm the payment to finish the change." });
        return json({ ok: true, applied: "now" });
      }

      // Downgrade / yearly → monthly: a schedule switches the price when the current period ends
      const schedule = sub.schedule && typeof sub.schedule === "object"
        ? sub.schedule as Stripe.SubscriptionSchedule
        : await stripe.subscriptionSchedules.create({ from_subscription: sub.id });
      const cur = schedule.phases[schedule.phases.length - 1] || schedule.phases[0];
      await stripe.subscriptionSchedules.update(schedule.id, {
        end_behavior: "release",
        phases: [
          { items: [{ price: item.price.id, quantity: item.quantity || 1 }], start_date: cur.start_date, end_date: periodEnd, proration_behavior: "none" },
          { items: [{ price: target.stripe_price_id, quantity: item.quantity || 1 }], start_date: periodEnd, proration_behavior: "none", metadata: { plan_key: plan.key, interval } },
        ],
      });
      await audit(user.id, "member.downgrade_scheduled", user.id, sub.id, { to: plan.key, interval, at: new Date(periodEnd * 1000).toISOString() });
      await syncSubscription(sub.id);
      return json({ ok: true, applied: "period_end", at: new Date(periodEnd * 1000).toISOString() });
    }

    // Number of users (team seats, Stripe quantity): 1–5; more → custom plan. More seats apply now (the prorated
    // difference is charged today, nothing during the free trial); fewer apply now with a credit on the next invoice.
    if (body.action === "preview_seats" || body.action === "seats") {
      const seats = Math.round(Number(body.seats));
      const max = Number(((await setting("team")) || {}).max_seats) || 5;
      if (!(seats >= 1)) return json({ error: "Choose how many users you need." }, 400);
      if (seats > max) return json({ error: `For more than ${max} users, ask us for a custom plan.`, custom: true }, 400);
      if (!["active", "trialing", "past_due"].includes(sub.status)) return json({ error: "Your membership can't be changed right now." }, 409);
      if (sub.cancel_at_period_end) return json({ error: "Reactivate your membership first, then change the plan." }, 409);
      const now = item.quantity || 1;
      if (seats === now) return json({ error: "That's already your number of users." }, 409);
      const more = seats > now, trialing = sub.status === "trialing";
      const behavior = trialing ? "none" : more ? "always_invoice" : "create_prorations";
      const unit = (item.price.unit_amount || 0) / 100;
      if (body.action === "preview_seats") {
        let charge = 0, credit = 0;
        if (!trialing) {
          const inv = await preview({ customer: sub.customer, subscription: sub.id,
            subscription_details: { items: [{ id: item.id, quantity: seats }], proration_behavior: behavior, proration_date: Math.floor(Date.now() / 1000) } });
          if (more) charge = inv.amount_due / 100;
          // deno-lint-ignore no-explicit-any
          else credit = Math.abs(((inv as any).lines?.data || []).filter((l: any) => l.amount < 0).reduce((t: number, l: any) => t + l.amount, 0)) / 100;
        }
        return json({ seats, from: now, more, trial: trialing, charge_now: charge, credit, currency: sub.currency, unit, interval: item.price.recurring?.interval || "month", new_total: Math.round(unit * seats * 100) / 100 });
      }
      const updated = await stripe.subscriptions.update(sub.id, {
        items: [{ id: item.id, quantity: seats }], proration_behavior: behavior,
        ...(more && !trialing ? { payment_behavior: "pending_if_incomplete" as const } : {}),
        metadata: { ...sub.metadata, seats: String(seats) }, expand: ["latest_invoice"],
      });
      await audit(user.id, "member.seats", user.id, sub.id, { from: now, to: seats });
      await syncSubscription(sub.id);
      // deno-lint-ignore no-explicit-any
      const pending = (updated as any).pending_update;
      const inv = updated.latest_invoice as Stripe.Invoice | null;
      if (pending && inv?.hosted_invoice_url) return json({ ok: false, action_required: true, url: inv.hosted_invoice_url, error: "Your bank needs you to confirm the payment to finish the change." });
      return json({ ok: true, seats });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "We couldn't update your membership right now. Please try again in a moment." }, 500);
  }
});
