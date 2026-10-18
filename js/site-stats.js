// Live library totals on the public pages: elements with data-stat="posts|clubs|competitions|sports" show the real
// number from Supabase (site_stats(), supabase/site-stats.sql), rounded down so it always stays true as the library
// grows: 542,631 → "500,000+", 771 → "770+", 114 → "110+". The HTML keeps a safe fallback until the numbers arrive.
(() => {
  const els = document.querySelectorAll("[data-stat]");
  const cfg = window.SCP_CONFIG || {};
  if (!els.length || !cfg.supabaseUrl) return;
  const floor = (n) => {
    if (n < 100) return n;
    if (n < 1000) return Math.floor(n / 10) * 10;
    const step = n < 1e6 ? 10 ** (String(Math.floor(n)).length - 1) : 1e5;
    return Math.floor(n / step) * step;
  };
  fetch(`${cfg.supabaseUrl}/rest/v1/rpc/site_stats`, { method: "POST",
    headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}`, "Content-Type": "application/json" }, body: "{}" })
    .then((r) => (r.ok ? r.json() : null))
    .then((s) => {
      if (!s) return;
      const loc = window.SCP_LOC || "en-GB";
      els.forEach((el) => {
        const raw = Number(s[el.dataset.stat]);
        if (!(raw > 0)) return;
        const v = floor(raw);
        if (el.hasAttribute("data-count")) {          // animated counter on the home: js/stats.js reads data-count on every frame
          el.dataset.count = String(v);
          if (matchMedia("(prefers-reduced-motion: reduce)").matches || el.dataset.done) el.textContent = window.SCP_STAT_FMT ? window.SCP_STAT_FMT(v, el) + (el.dataset.suffix || "") : `${v}${el.dataset.suffix || ""}`;
        } else {
          el.textContent = `${v.toLocaleString(loc)}${raw > v ? "+" : ""}`;
        }
      });
    })
    .catch(() => {});
})();
