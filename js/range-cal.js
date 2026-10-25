// One calendar for a date range: first click = start, second click = end (hover previews the range),
// a third click starts again. Writes YYYY-MM-DD into the hidden inputs [data-from] / [data-to] of its container
// and fires "change" on them (bubbling), like js/datepicker.js did with two calendars.
// Markup: <div data-rcal><input type="hidden" data-from><input type="hidden" data-to></div>
(() => {
  const t = (s) => (window.tx ? window.tx(s) : s);
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(t);
  const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map(t);
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => (s ? new Date(`${s}T12:00:00`) : null);
  const short = (s) => { const d = parse(s); return d ? `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}${d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ""}` : ""; };

  document.querySelectorAll("[data-rcal]").forEach((box) => {
    const from = box.querySelector("[data-from]"), to = box.querySelector("[data-to]");
    const today = iso(new Date());
    let view = parse(from.value) || new Date();
    view = new Date(view.getFullYear(), view.getMonth(), 1);
    let hover = null;
    const ui = document.createElement("div");
    ui.className = "rcal";
    box.append(ui);

    function set(a, b) {
      from.value = a || ""; to.value = b || "";
      to.dispatchEvent(new Event("change", { bubbles: true }));   // one event: the library reloads once
      draw();
    }
    function draw() {
      const a = from.value, b = to.value || (a && hover && hover >= a ? hover : "");
      const first = new Date(view.getFullYear(), view.getMonth(), 1);
      const lead = (first.getDay() + 6) % 7;
      const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
      let cells = "";
      for (let i = 0; i < lead; i++) cells += "<span></span>";
      for (let d = 1; d <= days; d++) {
        const k = iso(new Date(view.getFullYear(), view.getMonth(), d));
        const cls = [k === a && "is-start", k === (to.value || "") && "is-end", a && b && k > a && k < b && "is-in", !to.value && hover && k === b && "is-end is-preview",
          k === today && "is-today", k > today && "is-future"].filter(Boolean).join(" ");
        cells += `<button type="button" class="${cls}" data-day="${k}"${k > today ? " disabled" : ""}>${d}</button>`;
      }
      ui.innerHTML = `
        <div class="rcal-sum"><span>${a ? `<b>${short(a)}</b> → ${to.value ? `<b>${short(to.value)}</b>` : `<i>${t("pick the end date")}</i>` }` : `<i>${t("Pick the start date")}</i>`}</span>
          ${a ? `<button type="button" class="rcal-clear" data-clear>${t("Clear")}</button>` : ""}</div>
        <div class="rcal-head"><button type="button" data-nav="-1" aria-label="${t("Previous month")}">‹</button><b>${MONTHS[view.getMonth()]} ${view.getFullYear()}</b>
          <button type="button" data-nav="1" aria-label="${t("Next month")}"${new Date(view.getFullYear(), view.getMonth() + 1, 1) > new Date() ? " disabled" : ""}>›</button></div>
        <div class="rcal-grid">${DAYS.map((x) => `<small>${x}</small>`).join("")}${cells}</div>`;
    }
    ui.addEventListener("click", (e) => {
      e.stopPropagation();
      const nav = e.target.closest("[data-nav]");
      if (nav) { view = new Date(view.getFullYear(), view.getMonth() + Number(nav.dataset.nav), 1); return draw(); }
      if (e.target.closest("[data-clear]")) { hover = null; return set("", ""); }
      const day = e.target.closest("[data-day]")?.dataset.day;
      if (!day) return;
      if (!from.value || to.value) { hover = null; return set(day, ""); }     // start (or start again)
      if (day < from.value) return set(day, "");                              // earlier than the start: new start
      hover = null; set(from.value, day);                                       // end
    });
    ui.addEventListener("mouseover", (e) => {
      const day = e.target.closest("[data-day]")?.dataset.day;
      if (from.value && !to.value && day !== hover) { hover = day || null; draw(); }
    });
    draw();
  });
})();
