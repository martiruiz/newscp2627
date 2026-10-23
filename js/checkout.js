// Stripe payments on the website (Edge Functions "stripe-checkout" and "stripe-portal").
// SCP_CHECKOUT.plan(key, interval, btn) / .pack(key, btn) → Stripe Checkout; .portal(btn) → manage billing.
// Not signed in yet: the choice is remembered, the member signs up / logs in and the payment continues by itself.
// Back from Stripe (?checkout=success): waits for the webhook to activate the plan, then reloads the page.
window.SCP_CHECKOUT = (() => {
  const cfg = window.SCP_CONFIG || {};
  const auth = window.SCP_AUTH;
  const KEY = "scp-checkout";
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} },
    clear() { try { localStorage.removeItem(KEY); } catch {} },
  };
  const session = async () => (auth?.client ? (await auth.client.auth.getSession()).data.session : null);

  // Small notice at the bottom of the screen
  let toastTimer;
  function notify(text, { kind = "", sticky = false, html = false } = {}) {
    document.querySelector(".co-toast")?.remove();
    const t = document.createElement("div");
    t.className = `co-toast ${kind}`;
    t.setAttribute("role", "status");
    t[html ? "innerHTML" : "textContent"] = text;
    document.body.append(t);
    clearTimeout(toastTimer);
    if (!sticky) toastTimer = setTimeout(() => t.remove(), 6000);
    return t;
  }
  function busy(btn, on) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.classList.add("is-busy"); btn.innerHTML = `<span class="co-spin"></span>Opening secure payment…`; }
    else { btn.disabled = false; btn.classList.remove("is-busy"); if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
  }
  async function call(fn, body) {
    const s = await session();
    const r = await fetch(`${cfg.supabaseUrl}/functions/v1/${fn}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${s?.access_token}` },
      body: JSON.stringify({ ...body, lang: window.SCP_LANG || "en" }),
    }).catch(() => null);
    const data = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok || (!data.url && !body.preview)) {
      const err = new Error(data.error || (r?.status === 404 ? "Payments aren't switched on yet." : "We couldn't open the payment. Please try again."));
      err.manage = !!data.manage;
      throw err;
    }
    return data;
  }

  async function start(req, btn) {
    if (!(await session())) {
      store.set({ req, at: Date.now() });
      location.href = req.kind === "plan"
        ? `signup.html?plan=${encodeURIComponent(req.plan)}&interval=${encodeURIComponent(req.interval)}`
        : `login.html?next=pricing.html`;
      return;
    }
    if (req.kind === "plan" && !req.confirmed) return confirmTerms(req, btn);
    busy(btn, true);
    try {
      const { url } = await call("stripe-checkout", req);
      store.clear();
      location.href = url;
    } catch (e) {
      store.clear();
      busy(btn, false);
      if (e.manage) { location.href = "profile.html#billing"; return; }
      notify(e.message, { kind: "is-err" });
    }
  }

  // ---------- Before paying: the exact terms (from the server / Stripe), discount code, renewal and cancellation ----------
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const money = (n, cur) => new Intl.NumberFormat(window.SCP_LOC || "en-GB", { style: "currency", currency: String(cur || "eur").toUpperCase() }).format(Number(n));
  const dayOf = (iso) => new Date(iso).toLocaleDateString(window.SCP_LOC || "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" });
  function termsHtml(t) {
    const per = tx(t.interval === "year" ? "year" : "month");
    const price = money(t.price, t.currency);
    const rows = [];
    if (t.trial_days) {
      rows.push(["Today", `${money(0, t.currency)} — ${tx("{n}-day free trial", { n: t.trial_days })}`]);
      rows.push(["Trial ends", dayOf(t.trial_end)]);
      rows.push(["First charge", t.interval === "month" && t.prorated_until
        ? `${dayOf(t.first_charge_at)} · ${tx("the days until {date} (prorated; exact amount e-mailed 3 days before)", { date: dayOf(t.prorated_until) })}`
        : `${dayOf(t.first_charge_at)} · ${price}`]);
    } else {
      rows.push(["Today", t.first_charge ? `${money(t.first_charge.amount, t.first_charge.currency)}${t.prorated_until ? ` · ${tx("until {date} (prorated)", { date: dayOf(t.prorated_until) })}` : ""}` : price]);
    }
    if (t.seats > 1) rows.push(["Users", tx("{n} users × {price}", { n: t.seats, price: money(t.unit_price, t.currency) })]);
    rows.push(["Then", `${price} / ${per}, ${tx(t.interval === "month" ? "on the 1st of every month" : "renews every year")} · ${tx(t.tax_included === false ? "plus tax where applicable" : "VAT included")}`]);
    if (t.discount) rows.push(["Discount", `${esc(t.discount.code)}: ${tx("{amount} off", { amount: t.discount.kind === "percent" ? `${Number(t.discount.percent_off)}%` : money(t.discount.amount_off, t.currency) })} ${t.discount.duration === "repeating" ? tx("for {n} months", { n: t.discount.duration_months }) : tx(t.discount.duration === "once" ? "on the first charge" : "for as long as you stay")}`]);
    return `<dl class="co-terms">${rows.map(([k, v]) => `<div><dt>${tx(k)}</dt><dd>${v}</dd></div>`).join("")}</dl>`;
  }
  async function confirmTerms(req, btn) {
    busy(btn, true);
    let terms;
    try {
      const r = await call("stripe-checkout", { ...req, preview: true });
      // an older stripe-checkout (before memberships) ignores "preview" and returns the payment page directly
      if (!r.terms) { if (r.url) { store.clear(); location.href = r.url; } else busy(btn, false); return; }
      terms = r.terms;
    }
    // already subscribed (manage) or any error: forget the pending request, or every visit to the pricing page would repeat it
    catch (e) { store.clear(); busy(btn, false); if (e.manage) { location.href = "profile.html#billing"; return; } notify(e.message, { kind: "is-err" }); return; }
    busy(btn, false);
    document.querySelector(".co-modal")?.remove();
    const m = document.createElement("div");
    m.className = "co-modal";
    m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true"); m.setAttribute("aria-labelledby", "co-title");
    const draw = () => {
      m.innerHTML = `<div class="co-card">
        <button class="co-x" type="button" aria-label="Close" data-co-close>×</button>
        <p class="co-eyebrow">${terms.trial_days ? tx("{n}-day free trial", { n: terms.trial_days }) : tx("Secure payment with Stripe")}</p>
        <h2 id="co-title">${esc(terms.plan)} <span>${tx(terms.interval === "year" ? "yearly" : "monthly")} · ${terms.currency.toUpperCase()}</span></h2>
        ${termsHtml(terms)}
        <form class="co-code" data-co-code><input name="code" placeholder="Discount code" autocomplete="off" value="${esc(req.code || "")}" aria-label="Discount code"><button class="btn btn-outline" type="submit">Apply</button></form>
        <p class="co-small">${tx(terms.trial_days ? "Renews automatically until you cancel. Cancel any time in Account → Billing — you keep access until the end of the period you've paid, and nothing is charged if you cancel during the trial. Your card is handled by Stripe; SCP never sees it." : "Renews automatically until you cancel. Cancel any time in Account → Billing — you keep access until the end of the period you've paid. Your card is handled by Stripe; SCP never sees it.")}</p>
        <div class="co-actions"><button class="btn btn-outline" type="button" data-co-close>Not now</button><button class="btn btn-gold" type="button" data-co-go>${tx(terms.trial_days ? "Start free trial" : "Continue to payment")}</button></div>
      </div>`;
    };
    draw();
    document.body.append(m);
    document.body.style.overflow = "hidden";
    const close = () => { m.remove(); document.body.style.overflow = ""; };
    m.addEventListener("click", async (e) => {
      if (e.target === m || e.target.closest("[data-co-close]")) return close();
      const go = e.target.closest("[data-co-go]");
      if (go) { close(); start({ ...req, confirmed: true }, btn); }
    });
    const apply = async (code, quiet) => {
      const b = m.querySelector("[data-co-code] button"); if (b) b.disabled = true;
      try { terms = (await call("stripe-checkout", { ...req, code, preview: true })).terms; req = { ...req, code }; draw(); }
      catch (err) { if (b) b.disabled = false; if (!quiet) notify(err.message, { kind: "is-err" }); }
    };
    m.addEventListener("submit", (e) => { e.preventDefault(); apply(new FormData(e.target).get("code")?.toString().trim()); });
    m.querySelector("[data-co-go]")?.focus();
    // the code from the offer bar (js/promo-bar.js, kept 30 days): applied by itself; if it doesn't fit this plan, nothing happens
    if (!req.code) { try { const p = JSON.parse(localStorage.getItem("scp-promo") || "null"); if (p?.code && Date.now() - p.at < 30 * 864e5) apply(p.code, true); } catch {} }
  }
  async function portal(btn) {
    busy(btn, true);
    try { location.href = (await call("stripe-portal", {})).url; }
    catch (e) { busy(btn, false); notify(e.message, { kind: "is-err" }); }
  }

  // After signing up / logging in: continue the payment that was chosen before
  async function resume() {
    const p = store.get();
    if (!p) return;
    if (Date.now() - p.at > 864e5) return store.clear();
    if (!(await session())) return;
    notify("Taking you to the secure payment…", { sticky: true });
    start(p.req);
  }

  // Back from Stripe
  async function afterReturn() {
    const q = new URLSearchParams(location.search);
    const result = q.get("checkout");
    if (!result) return;
    const clean = () => { ["checkout", "plan", "pack"].forEach((k) => q.delete(k)); history.replaceState(null, "", location.pathname + (q.toString() ? `?${q}` : "") + location.hash); };
    if (result === "cancel") { clean(); notify("Payment cancelled — you haven't been charged."); return; }
    if (result !== "success" || !auth?.client) return clean();
    const wantPlan = q.get("plan") || (location.pathname.endsWith("profile.html") ? "*" : null);
    const t = notify(`<span class="co-spin"></span><span>${tx(wantPlan ? "<b>Payment received.</b> Activating your plan…" : "<b>Payment received.</b> Adding your AI analyses…")}</span>`, { sticky: true, html: true, kind: "is-ok" });
    let first = null;
    for (let i = 0; i < 15; i++) {
      const { data: ent } = await auth.client.rpc("my_entitlements");
      if (first === null) first = ent?.pack_balance ?? 0;
      const ready = wantPlan ? (wantPlan === "*" ? !!ent?.plan : ent?.plan === wantPlan) : (ent?.pack_balance ?? 0) > first || i >= 4;
      if (ready) {
        clean();
        const trialEnd = ent?.status === "trialing" && ent.current_period_end ? new Date(ent.current_period_end).toLocaleDateString(window.SCP_LOC || "en-GB", { day: "numeric", month: "long" }) : "";
        t.innerHTML = wantPlan
          ? `<span>${"✓"}</span><span>${tx("<b>Welcome to {plan}!</b>", { plan: ent.plan_name })} ${trialEnd ? tx("Your free trial runs until {date}.", { date: trialEnd }) : tx("Your plan is active.")}</span>`
          : `<span>${"✓"}</span><span>${tx("<b>AI analyses added.</b> Enjoy them.")}</span>`;
        if (wantPlan) window.SCP_TRACK?.("subscription_created", { step: ent?.status === "trialing" ? "trial" : "paid" });   // js/lead-flow.js
        setTimeout(() => location.reload(), 1800);
        return;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    clean();
    t.innerHTML = `<span>${tx("<b>Payment received.</b> It's taking a little longer to activate — refresh in a minute, or <a href=\"contact.html\">contact us</a> if it doesn't show.")}</span>`;
  }

  // "Get the Content Plan" / "Get AI analyses" (a locked feature): the plans that include it, in short, right under the button, to
  // buy in one click. Markup: <button data-plans-picker="ai.analyze_posts"> (the entitlement; Content Plan when empty) followed by
  // <div data-plans-picker-list hidden>. Plans from public_membership_plans().
  let plansP = null;
  async function plansPicker(btn) {
    const box = btn.parentElement.querySelector("[data-plans-picker-list]");
    if (!box) return;
    const open = box.hidden;
    box.hidden = !open; btn.setAttribute("aria-expanded", String(open));
    if (!open || box.dataset.done) return;
    box.innerHTML = `<p class="pp-plans-msg">${tx("Loading plans…")}</p>`;
    plansP ||= auth.client.rpc("public_membership_plans").then(({ data }) => data?.plans || []).catch(() => []);
    const list = (await plansP).filter((p) => (p.entitlements || []).includes(btn.dataset.plansPicker || "planner.access"));
    box.dataset.done = list.length ? "1" : "";
    const label = (p) => (p.trial_days > 0 ? tx("Start {n}-day free trial", { n: p.trial_days }) : tx("Get {plan}", { plan: esc(p.name) }));
    box.innerHTML = list.map((p) => {
      const m = p.prices?.find((x) => x.currency === "eur" && x.interval === "month");
      const cta = m?.ready ? `<button class="btn btn-gold" type="button" data-checkout-plan="${esc(p.key)}" data-interval="month" data-currency="eur">${label(p)}</button>`
        : `<a class="btn btn-gold" href="signup.html?plan=${encodeURIComponent(p.key)}&interval=month">${label(p)}</a>`;
      return `<div class="pp-pick"><div class="pp-pick-top"><b>${esc(p.name)}</b>${m ? `<span><strong>${money(m.amount, "eur").replace(/[.,]00(?=\D|$)/, "")}</strong> / ${tx("month")}</span>` : ""}</div>
        <p>${tx("Library, AI analyses and Content Plan")}</p>${cta}</div>`;
    }).join("") + `<div class="pp-pick is-club"><div class="pp-pick-top"><b>${tx("My Club")}</b><span>${tx("Custom plan")}</span></div>
        <p>${tx("Your club's own library: first team, sections and academy")}</p><a class="btn btn-outline" href="book-a-call.html?for=clubs">${tx("Book a demo")}</a></div>
      <a class="pp-plans-all" href="pricing.html">${tx("Compare all plans")} →</a>`;
  }

  const api = {
    plan: (plan, interval = "month", btn, extra = {}) => start({ kind: "plan", plan, interval, ...extra }, btn),
    pack: (pack, btn) => start({ kind: "pack", pack }, btn),
    portal, notify,
  };
  // Buttons anywhere: data-checkout-plan="all_access" data-interval="year" · data-checkout-pack="pack_30" · data-billing-portal
  document.addEventListener("click", (e) => {
    const p = e.target.closest("[data-checkout-plan]");
    if (p) { e.preventDefault(); return api.plan(p.dataset.checkoutPlan, p.dataset.interval || "month", p, { currency: p.dataset.currency || "eur", ...(Number(p.dataset.seats) > 1 ? { seats: Number(p.dataset.seats) } : {}), ...(p.dataset.link ? { link: p.dataset.link } : {}) }); }
    const k = e.target.closest("[data-checkout-pack]");
    if (k) { e.preventDefault(); return api.pack(k.dataset.checkoutPack, k); }
    const pk = e.target.closest("[data-plans-picker]");
    if (pk) { e.preventDefault(); return plansPicker(pk); }
    const b = e.target.closest("[data-billing-portal]");
    if (b) { e.preventDefault(); return api.portal(b); }
  });
  resume();
  afterReturn();
  return api;
})();
