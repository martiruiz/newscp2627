// Home stats in motion: the numbers count up when the section comes into view, the gold highlight travels from one stat
// to the next (hover keeps it on a stat) and each icon has its own loop (CSS). Paused while the section is off screen.
(() => {
  const box = document.querySelector("[data-stats]");
  if (!box) return;
  const stats = [...box.querySelectorAll(".stat")];
  const bar = box.querySelector(".stats-bar");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fmt = window.SCP_STAT_FMT = (n, el) => {
    if (el.dataset.format === "compact") return n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${Math.floor(n / 1000)}K` : String(Math.floor(n));
    return String(Math.round(n));
  };

  // Count-up (once)
  let counted = false;
  function countUp() {
    if (counted) return;
    counted = true;
    box.querySelectorAll("[data-count]").forEach((el, i) => {
      const suffix = el.dataset.suffix || "";   // data-count can be updated with the live total (js/site-stats.js) while counting
      if (reduce) return;
      const dur = 1600, start = performance.now() + i * 120;
      const tick = (now) => {
        const t = Math.min(1, Math.max(0, (now - start) / dur));
        const e = 1 - Math.pow(1 - t, 4); // ease-out
        el.textContent = fmt(Number(el.dataset.count) * e, el) + (t >= 1 ? suffix : "");
        if (t < 1) requestAnimationFrame(tick); else el.dataset.done = "1";
      };
      el.textContent = fmt(0, el);
      requestAnimationFrame(tick);
    });
  }

  // Travelling highlight
  let active = 0, timer = null, hovering = false;
  function setActive(i) {
    active = i;
    stats.forEach((s, k) => s.classList.toggle("is-active", k === i));
    if (bar) bar.style.setProperty("--bar-x", `${i * 100}%`);
  }
  const next = () => { if (!hovering) setActive((active + 1) % stats.length); };
  const play = () => { if (!timer && !reduce) timer = setInterval(next, 2600); };
  const stop = () => { clearInterval(timer); timer = null; };
  stats.forEach((s, i) => {
    s.addEventListener("mouseenter", () => { hovering = true; setActive(i); });
    s.addEventListener("mouseleave", () => { hovering = false; });
  });

  new IntersectionObserver(([entry]) => {
    box.classList.toggle("is-live", entry.isIntersecting);
    if (entry.isIntersecting) { countUp(); play(); } else stop();
  }, { threshold: 0.35 }).observe(box);
  setActive(0);
})();
