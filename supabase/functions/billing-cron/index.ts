// Supabase Edge Function "billing-cron": daily memberships housekeeping (GitHub Actions "billing-daily", or a superadmin
// from Memberships → Billing events). Header x-cron-secret = CRON_SECRET.
//   1. "access ending" e-mails ~3 days before a cancelled membership ends (setting emails.access_end_reminder_days)
//   1b. "trial tips" e-mails on day 2 of a free trial
//   2. "card expiring" e-mails for active members whose card expires this month (once per card and month)
//   3. reconciliation with Stripe (fixes anything a lost webhook left behind, reports differences)
//   4. sends the e-mail queue
import { CORS, cronAllowed, env, json, rest, rpc, setting, stripe, Stripe, superadmin } from "../_shared/stripe.ts";
import { reconcile } from "../_shared/reconcile.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const admin = cronAllowed(req) ? null : await superadmin(req);
  if (!cronAllowed(req) && !admin) return json({ error: "Not allowed" }, 403);
  const out: Record<string, unknown> = {};
  try {
    const cfg = (await setting("emails")) || {};
    const days = Number(cfg.access_end_reminder_days ?? 3);
    const until = new Date(Date.now() + days * 864e5).toISOString(), now = new Date().toISOString();
    const ending = await rest(`subscriptions?select=user_id,stripe_subscription_id,current_period_end,cancel_at,plan_key&cancel_at_period_end=eq.true&status=in.(active,trialing,past_due)&current_period_end=gte.${now}&current_period_end=lte.${until}`);
    let reminders = 0;
    for (const s of ending) {
      const id = await rpc("billing_enqueue_email", { p_template: "access_ending", p_user: s.user_id, p_vars: { access_until: s.cancel_at || s.current_period_end },
        p_dedupe: `access_ending:${s.stripe_subscription_id}:${(s.cancel_at || s.current_period_end).slice(0, 10)}` });
      if (id) reminders++;
    }
    out.access_ending = reminders;

    // trial day 2: tips to get more out of the trial (day 0 = the welcome, day 4 = "trial ending" from Stripe)
    const from = new Date(Date.now() - 3 * 864e5).toISOString(), to = new Date(Date.now() - 2 * 864e5).toISOString();
    const trials = await rest(`subscriptions?select=user_id,stripe_subscription_id,trial_start&status=eq.trialing&trial_start=gte.${from}&trial_start=lt.${to}`);
    let tips = 0;
    for (const s of trials) {
      const id = await rpc("billing_enqueue_email", { p_template: "trial_tips", p_user: s.user_id, p_vars: {}, p_dedupe: `trial_tips:${s.stripe_subscription_id || s.user_id}` });
      if (id) tips++;
    }
    out.trial_tips = tips;

    if (env("STRIPE_SECRET_KEY").startsWith("sk_")) {
      const active = await rest(`subscriptions?select=user_id,stripe_subscription_id&source=eq.stripe&status=in.(active,trialing)&cancel_at_period_end=eq.false`);
      const ym = new Date().toISOString().slice(0, 7);
      let cards = 0;
      for (const s of active) {
        if (!s.stripe_subscription_id) continue;
        try {
          const sub = await stripe.subscriptions.retrieve(s.stripe_subscription_id, { expand: ["default_payment_method"] });
          const card = (sub.default_payment_method as Stripe.PaymentMethod | null)?.card;
          if (card && `${card.exp_year}-${String(card.exp_month).padStart(2, "0")}` === ym) {
            const id = await rpc("billing_enqueue_email", { p_template: "card_expiring", p_user: s.user_id, p_vars: {}, p_dedupe: `card_expiring:${s.stripe_subscription_id}:${card.last4}:${ym}` });
            if (id) cards++;
          }
        } catch (e) { console.error("card check", e); }
      }
      out.card_expiring = cards;
      const rec = await reconcile(admin?.id || null);
      out.reconcile = { checked: rec.checked, differences: rec.differences.length };
    } else out.reconcile = "Stripe not connected";

    const r = await fetch(`${env("SUPABASE_URL")}/functions/v1/send-emails`, { method: "POST", headers: { "x-cron-secret": env("CRON_SECRET"), "Content-Type": "application/json" }, body: "{}" });
    out.emails = await r.json().catch(() => null);
    return json(out);
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error).message || e), ...out }, 500);
  }
});
