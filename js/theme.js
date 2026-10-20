// First page of the visit: the SCP wordmark draws in and a shine runs across it (css: html.logo-intro).
try {
  if (!sessionStorage.getItem("scp-logo-intro")) {
    sessionStorage.setItem("scp-logo-intro", "1");
    document.documentElement.classList.add("logo-intro");
    setTimeout(() => document.documentElement.classList.remove("logo-intro"), 2800);
  }
} catch {}
// Day / night colours. Loaded in <head> on every page so the saved theme applies before the first paint.
// Night (the original dark design) is the default; the choice is remembered per browser.
(() => {
  const KEY = "scp-theme";
  const root = document.documentElement;
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch {}
  if (saved === "light") root.setAttribute("data-theme", "light");

  const set = (theme) => {
    root.classList.add("theme-anim");
    if (theme === "light") root.setAttribute("data-theme", "light"); else root.removeAttribute("data-theme");
    try { localStorage.setItem(KEY, theme); } catch {}
    document.querySelectorAll("[data-theme-toggle]").forEach(paint);
    setTimeout(() => root.classList.remove("theme-anim"), 400);
  };
  const isLight = () => root.getAttribute("data-theme") === "light";
  function paint(btn) {
    const label = isLight() ? "Switch to night colours" : "Switch to day colours";
    btn.setAttribute("aria-label", label);
    btn.title = label;
    btn.setAttribute("aria-pressed", String(isLight()));
  }
  const BUTTON = `<button class="theme-toggle" type="button" data-theme-toggle>
    <svg class="tt-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.5 14.6A7 7 0 0 1 9.4 5.5a7 7 0 1 0 9.1 9.1z"/></svg>
    <svg class="tt-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.6"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M6 18l1.4-1.4M16.6 7.4 18 6"/></svg>
  </button>`;
  document.addEventListener("DOMContentLoaded", () => {
    // next to the account buttons in the main nav (and in the admin top bar)
    const spot = document.querySelector(".nav-actions") || document.querySelector("[data-theme-slot]");
    if (spot && !spot.querySelector("[data-theme-toggle]")) spot.insertAdjacentHTML("afterbegin", BUTTON);
    document.querySelectorAll("[data-theme-toggle]").forEach((b) => { paint(b); b.addEventListener("click", () => set(isLight() ? "dark" : "light")); });
  });
})();
