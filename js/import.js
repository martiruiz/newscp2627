// "Fresh content, updated daily" (home → How it works, step 03): the counter imports posts while the cards drop into
// the grid one by one, then the badge switches to "Daily upload complete". Replays each time step 03 shows.
(() => {
  const box = document.querySelector("[data-import]");
  if (!box) return;
  const step = box.closest(".magic-visual");
  const count = box.querySelector("[data-import-count]");
  const label = box.querySelector("[data-import-label]");
  const TOTAL = 5248, COUNT_MS = 2600;
  const fmt = (n) => n.toLocaleString("de-DE"); // 5.248 (dot thousands, as in the design)
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let raf = null, done = null;

  function play() {
    cancelAnimationFrame(raf); clearTimeout(done);
    box.classList.remove("is-importing", "is-done");
    void box.offsetWidth;
    if (reduce) { box.classList.add("is-done"); count.textContent = fmt(TOTAL); label.textContent = "Daily upload complete"; return; }
    box.classList.add("is-importing");
    label.textContent = "Importing new posts…";
    const t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / COUNT_MS);
      count.textContent = fmt(Math.round(TOTAL * (1 - Math.pow(1 - k, 2.4))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    done = setTimeout(() => { box.classList.add("is-done"); label.textContent = "Daily upload complete"; }, COUNT_MS + 80);
  }
  const active = () => step.classList.contains("is-active");
  new MutationObserver(() => (active() ? play() : box.classList.remove("is-importing"))).observe(step, { attributes: true, attributeFilter: ["class"] });
  if (active()) play();
})();
