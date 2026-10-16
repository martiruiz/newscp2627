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

  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const TIMES = Array.from({ length: 15 }, (_, i) => `${String(i + 8).padStart(2, "0")}:00`); // 08:00 → 22:00
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
      $("[data-week-label]").textContent = thisWeek ? "This week" : diff === 1 ? "Next week" : diff === -1 ? "Last week" : `Week of ${from.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
      $("[data-week-range]").textContent = `${from.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${to.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
    } else {
      $("[data-week-label]").textContent = anchor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
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
    return `<div class="org-entry org-s-${e.status}${compact ? " is-compact" : ""}${ref ? " has-thumb" : ""}" draggable="true" data-entry="${e.id}" title="${esc(e.label || "Untitled")}">
      ${ref ? T.html(ref, "org-entry-thumb") : ""}
      <div class="org-entry-tools">
        <button type="button" data-dup="${e.id}" aria-label="Duplicate">${icon("copy")}</button>
        <button type="button" data-del="${e.id}" aria-label="Delete">${icon("trash-2")}</button>
      </div>
      <p class="org-entry-title">${compact ? `<span class="org-entry-time">${e.time_slot}</span>` : ""}${e.label ? esc(e.label) : `<span class="org-untitled">Untitled</span>`}</p>
      ${compact ? "" : `<div class="org-entry-meta">
        <span class="org-status-chip">${STATUS[e.status]}</span>
        ${t ? `<span class="org-type">${icon(t.icon)}${t.label}</span>` : ""}
        ${e.copy ? `<span class="org-flag" title="Has copy">${icon("pencil")}</span>` : ""}
        ${e.inspiration ? `<span class="org-flag org-flag-gold" title="Has inspiration">${icon("sparkles")}</span>` : ""}
      </div>`}
    </div>`;
  }
  function renderWeek() {
    const today = iso(new Date());
    const days = weekDays();
    const head = `<thead><tr><th class="org-time-h">Time</th>${days.map((d, i) => `<th class="${iso(d) === today ? "is-today" : ""}${i === mobileDay ? "" : " m-hide"}"><span>${DAYS[i]}</span><b>${d.getDate()}</b></th>`).join("")}</tr></thead>`;
    const rows = TIMES.map((t) => `<tr><td class="org-time">${t}</td>${days.map((d, i) => {
      const date = iso(d);
      const cell = entries.filter((e) => e.entry_date === date && e.time_slot === t);
      const ghosts = base.filter((s) => s.day === i && s.time_slot === t).slice(cell.length);
      return `<td class="org-cell${ghosts.length ? " has-ghost" : ""}${i === mobileDay ? "" : " m-hide"}" data-cell="${date}|${t}">
        ${cell.map((e) => entryHtml(e)).join("")}
        ${ghosts.map((g) => `<button type="button" class="org-ghost" data-ghost="${g.id}"><b>${esc(g.label)}</b><span>${typeOf(g.content_type)?.label || "Recurring"} · to plan</span></button>`).join("")}
        <button type="button" class="org-add" data-add aria-label="Add a post on ${DAY_NAMES[i]} at ${t}">${icon("plus")}</button>
      </td>`;
    }).join("")}</tr>`).join("");
    $("[data-grid]").innerHTML = head + `<tbody>${rows}</tbody>`;
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
          <span class="org-mday-n">${d.getDate()}</span>
          ${list.slice(0, 4).map((e) => entryHtml(e, true)).join("")}
          ${list.length > 4 ? `<button type="button" class="org-more" data-goto-week="${date}">+${list.length - 4} more</button>` : ""}
          <button type="button" class="org-add" data-add aria-label="Add a post on ${d.toLocaleDateString("en-GB")}">${icon("plus")}</button>
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
  }

  // ---------- Interactions (both views) ----------
  const layout = $("[data-layout]");
  layout.addEventListener("click", async (e) => {
    const cellEl = e.target.closest("[data-cell]");
    const [date, t] = cellEl ? cellEl.dataset.cell.split("|").map((x, i) => (i === 0 ? x || null : x)) : [];
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
      const created = await create(date, t, { label: g.label, content_type: g.content_type, status: "planned" });
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
  layout.addEventListener("dragover", (e) => {
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
      const changes = { entry_date: date, time_slot: view === "month" || !date ? src.time_slot : t };
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
        <p><label class="org-m-date">${icon("calendar-days")}<input type="date" value="${e.entry_date || ""}" data-f-date aria-label="Date"></label>${d ? `<span class="org-m-dayname">${DAY_NAMES[dow(d)]}</span>` : `<span class="org-m-dayname">No date · idea</span>`}
          · <select class="org-m-time" data-f-time aria-label="Time">${TIMES.map((t) => `<option${t === e.time_slot ? " selected" : ""}>${t}</option>`).join("")}</select>
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
  entryModal.addEventListener("change", async (ev) => {
    if (!openId) return;
    if (ev.target.matches("[data-f-time]")) update(openId, { time_slot: ev.target.value }, { silent: true });
    if (ev.target.matches("[data-f-date]")) {
      const e = entries.find((x) => x.id === openId);
      const date = ev.target.value || null;
      const changes = { entry_date: date, ...(date && e?.status === "idea" ? { status: "planned" } : {}) };
      await update(openId, changes, { silent: true });
      openEntry(openId);
    }
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
          <select name="time" aria-label="Time">${TIMES.map((t) => `<option${t === "12:00" ? " selected" : ""}>${t}</option>`).join("")}</select>
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

  // ---------- Inspiration (saved posts) ----------
  async function loadInspiration() {
    const list = $("[data-insp-list]");
    if (!B) return;
    await B.load();
    const ids = [...new Set(B.itemsOf().map((it) => Number(it.post_id.replace(/^ci-/, ""))).filter(Boolean))];
    if (!ids.length) { list.innerHTML = `<p class="org-empty">Save posts in the <a href="content-library.html">Content Library</a> and drag them here to plan your version.</p>`; return; }
    const { data } = await db.from("content_ideas").select("id,url,title,unavailable_at,content_idea_tags(idea_catalog(category,name))").in("id", ids.slice(0, 200));
    for (const row of data || []) {
      if (row.unavailable_at) continue;
      const tags = {};
      for (const { idea_catalog: v } of row.content_idea_tags || []) if (v) (tags[v.category] ||= []).push(v.name);
      inspiration.set(Number(row.id), { ...row, tags, who: tags.club?.[0] || tags.entity?.[0] || "Post" });
    }
    list.innerHTML = [...inspiration.values()].map((p) => `
      <div class="org-insp-item" draggable="true" data-insp="${p.id}">
        <span class="org-insp-grip">${icon("grip-vertical")}</span>
        <div><b>${esc(p.who)}</b><span>${esc([p.tags.format?.[0], p.tags.sport?.[0]].filter(Boolean).join(" · "))}</span>${p.title ? `<p>${esc(p.title.slice(0, 90))}</p>` : ""}</div>
        ${p.url ? `<a class="org-insp-link" href="${esc(p.url)}" target="_blank" rel="noopener" aria-label="Open the original post" draggable="false">${icon("external-link")}</a>` : ""}
      </div>`).join("");
  }
  $("[data-toggle-insp]").addEventListener("click", () => layout.classList.toggle("insp-hidden"));

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
    const { data: ent, error } = await db.rpc("my_entitlements");
    if (error && !/schema cache|does not exist/i.test(error.message)) return fail(error);
    if (ent && !ent.has_planner) { $("[data-gate]").hidden = false; $("[data-planner]").hidden = true; $(".org-controls").hidden = true; return; }
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
