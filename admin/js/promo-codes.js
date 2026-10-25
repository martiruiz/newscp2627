// SCP Admin — Promo codes: the discount codes customers can type at checkout (Stripe coupons + promotion codes) and the
// announcement bar at the top of the public website ("Special pricing for Spain - 15% off yearly plans with CODE").
// Data: billing_discounts (supabase/memberships.sql) + banner fields (supabase/promo-codes.sql).
// Stripe: the Edge Function stripe-admin creates / disables the coupon and promotion code (test mode until approved).
(async () => {
  const A = window.SCPA;
  const { $, $$, esc, icon, num, info } = A;
  try { await A.boot("promo"); } catch { return; }
  const main = $("[data-main]");
  const cfg = window.SCP_CONFIG || {};
  const day = (v) => (v ? new Date(v).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Madrid" }) : "");
  const money = (n) => `€${Number(n).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  const COUNTRY = new Intl.DisplayNames(["en"], { type: "region" });
  const country = (c) => { try { return COUNTRY.of(c); } catch { return c; } };
  const ST = { live: "ok", "not in stripe yet": "warn", expired: "off", "used up": "off", off: "off" };
  const fail = (e) => A.toast(e.message || String(e), "err");

  async function rpc(name, params = {}) {
    const { data, error } = await A.db.rpc(name, params);
    if (error) throw new Error(/admin_set_discount_banner|banner/i.test(error.message) ? "Run supabase/promo-codes.sql in Supabase first."
      : /does not exist|schema cache|Could not find the function/i.test(error.message) ? "Run supabase/memberships.sql and supabase/promo-codes.sql in Supabase first." : error.message);
    return data;
  }
  async function fn(name, body) {
    const s = (await A.db.auth.getSession()).data.session;
    const r = await fetch(`${cfg.supabaseUrl}/functions/v1/${name}`, { method: "POST", headers: { "Content-Type": "application/json", apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${s?.access_token}` }, body: JSON.stringify(body) }).catch(() => null);
    if (!r) throw new Error(`The ${name} function isn't reachable.`);
    const d = await r.json().catch(() => ({}));
    if (r.status === 404) throw new Error(`The ${name} function isn't deployed yet.`);
    if (!r.ok) throw new Error(d.error || `${name}: ${r.status}`);
    return d;
  }
  const busy = async (btn, work) => { const t = btn.innerHTML; btn.disabled = true; btn.innerHTML = "Working…"; try { return await work(); } finally { btn.disabled = false; btn.innerHTML = t; } };
  const off = (d) => (d.kind === "percent" ? `${Number(d.percent_off)}% off` : `${money(d.amount_off_eur)} off`);
  // the same sentence the website shows
  const sentence = (d) => `Special pricing${d.banner_countries?.length === 1 ? ` for <b>${esc(country(d.banner_countries[0]))}</b>` : ""} - <b>${off(d)}</b>${d.banner_text ? ` ${esc(d.banner_text)}` : ""} with <code>${esc(d.code)}</code>`;

  main.innerHTML = `<div class="page-head"><div><h1>Promo codes</h1><p>Codes customers type at checkout (created in Stripe) and the offer bar at the top of the website.</p></div>
    <div class="head-actions"><button class="btn btn-primary" type="button" data-new>${icon("plus")}New code</button></div></div>
    <div class="aud-kpis" data-kpis></div>
    <section class="panel pc-live" data-live></section>
    <section class="panel pc-codes"><header class="aud-h aud-h-lg"><h2>Codes</h2>${info("Every discount code, newest first: what it takes off and for how long, the plans and periods it works on, how many times it was used (and how many of those customers are still paying), its dates, its state in Stripe and whether it shows in the website bar.")}<span class="spacer"></span><b class="aud-count" data-count></b></header>
      <div class="table-wrap"><table class="data"><thead><tr><th>Code</th><th>Discount</th><th>Applies to</th><th>Uses</th><th>Dates</th><th>State</th><th>Website bar</th><th></th></tr></thead>
      <tbody data-rows><tr><td colspan="8">Loading…</td></tr></tbody></table></div></section>
    <p class="muted ms-small" style="margin-top:12px">A code works at checkout once it's created in Stripe. Its economic terms (amount, duration, plans) can't change after that — disable it and create a new one instead. Stripe runs in test mode until the products are validated.</p>`;

  let list = [];
  async function draw() {
    try { list = await rpc("admin_discounts"); } catch (e) { $("[data-rows]").innerHTML = `<tr><td colspan="8" class="muted">${esc(e.message)}</td></tr>`; return; }
    const shown = list.filter((d) => d.banner && d.state === "live");
    $("[data-count]").textContent = num(list.length);
    const kpi = (label, tip, n, cls = "") => `<div class="aud-kpi${cls ? ` ${cls}` : ""}"><span>${label} ${info(tip)}</span><b>${n}</b></div>`;
    $("[data-kpis]").innerHTML = kpi("Codes", "All the discount codes created here, in any state.", num(list.length))
      + kpi("Live", "Codes created in Stripe, active and within their dates: customers can use them at checkout now.", num(list.filter((d) => d.state === "live").length), "is-green")
      + kpi("Times used", "How many checkouts used a code, all codes together.", num(list.reduce((n, d) => n + (d.times_redeemed || 0), 0)), "is-gold")
      + kpi("Paying with a code", "Customers who used a code and are still paying today.", num(list.reduce((n, d) => n + (d.paying || 0), 0)));
    $("[data-live]").innerHTML = `<header class="aud-h"><h2>On the website now</h2>${info("The offer bar at the top of the public website: which live code it shows and to which visitors (by country). Press “Website bar” on a code to set it.")}</header>${shown.length ? shown.map((d) => `<div class="pc-bar">${sentence(d)}</div><p class="muted ms-small">${d.banner_countries ? `Visitors from ${d.banner_countries.map(country).join(", ")}` : "Every visitor"}${d.banner_priority ? ` · priority ${d.banner_priority}` : ""}</p>`).join("")
      : `<p class="muted">No bar on the website. Press “Website bar” on a live code to show it.</p>`}${list.some((d) => d.banner && d.state !== "live") ? `<p class="muted ms-small">Codes marked for the bar that aren't live (not in Stripe yet, expired, used up or off) stay hidden.</p>` : ""}`;
    $("[data-rows]").innerHTML = list.map((d) => `<tr>
      <td><span class="pc-code">${esc(d.code)}</span><br><small class="muted">${esc(d.name)}</small></td>
      <td>${off(d)} · ${d.duration === "once" ? "first charge" : d.duration === "repeating" ? `${d.duration_months} months` : "forever"}</td>
      <td>${esc(d.plan_keys?.join(", ") || "all plans")}${d.intervals ? ` · ${esc(d.intervals.join("/"))}` : ""}</td>
      <td>${num(d.times_redeemed)}${d.max_redemptions ? ` / ${num(d.max_redemptions)}` : ""}<br><small class="muted">${num(d.paying)} paying</small></td>
      <td>${d.starts_at ? `from ${day(d.starts_at)}` : ""}${d.expires_at ? ` until ${day(d.expires_at)}` : d.starts_at ? "" : "no end"}</td>
      <td><span class="ms-badge is-${ST[d.state] || "off"}">${esc(d.state)}</span></td>
      <td>${d.banner ? `<span class="ms-badge is-${d.state === "live" ? "ok" : "warn"}">${d.banner_countries ? esc(d.banner_countries.join(" ")) : "everyone"}</span> ` : ""}<button class="btn btn-sm btn-ghost" type="button" data-bar="${d.id}">${d.banner ? "Edit" : "Show"}</button></td>
      <td class="pc-acts"><button class="btn btn-sm btn-ghost" type="button" data-copy="${esc(d.code)}" title="Copy code">${icon("copy")}</button>
        ${!d.stripe_coupon_id ? `<button class="btn btn-sm" type="button" data-sync="${d.id}">Create in Stripe</button>` : d.active ? `<button class="btn btn-sm btn-ghost" type="button" data-off="${d.id}">Disable</button>` : ""}</td></tr>`).join("")
      || `<tr><td colspan="8" class="muted">No codes yet. Create one with “New code”.</td></tr>`;
  }

  main.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    try {
      if (b.matches("[data-new]")) return newCode();
      if (b.dataset.copy) { await navigator.clipboard.writeText(b.dataset.copy); return A.toast("Code copied."); }
      if (b.dataset.bar) return barDialog(list.find((d) => d.id === b.dataset.bar));
      if (b.dataset.sync) {
        if (!(await A.confirmDialog({ title: "Create this code in Stripe?", text: "Stripe gets a coupon and a promotion code with these terms. They can't be changed afterwards.", confirm: "Create in Stripe" }))) return;
        await busy(b, () => fn("stripe-admin", { action: "sync_discount", id: b.dataset.sync })); A.toast("Created in Stripe. Customers can use it now."); return draw();
      }
      if (b.dataset.off) {
        if (!(await A.confirmDialog({ title: "Disable this code?", text: "Nobody can use it any more and it leaves the website bar. Customers who already have it keep their discount.", confirm: "Disable", danger: true }))) return;
        await busy(b, () => fn("stripe-admin", { action: "disable_discount", id: b.dataset.off })); return draw();
      }
    } catch (err) { fail(err); }
  });

  async function newCode() {
    const plans = await rpc("admin_membership_plans").catch(() => []);
    const m = A.modal({ title: "New promo code", size: "lg", body: `<form class="ms-form" data-f>
      <div class="ms-grid2" style="margin-top:0"><label>Code customers type<input class="input" name="code" required pattern="[A-Za-z0-9_-]{3,40}" placeholder="SPAIN15" style="text-transform:uppercase"></label>
        <label>Internal campaign name<input class="input" name="name" required placeholder="Spain launch 2026"></label></div>
      <div class="ms-grid3"><label>Type<select class="select" name="kind"><option value="percent">Percentage</option><option value="amount">Fixed amount (€)</option></select></label>
        <label data-k="percent">% off<input class="input" type="number" name="percent_off" min="1" max="100" step="0.01" placeholder="15"></label>
        <label data-k="amount" hidden>Amount off (€)<input class="input" type="number" name="amount_off_eur" min="0.5" step="0.01" placeholder="20"></label></div>
      <div class="ms-grid3"><label>Duration<select class="select" name="duration"><option value="once">First charge only</option><option value="repeating">Several months</option><option value="forever">Forever</option></select></label>
        <label data-months hidden>Months<input class="input" type="number" name="duration_months" min="1" placeholder="3"></label></div>
      <h3>Applies to</h3><div class="ms-perms-edit">${plans.filter((p) => !p.archived_at).map((p) => `<label class="ms-check"><input type="checkbox" name="plan" value="${esc(p.key)}"> ${esc(p.name)}</label>`).join("") || `<p class="muted ms-small">All plans.</p>`}</div>
      <div class="ms-grid3"><label class="ms-check"><input type="checkbox" name="iv" value="month"> Monthly</label><label class="ms-check"><input type="checkbox" name="iv" value="year"> Yearly</label></div>
      <p class="muted ms-small">Leave unticked = all plans / periods.</p>
      <div class="ms-grid4"><label>Starts<input class="input" type="date" name="starts_at"></label><label>Expires<input class="input" type="date" name="expires_at"></label>
        <label>Total uses<input class="input" type="number" name="max_redemptions" min="1"></label><label>Uses per customer<input class="input" type="number" name="max_per_customer" min="1" value="1"></label></div>
    </form>`, foot: `<button class="btn btn-ghost" type="button" data-x>Cancel</button><button class="btn btn-primary" type="button" data-save>Save</button>` });
    const f = $("[data-f]", m.el);
    f.addEventListener("change", () => {
      const k = f.kind.value; $$("[data-k]", f).forEach((l) => { l.hidden = l.dataset.k !== k; });
      $("[data-months]", f).hidden = f.duration.value !== "repeating";
    });
    $("[data-x]", m.el).onclick = () => m.close();
    $("[data-save]", m.el).onclick = async () => {
      if (!f.reportValidity()) return;
      const v = Object.fromEntries(new FormData(f));
      if (v.kind === "percent" && !v.percent_off) return A.toast("Say the % off.", "err");
      if (v.kind === "amount" && !v.amount_off_eur) return A.toast("Say the amount off.", "err");
      if (v.duration === "repeating" && !v.duration_months) return A.toast("Say for how many months.", "err");
      const p = { ...v, code: v.code.toUpperCase(), percent_off: v.kind === "percent" ? v.percent_off : "", amount_off_eur: v.kind === "amount" ? v.amount_off_eur : "",
        currencies: ["eur"], plan_keys: $$("[name=plan]:checked", f).map((x) => x.value), intervals: $$("[name=iv]:checked", f).map((x) => x.value),
        starts_at: v.starts_at ? new Date(`${v.starts_at}T00:00:00`).toISOString() : "", expires_at: v.expires_at ? new Date(`${v.expires_at}T23:59:59`).toISOString() : "" };
      try { await rpc("admin_save_discount", { p }); A.toast("Saved. Press “Create in Stripe” to make it usable."); m.close(); draw(); } catch (err) { fail(err); }
    };
  }

  function barDialog(d) {
    const m = A.modal({ title: `Website bar · ${d.code}`, body: `<form class="ms-form" data-f>
      <label class="ms-check"><input type="checkbox" name="on" ${d.banner ? "checked" : ""}> Show this code in the bar at the top of the website</label>
      <label>Countries <small class="muted">(two-letter codes separated by commas, e.g. ES or ES, AD — empty = every visitor)</small><input class="input" name="countries" value="${esc((d.banner_countries || []).join(", "))}" placeholder="ES"></label>
      <label>What it's for <small class="muted">(optional, after the discount)</small><input class="input" name="text" maxlength="60" value="${esc(d.banner_text || "")}" placeholder="on yearly plans"></label>
      <label>The same in Spanish <small class="muted">(for the Spanish website)</small><input class="input" name="text_es" maxlength="60" value="${esc(d.banner_text_es || "")}" placeholder="en los planes anuales"></label>
      <label>Priority <small class="muted">(when several codes match a visitor, the highest wins; country codes always beat “everyone”)</small><input class="input" type="number" name="priority" value="${Number(d.banner_priority || 0)}"></label>
      <p class="muted ms-small">Preview</p><div class="pc-bar" data-prev></div>
      ${d.state !== "live" ? `<p class="muted ms-small">This code is “${esc(d.state)}”: the bar only shows live codes.</p>` : ""}
    </form>`, foot: `<button class="btn btn-ghost" type="button" data-x>Cancel</button><button class="btn btn-primary" type="button" data-save>Save</button>` });
    const f = $("[data-f]", m.el);
    const read = () => ({ on: f.on.checked, countries: f.countries.value.split(/[\s,;]+/).map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c)), text: f.text.value.trim(), text_es: f.text_es.value.trim(), priority: Number(f.priority.value) || 0 });
    const prev = () => { const r = read(); $("[data-prev]", m.el).innerHTML = sentence({ ...d, banner_countries: r.countries.length ? r.countries : null, banner_text: r.text }); };
    f.addEventListener("input", prev); prev();
    $("[data-x]", m.el).onclick = () => m.close();
    $("[data-save]", m.el).onclick = async () => {
      const r = read();
      try { await rpc("admin_set_discount_banner", { p_id: d.id, p_on: r.on, p_countries: r.countries, p_text: r.text, p_text_es: r.text_es, p_priority: r.priority }); A.toast(r.on ? "The website bar is updated." : "Removed from the website bar."); m.close(); draw(); }
      catch (err) { fail(err); }
    };
  }

  await draw();
})();
