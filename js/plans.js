// Plans & AI packs (pricing page and home). Prices and limits come from Supabase (tables plans / ai_packs,
// editable in Admin → Plans & AI); the values below are only a fallback if the database can't be reached.
// Subscribing / buying isn't charged online yet: CTAs go to sign-up / contact until Stripe products are approved.
(() => {
  const boxes = document.querySelectorAll("[data-plans]");
  const packBox = document.querySelector("[data-packs]");
  if (!boxes.length && !packBox) return;
  const cfg = window.SCP_CONFIG || {};
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const eur = (n) => `€${Number(n).toFixed(2).replace(/\.00$/, "")}`;
  const FALLBACK_PLANS = [
    { key: "library", name: "Library", price_month: 9.99, has_ai: false, has_planner: false, ai_monthly_units: 0 },
    { key: "library_ai", name: "Library + AI", price_month: 19.99, has_ai: true, has_planner: false, ai_monthly_units: 30 },
    { key: "library_planner", name: "Library + Content Plan", price_month: 24.99, has_ai: false, has_planner: true, ai_monthly_units: 0 },
    { key: "all_access", name: "All Access", price_month: 39.99, has_ai: true, has_planner: true, ai_monthly_units: 100 },
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

  function planCard(p) {
    const best = p.key === "all_access";
    return `<article class="plan-card${best ? " is-best" : ""}">
      ${best ? `<span class="plan-flag">Most complete</span>` : ""}
      <h3>${esc(p.name)}</h3>
      <p class="plan-blurb">${esc(BLURB[p.key] || "")}</p>
      <p class="plan-price"><b>${eur(p.price_month)}</b><span>/ month</span></p>
      <ul class="plan-features">
        ${tick("Full Content Library: thousands of posts")}
        ${tick("Daily new posts, filters and Social News")}
        ${tick("Saved boards and “For you” feed")}
        ${p.has_ai ? tick(`<b>${p.ai_monthly_units} AI analyses</b> every month`) : tick("AI analyses", false)}
        ${p.has_ai ? tick("Extra analysis packs available") : ""}
        ${p.has_planner ? tick("<b>Content Plan</b>: weekly &amp; monthly plans, drag posts in") : tick("Content Plan", false)}
      </ul>
      <a class="btn ${best ? "btn-gold" : "btn-outline"} plan-cta" href="signup.html?plan=${encodeURIComponent(p.key)}">Get ${esc(p.name)}</a>
    </article>`;
  }
  function packCard(k) {
    return `<article class="pack-card">
      <p class="pack-units"><b>${k.units}</b> AI analyses</p>
      <p class="pack-price">${eur(k.price)}</p>
      <p class="pack-each">${eur(k.price / k.units)} per analysis · never expire</p>
      <a class="btn btn-outline" href="contact.html?subject=${encodeURIComponent(`AI pack: ${k.name}`)}">Get this pack</a>
    </article>`;
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
    boxes.forEach((b) => (b.innerHTML = plans.map(planCard).join("")));
    if (packBox) packBox.innerHTML = packs.map(packCard).join("");
  })();
})();
