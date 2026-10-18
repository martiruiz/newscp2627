// Supabase Edge Function "stripe-checkout": starts a Stripe Checkout for the signed-in member.
//   { kind: "plan", plan, interval: "month"|"year", currency: "eur"|"usd", link?: private token, code?: promo code, preview?: true }
//       → subscription. Card always required (also for the free trial). Monthly plans renew on the 1st (Europe/Madrid):
//         the first invoice is prorated to the 1st by Stripe (see _shared/billing-dates.js). preview: true returns the
//         terms shown before paying (trial end, first charge, renewals) without creating anything.
//   { kind: "pack", pack }  → one-time payment for AI credits (plans with AI only)
// Every price and discount is checked here and again by Stripe: the browser only sends ids and a code.
// Access is granted by "stripe-webhook" once Stripe confirms, never here.
import { config, CORS, currentUser, customerFor, json, rest, rpc, setting, siteUrl, stripe } from "../_shared/stripe.ts";
import { planBilling, unix } from "../_shared/billing-dates.js";

const LIVE = new Set(["active", "trialing", "past_due", "unpaid", "incomplete", "paused"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const user = await currentUser(req);
  if (!user?.id) return json({ error: "Sign in first" }, 401);
  const body = await req.json().catch(() => ({}));
  const site = siteUrl(req);

  try {
    if (body.kind === "plan") {
      const interval = body.interval === "year" ? "year" : "month";
      const currency = body.currency === "usd" ? "usd" : "eur";
      // number of users (team seats = Stripe quantity); more than the maximum → custom plan
      const maxSeats = Number(((await setting("team")) || {}).max_seats) || 5;
      const seats = Math.max(1, Math.round(Number(body.seats) || 1));
      if (seats > maxSeats) return json({ error: `For more than ${maxSeats} users, ask us for a custom plan.`, custom: true }, 400);
      const [plan] = await rest(`plans?select=key,name,active,archived_at,visibility,trial_enabled,trial_days,stripe_product_id&key=eq.${encodeURIComponent(body.plan || "")}`);
      if (!plan || plan.archived_at) return json({ error: "This plan isn't available" }, 404);

      // Hidden plans only through a valid private link (checked on the server); public plans must be on sale
      let linkId: string | null = null;
      if (plan.visibility === "hidden" || !plan.active) {
        const link = body.link ? await rpc("billing_private_link", { p_token: String(body.link) }) : null;
        if (!link?.id || link.plan_key !== plan.key) return json({ error: "This membership needs a valid private link." }, 403);
        linkId = link.id;
      }
      const [price] = await rest(`membership_prices?select=id,amount,stripe_price_id&plan_key=eq.${plan.key}&currency=eq.${currency}&interval=eq.${interval}&active=eq.true&legacy=eq.false`);
      if (!price) return json({ error: `This plan isn't sold ${interval === "year" ? "yearly" : "monthly"} in ${currency.toUpperCase()}.` }, 404);
      if (!price.stripe_price_id) return json({ error: "Payments for this plan aren't set up yet." }, 409);

      // One live subscription per member: change the plan instead of buying a second one
      const [sub] = await rest(`subscriptions?select=status,source,plan_key&user_id=eq.${user.id}`);
      if (sub?.source === "stripe" && LIVE.has(sub.status)) return json({ error: "You already have a membership. Change it from your account.", manage: true }, 409);

      const customer = await customerFor(user);
      const [cust] = await rest(`stripe_customers?select=currency&user_id=eq.${user.id}`);
      if (cust?.currency && cust.currency !== currency) return json({ error: `Your account is billed in ${cust.currency.toUpperCase()}. Choose ${cust.currency.toUpperCase()} prices.` }, 409);

      const eligible = await rpc("billing_trial_eligible", { p_user: user.id });
      const trialDays = plan.trial_enabled && plan.trial_days > 0 && eligible ? plan.trial_days : 0;
      const tz = (await setting("timezone")) || "Europe/Madrid";
      const now = new Date();
      const dates = planBilling({ interval, trialDays, now, tz });

      // Discount code (our rules: plan, currency, interval, dates, limits per customer) → Stripe promotion code
      let discount: { id: string; code: string; promotion_code: string; kind: string; percent_off?: number; amount_off?: number; duration: string; duration_months?: number } | null = null;
      if (body.code) {
        const d = await rpc("billing_check_discount", { p_code: String(body.code), p_user: user.id, p_plan: plan.key, p_currency: currency, p_interval: interval });
        if (!d?.ok) return json({ error: d?.error || "This code isn't valid." }, 400);
        discount = d;
      }

      const taxMode = ((await setting("tax")) || {}).mode || "none";
      // What the member sees before paying. Without a trial, Stripe calculates the exact first invoice (prorated to the 1st).
      let firstCharge: { amount: number; currency: string; exact: boolean } | null = null;
      if (!dates.trialEnd) {
        try {
          // deno-lint-ignore no-explicit-any
          const inv: any = await (stripe.invoices as any).createPreview({
            customer: customer.customer_id,
            subscription_details: { items: [{ price: price.stripe_price_id, quantity: seats }], ...(dates.anchor ? { billing_cycle_anchor: unix(dates.anchor) } : {}), proration_behavior: dates.prorate ? "create_prorations" : "none" },
            ...(discount ? { discounts: [{ promotion_code: discount.promotion_code }] } : {}),
            ...(taxMode === "stripe_tax" ? { automatic_tax: { enabled: true } } : {}),
          });
          firstCharge = { amount: inv.amount_due / 100, currency: inv.currency, exact: true };
        } catch (e) { console.error("preview", e); }
      }
      const terms = {
        plan: plan.name, interval, currency, price: Number(price.amount) * seats, unit_price: Number(price.amount), seats, trial_days: trialDays,
        trial_end: dates.trialEnd?.toISOString() || null,
        first_charge_at: (dates.trialEnd || now).toISOString(),
        first_charge: firstCharge,                        // trial: Stripe calculates it at the end of the trial (e-mailed 3 days before)
        prorated_until: dates.prorate && dates.anchor ? dates.anchor.toISOString() : null,
        full_charges_from: (dates.anchor || dates.start).toISOString(),
        renews: interval === "month" ? "on the 1st of every month" : "every year on the same date",
        discount: discount ? { code: discount.code, kind: discount.kind, percent_off: discount.percent_off, amount_off: discount.amount_off, duration: discount.duration, duration_months: discount.duration_months } : null,
      };
      if (body.preview) return json({ terms });

      const taxRate = taxMode === "fixed_rate" ? await config("tax_rate") : null;
      const checkoutCfg = (await setting("checkout")) || {};
      const meta = { user_id: user.id, plan_key: plan.key, interval, currency, seats: String(seats), ...(linkId ? { private_link: linkId } : {}), ...(discount ? { discount_id: discount.id, discount_code: discount.code } : {}) };
      const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: tz });
      const note = dates.trialEnd
        ? `Free until ${fmt(dates.trialEnd)}. No charge before then — cancel any time.${interval === "month" ? ` Then a prorated charge until ${fmt(dates.anchor || dates.trialEnd)} and the full price on the 1st of every month.` : " Then billed yearly."}`
        : interval === "month" && dates.prorate ? `Today you pay the days until ${fmt(dates.anchor!)}. Then the full price on the 1st of every month.` : "";

      // With a free trial: Stripe Checkout can't combine a trial with the day-1 anchor, so Checkout only saves and verifies
      // the card (setup mode, 3-D Secure if the bank asks, nothing charged) and the webhook creates the subscription with
      // exactly these dates (validated with Stripe test clocks: pipeline/stripe/test-clocks.mjs).
      // Without a trial: a normal subscription Checkout with the anchor (first invoice prorated to the 1st).
      const plan_meta = {
        ...meta, price: price.stripe_price_id,
        ...(dates.trialEnd ? { trial_end: String(unix(dates.trialEnd)) } : {}),
        ...(dates.anchor ? { anchor: String(unix(dates.anchor)) } : {}),
        prorate: dates.prorate ? "1" : "0",
        ...(discount ? { promotion_code: discount.promotion_code } : {}),
        tax_mode: taxMode,
      };
      const common = {
        customer: customer.customer_id,
        client_reference_id: user.id,
        ...(checkoutCfg.require_terms_consent ? { consent_collection: { terms_of_service: "required" as const } } : {}),
        customer_update: { name: "auto" as const, address: "auto" as const },
        locale: (body.lang === "es" ? "es" : body.lang === "en" ? "en" : "auto") as "es" | "en" | "auto",
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60,   // the dates above stay accurate
        ...(note ? { custom_text: { submit: { message: note.slice(0, 1200) } } } : {}),
        success_url: `${site}/profile.html?checkout=success#billing`,
        cancel_url: `${site}/pricing.html?checkout=cancel`,
      };
      const session = dates.trialEnd
        ? await stripe.checkout.sessions.create({
            ...common,
            mode: "setup",
            currency,
            payment_method_types: ["card"],
            billing_address_collection: taxMode === "stripe_tax" ? "required" : "auto",
            setup_intent_data: { metadata: plan_meta },
            metadata: { ...plan_meta, kind: "trial_subscription" },
          })
        : await stripe.checkout.sessions.create({
            ...common,
            mode: "subscription",
            line_items: [{ price: price.stripe_price_id, quantity: seats }],
            subscription_data: {
              ...(dates.anchor ? { billing_cycle_anchor: unix(dates.anchor), proration_behavior: dates.prorate ? "create_prorations" as const : "none" as const } : {}),
              ...(taxRate ? { default_tax_rates: [taxRate] } : {}),
              metadata: meta,
            },
            ...(discount ? { discounts: [{ promotion_code: discount.promotion_code }] } : { allow_promotion_codes: false }),
            payment_method_collection: "always",
            ...(taxMode === "stripe_tax" ? { automatic_tax: { enabled: true }, billing_address_collection: "required" as const } : { billing_address_collection: "auto" as const }),
            ...(checkoutCfg.collect_tax_id !== false ? { tax_id_collection: { enabled: true } } : {}),
            metadata: meta,
          });
      return json({ url: session.url, terms });
    }

    if (body.kind === "pack") {
      const customer = await customerFor(user);
      const taxMode = ((await setting("tax")) || {}).mode || "none";
      const taxRate = taxMode === "fixed_rate" ? await config("tax_rate") : null;
      const [pack] = await rest(`ai_packs?select=key,name,active,stripe_price&key=eq.${encodeURIComponent(body.pack || "")}`);
      if (!pack?.active) return json({ error: "This pack isn't available" }, 404);
      if (!pack.stripe_price) return json({ error: "Payments for packs aren't set up yet" }, 409);
      const ent = await rpc("entitlements", { p_user: user.id });
      if (!ent?.has_ai) return json({ error: "AI packs are for plans with AI analyses. Choose Library + AI or All Access first." }, 403);
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer: customer.customer_id,
        client_reference_id: user.id,
        line_items: [{ price: pack.stripe_price, quantity: 1, ...(taxRate ? { tax_rates: [taxRate] } : {}) }],
        ...(taxMode === "stripe_tax" ? { automatic_tax: { enabled: true }, billing_address_collection: "required" } : {}),
        invoice_creation: { enabled: true },
        tax_id_collection: { enabled: true },
        customer_update: { name: "auto", address: "auto" },
        locale: body.lang === "es" ? "es" : body.lang === "en" ? "en" : "auto",
        metadata: { user_id: user.id, pack_key: pack.key },
        payment_intent_data: { metadata: { user_id: user.id, pack_key: pack.key } },
        success_url: `${site}/content-library.html?checkout=success&pack=${encodeURIComponent(pack.key)}`,
        cancel_url: `${site}/pricing.html?checkout=cancel#packs`,
      });
      return json({ url: session.url });
    }

    return json({ error: "Unknown checkout" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "We couldn't start the payment. Please try again in a moment." }, 500);
  }
});
