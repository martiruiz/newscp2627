// Floating dock on the home page: appears after the first scroll down.
// Newsletter (pop-up with a free resource) · back to top (with scroll progress ring) · Content Library.
(() => {
  const cfg = window.SCP_CONFIG || {};
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const svg = (paths, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  // Lucide (ISC): mail, arrow-up-right, arrow-up, smartphone, check, x, sparkles, trending-up, zap
  const I = {
    mail: '<path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/>',
    out: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
    up: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    phone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    spark: '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/>',
    trend: '<path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/>',
    zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  };
  const RESOURCE = "Sports Content Idea Kit";
  const CONSENT = "I want the free kit and the SCP newsletter (sports digital marketing news and examples). I can unsubscribe at any time.";
  const R = 19, C = 2 * Math.PI * R;

  // ---------- Dock ----------
  const dock = document.createElement("nav");
  dock.className = "dock";
  dock.setAttribute("aria-label", "Quick actions");
  dock.innerHTML = `
    <button class="dock-news" type="button" data-dock-news>${svg(I.mail)}<span>Newsletter</span>${svg(I.out)}</button>
    <span class="dock-sep" aria-hidden="true"></span>
    <button class="dock-btn dock-top" type="button" aria-label="Back to top" title="Back to top" data-dock-top>
      <svg class="dock-ring" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="${R}" class="dock-ring-bg"/><circle cx="22" cy="22" r="${R}" class="dock-ring-fg" style="stroke-dasharray:${C};stroke-dashoffset:${C}" data-dock-ring/></svg>
      ${svg(I.up)}
    </button>
    <a class="dock-btn dock-app" href="content-library.html" aria-label="Open the Content Library" title="Content Library">${svg(I.phone)}</a>`;
  document.body.append(dock);

  const ring = dock.querySelector("[data-dock-ring]");
  let shown = false;
  function onScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    ring.style.strokeDashoffset = C * (1 - p);
    if (!shown && window.scrollY > 240) { shown = true; dock.classList.add("is-in"); }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  dock.querySelector("[data-dock-top]").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  // ---------- Newsletter pop-up ----------
  const modal = document.createElement("div");
  modal.className = "nl-modal";
  modal.hidden = true;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "nl-title");
  modal.innerHTML = `
    <div class="nl-panel">
      <button class="nl-close" type="button" aria-label="Close" data-nl-close>${svg(I.x)}</button>
      <div class="nl-visual" aria-hidden="true">
        <img class="nl-photo" src="assets/newsletter-phones.webp" alt="" width="1400" height="875" decoding="async">
        <div class="nl-badge"><span>FREE</span>Sports Content Idea Kit<small>50 proven post formats</small></div>
        <div class="nl-chip nl-chip-1">${svg(I.trend)}What's working this week</div>
        <div class="nl-chip nl-chip-2">${svg(I.zap)}Ready-to-copy hooks</div>
      </div>
      <div class="nl-body" data-nl-body>
        <p class="nl-eyebrow">${svg(I.spark)}Free resource + weekly newsletter</p>
        <h2 id="nl-title">Steal the content ideas <span class="gold">top sports teams</span> are using right now</h2>
        <p class="nl-lead">Get the <b>${RESOURCE}</b> free, today. Then every week we send you the latest in sports digital marketing, with real examples of the sports posts that are working across the industry.</p>
        <ul class="nl-list">
          <li>${svg(I.check)}<span><b>50 proven post ideas</b> you can adapt to your club today</span></li>
          <li>${svg(I.check)}<span><b>The posts going viral</b> in sport each week, and why they work</span></li>
          <li>${svg(I.check)}<span><b>Platform updates &amp; AI tools</b>, explained for sports social teams</span></li>
        </ul>
        <form class="nl-form" novalidate data-nl-form>
          <div class="nl-fields">
            <input type="text" name="first_name" placeholder="First name" autocomplete="given-name" maxlength="80" aria-label="First name">
            <input type="email" name="email" placeholder="Your work email" autocomplete="email" required maxlength="254" aria-label="Email">
          </div>
          <label class="nl-consent"><input type="checkbox" name="consent" required><span>${CONSENT}</span></label>
          <button class="btn btn-gold nl-cta" type="submit">Send me the free kit ${svg(I.out)}</button>
          <p class="nl-error" role="alert" hidden data-nl-error></p>
          <p class="nl-trust">Free forever · No spam · Used by social teams at +100 clubs</p>
        </form>
      </div>
    </div>`;
  document.body.append(modal);

  const form = modal.querySelector("[data-nl-form]");
  const err = modal.querySelector("[data-nl-error]");
  let lastFocus = null;
  function open() {
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(() => form?.email?.focus(), 50);
  }
  function close() {
    modal.hidden = true;
    document.body.style.overflow = "";
    lastFocus?.focus?.();
  }
  dock.querySelector("[data-dock-news]").addEventListener("click", open);
  modal.addEventListener("click", (e) => { if (e.target === modal || e.target.closest("[data-nl-close]")) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) close(); });
  // Any link to #newsletter on the page opens it too
  document.addEventListener("click", (e) => { const a = e.target.closest('a[href="#newsletter"]'); if (a) { e.preventDefault(); open(); } });

  function success(email) {
    const dl = cfg.newsletterResourceUrl;
    modal.querySelector("[data-nl-body]").innerHTML = `
      <div class="nl-done">
        <span class="nl-done-icon">${svg(I.check)}</span>
        <h2>You're in${form.first_name.value.trim() ? `, ${esc(form.first_name.value.trim())}` : ""}!</h2>
        <p>${dl ? `Your <b>${RESOURCE}</b> is ready.` : `We'll send your <b>${RESOURCE}</b> to <b>${esc(email)}</b> within 24 hours.`} After that, look out for our weekly newsletter with the sports content that's working right now.</p>
        ${dl ? `<a class="btn btn-gold nl-cta" href="${esc(dl)}" target="_blank" rel="noopener" download>Download the kit ${svg(I.out)}</a>` : ""}
        <a class="nl-more" href="content-library.html">Meanwhile, explore the Content Library →</a>
      </div>`;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.hidden = true;
    const email = form.email.value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err.textContent = "Please enter a valid email."; err.hidden = false; return form.email.focus(); }
    if (!form.consent.checked) { err.textContent = "Please tick the box so we can send you the kit and the newsletter."; err.hidden = false; return; }
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      const res = await fetch(`${cfg.supabaseUrl}/rest/v1/newsletter_signups`, {
        method: "POST",
        headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ email, first_name: form.first_name.value.trim() || null, source: "home-dock", resource: RESOURCE, consent: true, consent_text: CONSENT }),
      });
      // 409 = already subscribed: treat as success
      if (!res.ok && res.status !== 409) throw new Error(String(res.status));
      success(email);
    } catch {
      err.textContent = "Something went wrong. Please try again in a moment.";
      err.hidden = false;
    } finally { btn.disabled = false; }
  });
})();
