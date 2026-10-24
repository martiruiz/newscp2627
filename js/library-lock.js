// Content Library without a plan (signed up, never paid or the trial is over; also "View as → No plan"): the posts stay
// blurred behind a padlock and an invitation to start the free trial — the plans open right there (js/checkout.js
// plansPicker). Staff and members with the library see nothing of this. The server-side gate is supabase/library-gate.sql.
(async () => {
  const feed = document.querySelector("[data-library] .feed");
  if (!feed || !window.SCP_entitlements) return;
  const { data: ent } = await window.SCP_entitlements().catch(() => ({}));
  if (!ent || ent.is_staff || ent.has_library) return;
  const tx = (t) => (window.tx ? window.tx(t) : t);
  document.body.classList.add("lib-locked");
  feed.insertAdjacentHTML("afterbegin", `<div class="lib-lock" role="dialog" aria-label="${tx("The library is for members")}">
    <span class="lib-lock-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></span>
    <p class="lib-lock-eb">${tx("Sports Content Playbook")}</p>
    <h2>${tx("Unlock the whole library")}</h2>
    <p class="lib-lock-sub">${tx("Real posts from clubs, leagues and brands, filtered by sport, format and competition, with AI that explains why they work. Try it free for 7 days.")}</p>
    <button class="btn btn-gold lib-lock-cta" type="button" data-plans-picker="library.access" aria-expanded="false">${tx("Start my free trial")}</button>
    <div class="pp-plans" data-plans-picker-list hidden></div>
    <p class="lib-lock-note">${tx("Cancel anytime · VAT included")}</p>
  </div>`);
  feed.querySelector("[data-plans-picker]").click();   // the plans already open: one click to start
})();
