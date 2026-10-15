// SCP date picker — replaces the browser's native calendar.
// Markup: <div class="dp" data-dp="from|to"><button class="f-select dp-trigger">…</button><input type="hidden" …></div>
// Pairs with data-dp="from" / data-dp="to" in the same container highlight the range between them.
// The hidden input keeps YYYY-MM-DD and fires "change" (bubbling) when a date is picked or cleared.
(() => {
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  const pad = (n) => String(n).padStart(2, "0");
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromISO = (s) => (s ? new Date(`${s}T12:00:00`) : null);
  const label = (s) => { const d = fromISO(s); return d ? `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}` : ""; };

  const pickers = [...document.querySelectorAll("[data-dp]")];
  if (!pickers.length) return;
  let open = null;

  const pop = document.createElement("div");
  pop.className = "dp-pop";
  pop.hidden = true;
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-label", "Choose a date");
  document.body.append(pop);
  let viewYear, viewMonth;

  const partner = (el, kind) => el.parentElement.querySelector(`[data-dp="${kind}"] input`);

  function render() {
    const input = open.querySelector("input");
    const kind = open.dataset.dp;
    const value = input.value;
    const other = kind === "from" ? partner(open, "to")?.value : partner(open, "from")?.value;
    const [rangeFrom, rangeTo] = kind === "from" ? [value, other] : [other, value];
    const today = toISO(new Date());
    const first = new Date(viewYear, viewMonth, 1);
    const start = new Date(first);
    start.setDate(1 - ((first.getDay() + 6) % 7)); // back to Monday

    let cells = "";
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = toISO(d);
      const cls = ["dp-day"];
      if (d.getMonth() !== viewMonth) cls.push("is-out");
      if (iso === today) cls.push("is-today");
      if (iso === value) cls.push("is-selected");
      if (rangeFrom && rangeTo && iso > rangeFrom && iso < rangeTo) cls.push("is-range");
      if ((iso === rangeFrom || iso === rangeTo) && rangeFrom && rangeTo) cls.push("is-edge");
      const disabled = (kind === "to" && other && iso < other) || (kind === "from" && other && iso > other) || iso > today;
      cells += `<button type="button" class="${cls.join(" ")}" data-date="${iso}" ${disabled ? "disabled" : ""} aria-label="${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}"${iso === value ? ' aria-pressed="true"' : ""}>${d.getDate()}</button>`;
    }
    pop.innerHTML = `
      <div class="dp-head">
        <button type="button" class="dp-nav" data-nav="-1" aria-label="Previous month">‹</button>
        <p class="dp-title">${MONTHS[viewMonth]} <span>${viewYear}</span></p>
        <button type="button" class="dp-nav" data-nav="1" aria-label="Next month">›</button>
      </div>
      <div class="dp-week">${DAYS.map((d) => `<span>${d}</span>`).join("")}</div>
      <div class="dp-grid">${cells}</div>
      <div class="dp-foot">
        <button type="button" class="dp-link" data-clear>Clear</button>
        <div class="dp-quick">
          <button type="button" class="dp-chip" data-quick="7">7 days</button>
          <button type="button" class="dp-chip" data-quick="30">30 days</button>
          <button type="button" class="dp-chip" data-quick="0">Today</button>
        </div>
      </div>`;
  }

  function place() {
    const r = open.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let left = Math.min(window.innerWidth - w - 12, Math.max(12, r.left));
    let top = r.bottom + 8;
    if (top + h > window.innerHeight - 12) top = Math.max(12, r.top - h - 8);
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }

  function show(el) {
    open = el;
    const d = fromISO(el.querySelector("input").value) || new Date();
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
    pickers.forEach((p) => p.classList.toggle("is-open", p === el));
    render();
    pop.hidden = false;
    place();
    pop.querySelector(".is-selected, .is-today, .dp-day:not(.is-out)")?.focus({ preventScroll: true });
  }
  function hide() {
    pop.hidden = true;
    pickers.forEach((p) => p.classList.remove("is-open"));
    open?.querySelector(".dp-trigger")?.focus({ preventScroll: true });
    open = null;
  }

  function set(el, iso) {
    const input = el.querySelector("input");
    input.value = iso || "";
    refresh(el);
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function refresh(el) {
    const v = el.querySelector("input").value;
    const span = el.querySelector("[data-dp-label]");
    span.textContent = v ? label(v) : "Select...";
    el.classList.toggle("has-value", Boolean(v));
  }

  pickers.forEach((el) => {
    el.querySelector(".dp-trigger").addEventListener("click", (e) => {
      e.stopPropagation();
      open === el ? hide() : show(el);
    });
    // external resets (e.g. "Clear all") fire "input" on the hidden field
    el.querySelector("input").addEventListener("input", () => refresh(el));
    refresh(el);
  });

  pop.addEventListener("click", (e) => {
    e.stopPropagation();
    const nav = e.target.closest("[data-nav]");
    if (nav) {
      viewMonth += Number(nav.dataset.nav);
      if (viewMonth < 0) { viewMonth = 11; viewYear--; }
      if (viewMonth > 11) { viewMonth = 0; viewYear++; }
      return render();
    }
    const day = e.target.closest("[data-date]");
    if (day && !day.disabled) { set(open, day.dataset.date); return hide(); }
    if (e.target.closest("[data-clear]")) { set(open, ""); return hide(); }
    const quick = e.target.closest("[data-quick]");
    if (quick) {
      const n = Number(quick.dataset.quick);
      const today = new Date();
      const from = new Date(); from.setDate(today.getDate() - n);
      const fromEl = open.parentElement.querySelector('[data-dp="from"]');
      const toEl = open.parentElement.querySelector('[data-dp="to"]');
      if (fromEl && toEl) {
        fromEl.querySelector("input").value = toISO(n ? from : today); refresh(fromEl);
        set(toEl, toISO(today));
      } else set(open, toISO(today));
      return hide();
    }
  });

  document.addEventListener("click", () => { if (open) hide(); });
  document.addEventListener("keydown", (e) => {
    if (!open) return;
    if (e.key === "Escape") return hide();
    const cur = document.activeElement?.closest?.(".dp-day");
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (cur && step) {
      e.preventDefault();
      const d = fromISO(cur.dataset.date); d.setDate(d.getDate() + step);
      const iso = toISO(d);
      if (d.getMonth() !== viewMonth || d.getFullYear() !== viewYear) { viewYear = d.getFullYear(); viewMonth = d.getMonth(); render(); }
      pop.querySelector(`[data-date="${iso}"]`)?.focus();
    }
  });
  window.addEventListener("resize", () => open && place());
  document.addEventListener("scroll", () => open && place(), true);
})();
