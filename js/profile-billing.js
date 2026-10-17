// Profile → "Plan & billing": current plan, free trial / renewal date, AI credits, and the Stripe customer portal
// (change plan, monthly ↔ yearly, card, invoices, cancel). Data: my_billing() + my_entitlements() (supabase/stripe.sql).
(() => {
  const box = document.querySelector("[data-billing]");
  const db = window.SCP_AUTH?.client;
  if (!box || !db) return;
  const icon = (n) => (window.SCP_ICONS ? window.SCP_ICONS(n) : "");
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const day = (v) => (v ? new Date(v).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "");
  const daysLeft = (v) => Math.max(0, Math.ceil((new Date(v) - Date.now()) / 864e5));

  (async () => {
    const [{ data: bill, error }, { data: ent }] = await Promise.all([db.rpc("my_billing"), db.rpc("my_entitlements")]);
    if (error) { box.innerHTML = `<p class="pf-billing-note">Billing isn't set up yet.</p>`; return; }
    const sub = bill?.subscription;
    const live = sub && ["active", "trialing", "past_due"].includes(sub.status);
    const portalBtn = bill?.has_customer ? `<button class="btn btn-outline" type="button" data-billing-portal>${icon("external-link")}Manage billing &amp; invoices</button>` : "";

    if (ent?.is_staff && !live) {
      box.innerHTML = `<div class="pf-plan"><div class="pf-plan-top"><span class="pf-plan-badge is-active">Team access</span><b>SCP team</b></div><p class="pf-billing-note">You have full access as part of the SCP team. No billing needed.</p></div>`;
      return;
    }
    if (!live) {
      box.innerHTML = `<div class="pf-plan is-empty">
        <p><b>${sub?.status === "canceled" ? `Your ${esc(sub.plan_name)} plan has ended.` : "You don't have a plan yet."}</b></p>
        <p class="pf-billing-note">${bill?.trial_used ? "Choose a plan to get full access again." : "Every plan starts with a 7-day free trial — you're not charged until it ends."}</p>
        <div class="pf-billing-actions"><a class="btn btn-gold" href="pricing.html">${bill?.trial_used ? "See plans" : "Start your free trial"}</a>${portalBtn}</div>
      </div>`;
      return;
    }
    const STATUS = { trialing: ["Free trial", "is-trial"], active: ["Active", "is-active"], past_due: ["Payment issue", "is-warn"] };
    const [label, cls] = STATUS[sub.status];
    const when = sub.status === "trialing"
      ? `Free trial until <b>${day(sub.current_period_end)}</b> (${daysLeft(sub.current_period_end)} days left). Your first payment is on that day — cancel before and you pay nothing.`
      : sub.status === "past_due"
        ? `We couldn't charge your card. Update your payment method to keep your access.`
        : sub.current_period_end ? `Renews on <b>${day(sub.current_period_end)}</b> · billed ${sub.interval === "year" ? "yearly" : "monthly"}.` : "";
    box.innerHTML = `<div class="pf-plan">
      <div class="pf-plan-top"><span class="pf-plan-badge ${cls}">${label}</span><b>${esc(sub.plan_name)}</b><span class="pf-plan-int">${sub.interval === "year" ? "Yearly" : "Monthly"}</span></div>
      ${when ? `<p class="pf-billing-note">${when}</p>` : ""}
      ${ent?.has_ai ? `<p class="pf-billing-credits">${icon("sparkles")}<span><b>${(ent.monthly_left || 0) + (ent.pack_left || 0)}</b> AI credits left${ent.pack_left ? ` (${ent.monthly_left} monthly + ${ent.pack_left} from packs)` : ""}${sub.status === "trialing" ? " · trial allowance" : ""}</span></p>` : ""}
      <div class="pf-billing-actions">
        ${sub.source === "stripe" ? `<button class="btn ${sub.status === "past_due" ? "btn-gold" : "btn-outline"}" type="button" data-billing-portal>${icon("external-link")}${sub.status === "past_due" ? "Update payment method" : "Manage billing &amp; invoices"}</button>` : `<span class="pf-billing-note">Plan assigned by the SCP team.</span>`}
        <a class="btn btn-outline" href="pricing.html">Compare plans</a>
        ${ent?.has_ai ? `<a class="btn btn-outline" href="pricing.html#packs">Buy AI credits</a>` : ""}
      </div>
      ${sub.source === "stripe" ? `<p class="pf-billing-fine">Change plan, switch to yearly, update your card, download invoices or cancel — all in the secure Stripe portal.</p>` : ""}
    </div>`;
  })();
})();
