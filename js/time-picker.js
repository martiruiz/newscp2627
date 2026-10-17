// Time picker for the Content Plan: a time button that opens a compact panel — the 24 hours grouped by part of
// the day, the minutes as :00 / :15 / :30 / :45 — instead of a 96-line dropdown.
// SCP_TIME.button(value, attrs) → markup; SCP_TIME.attach(root, onChange) wires every [data-time-btn] inside root.
// Keyboard on the button: ↑ / ↓ = ±15 min, Enter / Space opens the panel. In the panel: Esc closes.
window.SCP_TIME = (() => {
  const icon = (n) => (window.SCP_ICONS ? window.SCP_ICONS(n) : "");
  const pad = (n) => String(n).padStart(2, "0");
  const GROUPS = [
    { label: "Morning", hours: [6, 7, 8, 9, 10, 11] },
    { label: "Afternoon", hours: [12, 13, 14, 15, 16, 17] },
    { label: "Evening", hours: [18, 19, 20, 21, 22, 23] },
    { label: "Night", hours: [0, 1, 2, 3, 4, 5] },
  ];
  const QUICK = ["09:00", "12:00", "14:00", "18:00", "20:00", "21:30"];
  const split = (v) => { const [h, m] = String(v || "12:00").split(":").map(Number); return { h: h || 0, m: m || 0 }; };
  const fmt = (h, m) => `${pad(h)}:${pad(m)}`;
  const partOf = (h) => (h >= 6 && h < 12 ? "Morning" : h >= 12 && h < 18 ? "Afternoon" : h >= 18 ? "Evening" : "Night");

  const button = (value, attrs = "") => `<button type="button" class="tp-btn" data-time-btn data-value="${value}" aria-haspopup="dialog" ${attrs}>${icon("clock")}<b>${value}</b><span class="tp-part">${partOf(split(value).h)}</span>${icon("chevron-down")}</button>`;
  const setButton = (btn, value) => {
    btn.dataset.value = value;
    btn.querySelector("b").textContent = value;
    btn.querySelector(".tp-part").textContent = partOf(split(value).h);
  };

  let pop = null, owner = null;
  function close() {
    pop?.remove(); pop = null;
    owner?.setAttribute("aria-expanded", "false");
    owner = null;
    document.removeEventListener("mousedown", outside, true);
  }
  const outside = (e) => { if (pop && !pop.contains(e.target) && e.target !== owner && !owner?.contains(e.target)) close(); };

  function open(btn, onChange) {
    if (owner === btn) return close();
    close();
    owner = btn;
    btn.setAttribute("aria-expanded", "true");
    let { h, m } = split(btn.dataset.value);
    pop = document.createElement("div");
    pop.className = "tp";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", "Choose a time");
    const draw = () => {
      pop.innerHTML = `
        <div class="tp-top"><div><span>Time</span><b>${fmt(h, m)}</b></div><em>${partOf(h)}</em></div>
        <div class="tp-quick">${QUICK.map((q) => `<button type="button" data-tp-quick="${q}" class="${q === fmt(h, m) ? "is-on" : ""}">${q}</button>`).join("")}</div>
        <div class="tp-hours">${GROUPS.map((g) => `
          <div class="tp-row"><span class="tp-label">${g.label}</span>
            <div class="tp-grid">${g.hours.map((x) => `<button type="button" data-tp-h="${x}" class="${x === h ? "is-on" : ""}" aria-pressed="${x === h}">${pad(x)}</button>`).join("")}</div></div>`).join("")}
        </div>
        <div class="tp-min"><span class="tp-label">Minutes</span>
          <div class="tp-seg">${[0, 15, 30, 45].map((x) => `<button type="button" data-tp-m="${x}" class="${x === m ? "is-on" : ""}" aria-pressed="${x === m}">:${pad(x)}</button>`).join("")}</div></div>
        <div class="tp-foot"><span>${icon("keyboard")}↑ ↓ on the time: ±15 min</span><button type="button" class="tp-done" data-tp-done>Done</button></div>`;
    };
    const commit = () => { const v = fmt(h, m); setButton(btn, v); onChange(v, btn); draw(); };
    draw();
    pop.addEventListener("click", (e) => {
      const q = e.target.closest("[data-tp-quick]");
      if (q) { ({ h, m } = split(q.dataset.tpQuick)); commit(); return close(); }
      const hb = e.target.closest("[data-tp-h]");
      if (hb) { h = Number(hb.dataset.tpH); return commit(); }
      const mb = e.target.closest("[data-tp-m]");
      if (mb) { m = Number(mb.dataset.tpM); commit(); return close(); }
      if (e.target.closest("[data-tp-done]")) close();
    });
    pop.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); btn.focus(); } });
    document.body.append(pop);
    // Under the button (or above it when there's no room), inside the screen
    const r = btn.getBoundingClientRect();
    const w = pop.offsetWidth, hgt = pop.offsetHeight;
    pop.style.left = `${Math.max(10, Math.min(innerWidth - w - 10, r.left))}px`;
    pop.style.top = `${r.bottom + 8 + hgt > innerHeight - 10 ? Math.max(10, r.top - hgt - 8) : r.bottom + 8}px`;
    setTimeout(() => document.addEventListener("mousedown", outside, true));
    pop.querySelector(".tp-grid .is-on")?.focus({ preventScroll: true });
  }

  function attach(root, onChange) {
    root.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-time-btn]");
      if (btn && root.contains(btn)) { e.preventDefault(); open(btn, onChange); }
    });
    root.addEventListener("keydown", (e) => {
      const btn = e.target.closest?.("[data-time-btn]");
      if (!btn || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
      e.preventDefault();
      const { h, m } = split(btn.dataset.value);
      const total = (h * 60 + m + (e.key === "ArrowUp" ? 15 : -15) + 1440) % 1440;
      const v = fmt(Math.floor(total / 60), total % 60);
      setButton(btn, v);
      onChange(v, btn);
    });
  }
  addEventListener("scroll", (e) => { if (pop && !pop.contains(e.target)) close(); }, { capture: true, passive: true });
  addEventListener("resize", close);
  return { button, attach, close };
})();
