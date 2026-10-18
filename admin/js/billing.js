// SCP Admin — Plans & AI: AI business metrics, plan / pack prices and limits, member subscriptions and packs.
// No charges happen here: until Stripe products are approved, subscriptions and packs are assigned manually.
(async () => {
  const A = window.SCPA;
  const { $, esc, icon, num } = A;
  try { await A.boot("billing"); } catch { return; }
  const main = $("[data-main]");
  const eur = (n) => (n == null ? "—" : `€${Number(n).toFixed(2)}`);
  const usd = (n) => (n == null ? "—" : `$${Number(n).toFixed(n < 1 ? 4 : 2)}`);

  main.innerHTML = `
    <div class="page-head"><div><h1>AI &amp; packs</h1><p>AI analyses economics, AI packs and manual plan assignment. Plans and prices: Memberships.</p></div>
      <div class="head-actions"><select class="select" data-period><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option></select></div></div>
    <p class="error-text" hidden data-err></p>
    <section data-metrics></section>
    <div class="bill-grid">
      <section class="panel panel-pad"><h2>Assign a plan</h2><p class="panel-sub">For members who don't pay through Stripe (team, partners, invoices). Their monthly AI credits start counting from today.</p>
        <form class="bill-form" data-sub-form>
          <input class="input" type="email" name="email" placeholder="member@club.com" required>
          <select class="select" name="plan" data-plan-options></select>
          <select class="select" name="interval"><option value="month">Monthly</option><option value="year">Yearly</option></select>
          <button class="btn btn-primary" type="submit">Save</button>
        </form>
        <h2 style="margin-top:22px">Add an AI pack</h2><p class="panel-sub">Only for members whose plan includes AI. Record it after the payment is received.</p>
        <form class="bill-form" data-pack-form>
          <input class="input" type="email" name="email" placeholder="member@club.com" required>
          <select class="select" name="pack" data-pack-options></select>
          <button class="btn btn-primary" type="submit">Add pack</button>
        </form>
        <p data-form-msg hidden></p>
      </section>
      <section class="panel"><div class="values-head" style="justify-content:space-between"><h2 style="font-size:16px">Members with a plan</h2><span class="muted" data-sub-count></span></div>
        <div class="table-wrap"><table class="data"><thead><tr><th>Member</th><th>Plan</th><th>AI credits</th><th>Unlocks</th><th>Since</th></tr></thead><tbody data-subs></tbody></table></div></section>
    </div>
    <section class="panel panel-pad" style="margin-top:16px"><h2>Plans and prices moved</h2><p class="panel-sub">Plans, EUR / USD prices, permissions, trials and Stripe sync are in <a class="link" href="memberships.html#plans">Memberships → Plans</a>.</p></section>
    <section class="panel" style="margin-top:16px"><div class="values-head"><h2 style="font-size:16px">AI packs</h2></div>
      <div class="table-wrap"><table class="data"><thead><tr><th>Pack</th><th>Analyses</th><th>Price €</th><th>Stripe price</th><th>Active</th><th></th></tr></thead><tbody data-packs></tbody></table></div></section>`;

  const err = (e) => { const el = $("[data-err]"); el.textContent = /schema cache|does not exist/i.test(e.message || "") ? "Run supabase/billing.sql in Supabase first." : A.errMsg(e); el.hidden = false; };
  const msg = (t, ok = true) => { const el = $("[data-form-msg]"); el.textContent = t; el.className = ok ? "success-text" : "error-text"; el.hidden = false; };

  // ---------- Metrics ----------
  async function loadMetrics() {
    const days = Number($("[data-period]").value);
    const { data: m, error } = await A.db.rpc("admin_ai_metrics", { p_from: new Date(Date.now() - days * 864e5).toISOString(), p_to: new Date().toISOString() });
    if (error) return err(error);
    const revenue = Number(m.ai_subscription_mrr_eur || 0) * (days / 30) + Number(m.pack_revenue_eur || 0);
    const card = (label, value, hint = "") => `<div class="panel panel-pad bill-kpi"><span>${label}</span><b>${value}</b>${hint ? `<small>${hint}</small>` : ""}</div>`;
    $("[data-metrics]").innerHTML = `
      <div class="bill-kpis">
        ${card("Unlocks (paid)", num(m.unlocks), `${num(m.unlocks_staff)} by the team, not counted`)}
        ${card("Credits consumed", num(m.units_consumed))}
        ${card("Analyses generated with the API", num(m.analyses_generated_api), `${num(m.analyses_generated_total)} new analyses in total`)}
        ${card("Reused from the database", num(m.unlocks_reused), m.reuse_pct != null ? `${m.reuse_pct}% of unlocks` : "")}
        ${card("Real API cost", usd(m.api_cost_usd), m.avg_cost_per_generated_usd != null ? `${usd(m.avg_cost_per_generated_usd)} per generated analysis` : "")}
        ${card("AI subscriptions (MRR)", eur(m.ai_subscription_mrr_eur), "monthly equivalent, configured prices")}
        ${card("Pack revenue", eur(m.pack_revenue_eur))}
        ${card("Revenue per unlock", eur(m.avg_revenue_per_unlock_eur))}
        ${card("Estimated AI gross margin", eur(revenue - Number(m.api_cost_usd || 0)), "period revenue − API cost (USD ≈ EUR)")}
      </div>`;
  }

  // ---------- Plans & packs ----------
  let plans = [], packs = [];
  async function loadCatalog() {
    const [{ data: p, error: e1 }, { data: k, error: e2 }] = await Promise.all([
      A.db.from("plans").select("*").order("sort"), A.db.from("ai_packs").select("*").order("sort")]);
    if (e1 || e2) return err(e1 || e2);
    plans = p; packs = k;
    $("[data-plan-options]").innerHTML = plans.map((x) => `<option value="${x.key}">${esc(x.name)}</option>`).join("") + `<option value="">No plan (cancel)</option>`;
    $("[data-pack-options]").innerHTML = packs.map((x) => `<option value="${x.key}">${esc(x.name)} · €${x.price}</option>`).join("");
    $("[data-packs]").innerHTML = packs.map((x) => `<tr data-pack="${x.key}">
      <td><input class="input input-sm" name="name" value="${esc(x.name)}"></td>
      <td><input class="input input-sm" name="units" type="number" min="1" value="${x.units}"></td>
      <td><input class="input input-sm" name="price" type="number" step="0.01" min="0" value="${x.price}"></td>
      <td>${x.stripe_price ? `<span class="status status-completed">Linked</span>` : `<span class="status status-reverted">Not linked</span>`}</td>
      <td><input class="check" type="checkbox" name="active" ${x.active ? "checked" : ""}></td>
      <td><button class="btn btn-sm" type="button" data-save-pack>Save</button></td></tr>`).join("");
  }
  const rowValues = (tr) => Object.fromEntries([...tr.querySelectorAll("input")].map((i) => [i.name, i.type === "checkbox" ? i.checked : i.type === "number" ? (i.value === "" ? null : Number(i.value)) : i.value.trim() || null]));
  main.addEventListener("click", async (e) => {
    const sp = null;
    const sk = e.target.closest("[data-save-pack]");
    if (!sp && !sk) return;
    const tr = e.target.closest("tr");
    const { error } = sp
      ? await A.db.from("plans").update({ ...rowValues(tr), updated_at: new Date().toISOString() }).eq("key", tr.dataset.plan)
      : await A.db.from("ai_packs").update({ ...rowValues(tr), updated_at: new Date().toISOString() }).eq("key", tr.dataset.pack);
    if (error) return A.toast(A.errMsg(error), "err");
    A.toast("Saved. The website shows the new values.");
    loadCatalog(); loadSubs(); loadMetrics();
  });

  // ---------- Members ----------
  async function loadSubs() {
    const { data, error } = await A.db.rpc("admin_subscriptions");
    if (error) return err(error);
    $("[data-sub-count]").textContent = num(data.filter((x) => x.status === "active").length) + " active";
    const nameOf = (k) => plans.find((p) => p.key === k)?.name || k;
    $("[data-subs]").innerHTML = data.map((x) => `<tr>
      <td><b>${esc(x.name || "—")}</b><div class="muted">${esc(x.email)}</div></td>
      <td>${esc(nameOf(x.plan_key))}${x.status !== "active" ? ` <span class="status status-reverted">${esc(x.status)}</span>` : ""}<div class="muted">${x.billing_interval === "year" ? "Yearly" : "Monthly"} · ${esc(x.source)}</div></td>
      <td>${x.monthly_limit ? `${x.monthly_left} / ${x.monthly_limit}` : "—"}${x.pack_left ? `<div class="muted">+ ${x.pack_left} pack</div>` : ""}</td>
      <td>${num(x.unlocks)}</td>
      <td class="muted">${new Date(x.started_at).toLocaleDateString("en-GB")}</td></tr>`).join("") || `<tr><td colspan="5" class="muted">No members with a plan yet.</td></tr>`;
  }
  $("[data-sub-form]").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const { error } = await A.db.rpc("admin_set_subscription", { p_email: f.email.value, p_plan: f.plan.value || null, p_interval: f.interval.value });
    if (error) return msg(A.errMsg(error), false);
    msg(f.plan.value ? "Plan saved." : "Plan cancelled."); f.reset(); loadSubs(); loadMetrics();
  });
  $("[data-pack-form]").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const { error } = await A.db.rpc("admin_grant_pack", { p_email: f.email.value, p_pack_key: f.pack.value });
    if (error) return msg(A.errMsg(error), false);
    msg("Pack added."); f.reset(); loadSubs(); loadMetrics();
  });
  $("[data-period]").addEventListener("change", loadMetrics);

  await loadCatalog();
  loadSubs();
  loadMetrics();
})();
