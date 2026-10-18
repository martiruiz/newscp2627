// Floating dock on the home page: appears after the first scroll down.
// Newsletter (short sign-up pop-up) · back to top (with scroll progress ring) · Content Library.
(() => {
  const cfg = window.SCP_CONFIG || {};
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const svg = (paths, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  // Lucide (ISC): mail, arrow-up-right, arrow-up, smartphone, check, x
  const I = {
    mail: '<path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/>',
    out: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
    up: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    phone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  };
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
  const CONSENT = "I want the SCP newsletter. I can unsubscribe at any time.";
  const modal = document.createElement("div");
  modal.className = "nl-modal";
  modal.hidden = true;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "nl-title");
  modal.innerHTML = `
    <div class="nl-panel is-simple">
      <button class="nl-close" type="button" aria-label="Close" data-nl-close>${svg(I.x)}</button>
      <div class="nl-body" data-nl-body>
        <span class="nl-icon">${svg(I.mail)}</span>
        <h2 id="nl-title">The sports posts that work, <span class="gold">every Monday</span></h2>
        <p class="nl-lead">A short weekly email for sports social media teams. Free.</p>
        <form class="nl-form" novalidate data-nl-form>
          <div class="nl-row">
            <input type="email" name="email" placeholder="Your email" autocomplete="email" required maxlength="254" aria-label="Email">
            <button class="btn btn-gold nl-cta" type="submit">Subscribe</button>
          </div>
          <label class="nl-consent"><input type="checkbox" name="consent" required><span>${CONSENT}</span></label>
          <p class="nl-error" role="alert" hidden data-nl-error></p>
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

  function success() {
    modal.querySelector("[data-nl-body]").innerHTML = `
      <div class="nl-done">
        <span class="nl-icon">${svg(I.check)}</span>
        <h2>${tx("You're in!")}</h2>
        <p class="nl-lead">${tx("See you on Monday. Every email has a one-click unsubscribe link.")}</p>
      </div>`;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.hidden = true;
    const email = form.email.value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err.textContent = tx("Please enter a valid email."); err.hidden = false; return form.email.focus(); }
    if (!form.consent.checked) { err.textContent = tx("Please tick the box so we can send you the newsletter."); err.hidden = false; return; }
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      const res = await fetch(`${cfg.supabaseUrl}/rest/v1/newsletter_signups`, {
        method: "POST",
        headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ email, source: "home-dock", consent: true, consent_text: CONSENT }),
      });
      // 409 = already subscribed: treat as success
      if (!res.ok && res.status !== 409) throw new Error(String(res.status));
      success();
    } catch {
      err.textContent = tx("Something went wrong. Please try again in a moment.");
      err.hidden = false;
    } finally { btn.disabled = false; }
  });
})();
