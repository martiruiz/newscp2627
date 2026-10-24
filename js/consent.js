// Cookie notice (GDPR / ePrivacy). Necessary storage (session, preferences, payments) is always on; anonymous usage
// measurement (js/lead-flow.js SCP_TRACK: a random id in local storage + funnel events, and Metricool's visit counter) only
// with consent. The choice is kept in local storage ("scp-consent") and can be changed from the footer link
// "Cookie settings" or anything with [data-cookie-settings]. Accept and Reject weigh the same.
(() => {
  const KEY = "scp-consent";
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } };
  const tx = (t) => (window.tx ? window.tx(t) : t);
  let choice = read();

  window.SCP_CONSENT = { analytics: () => !!choice?.analytics, open: () => show(true) };

  // Metricool (website visits), only with consent to analytics
  const metricool = () => {
    if (document.querySelector("script[data-metricool]")) return;
    const s = document.createElement("script");
    s.src = "https://tracker.metricool.com/resources/be.js"; s.dataset.metricool = "";
    s.onload = () => window.beTracker?.t({ hash: "c2050676d2a43cc6cf8cc574d17f5769" });
    document.head.append(s);
  };
  if (choice?.analytics) metricool();

  function save(analytics) {
    choice = { analytics, at: new Date().toISOString(), v: 1 };
    try { localStorage.setItem(KEY, JSON.stringify(choice)); } catch {}
    if (!analytics) { try { localStorage.removeItem("scp-lead-cid"); } catch {} }   // the measurement id goes when they say no
    else metricool();
    document.querySelector(".ck")?.remove();
  }

  function show(settings = false) {
    document.querySelector(".ck")?.remove();
    const el = document.createElement("div");
    el.className = `ck${settings ? " is-settings" : ""}`;
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", tx("Cookies"));
    el.innerHTML = `
      <div class="ck-head"><span class="ck-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8.5 8.5v.01M16 15.5v.01M12 12v.01M11 17v.01M7 14v.01"/></svg></span><p class="ck-t">${tx("Cookies")}</p></div>
      <p class="ck-p">${tx("We use what's needed for SCP to work. With your permission, we also measure anonymously how the website is used, to improve it.")} <a href="privacy.html#cookies">${tx("Cookie Policy")}</a></p>
      <div class="ck-opts">
        <label class="ck-opt"><span><b>${tx("Necessary")}</b><small>${tx("Sign-in session, preferences and secure payments. Always on.")}</small></span><input type="checkbox" checked disabled></label>
        <label class="ck-opt"><span><b>${tx("Analytics")}</b><small>${tx("Anonymous measurement of how the website is used.")}</small></span><input type="checkbox" data-ck-an${choice?.analytics ? " checked" : ""}></label>
      </div>
      <div class="ck-btns">
        <button type="button" class="ck-b" data-ck-no>${tx("Reject")}</button>
        <button type="button" class="ck-b" data-ck-yes>${tx("Accept")}</button>
        <button type="button" class="ck-link" data-ck-set>${tx("Settings")}</button>
        <button type="button" class="ck-b ck-save" data-ck-save>${tx("Save my choice")}</button>
      </div>`;
    el.addEventListener("click", (e) => {
      if (e.target.closest("[data-ck-no]")) save(false);
      else if (e.target.closest("[data-ck-yes]")) save(true);
      else if (e.target.closest("[data-ck-set]")) el.classList.add("is-settings");
      else if (e.target.closest("[data-ck-save]")) save(el.querySelector("[data-ck-an]").checked);
    });
    document.body.append(el);
  }

  document.addEventListener("click", (e) => { if (e.target.closest("[data-cookie-settings]")) { e.preventDefault(); show(true); } });
  const start = () => {
    // "Cookie settings" next to the Cookie Policy link in the footer
    document.querySelectorAll('.sf-bottom a[href="privacy.html#cookies"]').forEach((a) => {
      if (!a.nextElementSibling?.matches("[data-cookie-settings]")) a.insertAdjacentHTML("afterend", `<a href="#" data-cookie-settings>${tx("Cookie settings")}</a>`);
    });
    if (!choice) show();
  };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start) : start();
})();
