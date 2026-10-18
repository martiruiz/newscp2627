// Home: the AI analysis and Content Plan mock-ups play like the real product.
//   AI analysis: "Unlock AI analysis — 1 credit" is clicked, the post is read (scan line), the analysis writes itself.
//   Content Plan: saved posts fly from the tray onto days of the week, the week count goes up, statuses move forward.
// Each loop runs only while its section is on screen; with reduced motion the final state is shown.
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const t = (s) => (window.tx ? window.tx(s) : s);

  // Runs `loop(isOn)` while `el` is visible; the loop checks isOn() between steps and stops when it's false
  function whileVisible(el, loop) {
    let on = false, running = false;
    const isOn = () => on;
    new IntersectionObserver(async ([e]) => {
      on = e.isIntersecting;
      if (on && !running) { running = true; try { await loop(isOn); } finally { running = false; } }
    }, { threshold: 0.3 }).observe(el);
  }

  // ---------- AI analysis ----------
  const demo = document.querySelector("[data-ai-demo]");
  if (demo && !reduce) {
    const card = demo.querySelector(".ai-demo-card");
    const rows = [...card.querySelectorAll(".ai-demo-row")];
    const unl = card.querySelector("[data-ai-unlock]"), read = card.querySelector("[data-ai-reading]");
    const btn = unl.querySelector(".ai-unlock-btn-mock");
    card.classList.add("is-live");
    whileVisible(demo, async (isOn) => {
      const texts = rows.map((r) => r.querySelector("p").textContent);   // already translated by js/i18n.js
      while (isOn()) {
        rows.forEach((r) => { r.classList.remove("is-shown"); r.querySelector("p").textContent = ""; });
        unl.hidden = false; read.hidden = true;
        await sleep(1400);
        btn.classList.add("is-press");
        btn.insertAdjacentHTML("beforeend", '<i class="rip"></i>');
        await sleep(160); btn.classList.remove("is-press");
        await sleep(350); btn.querySelector(".rip")?.remove();
        unl.hidden = true; read.hidden = false; demo.classList.add("is-reading");
        // the photo is "read": sweep + grid, detection boxes one by one, progress to 100 %
        const boxes = [...demo.querySelectorAll(".ai-box")], pct = demo.querySelector("[data-ai-pct]"), bar = demo.querySelector("[data-ai-bar]");
        const t0 = performance.now(), DUR = 4200;
        const prog = () => { const k = Math.min(1, (performance.now() - t0) / DUR); pct.textContent = `${Math.round(k * 100)}%`; bar.style.width = `${k * 100}%`; if (k < 1 && demo.classList.contains("is-reading")) requestAnimationFrame(prog); };
        requestAnimationFrame(prog);
        for (const b of boxes) { await sleep(DUR / (boxes.length + 1)); b.classList.add("is-on"); }
        await sleep(DUR / (boxes.length + 1) + 200);
        read.hidden = true; demo.classList.remove("is-reading"); demo.classList.add("is-read");
        for (let i = 0; i < rows.length && isOn(); i++) {
          const p = rows[i].querySelector("p");
          rows[i].classList.add("is-shown");
          for (let k = 1; k <= texts[i].length; k += 2) { p.innerHTML = `${texts[i].slice(0, k)}<span class="ai-caret"></span>`; await sleep(22); }
          p.textContent = texts[i];
          await sleep(260);
        }
        await sleep(5200);
        demo.classList.remove("is-read");
        demo.querySelectorAll(".ai-box").forEach((b) => b.classList.remove("is-on"));
        await sleep(400);
      }
      rows.forEach((r, i) => { r.classList.add("is-shown"); r.querySelector("p").textContent = texts[i]; });
      unl.hidden = read.hidden = true;
    });
  }

  // ---------- Content Library: a cursor picks filters (real crests); the grid shows that filter's top posts ----------
  const lib = document.querySelector("[data-lib-demo]");
  if (lib && !reduce) {
    const grid = lib.querySelector("[data-lib-grid]"), countEl = lib.querySelector("[data-lib-count]"), cursor = lib.querySelector("[data-lib-cursor]");
    const crests = [...lib.querySelectorAll("[data-lib-f]")];
    const loc = () => window.SCP_LOC || "en-GB";
    const views = (n) => `${n >= 1e6 ? `${(n / 1e6).toLocaleString(loc(), { maximumFractionDigits: 1 })}M` : `${Math.round(n / 1e3).toLocaleString(loc())}K`} ${t("views")}`;
    const initial = grid.innerHTML, initialCount = countEl.innerHTML;
    fetch("js/lib-filters-data.json").then((r) => r.json()).then((filters) => {
      // preload the covers so each change is instant
      filters.forEach((f) => f.posts.forEach((p) => { const im = new Image(); im.src = `assets/lib/${p.id}.jpg`; }));
      const moveCursor = (el) => {
        const a = lib.getBoundingClientRect(), b = el.getBoundingClientRect();
        cursor.style.transform = `translate(${b.left - a.left + b.width * 0.6}px, ${b.top - a.top + b.height * 0.55}px)`;
      };
      const countTo = (to) => {
        const from = 0, t0 = performance.now();
        const step = (now) => { const k = Math.min(1, (now - t0) / 700); countEl.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))).toLocaleString(loc()); if (k < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      };
      whileVisible(lib, async (isOn) => {
        lib.classList.add("is-live");
        while (isOn()) {
          for (let i = 0; i < crests.length && isOn(); i++) {
            const c = crests[i], f = filters[Number(c.dataset.libF)];
            moveCursor(c);
            await sleep(750);
            cursor.classList.add("is-click"); c.classList.add("is-press");
            await sleep(180);
            cursor.classList.remove("is-click"); c.classList.remove("is-press");
            crests.forEach((x) => x.classList.toggle("is-on", x === c));
            countTo(f.count);
            grid.classList.add("is-swap");
            await sleep(260);
            grid.innerHTML = f.posts.map((p) => `<figure style="background:url(assets/lib/${p.id}.jpg) 50% 35% / cover no-repeat, #0b0f1c"><figcaption><b>${t(f.name)}</b><small>${views(p.views)}</small></figcaption></figure>`).join("");
            grid.classList.remove("is-swap");
            await sleep(2600);
          }
          crests.forEach((x) => x.classList.remove("is-on"));
          grid.innerHTML = initial; countEl.innerHTML = initialCount;
          cursor.style.transform = "";
          await sleep(1800);
        }
        lib.classList.remove("is-live");
      });
    }).catch(() => {});
  }

  // ---------- Content Plan ----------
  const cp = document.querySelector("[data-cp-demo]");
  if (cp && !reduce) {
    const grid = cp.querySelector("[data-cp-grid]");
    const counter = cp.querySelector("[data-cp-count]");
    const thumbs = [...cp.querySelectorAll("[data-cp-post]")];
    const initial = grid.innerHTML;
    const planned = () => [...grid.querySelectorAll(".cp-day")].filter((d) => d.querySelector(".cp-e:not(.is-ghost)")).length;
    const count = (bump) => {
      counter.textContent = t("{n} / 7 days planned").replace("{n}", planned());
      if (bump) { counter.classList.remove("is-bump"); void counter.offsetWidth; counter.classList.add("is-bump"); }
    };
    whileVisible(cp, async (isOn) => {
      while (isOn()) {
        grid.innerHTML = initial;
        thumbs.forEach((th) => th.classList.remove("is-gone"));
        count(false);
        await sleep(1200);
        for (const th of thumbs) {
          if (!isOn()) break;
          const day = grid.querySelector(`.cp-day[data-day="${th.dataset.day}"]`);
          const a = th.getBoundingClientRect(), b = day.getBoundingClientRect();
          const fly = document.createElement("div");
          fly.className = "cp-fly";
          fly.style.cssText = `left:${a.left}px;top:${a.top}px;background-image:${th.style.backgroundImage}`;
          document.body.appendChild(fly);
          th.classList.add("is-gone"); day.classList.add("is-target");
          await sleep(30);
          fly.style.transform = `translate(${b.left + b.width / 2 - a.left - 19}px, ${b.top + 34 - a.top}px) rotate(-4deg)`;
          await sleep(950);
          fly.style.opacity = "0"; setTimeout(() => fly.remove(), 300);
          day.classList.remove("is-target");
          day.querySelectorAll(".cp-e.is-ghost").forEach((g) => g.remove());
          day.querySelector("small").insertAdjacentHTML("afterend", `<i class="cp-e is-idea has-img is-new" data-flown><b style="background-image:${th.style.backgroundImage}"></b>${t(th.dataset.title)}</i>`);
          count(true);
          await sleep(450);
        }
        for (const cls of ["is-plan", "is-prod", "is-pub"]) {
          if (!isOn()) break;
          await sleep(900);
          grid.querySelectorAll("[data-flown]").forEach((e) => { e.classList.remove("is-idea", "is-plan", "is-prod"); e.classList.add(cls); });
        }
        await sleep(4200);
      }
    });
  }
})();
