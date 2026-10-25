// Home → How it works: a live preview of the Content Library. Real top posts (covers and real tags from the library,
// js/live-library-data.json) scroll in three columns; when a post crosses the "AI analysis" line its tags appear;
// the sport filter changes every few seconds (posts that don't match dim, like in the library); a "daily import"
// note comes and goes; the three steps on the left light up in turn. Paused off screen; static with reduced motion.
(() => {
  const box = document.querySelector("[data-live]");
  if (!box) return;
  const colsBox = box.querySelector("[data-live-cols]");
  const beam = box.querySelector("[data-live-beam]");
  const toast = box.querySelector("[data-live-toast]");
  const chips = [...box.querySelectorAll("[data-live-chips] [data-f]")];
  const q = box.querySelector("[data-live-q]");
  const steps = [...document.querySelectorAll("[data-live-steps] li")];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const t = (s) => (window.tx ? window.tx(s) : s);
  const views = (n) => {
    const loc = window.SCP_LOC || "en-GB";
    const v = n >= 1e6 ? `${(n / 1e6).toLocaleString(loc, { maximumFractionDigits: 1 })}M` : `${Math.round(n / 1e3).toLocaleString(loc)}K`;
    return `${v} ${t("views")}`;
  };

  fetch("js/live-library-data.json").then((r) => r.json()).then(start).catch(() => {});

  function start(posts) {
    const N = 3, cols = Array.from({ length: N }, () => []);
    posts.forEach((p, i) => cols[i % N].push(p));
    const card = (p) => `<article class="live-card" data-sport="${esc(p.tags[0] || "")}">
        <div class="live-img" style="background-image:url(assets/live/${p.id}.jpg)"></div>
        <span class="live-sport">${esc(t(p.tags[0] || ""))}</span>
        <span class="live-save">${t("Save")}</span>
        <div class="live-meta"><small>${views(p.views)}</small><span class="live-tags">${p.tags.map((x, k) => `<em style="--k:${k}">${esc(t(x))}</em>`).join("")}</span></div>
      </article>`;
    // each column twice in a row → seamless loop (translateY 0 → -50%)
    colsBox.innerHTML = cols.map((c, i) => `<div class="live-col" style="--dur:${[46, 38, 52][i]}s"><div class="live-track">${c.map(card).join("")}${c.map(card).join("")}</div></div>`).join("");
    if (reduce) { box.querySelectorAll(".live-card").forEach((c) => c.classList.add("is-tagged")); return; }

    let running = false, raf = 0, last = 0;
    const cards = [...box.querySelectorAll(".live-card")];
    // tag the posts as they cross the AI line; untag them once they leave the top (they come round again)
    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (now - last < 90) return;
      last = now;
      const b = beam.getBoundingClientRect(), top = box.getBoundingClientRect().top;
      const y = b.top + b.height / 2;
      for (const c of cards) {
        const r = c.getBoundingClientRect();
        if (r.top < y && r.bottom > y) {
          if (!c.classList.contains("is-tagged")) { c.classList.add("is-tagged", "is-scan"); setTimeout(() => c.classList.remove("is-scan"), 700); }
        } else if (r.bottom < top) c.classList.remove("is-tagged");
      }
    }

    // sport filter that changes on its own (and search text), like someone browsing the library
    const SEARCH = ["Search captions…", "matchday", "celebration", "behind the scenes", "goal of the season"];
    let fi = 0, si = 0, timers = [];
    function filterTick() {
      fi = (fi + 1) % chips.length;
      chips.forEach((c, k) => c.classList.toggle("is-on", k === fi));
      const f = chips[fi].dataset.f;
      cards.forEach((c) => c.classList.toggle("is-dim", f !== "all" && c.dataset.sport !== f));
      si = (si + 1) % SEARCH.length;
      q.textContent = t(SEARCH[si]);
      q.classList.toggle("is-typed", si > 0);
    }
    let stepI = 0;
    function stepTick() {
      stepI = (stepI + 1) % steps.length;
      steps.forEach((s, k) => s.classList.toggle("is-on", k === stepI));
      if (stepI === 0) { toast.classList.add("is-in"); setTimeout(() => toast.classList.remove("is-in"), 2600); }
    }

    function play() {
      if (running) return;
      running = true;
      box.classList.add("is-playing");
      raf = requestAnimationFrame(frame);
      timers = [setInterval(filterTick, 3200), setInterval(stepTick, 3600)];
      toast.classList.add("is-in"); setTimeout(() => toast.classList.remove("is-in"), 2600);
    }
    function pause() {
      running = false;
      box.classList.remove("is-playing");
      cancelAnimationFrame(raf);
      timers.forEach(clearInterval);
    }
    new IntersectionObserver(([e]) => (e.isIntersecting ? play() : pause()), { threshold: 0.2 }).observe(box);
    document.addEventListener("visibilitychange", () => (document.hidden ? pause() : box.getBoundingClientRect().top < innerHeight && play()));
  }
})();
