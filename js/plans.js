// Plans & AI packs (pricing page and home). Everything comes from Supabase (Super Admin → Memberships):
// public_membership_plans() → plans on sale, their EUR / USD monthly / yearly prices, features and permissions.
// A hidden membership opens with pricing.html#private=<token> (checked on the server, private_membership()).
// Monthly / yearly and EUR / USD switches, comparison table, the member's current plan, and Stripe Checkout with a
// confirmation of the terms first (js/checkout.js). Nothing is hard-coded: when the database can't be reached the
// page says so instead of showing made-up prices.
(() => {
  const boxes = document.querySelectorAll("[data-plans]");
  const packBox = document.querySelector("[data-packs]");
  const compareBox = document.querySelector("[data-compare]");
  if (!boxes.length && !packBox) return;
  const cfg = window.SCP_CONFIG || {};
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const SYM = { eur: "€", usd: "$" };
  const fmt = (n, cur) => `${SYM[cur] || ""}${Number(n).toFixed(2).replace(/\.00$/, "")}`;
  const tick = (t, on = true) => `<li class="${on ? "" : "is-off"}"><img src="assets/tick.svg" alt=""><span>${t}</span></li>`;
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

  let data = null;          // { plans, entitlements, currencies, legal }
  let interval = "month", currency = "eur";
  let mine = null;          // my_membership() for signed-in members
  let privateToken = null, privatePlan = null;

  const priceOf = (p, cur = currency, iv = interval) => p.prices.find((x) => x.currency === cur && x.interval === iv);
  const hasYear = (p) => !!priceOf(p, currency, "year");
  const saving = (p) => { const m = priceOf(p, currency, "month"), y = priceOf(p, currency, "year"); return m && y ? Math.round((1 - y.amount / (m.amount * 12)) * 100) : 0; };
  const currentSub = () => mine?.subscription && ["active", "trialing", "past_due", "unpaid"].includes(mine.subscription.status) && mine.subscription.source === "stripe" ? mine.subscription : null;

  function planCard(p, { solo = false } = {}) {
    const price = priceOf(p) || priceOf(p, currency, "month");
    const iv = price?.interval || interval;
    const cur = currentSub();
    const isCurrent = cur?.plan === p.key;
    const trial = p.trial_days > 0 && (!mine || mine.trial_eligible) ? p.trial_days : 0;
    const ai = p.ai_unlimited ? "<b>Unlimited AI analyses</b>" : p.ai_monthly_units ? `<b>${p.ai_monthly_units} AI analyses</b> every month` : "";
    const features = (p.features?.length ? p.features : []).map((f) => tick(esc(f))).join("") + (ai && !(p.features || []).some((f) => /AI analys/i.test(f) && /\d/.test(f)) ? tick(ai) : "");
    let cta;
    if (isCurrent) cta = `<a class="btn btn-outline plan-cta" href="profile.html#billing">Manage your plan</a>`;
    else if (!price) cta = `<span class="btn btn-outline plan-cta is-current">Not available in ${currency.toUpperCase()}</span>`;
    else if (!price.ready) cta = `<a class="btn btn-outline plan-cta" href="contact.html">Coming soon — contact us</a>`;
    else if (cur) cta = `<a class="btn btn-outline plan-cta" href="profile.html?change=${encodeURIComponent(p.key)}&interval=${iv}#billing">Switch to ${esc(p.name)}</a>`;
    else cta = `<button class="btn ${p.highlighted || solo ? "btn-gold" : "btn-outline"} plan-cta" type="button" data-checkout-plan="${esc(p.key)}" data-interval="${iv}" data-currency="${currency}"${privateToken && p.key === privatePlan?.key ? ` data-link="${esc(privateToken)}"` : ""}><span>${trial ? `Start ${trial}-day free trial` : `Get ${esc(p.name)}`}</span><i class="plan-cta-arrow" aria-hidden="true">→</i></button>`;
    const flag = isCurrent ? `<span class="plan-flag is-current">${cur.status === "trialing" ? "Your trial" : "Your plan"}</span>` : p.badge || p.highlighted ? `<span class="plan-flag">${esc(p.badge || "Most complete")}</span>` : "";
    const note = isCurrent
      ? (cur.status === "trialing" && cur.trial_end ? `Free trial until ${new Date(cur.trial_end).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : cur.cancel_at_period_end ? `Ends on ${new Date(cur.current_period_end).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "&nbsp;")
      : trial && price?.ready ? `Card required · ${SYM[currency]}0 today · then ${fmt(price.amount, currency)}/${iv === "year" ? "year" : "month"}${iv === "month" ? " · billed on the 1st" : ""}`
      : `${currency === "usd" ? "Plus tax where applicable" : "VAT included"} · ${iv === "month" ? "billed on the 1st · " : ""}cancel anytime`;
    return `<article class="plan-card${p.highlighted ? " is-best" : ""}${isCurrent ? " is-current" : ""}">
      ${flag}
      <h3>${esc(p.name)}</h3>
      <p class="plan-blurb">${esc(p.tagline || p.description || "")}</p>
      <p class="plan-price">${price ? `<b data-price="${price.amount}" data-cur="${currency}">${fmt(price.amount, currency)}</b><span>/ ${iv === "year" ? "year" : "month"}</span>` : `<b>—</b>`}</p>
      <p class="plan-sub">${price && iv === "year" ? `${fmt(price.amount / 12, currency)}/month · ${saving(p) > 0 ? `save ${saving(p)}%` : "billed yearly"}` : hasYear(p) ? `or ${fmt(priceOf(p, currency, "year").amount, currency)}/year${saving(p) > 0 ? ` (save ${saving(p)}%)` : ""}` : "&nbsp;"}</p>
      <ul class="plan-features">${features}</ul>
      ${cta}
      <p class="plan-note">${note}</p>
    </article>`;
  }

  // Comparison table: one row per permission, ✓ / – per plan
  function compareHtml(plans) {
    if (!plans.length) return "";
    const rows = (data.entitlements || []).map((e) => `<tr><th scope="row">${esc(e.label)}${e.description ? `<small>${esc(e.description)}</small>` : ""}</th>${plans.map((p) => `<td>${p.entitlements.includes(e.key) ? '<span class="cmp-yes" aria-label="Included">✓</span>' : '<span class="cmp-no" aria-label="Not included">–</span>'}</td>`).join("")}</tr>`).join("");
    const ai = `<tr><th scope="row">AI analyses per month</th>${plans.map((p) => `<td>${p.ai_unlimited ? "Unlimited" : p.ai_monthly_units || "–"}</td>`).join("")}</tr>`;
    const trial = `<tr><th scope="row">Free trial (card required)</th>${plans.map((p) => `<td>${p.trial_days ? `${p.trial_days} days` : "–"}</td>`).join("")}</tr>`;
    const price = `<tr class="cmp-price"><th scope="row">Price</th>${plans.map((p) => { const x = priceOf(p); return `<td>${x ? `${fmt(x.amount, currency)}<small>/ ${x.interval === "year" ? "year" : "month"}</small>` : "–"}</td>`; }).join("")}</tr>`;
    return `<div class="cmp-wrap"><table class="cmp"><thead><tr><th></th>${plans.map((p) => `<th scope="col"${p.highlighted ? ' class="is-best"' : ""}>${esc(p.name)}</th>`).join("")}</tr></thead><tbody>${price}${rows}${ai}${trial}</tbody></table></div>`;
  }

  function switches(plans) {
    const curs = (data.currencies || ["eur"]).filter((c) => plans.some((p) => p.prices.some((x) => x.currency === c)));
    const best = Math.max(0, ...plans.map(saving));
    const anyYear = plans.some((p) => p.prices.some((x) => x.interval === "year" && x.currency === currency));
    return `<div class="plan-switches">
      ${anyYear ? `<div class="plan-interval" role="tablist" aria-label="Billing period">
        <button type="button" role="tab" aria-selected="${interval === "month"}" data-interval-pick="month">Monthly</button>
        <button type="button" role="tab" aria-selected="${interval === "year"}" data-interval-pick="year">Yearly${best ? `<em>save ${best}%</em>` : ""}</button>
      </div>` : ""}
      ${curs.length > 1 ? `<div class="plan-interval plan-currency" role="tablist" aria-label="Currency">${curs.map((c) => `<button type="button" role="tab" aria-selected="${currency === c}" data-currency-pick="${c}">${c.toUpperCase()}</button>`).join("")}</div>` : ""}
    </div>`;
  }

  // ---------- Motion: cards rise in one by one, prices count up (once, on screen); a light follows the cursor ----------
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const countUp = (el, delay) => {
    const to = Number(el.dataset.price), cur = el.dataset.cur || "eur";
    if (!to || reduced) return;
    const start = performance.now() + delay, dur = 1100;
    el.textContent = fmt(0, cur);
    const step = (now) => {
      const t = Math.min(1, Math.max(0, (now - start) / dur));
      el.textContent = t >= 1 ? fmt(to, cur) : `${SYM[cur]}${(to * (1 - Math.pow(1 - t, 3))).toFixed(2)}`;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  function decorate(box, swap) {
    [...box.querySelectorAll(".plan-card")].forEach((card, i) => {
      card.style.setProperty("--ci", i);
      card.querySelectorAll(".plan-features li").forEach((li, k) => li.style.setProperty("--li", k));
    });
    if (box.dataset.fx === "in") { box.dataset.fx = "done"; return; }
    if (box.dataset.fx === "done") { if (swap) box.querySelectorAll(".plan-price").forEach((p) => p.classList.add("is-swapping")); return; }
    if (reduced || !("IntersectionObserver" in window)) { box.dataset.fx = "done"; return; }
    box.dataset.fx = "wait";
    if (box._fxObs) return;
    box._fxObs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      box._fxObs.disconnect();
      box.dataset.fx = "in";
      box.querySelectorAll("[data-price]").forEach((el, i) => countUp(el, 250 + i * 120));
      setTimeout(() => { box.dataset.fx = "done"; }, 2200);
    }, { threshold: 0.25 });
    box._fxObs.observe(box);
    box.addEventListener("pointermove", (e) => {
      const card = e.target.closest(".plan-card");
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  }

  async function rpc(fn, args = {}) {
    const client = window.SCP_AUTH?.client;
    if (client) { const { data: d, error } = await client.rpc(fn, args); if (error) throw error; return d; }
    const r = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}`, "Content-Type": "application/json" }, body: JSON.stringify(args) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  function draw(swap = false) {
    const plans = privatePlan ? [privatePlan] : data.plans;
    boxes.forEach((b) => {
      b.classList.toggle("is-solo", plans.length === 1);
      b.innerHTML = plans.length ? plans.map((p) => planCard(p, { solo: plans.length === 1 })).join("") : `<p class="plans-empty">Plans will be published here soon. <a class="link-gold" href="contact.html">Contact us</a> in the meantime.</p>`;
      decorate(b, swap);
      const prev = b.previousElementSibling?.matches?.(".plan-switches") ? b.previousElementSibling : null;
      if (prev) prev.outerHTML = switches(plans); else b.insertAdjacentHTML("beforebegin", switches(plans));
    });
    if (compareBox) compareBox.innerHTML = privatePlan ? "" : compareHtml(plans);
    const legal = document.querySelector("[data-legal]");
    if (legal && data.legal) legal.innerHTML = [data.legal.terms_url && `<a href="${esc(data.legal.terms_url)}">Terms of service</a>`, data.legal.privacy_url && `<a href="${esc(data.legal.privacy_url)}">Privacy policy</a>`].filter(Boolean).join(" · ");
  }

  // Before supabase/memberships.sql is installed: the plans table as it was (EUR only)
  async function legacyPlans() {
    try {
      const r = await fetch(`${cfg.supabaseUrl}/rest/v1/plans?select=*&active=eq.true&order=sort`, { headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}` } });
      const rows = r.ok ? await r.json() : [];
      if (!rows.length) return null;
      const ent = (p) => ["library.access", "library.save_posts", ...(p.has_ai ? ["ai.access", "ai.analyze_posts"] : []), ...(p.has_planner ? ["planner.access", "planner.create_calendars", "planner.drag_drop"] : [])];
      return {
        currencies: ["eur"], default_currency: "eur", legal: null,
        entitlements: [{ key: "library.access", label: "Content Library" }, { key: "library.save_posts", label: "Save posts" }, { key: "ai.analyze_posts", label: "AI analysis" }, { key: "planner.access", label: "Content Plan" }],
        plans: rows.map((p) => ({ key: p.key, name: p.name, tagline: "", features: [], highlighted: p.key === "all_access", trial_days: p.trial_days ?? 7,
          ai_monthly_units: p.ai_monthly_units, ai_unlimited: false, entitlements: ent(p),
          prices: [{ currency: "eur", interval: "month", amount: Number(p.price_month), ready: !!p.stripe_price_month },
            ...(p.price_year ? [{ currency: "eur", interval: "year", amount: Number(p.price_year), ready: !!p.stripe_price_year }] : [])] })),
      };
    } catch { return null; }
  }

  async function packs() {
    if (!packBox) return;
    try {
      const r = await fetch(`${cfg.supabaseUrl}/rest/v1/ai_packs?select=*&active=eq.true&order=sort`, { headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}` } });
      const rows = r.ok ? await r.json() : [];
      packBox.innerHTML = rows.map((k) => `<article class="pack-card">
        <p class="pack-units"><b>${k.units}</b> AI analyses</p>
        <p class="pack-price">${fmt(k.price, "eur")}</p>
        <p class="pack-each">${fmt(k.price / k.units, "eur")} per analysis · never expire</p>
        <button class="btn btn-outline" type="button" data-checkout-pack="${esc(k.key)}">Buy this pack</button>
      </article>`).join("");
      if (!rows.length) packBox.closest(".packs-wrap")?.setAttribute("hidden", "");
    } catch { packBox.closest(".packs-wrap")?.setAttribute("hidden", ""); }
  }

  (async () => {
    const q = new URLSearchParams(location.search), h = new URLSearchParams(location.hash.slice(1));
    privateToken = h.get("private") || q.get("private");
    try {
      data = await rpc("public_membership_plans");
    } catch {
      data = await legacyPlans();
      if (!data) { boxes.forEach((b) => (b.innerHTML = `<p class="plans-empty">We couldn't load the plans right now. Please refresh in a moment.</p>`)); return; }
    }
    if (privateToken) {
      try {
        const pm = await rpc("private_membership", { p_token: privateToken });
        if (pm?.ok) {
          privatePlan = pm.plan;
          document.querySelector("[data-private-intro]")?.removeAttribute("hidden");
          const t = document.querySelector("[data-private-title]"); if (t) t.textContent = pm.plan.name;
          document.querySelectorAll("[data-public-only]").forEach((el) => el.setAttribute("hidden", ""));
          document.querySelector('meta[name="robots"]')?.setAttribute("content", "noindex");
        } else window.SCP_CHECKOUT?.notify(pm?.error || "This link isn't valid any more.", { kind: "is-err" });
      } catch { /* show public plans */ }
    }
    const plans = privatePlan ? [privatePlan] : data.plans;
    const curs = data.currencies || ["eur"];
    // EUR in Europe, USD everywhere else (from the visitor's time zone — no location lookup), unless they chose
    const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; } })();
    const byPlace = /^Europe\/|^Atlantic\/(Canary|Madeira|Azores)|^Africa\/Ceuta/.test(tz) ? "eur" : "usd";
    currency = (q.get("currency") || store.get("scp-currency") || byPlace || data.default_currency || "eur").toLowerCase();
    if (!curs.includes(currency) || !plans.some((p) => p.prices.some((x) => x.currency === currency))) currency = data.default_currency || "eur";
    interval = q.get("interval") === "year" || store.get("scp-interval") === "year" ? "year" : "month";
    if (!plans.some((p) => priceOf(p))) interval = interval === "year" ? "month" : "year";
    draw();
    packs();
    document.addEventListener("click", (e) => {
      const iv = e.target.closest("[data-interval-pick]");
      if (iv && iv.dataset.intervalPick !== interval) { interval = iv.dataset.intervalPick; store.set("scp-interval", interval); draw(true); }
      const c = e.target.closest("[data-currency-pick]");
      if (c && c.dataset.currencyPick !== currency) { currency = c.dataset.currencyPick; store.set("scp-currency", currency); draw(true); }
    });
    const client = window.SCP_AUTH?.client;
    if (client && (await client.auth.getSession()).data.session) {
      try {
        mine = await rpc("my_membership");
        if (mine?.currency && mine.currency !== currency && (data.currencies || []).includes(mine.currency)) currency = mine.currency;
        draw();
      } catch { /* older database: plans still work */ }
    }
  })();
})();
