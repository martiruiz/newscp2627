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
      body: JSON.stringify(body),
    }).catch(() => null);
    const data = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok || !data.url) throw new Error(data.error || (r?.status === 404 ? "Payments aren't switched on yet." : "We couldn't open the payment. Please try again."));
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
    busy(btn, true);
    try {
      const { url } = await call("stripe-checkout", req);
      store.clear();
      location.href = url;
    } catch (e) {
      store.clear();
      busy(btn, false);
      notify(e.message, { kind: "is-err" });
    }
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
    const wantPlan = q.get("plan");
    const t = notify(`<span class="co-spin"></span><span><b>Payment received.</b> Activating your ${wantPlan ? "plan" : "AI credits"}…</span>`, { sticky: true, html: true, kind: "is-ok" });
    let first = null;
    for (let i = 0; i < 15; i++) {
      const { data: ent } = await auth.client.rpc("my_entitlements");
      if (first === null) first = ent?.pack_balance ?? 0;
      const ready = wantPlan ? ent?.plan === wantPlan : (ent?.pack_balance ?? 0) > first || i >= 4;
      if (ready) {
        clean();
        const trialEnd = ent?.status === "trialing" && ent.current_period_end ? new Date(ent.current_period_end).toLocaleDateString("en-GB", { day: "numeric", month: "long" }) : "";
        t.innerHTML = wantPlan
          ? `<span>${"✓"}</span><span><b>Welcome to ${ent.plan_name}!</b> ${trialEnd ? `Your free trial runs until ${trialEnd}.` : "Your plan is active."}</span>`
          : `<span>${"✓"}</span><span><b>AI credits added.</b> Enjoy your analyses.</span>`;
        setTimeout(() => location.reload(), 1800);
        return;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    clean();
    t.innerHTML = `<span><b>Payment received.</b> It's taking a little longer to activate — refresh in a minute, or <a href="contact.html">contact us</a> if it doesn't show.</span>`;
  }

  const api = {
    plan: (plan, interval = "month", btn) => start({ kind: "plan", plan, interval }, btn),
    pack: (pack, btn) => start({ kind: "pack", pack }, btn),
    portal, notify,
  };
  // Buttons anywhere: data-checkout-plan="all_access" data-interval="year" · data-checkout-pack="pack_30" · data-billing-portal
  document.addEventListener("click", (e) => {
    const p = e.target.closest("[data-checkout-plan]");
    if (p) { e.preventDefault(); return api.plan(p.dataset.checkoutPlan, p.dataset.interval || "month", p); }
    const k = e.target.closest("[data-checkout-pack]");
    if (k) { e.preventDefault(); return api.pack(k.dataset.checkoutPack, k); }
    const b = e.target.closest("[data-billing-portal]");
    if (b) { e.preventDefault(); return api.portal(b); }
  });
  resume();
  afterReturn();
  return api;
})();
