// "AI analyzes every post" (home → How it works, step 02): the AI-analysis line scans the PSG post up and down,
// then the Visual analysis, Filters applied and AI confidence score panels appear. Replays each time step 02 shows.
(() => {
  const scan = document.querySelector("[data-scan]");
  if (!scan) return;
  const step = scan.closest(".magic-visual");
  const pct = scan.querySelector("[data-scan-pct]");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TARGET = 97.83, COUNT_AT = 3900, COUNT_MS = 1100;
  let timer = null, raf = null;

  function play() {
    clearTimeout(timer); cancelAnimationFrame(raf);
    scan.classList.remove("is-scanning");
    void scan.offsetWidth; // restart the CSS animations
    scan.classList.add("is-scanning");
    if (reduce) { pct.textContent = TARGET.toFixed(2); return; }
    pct.textContent = "0.00";
    timer = setTimeout(() => {
      const t0 = performance.now();
      const tick = (now) => {
        const k = Math.min(1, (now - t0) / COUNT_MS);
        pct.textContent = (TARGET * (1 - Math.pow(1 - k, 3))).toFixed(2);
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, COUNT_AT);
  }
  const active = () => step.classList.contains("is-active");
  new MutationObserver(() => (active() ? play() : scan.classList.remove("is-scanning"))).observe(step, { attributes: true, attributeFilter: ["class"] });
  if (active()) play();
})();
