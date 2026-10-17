// Plans & AI packs (pricing page and home). Prices and limits come from Supabase (tables plans / ai_packs,
// editable in Admin → Plans & AI); the values below are only a fallback if the database can't be reached.
// Plans: monthly / yearly switch, 7-day free trial with card; packs bought online. Payments go through Stripe Checkout
// (js/checkout.js); when payments aren't set up for a plan yet, the button falls back to sign-up / contact.
(() => {
  const boxes = document.querySelectorAll("[data-plans]");
  const packBox = document.querySelector("[data-packs]");
  if (!boxes.length && !packBox) return;
  const cfg = window.SCP_CONFIG || {};
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const eur = (n) => `€${Number(n).toFixed(2).replace(/\.00$/, "")}`;
  const FALLBACK_PLANS = [
    { key: "library", name: "Library", price_month: 9.99, price_year: 99.9, trial_days: 7, has_ai: false, has_planner: false, ai_monthly_units: 0 },
    { key: "library_ai", name: "Library + AI", price_month: 19.99, price_year: 199.9, trial_days: 7, has_ai: true, has_planner: false, ai_monthly_units: 30 },
    { key: "library_planner", name: "Library + Content Plan", price_month: 24.99, price_year: 249.9, trial_days: 7, has_ai: false, has_planner: true, ai_monthly_units: 0 },
    { key: "all_access", name: "All Access", price_month: 39.99, price_year: 399.9, trial_days: 7, has_ai: true, has_planner: true, ai_monthly_units: 100 },
  ];
  const FALLBACK_PACKS = [
    { key: "pack_10", name: "10 analyses", units: 10, price: 9.99 },
    { key: "pack_30", name: "30 analyses", units: 30, price: 24.99 },
    { key: "pack_100", name: "100 analyses", units: 100, price: 59.99 },
  ];
  const BLURB = {
    library: "Thousands of sports posts, ready to search.",
    library_ai: "The library plus expert AI breakdowns.",
    library_planner: "The library plus your Content Plan.",
    all_access: "Everything SCP has, for the whole content workflow.",
  };
  const tick = (t, on = true) => `<li class="${on ? "" : "is-off"}"><img src="assets/tick.svg" alt=""><span>${t}</span></li>`;

  let interval = "month";
  let mine = null; // the signed-in member's entitlements (current plan), if any
  const hasYear = (p) => Number(p.price_year) > 0;
  function planCard(p) {
    const best = p.key === "all_access";
    const yearly = interval === "year" && hasYear(p);
    const current = mine?.plan === p.key && ["active", "trialing", "past_due"].includes(mine.status);
    const saving = hasYear(p) ? Math.round((1 - p.price_year / (p.price_month * 12)) * 100) : 0;
    const trial = Number(p.trial_days) > 0 && !mine?.plan ? Number(p.trial_days) : 0;
    const cta = current
      ? (mine.source === "stripe" ? `<button class="btn btn-outline plan-cta" type="button" data-billing-portal>Manage your plan</button>` : `<span class="btn btn-outline plan-cta is-current">Your plan</span>`)
      : `<button class="btn ${best ? "btn-gold" : "btn-outline"} plan-cta" type="button" data-checkout-plan="${esc(p.key)}" data-interval="${yearly ? "year" : "month"}">${mine?.plan ? `Switch to ${esc(p.name)}` : trial ? `Start ${trial}-day free trial` : `Get ${esc(p.name)}`}</button>`;
    return `<article class="plan-card${best ? " is-best" : ""}${current ? " is-current" : ""}">
      ${current ? `<span class="plan-flag is-current">${mine.status === "trialing" ? "Your trial" : "Your plan"}</span>` : best ? `<span class="plan-flag">Most complete</span>` : ""}
      <h3>${esc(p.name)}</h3>
      <p class="plan-blurb">${esc(BLURB[p.key] || "")}</p>
      <p class="plan-price">${yearly
        ? `<b>${eur(p.price_year)}</b><span>/ year</span>`
        : `<b>${eur(p.price_month)}</b><span>/ month</span>`}</p>
      <p class="plan-sub">${yearly ? `${eur(p.price_year / 12)}/month · ${saving > 0 ? `save ${saving}%` : "billed yearly"}` : hasYear(p) ? `or ${eur(p.price_year)}/year (save ${saving}%)` : "&nbsp;"}</p>
      <ul class="plan-features">
        ${tick("Full Content Library: thousands of posts")}
        ${tick("Daily new posts, filters and Social News")}
        ${tick("Saved boards and “For you” feed")}
        ${p.has_ai ? tick(`<b>${p.ai_monthly_units} AI analyses</b> every month`) : tick("AI analyses", false)}
        ${p.has_ai ? tick("Extra analysis packs available") : ""}
        ${p.has_planner ? tick("<b>Content Plan</b>: weekly &amp; monthly plans, drag posts in") : tick("Content Plan", false)}
      </ul>
      ${cta}
      <p class="plan-note">${current ? (mine.status === "trialing" && mine.current_period_end ? `Free trial until ${new Date(mine.current_period_end).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "&nbsp;") : trial ? `Card required · €0 today · then ${yearly ? `${eur(p.price_year)}/year` : `${eur(p.price_month)}/month`} · cancel anytime` : "VAT included · cancel anytime"}</p>
    </article>`;
  }
  function packCard(k) {
    return `<article class="pack-card">
      <p class="pack-units"><b>${k.units}</b> AI analyses</p>
      <p class="pack-price">${eur(k.price)}</p>
      <p class="pack-each">${eur(k.price / k.units)} per analysis · never expire</p>
      <button class="btn btn-outline" type="button" data-checkout-pack="${esc(k.key)}">Buy this pack</button>
    </article>`;
  }
  // Monthly / yearly switch above the plans
  function toggleHtml(plans) {
    const best = Math.max(0, ...plans.filter(hasYear).map((p) => Math.round((1 - p.price_year / (p.price_month * 12)) * 100)));
    return `<div class="plan-interval" role="tablist" aria-label="Billing">
      <button type="button" role="tab" aria-selected="${interval === "month"}" data-interval-pick="month">Monthly</button>
      <button type="button" role="tab" aria-selected="${interval === "year"}" data-interval-pick="year">Yearly${best ? `<em>save ${best}%</em>` : ""}</button>
    </div>`;
  }
  async function get(table, fallback) {
    try {
      const r = await fetch(`${cfg.supabaseUrl}/rest/v1/${table}?select=*&active=eq.true&order=sort`, { headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}` } });
      const rows = r.ok ? await r.json() : [];
      return rows.length ? rows : fallback;
    } catch { return fallback; }
  }
  (async () => {
    const [plans, packs] = await Promise.all([get("plans", FALLBACK_PLANS), packBox ? get("ai_packs", FALLBACK_PACKS) : []]);
    try { interval = new URLSearchParams(location.search).get("interval") === "year" || localStorage.getItem("scp-interval") === "year" ? "year" : "month"; } catch {}
    const draw = () => boxes.forEach((b) => {
      b.innerHTML = plans.map(planCard).join("");
      let t = b.previousElementSibling?.matches?.(".plan-interval") ? b.previousElementSibling : null;
      if (plans.some(hasYear)) { if (t) t.outerHTML = toggleHtml(plans); else b.insertAdjacentHTML("beforebegin", toggleHtml(plans)); }
    });
    draw();
    if (packBox) packBox.innerHTML = packs.map(packCard).join("");
    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-interval-pick]");
      if (!b) return;
      interval = b.dataset.intervalPick;
      try { localStorage.setItem("scp-interval", interval); } catch {}
      draw();
    });
    // Signed in: mark the current plan
    const client = window.SCP_AUTH?.client;
    if (client && (await client.auth.getSession()).data.session) {
      const { data } = await client.rpc("my_entitlements");
      if (data?.plan) { mine = data; draw(); }
    }
  })();
})();
