// Plans & AI packs (pricing page and home). Everything comes from Supabase (Super Admin → Memberships):
// public_membership_plans() → plans on sale, their monthly / yearly prices in euros, features and permissions.
// A hidden membership opens with pricing.html#private=<token> (checked on the server, private_membership()).
// Monthly / yearly and number-of-users switches, comparison table, the member's current plan, and Stripe Checkout with a
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
  const fmt = (n, cur) => { const v = Number(n); return new Intl.NumberFormat(window.SCP_LOC || "en-GB", { style: "currency", currency: String(cur || "eur").toUpperCase(), minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 }).format(v); };
  const per = (iv) => tx(iv === "year" ? "year" : "month");
  const tick = (t, on = true) => `<li class="${on ? "" : "is-off"}"><img src="assets/tick.svg" alt=""><span>${t}</span></li>`;
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

  let data = null;          // { plans, entitlements, currencies, legal }
  let interval = "month", currency = "eur";
  const MAX_SEATS = 5;      // more users → custom plan (contact form)
  let seats = Math.min(MAX_SEATS, Math.max(1, Number(store.get("scp-seats")) || 1));
  let mine = null;          // my_membership() for signed-in members
  let privateToken = null, privatePlan = null;

  const priceOf = (p, cur = currency, iv = interval) => p.prices.find((x) => x.currency === cur && x.interval === iv);
  const hasYear = (p) => !!priceOf(p, currency, "year");
  // yearly = how many months free (12 × monthly − yearly) and how much that is
  const monthsFree = (p) => { const m = priceOf(p, currency, "month"), y = priceOf(p, currency, "year"); return m && y ? Math.round((m.amount * 12 - y.amount) / m.amount) : 0; };
  const yearSave = (p) => { const m = priceOf(p, currency, "month"), y = priceOf(p, currency, "year"); return m && y ? m.amount * 12 - y.amount : 0; };
  const saving = (p) => { const m = priceOf(p, currency, "month"), y = priceOf(p, currency, "year"); return m && y ? Math.round((1 - y.amount / (m.amount * 12)) * 100) : 0; };
  const currentSub = () => mine?.subscription && ["active", "trialing", "past_due", "unpaid"].includes(mine.subscription.status) && mine.subscription.source === "stripe" ? mine.subscription : null;

  // builder: the "Library + add-ons" card (addons html, the plan it stands for); value: a line on the plan that has everything
  function planCard(p, { solo = false, builder = null } = {}) {
    const price = priceOf(p) || priceOf(p, currency, "month");
    const iv = price?.interval || interval;
    const cur = currentSub();
    const isCurrent = cur?.plan === p.key;
    const trial = p.trial_days > 0 && (!mine || mine.trial_eligible) ? p.trial_days : 0;
    const has = (k) => (p.entitlements || []).includes(k);
    const hasAi = has("ai.analyze_posts"), lib = has("library.access"), cp = has("planner.access");
    // the plan with the most AI analyses says how many times more it has than the next one
    const otherAi = Math.max(0, ...(data?.plans || []).filter((x) => x.key !== p.key && (x.entitlements || []).includes("ai.analyze_posts")).map((x) => x.ai_monthly_units || 0));
    const times = hasAi && !p.ai_unlimited && otherAi > 0 && p.ai_monthly_units > otherAi ? Math.floor(p.ai_monthly_units / otherAi) : 0;
    let cta;
    if (isCurrent) cta = `<a class="btn btn-outline plan-cta" href="profile.html#billing">${tx("Manage your plan")}</a>`;
    else if (!price) cta = `<span class="btn btn-outline plan-cta is-current">${tx("Not available in {cur}", { cur: currency.toUpperCase() })}</span>`;
    else if (!price.ready) cta = `<a class="btn btn-outline plan-cta" href="contact.html">${tx("Coming soon — contact us")}</a>`;
    else if (cur) cta = `<a class="btn btn-outline plan-cta" href="profile.html?change=${encodeURIComponent(p.key)}&interval=${iv}#billing">${tx("Switch to {plan}", { plan: esc(p.name) })}</a>`;
    else cta = `<button class="btn ${p.highlighted || solo ? "btn-gold" : "btn-outline"} plan-cta" type="button" data-checkout-plan="${esc(p.key)}" data-interval="${iv}" data-currency="${currency}" data-seats="${seats}"${privateToken && p.key === privatePlan?.key ? ` data-link="${esc(privateToken)}"` : ""}><span>${trial ? tx("Start {n}-day free trial", { n: trial }) : tx("Get {plan}", { plan: esc(p.name) })}</span><i class="plan-cta-arrow" aria-hidden="true">→</i></button>`;
    const flag = isCurrent ? `<span class="plan-flag is-current">${tx(cur.status === "trialing" ? "Your trial" : "Your plan")}</span>`
      : p.highlighted ? `<span class="plan-flag">${tx("Recommended")}${times > 1 ? ` · ${tx("{n}× more AI", { n: times })}` : ""}</span>` : "";
    // the trial / billing note only where it isn't said below the cards: your current plan, or a private plan on its own
    const note = isCurrent
      ? (cur.status === "trialing" && cur.trial_end ? tx("Free trial until {date}", { date: new Date(cur.trial_end).toLocaleDateString(window.SCP_LOC || "en-GB", { day: "numeric", month: "short" }) }) : cur.cancel_at_period_end ? tx("Ends on {date}", { date: new Date(cur.current_period_end).toLocaleDateString(window.SCP_LOC || "en-GB", { day: "numeric", month: "short" }) }) : "")
      : solo && trial && price?.ready ? tx(iv === "month" ? "Card required · {zero} today · then {price}/{per} · billed on the 1st" : "Card required · {zero} today · then {price}/{per}", { zero: fmt(0, currency), price: fmt(price.amount * seats, currency), per: per(iv) })
      : "";
    // only what differs between plans: who it's for, the price, the button and the three tools (✓ or –)
    const who = hasAi && cp ? "Everything, for teams" : hasAi ? "To know what works" : cp ? "To plan your week" : "To find ideas fast";
    // with more than one user the big number is the total; the price per user goes underneath
    // the line under the price always fits on one line: users or the yearly saving, then VAT
    // (with more users, "VAT incl." moves next to the price so the saving for all of them fits)
    // yearly: the big number is what it costs per month; the line below says what's billed once a year and the saving
    const save = iv === "year" && monthsFree(p) > 0 ? `<b class="plan-free">${tx("save {amount}", { amount: fmt(yearSave(p) * seats, currency) })}</b>` : "";
    const big = !price ? 0 : (iv === "year" ? price.amount / 12 : price.amount) * seats;
    const sub = !price ? "" : [
      seats > 1 ? tx("{n} users × {price}", { n: seats, price: fmt(iv === "year" ? price.amount / 12 : price.amount, currency) }) : tx("up to {n} users on one plan", { n: MAX_SEATS }),
      iv === "year" ? tx("billed {amount} a year", { amount: fmt(price.amount * seats, currency) }) : "", save, tx("VAT incl."),
    ].filter(Boolean).join(" · ");
    // what you get, in words (not just ✓ / –)
    const units = p.ai_unlimited ? tx("Unlimited") : p.ai_monthly_units;
    const gets = [
      lib && tx("The whole library: every sport, club and competition"),
      lib && tx("Filters by sport, competition, format and goal"),
      has("library.save_posts") && tx("Saved boards to keep your ideas"),
      cp && tx("Content Plan: weekly and monthly calendar"),
      hasAi && tx("{n} AI analyses a month: hook, why it works, how to adapt it", { n: units }),
    ].filter(Boolean);
    // the plan with everything: how much more AI than the next one
    const extraAi = hasAi && cp && !p.ai_unlimited && otherAi > 0 && p.ai_monthly_units > otherAi ? p.ai_monthly_units - otherAi : 0;
    const value = !builder && hasAi && cp ? `<p class="plan-value">${tx("All included")}${extraAi ? ` · <b>${tx("+{n} AI analyses a month", { n: extraAi })}</b>` : ""}</p>` : "";
    const tool = (on, cls, label, extra = "") => `<li class="pt ${cls}${on ? "" : " is-off"}"><i></i><span>${label}</span>${extra ? `<em>${extra}</em>` : ""}</li>`;
    return `<article class="plan-card v2${p.highlighted ? " is-best" : ""}${isCurrent ? " is-current" : ""}${p.key === wanted ? " is-wanted" : ""}" data-plan-key="${esc(p.key)}">
      ${flag}
      <h3>${builder ? tx("Library") : esc(p.name)}</h3>
      <p class="plan-blurb">${tx(builder ? "Start with the library, add what you need" : who)}</p>
      <p class="plan-price">${price ? `<b data-price="${Math.round(big * 100) / 100}" data-cur="${currency}">${fmt(Math.round(big * 100) / 100, currency)}</b><span>${seats > 1 ? `/ ${per("month")}` : tx("/ {per} per user", { per: per("month") })}</span>` : `<b>—</b>`}</p>
      <p class="plan-sub">${sub || "&nbsp;"}</p>
      ${value}
      ${builder ? builder.addons : ""}
      ${cta}
      ${note ? `<p class="plan-note">${note}</p>` : ""}
      <ul class="plan-gets">${gets.map((g) => `<li>${g}</li>`).join("")}</ul>
    </article>`;
  }

  // Comparison table: a few rows that say what you get (from each plan's permissions and AI quota)
  function compareHtml(plans) {
    if (!plans.length) return "";
    const yes = `<span class="cmp-yes" aria-label="${esc(tx("Included"))}">✓</span>`, no = `<span class="cmp-no" aria-label="${esc(tx("Not included"))}">–</span>`;
    const has = (p, k) => p.entitlements.includes(k);
    const row = (label, sub, cell) => `<tr><th scope="row">${tx(label)}${sub ? `<small>${tx(sub)}</small>` : ""}</th>${plans.map((p) => `<td>${cell(p)}</td>`).join("")}</tr>`;
    const rows = [
      row("Content Library", "Every post, filter and category, updated daily", (p) => (has(p, "library.access") ? yes : no)),
      row("Save posts to boards", "", (p) => (has(p, "library.save_posts") ? yes : no)),
      row("Content Plan", "Weekly and monthly calendars, drag and drop, PDF / Excel / calendar export", (p) => (has(p, "planner.access") ? yes : no)),
      row("AI analyses per month", "Hook, why it works, format and how to adapt it", (p) => (!has(p, "ai.analyze_posts") ? no : p.ai_unlimited ? tx("Unlimited") : `<b>${p.ai_monthly_units || "–"}</b>`)),
    ].join("");
    const price = `<tr class="cmp-price"><th scope="row">${tx("Price")}</th>${plans.map((p) => { const x = priceOf(p); return `<td>${x ? `${fmt(x.amount * seats, currency)}<small>/ ${per(x.interval)}</small>` : "–"}</td>`; }).join("")}</tr>`;
    const trialDays = Math.min(...plans.map((p) => p.trial_days || 0));
    const note = trialDays > 0 ? `<p class="cmp-note">${tx("{n}-day free trial on every plan · card required · cancel anytime", { n: trialDays })}</p>` : "";
    return `<div class="cmp-wrap"><table class="cmp"><thead><tr><th></th>${plans.map((p) => `<th scope="col"${p.highlighted ? ' class="is-best"' : ""}>${esc(p.name)}</th>`).join("")}</tr></thead><tbody>${price}${rows}</tbody></table></div>${note}`;
  }

  function switches(plans) {
    const curs = (data.currencies || ["eur"]).filter((c) => plans.some((p) => p.prices.some((x) => x.currency === c)));
    const best = Math.max(0, ...plans.map(saving));
    const anyYear = plans.some((p) => p.prices.some((x) => x.interval === "year" && x.currency === currency));
    return `<div class="plan-switches">
      ${anyYear ? `<div class="plan-interval" role="tablist" aria-label="Billing period">
        <button type="button" role="tab" aria-selected="${interval === "month"}" data-interval-pick="month">Monthly</button>
        <button type="button" role="tab" aria-selected="${interval === "year"}" data-interval-pick="year">Yearly${plans.some((p) => monthsFree(p) > 0) ? `<em>${tx("{n} months free", { n: Math.max(...plans.map(monthsFree)) })}</em>` : ""}</button>
      </div>` : ""}
      ${privatePlan ? "" : `<div class="plan-seats" role="group" aria-label="${esc(tx("Users"))}">
        <span>${tx("Users")}</span>
        <button type="button" data-seats-step="-1" aria-label="${esc(tx("Fewer users"))}" ${seats <= 1 ? "disabled" : ""}>−</button>
        <b aria-live="polite">${seats}</b>
        <button type="button" data-seats-step="1" aria-label="${esc(tx("More users"))}">+</button>
      </div>`}
      ${curs.length > 1 ? `<div class="plan-interval plan-currency" role="tablist" aria-label="Currency">${curs.map((c) => `<button type="button" role="tab" aria-selected="${currency === c}" data-currency-pick="${c}">${c.toUpperCase()}</button>`).join("")}</div>` : ""}
      ${!privatePlan ? `<p class="plan-common">${tx("Every plan: the full library with filters and saved boards · up to {n} users", { n: MAX_SEATS })}</p>` : ""}
      <p class="plan-seats-more" ${seats >= MAX_SEATS && !privatePlan ? "" : "hidden"} data-seats-more>${tx("More than {n} users?", { n: MAX_SEATS })} <a class="link-gold" href="contact.html?topic=custom-plan&users=${MAX_SEATS + 1}">${tx("Request a custom plan")}</a></p>
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
      el.textContent = fmt(t >= 1 ? to : Math.round(to * (1 - Math.pow(1 - t, 3)) * 100) / 100, cur);
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

  // ---------- Library + add-ons: one card where the Content Plan and AI analyses are ticked on, and All Access next to it ----------
  // (only when the four usual plans exist; prices always come from them, nothing is calculated)
  const addon = { cp: false, ai: false };
  if (["library_planner", "all_access"].includes(new URLSearchParams(location.search).get("plan"))) addon.cp = true;
  if (["library_ai", "all_access"].includes(new URLSearchParams(location.search).get("plan"))) addon.ai = true;
  const byKey = (plans, k) => plans.find((p) => p.key === k);
  const builderPlans = (plans) => !privatePlan && ["library", "library_planner", "library_ai", "all_access"].every((k) => byKey(plans, k));
  function builderHtml(plans) {
    const lib = byKey(plans, "library"), all = byKey(plans, "all_access");
    const both = addon.cp && addon.ai;
    const pick = both ? all : addon.cp ? byKey(plans, "library_planner") : addon.ai ? byKey(plans, "library_ai") : lib;
    const amount = (p) => { const x = priceOf(p); return x ? (x.interval === "year" ? x.amount / 12 : x.amount) * seats : 0; };
    const plus = (k) => fmt(Math.round((amount(byKey(plans, k)) - amount(lib)) * 100) / 100, currency);
    const row = (key, on, plan, title, desc) => `<label class="plan-addon${on ? " is-on" : ""}"><input type="checkbox" data-addon="${key}"${on ? " checked" : ""}>
      <span class="plan-addon-tx"><b>${tx(title)}</b><small>${tx(desc)}</small></span><span class="plan-addon-price">+${plus(plan)}</span></label>`;
    const addons = `<div class="plan-addons"><p class="plan-addons-h">${tx("Add to your plan")}</p>
      ${row("cp", addon.cp, "library_planner", "Content Plan", "Plan your week and month")}
      ${row("ai", addon.ai, "library_ai", "AI analysis", "Know why a post works")}
      ${both ? `<p class="plan-addons-note">${tx("Both add-ons are All Access: it comes with {n} AI analyses a month.", { n: all.ai_monthly_units })}</p>` : ""}</div>`;
    return planCard(pick, { builder: { addons } }) + planCard(all);
  }

  function draw(swap = false) {
    const plans = privatePlan ? [privatePlan] : data.plans;
    boxes.forEach((b) => {
      b.classList.toggle("is-solo", plans.length === 1);
      b.innerHTML = plans.length ? (builderPlans(plans) ? builderHtml(plans) : plans.map((p) => planCard(p, { solo: plans.length === 1 })).join("")) : `<p class="plans-empty">Plans will be published here soon. <a class="link-gold" href="contact.html">Contact us</a> in the meantime.</p>`;
      decorate(b, swap);
      b.classList.toggle("is-v2", !privatePlan && plans.length > 1);
      b.classList.toggle("is-builder", !!builderPlans(plans));
      // not sure which plan? one line under the cards opens the demo form (FAQ) or the demo page
      if (!privatePlan && plans.length > 1 && !b.nextElementSibling?.matches?.(".plan-help")) {
        const inPage = document.querySelector('[data-faq-pane="demo"]');
        b.insertAdjacentHTML("afterend", `<p class="plan-help">${tx("Not sure which plan fits your team?")} <a class="link-gold" href="book-a-call.html" data-cta="pricing-cards"${inPage ? ' data-faq-open="demo"' : ""}>${tx("Talk to us for 30 minutes →")}</a></p>`);
      }
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
      const best = rows.reduce((m, k) => (!m || k.price / k.units < m.price / m.units ? k : m), null);
      packBox.innerHTML = rows.map((k, i) => `<article class="pack-card${rows.length > 1 && k === best ? " is-best" : ""}" style="--ci:${i}">
        ${rows.length > 1 && k === best ? `<span class="plan-flag">${tx("Best value")}</span>` : ""}
        <p class="pack-units"><b data-count-to="${k.units}">${k.units}</b> AI analyses</p>
        <p class="pack-price" data-price="${k.price}" data-cur="eur">${fmt(k.price, "eur")}</p>
        <p class="pack-each">${fmt(k.price / k.units, "eur")} per analysis · never expire</p>
        <button class="btn btn-outline" type="button" data-checkout-pack="${esc(k.key)}">Buy this pack</button>
      </article>`).join("");
      if (!rows.length) packBox.closest(".packs-wrap")?.setAttribute("hidden", "");
      else packFx();
    } catch { packBox.closest(".packs-wrap")?.setAttribute("hidden", ""); }
  }

  // Packs: same motion as the plan cards — rise in one by one when on screen, numbers count up, light follows the cursor
  function packFx() {
    if (reduced || !("IntersectionObserver" in window)) { packBox.dataset.fx = "done"; return; }
    packBox.dataset.fx = "wait";
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      packBox.dataset.fx = "in";
      packBox.querySelectorAll("[data-price]").forEach((el, i) => countUp(el, 250 + i * 120));
      packBox.querySelectorAll("[data-count-to]").forEach((el, i) => {
        const to = Number(el.dataset.countTo), start = performance.now() + 200 + i * 120;
        const step = (now) => { const t = Math.min(1, Math.max(0, (now - start) / 900)); el.textContent = Math.round(to * (1 - Math.pow(1 - t, 3))); if (t < 1) requestAnimationFrame(step); };
        el.textContent = "0"; requestAnimationFrame(step);
      });
      setTimeout(() => { packBox.dataset.fx = "done"; }, 2000);
    }, { threshold: 0.25 });
    obs.observe(packBox);
    packBox.addEventListener("pointermove", (e) => {
      const card = e.target.closest(".pack-card");
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  }

  // ?plan=library_ai (from a locked feature: "Get AI analyses"): that plan marked, and scrolled to once drawn
  const wanted = new URLSearchParams(location.search).get("plan");
  if (wanted) new MutationObserver((_, o) => { const c = document.querySelector(`.plan-card[data-plan-key="${CSS.escape(wanted)}"]`); if (c) { o.disconnect(); setTimeout(() => c.scrollIntoView({ behavior: "smooth", block: "center" }), 200); } }).observe(document.body, { childList: true, subtree: true });
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
    currency = "eur";   // prices are in euros only; banks convert for other card currencies
    interval = q.get("interval") === "year" || store.get("scp-interval") === "year" ? "year" : "month";
    if (!plans.some((p) => priceOf(p))) interval = interval === "year" ? "month" : "year";
    draw();
    packs();
    document.addEventListener("click", (e) => {
      const iv = e.target.closest("[data-interval-pick]");
      if (iv && iv.dataset.intervalPick !== interval) { interval = iv.dataset.intervalPick; store.set("scp-interval", interval); draw(true); }
      const st = e.target.closest("[data-seats-step]");
      if (st) {
        const next = seats + Number(st.dataset.seatsStep);
        if (next > MAX_SEATS) { document.querySelector("[data-seats-more]")?.removeAttribute("hidden"); document.querySelector("[data-seats-more] a")?.focus(); return; }
        if (next >= 1 && next !== seats) { seats = next; store.set("scp-seats", String(seats)); draw(true); }
      }
      const ad = e.target.closest("[data-addon]");
      if (ad) { addon[ad.dataset.addon] = ad.checked; draw(true); return; }
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
