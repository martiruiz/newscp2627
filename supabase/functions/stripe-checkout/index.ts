// Supabase Edge Function "stripe-checkout": starts a Stripe Checkout for the signed-in member.
//   { kind: "plan", plan: "all_access", interval: "month" | "year" } → subscription, 7-day free trial (card required)
//                                                                      the first time, VAT included
//   { kind: "pack", pack: "pack_30" }                                → one-time payment for AI credits (plans with AI only)
// Returns { url } to redirect to. A member who already pays a Stripe subscription gets the customer portal instead
// (to change plan there). Access is granted by the "stripe-webhook" function, never here.
import { config, CORS, currentUser, customerFor, json, rest, rpc, siteUrl, stripe } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const user = await currentUser(req);
  if (!user?.id) return json({ error: "Sign in first" }, 401);
  const body = await req.json().catch(() => ({}));
  const site = siteUrl(req);

  try {
    const customer = await customerFor(user);
    const taxRate = await config("tax_rate");

    if (body.kind === "plan") {
      const interval = body.interval === "year" ? "year" : "month";
      const [plan] = await rest(`plans?select=key,name,active,trial_days,stripe_price_month,stripe_price_year&key=eq.${encodeURIComponent(body.plan || "")}`);
      if (!plan?.active) return json({ error: "This plan isn't available" }, 404);
      const price = interval === "year" ? plan.stripe_price_year : plan.stripe_price_month;
      if (!price) return json({ error: "Payments for this plan aren't set up yet" }, 409);

      // Already paying with Stripe → manage / switch the plan in the customer portal
      const [sub] = await rest(`subscriptions?select=status,source&user_id=eq.${user.id}`);
      if (sub?.source === "stripe" && ["active", "trialing", "past_due"].includes(sub.status)) {
        const portalConfig = await config("portal_config");
        const p = await stripe.billingPortal.sessions.create({ customer: customer.customer_id, return_url: `${site}/profile.html#billing`, ...(portalConfig ? { configuration: portalConfig } : {}) });
        return json({ url: p.url, portal: true });
      }

      const trial = !customer.trial_used && plan.trial_days > 0 ? plan.trial_days : 0;
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customer.customer_id,
        client_reference_id: user.id,
        line_items: [{ price, quantity: 1 }],
        subscription_data: {
          ...(trial ? { trial_period_days: trial } : {}),
          ...(taxRate ? { default_tax_rates: [taxRate] } : {}),
          metadata: { user_id: user.id, plan_key: plan.key, interval },
        },
        payment_method_collection: "always",          // card required, also for the trial
        allow_promotion_codes: true,
        billing_address_collection: "auto",
        tax_id_collection: { enabled: true },          // companies can add their VAT number to the invoice
        customer_update: { name: "auto", address: "auto" },
        locale: "auto",
        metadata: { user_id: user.id, plan_key: plan.key, interval },
        success_url: `${site}/content-library.html?checkout=success&plan=${encodeURIComponent(plan.key)}`,
        cancel_url: `${site}/pricing.html?checkout=cancel`,
      });
      return json({ url: session.url });
    }

    if (body.kind === "pack") {
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
        invoice_creation: { enabled: true },
        allow_promotion_codes: true,
        tax_id_collection: { enabled: true },
        customer_update: { name: "auto", address: "auto" },
        locale: "auto",
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
