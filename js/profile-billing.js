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
  const day = (v) => (v ? new Date(v).toLocaleDateString(window.SCP_LOC || "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: TZ }) : "");
  const money = (n, cur) => (n == null ? "" : new Intl.NumberFormat(window.SCP_LOC || "en-GB", { style: "currency", currency: String(cur || "eur").toUpperCase() }).format(Number(n)));
  const perOf = (iv) => tx(iv === "year" ? "year" : "month");
  const daysLeft = (v) => Math.max(0, Math.ceil((new Date(v) - Date.now()) / 864e5));
  const notify = (t, kind) => window.SCP_CHECKOUT?.notify(t, { kind });

  async function manage(body) {
    const s = (await db.auth.getSession()).data.session;
    const r = await fetch(`${cfg.supabaseUrl}/functions/v1/stripe-manage`, { method: "POST",
      headers: { "Content-Type": "application/json", apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${s?.access_token}` }, body: JSON.stringify({ ...body, lang: window.SCP_LANG || "en" }) }).catch(() => null);
    const data = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) throw new Error(data.error || "We couldn't reach the billing service. Please try again.");
    return data;
  }

  const STATUS = {
    trialing: ["Free trial", "is-trial"], active: ["Active", "is-active"], past_due: ["Payment issue", "is-warn"], unpaid: ["Unpaid", "is-warn"],
    paused: ["Paused", "is-warn"], canceled: ["Ended", ""], incomplete: ["Payment pending", "is-warn"], incomplete_expired: ["Not completed", ""], granted: ["Granted", "is-active"],
  };
  let m = null, live = null, plans = null, myEmail = "";
  const MAX_SEATS = 5;

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
    if (ent.ai_unlimited) return `<p class="pf-billing-credits">${icon("sparkles")}<span>${tx("<b>Unlimited</b> AI analyses")}</span></p>`;
    const used = ent.monthly_used || 0, lim = ent.monthly_limit || 0;
    const pct = lim ? Math.min(100, Math.round((used / lim) * 100)) : 0;
    return `<div class="pf-quota"><div class="pf-quota-top">${icon("sparkles")}<span>${tx("<b>{left}</b> of {limit} AI analyses left this month", { left: ent.monthly_left, limit: lim })}${ent.pack_left ? ` · ${tx("+{n} from packs", { n: ent.pack_left })}` : ""}</span></div>
      <div class="pf-quota-bar"><i style="width:${pct}%"></i></div>${ent.cycle_end ? `<small>${tx("Resets on {date}", { date: day(ent.cycle_end) })}</small>` : ""}</div>`;
  }

  function render() {
    const sub = m?.subscription, ent = m?.entitlements;
    if (ent?.is_staff && !(sub && ["active", "trialing", "past_due"].includes(sub.status))) {
      box.innerHTML = `<div class="pf-plan"><div class="pf-plan-top"><span class="pf-plan-badge is-active">Team access</span><b>SCP team</b></div><p class="pf-billing-note">You have full access as part of the SCP team. No billing needed.</p></div>`;
      return;
    }
    if (m?.team?.role === "member" && !(sub && ["active", "trialing", "past_due"].includes(sub.status))) {
      const who = esc(m.team.owner_name ? `${m.team.owner_name} (${m.team.owner_email})` : m.team.owner_email);
      box.innerHTML = `<div class="pf-plan"><div class="pf-plan-top"><span class="pf-plan-badge is-active">${tx("Team access")}</span><b>${esc(tx(m.team.plan_name || ""))}</b></div>
        <p class="pf-billing-note">${tx("You're on {who}'s plan. They manage the billing; you have your own account, boards and AI quota.", { who: `<b>${who}</b>` })}</p>${quotaHtml(ent)}</div>`;
      return;
    }
    const st = ent?.status === "granted" ? "granted" : sub?.status;
    const liveSub = sub && ["active", "trialing", "past_due", "unpaid", "paused", "incomplete"].includes(sub.status);
    if (!liveSub && st !== "granted") {
      box.innerHTML = `<div class="pf-plan is-empty">
        <p><b>${sub?.status === "canceled" ? tx("Your {plan} membership ended on {date}.", { plan: esc(sub.plan_name), date: day(sub.ended_at || sub.current_period_end) }) : tx("You don't have a membership yet.")}</b></p>
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
    const per = perOf(sub.interval);
    const next = live?.next;
    const facts = [
      ["Plan", `${esc(sub.plan_name)}`],
      ["Price", sub.amount != null ? `${money(sub.amount * (sub.seats || 1), sub.currency)} / ${per}${(sub.seats || 1) > 1 ? ` (${tx("{n} users × {price}", { n: sub.seats, price: money(sub.amount, sub.currency) })})` : ""} · ${tx(sub.currency === "usd" ? "plus tax where applicable" : "VAT included")}` : "—"],
      ["Users", String(sub.seats || 1)],
      ["Billing", sub.interval === "year" ? "Yearly, on the anniversary" : "Monthly, on the 1st of every month"],
      ["Member since", day(sub.started_at)],
    ];
    if (sub.status === "trialing" && sub.trial_end) facts.push(["Trial ends", `${day(sub.trial_end)} · ${tx("{n} days left", { n: daysLeft(sub.trial_end) })}`]);
    if (sub.cancel_at_period_end) facts.push(["Access until", `<b>${day(sub.cancel_at || sub.current_period_end)}</b> · ${tx("no more charges")}`]);
    else if (next) facts.push(["Next charge", tx("<b>{amount}</b> on {date}", { amount: money(next.amount, next.currency), date: day(next.at) })]);
    else if (sub.current_period_end) facts.push(["Next renewal", day(sub.current_period_end)]);
    if (sub.pending_plan) facts.push(["Scheduled change", `${esc(sub.pending_plan_name || sub.pending_plan)}${sub.pending_interval ? ` (${tx(sub.pending_interval === "year" ? "yearly" : "monthly")})` : ""} ${tx("from {date}", { date: day(sub.pending_change_at) })} <button class="link-gold" type="button" data-bill="undo">Undo</button>`]);
    if (live?.card) facts.push(["Card", `${esc(live.card.brand.toUpperCase())} •••• ${esc(live.card.last4)} · ${tx("expires {date}", { date: `${String(live.card.exp_month).padStart(2, "0")}/${String(live.card.exp_year).slice(-2)}` })} <button class="link-gold" type="button" data-bill="card">Update</button>`]);
    if (sub.discount_code) facts.push(["Discount", esc(sub.discount_code)]);

    const problem = ["past_due", "unpaid", "incomplete"].includes(sub.status) || m?.open_problem;
    box.innerHTML = `<div class="pf-plan">
      <div class="pf-plan-top"><span class="pf-plan-badge ${cls}">${label}</span><b>${esc(sub.plan_name)}</b><span class="pf-plan-int">${tx(sub.interval === "year" ? "Yearly" : "Monthly")}${sub.amount != null ? ` · <b>${money(sub.amount * (sub.seats || 1), sub.currency)}</b> / ${perOf(sub.interval)}` : ` · ${String(sub.currency || "eur").toUpperCase()}`}</span></div>
      ${problem ? `<div class="pf-alert">${icon("zap")}<div><b>${m?.open_problem ? tx("We couldn't take your last payment of {amount}.", { amount: money(m.open_problem.amount_due, m.open_problem.currency) }) : tx("We couldn't take your last payment.")}</b> ${m?.open_problem?.next_attempt ? tx("Update your card to keep your access — we'll try again on {date}.", { date: day(m.open_problem.next_attempt) }) : tx("Update your card to keep your access.")}
        <div class="pf-alert-actions"><button class="btn btn-gold" type="button" data-bill="card">Update payment method</button>${m?.open_problem?.url || live?.open_invoice?.url ? `<a class="btn btn-outline" href="${esc(m?.open_problem?.url || live.open_invoice.url)}" target="_blank" rel="noopener">Pay the invoice</a>` : ""}</div></div></div>` : ""}
      ${sub.status === "trialing" && !sub.cancel_at_period_end ? `<p class="pf-billing-note">${tx("Your free trial runs until <b>{date}</b>.", { date: day(sub.trial_end) })} ${tx(sub.interval === "month" ? "The first charge then covers the days until the 1st; after that you pay the full price on the 1st of every month." : "Then your yearly plan starts.")} ${tx("Cancel before and you pay nothing.")}</p>` : ""}
      <dl class="pf-facts">${facts.map(([k, v]) => `<div><dt>${tx(k)}</dt><dd>${v}</dd></div>`).join("")}</dl>
      ${Array.isArray(sub.features) && sub.features.length ? `<ul class="pf-included">${sub.features.map((f) => `<li>${icon("check")}${esc(f)}</li>`).join("")}</ul>` : ""}
      ${quotaHtml(ent)}
      ${teamHtml(sub)}
      <div class="pf-billing-actions">
        ${sub.cancel_at_period_end
          ? `<button class="btn btn-gold" type="button" data-bill="reactivate">Keep my membership</button>`
          : `<button class="btn btn-outline" type="button" data-bill="change">Change plan</button>${sub.interval === "month" ? `<button class="btn btn-outline" type="button" data-bill="yearly">Switch to yearly</button>` : ""}`}
        <button class="btn btn-outline" type="button" data-bill="portal">${icon("external-link")}Billing details &amp; invoices</button>
        ${ent?.has_ai ? `<a class="btn btn-outline" href="pricing.html#packs">${tx("Buy more AI analyses")}</a>` : ""}
        ${!sub.cancel_at_period_end ? `<button class="pf-cancel" type="button" data-bill="cancel">Cancel membership</button>` : ""}
      </div>
      <div data-bill-panel></div>
      ${invoicesHtml(m?.invoices)}
    </div>`;
  }

  // ---------- Team: who is on the seats, add / remove people, number of users ----------
  function teamHtml(sub) {
    if (sub.source !== "stripe" || ["canceled", "incomplete_expired"].includes(sub.status)) return "";
    const seats = sub.seats || 1, members = m?.team?.members || [];
    const free = seats - 1 - members.filter((x) => x.active).length;
    const row = (x) => `<li class="${x.active ? (x.joined ? "" : "is-waiting") : "is-off"}"><span>${esc(x.email)}</span><small>${tx(!x.active ? "No seat — add users" : x.joined ? "Has access" : "Waiting for them to sign up")}</small>
      <button class="link-gold" type="button" data-team-remove="${esc(x.id)}">${tx("Remove")}</button></li>`;
    return `<div class="pf-team">
      <div class="pf-team-head"><b>${tx("Your team · {used} of {seats} users", { used: Math.min(seats, 1 + members.filter((x) => x.active).length), seats })}</b></div>
      <ul class="pf-team-list"><li><span>${esc(myEmail)}</span><small>${tx("You · pays the plan")}</small></li>${members.map(row).join("")}</ul>
      ${free > 0 ? `<form class="pf-team-add" data-team-add><input name="email" type="email" required placeholder="${esc(tx("Colleague's email"))}" aria-label="${esc(tx("Colleague's email"))}"><button class="btn btn-outline" type="submit">${tx("Add user")}</button></form>
        <p class="pf-billing-note">${tx("They get the same plan, with their own account and AI quota, as soon as they sign in to SCP with this email.")}</p>` : ""}
      <div class="pf-team-seats">${tx(seats > 1 ? "Your plan includes {n} users." : "Your plan includes 1 user.", { n: seats })}
        <div class="plan-seats"><span>${tx("Users")}</span><button type="button" data-seats-step="-1" ${seats <= 1 ? "disabled" : ""} aria-label="${esc(tx("Fewer users"))}">−</button><b data-seats-pick>${seats}</b><button type="button" data-seats-step="1" aria-label="${esc(tx("More users"))}">+</button></div>
        <span data-seats-custom ${seats >= MAX_SEATS ? "" : "hidden"}>${tx("More than {n} users?", { n: MAX_SEATS })} <a class="link-gold" href="contact.html?topic=custom-plan&users=${MAX_SEATS + 1}">${tx("Request a custom plan")}</a></span></div>
      <div data-seats-terms></div>
    </div>`;
  }
  async function seatsPreview(n) {
    const t = box.querySelector("[data-seats-terms]");
    if (!t) return;
    if (n === (m.subscription.seats || 1)) { t.innerHTML = ""; return; }
    t.innerHTML = `<p class="pf-billing-note">${tx("Checking the exact amount…")}</p>`;
    try {
      const pv = await manage({ action: "preview_seats", seats: n });
      const total = `${money(pv.new_total, pv.currency)} / ${perOf(pv.interval)}`;
      const text = pv.trial ? tx("<b>{n} users</b>: nothing is charged during your free trial; then {total}.", { n, total })
        : pv.more ? tx("<b>{n} users</b>: you pay <b>{amount}</b> today for the rest of this period, then {total}.", { n, amount: money(pv.charge_now, pv.currency), total })
        : tx("<b>{n} users</b>: from now on {total}. The unused part ({amount}) is credited on your next invoice.", { n, total, amount: money(pv.credit, pv.currency) });
      const lost = (m.team?.members || []).filter((x) => x.active).length - (n - 1);
      t.innerHTML = `<div class="pf-change-terms"><p>${text}</p>${lost > 0 ? `<p class="pf-billing-note is-err">${tx("The last {n} people you added will lose access. Remove someone first to choose who.", { n: lost })}</p>` : ""}
        <div class="pf-billing-actions"><button class="btn btn-gold" type="button" data-seats-confirm="${n}">${pv.more && !pv.trial ? tx("Pay {amount} and update", { amount: money(pv.charge_now, pv.currency) }) : tx("Update users")}</button><button class="btn btn-outline" type="button" data-seats-cancel>${tx("Cancel")}</button></div></div>`;
    } catch (err) { t.innerHTML = `<p class="pf-billing-note is-err">${esc(err.message)}</p>`; }
  }
  box.addEventListener("click", async (e) => {
    const step = e.target.closest(".pf-team [data-seats-step]");
    if (step) {
      const b = box.querySelector("[data-seats-pick]"), next = Number(b.textContent) + Number(step.dataset.seatsStep);
      if (next > MAX_SEATS) { box.querySelector("[data-seats-custom]")?.removeAttribute("hidden"); return; }
      if (next < 1) return;
      b.textContent = next;
      step.parentElement.querySelector('[data-seats-step="-1"]').disabled = next <= 1;
      clearTimeout(box._seatsT); box._seatsT = setTimeout(() => seatsPreview(next), 350);
      return;
    }
    if (e.target.closest("[data-seats-cancel]")) { box.querySelector("[data-seats-terms]").innerHTML = ""; box.querySelector("[data-seats-pick]").textContent = m.subscription.seats || 1; return; }
    const conf = e.target.closest("[data-seats-confirm]");
    if (conf) {
      conf.disabled = true; conf.textContent = tx("Updating…");
      try {
        const r = await manage({ action: "seats", seats: Number(conf.dataset.seatsConfirm) });
        if (r.action_required && r.url) { location.href = r.url; return; }
        notify(tx("Your plan now has {n} users.", { n: r.seats }), "is-ok");
        await load();
      } catch (err) { conf.disabled = false; notify(err.message, "is-err"); }
      return;
    }
    const rm = e.target.closest("[data-team-remove]");
    if (rm) {
      rm.disabled = true;
      const { data, error } = await db.rpc("team_remove", { p_id: rm.dataset.teamRemove });
      if (error || !data?.ok) { rm.disabled = false; notify(tx(error?.message || data?.error || "Something went wrong"), "is-err"); return; }
      notify(tx("Removed from your team."), "is-ok");
      await load();
    }
  });
  box.addEventListener("submit", async (e) => {
    const f = e.target.closest("[data-team-add]");
    if (!f) return;
    e.preventDefault();
    const btn = f.querySelector("button"); btn.disabled = true;
    const { data, error } = await db.rpc("team_add", { p_email: f.email.value.trim() });
    btn.disabled = false;
    if (error || !data?.ok) { notify(tx(error?.message || data?.error || "Something went wrong"), "is-err"); return; }
    notify(tx("Added. They get access when they sign in with {email}.", { email: f.email.value.trim() }), "is-ok");
    await load();
  });

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
        <div class="pf-change-head"><div><b>Change your plan</b><small>${tx("Choose the plan and how you pay. You'll see the exact amount before confirming.")}</small></div><div class="plan-interval pf-iv"><button type="button" aria-selected="${iv === "month"}" data-iv="month">Monthly</button><button type="button" aria-selected="${iv === "year"}" data-iv="year">Yearly</button></div></div>
        <div class="pf-change-list">${list.map((p) => { const pr = p.prices.find((x) => x.currency === sub.currency && x.interval === iv);
          const cur = p.key === sub.plan && iv === sub.interval;
          return `<button type="button" class="pf-change-opt${cur ? " is-current" : ""}${p.highlighted ? " is-best" : ""}" ${cur || !pr?.ready ? "disabled" : ""} data-pick="${esc(p.key)}">
            <i class="pf-opt-radio" aria-hidden="true"></i>
            <span class="pf-opt-tx"><b>${esc(p.name)}</b><span class="pf-opt-price">${pr ? `<strong>${money(pr.amount, sub.currency)}</strong> / ${perOf(iv)}` : "Not available"}</span></span>
            ${cur ? `<em>${tx("Current")}</em>` : ""}</button>`; }).join("")}</div>
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
          const today = pv.trial ? 0 : pv.upgrade ? pv.charge_now : 0;
          const facts = [
            [tx("Today you pay"), money(today, pv.currency), "is-big"],
            pv.trial ? [tx("First charge · {date}", { date: day(pv.first_charge_at) }), money(pv.first_charge, pv.currency)] : !pv.upgrade ? [tx("Changes on"), day(pv.applies_at)] : null,
            [tx("Then"), `${money(pv.new_price, pv.currency)} / ${perOf(pv.interval)}`],
          ].filter(Boolean);
          t.innerHTML = `<div class="pf-change-terms"><div class="pf-sum">${facts.map(([k, v, c]) => `<span class="${c || ""}"><small>${k}</small><b>${v}</b></span>`).join("")}</div>${pv.trial
            ? `<p>${tx("Applies <b>now</b> and you're still in your free trial: <b>nothing is charged today</b>. Your first charge, on {date}, will be <b>{first}</b> (the days until the 1st), then {price} / {per}.", { date: day(pv.first_charge_at), first: money(pv.first_charge, pv.currency), price: money(pv.new_price, pv.currency), per: perOf(pv.interval) })}</p>`
            : pv.upgrade
            ? `<p>${tx("Applies <b>now</b>. You pay <b>{amount}</b> today for the rest of this period, then {price} / {per}.", { amount: money(pv.charge_now, pv.currency), price: money(pv.new_price, pv.currency), per: perOf(pv.interval) })} ${esc(pv.note ? tx(pv.note) : "")}</p>`
            : `<p>${tx("Applies on <b>{date}</b>, at the end of the period you've paid. Nothing is charged today; then {price} / {per}. You keep your current features until then.", { date: day(pv.applies_at), price: money(pv.new_price, pv.currency), per: perOf(pv.interval) })}</p>`}
            <div class="pf-billing-actions"><button class="btn btn-gold" type="button" data-confirm="${esc(pick.dataset.pick)}" data-civ="${iv}">${pv.trial ? tx("Switch plan") : pv.upgrade ? tx("Pay {amount} and switch", { amount: money(pv.charge_now, pv.currency) }) : tx("Schedule the change")}</button><button class="btn btn-outline" type="button" data-bill="close">Cancel</button></div></div>`;
        } catch (err) { t.innerHTML = `<p class="pf-billing-note is-err">${esc(err.message)}</p>`; }
        return;
      }
      const conf = e.target.closest("[data-confirm]");
      if (conf) {
        conf.disabled = true; conf.textContent = tx("Updating…");
        try {
          const r = await manage({ action: "change", plan: conf.dataset.confirm, interval: conf.dataset.civ });
          if (r.action_required && r.url) { location.href = r.url; return; }
          notify(r.applied === "now" ? tx("Your plan has been changed.") : tx("Done — your plan changes on {date}.", { date: day(r.at) }), "is-ok");
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
      <p class="pf-billing-note">${tx(sub.status === "trialing" ? "Your trial ends on <b>{date}</b> and you won't be charged." : "You keep full access until <b>{date}</b> and won't be charged again.", { date: day(until) })} Your saved boards and content plans stay in your account. You can change your mind before that date.</p>
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
      if (a === "confirm-cancel") { b.disabled = true; await manage({ action: "cancel", reason: box.querySelector("[data-why]")?.value || "" }); notify(tx("Your membership is cancelled. You keep access until the end of the period."), "is-ok"); return load(); }
      if (a === "reactivate") { b.disabled = true; await manage({ action: "reactivate" }); notify(tx("Great — your membership continues as usual."), "is-ok"); return load(); }
      if (a === "undo") { b.disabled = true; await manage({ action: "undo_change" }); notify(tx("The scheduled change was removed."), "is-ok"); return load(); }
    } catch (err) { b.disabled = false; notify(err.message, "is-err"); }
  });

  async function load() {
    myEmail = (await db.auth.getSession()).data.session?.user?.email || "";
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
