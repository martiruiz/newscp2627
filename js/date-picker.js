// Date picker for the Content Plan (same look as the time picker): a date button that opens a calendar panel with
// quick picks (Today, Tomorrow, Next Monday, No date), weeks starting on Monday, today marked, the chosen day in gold
// and a dot on days that already have posts planned.
// SCP_DATE.button(value, attrs) → markup; SCP_DATE.attach(root, onChange, { counts(fromIso, toIso) → Promise<Map> }).
// Keyboard on the button: ← / → = ±1 day.
window.SCP_DATE = (() => {
  const icon = (n) => (window.SCP_ICONS ? window.SCP_ICONS(n) : "");
  const DAYS = (window.SCP_LANG === "es" ? ["L", "M", "X", "J", "V", "S", "D"] : ["M", "T", "W", "T", "F", "S", "S"]);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const mondayOf = (d) => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7));
  const label = (v) => (v ? parse(v).toLocaleDateString(window.SCP_LOC || "en-GB", { weekday: "short", day: "numeric", month: "short" }) : "No date");
  const relative = (v) => {
    if (!v) return "idea";
    const diff = Math.round((parse(v) - parse(iso(new Date()))) / 864e5);
    return diff === 0 ? "today" : diff === 1 ? "tomorrow" : diff === -1 ? "yesterday" : diff > 1 && diff < 7 ? `in ${diff} days` : parse(v).getFullYear() !== new Date().getFullYear() ? String(parse(v).getFullYear()) : "";
  };
  const button = (value, attrs = "") => `<button type="button" class="tp-btn dp2-btn" data-date-btn data-value="${value || ""}" aria-haspopup="dialog" ${attrs}>${icon("calendar-days")}<b>${label(value)}</b><span class="tp-part">${relative(value)}</span>${icon("chevron-down")}</button>`;
  const setButton = (btn, value) => {
    btn.dataset.value = value || "";
    btn.querySelector("b").textContent = label(value);
    btn.querySelector(".tp-part").textContent = relative(value);
  };

  let pop = null, owner = null;
  function close() {
    pop?.remove(); pop = null;
    owner?.setAttribute("aria-expanded", "false");
    owner = null;
    document.removeEventListener("mousedown", outside, true);
  }
  const outside = (e) => { if (pop && !pop.contains(e.target) && !owner?.contains(e.target)) close(); };

  function open(btn, onChange, opts) {
    if (owner === btn) return close();
    close();
    window.SCP_TIME?.close();
    owner = btn;
    btn.setAttribute("aria-expanded", "true");
    const value = btn.dataset.value || null;
    let month = value ? parse(value) : new Date();
    month = new Date(month.getFullYear(), month.getMonth(), 1);
    let counts = new Map();
    pop = document.createElement("div");
    pop.className = "tp dp2";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", "Choose a date");
    const today = iso(new Date());
    const quick = [["Today", today], ["Tomorrow", iso(addDays(new Date(), 1))], ["Next Monday", iso(addDays(mondayOf(new Date()), 7))], ["No date", ""]];
    const draw = () => {
      const start = mondayOf(month);
      const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
      const sel = btn.dataset.value || "";
      pop.innerHTML = `
        <div class="tp-top"><div><span>Date</span><b class="dp2-big">${sel ? parse(sel).toLocaleDateString(window.SCP_LOC || "en-GB", { day: "numeric", month: "short" }) : "No date"}</b></div><em>${sel ? parse(sel).toLocaleDateString(window.SCP_LOC || "en-GB", { weekday: "long" }) : "Idea for later"}</em></div>
        <div class="dp2-quick">${quick.map(([l, v]) => `<button type="button" data-dp2-pick="${v}" class="${v === sel ? "is-on" : ""}${v === "" ? " is-none" : ""}">${v === "" ? icon("inbox") : ""}${l}</button>`).join("")}</div>
        <div class="dp2-nav"><button type="button" data-dp2-month="-1" aria-label="Previous month">${icon("chevron-left")}</button>
          <b>${month.toLocaleDateString(window.SCP_LOC || "en-GB", { month: "long", year: "numeric" })}</b>
          <button type="button" data-dp2-month="1" aria-label="Next month">${icon("chevron-right")}</button></div>
        <div class="dp2-grid">${DAYS.map((d, i) => `<span class="dp2-h${i > 4 ? " is-we" : ""}">${d}</span>`).join("")}${cells.map((d) => {
          const v = iso(d), n = counts.get(v) || 0;
          return `<button type="button" data-dp2-pick="${v}" class="${d.getMonth() !== month.getMonth() ? "is-out" : ""}${v === today ? " is-today" : ""}${v === sel ? " is-on" : ""}${v < today ? " is-past" : ""}" aria-label="${d.toLocaleDateString(window.SCP_LOC || "en-GB", { weekday: "long", day: "numeric", month: "long" })}${n ? `, ${n} planned` : ""}">${d.getDate()}${n ? `<i>${"•".repeat(Math.min(n, 3))}</i>` : ""}</button>`;
        }).join("")}</div>
        <div class="tp-foot"><span>${icon("keyboard")}← → on the date: ±1 day</span>${month.getMonth() !== new Date().getMonth() || month.getFullYear() !== new Date().getFullYear() ? `<button type="button" class="dp2-link" data-dp2-today>This month</button>` : ""}</div>`;
    };
    const loadCounts = async () => {
      if (!opts?.counts) return;
      const start = mondayOf(month);
      const shown = month.getTime();
      try { const c = await opts.counts(iso(start), iso(addDays(start, 41))); if (pop && month.getTime() === shown) { counts = c; draw(); } } catch {}
    };
    draw();
    loadCounts();
    pop.addEventListener("click", (e) => {
      const m = e.target.closest("[data-dp2-month]");
      if (m) { month = new Date(month.getFullYear(), month.getMonth() + Number(m.dataset.dp2Month), 1); draw(); return loadCounts(); }
      if (e.target.closest("[data-dp2-today]")) { month = new Date(new Date().getFullYear(), new Date().getMonth(), 1); draw(); return loadCounts(); }
      const p = e.target.closest("[data-dp2-pick]");
      if (p) { const v = p.dataset.dp2Pick || null; setButton(btn, v); close(); onChange(v, btn); }
    });
    pop.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); btn.focus(); } });
    document.body.append(pop);
    const r = btn.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = `${Math.max(10, Math.min(innerWidth - w - 10, r.left))}px`;
    pop.style.top = `${r.bottom + 8 + h > innerHeight - 10 ? Math.max(10, r.top - h - 8) : r.bottom + 8}px`;
    setTimeout(() => document.addEventListener("mousedown", outside, true));
  }

  function attach(root, onChange, opts = {}) {
    root.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-date-btn]");
      if (btn && root.contains(btn)) { e.preventDefault(); open(btn, onChange, opts); }
    });
    root.addEventListener("keydown", (e) => {
      const btn = e.target.closest?.("[data-date-btn]");
      if (!btn || (e.key !== "ArrowLeft" && e.key !== "ArrowRight") || !btn.dataset.value) return;
      e.preventDefault();
      const v = iso(addDays(parse(btn.dataset.value), e.key === "ArrowRight" ? 1 : -1));
      setButton(btn, v);
      onChange(v, btn);
    });
  }
  addEventListener("scroll", (e) => { if (pop && !pop.contains(e.target)) close(); }, { capture: true, passive: true });
  addEventListener("resize", close);
  return { button, attach, close };
})();
