// Account → "Billing & Membership": plan, status, price and currency, billing period, dates (start, trial end, next
// charge — Stripe's exact amount), included features, AI quota, card, invoices; change plan (with the cost shown first),
// monthly ↔ yearly, cancel / reactivate, card and billing details (Stripe portal).
// Data: my_membership() (supabase/memberships.sql) + Edge Function "stripe-manage" (live Stripe details and actions).
// Falls back to my_billing() + my_entitlements() on an older database.
(() => {
  const box = document.querySelector("[data-billing]");
  const db = window.SCP_AUTH?.client;
  const cfg = window.SCP_CONFIG || {};
  if (!box || !db) return;
  const icon = (n) => (window.SCP_ICONS ? window.SCP_ICONS(n) : "");
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const TZ = "Europe/Madrid";
  const day = (v) => (v ? new Date(v).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: TZ }) : "");
  const money = (n, cur) => (n == null ? "" : new Intl.NumberFormat("en-GB", { style: "currency", currency: String(cur || "eur").toUpperCase() }).format(Number(n)));
  const daysLeft = (v) => Math.max(0, Math.ceil((new Date(v) - Date.now()) / 864e5));
  const notify = (t, kind) => window.SCP_CHECKOUT?.notify(t, { kind });

  async function manage(body) {
    const s = (await db.auth.getSession()).data.session;
    const r = await fetch(`${cfg.supabaseUrl}/functions/v1/stripe-manage`, { method: "POST",
      headers: { "Content-Type": "application/json", apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${s?.access_token}` }, body: JSON.stringify(body) }).catch(() => null);
    const data = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) throw new Error(data.error || "We couldn't reach the billing service. Please try again.");
    return data;
  }

  const STATUS = {
    trialing: ["Free trial", "is-trial"], active: ["Active", "is-active"], past_due: ["Payment issue", "is-warn"], unpaid: ["Unpaid", "is-warn"],
    paused: ["Paused", "is-warn"], canceled: ["Ended", ""], incomplete: ["Payment pending", "is-warn"], incomplete_expired: ["Not completed", ""], granted: ["Granted", "is-active"],
  };
  let m = null, live = null, plans = null;

  function invoicesHtml(list) {
    if (!list?.length) return "";
    return `<details class="pf-invoices"${list.length <= 3 ? " open" : ""}><summary>${icon("file-text")}Invoices and payments <span>${list.length}</span></summary>
      <table><thead><tr><th>Date</th><th>Invoice</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>
      ${list.map((i) => `<tr><td>${day(i.created_at)}</td><td>${esc(i.number || "—")}</td><td>${money(i.total, i.currency)}</td>
        <td><span class="pf-inv-st is-${esc(i.status)}">${esc(i.status === "paid" ? "Paid" : i.status === "open" ? "Due" : i.status === "void" ? "Void" : i.status || "")}</span></td>
        <td>${i.invoice_pdf ? `<a href="${esc(i.invoice_pdf)}" target="_blank" rel="noopener">PDF</a>` : ""}${i.hosted_invoice_url ? ` <a href="${esc(i.hosted_invoice_url)}" target="_blank" rel="noopener">${i.status === "open" ? "Pay" : "View"}</a>` : ""}</td></tr>`).join("")}
      </tbody></table></details>`;
  }

  function quotaHtml(ent) {
    if (!ent?.has_ai) return "";
    if (ent.ai_unlimited) return `<p class="pf-billing-credits">${icon("sparkles")}<span><b>Unlimited</b> AI analyses</span></p>`;
    const used = ent.monthly_used || 0, lim = ent.monthly_limit || 0;
    const pct = lim ? Math.min(100, Math.round((used / lim) * 100)) : 0;
    return `<div class="pf-quota"><div class="pf-quota-top">${icon("sparkles")}<span><b>${ent.monthly_left}</b> of ${lim} AI analyses left this month${ent.pack_left ? ` · +${ent.pack_left} from packs` : ""}</span></div>
      <div class="pf-quota-bar"><i style="width:${pct}%"></i></div>${ent.cycle_end ? `<small>Resets on ${day(ent.cycle_end)}</small>` : ""}</div>`;
  }

  function render() {
    const sub = m?.subscription, ent = m?.entitlements;
    if (ent?.is_staff && !(sub && ["active", "trialing", "past_due"].includes(sub.status))) {
      box.innerHTML = `<div class="pf-plan"><div class="pf-plan-top"><span class="pf-plan-badge is-active">Team access</span><b>SCP team</b></div><p class="pf-billing-note">You have full access as part of the SCP team. No billing needed.</p></div>`;
      return;
    }
    const st = ent?.status === "granted" ? "granted" : sub?.status;
    const liveSub = sub && ["active", "trialing", "past_due", "unpaid", "paused", "incomplete"].includes(sub.status);
    if (!liveSub && st !== "granted") {
      box.innerHTML = `<div class="pf-plan is-empty">
        <p><b>${sub?.status === "canceled" ? `Your ${esc(sub.plan_name)} membership ended on ${day(sub.ended_at || sub.current_period_end)}.` : "You don't have a membership yet."}</b></p>
        <p class="pf-billing-note">${m?.trial_eligible ? "Every plan starts with a free trial — you're not charged until it ends." : "Choose a plan to get full access again. Your saved boards and content plans are still here."}</p>
        <div class="pf-billing-actions"><a class="btn btn-gold" href="pricing.html">${m?.trial_eligible ? "Start your free trial" : "See plans"}</a>${m?.has_customer ? `<button class="btn btn-outline" type="button" data-bill="portal">${icon("external-link")}Invoices and billing details</button>` : ""}</div>
        ${invoicesHtml(m?.invoices)}
      </div>`;
      return;
    }
    if (st === "granted") {
      box.innerHTML = `<div class="pf-plan"><div class="pf-plan-top"><span class="pf-plan-badge is-active">Granted</span><b>${esc(ent.plan_name || "Access")}</b></div>
        <p class="pf-billing-note">Access given by the SCP team — no billing.</p>${quotaHtml(ent)}<div class="pf-billing-actions"><a class="btn btn-outline" href="pricing.html">See plans</a></div></div>`;
      return;
    }
    const [label, cls] = STATUS[sub.status] || [sub.status, ""];
    const per = sub.interval === "year" ? "year" : "month";
    const next = live?.next;
    const facts = [
      ["Plan", `${esc(sub.plan_name)}`],
      ["Price", sub.amount != null ? `${money(sub.amount, sub.currency)} / ${per} · ${sub.currency === "usd" ? "plus tax where applicable" : "VAT included"}` : "—"],
      ["Billing", sub.interval === "year" ? "Yearly, on the anniversary" : "Monthly, on the 1st of every month"],
      ["Member since", day(sub.started_at)],
    ];
    if (sub.status === "trialing" && sub.trial_end) facts.push(["Trial ends", `${day(sub.trial_end)} · ${daysLeft(sub.trial_end)} days left`]);
    if (sub.cancel_at_period_end) facts.push(["Access until", `<b>${day(sub.cancel_at || sub.current_period_end)}</b> · no more charges`]);
    else if (next) facts.push(["Next charge", `<b>${money(next.amount, next.currency)}</b> on ${day(next.at)}`]);
    else if (sub.current_period_end) facts.push(["Next renewal", day(sub.current_period_end)]);
    if (sub.pending_plan) facts.push(["Scheduled change", `${esc(sub.pending_plan_name || sub.pending_plan)}${sub.pending_interval ? ` (${sub.pending_interval === "year" ? "yearly" : "monthly"})` : ""} from ${day(sub.pending_change_at)} <button class="link-gold" type="button" data-bill="undo">Undo</button>`]);
    if (live?.card) facts.push(["Card", `${esc(live.card.brand.toUpperCase())} •••• ${esc(live.card.last4)} · expires ${String(live.card.exp_month).padStart(2, "0")}/${String(live.card.exp_year).slice(-2)} <button class="link-gold" type="button" data-bill="card">Update</button>`]);
    if (sub.discount_code) facts.push(["Discount", esc(sub.discount_code)]);

    const problem = ["past_due", "unpaid", "incomplete"].includes(sub.status) || m?.open_problem;
    box.innerHTML = `<div class="pf-plan">
      <div class="pf-plan-top"><span class="pf-plan-badge ${cls}">${label}</span><b>${esc(sub.plan_name)}</b><span class="pf-plan-int">${sub.interval === "year" ? "Yearly" : "Monthly"} · ${String(sub.currency || "eur").toUpperCase()}</span></div>
      ${problem ? `<div class="pf-alert">${icon("zap")}<div><b>We couldn't take your last payment${m?.open_problem ? ` of ${money(m.open_problem.amount_due, m.open_problem.currency)}` : ""}.</b> Update your card to keep your access${m?.open_problem?.next_attempt ? ` — we'll try again on ${day(m.open_problem.next_attempt)}` : ""}.
        <div class="pf-alert-actions"><button class="btn btn-gold" type="button" data-bill="card">Update payment method</button>${m?.open_problem?.url || live?.open_invoice?.url ? `<a class="btn btn-outline" href="${esc(m?.open_problem?.url || live.open_invoice.url)}" target="_blank" rel="noopener">Pay the invoice</a>` : ""}</div></div></div>` : ""}
      ${sub.status === "trialing" && !sub.cancel_at_period_end ? `<p class="pf-billing-note">Your free trial runs until <b>${day(sub.trial_end)}</b>. ${sub.interval === "month" ? "The first charge then covers the days until the 1st; after that you pay the full price on the 1st of every month." : "Then your yearly plan starts."} Cancel before and you pay nothing.</p>` : ""}
      <dl class="pf-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
      ${Array.isArray(sub.features) && sub.features.length ? `<ul class="pf-included">${sub.features.map((f) => `<li>${icon("check")}${esc(f)}</li>`).join("")}</ul>` : ""}
      ${quotaHtml(ent)}
      <div class="pf-billing-actions">
        ${sub.cancel_at_period_end
          ? `<button class="btn btn-gold" type="button" data-bill="reactivate">Keep my membership</button>`
          : `<button class="btn btn-outline" type="button" data-bill="change">Change plan</button>${sub.interval === "month" ? `<button class="btn btn-outline" type="button" data-bill="yearly">Switch to yearly</button>` : ""}`}
        <button class="btn btn-outline" type="button" data-bill="portal">${icon("external-link")}Billing details &amp; invoices</button>
        ${ent?.has_ai ? `<a class="btn btn-outline" href="pricing.html#packs">Buy AI credits</a>` : ""}
        ${!sub.cancel_at_period_end ? `<button class="pf-cancel" type="button" data-bill="cancel">Cancel membership</button>` : ""}
      </div>
      <div data-bill-panel></div>
      ${invoicesHtml(m?.invoices)}
    </div>`;
  }

  // ---------- Change plan: pick → see Stripe's numbers → confirm ----------
  async function loadPlans() {
    if (plans) return plans;
    const { data } = await db.rpc("public_membership_plans");
    plans = data?.plans || [];
    return plans;
  }
  async function changePanel(preselect, intervalPick) {
    const panel = box.querySelector("[data-bill-panel]");
    const sub = m.subscription;
    const list = (await loadPlans()).filter((p) => p.prices.some((x) => x.currency === sub.currency && x.ready));
    let iv = intervalPick || sub.interval;
    const draw = () => {
      panel.innerHTML = `<div class="pf-change">
        <div class="pf-change-head"><b>Change your plan</b><div class="plan-interval pf-iv"><button type="button" aria-selected="${iv === "month"}" data-iv="month">Monthly</button><button type="button" aria-selected="${iv === "year"}" data-iv="year">Yearly</button></div></div>
        <div class="pf-change-list">${list.map((p) => { const pr = p.prices.find((x) => x.currency === sub.currency && x.interval === iv);
          const cur = p.key === sub.plan && iv === sub.interval;
          return `<button type="button" class="pf-change-opt${cur ? " is-current" : ""}" ${cur || !pr?.ready ? "disabled" : ""} data-pick="${esc(p.key)}"><b>${esc(p.name)}</b><span>${pr ? `${money(pr.amount, sub.currency)} / ${iv === "year" ? "year" : "month"}` : "Not available"}</span>${cur ? "<em>Current</em>" : ""}</button>`; }).join("")}</div>
        <div data-change-terms></div></div>`;
    };
    draw();
    panel.onclick = async (e) => {
      const ivb = e.target.closest("[data-iv]");
      if (ivb) { iv = ivb.dataset.iv; draw(); return; }
      const pick = e.target.closest("[data-pick]");
      if (pick) {
        panel.querySelectorAll("[data-pick]").forEach((b) => b.classList.toggle("is-on", b === pick));
        const t = panel.querySelector("[data-change-terms]");
        t.innerHTML = `<p class="pf-billing-note">Checking the exact amount…</p>`;
        try {
          const pv = await manage({ action: "preview_change", plan: pick.dataset.pick, interval: iv });
          t.innerHTML = `<div class="pf-change-terms">${pv.trial
            ? `<p>Applies <b>now</b> and you're still in your free trial: <b>nothing is charged today</b>. Your first charge, on ${day(pv.first_charge_at)}, will be <b>${money(pv.first_charge, pv.currency)}</b> (the days until the 1st), then ${money(pv.new_price, pv.currency)} / ${pv.interval === "year" ? "year" : "month"}.</p>`
            : pv.upgrade
            ? `<p>Applies <b>now</b>. You pay <b>${money(pv.charge_now, pv.currency)}</b> today for the rest of this period, then ${money(pv.new_price, pv.currency)} / ${pv.interval === "year" ? "year" : "month"}. ${esc(pv.note || "")}</p>`
            : `<p>Applies on <b>${day(pv.applies_at)}</b>, at the end of the period you've paid. Nothing is charged today; then ${money(pv.new_price, pv.currency)} / ${pv.interval === "year" ? "year" : "month"}. You keep your current features until then.</p>`}
            <div class="pf-billing-actions"><button class="btn btn-gold" type="button" data-confirm="${esc(pick.dataset.pick)}" data-civ="${iv}">${pv.trial ? "Switch plan" : pv.upgrade ? `Pay ${money(pv.charge_now, pv.currency)} and switch` : "Schedule the change"}</button><button class="btn btn-outline" type="button" data-bill="close">Cancel</button></div></div>`;
        } catch (err) { t.innerHTML = `<p class="pf-billing-note is-err">${esc(err.message)}</p>`; }
        return;
      }
      const conf = e.target.closest("[data-confirm]");
      if (conf) {
        conf.disabled = true; conf.textContent = "Updating…";
        try {
          const r = await manage({ action: "change", plan: conf.dataset.confirm, interval: conf.dataset.civ });
          if (r.action_required && r.url) { location.href = r.url; return; }
          notify(r.applied === "now" ? "Your plan has been changed." : `Done — your plan changes on ${day(r.at)}.`, "is-ok");
          await load();
        } catch (err) { conf.disabled = false; notify(err.message, "is-err"); }
      }
    };
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    if (preselect) panel.querySelector(`[data-pick="${CSS.escape(preselect)}"]:not([disabled])`)?.click();
  }

  function cancelPanel() {
    const panel = box.querySelector("[data-bill-panel]");
    const sub = m.subscription;
    const until = sub.status === "trialing" ? sub.trial_end : sub.current_period_end;
    panel.innerHTML = `<div class="pf-change pf-cancel-box">
      <b>Cancel your membership?</b>
      <p class="pf-billing-note">${sub.status === "trialing" ? `Your trial ends on <b>${day(until)}</b> and you won't be charged.` : `You keep full access until <b>${day(until)}</b> and won't be charged again.`} Your saved boards and content plans stay in your account. You can change your mind before that date.</p>
      <label class="pf-cancel-why">Anything we could do better? <span>(optional)</span><textarea rows="2" maxlength="500" data-why></textarea></label>
      <div class="pf-billing-actions"><button class="btn btn-outline" type="button" data-bill="close">Keep my membership</button><button class="btn pf-danger" type="button" data-bill="confirm-cancel">Cancel membership</button></div></div>`;
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  box.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-bill]");
    if (!b) return;
    const a = b.dataset.bill;
    try {
      if (a === "portal" || a === "card") { b.disabled = true; const r = await manage({ action: "portal", flow: a === "card" ? "payment_method" : undefined }); location.href = r.url; return; }
      if (a === "change") return changePanel();
      if (a === "yearly") return changePanel(null, "year");
      if (a === "cancel") return cancelPanel();
      if (a === "close") { box.querySelector("[data-bill-panel]").innerHTML = ""; return; }
      if (a === "confirm-cancel") { b.disabled = true; await manage({ action: "cancel", reason: box.querySelector("[data-why]")?.value || "" }); notify("Your membership is cancelled. You keep access until the end of the period.", "is-ok"); return load(); }
      if (a === "reactivate") { b.disabled = true; await manage({ action: "reactivate" }); notify("Great — your membership continues as usual.", "is-ok"); return load(); }
      if (a === "undo") { b.disabled = true; await manage({ action: "undo_change" }); notify("The scheduled change was removed.", "is-ok"); return load(); }
    } catch (err) { b.disabled = false; notify(err.message, "is-err"); }
  });

  async function load() {
    const r = await db.rpc("my_membership");
    if (r.error) {
      // older database (before memberships.sql): basic view
      const [{ data: bill }, { data: ent }] = await Promise.all([db.rpc("my_billing"), db.rpc("my_entitlements")]);
      m = { subscription: bill?.subscription ? { ...bill.subscription, features: [] } : null, entitlements: ent, has_customer: bill?.has_customer, trial_eligible: !bill?.trial_used, invoices: [] };
    } else m = r.data;
    live = null;
    render();
    if (m?.subscription?.source === "stripe" && ["active", "trialing", "past_due", "unpaid", "incomplete"].includes(m.subscription.status)) {
      try { live = await manage({ action: "summary" }); render(); } catch { /* the database view is enough */ }
    }
    const q = new URLSearchParams(location.search);
    if (q.get("change") && m?.subscription?.source === "stripe") { changePanel(q.get("change"), q.get("interval")); history.replaceState(null, "", location.pathname + location.hash); }
  }
  load().catch(() => { box.innerHTML = `<p class="pf-billing-note">Billing isn't available right now. Please try again later.</p>`; });
})();
