// Saved boards without a plan (also "View as → No plan"): the page shows an example of what saved boards look like
// (three sample boards with real covers, marked "Example") under a card that invites to start the free trial, with the
// plans already open (js/checkout.js plansPicker). Staff and members with a plan see their own boards as usual.
(async () => {
  const main = document.querySelector("[data-saved]");
  if (!main || !window.SCP_entitlements) return;
  const { data: ent } = await window.SCP_entitlements().catch(() => ({}));
  if (!ent || ent.is_staff || ent.has_library) return;
  const tx = (t, v) => (window.tx ? window.tx(t, v) : t);
  let covers = ["assets/lib-example-ucl.jpg", "assets/lib-example-messi.jpg", "assets/lib-example-nba.jpg"];
  try { const top = await (await fetch("content/top.json", { cache: "no-cache" })).json(); const c = (top || []).map((p) => p.cover_url).filter(Boolean); if (c.length >= 9) covers = c; } catch {}
  const pic = (i) => covers[i % covers.length].replace(/"/g, "%22");
  const boards = [["Matchday", 24], ["Signings", 12], ["Sponsors", 9]];
  document.body.classList.add("sv-locked");
  main.insertAdjacentHTML("beforebegin", `<section class="sv-lock container">
    <div class="sv-lock-card">
      <span class="sv-lock-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg></span>
      <h1>${tx("Save your best ideas in boards")}</h1>
      <p>${tx("Keep the posts that inspire you organised by matchday, signings, sponsors… and turn them into your content plan. Try it free for 7 days.")}</p>
      <button class="btn btn-gold" type="button" data-plans-picker="library.access" aria-expanded="false">${tx("Start my free trial")}</button>
      <div class="pp-plans" data-plans-picker-list hidden></div>
    </div>
    <p class="sv-lock-eg">${tx("This is how your boards will look")}</p>
    <div class="sv-lock-grid" aria-hidden="true">${boards.map(([name, n], b) => `<div class="sv-lock-board"><em>${tx("Example")}</em>
      <div class="sv-lock-pics"><i style="background-image:url('${pic(b * 3)}')"></i><i style="background-image:url('${pic(b * 3 + 1)}')"></i><i style="background-image:url('${pic(b * 3 + 2)}')"></i></div>
      <b>${tx(name)}</b><small>${tx("{n} posts", { n })}</small></div>`).join("")}</div>
  </section>`);
  document.querySelector(".sv-lock [data-plans-picker]").click();   // the plans already open: one click to start
})();
