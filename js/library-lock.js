// Content Library without a plan (signed up, never paid or the trial is over; also "View as → No plan"): the posts stay
// blurred behind a card centred on the screen — real posts and the message on the left, the plans on the right, each
// starting its 7-day free trial in one click (js/checkout.js handles [data-checkout-plan]). Staff and members with the
// library see nothing of this. The server-side gate is supabase/library-gate.sql.
(async () => {
  const feed = document.querySelector("[data-library] .feed");
  const db = window.SCP_AUTH?.client;
  if (!feed || !db || !window.SCP_entitlements) return;
  const { data: ent } = await window.SCP_entitlements().catch(() => ({}));
  if (!ent || ent.is_staff || ent.has_library) return;
  const tx = (t, v) => (window.tx ? window.tx(t, v) : t);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const money = (n) => new Intl.NumberFormat(window.SCP_LOC || "en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2 }).format(Number(n));
  document.body.classList.add("lib-locked");
  feed.insertAdjacentHTML("afterbegin", `<div class="lib-lock" role="dialog" aria-label="${esc(tx("The library is for members"))}">
    <div class="lib-lock-vis"><span class="lib-lock-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></span>
      <h2>${tx("Unlock the whole library")}</h2>
      <p>${tx("What the best clubs post, why it works and how to make your version.")}</p></div>
    <div class="lib-lock-plans" data-lock-plans><p class="lib-lock-note">${tx("Loading plans…")}</p></div>
  </div>`);
  let data = null;
  try { ({ data } = await db.rpc("public_membership_plans")); } catch {}   // (the query builder has no .catch)
  const plans = (data?.plans || []).filter((p) => (p.entitlements || []).includes("library.access"))
    .sort((a, b) => (a.prices?.find((x) => x.interval === "month")?.amount || 0) - (b.prices?.find((x) => x.interval === "month")?.amount || 0));
  const box = feed.querySelector("[data-lock-plans]");
  box.innerHTML = plans.map((p) => {
    const m = p.prices?.find((x) => x.currency === "eur" && x.interval === "month");
    const best = p.highlighted || (p.entitlements || []).includes("ai.analyze_posts");
    const label = tx(p.trial_days > 0 ? "Try it free" : "Get {plan}", { plan: p.name });
    const btn = m?.ready ? `<button class="btn ${best ? "btn-gold" : "btn-outline"}" type="button" data-checkout-plan="${esc(p.key)}" data-interval="month" data-currency="eur">${label}</button>`
      : `<a class="btn ${best ? "btn-gold" : "btn-outline"}" href="signup.html?plan=${encodeURIComponent(p.key)}&interval=month">${label}</a>`;
    return `<div class="lib-lock-plan${best ? " is-best" : ""}"><span><b>${esc(p.name)}</b><small>${m ? `${money(m.amount)}/${tx("month")}` : ""}${best ? ` · ${tx("Recommended")}` : ""}</small></span>${btn}</div>`;
  }).join("") + `<p class="lib-lock-note">${tx("7 days free · Cancel anytime · VAT included")}</p>
    <a class="lib-lock-club" href="book-a-call.html?for=clubs">${tx("Are you a club? My Club, the tailored plan →")}</a>`;
})();
