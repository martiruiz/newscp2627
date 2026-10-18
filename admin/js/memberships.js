// SCP Admin — Memberships (supabase/memberships.sql + Edge Functions stripe-admin, send-emails, billing-cron).
// Tabs: Dashboard · Plans · Subscribers · Discounts · Hidden memberships · Emails · Billing events · Migration · Requests · Settings.
// Every economic change goes through Stripe (Edge Functions); the database only mirrors what Stripe confirms.
(async () => {
  const A = window.SCPA;
  const { $, $$, esc, icon, num } = A;
  let me;
  try { me = await A.boot("memberships"); } catch { return; }
  const main = $("[data-main]");
  const cfg = window.SCP_CONFIG || {};
  const SYM = { eur: "€", usd: "$" };   // USD only for history (old test prices); new prices are EUR only
  const money = (n, cur = "eur") => (n == null || n === "" ? "—" : `${SYM[cur] || ""}${Number(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  const day = (v) => (v ? new Date(v).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Madrid" }) : "—");
  const dt = (v) => (v ? new Date(v).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }) : "—");
  const STATUS_CLS = { active: "ok", trialing: "info", past_due: "warn", unpaid: "warn", paused: "warn", canceled: "off", incomplete: "warn", incomplete_expired: "off", granted: "ok" };
  // a coloured tag for any state word (paid, sent, failed, live, used up…)
  const ST = { ok: /^(active|paid|sent|processed|live|ok|linked)$/, info: /^(trialing|queued|processing|pending|sending|granted)$/, warn: /^(past_due|unpaid|failed|open|error|warning|incomplete|not in stripe yet|due|needs_account|needs_specific_migration)$/ };
  const st = (word) => { const w = String(word || "—"); const cls = ST.ok.test(w) ? "ok" : ST.info.test(w) ? "info" : ST.warn.test(w) ? "warn" : "off"; return `<span class="ms-badge is-${cls}">${esc(w.replace(/_/g, " "))}</span>`; };
  const badge = (s, extra = "") => `<span class="ms-badge is-${STATUS_CLS[s] || "off"}">${esc(String(s || "—").replace(/_/g, " "))}${extra}</span>`;

  // RPCs: a clear message when memberships.sql hasn't been installed yet
  async function rpc(name, params = {}) {
    const { data, error } = await A.db.rpc(name, params);
    if (error) throw new Error(/does not exist|schema cache|Could not find the function/i.test(error.message) ? "Run supabase/memberships.sql in Supabase first (after billing.sql and stripe.sql)." : error.message);
    return data;
  }
  // Edge Functions with the superadmin's session
  async function fn(name, body) {
    const s = (await A.db.auth.getSession()).data.session;
    const r = await fetch(`${cfg.supabaseUrl}/functions/v1/${name}`, { method: "POST", headers: { "Content-Type": "application/json", apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${s?.access_token}` }, body: JSON.stringify(body) }).catch(() => null);
    if (!r) throw new Error(`The ${name} function isn't reachable. Deploy it first (see docs/memberships.md).`);
    const d = await r.json().catch(() => ({}));
    if (r.status === 404) throw new Error(`The ${name} function isn't deployed yet (see docs/memberships.md).`);
    if (!r.ok) throw new Error(d.error || `${name}: ${r.status}`);
    return d;
  }
  const busy = async (btn, work) => { const t = btn?.innerHTML; if (btn) { btn.disabled = true; btn.innerHTML = "Working…"; } try { return await work(); } finally { if (btn) { btn.disabled = false; btn.innerHTML = t; } } };
  const fail = (e) => A.toast(e.message || String(e), "err");

  const TABS = [
    ["dashboard", "Dashboard"], ["plans", "Plans"], ["subscribers", "Subscribers"], ["discounts", "Discounts"],
    ["hidden", "Hidden memberships"], ["emails", "Emails"], ["events", "Billing events"], ["migration", "Migration"], ["requests", "Requests"], ["settings", "Settings"],
  ];
  main.innerHTML = `
    <div class="page-head"><div><h1>Memberships</h1><p>Plans, prices, subscribers, discounts, private links, e-mails and the MemberPress migration. Stripe is the source of truth for payments.</p></div>
      <div class="head-actions"><span class="ms-mode" data-mode></span></div></div>
    <nav class="ms-tabs" role="tablist">${TABS.map(([k, l]) => `<a href="#${k}" role="tab" data-tab="${k}">${l}</a>`).join("")}</nav>
    <section data-view></section>`;
  const view = $("[data-view]");
  fn("stripe-admin", { action: "mode" }).then((m) => { $("[data-mode]").innerHTML = m.mode === "live" ? `<span class="ms-badge is-warn">Stripe LIVE</span>` : m.mode === "test" ? `<span class="ms-badge is-info">Stripe test mode</span>` : `<span class="ms-badge is-off">Stripe not connected</span>`; })
    .catch(() => { $("[data-mode]").innerHTML = `<span class="ms-badge is-off">Stripe functions not deployed</span>`; });

  let plansCache = null;
  const loadPlans = async (force) => (plansCache && !force ? plansCache : (plansCache = await rpc("admin_membership_plans")));

  // ============================================================================================ Dashboard
  async function dashboard() {
    view.innerHTML = `<div class="ms-row"><select class="select" data-days><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option></select></div><div data-dash>Loading…</div>`;
    const draw = async () => {
      const m = await rpc("admin_membership_metrics", { p_days: Number($("[data-days]").value) });
      const mrr = Object.entries(m.mrr || {});
      const kpi = (l, v, h = "") => `<div class="panel panel-pad bill-kpi"><span>${l}</span><b>${v}</b>${h ? `<small>${h}</small>` : ""}</div>`;
      const conv = m.trials_ended ? Math.round((m.trials_converted / m.trials_ended) * 100) : null;
      const churn = m.paying_at_start > 0 ? ((m.canceled_in_window / m.paying_at_start) * 100).toFixed(1) : null;
      const maxEv = Math.max(1, ...m.evolution.map((e) => Math.max(e.new, e.canceled)));
      $("[data-dash]").innerHTML = `
        <div class="bill-kpis">
          ${kpi("MRR", mrr.length ? mrr.map(([c, v]) => money(v, c)).join(" · ") : money(0), "paying now (not trials), yearly ÷ 12, VAT incl.")}
          ${kpi("ARR", mrr.length ? mrr.map(([c, v]) => money(v * 12, c)).join(" · ") : money(0), "MRR × 12")}
          ${kpi("Active (paying)", num(m.active), `${num(m.past_due)} with a payment problem`)}
          ${kpi("In free trial", num(m.trialing), `${num(m.canceling)} with cancellation scheduled`)}
          ${kpi("Trial → paid", conv == null ? "—" : `${conv}%`, `${num(m.trials_converted)} of ${num(m.trials_ended)} trials that ended`)}
          ${kpi("Cancellations", num(m.canceled_in_window), churn == null ? "in the window" : `churn ${churn}% of paying at the start`)}
          ${kpi("Collected", Object.entries(m.collected || {}).map(([c, v]) => money(v, c)).join(" · ") || money(0), "paid invoices in the window (cash)")}
          ${kpi("Failed payments", num(m.failed_payments), "in the window")}
        </div>
        <div class="ms-grid2">
          <section class="panel panel-pad"><h2>By plan</h2><table class="data"><thead><tr><th>Plan</th><th>Paying</th><th>Trial</th><th>MRR</th></tr></thead><tbody>
            ${m.by_plan.map((p) => `<tr><td>${esc(p.plan)}</td><td>${num(p.paying)}</td><td>${num(p.trialing)}</td><td>${money(p.mrr)}</td></tr>`).join("")}</tbody></table>
            <p class="panel-sub">MRR by plan mixes currencies at face value; see the MRR card for each currency.</p></section>
          <section class="panel panel-pad"><h2>New vs cancelled (12 months)</h2>
            ${m.evolution.length ? `<div class="ms-bars">${m.evolution.map((e) => `<div title="${e.month}: ${e.new} new, ${e.canceled} cancelled"><i class="is-new" style="height:${(e.new / maxEv) * 100}%"></i><i class="is-can" style="height:${(e.canceled / maxEv) * 100}%"></i><span>${e.month.slice(5)}</span></div>`).join("")}</div>` : `<p class="muted">No subscriptions yet.</p>`}
            <p class="panel-sub">Currencies: ${Object.entries(m.by_currency || {}).map(([c, n]) => `${c.toUpperCase()} ${n}`).join(" · ") || "—"} · Origin: ${Object.entries(m.origin || {}).map(([o, n]) => `${o} ${n}`).join(" · ") || "—"}</p></section>
        </div>
        <details class="panel panel-pad ms-defs"><summary>How these numbers are calculated</summary><ul>
          <li><b>MRR</b>: monthly recurring revenue of subscriptions that pay now (active or past due; trials excluded), yearly divided by 12, at their own price, VAT included, per currency.</li>
          <li><b>Collected</b>: money actually received (paid invoices) in the window — cash, not revenue recognition.</li>
          <li><b>Trial → paid</b>: trials that ended in the window and are paying now. <b>Churn</b>: paying subscriptions cancelled in the window ÷ paying at the start of the window.</li></ul></details>`;
    };
    $("[data-days]").addEventListener("change", () => draw().catch(fail));
    await draw();
  }

  // ============================================================================================ Plans
  async function plans() {
    view.innerHTML = `<div class="ms-row"><button class="btn btn-primary" type="button" data-new>${icon("plus")}New plan</button>
      <button class="btn" type="button" data-sync-all>Sync all plans with Stripe</button><button class="btn btn-ghost" type="button" data-perm>Add a permission</button></div><div data-list>Loading…</div>`;
    const draw = async (force) => {
      const list = await loadPlans(force);
      $("[data-list]").innerHTML = list.map((p) => {
        const cur = (c, i) => p.prices.find((x) => x.currency === c && x.interval === i);
        const cell = (c, i) => { const x = cur(c, i); return x ? `${money(x.amount, c)}${x.ready ? "" : ` <span class="ms-badge is-warn" title="Not in Stripe yet">sync</span>`}` : `<span class="muted">—</span>`; };
        return `<article class="panel ms-plan${p.archived_at ? " is-archived" : ""}">
          <div class="ms-plan-head"><div><h2>${esc(p.name)} ${p.highlighted ? `<span class="ms-badge is-info">${esc(p.badge || "highlighted")}</span>` : ""}</h2>
            <p class="muted"><code>${esc(p.key)}</code> · ${p.visibility === "hidden" ? "Hidden (private links)" : "Public"} · ${p.archived_at ? "Archived" : p.active ? "On sale" : "Not on sale"} · trial ${p.trial_days ? `${p.trial_days} days` : "off"} · AI ${p.ai_unlimited ? "unlimited" : `${p.ai_monthly_units}/month`}</p></div>
            <div class="ms-plan-stats"><b>${num(p.subscribers)}</b><span>subscribers</span><b>${num(p.trialing)}</b><span>in trial</span></div></div>
          <table class="data ms-prices"><thead><tr><th></th><th>Monthly</th><th>Yearly</th></tr></thead><tbody>
            <tr><th>EUR</th><td>${cell("eur", "month")}</td><td>${cell("eur", "year")}</td></tr></tbody></table>
          <p class="ms-perms">${p.entitlements.map((e) => `<span class="chip">${esc(e)}</span>`).join("")}</p>
          <div class="ms-plan-actions">
            <button class="btn btn-sm" type="button" data-edit="${esc(p.key)}">${icon("edit")}Edit</button>
            <button class="btn btn-sm" type="button" data-sync="${esc(p.key)}">Sync with Stripe</button>
            <button class="btn btn-sm btn-ghost" type="button" data-history="${esc(p.key)}">Price history</button>
            <button class="btn btn-sm btn-ghost" type="button" data-dup="${esc(p.key)}">Duplicate</button>
            <a class="btn btn-sm btn-ghost" href="#subscribers?plan=${esc(p.key)}">Subscribers</a>
            <button class="btn btn-sm btn-ghost" type="button" data-archive="${esc(p.key)}" data-on="${p.archived_at ? 0 : 1}">${p.archived_at ? "Unarchive" : "Archive"}</button>
            ${p.stripe_product_id ? `<span class="muted ms-small">Stripe ${esc(p.stripe_product_id)}</span>` : `<span class="muted ms-small">Not in Stripe yet</span>`}
          </div></article>`;
      }).join("") || `<p class="muted">No plans.</p>`;
    };
    view.onclick = async (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      try {
        if (b.matches("[data-new]")) return editPlan(null, () => draw(true));
        if (b.dataset.edit) return editPlan((await loadPlans()).find((p) => p.key === b.dataset.edit), () => draw(true));
        if (b.dataset.sync) { const r = await busy(b, () => fn("stripe-admin", { action: "sync_plan", plan: b.dataset.sync })); A.toast(`Synced: ${r.created.length} new price(s), ${r.retired.length} retired.`); return draw(true); }
        if (b.matches("[data-sync-all]")) { if (!(await A.confirmDialog({ title: "Sync every plan with Stripe?", text: "Creates the Stripe products and the prices that aren't in Stripe yet, and stops selling replaced prices in Stripe. Existing subscribers keep paying what they pay.", confirm: "Sync" }))) return; await busy(b, () => fn("stripe-admin", { action: "sync_all" })); A.toast("All plans synced."); return draw(true); }
        if (b.dataset.history) return priceHistory((await loadPlans()).find((p) => p.key === b.dataset.history));
        if (b.dataset.dup) {
          const key = prompt("Key for the copy (lowercase, e.g. all_access_partners)"); if (!key) return;
          const name = prompt("Name for the copy", "Copy"); if (!name) return;
          await rpc("admin_duplicate_plan", { p_from: b.dataset.dup, p_key: key, p_name: name }); A.toast("Duplicated as a hidden, off-sale plan."); return draw(true);
        }
        if (b.dataset.archive) {
          const on = b.dataset.on === "1";
          if (on && !(await A.confirmDialog({ title: "Archive this plan?", text: "It stops being sold. Current subscribers keep it until they change or cancel.", confirm: "Archive", danger: true }))) return;
          await rpc("admin_archive_plan", { p_plan: b.dataset.archive, p_archive: on }); return draw(true);
        }
        if (b.matches("[data-perm]")) {
          const key = prompt("Permission key (area.action, e.g. reports.export)"); if (!key) return;
          const label = prompt("Label shown on pricing", key); if (!label) return;
          await rpc("admin_add_entitlement_key", { p_key: key, p_label: label, p_description: null }); A.toast("Permission added — assign it to plans with Edit.");
        }
      } catch (err) { fail(err); }
    };
    await draw();
  }

  async function editPlan(p, done) {
    const isNew = !p;
    const keys = (await rpc("public_membership_plans")).entitlements || [];
    const price = (c, i) => p?.prices.find((x) => x.currency === c && x.interval === i)?.amount ?? "";
    const trialChoice = !p ? 7 : p.trial_enabled ? Number(p.trial_days_setting) : 0;
    const m = A.modal({ title: isNew ? "New plan" : `Edit ${p.name}`, size: "lg", body: `
      <form class="ms-form" data-f>
        <div class="ms-grid2">
          <label>Name<input class="input" name="name" required value="${esc(p?.name || "")}"></label>
          <label>Key ${isNew ? "" : "(fixed)"}<input class="input" name="key" ${isNew ? "" : "readonly"} pattern="[a-z0-9_]{2,40}" required value="${esc(p?.key || "")}" placeholder="library_ai"></label>
          <label>Tagline<input class="input" name="tagline" value="${esc(p?.tagline || "")}" placeholder="One line under the name"></label>
          <label>Badge<input class="input" name="badge" value="${esc(p?.badge || "")}" placeholder="Most complete"></label>
        </div>
        <label>Description<textarea class="textarea" name="description" rows="2">${esc(p?.description || "")}</textarea></label>
        <label>Features on pricing (one per line)<textarea class="textarea" name="features" rows="4">${esc((p?.features || []).join("\n"))}</textarea></label>
        <div class="ms-grid3">
          <label>Visibility<select class="select" name="visibility"><option value="public"${p?.visibility !== "hidden" ? " selected" : ""}>Public (pricing page)</option><option value="hidden"${p?.visibility === "hidden" ? " selected" : ""}>Hidden (private links only)</option></select></label>
          <label>On sale<select class="select" name="active"><option value="true"${p?.active !== false ? " selected" : ""}>Yes</option><option value="false"${p?.active === false ? " selected" : ""}>No</option></select></label>
          <label>Order<input class="input" type="number" name="sort" value="${esc(p?.sort ?? 99)}"></label>
          <label class="ms-check"><input type="checkbox" name="highlighted" ${p?.highlighted ? "checked" : ""}> Highlight on pricing</label>
        </div>
        <h3>Free trial (card always required)</h3>
        <div class="ms-grid3">
          <label>Trial<select class="select" name="trial_pick">${[0, 3, 7, 14, 30].map((d) => `<option value="${d}"${trialChoice === d ? " selected" : ""}>${d ? `${d} days` : "No free trial"}</option>`).join("")}<option value="custom"${![0, 3, 7, 14, 30].includes(trialChoice) ? " selected" : ""}>Custom…</option></select></label>
          <label>Custom days<input class="input" type="number" min="1" max="365" name="trial_custom" value="${esc(p?.trial_days_setting || "")}"></label>
          <label>AI analyses during the trial<input class="input" type="number" min="0" name="trial_ai_units" value="${esc(p?.trial_ai_units ?? 5)}"></label>
        </div>
        <h3>AI quota</h3>
        <div class="ms-grid3">
          <label>Analyses per month<input class="input" type="number" min="0" name="ai_monthly_units" value="${esc(p?.ai_monthly_units ?? 0)}"></label>
          <label class="ms-check"><input type="checkbox" name="ai_unlimited" ${p?.ai_unlimited ? "checked" : ""}> Unlimited</label>
        </div>
        <h3>Permissions</h3>
        <div class="ms-perms-edit">${keys.map((k) => `<label class="ms-check"><input type="checkbox" name="ent" value="${esc(k.key)}" ${p?.entitlements?.includes(k.key) ? "checked" : ""}> <span><b>${esc(k.label)}</b><small>${esc(k.key)}</small></span></label>`).join("")}</div>
        <h3>Prices (VAT included) <small class="muted">Each change creates a new price; customers on the old one keep it. Then press “Sync with Stripe”.</small></h3>
        <div class="ms-grid4">
          <label>€ / month<input class="input" type="number" step="0.01" min="0" name="eur_month" value="${esc(price("eur", "month"))}"></label>
          <label>€ / year<input class="input" type="number" step="0.01" min="0" name="eur_year" value="${esc(price("eur", "year"))}"></label>
        </div>
        <p class="muted ms-small">Prices are in euros only (banks convert for cards in other currencies). Leave a price empty to not sell the plan monthly or yearly.</p>
      </form>`,
      foot: `<button class="btn btn-ghost" type="button" data-x>Cancel</button><button class="btn btn-primary" type="button" data-save>Save plan</button>` });
    $("[data-x]", m.el).onclick = () => m.close();
    $("[data-save]", m.el).onclick = async (ev) => {
      const f = $("[data-f]", m.el);
      if (!f.reportValidity()) return;
      const v = Object.fromEntries(new FormData(f));
      const pick = v.trial_pick === "custom" ? Number(v.trial_custom || 0) : Number(v.trial_pick);
      const payload = { key: v.key, name: v.name, tagline: v.tagline, badge: v.badge, description: v.description,
        features: v.features.split("\n").map((s) => s.trim()).filter(Boolean), visibility: v.visibility, active: v.active === "true", sort: Number(v.sort || 99),
        highlighted: !!f.highlighted.checked, trial_enabled: pick > 0, trial_days: pick > 0 ? pick : (p?.trial_days_setting || 7), trial_ai_units: Number(v.trial_ai_units || 0),
        ai_monthly_units: Number(v.ai_monthly_units || 0), ai_unlimited: !!f.ai_unlimited.checked, entitlements: $$("[name=ent]:checked", f).map((x) => x.value),
        price_month: Number(v.eur_month || 0) };
      await busy(ev.target, async () => {
        try {
          await rpc("admin_save_plan", { p: payload });
          for (const [c, i] of [["eur", "month"], ["eur", "year"]]) {
            const nv = v[`${c}_${i}`], ov = price(c, i);
            if (nv !== "" && Number(nv) > 0 && Number(nv) !== Number(ov)) await rpc("admin_set_price", { p_plan: payload.key, p_currency: c, p_interval: i, p_amount: Number(nv) });
            if (nv === "" && ov !== "") await rpc("admin_remove_price", { p_plan: payload.key, p_currency: c, p_interval: i });
          }
          A.toast("Plan saved. Press “Sync with Stripe” to make new prices payable.");
          m.close(); done();
        } catch (err) { fail(err); }
      });
    };
  }

  function priceHistory(p) {
    A.modal({ title: `${p.name} — price history`, body: `<table class="data"><thead><tr><th>Created</th><th>Currency</th><th>Period</th><th>Amount</th><th>Status</th><th>Stripe price</th></tr></thead><tbody>
      ${p.all_prices.map((x) => `<tr><td>${dt(x.created_at)}</td><td>${x.currency.toUpperCase()}</td><td>${x.interval}</td><td>${money(x.amount, x.currency)}</td>
        <td>${x.legacy ? badge("legacy") : x.active ? badge("active") : `${badge("canceled")} <small class="muted">until ${day(x.archived_at)}</small>`}</td><td><code>${esc(x.stripe_price_id || "—")}</code></td></tr>`).join("")}</tbody></table>` });
  }

  // ============================================================================================ Subscribers
  async function subscribers(params) {
    const plansList = await loadPlans().catch(() => []);
    view.innerHTML = `<div class="ms-row">
        <input class="input" type="search" placeholder="Name or e-mail" data-q value="">
        <select class="select" data-st><option value="">Any status</option>${["active", "trialing", "past_due", "unpaid", "canceling", "canceled", "paused", "incomplete"].map((s) => `<option value="${s}">${s.replace("_", " ")}</option>`).join("")}</select>
        <select class="select" data-pl><option value="">Any plan</option>${plansList.map((p) => `<option value="${esc(p.key)}"${params.get("plan") === p.key ? " selected" : ""}>${esc(p.name)}</option>`).join("")}</select>
        <button class="btn" type="button" data-csv>${icon("download")}CSV</button><span class="muted" data-count></span></div>
      <div class="panel table-wrap"><table class="data"><thead><tr><th>Member</th><th>Plan</th><th>Status</th><th>Price</th><th>Since</th><th>Next renewal</th><th>Origin</th></tr></thead><tbody data-rows><tr><td colspan="7">Loading…</td></tr></tbody></table></div>`;
    let rows = [];
    const draw = async () => {
      rows = await rpc("admin_subscribers", { p_q: $("[data-q]").value.trim() || null, p_status: $("[data-st]").value || null, p_plan: $("[data-pl]").value || null, p_limit: 2000 });
      $("[data-count]").textContent = `${num(rows.length)} members`;
      $("[data-rows]").innerHTML = rows.map((r) => `<tr class="is-click" data-user="${r.user_id}">
        <td><b>${esc(r.name || r.email)}</b><br><small class="muted">${esc(r.email)}</small></td><td>${esc(r.plan_name || r.plan)}</td>
        <td>${badge(r.status)}${r.cancel_at_period_end ? ` <span class="ms-badge is-warn">ends ${day(r.cancel_at || r.current_period_end)}</span>` : ""}</td>
        <td>${r.amount != null ? `${money(r.amount, r.currency)} / ${r.interval === "year" ? "yr" : "mo"}` : "—"}</td><td>${day(r.started_at)}</td>
        <td>${r.status === "trialing" ? `trial ends ${day(r.trial_end)}` : day(r.current_period_end)}</td><td>${esc(r.origin)}${r.private_link ? " · private link" : ""}${r.discount_code ? ` · ${esc(r.discount_code)}` : ""}</td></tr>`).join("") || `<tr><td colspan="7" class="muted">No subscribers match.</td></tr>`;
    };
    $("[data-q]").addEventListener("input", A.debounce(() => draw().catch(fail), 350));
    $("[data-st]").onchange = $("[data-pl]").onchange = () => draw().catch(fail);
    $("[data-csv]").onclick = () => {
      const cols = ["name", "email", "plan", "status", "currency", "amount", "interval", "started_at", "current_period_end", "trial_end", "cancel_at_period_end", "cancel_at", "origin", "stripe_customer_id", "stripe_subscription_id"];
      A.downloadBlob(new Blob([[cols.join(","), ...rows.map((r) => cols.map((c) => A.csvCell(r[c] ?? "")).join(","))].join("\n")], { type: "text/csv" }), `scp-subscribers-${new Date().toISOString().slice(0, 10)}.csv`);
    };
    view.onclick = (e) => { const tr = e.target.closest("[data-user]"); if (tr) subscriberCard(tr.dataset.user, draw); };
    await draw();
  }

  async function subscriberCard(user, refresh) {
    const m = A.modal({ title: "Subscriber", size: "lg", body: "Loading…" });
    const draw = async () => {
      const d = await rpc("admin_subscriber", { p_user: user });
      const s = d.subscription, e = d.entitlements || {}, acc = d.account || {};
      m.body.innerHTML = `
        <div class="ms-sub-head"><div><h2>${esc([acc.first_name, acc.last_name].filter(Boolean).join(" ") || acc.email)}</h2><p class="muted">${esc(acc.email)} · account since ${day(acc.created_at)}${d.memberpress ? " · from MemberPress" : ""}</p></div>
          <div class="ms-row"><button class="btn btn-sm" type="button" data-live>Check in Stripe</button><button class="btn btn-sm" type="button" data-rec>Reconcile</button></div></div>
        <div class="ms-grid2">
          <section class="panel panel-pad"><h3>Subscription</h3>${s ? `<dl class="ms-dl">
            <dt>Plan</dt><dd>${esc(s.plan_name || s.plan_key)} ${badge(s.status)}</dd>
            <dt>Price</dt><dd>${s.amount != null ? `${money(s.amount, s.currency)} / ${s.billing_interval}` : "—"}</dd>
            <dt>Started</dt><dd>${day(s.started_at)}</dd>
            <dt>Period</dt><dd>${day(s.current_period_start)} → ${day(s.current_period_end)}</dd>
            ${s.trial_end ? `<dt>Trial end</dt><dd>${day(s.trial_end)}</dd>` : ""}
            ${s.cancel_at_period_end ? `<dt>Cancellation</dt><dd>scheduled for ${day(s.cancel_at || s.current_period_end)}</dd>` : ""}
            ${s.pending_plan_key ? `<dt>Scheduled change</dt><dd>${esc(s.pending_plan_key)} on ${day(s.pending_change_at)}</dd>` : ""}
            <dt>Origin</dt><dd>${esc(s.origin)} · ${esc(s.source)}</dd>
            <dt>Stripe</dt><dd><code>${esc(s.stripe_customer_id || "—")}</code><br><code>${esc(s.stripe_subscription_id || "—")}</code></dd></dl>` : `<p class="muted">No subscription.</p>`}
            <div data-live-out></div></section>
          <section class="panel panel-pad"><h3>Access now</h3><p>${(e.entitlements || []).map((k) => `<span class="chip">${esc(k)}</span>`).join(" ") || `<span class="muted">No premium access</span>`}</p>
            <p class="muted ms-small">AI: ${e.ai_unlimited ? "unlimited" : `${num(e.monthly_left)} of ${num(e.monthly_limit)} left`} · packs ${num(e.pack_left)} · ${num(d.ai_usage?.unlocks)} analyses unlocked (${num(d.ai_usage?.last_30_days)} in 30 days)</p>
            <h3>Manual access (no money moves)</h3>
            ${(d.grants || []).map((g) => `<div class="ms-grant${g.revoked_at ? " is-off" : ""}"><b>${esc(g.plan_key || g.entitlement)}</b> · ${g.ends_at ? `until ${day(g.ends_at)}` : "no end date"} · ${esc(g.reason)}${g.revoked_at ? " · revoked" : ` <button class="btn btn-sm btn-ghost" type="button" data-revoke="${g.id}">Revoke</button>`}</div>`).join("") || `<p class="muted ms-small">None.</p>`}
            <form class="ms-inline" data-grant><select class="select" name="what">${(plansCache || []).map((p) => `<option value="plan:${esc(p.key)}">Plan: ${esc(p.name)}</option>`).join("")}${["library.access", "ai.analyze_posts", "planner.access"].map((k) => `<option value="ent:${k}">Permission: ${k}</option>`).join("")}</select>
              <input class="input" type="date" name="ends" title="Ends on (optional)"><input class="input" name="reason" placeholder="Reason (required)" required><button class="btn btn-sm" type="submit">Grant</button></form>
            <label class="ms-check ms-small"><input type="checkbox" data-trialx ${d.customer?.trial_exception ? "checked" : ""}> Allow one more free trial (exception)</label></section>
        </div>
        <section class="panel panel-pad"><h3>Invoices</h3><table class="data"><thead><tr><th>Date</th><th>Number</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>
          ${(d.invoices || []).map((i) => `<tr><td>${day(i.created_at)}</td><td>${esc(i.number || i.id)}</td><td>${money(i.total, i.currency)}</td><td>${st(i.status)}</td><td>${i.hosted_invoice_url ? `<a href="${esc(i.hosted_invoice_url)}" target="_blank" rel="noopener">Open</a>` : ""}</td></tr>`).join("") || `<tr><td colspan="5" class="muted">No invoices.</td></tr>`}</tbody></table></section>
        <div class="ms-grid2">
          <section class="panel panel-pad"><h3>Timeline</h3><ol class="ms-timeline">${(d.events || []).map((ev) => `<li><b>${esc(ev.kind.replace(/_/g, " "))}</b> ${ev.to_plan ? esc(ev.to_plan) : ""} ${ev.status ? badge(ev.status) : ""}<small>${dt(ev.created_at)}</small></li>`).join("") || `<li class="muted">No events.</li>`}</ol></section>
          <section class="panel panel-pad"><h3>E-mails</h3><ol class="ms-timeline">${(d.emails || []).map((x) => `<li>${esc(x.template.replace(/_/g, " "))} ${st(x.status)}<small>${dt(x.created_at)}${x.error ? ` · ${esc(x.error)}` : ""}</small></li>`).join("") || `<li class="muted">None.</li>`}</ol>
            <h3>Notes</h3>${(d.notes || []).map((n) => `<p class="ms-note">${esc(n.note)}<small>${esc(n.author || "")} · ${dt(n.created_at)}</small></p>`).join("")}
            <form class="ms-inline" data-note><input class="input" name="note" placeholder="Internal note" required><button class="btn btn-sm" type="submit">Add</button></form>
            <h3>Audit</h3><ol class="ms-timeline">${(d.audit || []).slice(0, 20).map((a) => `<li>${esc(a.action)}<small>${esc(a.actor || "Stripe / system")} · ${dt(a.created_at)}</small></li>`).join("") || `<li class="muted">Nothing yet.</li>`}</ol></section>
        </div>`;
    };
    m.body.onclick = async (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      try {
        if (b.matches("[data-live]")) {
          const r = await busy(b, () => fn("stripe-admin", { action: "subscriber", user }));
          $("[data-live-out]", m.body).innerHTML = r.customer ? `<div class="ms-live"><p><a href="${esc(r.customer.url)}" target="_blank" rel="noopener">Open customer in Stripe ${icon("external")}</a> · ${esc(r.customer.email || "")} · ${String(r.customer.currency || "").toUpperCase()}</p>
            ${r.subscriptions.map((s) => `<p>${badge(s.status)} <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.id)}</a> · ${money(s.amount, s.currency)} / ${esc(s.interval)} · renews ${day(s.current_period_end)}${s.cancel_at_period_end ? " · cancel scheduled" : ""}</p>`).join("")}</div>` : `<p class="muted">No Stripe customer.</p>`;
        }
        if (b.matches("[data-rec]")) { const r = await busy(b, () => fn("stripe-admin", { action: "reconcile", user })); A.toast(r.differences.length ? `${r.differences.length} difference(s) fixed from Stripe.` : "SCP matches Stripe."); await draw(); refresh?.(); }
        if (b.dataset.revoke) { const why = prompt("Reason for revoking"); if (!why) return; await rpc("admin_revoke_grant", { p_grant: b.dataset.revoke, p_reason: why }); await draw(); }
      } catch (err) { fail(err); }
    };
    m.body.onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target, v = Object.fromEntries(new FormData(f));
      try {
        if (f.matches("[data-grant]")) {
          const [kind, val] = v.what.split(":");
          await rpc("admin_grant_access", { p_user: user, p_plan: kind === "plan" ? val : null, p_entitlement: kind === "ent" ? val : null, p_ends: v.ends ? new Date(`${v.ends}T23:59:59`).toISOString() : null, p_reason: v.reason });
          A.toast("Access granted (logged)."); await draw();
        }
        if (f.matches("[data-note]")) { await rpc("admin_add_billing_note", { p_user: user, p_note: v.note }); await draw(); }
      } catch (err) { fail(err); }
    };
    m.body.onchange = async (e) => {
      if (!e.target.matches("[data-trialx]")) return;
      const why = prompt(e.target.checked ? "Why does this member get another free trial?" : "Reason");
      if (!why) { e.target.checked = !e.target.checked; return; }
      try { await rpc("admin_trial_exception", { p_user: user, p_allow: e.target.checked, p_reason: why }); A.toast("Saved."); } catch (err) { e.target.checked = !e.target.checked; fail(err); }
    };
    await draw().catch((err) => { m.body.innerHTML = `<p class="error-text">${esc(err.message)}</p>`; });
  }

  // ============================================================================================ Discounts
  async function discounts() {
    view.innerHTML = `<div class="ms-row"><button class="btn btn-primary" type="button" data-new>${icon("plus")}New discount</button></div>
      <div class="panel table-wrap"><table class="data"><thead><tr><th>Code</th><th>Campaign</th><th>Discount</th><th>Applies to</th><th>Uses</th><th>Dates</th><th>State</th><th></th></tr></thead><tbody data-rows><tr><td colspan="8">Loading…</td></tr></tbody></table></div>`;
    const draw = async () => {
      const list = await rpc("admin_discounts");
      $("[data-rows]").innerHTML = list.map((d) => `<tr>
        <td><code>${esc(d.code)}</code></td><td>${esc(d.name)}</td>
        <td>${d.kind === "percent" ? `${Number(d.percent_off)}%` : [d.amount_off_eur && money(d.amount_off_eur, "eur"), d.amount_off_usd && money(d.amount_off_usd, "usd")].filter(Boolean).join(" / ")} · ${d.duration === "once" ? "first charge" : d.duration === "repeating" ? `${d.duration_months} months` : "forever"}</td>
        <td>${d.plan_keys?.join(", ") || "all plans"} · ${d.currencies?.join("/").toUpperCase() || "all currencies"}${d.intervals ? ` · ${d.intervals.join("/")}` : ""}</td>
        <td>${num(d.times_redeemed)}${d.max_redemptions ? ` / ${num(d.max_redemptions)}` : ""} · ${num(d.paying)} paying${d.max_per_customer ? `<br><small class="muted">max ${d.max_per_customer} per customer</small>` : ""}</td>
        <td>${d.starts_at ? `from ${day(d.starts_at)}` : ""}${d.expires_at ? ` until ${day(d.expires_at)}` : d.starts_at ? "" : "no end"}</td>
        <td>${st(d.state)}</td>
        <td>${!d.stripe_coupon_id ? `<button class="btn btn-sm" type="button" data-sync="${d.id}">Create in Stripe</button>` : d.active ? `<button class="btn btn-sm btn-ghost" type="button" data-off="${d.id}">Disable</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="8" class="muted">No discounts yet.</td></tr>`;
    };
    view.onclick = async (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      try {
        if (b.matches("[data-new]")) return newDiscount(draw);
        if (b.dataset.sync) { await busy(b, () => fn("stripe-admin", { action: "sync_discount", id: b.dataset.sync })); A.toast("Coupon and promotion code created in Stripe."); return draw(); }
        if (b.dataset.off) { if (!(await A.confirmDialog({ title: "Disable this code?", text: "Nobody can use it any more. Customers who already have it keep their discount.", confirm: "Disable", danger: true }))) return; await busy(b, () => fn("stripe-admin", { action: "disable_discount", id: b.dataset.off })); return draw(); }
      } catch (err) { fail(err); }
    };
    await draw();
  }
  async function newDiscount(done) {
    const pl = await loadPlans();
    const m = A.modal({ title: "New discount", size: "lg", body: `<form class="ms-form" data-f>
      <div class="ms-grid2"><label>Code customers type<input class="input" name="code" required pattern="[A-Za-z0-9_-]{3,40}" placeholder="BLACKFRIDAY26"></label><label>Internal campaign name<input class="input" name="name" required placeholder="Black Friday 2026"></label></div>
      <div class="ms-grid3"><label>Type<select class="select" name="kind"><option value="percent">Percentage</option><option value="amount">Fixed amount</option></select></label>
        <label>% off<input class="input" type="number" name="percent_off" min="1" max="100" step="0.01" placeholder="30 (100 = free)"></label>
        <label>Amount off (€)<input class="input" type="number" name="amount_off_eur" step="0.01" placeholder="€"></label></div>
      <div class="ms-grid3"><label>Duration<select class="select" name="duration"><option value="once">First charge only</option><option value="repeating">Several months</option><option value="forever">Forever</option></select></label>
        <label>Months<input class="input" type="number" name="duration_months" min="1" placeholder="3"></label></div>
      <h3>Applies to</h3><div class="ms-perms-edit">${pl.filter((p) => !p.archived_at).map((p) => `<label class="ms-check"><input type="checkbox" name="plan" value="${esc(p.key)}"> ${esc(p.name)}</label>`).join("")}</div>
      <div class="ms-grid3"><label class="ms-check"><input type="checkbox" name="iv" value="month"> Monthly</label><label class="ms-check"><input type="checkbox" name="iv" value="year"> Yearly</label></div>
      <p class="muted ms-small">Leave unticked = all plans / periods.</p>
      <div class="ms-grid4"><label>Starts<input class="input" type="date" name="starts_at"></label><label>Expires<input class="input" type="date" name="expires_at"></label>
        <label>Total uses<input class="input" type="number" name="max_redemptions" min="1"></label><label>Uses per customer<input class="input" type="number" name="max_per_customer" min="1" value="1"></label></div>
    </form>`, foot: `<button class="btn btn-ghost" type="button" data-x>Cancel</button><button class="btn btn-primary" type="button" data-save>Save (then “Create in Stripe”)</button>` });
    $("[data-x]", m.el).onclick = () => m.close();
    $("[data-save]", m.el).onclick = async () => {
      const f = $("[data-f]", m.el);
      if (!f.reportValidity()) return;
      const v = Object.fromEntries(new FormData(f));
      const p = { ...v, plan_keys: $$("[name=plan]:checked", f).map((x) => x.value), intervals: $$("[name=iv]:checked", f).map((x) => x.value),
        starts_at: v.starts_at ? new Date(`${v.starts_at}T00:00:00`).toISOString() : "", expires_at: v.expires_at ? new Date(`${v.expires_at}T23:59:59`).toISOString() : "" };
      try { await rpc("admin_save_discount", { p }); A.toast("Saved. Now press “Create in Stripe”."); m.close(); done(); } catch (err) { fail(err); }
    };
  }

  // ============================================================================================ Hidden memberships
  async function hidden() {
    view.innerHTML = `<div class="ms-grid2">
      <section class="panel panel-pad"><h2>New private link</h2><p class="panel-sub">Anyone with the link sees only that plan and can subscribe (and pay) through Stripe. The token is shown once.</p>
        <form class="ms-form" data-f><label>Plan<select class="select" name="plan" data-plan-opts></select></label>
          <div class="ms-grid3"><label>Label<input class="input" name="label" placeholder="Partner clubs 2026"></label><label>Expires<input class="input" type="date" name="expires"></label><label>Max uses<input class="input" type="number" min="1" name="max"></label></div>
          <button class="btn btn-primary" type="submit">Create link</button></form><div data-new-link></div></section>
      <section class="panel panel-pad"><h2>Hidden plans</h2><div data-hidden-plans></div><p class="panel-sub">Create a hidden plan in Plans (visibility “Hidden”), or duplicate a public one.</p></section></div>
      <section class="panel table-wrap" style="margin-top:16px"><table class="data"><thead><tr><th>Plan</th><th>Label</th><th>Link</th><th>State</th><th>Uses</th><th>Expires</th><th>Subscriptions</th><th></th></tr></thead><tbody data-rows></tbody></table></section>`;
    const pl = await loadPlans(true);
    $("[data-plan-opts]").innerHTML = pl.filter((p) => !p.archived_at).sort((a, b) => (a.visibility === "hidden" ? -1 : 1) - (b.visibility === "hidden" ? -1 : 1)).map((p) => `<option value="${esc(p.key)}">${esc(p.name)}${p.visibility === "hidden" ? " (hidden)" : ""}</option>`).join("");
    $("[data-hidden-plans]").innerHTML = pl.filter((p) => p.visibility === "hidden").map((p) => `<p><b>${esc(p.name)}</b> <code>${esc(p.key)}</code> · ${num(p.subscribers)} subscribers · ${num(p.links)} active links</p>`).join("") || `<p class="muted">No hidden plans yet.</p>`;
    const site = location.origin + location.pathname.replace(/admin\/[^/]*$/, "");
    const draw = async () => {
      const links = await rpc("admin_private_links");
      $("[data-rows]").innerHTML = links.map((l) => `<tr><td>${esc(l.plan_name)}</td><td>${esc(l.label || "—")}</td><td><code>…${esc(l.token_hint)}</code></td>
        <td>${st(l.state)}</td><td>${num(l.uses)}${l.max_uses ? ` / ${num(l.max_uses)}` : ""}</td><td>${l.expires_at ? day(l.expires_at) : "never"}</td>
        <td>${num(l.subscriptions)} (${num(l.paying)} paying)</td>
        <td>${l.state !== "revoked" ? `<button class="btn btn-sm" type="button" data-regen="${l.id}">New link</button> <button class="btn btn-sm btn-ghost" type="button" data-revoke="${l.id}">Revoke</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="8" class="muted">No private links yet.</td></tr>`;
    };
    const show = (tok) => {
      const url = `${site}pricing.html#private=${tok}`;
      $("[data-new-link]").innerHTML = `<div class="ms-newlink"><p><b>Copy it now</b> — for security we only keep a fingerprint and can't show it again.</p><input class="input" readonly value="${esc(url)}"><button class="btn btn-sm" type="button" data-copy="${esc(url)}">Copy</button></div>`;
    };
    $("[data-f]").onsubmit = async (e) => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(e.target));
      try { const r = await rpc("admin_create_private_link", { p_plan: v.plan, p_label: v.label || null, p_expires: v.expires ? new Date(`${v.expires}T23:59:59`).toISOString() : null, p_max_uses: v.max ? Number(v.max) : null }); show(r.token); await draw(); }
      catch (err) { fail(err); }
    };
    view.onclick = async (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      try {
        if (b.dataset.copy) { await navigator.clipboard.writeText(b.dataset.copy); A.toast("Link copied."); }
        if (b.dataset.revoke) { if (!(await A.confirmDialog({ title: "Revoke this link?", text: "It stops working straight away. Subscriptions already started aren't affected.", confirm: "Revoke", danger: true }))) return; await rpc("admin_revoke_private_link", { p_id: b.dataset.revoke }); await draw(); }
        if (b.dataset.regen) { const r = await rpc("admin_regenerate_private_link", { p_id: b.dataset.regen }); show(r.token); await draw(); }
      } catch (err) { fail(err); }
    };
    await draw();
  }

  // ============================================================================================ Emails
  async function emails() {
    view.innerHTML = `<div class="ms-grid-side"><aside class="panel panel-pad" data-list>Loading…</aside><section class="panel panel-pad" data-editor><p class="muted">Pick a template.</p></section></div>
      <section class="panel table-wrap" style="margin-top:16px"><div class="values-head"><h2 style="font-size:16px">Delivery log</h2><button class="btn btn-sm" type="button" data-send-queue>Send queued now</button></div>
      <table class="data"><thead><tr><th>When</th><th>Template</th><th>To</th><th>Status</th><th>Error</th></tr></thead><tbody data-log></tbody></table></section>`;
    let data;
    const VARS = "{{name}} {{plan}} {{price}} {{interval}} {{next_charge_date}} {{next_charge_amount}} {{trial_end}} {{first_charge_amount}} {{first_charge_note}} {{access_until}} {{amount}} {{features_lost}} {{account_url}} {{site_url}} {{update_payment_url}} {{from_plan}}";
    const load = async () => {
      data = await rpc("admin_email_templates");
      const keys = [...new Set(data.templates.map((t) => t.key))];
      $("[data-list]").innerHTML = `<h2>Templates</h2>${keys.map((k) => { const t = data.templates.find((x) => x.key === k && x.locale === "en") || data.templates.find((x) => x.key === k); return `<button class="ms-tpl" type="button" data-key="${esc(k)}"><b>${esc(k.replace(/_/g, " "))}</b><small>${esc(t.description || "")}</small>${t.required ? `<span class="ms-badge is-info">required</span>` : t.enabled ? "" : `<span class="ms-badge is-off">off</span>`}</button>`; }).join("")}`;
      $("[data-log]").innerHTML = data.log.map((l) => `<tr><td>${dt(l.created_at)}</td><td>${esc(l.template)}${l.is_test ? " (test)" : ""} · ${esc(l.locale)}</td><td>${esc(l.to_email)}</td><td>${st(l.status)}</td><td class="muted">${esc(l.error || "")}</td></tr>`).join("") || `<tr><td colspan="5" class="muted">Nothing sent yet.</td></tr>`;
    };
    const edit = (key, locale = "en") => {
      const t = data.templates.find((x) => x.key === key && x.locale === locale);
      $("[data-editor]").innerHTML = `<div class="ms-row"><h2>${esc(key.replace(/_/g, " "))}</h2><div class="plan-interval ms-loc">${["en", "ca", "es"].map((l) => `<button type="button" aria-selected="${l === locale}" data-loc="${l}">${l.toUpperCase()}</button>`).join("")}</div></div>
        <form class="ms-form" data-tf><label>Subject<input class="input" name="subject" value="${esc(t.subject)}"></label>
          <label>Body<textarea class="textarea" name="body" rows="12">${esc(t.body)}</textarea></label>
          <p class="muted ms-small">Variables: ${esc(VARS)}. A line like [Button text](https://…) becomes a button.</p>
          <label class="ms-check"><input type="checkbox" name="enabled" ${t.enabled || t.required ? "checked" : ""} ${t.required ? "disabled" : ""}> Send this e-mail${t.required ? " (essential billing e-mail: always on)" : ""}</label>
          <div class="ms-row"><button class="btn btn-primary" type="submit">Save</button><button class="btn" type="button" data-preview>Preview</button><button class="btn" type="button" data-test>Send me a test</button></div></form>
        <iframe class="ms-preview" title="Preview" data-frame hidden></iframe>`;
      const f = $("[data-tf]");
      f.onsubmit = async (e) => { e.preventDefault(); try { await rpc("admin_save_email_template", { p_key: key, p_locale: locale, p_subject: f.subject.value, p_body: f.body.value, p_enabled: f.enabled.checked }); A.toast("Template saved."); await load(); } catch (err) { fail(err); } };
      $("[data-preview]").onclick = async (e) => { try { const r = await busy(e.target, () => fn("send-emails", { action: "preview", locale, subject: f.subject.value, body: f.body.value })); const fr = $("[data-frame]"); fr.hidden = false; fr.srcdoc = r.html; } catch (err) { fail(err); } };
      $("[data-test]").onclick = async (e) => { try { const r = await busy(e.target, () => fn("send-emails", { action: "test", template: key, locale })); A.toast(`Test sent to ${r.to}.`); await load(); } catch (err) { fail(err); } };
      $$("[data-loc]").forEach((b) => (b.onclick = () => edit(key, b.dataset.loc)));
    };
    view.onclick = async (e) => {
      const k = e.target.closest("[data-key]");
      if (k) { $$("[data-key]").forEach((x) => x.classList.toggle("is-on", x === k)); edit(k.dataset.key); }
      const q = e.target.closest("[data-send-queue]");
      if (q) { try { const r = await busy(q, () => fn("send-emails", { action: "send_queue" })); A.toast(r.note || `${r.sent} sent, ${r.failed || 0} failed.`); await load(); } catch (err) { fail(err); } }
    };
    await load();
  }

  // ============================================================================================ Billing events
  async function events() {
    view.innerHTML = `<div class="ms-row"><select class="select" data-st><option value="">All events</option><option value="failed">Failed</option><option value="processing">Processing</option><option value="processed">Processed</option><option value="ignored">Ignored</option></select>
      <button class="btn" type="button" data-rec>Reconcile with Stripe now</button><button class="btn btn-ghost" type="button" data-cron>Run the daily job now</button><span class="muted" data-counts></span></div>
      <p class="muted ms-small" data-last></p>
      <div class="panel table-wrap"><table class="data"><thead><tr><th>Received</th><th>Event</th><th>Object</th><th>Status</th><th>Attempts</th><th>Error</th></tr></thead><tbody data-rows></tbody></table></div>`;
    const draw = async () => {
      const r = await rpc("admin_billing_events", { p_status: $("[data-st]").value || null, p_limit: 300 });
      $("[data-counts]").textContent = Object.entries(r.counts).map(([k, v]) => `${k} ${num(v)}`).join(" · ");
      $("[data-last]").textContent = r.last_reconcile ? `Last reconciliation: ${dt(r.last_reconcile.created_at)} — ${r.last_reconcile.details.checked} checked, ${r.last_reconcile.details.differences} differences.` : "No reconciliation yet.";
      $("[data-rows]").innerHTML = r.events.map((ev) => `<tr><td>${dt(ev.received_at)}</td><td><code>${esc(ev.type)}</code>${ev.livemode === false ? ` <span class="ms-badge is-info">test</span>` : ""}</td><td><code>${esc(ev.object_id || "")}</code></td>
        <td>${st(ev.status)}</td><td>${num(ev.attempts)}</td><td class="muted">${esc(ev.last_error || "")}</td></tr>`).join("") || `<tr><td colspan="6" class="muted">No webhook events yet.</td></tr>`;
    };
    $("[data-st]").onchange = () => draw().catch(fail);
    view.onclick = async (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      try {
        if (b.matches("[data-rec]")) { const r = await busy(b, () => fn("stripe-admin", { action: "reconcile" })); A.toast(`${r.checked} checked · ${r.differences.length} differences fixed.`); await draw(); }
        if (b.matches("[data-cron]")) { const r = await busy(b, () => fn("billing-cron", {})); A.toast(`Reminders ${r.access_ending ?? 0} · cards ${r.card_expiring ?? 0} · ${typeof r.reconcile === "object" ? `${r.reconcile.differences} differences` : r.reconcile}`); await draw(); }
      } catch (err) { fail(err); }
    };
    await draw();
  }

  // ============================================================================================ Migration (MemberPress)
  const FIELDS = [
    ["email", /e-?mail|user_email/i], ["wp_user_id", /^(user_?id|wp_?user|member_?id|ID)$/i], ["first_name", /first/i], ["last_name", /last/i],
    ["membership", /membership|product|plan|level/i], ["status", /status/i], ["interval", /period|interval|billing|recurr/i], ["amount", /amount|price|total/i],
    ["currency", /currency/i], ["started_at", /created|start|signup|registered/i], ["expires_at", /expir|end|until/i],
    ["stripe_customer_id", /cus_|stripe.*cust|customer/i], ["stripe_subscription_id", /sub_|subscr_?id|stripe.*sub|subscription/i], ["transaction_id", /trans|txn/i], ["coupon", /coupon|promo/i],
  ];
  function parseCSV(text) {
    const rows = []; let row = [], cell = "", q = false;
    const sep = (text.split("\n")[0].match(/;/g) || []).length > (text.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
      else if (c === '"') q = true; else if (c === sep) { row.push(cell); cell = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; } else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((x) => x.trim()));
  }
  async function migration() {
    view.innerHTML = `<section class="panel panel-pad"><h2>Import from MemberPress</h2>
      <p class="panel-sub">1 Upload the export → 2 map columns → 3 map memberships to plans and validate → 4 verify in Stripe → 5 simulate → 6 link. Nothing changes in Stripe; renewal dates and prices of migrated members stay as they are. Passwords aren't imported: members set theirs with “Forgot password”.</p>
      <div class="ms-row"><input type="file" accept=".csv,text/csv" data-file></div><div data-mapper></div></section>
      <section class="panel table-wrap" style="margin-top:16px"><div class="values-head"><h2 style="font-size:16px">Batches</h2></div><table class="data"><thead><tr><th>Uploaded</th><th>File</th><th>Status</th><th>Totals</th><th></th></tr></thead><tbody data-batches></tbody></table></section>
      <div data-batch></div>`;
    const drawBatches = async () => {
      const list = await rpc("admin_mp_batches");
      $("[data-batches]").innerHTML = list.map((b) => `<tr><td>${dt(b.created_at)}</td><td>${esc(b.filename)}</td><td>${esc(b.status)}</td><td class="muted ms-small">${esc(Object.entries(b.totals || {}).filter(([k]) => k !== "simulation").map(([k, v]) => `${k} ${v}`).join(" · "))}</td><td><button class="btn btn-sm" type="button" data-open="${b.id}">Open</button></td></tr>`).join("") || `<tr><td colspan="5" class="muted">No imports yet.</td></tr>`;
    };
    $("[data-file]").onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      const rows = parseCSV(await file.text());
      const head = rows[0] || [], body = rows.slice(1);
      const guess = (f) => head.findIndex((h) => FIELDS.find(([k]) => k === f)[1].test(h));
      $("[data-mapper]").innerHTML = `<h3>${esc(file.name)} — ${num(body.length)} rows</h3><div class="ms-map">${FIELDS.map(([f]) => `<label>${f.replace(/_/g, " ")}<select class="select" name="${f}"><option value="-1">—</option>${head.map((h, i) => `<option value="${i}"${guess(f) === i ? " selected" : ""}>${esc(h)}</option>`).join("")}</select></label>`).join("")}</div>
        <div class="table-wrap"><table class="data ms-small"><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${body.slice(0, 5).map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
        <button class="btn btn-primary" type="button" data-stage>Upload ${num(body.length)} rows (staging, no changes)</button>`;
      $("[data-stage]").onclick = async (ev) => {
        const map = Object.fromEntries(FIELDS.map(([f]) => [f, Number($(`[data-mapper] [name=${f}]`).value)]));
        if (map.email < 0 || map.membership < 0 || map.status < 0) return A.toast("Map at least e-mail, membership and status.", "err");
        const payload = body.map((r) => ({ ...Object.fromEntries(Object.entries(map).filter(([, i]) => i >= 0).map(([f, i]) => [f, r[i]])), raw: Object.fromEntries(head.map((h, i) => [h, r[i]])) }));
        try { const bid = await busy(ev.target, () => rpc("admin_mp_stage", { p_filename: file.name, p_mapping: map, p_rows: payload })); A.toast("Uploaded to staging."); $("[data-mapper]").innerHTML = ""; await drawBatches(); openBatch(bid); } catch (err) { fail(err); }
      };
    };
    const openBatch = async (bid) => {
      const d = await rpc("admin_mp_batch", { p_batch: bid });
      const pl = await loadPlans();
      const planMap = d.batch.plan_map || {};
      const sim = d.batch.totals?.simulation;
      const filter = (location.hash.split("?")[1] && new URLSearchParams(location.hash.split("?")[1]).get("f")) || "";
      $("[data-batch]").innerHTML = `<section class="panel panel-pad" style="margin-top:16px"><h2>${esc(d.batch.filename)} · ${esc(d.batch.status)}</h2>
        <h3>Memberships → SCP plans</h3><div class="ms-map">${d.memberships.map((x) => `<label>${esc(x.membership || "(empty)")} <small class="muted">${x.rows} rows · ${x.active} active</small><select class="select" data-mp="${esc(x.membership || "")}"><option value="">— not mapped —</option>${pl.map((p) => `<option value="${esc(p.key)}"${planMap[x.membership] === p.key ? " selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>`).join("")}</div>
        <div class="ms-row ms-steps"><button class="btn" type="button" data-step="validate">3. Validate</button><button class="btn" type="button" data-step="verify">4. Verify in Stripe</button>
          <button class="btn btn-ghost" type="button" data-step="accounts">Create missing accounts</button><button class="btn" type="button" data-step="simulate">5. Simulate</button><button class="btn btn-primary" type="button" data-step="link">6. Link verified members</button></div>
        ${sim ? `<p class="ms-sim">Simulation: <b>${sim.would_link}</b> would be linked · ${sim.already_linked} already linked · ${sim.needs_account} need an account · ${sim.needs_specific_migration} need a specific migration (other Stripe account) · ${sim.not_verified_in_stripe} not verified · ${sim.blocked_by_errors} blocked by errors · ${sim.skipped_inactive} inactive skipped</p>` : ""}
        <div class="ms-row"><select class="select" data-recf><option value="">All rows</option><option value="error">Errors</option><option value="warning">Warnings</option><option value="needs_account">Needs account</option><option value="needs_specific_migration">Needs specific migration</option><option value="linked">Linked</option><option value="pending">Pending</option></select></div>
        <div class="table-wrap"><table class="data ms-small"><thead><tr><th>#</th><th>E-mail</th><th>Membership → plan</th><th>MP status</th><th>Price</th><th>Stripe subscription</th><th>Check</th><th>Link</th><th>Issues</th></tr></thead><tbody data-recs></tbody></table></div></section>`;
      const drawRecs = () => {
        const f = $("[data-recf]").value;
        $("[data-recs]").innerHTML = d.records.filter((r) => !f || r.validation === f || r.link_status === f).slice(0, 1000).map((r) => `<tr><td>${r.row}</td><td>${esc(r.email || "")}${r.has_account ? "" : ` <span class="ms-badge is-off">no account</span>`}</td>
          <td>${esc(r.membership || "")} → ${esc(r.plan_key || "?")}</td><td>${esc(r.status || "")}</td><td>${r.amount != null ? money(r.amount, r.currency || "eur") : ""} ${esc(r.interval || "")}</td>
          <td><code>${esc(r.stripe_subscription_id || "")}</code></td><td>${r.stripe_check ? (r.stripe_check.ok ? st("ok") : `<span class="ms-badge is-warn">${esc(r.stripe_check.reason || "no")}</span>`) : "—"}</td>
          <td>${st(r.link_status)}</td><td>${st(r.validation)} ${esc((r.issues || []).join("; "))}</td></tr>`).join("");
      };
      $("[data-recf]").value = filter; $("[data-recf]").onchange = drawRecs; drawRecs();
      $("[data-batch]").onclick = async (e) => {
        const b = e.target.closest("[data-step]");
        if (!b) return;
        const map = Object.fromEntries($$("[data-mp]").map((s) => [s.dataset.mp, s.value]).filter(([, v]) => v));
        try {
          if (b.dataset.step === "validate") { await busy(b, () => rpc("admin_mp_validate", { p_batch: bid, p_plan_map: map })); A.toast("Validated."); }
          if (b.dataset.step === "verify") { const r = await busy(b, () => fn("stripe-admin", { action: "verify_import", batch: bid })); A.toast(`Stripe: ${r.ok} ok · ${r.missing} not in this account · ${r.other_customer} other customer · ${r.canceled} canceled`); }
          if (b.dataset.step === "accounts") {
            if (!(await A.confirmDialog({ title: "Create SCP accounts for active members without one?", text: "Accounts are created without a password and no e-mail is sent. Members will use “Forgot password” to get in. You decide when to tell them.", confirm: "Create accounts" }))) return;
            const r = await busy(b, () => fn("stripe-admin", { action: "create_accounts", batch: bid })); A.toast(`${r.created} accounts created (${r.existed} already existed). Validate again.`);
          }
          if (b.dataset.step === "simulate") { await busy(b, () => rpc("admin_mp_simulate", { p_batch: bid })); }
          if (b.dataset.step === "link") {
            if (!(await A.confirmDialog({ title: "Link the verified members?", text: "Only rows that are valid, have an account and were verified in Stripe are linked. Their access in SCP comes from their existing Stripe subscription. Nothing is changed in Stripe and no e-mail is sent.", confirm: "Link" }))) return;
            const r = await busy(b, () => rpc("admin_mp_link", { p_batch: bid })); A.toast(`${r.linked} linked · ${r.skipped} left for review.`);
          }
          await drawBatches(); openBatch(bid);
        } catch (err) { fail(err); }
      };
    };
    view.onclick = (e) => { const o = e.target.closest("[data-open]"); if (o) openBatch(o.dataset.open).catch(fail); };
    await drawBatches();
  }

  // ============================================================================================ Settings
  async function settings() {
    const s = await rpc("admin_billing_settings");
    const em = s.emails || {}, legal = s.legal || {}, co = s.checkout || {};
    view.innerHTML = `<form class="ms-form ms-settings" data-f>
      <section class="panel panel-pad"><h2>Stripe</h2><p class="panel-sub">Keys are Supabase secrets (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET) — never stored here. Mode: <span data-m2>…</span></p>
        <div class="ms-grid3"><label>Business time zone<input class="input" name="timezone" value="${esc(s.timezone)}"></label>
          <label>Monthly renewal day<input class="input" name="monthly_anchor_day" type="number" min="1" max="1" value="${esc(s.monthly_anchor_day)}" readonly title="Fixed: the 1st"></label>
          <label>Currency<input class="input" value="EUR (€) only" readonly title="Banks convert for cards in other currencies"></label></div></section>
      <section class="panel panel-pad"><h2>Taxes</h2>
        <label>How taxes are charged<select class="select" name="tax_mode">
          <option value="none"${(s.tax?.mode || "none") === "none" ? " selected" : ""}>No tax line (prices as shown)</option>
          <option value="stripe_tax"${s.tax?.mode === "stripe_tax" ? " selected" : ""}>Stripe Tax — VAT / sales tax by customer location (needs registrations in Stripe → Tax)</option>
          <option value="fixed_rate"${s.tax?.mode === "fixed_rate" ? " selected" : ""}>One fixed rate (the rate created by setup.mjs)</option></select></label>
        <p class="muted ms-small">Prices are in euros, tax included. Ask your accountant which registrations your company needs (EU VAT for consumers and other countries).</p></section>
      <section class="panel panel-pad"><h2>Trials and payment problems</h2>
        <label class="ms-check"><input type="checkbox" name="one_trial" ${s.trial_policy?.one_per_user !== false ? "checked" : ""}> One free trial per member (exceptions per member in Subscribers)</label>
        <label class="ms-check"><input type="checkbox" name="keep_access" ${s.dunning?.keep_access_while_retrying !== false ? "checked" : ""}> Keep access while Stripe retries a failed payment (past due). Access stops when Stripe gives up (unpaid / canceled). Retry schedule: Stripe → Settings → Billing → Subscriptions.</label></section>
      <section class="panel panel-pad"><h2>Library access</h2>
        <label class="ms-check"><input type="checkbox" name="enforce_library" ${s.enforce_library_access === true ? "checked" : ""}> Require a membership to use the Content Library (server side)</label>
        <p class="error-text ms-small">Turn this on only after the MemberPress members are linked — otherwise they lose access.</p></section>
      <section class="panel panel-pad"><h2>E-mails</h2><div class="ms-grid3">
        <label>Sender name<input class="input" name="from_name" value="${esc(em.from_name || "")}"></label><label>Sender e-mail (verified in Resend)<input class="input" name="from_email" type="email" value="${esc(em.from_email || "")}"></label><label>Reply-to<input class="input" name="reply_to" type="email" value="${esc(em.reply_to || "")}"></label>
        <label>Trial reminder (days before)<input class="input" type="number" min="1" max="7" name="trial_reminder_days" value="${esc(em.trial_reminder_days ?? 3)}" title="Stripe sends trial_will_end 3 days before"></label><label>Access-ending reminder (days before)<input class="input" type="number" min="1" max="14" name="access_end_reminder_days" value="${esc(em.access_end_reminder_days ?? 3)}"></label></div></section>
      <section class="panel panel-pad"><h2>Checkout and legal</h2><div class="ms-grid3">
        <label>Terms of service URL<input class="input" name="terms_url" value="${esc(legal.terms_url || "")}" placeholder="https://…/terms.html"></label><label>Privacy policy URL<input class="input" name="privacy_url" value="${esc(legal.privacy_url || "")}"></label><label>Cancellation info URL<input class="input" name="cancellation_url" value="${esc(legal.cancellation_url || "")}"></label></div>
        <label class="ms-check"><input type="checkbox" name="consent" ${co.require_terms_consent ? "checked" : ""}> Customers must accept the terms in Checkout (set the terms URL in Stripe → Settings → Public details first)</label>
        <label class="ms-check"><input type="checkbox" name="tax_id" ${co.collect_tax_id !== false ? "checked" : ""}> Let companies add their VAT number</label></section>
      <div class="ms-row"><button class="btn btn-primary" type="submit">Save settings</button></div></form>`;
    fn("stripe-admin", { action: "mode" }).then((m) => ($("[data-m2]").textContent = m.mode)).catch(() => ($("[data-m2]").textContent = "functions not deployed"));
    $("[data-f]").onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target, v = Object.fromEntries(new FormData(f));
      const save = (k, val) => rpc("admin_save_billing_setting", { p_key: k, p_value: val });
      try {
        await save("timezone", v.timezone);
        await save("default_currency", "eur");
        await save("currencies", ["eur"]);
        await save("trial_policy", { one_per_user: f.one_trial.checked });
        await save("dunning", { keep_access_while_retrying: f.keep_access.checked });
        if (f.enforce_library.checked !== (s.enforce_library_access === true)) {
          if (f.enforce_library.checked && !(await A.confirmDialog({ title: "Require a membership for the library?", text: "Members without an active plan (or grant) will be refused by the server. Make sure the MemberPress migration is complete.", confirm: "Turn on", danger: true }))) return;
          await save("enforce_library_access", f.enforce_library.checked);
        }
        await save("emails", { from_name: v.from_name, from_email: v.from_email, reply_to: v.reply_to, trial_reminder_days: Number(v.trial_reminder_days), access_end_reminder_days: Number(v.access_end_reminder_days) });
        await save("legal", { terms_url: v.terms_url, privacy_url: v.privacy_url, cancellation_url: v.cancellation_url });
        await save("checkout", { require_terms_consent: f.consent.checked, collect_tax_id: f.tax_id.checked });
        await save("tax", { mode: f.tax_mode.value });
        await save("fx", { usd_follows_eur: false });
        A.toast("Settings saved.");
      } catch (err) { fail(err); }
    };
  }

  // ---------- Router ----------
  // ============================================================================================ Requests
  // Contact, demo and custom-plan requests from the website (supabase/contact-requests.sql)
  async function requests() {
    view.innerHTML = `<div class="ms-row"><select class="select" data-req-status><option value="new">New</option><option value="">All</option><option value="done">Done</option></select></div><div data-req>Loading…</div>`;
    const KIND = { custom_plan: "Custom plan", demo: "Demo", contact: "Contact" };
    const draw = async () => {
      let list;
      try { list = await A.db.rpc("admin_contact_requests", { p_status: $("[data-req-status]").value || null }).then((r) => { if (r.error) throw r.error; return r.data; }); }
      catch (e) { $("[data-req]").innerHTML = `<p class="panel-sub">${esc(/does not exist|schema cache|Could not find/i.test(e.message) ? "Run supabase/contact-requests.sql in Supabase first." : e.message)}</p>`; return; }
      $("[data-req]").innerHTML = list.length ? `<table class="data"><thead><tr><th>Date</th><th>Type</th><th>From</th><th>Details</th><th>Message</th><th></th></tr></thead><tbody>
        ${list.map((r) => `<tr><td>${dt(r.created_at)}</td><td>${st(KIND[r.kind] || r.kind)}${r.users ? `<br><small>${num(r.users)}+ users</small>` : ""}</td>
          <td><b>${esc(r.name)}</b><br><a href="mailto:${esc(r.email)}">${esc(r.email)}</a></td>
          <td><small>${[r.company, r.country, r.role, r.team_size && `team ${r.team_size}`, r.preferred_day && `${r.preferred_day} ${r.preferred_time || ""}`, r.lang && r.lang.toUpperCase(), r.page && `from ${r.page}`].filter(Boolean).map(esc).join(" · ")}</small></td>
          <td style="max-width:420px;white-space:pre-wrap">${esc(r.message || "")}</td>
          <td><button class="btn btn-sm" type="button" data-req-toggle="${r.id}" data-to="${r.status === "new" ? "done" : "new"}">${r.status === "new" ? "Mark done" : "Reopen"}</button></td></tr>`).join("")}</tbody></table>`
        : `<p class="panel-sub">No requests here.</p>`;
    };
    $("[data-req-status]").addEventListener("change", draw);
    view.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-req-toggle]");
      if (!b) return;
      await busy(b, async () => { const { error } = await A.db.rpc("admin_set_contact_request", { p_id: Number(b.dataset.reqToggle), p_status: b.dataset.to }); if (error) throw error; }).catch(fail);
      draw();
    });
    draw();
  }

  const VIEWS = { dashboard, plans, subscribers, discounts, hidden, emails, events, migration, requests, settings };
  async function route() {
    const [tab, qs] = (location.hash.slice(1) || "dashboard").split("?");
    const k = VIEWS[tab] ? tab : "dashboard";
    $$("[data-tab]").forEach((a) => a.setAttribute("aria-selected", String(a.dataset.tab === k)));
    view.onclick = view.onsubmit = view.onchange = null;
    view.innerHTML = `<p class="muted">Loading…</p>`;
    try { await VIEWS[k](new URLSearchParams(qs || "")); }
    catch (e) { view.innerHTML = `<div class="panel panel-pad"><p class="error-text">${esc(e.message)}</p></div>`; }
  }
  window.addEventListener("hashchange", route);
  route();
})();
