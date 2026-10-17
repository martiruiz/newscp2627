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
      : `<button class="btn ${best ? "btn-gold" : "btn-outline"} plan-cta" type="button" data-checkout-plan="${esc(p.key)}" data-interval="${yearly ? "year" : "month"}"><span>${mine?.plan ? `Switch to ${esc(p.name)}` : trial ? `Start ${trial}-day free trial` : `Get ${esc(p.name)}`}</span><i class="plan-cta-arrow" aria-hidden="true">→</i></button>`;
    return `<article class="plan-card${best ? " is-best" : ""}${current ? " is-current" : ""}">
      ${current ? `<span class="plan-flag is-current">${mine.status === "trialing" ? "Your trial" : "Your plan"}</span>` : best ? `<span class="plan-flag">Most complete</span>` : ""}
      <h3>${esc(p.name)}</h3>
      <p class="plan-blurb">${esc(BLURB[p.key] || "")}</p>
      <p class="plan-price">${yearly
        ? `<b data-price="${p.price_year}">${eur(p.price_year)}</b><span>/ year</span>`
        : `<b data-price="${p.price_month}">${eur(p.price_month)}</b><span>/ month</span>`}</p>
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
  // ---------- Motion: cards rise in one by one, features appear line by line, prices count up (once, on screen);
  // switching monthly / yearly flips the prices; a light follows the cursor on each card ----------
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const countUp = (el, delay) => {
    const to = Number(el.dataset.price);
    if (!to || reduced) return;
    const start = performance.now() + delay, dur = 1100;
    el.textContent = eur(0);
    const tick = (now) => {
      const t = Math.min(1, Math.max(0, (now - start) / dur));
      const v = to * (1 - Math.pow(1 - t, 3));
      el.textContent = t >= 1 ? eur(to) : `€${v.toFixed(2)}`;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  function decorate(box, swap) {
    [...box.querySelectorAll(".plan-card")].forEach((card, i) => {
      card.style.setProperty("--ci", i);
      card.querySelectorAll(".plan-features li").forEach((li, k) => li.style.setProperty("--li", k));
    });
    if (box.dataset.fx === "in") { box.dataset.fx = "done"; return; } // redrawn while entering (e.g. current plan loaded)
    if (box.dataset.fx === "done") {
      if (swap) box.querySelectorAll(".plan-price").forEach((p) => p.classList.add("is-swapping"));
      return;
    }
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
    const draw = (swap = false) => boxes.forEach((b) => {
      b.innerHTML = plans.map(planCard).join("");
      decorate(b, swap);
      let t = b.previousElementSibling?.matches?.(".plan-interval") ? b.previousElementSibling : null;
      if (plans.some(hasYear)) { if (t) t.outerHTML = toggleHtml(plans); else b.insertAdjacentHTML("beforebegin", toggleHtml(plans)); }
    });
    draw();
    if (packBox) packBox.innerHTML = packs.map(packCard).join("");
    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-interval-pick]");
      if (!b) return;
      if (interval === b.dataset.intervalPick) return;
      interval = b.dataset.intervalPick;
      try { localStorage.setItem("scp-interval", interval); } catch {}
      draw(true);
    });
    // Signed in: mark the current plan
    const client = window.SCP_AUTH?.client;
    if (client && (await client.auth.getSession()).data.session) {
      const { data } = await client.rpc("my_entitlements");
      if (data?.plan) { mine = data; draw(); }
    }
  })();
})();
