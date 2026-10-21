// Content Plan — the member's content plan (adapted from the ASOBAL "organigrama"; the page used to be called "Org").
// Plans (org_plans) with a week view (days × hours) and a month view. Each planned post has a status
// (Idea → Planned → In production → Published), type, copy, private notes and an optional saved post as inspiration
// (with its original link). Every change is saved automatically. A personal "weekly base" of recurring posts shows as
// red placeholders in the week view until each one is planned.
// Posts can also be dropped in from the Content Library's Content Plan panel (js/plan-panel.js), and kept with
// no date as ideas for later ("No date" tray). content-plan.html#entry=<id> opens that entry.
// Only plans with the Content Plan feature (has_planner) can use it (also enforced by RLS). Nothing here touches AI credits.
// Tables: org_plans, org_entries, org_base_slots (supabase/org.sql + billing.sql). Saved posts: js/boards.js.
(() => {
  const root = document.querySelector("[data-org]");
  if (!root) return;
  const db = window.SCP_AUTH?.client;
  const B = window.SCP_BOARDS;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const icon = (n) => (window.SCP_ICONS ? window.SCP_ICONS(n) : "");
  $$("[data-icon]").forEach((el) => (el.outerHTML = icon(el.dataset.icon)));

  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => tx(d));
  const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((d) => tx(d));
  const hh = (h) => `${String(h).padStart(2, "0")}:00`;
  const TIMES = Array.from({ length: 24 }, (_, i) => hh(i));                                      // hour rows 00:00 → 23:00
  const MINUTES = TIMES.flatMap((t) => ["00", "15", "30", "45"].map((m) => `${t.slice(0, 2)}:${m}`)); // times a post can have
  const hourOf = (time) => Number(String(time || "12:00").slice(0, 2));
  // The day (08:00–20:00) is always open; night (00–08) and evening (20–00) fold into one row each and can be opened.
  const BANDS = { night: { from: 0, to: 8, label: "Night", range: "00:00 – 08:00" }, evening: { from: 20, to: 24, label: "Evening", range: "20:00 – 00:00" } };
  const bandOf = (h) => (h < 8 ? "night" : h >= 20 ? "evening" : null);
  let folds = { night: true, evening: true };
  try { folds = { ...folds, ...JSON.parse(localStorage.getItem("scp-plan-folds") || "{}") }; } catch {}
  const saveFolds = () => { try { localStorage.setItem("scp-plan-folds", JSON.stringify(folds)); } catch {} };
  const STATUS = { idea: "Idea", planned: "Planned", in_production: "In production", published: "Published" };
  const TYPES = [
    { key: "post", label: "Post", icon: "image" },
    { key: "carousel", label: "Carousel", icon: "layers" },
    { key: "reel", label: "Reel", icon: "film" },
    { key: "story", label: "Story", icon: "zap" },
    { key: "video", label: "YouTube", icon: "square-play" },
    { key: "tiktok", label: "TikTok", icon: "music-2" },
  ];
  const typeOf = (k) => TYPES.find((t) => t.key === k);

  // ---------- Dates ----------
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const mondayOf = (d) => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7));
  const dow = (d) => (d.getDay() + 6) % 7;
  let view = "week";
  let anchor = mondayOf(new Date());          // week view: Monday; month view: any day of the month
  let mobileDay = dow(new Date());
  const weekDays = () => Array.from({ length: 7 }, (_, i) => addDays(mondayOf(anchor), i));
  function range() {
    if (view === "week") { const m = mondayOf(anchor); return [m, addDays(m, 6)]; }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const start = mondayOf(first);
    return [start, addDays(start, 41)];
  }

  // ---------- Data ----------
  let plans = [], planId = null, entries = [], base = [];
  const inspiration = new Map(); // content idea id -> saved post (Inspiration list)
  const refs = new Map();        // content idea id -> post used as reference by an entry
  const T = window.SCP_THUMB;
  const refOf = (e) => { const id = /^ci-\d+$/.test(e?.inspiration || "") ? Number(e.inspiration.slice(3)) : null; return id ? refs.get(id) || inspiration.get(id) : null; };
  const thumbPost = (p) => p && { id: p.id, url: p.url, media_ratio: p.media_ratio, reel: /reel|video/i.test(p.tags?.format?.[0] || "") || /\/(reel|shorts)\//.test(p.url || "") };
  async function loadRefs() {
    const ids = [...new Set(entries.map((e) => (/^ci-\d+$/.test(e.inspiration || "") ? Number(e.inspiration.slice(3)) : null)).filter((id) => id && !refs.has(id) && !inspiration.has(id)))];
    if (!ids.length) return;
    const { data } = await db.from("content_ideas").select("id,url,title,media_ratio,content_idea_tags(idea_catalog(category,name))").in("id", ids.slice(0, 200));
    for (const row of data || []) {
      const tags = {};
      for (const { idea_catalog: v } of row.content_idea_tags || []) if (v) (tags[v.category] ||= []).push(v.name);
      refs.set(Number(row.id), { ...row, tags, who: tags.club?.[0] || tags.entity?.[0] || "Post" });
    }
  }
  const err = $("[data-org-error]");
  const fail = (e) => {
    const msg = e?.message || String(e);
    err.textContent = /does not exist|schema cache|relation|column/i.test(msg) ? "The Content Plan isn't set up yet — run supabase/org.sql and supabase/billing.sql in Supabase."
      : /row-level security|policy/i.test(msg) ? "Your plan doesn't include the Content Plan." : `Something went wrong: ${msg}`;
    err.hidden = false;
  };

  async function loadPlans() {
    const { data, error } = await db.from("org_plans").select("*").order("created_at");
    if (error) { fail(error); return; }
    plans = data || [];
    if (!plans.length) {
      const { data: created, error: e2 } = await db.from("org_plans").insert({ name: "My plan" }).select().single();
      if (e2) { fail(e2); return; }
      plans = [created];
    }
    let saved = null; try { saved = localStorage.getItem("scp-org-plan"); } catch {}
    planId = plans.some((p) => p.id === saved) ? saved : plans[0].id;
    renderPlans();
  }
  function renderPlans() {
    $("[data-plan]").innerHTML = plans.map((p) => `<option value="${p.id}"${p.id === planId ? " selected" : ""}>${esc(p.name)}</option>`).join("") + `<option value="__rename">Rename this plan…</option>`;
  }
  async function loadEntries() {
    if (!planId) return;
    err.hidden = true;
    const [from, to] = range();
    const [{ data: e, error: e1 }, { data: b, error: e2 }, { data: u, error: e3 }] = await Promise.all([
      db.from("org_entries").select("*").eq("plan_id", planId).gte("entry_date", iso(from)).lte("entry_date", iso(to)).order("created_at"),
      db.from("org_base_slots").select("*").order("day").order("time_slot"),
      db.from("org_entries").select("*").eq("plan_id", planId).is("entry_date", null).order("created_at", { ascending: false }),
    ]);
    if (e1 || e2 || e3) fail(e1 || e2 || e3);
    entries = [...(e || []), ...(u || [])]; base = b || [];
    render();
    await loadRefs();
    render();
  }
  async function create(date, time, extra = {}) {
    const { data, error } = await db.from("org_entries").insert({ plan_id: planId, entry_date: date, time_slot: time, label: "", status: "idea", ...extra }).select().single();
    if (error) { fail(error); return null; }
    entries.push(data);
    render();
    return data;
  }
  const pending = new Map(); // autosave queue per entry
  async function update(id, changes, { silent = false } = {}) {
    const e = entries.find((x) => x.id === id);
    if (e) Object.assign(e, changes);
    if (!silent) render();
    savedState("saving");
    const { error } = await db.from("org_entries").update({ ...changes, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { fail(error); savedState("error"); } else savedState("saved");
  }
  function autosave(id, changes) {
    clearTimeout(pending.get(id));
    savedState("saving");
    pending.set(id, setTimeout(() => { pending.delete(id); update(id, changes, { silent: true }).then(render); }, 600));
  }
  async function remove(id) {
    entries = entries.filter((x) => x.id !== id);
    render();
    const { error } = await db.from("org_entries").delete().eq("id", id);
    if (error) fail(error);
  }

  // ---------- Header ----------
  function renderHeader() {
    const [from, to] = range();
    if (view === "week") {
      const thisWeek = iso(mondayOf(anchor)) === iso(mondayOf(new Date()));
      const diff = Math.round((mondayOf(anchor) - mondayOf(new Date())) / (7 * 864e5));
      $("[data-week-label]").textContent = thisWeek ? "This week" : diff === 1 ? "Next week" : diff === -1 ? "Last week" : `Week of ${from.toLocaleDateString(window.SCP_LOC || "en-GB", { day: "numeric", month: "short" })}`;
      $("[data-week-range]").textContent = `${from.toLocaleDateString(window.SCP_LOC || "en-GB", { day: "numeric", month: "short" })} – ${to.toLocaleDateString(window.SCP_LOC || "en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
    } else {
      $("[data-week-label]").textContent = anchor.toLocaleDateString(window.SCP_LOC || "en-GB", { month: "long", year: "numeric" });
      $("[data-week-range]").textContent = `${entries.filter((e) => e.entry_date && parse(e.entry_date).getMonth() === anchor.getMonth()).length} posts planned`;
    }
    // Weekly base coverage (week view)
    const days = weekDays().map(iso);
    const inWeek = entries.filter((e) => days.includes(e.entry_date));
    const cells = new Map();
    for (const s of base) cells.set(`${s.day}_${s.time_slot}`, (cells.get(`${s.day}_${s.time_slot}`) || 0) + 1);
    let covered = 0;
    for (const [k, n] of cells) { const [d, t] = k.split("_"); covered += Math.min(n, inWeek.filter((e) => e.entry_date === days[Number(d)] && e.time_slot === t).length); }
    const total = base.length, pct = total ? Math.round((covered / total) * 100) : 0;
    $("[data-base-title]").textContent = !total ? "Weekly base · not set up yet" : pct === 100 ? "Weekly base · fully planned ✓" : `Weekly base · ${pct}% planned`;
    $("[data-base-count]").textContent = total ? `${covered} / ${total} planned this week · ${total - covered} to go` : "Add your recurring posts →";
    const fill = $("[data-base-fill]");
    fill.style.width = `${total ? pct : 0}%`;
    fill.className = pct === 100 ? "is-done" : pct >= 60 ? "is-good" : pct >= 30 ? "is-mid" : "is-low";
    const scope = view === "week" ? inWeek : entries.filter((e) => e.entry_date);
    $("[data-legend]").innerHTML = Object.entries(STATUS).map(([k, v]) => `<span class="org-dot org-s-${k}"><i></i>${v}<b>${scope.filter((e) => e.status === k).length}</b></span>`).join("");
    $("[data-mobile-days]").innerHTML = view !== "week" ? "" : weekDays().map((d, i) => `<button type="button" class="${i === mobileDay ? "is-active" : ""}${inWeek.some((e) => e.entry_date === iso(d)) ? " has" : ""}" data-mobile-day="${i}"><span>${DAYS[i]}</span><b>${d.getDate()}</b></button>`).join("");
    $$("[data-view]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === view)));
  }

  // ---------- Render ----------
  function entryHtml(e, compact = false) {
    const t = typeOf(e.content_type);
    const ref = !compact && T ? thumbPost(refOf(e)) : null;
    return `<div class="org-entry org-s-${e.status}${compact ? " is-compact" : ""}${ref ? " has-thumb" : ""}" draggable="true" data-entry="${e.id}" aria-label="${esc(e.label || "Untitled")}">
      ${ref ? T.html(ref, "org-entry-thumb") : ""}
      <div class="org-entry-tools">
        <button type="button" data-dup="${e.id}" aria-label="Duplicate">${icon("copy")}</button>
        <button type="button" data-del="${e.id}" aria-label="Delete">${icon("trash-2")}</button>
      </div>
      <p class="org-entry-title">${compact || !e.time_slot?.endsWith(":00") ? `<span class="org-entry-time">${e.time_slot}</span>` : ""}${e.label ? esc(e.label) : `<span class="org-untitled">Untitled</span>`}</p>
      ${compact ? "" : `<div class="org-entry-meta">
        <span class="org-status-chip">${STATUS[e.status]}</span>
        ${t ? `<span class="org-type">${icon(t.icon)}${t.label}</span>` : ""}
        ${e.copy ? `<span class="org-flag" title="Has copy">${icon("pencil")}</span>` : ""}
        ${e.inspiration ? `<span class="org-flag org-flag-gold" title="Has inspiration">${icon("sparkles")}</span>` : ""}
      </div>`}
    </div>`;
  }
  // Key dates (js/key-dates.js) on their day; each opens its posts in the library
  const keyMark = (date, cls = "org-kd") => {
    const k = window.SCP_KEY_DATES?.on(date);
    return k ? `<a class="${cls}" href="${esc(window.SCP_KEY_DATES.href(k))}" title="${esc(tx("See posts about {name}", { name: tx(k.name) }))}">${icon(k.icon)}<span>${esc(k.name)}</span></a>` : "";
  };
  function renderWeek() {
    const today = iso(new Date());
    const days = weekDays();
    const head = `<thead><tr><th class="org-time-h">Time</th>${days.map((d, i) => `<th class="${iso(d) === today ? "is-today" : ""}${i === mobileDay ? "" : " m-hide"}"><span>${DAYS[i]}</span><b>${d.getDate()}</b>${keyMark(iso(d))}</th>`).join("")}</tr></thead>`;
    const atHour = (date, h) => entries.filter((e) => e.entry_date === date && hourOf(e.time_slot) === h).sort((a, b) => a.time_slot.localeCompare(b.time_slot));
    const hourRow = (t) => `<tr data-hour="${hourOf(t)}"><td class="org-time">${t}</td>${days.map((d, i) => {
      const date = iso(d);
      const cell = atHour(date, hourOf(t));
      const ghosts = base.filter((s) => s.day === i && hourOf(s.time_slot) === hourOf(t)).slice(cell.length);
      return `<td class="org-cell${ghosts.length ? " has-ghost" : ""}${date === today ? " is-today" : ""}${i === mobileDay ? "" : " m-hide"}" data-cell="${date}|${t}" data-drop-label="${DAYS[i]} ${d.getDate()} · ${t}">
        ${cell.map((e) => entryHtml(e)).join("")}
        ${ghosts.map((g) => `<button type="button" class="org-ghost" data-ghost="${g.id}"><b>${esc(g.label)}</b><span>${typeOf(g.content_type)?.label || "Recurring"} · ${g.time_slot} · to plan</span></button>`).join("")}
        <button type="button" class="org-add" data-add aria-label="Add a post on ${DAY_NAMES[i]} at ${t}">${icon("plus")}<span>${t}</span></button>
      </td>`;
    }).join("")}</tr>`;
    // A folded band: one slim row with, per day, a dot per post planned in those hours
    const foldRow = (key) => {
      const b = BANDS[key];
      const inBand = (date) => entries.filter((e) => e.entry_date === date && hourOf(e.time_slot) >= b.from && hourOf(e.time_slot) < b.to);
      const total = days.reduce((n, d) => n + inBand(iso(d)).length, 0);
      const ghostN = base.filter((s) => hourOf(s.time_slot) >= b.from && hourOf(s.time_slot) < b.to).length;
      return `<tr class="org-fold${total ? " has-posts" : ""}" data-fold="${key}"><td class="org-time"><button type="button" data-fold-toggle="${key}" aria-expanded="false" title="Show ${b.range}">${icon(key === "night" ? "chevron-up" : "chevron-down")}<span>${b.label}</span></button></td>
        <td colspan="7" class="org-fold-cell"><button type="button" class="org-fold-btn" data-fold-toggle="${key}">
          <span class="org-fold-days">${days.map((d, i) => `<span class="${i === mobileDay ? "" : "m-hide"}">${inBand(iso(d)).map((e) => `<i class="org-s-${e.status}" title="${esc(e.time_slot)} · ${esc(e.label || "Untitled")}"></i>`).join("")}</span>`).join("")}</span>
          <span class="org-fold-label">${total ? `<b>${total} post${total === 1 ? "" : "s"}</b> ${key === "night" ? "before 08:00" : "this evening"}` : `${b.label} · ${b.range}`}${ghostN ? ` · ${ghostN} recurring` : ""}<em>Show ${b.range}</em></span>
        </button></td></tr>`;
    };
    const openBand = (key) => `<tr class="org-fold-open" data-fold="${key}"><td class="org-time"><button type="button" data-fold-toggle="${key}" aria-expanded="true" title="Hide ${BANDS[key].range}">${icon(key === "night" ? "chevron-down" : "chevron-up")}<span>Hide</span></button></td><td colspan="7" class="org-fold-cell is-open"></td></tr>`;
    const band = (key) => {
      const hours = TIMES.slice(BANDS[key].from, BANDS[key].to);
      if (folds[key]) return foldRow(key);
      return key === "night" ? openBand(key) + hours.map(hourRow).join("") : hours.map(hourRow).join("") + openBand(key);
    };
    $("[data-grid]").innerHTML = head + `<tbody>${band("night")}${TIMES.slice(8, 20).map(hourRow).join("")}${band("evening")}</tbody>`;
    placeNow();
  }
  // Gold "now" line across today's column, at the current minute; moves every minute
  function placeNow() {
    $$(".org-now").forEach((x) => x.remove());
    if (view !== "week") return;
    const now = new Date();
    const cell = $(`[data-cell="${iso(now)}|${hh(now.getHours())}"]`);
    if (!cell) return;
    cell.insertAdjacentHTML("beforeend", `<span class="org-now" style="top:${(now.getMinutes() / 60) * 100}%"><i></i></span>`);
  }
  setInterval(placeNow, 60000);
  // On the first load of the current week, scroll the grid to the current hour (opening its band if needed)
  let scrolledToNow = false;
  function scrollToNow() {
    if (scrolledToNow || view !== "week" || iso(mondayOf(anchor)) !== iso(mondayOf(new Date()))) return;
    scrolledToNow = true;
    const h = new Date().getHours();
    const row = $(`tr[data-hour="${Math.max(0, h - 1)}"]`) || $(`tr[data-fold="${bandOf(h)}"]`);
    const wrap = $("[data-week-view]");
    if (row && wrap) wrap.scrollTo({ top: Math.max(0, row.offsetTop - 60), behavior: "smooth" });
  }

  function renderMonth() {
    const [start] = range();
    const today = iso(new Date());
    const month = anchor.getMonth();
    const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
    $("[data-month-view]").innerHTML = `<div class="org-month-head">${DAYS.map((d) => `<span>${d}</span>`).join("")}</div>
      <div class="org-month-grid">${cells.map((d) => {
        const date = iso(d);
        const list = entries.filter((e) => e.entry_date === date).sort((a, b) => a.time_slot.localeCompare(b.time_slot));
        return `<div class="org-mday${d.getMonth() !== month ? " is-out" : ""}${date === today ? " is-today" : ""}" data-cell="${date}|12:00">
          <span class="org-mday-n">${d.getDate()}</span>${keyMark(date, "org-kd org-kd-m")}
          ${list.slice(0, 4).map((e) => entryHtml(e, true)).join("")}
          ${list.length > 4 ? `<button type="button" class="org-more" data-goto-week="${date}">+${list.length - 4} more</button>` : ""}
          <button type="button" class="org-add" data-add aria-label="Add a post on ${d.toLocaleDateString(window.SCP_LOC || "en-GB")}">${icon("plus")}</button>
        </div>`;
      }).join("")}</div>`;
  }
  function renderUndated() {
    const list = entries.filter((e) => !e.entry_date);
    $("[data-undated]").innerHTML = list.length ? list.map((e) => entryHtml(e)).join("") : `<p class="org-empty">Drop posts here to keep them as ideas without a date.</p>`;
  }
  function render() {
    renderHeader();
    renderUndated();
    $("[data-week-view]").hidden = view !== "week";
    $("[data-month-view]").hidden = view !== "month";
    $(".org-progress").hidden = view !== "week";
    view === "week" ? renderWeek() : renderMonth();
    if (T) requestAnimationFrame(() => T.fit(layout));
    if (view === "week" && base && entries) requestAnimationFrame(scrollToNow);
  }

  // ---------- Interactions (both views) ----------
  const layout = $("[data-layout]");
  layout.addEventListener("click", async (e) => {
    const cellEl = e.target.closest("[data-cell]");
    const [date, t] = cellEl ? cellEl.dataset.cell.split("|").map((x, i) => (i === 0 ? x || null : x)) : [];
    const fold = e.target.closest("[data-fold-toggle]");
    if (fold) { folds[fold.dataset.foldToggle] = !folds[fold.dataset.foldToggle]; saveFolds(); return render(); }
    const del = e.target.closest("[data-del]");
    if (del) return remove(del.dataset.del);
    const dup = e.target.closest("[data-dup]");
    if (dup) {
      const src = entries.find((x) => x.id === dup.dataset.dup);
      const { label, status, content_type, copy, notes, inspiration: insp } = src;
      return create(src.entry_date, src.time_slot, { label, status, content_type, copy, notes, inspiration: insp });
    }
    const more = e.target.closest("[data-goto-week]");
    if (more) { view = "week"; anchor = parse(more.dataset.gotoWeek); mobileDay = dow(anchor); return loadEntries(); }
    const ent = e.target.closest("[data-entry]");
    if (ent) return openEntry(ent.dataset.entry);
    const ghost = e.target.closest("[data-ghost]");
    if (ghost) {
      const g = base.find((s) => s.id === ghost.dataset.ghost);
      const created = await create(date, g.time_slot || t, { label: g.label, content_type: g.content_type, status: "planned" });
      return created && openEntry(created.id);
    }
    if (e.target.closest("[data-add]")) { const created = await create(date, t); return created && openEntry(created.id); }
  });
  layout.addEventListener("dragstart", (e) => {
    const ent = e.target.closest("[data-entry]");
    const insp = !ent && e.target.closest(".org-insp-item");
    if (ent) { e.dataTransfer.setData("text/scp-org-entry", ent.dataset.entry); e.dataTransfer.effectAllowed = "move"; ent.classList.add("is-dragging"); }
    if (insp) { e.dataTransfer.setData("text/scp-inspiration", insp.dataset.insp); e.dataTransfer.effectAllowed = "copy"; }
  });
  layout.addEventListener("dragend", () => $$(".is-dragging").forEach((x) => x.classList.remove("is-dragging")));
  let foldTimer = null;
  layout.addEventListener("dragover", (e) => {
    // Dragging over a folded band opens it after a moment
    const fr = e.target.closest("tr.org-fold");
    if (fr && !foldTimer) foldTimer = setTimeout(() => { foldTimer = null; folds[fr.dataset.fold] = false; saveFolds(); render(); }, 600);
    if (!fr && foldTimer) { clearTimeout(foldTimer); foldTimer = null; }
    const cellEl = e.target.closest("[data-cell]");
    if (!cellEl) return;
    e.preventDefault();
    $$(".is-over").forEach((c) => c !== cellEl && c.classList.remove("is-over"));
    cellEl.classList.add("is-over");
  });
  layout.addEventListener("dragleave", (e) => { const c = e.target.closest("[data-cell]"); if (c && !c.contains(e.relatedTarget)) c.classList.remove("is-over"); });
  layout.addEventListener("drop", async (e) => {
    const cellEl = e.target.closest("[data-cell]");
    if (!cellEl) return;
    e.preventDefault();
    cellEl.classList.remove("is-over");
    const [d0, t] = cellEl.dataset.cell.split("|");
    const date = d0 || null; // "No date" tray
    const moving = e.dataTransfer.getData("text/scp-org-entry");
    if (moving) {
      const src = entries.find((x) => x.id === moving);
      // month view and the tray keep the post's time; week view moves it to the cell's hour
      const changes = { entry_date: date, time_slot: view === "month" || !date ? src.time_slot : `${t.slice(0, 2)}:${(src.time_slot || "00:00").slice(3)}` };
      if (date && src.status === "idea") changes.status = "planned";
      return update(moving, changes);
    }
    const insp = e.dataTransfer.getData("text/scp-inspiration");
    if (insp) {
      const p = inspiration.get(Number(insp));
      const fmt = (p?.tags.format?.[0] || "").toLowerCase();
      const type = /reel|video/.test(fmt) ? "reel" : /carousel/.test(fmt) ? "carousel" : /image/.test(fmt) ? "post" : null;
      const created = await create(date, t, { label: p ? `Our version: ${p.who}` : "", content_type: type, inspiration: `ci-${insp}`, status: date ? "planned" : "idea" });
      return created && openEntry(created.id);
    }
  });

  // ---------- Hover preview: the post and the entry's details (js/post-preview.js) ----------
  window.SCP_PREVIEW?.attach(layout, "[data-entry]", (el) => {
    const e = entries.find((x) => x.id === el.dataset.entry);
    if (!e) return null;
    const ref = refOf(e);
    const d = e.entry_date ? parse(e.entry_date) : null;
    const t = typeOf(e.content_type);
    return {
      post: thumbPost(ref), title: e.label, status: e.status, statusLabel: STATUS[e.status],
      lines: [
        d ? `${DAY_NAMES[dow(d)]} ${d.getDate()} ${d.toLocaleDateString(window.SCP_LOC || "en-GB", { month: "short" })} · ${e.time_slot}` : "No date · idea",
        [t?.label, ref ? `Reference: ${esc(ref.who)}` : ""].filter(Boolean).join(" · "),
      ],
      copy: e.copy, href: ref?.url,
    };
  });

  // ---------- Entry modal (autosave) ----------
  const entryModal = $("[data-entry-modal]");
  const entryPanel = $("[data-entry-panel]");
  let openId = null;
  function savedState(s) {
    const el = $("[data-save-state]", entryPanel);
    if (!el) return;
    el.dataset.state = s;
    el.innerHTML = s === "saving" ? "Saving…" : s === "error" ? "Not saved" : `${icon("check")}Saved`;
  }
  function openEntry(id) {
    const e = entries.find((x) => x.id === id);
    if (!e) return;
    openId = id;
    const inspId = e.inspiration ? Number(e.inspiration.replace(/^ci-/, "")) : null;
    const insp = inspId ? refs.get(inspId) || inspiration.get(inspId) : null;
    const d = e.entry_date ? parse(e.entry_date) : null;
    entryPanel.innerHTML = `
      <header class="org-m-head">
        <span class="org-m-icon">${icon(typeOf(e.content_type)?.icon || "layout-grid")}</span>
        <div><input class="org-m-title" type="text" maxlength="140" placeholder="What are you posting?" value="${esc(e.label)}" data-f="label">
        <p class="org-m-when">${window.SCP_DATE ? window.SCP_DATE.button(e.entry_date, 'aria-label="Date"') : ""}
          ${window.SCP_TIME ? window.SCP_TIME.button(e.time_slot, 'data-f-time aria-label="Time"') : ""}
          <span class="org-saved" data-save-state data-state="saved">${icon("check")}Saved</span></p></div>
        <button class="org-m-x" type="button" aria-label="Close" data-close>${icon("x")}</button>
      </header>
      <div class="org-m-body">
        <p class="org-m-label">Status</p>
        <div class="org-m-status">${Object.entries(STATUS).map(([k, v]) => `<button type="button" class="org-s-${k}" aria-pressed="${e.status === k}" data-f-status="${k}"><i></i>${v}</button>`).join("")}</div>
        <p class="org-m-label">Type</p>
        <div class="org-m-types">${TYPES.map((t) => `<button type="button" aria-pressed="${e.content_type === t.key}" data-f-type="${t.key}">${icon(t.icon)}<span>${t.label}</span></button>`).join("")}</div>
        <p class="org-m-label">Copy <span data-copy-count>${(e.copy || "").length}</span></p>
        <textarea class="org-m-copy" rows="5" maxlength="5000" placeholder="Write the caption for this post…" data-f="copy">${esc(e.copy || "")}</textarea>
        <p class="org-m-label">Notes <span>only you see these</span></p>
        <textarea class="org-m-copy org-m-notes" rows="3" maxlength="5000" placeholder="Ideas, assets needed, who's filming, approvals…" data-f="notes">${esc(e.notes || "")}</textarea>
        ${e.inspiration ? `<p class="org-m-label">Inspiration</p>
        <div class="org-m-insp">${T && insp ? T.html(thumbPost(insp), "org-m-thumb") : icon("sparkles")}<div><b>${esc(insp?.who || "Saved post")}</b><span>${esc([insp?.tags.format?.[0], insp?.tags.sport?.[0]].filter(Boolean).join(" · "))}</span></div>
          ${insp?.url ? `<a class="pill pill-dark" href="${esc(insp.url)}" target="_blank" rel="noopener">Original ${icon("external-link")}</a>` : ""}
          <a class="pill pill-dark" href="content-library.html#post=${inspId}" target="_blank" rel="noopener">View reference</a>
          <button class="org-m-unlink" type="button" data-f-unlink aria-label="Remove inspiration">${icon("x")}</button></div>` : ""}
      </div>
      <footer class="org-m-foot">
        <button class="pill org-m-del" type="button" data-f-delete>${icon("trash-2")}Delete</button>
        <button class="btn btn-gold" type="button" data-close>Done</button>
      </footer>`;
    entryModal.hidden = false;
    if (T) requestAnimationFrame(() => T.fit(entryPanel));
    setTimeout(() => !e.label && $("[data-f=label]", entryPanel).focus(), 30);
  }
  function closeEntry() {
    window.SCP_TIME?.close(); window.SCP_DATE?.close();
    if (!openId) return;
    for (const [id, timer] of pending) { clearTimeout(timer); pending.delete(id); const e = entries.find((x) => x.id === id); if (e) update(id, { label: e.label, copy: e.copy, notes: e.notes }, { silent: true }); }
    entryModal.hidden = true; openId = null; render();
  }
  entryModal.addEventListener("input", (ev) => {
    const f = ev.target.dataset.f;
    if (!f || !openId) return;
    const e = entries.find((x) => x.id === openId);
    e[f] = ev.target.value;
    if (f === "copy") $("[data-copy-count]", entryPanel).textContent = ev.target.value.length;
    autosave(openId, { [f]: ev.target.value });
  });
  // Time picker (js/time-picker.js): saves as soon as a time is chosen; opens night / evening if the post moves there
  // Date picker (js/date-picker.js): a date makes an idea "Planned"; "No date" sends it to the tray
  window.SCP_DATE?.attach(entryModal, async (date) => {
    if (!openId) return;
    const e = entries.find((x) => x.id === openId);
    const changes = { entry_date: date, ...(date && e?.status === "idea" ? { status: "planned" } : {}) };
    await update(openId, changes, { silent: true });
    openEntry(openId);
    $("[data-date-btn]", entryPanel)?.focus();
  }, {
    counts: async (from, to) => {
      const { data } = await db.from("org_entries").select("entry_date").eq("plan_id", planId).gte("entry_date", from).lte("entry_date", to);
      const m = new Map();
      for (const r of data || []) m.set(r.entry_date, (m.get(r.entry_date) || 0) + 1);
      return m;
    },
  });
  window.SCP_TIME?.attach(entryModal, (value) => {
    if (!openId) return;
    const band = bandOf(hourOf(value));
    if (band && folds[band]) { folds[band] = false; saveFolds(); }
    update(openId, { time_slot: value }, { silent: true });
  });
  entryModal.addEventListener("change", async (ev) => {
    if (!openId) return;


  });
  entryModal.addEventListener("click", async (ev) => {
    if (ev.target === entryModal || ev.target.closest("[data-close]")) return closeEntry();
    const e = entries.find((x) => x.id === openId);
    if (!e) return;
    const st = ev.target.closest("[data-f-status]");
    if (st) { $$("[data-f-status]", entryPanel).forEach((b) => b.setAttribute("aria-pressed", String(b === st))); return update(e.id, { status: st.dataset.fStatus }, { silent: true }); }
    const ty = ev.target.closest("[data-f-type]");
    if (ty) {
      const val = e.content_type === ty.dataset.fType ? null : ty.dataset.fType;
      $$("[data-f-type]", entryPanel).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.fType === val)));
      $(".org-m-icon", entryPanel).innerHTML = icon(typeOf(val)?.icon || "layout-grid");
      return update(e.id, { content_type: val }, { silent: true });
    }
    if (ev.target.closest("[data-f-unlink]")) { await update(e.id, { inspiration: null }, { silent: true }); return openEntry(e.id); }
    if (ev.target.closest("[data-f-delete]")) { entryModal.hidden = true; openId = null; return remove(e.id); }
  });

  // ---------- Weekly base modal ----------
  const baseModal = $("[data-base-modal]");
  const basePanel = $("[data-base-panel]");
  window.SCP_TIME?.attach(baseModal, (value, btn) => { const input = btn.parentElement.querySelector("[name=time]"); if (input) input.value = value; });
  function renderBase() {
    const byDay = DAYS.map((_, d) => base.filter((s) => s.day === d));
    basePanel.innerHTML = `
      <header class="org-m-head">
        <span class="org-m-icon">${icon("repeat")}</span>
        <div><p class="org-m-h">Weekly base</p><p>Your recurring posts. Every week they appear in red in your plan until you plan them.</p></div>
        <button class="org-m-x" type="button" aria-label="Close" data-close>${icon("x")}</button>
      </header>
      <div class="org-m-body">
        <form class="org-base-form" data-base-form>
          <select name="day" aria-label="Day">${DAY_NAMES.map((n, i) => `<option value="${i}">${n}</option>`).join("")}</select>
          <span class="org-base-time">${window.SCP_TIME ? window.SCP_TIME.button("12:00", 'aria-label="Time"') : ""}<input type="hidden" name="time" value="12:00"></span>
          <select name="type" aria-label="Type"><option value="">Any type</option>${TYPES.map((t) => `<option value="${t.key}">${t.label}</option>`).join("")}</select>
          <input name="label" type="text" maxlength="140" placeholder="e.g. Matchday recap reel" required aria-label="Post">
          <button class="btn btn-gold" type="submit">${icon("plus")}Add</button>
        </form>
        <div class="org-base-list">
          ${base.length ? byDay.map((list, d) => list.length ? `<div class="org-base-day"><p>${DAY_NAMES[d]}</p>${list.map((s) => `
            <div class="org-base-item"><span class="org-base-time">${s.time_slot}</span><b>${esc(s.label)}</b>${typeOf(s.content_type) ? `<span class="org-type">${icon(typeOf(s.content_type).icon)}${typeOf(s.content_type).label}</span>` : ""}
            <button type="button" data-base-del="${s.id}" aria-label="Remove">${icon("trash-2")}</button></div>`).join("")}</div>` : "").join("")
          : `<p class="org-empty">No recurring posts yet. Add the formats you publish every week (matchday graphic, weekly recap, sponsor post…).</p>`}
        </div>
      </div>`;
  }
  const openBase = () => { renderBase(); baseModal.hidden = false; };
  $("[data-edit-base]").addEventListener("click", openBase);
  $(".org-progress").addEventListener("click", openBase);
  baseModal.addEventListener("click", async (ev) => {
    if (ev.target === baseModal || ev.target.closest("[data-close]")) { baseModal.hidden = true; return render(); }
    const del = ev.target.closest("[data-base-del]");
    if (del) {
      const { error } = await db.from("org_base_slots").delete().eq("id", del.dataset.baseDel);
      if (error) return fail(error);
      base = base.filter((s) => s.id !== del.dataset.baseDel);
      renderBase();
    }
  });
  baseModal.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    const row = { day: Number(f.day.value), time_slot: f.time.value, label: f.label.value.trim(), content_type: f.type.value || null };
    if (!row.label) return;
    const { data, error } = await db.from("org_base_slots").insert(row).select().single();
    if (error) { baseModal.hidden = true; return fail(error); }
    base.push(data);
    base.sort((a, b) => a.day - b.day || a.time_slot.localeCompare(b.time_slot));
    renderBase();
    $("[name=label]", basePanel).focus();
  });

  // ---------- Inspiration: saved boards first, then the posts inside a board (newest saved first) ----------
  let inspBoard = null; // null = list of boards, "all" = every saved post, or a board id
  try { inspBoard = localStorage.getItem("scp-plan-board") || null; } catch {}
  let inspQuery = "";
  async function loadInspiration() {
    if (!B) return;
    await B.load();
    const ids = [...new Set(B.itemsOf().map((it) => Number(it.post_id.replace(/^ci-/, ""))).filter(Boolean))];
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await db.from("content_ideas").select("id,url,title,published_at,media_ratio,unavailable_at,content_idea_tags(idea_catalog(category,name))").in("id", ids.slice(i, i + 200));
      for (const row of data || []) {
        if (row.unavailable_at) continue;
        const tags = {};
        for (const { idea_catalog: v } of row.content_idea_tags || []) if (v) (tags[v.category] ||= []).push(v.name);
        inspiration.set(Number(row.id), { ...row, tags, who: tags.club?.[0] || tags.entity?.[0] || "Post" });
      }
    }
    if (inspBoard && inspBoard !== "all" && !B.boards.some((b) => b.id === inspBoard)) inspBoard = null;
    renderInspiration();
  }
  // Saved posts of a board, newest saved first (each post once)
  function postsOfBoard(boardId) {
    const seen = new Set();
    return B.itemsOf(boardId === "all" ? null : boardId)
      .slice().sort((a, b) => String(b.added_at).localeCompare(String(a.added_at)))
      .map((it) => ({ p: inspiration.get(Number(it.post_id.replace(/^ci-/, ""))), added: it.added_at }))
      .filter(({ p }) => p && !seen.has(p.id) && seen.add(p.id));
  }
  const shortDate = (v) => (v ? new Date(v).toLocaleDateString(window.SCP_LOC || "en-GB", { day: "numeric", month: "short" }) : "");
  function renderInspiration() {
    const list = $("[data-insp-list]");
    if (!B.itemsOf().length) { list.innerHTML = `<p class="org-empty">Save posts in the <a href="content-library.html">Content Library</a> and drag them here to plan your version.</p>`; return; }
    if (!inspBoard) {
      const boardRow = (id, name, posts, extra = "") => `
        <button type="button" class="org-board${extra}" data-board="${id}">
          <span class="org-board-cover">${posts.slice(0, 3).map(({ p }) => T ? T.html(thumbPost(p), "org-board-thumb") : "").join("") || icon("bookmark")}</span>
          <span class="org-board-txt"><b>${esc(name)}</b><small>${posts.length} post${posts.length === 1 ? "" : "s"}${posts[0] ? ` · last saved ${shortDate(posts[0].added)}` : ""}</small></span>
          ${icon("chevron-right")}
        </button>`;
      list.innerHTML = boardRow("all", "All saved posts", postsOfBoard("all"), " is-all")
        + B.boards.map((b) => ({ b, posts: postsOfBoard(b.id) }))
          .sort((x, y) => String(y.posts[0]?.added || "").localeCompare(String(x.posts[0]?.added || "")))
          .map(({ b, posts }) => boardRow(b.id, b.name, posts)).join("");
    } else {
      const name = inspBoard === "all" ? "All saved posts" : B.boards.find((b) => b.id === inspBoard)?.name || "Board";
      const q = inspQuery.trim().toLowerCase();
      const posts = postsOfBoard(inspBoard).filter(({ p }) => !q || `${p.who} ${p.title || ""} ${Object.values(p.tags).flat().join(" ")}`.toLowerCase().includes(q));
      list.innerHTML = `
        <div class="org-board-head">
          <button type="button" class="org-board-back" data-board-back aria-label="Back to your boards">${icon("chevron-left")}</button>
          <div><b>${esc(name)}</b><small>${posts.length} post${posts.length === 1 ? "" : "s"} · newest saved first</small></div>
        </div>
        <label class="org-board-search">${icon("search")}<input type="search" placeholder="Search this board…" value="${esc(inspQuery)}" data-insp-q></label>
        ${posts.map(({ p, added }) => `
          <div class="org-insp-item" draggable="true" data-insp="${p.id}">
            ${T ? T.html(thumbPost(p), "org-insp-thumb") : `<span class="org-insp-grip">${icon("grip-vertical")}</span>`}
            <div><b>${esc(p.who)}</b><span>${esc([p.tags.format?.[0], p.tags.sport?.[0]].filter(Boolean).join(" · "))}</span>
              <small class="org-insp-date">Saved ${shortDate(added)}${p.published_at ? ` · posted ${shortDate(p.published_at)}` : ""}</small>
              ${p.title ? `<p>${esc(p.title.slice(0, 90))}</p>` : ""}</div>
            ${p.url ? `<a class="org-insp-link" href="${esc(p.url)}" target="_blank" rel="noopener" aria-label="Open the original post" draggable="false">${icon("external-link")}</a>` : ""}
          </div>`).join("") || `<p class="org-empty">${q ? "No posts match your search." : "This board is empty."}</p>`}`;
    }
    if (T) requestAnimationFrame(() => T.fit(list));
  }
  const inspList = $("[data-insp-list]");
  inspList.addEventListener("click", (e) => {
    const b = e.target.closest("[data-board]");
    if (b) { inspBoard = b.dataset.board; inspQuery = ""; try { localStorage.setItem("scp-plan-board", inspBoard); } catch {} renderInspiration(); inspList.scrollTop = 0; return; }
    if (e.target.closest("[data-board-back]")) { inspBoard = null; inspQuery = ""; try { localStorage.removeItem("scp-plan-board"); } catch {} renderInspiration(); }
  });
  window.SCP_PREVIEW?.attach(inspList, ".org-insp-item", (el) => {
    const p = inspiration.get(Number(el.dataset.insp));
    return p && { post: thumbPost(p), title: p.who, lines: [[p.tags.format?.[0], p.tags.sport?.[0]].filter(Boolean).map(esc).join(" · "), p.published_at ? `Posted ${shortDate(p.published_at)}` : ""], copy: p.title, href: p.url };
  });
  inspList.addEventListener("input", (e) => {
    if (!e.target.matches("[data-insp-q]")) return;
    inspQuery = e.target.value;
    const pos = e.target.selectionStart;
    renderInspiration();
    const input = $("[data-insp-q]", inspList); input.focus(); input.setSelectionRange(pos, pos);
  });
  $("[data-toggle-insp]").addEventListener("click", () => layout.classList.toggle("insp-hidden"));

  // ---------- Download: PDF (print), Excel (.xlsx), calendar (.ics) of the week / month on screen ----------
  const dlMenu = $("[data-dl-menu]");
  const dlToggle = $("[data-dl-toggle]");
  const setDl = (open) => { dlMenu.hidden = !open; dlToggle.setAttribute("aria-expanded", String(open)); };
  dlToggle.addEventListener("click", () => {
    $("[data-dl-scope]").textContent = `${view === "week" ? $("[data-week-label]").textContent : anchor.toLocaleDateString(window.SCP_LOC || "en-GB", { month: "long", year: "numeric" })} · ${plans.find((p) => p.id === planId)?.name || "My plan"}`;
    setDl(dlMenu.hidden);
  });
  document.addEventListener("mousedown", (e) => { if (!dlMenu.hidden && !e.target.closest(".org-dl")) setDl(false); });
  dlMenu.addEventListener("click", (e) => {
    const b = e.target.closest("[data-dl]");
    if (!b) return;
    setDl(false);
    const data = exportData($("[data-dl-ideas]").checked);
    if (!data.dated.length && !data.ideas.length) return alert("There's nothing planned in this period yet.");
    ({ pdf: exportPdf, xlsx: exportXlsx, ics: exportIcs })[b.dataset.dl](data);
  });
  function exportData(withIdeas) {
    const [from, to] = view === "week" ? range() : [new Date(anchor.getFullYear(), anchor.getMonth(), 1), new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)];
    const byTime = (a, b) => (a.entry_date || "").localeCompare(b.entry_date || "") || a.time_slot.localeCompare(b.time_slot);
    const dated = entries.filter((e) => e.entry_date && e.entry_date >= iso(from) && e.entry_date <= iso(to)).sort(byTime);
    const ideas = withIdeas ? entries.filter((e) => !e.entry_date).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))) : [];
    const plan = plans.find((p) => p.id === planId)?.name || "My plan";
    const period = view === "week" ? `${from.toLocaleDateString(window.SCP_LOC || "en-GB", { day: "numeric", month: "short" })} – ${to.toLocaleDateString(window.SCP_LOC || "en-GB", { day: "numeric", month: "short", year: "numeric" })}` : anchor.toLocaleDateString(window.SCP_LOC || "en-GB", { month: "long", year: "numeric" });
    const slug = `content-plan-${plan}-${iso(from)}`.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return { from, to, dated, ideas, plan, period, slug };
  }
  const refInfo = (e) => {
    const r = refOf(e);
    const id = /^ci-\d+$/.test(e.inspiration || "") ? e.inspiration.slice(3) : null;
    return { who: r?.who || "", url: r?.url || "", library: id ? new URL(`content-library.html#post=${id}`, location.href).href : "" };
  };
  const longDay = (date) => { const d = parse(date); return `${DAY_NAMES[dow(d)]} ${d.getDate()} ${d.toLocaleDateString(window.SCP_LOC || "en-GB", { month: "long" })}`; };
  function download(name, blob) {
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  // PDF: a clean light document in a new tab, opened with the print dialog (Save as PDF)
  function exportPdf({ from, to, dated, ideas, plan, period, slug }) {
    const win = window.open("", "_blank");
    if (!win) return alert("Allow pop-ups for this site to download the PDF.");
    const COLORS = { idea: "#8b98ae", planned: "#4d7fe0", in_production: "#d99a1b", published: "#12a150" };
    const item = (e) => {
      const r = refInfo(e);
      return `<div class="e" style="--c:${COLORS[e.status] || "#999"}">
        <div class="t">${e.entry_date ? e.time_slot : "—"}</div>
        <div class="b"><div class="h"><b>${esc(e.label || "Untitled")}</b><span class="s">${STATUS[e.status] || ""}</span>${typeOf(e.content_type) ? `<span class="k">${typeOf(e.content_type).label}</span>` : ""}</div>
          ${e.copy ? `<p class="c">${esc(e.copy)}</p>` : ""}
          ${e.notes ? `<p class="n"><i>Notes:</i> ${esc(e.notes)}</p>` : ""}
          ${r.who || r.url ? `<p class="r">Reference: ${esc(r.who || "post")}${r.url ? ` · <a href="${esc(r.url)}">${esc(r.url)}</a>` : ""}</p>` : ""}</div></div>`;
    };
    const days = [];
    for (let d = new Date(from); d <= to; d = addDays(d, 1)) days.push(iso(d));
    const shownDays = view === "week" ? days : days.filter((d) => dated.some((e) => e.entry_date === d));
    const counts = Object.entries(STATUS).map(([k, v]) => `<span style="--c:${COLORS[k]}"><i></i>${v} ${dated.filter((e) => e.status === k).length}</span>`).join("");
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(slug)}</title>
      <link href="${new URL("css/fonts.css", location.href).href}" rel="stylesheet">
      <style>
        @page { size: A4; margin: 14mm 12mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { margin: 0; font: 11px/1.45 Inter, system-ui, sans-serif; color: #121b33; }
        header { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 12px; border-bottom: 2px solid #f0b84a; margin-bottom: 14px; }
        .brand { font: 600 10px Inter; letter-spacing: .12em; text-transform: uppercase; color: #b07d14; }
        h1 { margin: 4px 0 0; font: 700 22px "Host Grotesk", sans-serif; }
        .period { font-size: 12px; color: #4b5872; margin-top: 2px; }
        .legend { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; font-size: 10px; color: #4b5872; }
        .legend i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--c); margin-right: 4px; }
        .day { break-inside: avoid; margin-bottom: 10px; border: 1px solid #e3e7ef; border-radius: 10px; overflow: hidden; }
        .day h2 { margin: 0; padding: 7px 12px; font: 600 12px "Host Grotesk", sans-serif; background: #f5f7fb; border-bottom: 1px solid #e3e7ef; }
        .empty { padding: 8px 12px; color: #98a2b3; font-style: italic; }
        .e { display: flex; gap: 12px; padding: 8px 12px; border-left: 3px solid var(--c); break-inside: avoid; }
        .e + .e { border-top: 1px solid #eef1f6; }
        .t { width: 38px; flex: none; font-weight: 600; color: #4b5872; font-variant-numeric: tabular-nums; }
        .b { flex: 1; min-width: 0; }
        .h { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .h b { font-size: 12px; }
        .s { padding: 1px 7px; border-radius: 10px; font-size: 9px; font-weight: 600; color: #fff; background: var(--c); }
        .k { font-size: 10px; color: #4b5872; }
        .c { margin: 4px 0 0; white-space: pre-line; }
        .n { margin: 3px 0 0; color: #4b5872; white-space: pre-line; }
        .r { margin: 3px 0 0; font-size: 10px; color: #4b5872; word-break: break-all; }
        a { color: #4d7fe0; }
        footer { margin-top: 16px; font-size: 9px; color: #98a2b3; text-align: center; }
      </style></head><body>
      <header><div><div class="brand"><img src="${new URL("assets/logo-scp.png", location.href).href}" alt="Sports Content Playbook" style="height:34px;display:block;margin-bottom:6px">Content Plan</div><h1>${esc(plan)}</h1><div class="period">${esc(period)} · ${dated.length} post${dated.length === 1 ? "" : "s"} planned</div></div><div class="legend">${counts}</div></header>
      ${shownDays.map((d) => { const list = dated.filter((e) => e.entry_date === d); return `<section class="day"><h2>${longDay(d)}</h2>${list.length ? list.map(item).join("") : `<div class="empty">Nothing planned</div>`}</section>`; }).join("")}
      ${ideas.length ? `<section class="day"><h2>No date · ideas for later (${ideas.length})</h2>${ideas.map(item).join("")}</section>` : ""}
      <footer>Downloaded ${new Date().toLocaleString(window.SCP_LOC || "en-GB", { dateStyle: "medium", timeStyle: "short" })} · sportscontentplaybook</footer>
      <script>document.fonts.ready.then(() => setTimeout(() => print(), 250));<\/script>
    </body></html>`);
    win.document.close();
  }

  // Excel (.xlsx) with SheetJS, loaded only when needed
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise((ok, ko) => {
      const sc = Object.assign(document.createElement("script"), { src: "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js", onload: () => ok(window.XLSX), onerror: ko });
      document.head.append(sc);
    });
  }
  async function exportXlsx({ dated, ideas, plan, period, slug }) {
    let X;
    try { X = await loadXlsx(); } catch { return alert("Couldn't load the Excel exporter. Check your connection and try again."); }
    const row = (e) => {
      const r = refInfo(e);
      const d = e.entry_date ? parse(e.entry_date) : null;
      // Excel dates are written in UTC: build the date at UTC midnight so it doesn't shift a day back
      return { Date: d ? new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) : "", Day: d ? DAY_NAMES[dow(d)] : "No date", Time: e.entry_date ? e.time_slot : "", Post: e.label || "", Status: STATUS[e.status] || "", Type: typeOf(e.content_type)?.label || "", Copy: e.copy || "", Notes: e.notes || "", Reference: r.who, "Original post": r.url, "In SCP": r.library };
    };
    const ws = X.utils.json_to_sheet([...dated, ...ideas].map(row), { cellDates: true, dateNF: "dd/mm/yyyy" });
    ws["!cols"] = [12, 11, 7, 38, 13, 10, 50, 36, 22, 40, 40].map((w) => ({ wch: w }));
    ws["!autofilter"] = { ref: ws["!ref"] };
    const wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, ws, "Content Plan");
    wb.Props = { Title: `${plan} · ${period}`, Author: "Sports Content Playbook" };
    X.writeFile(wb, `${slug}.xlsx`);
  }

  // Calendar (.ics): one 30-minute event per dated post; imports into Google Calendar, Outlook, Apple Calendar
  function exportIcs({ dated, plan, slug }) {
    if (!dated.length) return alert("Only posts with a date go into the calendar, and there are none in this period.");
    const txt = (v) => String(v || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
    const fold = (line) => { const out = []; let l = line; while (l.length > 74) { out.push(l.slice(0, 74)); l = " " + l.slice(74); } out.push(l); return out.join("\r\n"); };
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Sports Content Playbook//Content Plan//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${txt(`SCP · ${plan}`)}`];
    for (const e of dated) {
      const r = refInfo(e);
      const start = `${e.entry_date.replace(/-/g, "")}T${e.time_slot.replace(":", "")}00`;
      const desc = [`Status: ${STATUS[e.status] || ""}`, typeOf(e.content_type) ? `Type: ${typeOf(e.content_type).label}` : "", e.copy ? `\nCopy:\n${e.copy}` : "", e.notes ? `\nNotes:\n${e.notes}` : "", r.url ? `\nReference: ${r.who} ${r.url}` : ""].filter(Boolean).join("\n");
      lines.push("BEGIN:VEVENT", `UID:${e.id}@sportscontentplaybook`, `DTSTAMP:${stamp}`, `DTSTART:${start}`, "DURATION:PT30M",
        `SUMMARY:${txt(`${typeOf(e.content_type) ? `[${typeOf(e.content_type).label}] ` : ""}${e.label || "Post"}`)}`, `DESCRIPTION:${txt(desc)}`,
        ...(r.url ? [`URL:${r.url}`] : []), `CATEGORIES:${txt(STATUS[e.status] || "Post")}`, "END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    download(`${slug}.ics`, new Blob([lines.map(fold).join("\r\n") + "\r\n"], { type: "text/calendar;charset=utf-8" }));
  }

  // ---------- Plans, views, navigation ----------
  $("[data-plan]").addEventListener("change", async (e) => {
    if (e.target.value === "__rename") {
      const cur = plans.find((p) => p.id === planId);
      const name = window.prompt("Plan name", cur?.name || "")?.trim();
      if (name) { const { error } = await db.from("org_plans").update({ name }).eq("id", planId); if (error) fail(error); else cur.name = name; }
      return renderPlans();
    }
    planId = e.target.value;
    try { localStorage.setItem("scp-org-plan", planId); } catch {}
    loadEntries();
  });
  $("[data-new-plan]").addEventListener("click", async () => {
    const name = window.prompt("Name of the new plan (e.g. Pre-season, Kit launch, Women's team)")?.trim();
    if (!name) return;
    const { data, error } = await db.from("org_plans").insert({ name }).select().single();
    if (error) return fail(error);
    plans.push(data); planId = data.id;
    try { localStorage.setItem("scp-org-plan", planId); } catch {}
    renderPlans(); loadEntries();
  });
  root.addEventListener("click", (e) => {
    const v = e.target.closest("[data-view]");
    if (v) { view = v.dataset.view; return loadEntries(); }
    const w = e.target.closest("[data-week]");
    if (w) {
      const n = Number(w.dataset.week);
      if (n === 0) anchor = view === "week" ? mondayOf(new Date()) : new Date();
      else anchor = view === "week" ? addDays(mondayOf(anchor), 7 * n) : new Date(anchor.getFullYear(), anchor.getMonth() + n, 1);
      return loadEntries();
    }
    const md = e.target.closest("[data-mobile-day]");
    if (md) { mobileDay = Number(md.dataset.mobileDay); render(); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!entryModal.hidden) closeEntry();
    if (!baseModal.hidden) { baseModal.hidden = true; render(); }
  });

  // ---------- Start: only plans with the Content Plan ----------
  (async () => {
    if (!db) return fail(new Error("not connected"));
    const { data: ent, error } = await window.SCP_entitlements();
    if (error && !/schema cache|does not exist/i.test(error.message)) return fail(error);
    if (ent && !ent.has_planner) { const g = $("[data-gate] .btn"); if (g) { g.href = window.SCP_upgradeHref("planner", ent.plan); g.textContent = (window.tx ? window.tx("Get the Content Plan") : "Get the Content Plan"); } $("[data-gate]").hidden = false; $("[data-planner]").hidden = true; $(".org-controls").hidden = true; return; }
    await loadPlans();
    await openFromHash() || await loadEntries();
    loadInspiration();
  })();
  // content-plan.html#entry=<id> (from the Content Library panel): go to that entry's plan and week and open it
  async function openFromHash() {
    const id = /^#entry=([\w-]+)$/.exec(location.hash)?.[1];
    if (!id) return false;
    history.replaceState(null, "", location.pathname + location.search);
    const { data: e } = await db.from("org_entries").select("id,plan_id,entry_date").eq("id", id).maybeSingle();
    if (!e) return false;
    if (e.plan_id && e.plan_id !== planId && plans.some((p) => p.id === e.plan_id)) { planId = e.plan_id; try { localStorage.setItem("scp-org-plan", planId); } catch {} renderPlans(); }
    if (e.entry_date) { view = "week"; anchor = mondayOf(parse(e.entry_date)); mobileDay = dow(parse(e.entry_date)); }
    await loadEntries();
    openEntry(id);
    return true;
  }
  window.addEventListener("hashchange", () => openFromHash());
})();
