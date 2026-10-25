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
    // "arrow in a circle" buttons, like "Try it free" in the menu: white + gold circle for the recommended plan
    const inner = `<span>${label}</span><i aria-hidden="true">→</i>`, cls = `lock-go${best ? " is-best" : ""}`;
    const btn = m?.ready ? `<button class="${cls}" type="button" data-checkout-plan="${esc(p.key)}" data-interval="month" data-currency="eur">${inner}</button>`
      : `<a class="${cls}" href="signup.html?plan=${encodeURIComponent(p.key)}&interval=month">${inner}</a>`;
    return `<div class="lib-lock-plan${best ? " is-best" : ""}"><span><b>${esc(p.name)}</b><small>${m ? `${money(m.amount)}/${tx("month")}` : ""}${best ? ` · ${tx("Recommended")}` : ""}</small></span>${btn}</div>`;
  }).join("") + `<ul class="lib-lock-perks">${["7 days free", "Cancel anytime", "VAT included"].map((t) => `<li>${tx(t)}</li>`).join("")}</ul>
    <a class="lib-lock-club" href="book-a-call.html?for=clubs"><span class="lib-lock-club-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg></span>
      <span><b>${tx("Are you a club?")}</b><small>${tx("My Club: your own library, tailored to your club")}</small></span><i aria-hidden="true">→</i></a>`;
})();
