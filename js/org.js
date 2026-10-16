// Org — weekly content planner (adapted from the ASOBAL "organigrama").
// Week grid (days × hours) of planned posts with status, type, copy and an optional Content Library post as
// inspiration. A personal "weekly base" of recurring posts shows as red placeholders until each one is planned.
// Tables: org_entries, org_base_slots (supabase/org.sql). Saved posts come from the member's boards (js/boards.js).
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
  const STATUS = {
    todo: { label: "To do" },
    in_progress: { label: "In progress" },
    done: { label: "Done" },
    not_done: { label: "Not done" },
  };
  const TYPES = [
    { key: "post", label: "Post", icon: "image" },
    { key: "carousel", label: "Carousel", icon: "layers" },
    { key: "reel", label: "Reel", icon: "film" },
    { key: "story", label: "Story", icon: "zap" },
    { key: "video", label: "YouTube", icon: "square-play" },
    { key: "tiktok", label: "TikTok", icon: "music-2" },
  ];
  const typeOf = (k) => TYPES.find((t) => t.key === k);

  // ---------- Week ----------
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const mondayOf = (d) => { const m = new Date(d.getFullYear(), d.getMonth(), d.getDate()); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return m; };
  let week = mondayOf(new Date());
  const dayDate = (i) => { const d = new Date(week); d.setDate(week.getDate() + i); return d; };
  let mobileDay = (new Date().getDay() + 6) % 7;

  // ---------- Data ----------
  let entries = [];
  let base = [];
  let inspiration = new Map(); // content idea id -> post
  const err = $("[data-org-error]");
  const fail = (e) => {
    const msg = e?.message || String(e);
    err.textContent = /does not exist|schema cache|relation/i.test(msg) ? "The planner isn't set up yet — run supabase/org.sql in Supabase." : `Something went wrong: ${msg}`;
    err.hidden = false;
  };

  async function loadWeek() {
    err.hidden = true;
    const [{ data: e, error: e1 }, { data: b, error: e2 }] = await Promise.all([
      db.from("org_entries").select("*").eq("week_start", iso(week)).order("created_at"),
      db.from("org_base_slots").select("*").order("day").order("time_slot"),
    ]);
    if (e1 || e2) { entries = []; base = []; fail(e1 || e2); }
    else { entries = e || []; base = b || []; }
    render();
  }
  async function create(day, time, extra = {}) {
    const { data, error } = await db.from("org_entries").insert({ week_start: iso(week), day, time_slot: time, label: "", status: "todo", ...extra }).select().single();
    if (error) { fail(error); return null; }
    entries.push(data);
    render();
    return data;
  }
  async function update(id, changes) {
    const e = entries.find((x) => x.id === id);
    if (e) Object.assign(e, changes);
    render();
    const { error } = await db.from("org_entries").update({ ...changes, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) fail(error);
  }
  async function remove(id) {
    entries = entries.filter((x) => x.id !== id);
    render();
    const { error } = await db.from("org_entries").delete().eq("id", id);
    if (error) fail(error);
  }

  // ---------- Header ----------
  function renderHeader() {
    const end = dayDate(6);
    const thisWeek = iso(week) === iso(mondayOf(new Date()));
    const diff = Math.round((week - mondayOf(new Date())) / (7 * 864e5));
    $("[data-week-label]").textContent = thisWeek ? "This week" : diff === 1 ? "Next week" : diff === -1 ? "Last week" : `Week of ${week.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
    $("[data-week-range]").textContent = `${week.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
    // Weekly base coverage
    const cells = new Map();
    for (const s of base) cells.set(`${s.day}_${s.time_slot}`, (cells.get(`${s.day}_${s.time_slot}`) || 0) + 1);
    let covered = 0;
    for (const [k, n] of cells) { const [d, t] = k.split("_"); covered += Math.min(n, entries.filter((e) => e.day === Number(d) && e.time_slot === t).length); }
    const total = base.length;
    const pct = total ? Math.round((covered / total) * 100) : 0;
    $("[data-base-title]").textContent = !total ? "Weekly base · not set up yet" : pct === 100 ? "Weekly base · fully planned ✓" : `Weekly base · ${pct}% planned`;
    $("[data-base-count]").textContent = total ? `${covered} / ${total} planned · ${total - covered} to go` : "Add your recurring posts →";
    const fill = $("[data-base-fill]");
    fill.style.width = `${total ? pct : 0}%`;
    fill.className = pct === 100 ? "is-done" : pct >= 60 ? "is-good" : pct >= 30 ? "is-mid" : "is-low";
    // Legend with counts
    $("[data-legend]").innerHTML = Object.entries(STATUS).map(([k, v]) => `<span class="org-dot org-s-${k}"><i></i>${v.label}<b>${entries.filter((e) => e.status === k).length}</b></span>`).join("");
    // Mobile day selector
    $("[data-mobile-days]").innerHTML = DAYS.map((d, i) => `<button type="button" class="${i === mobileDay ? "is-active" : ""}${entries.some((e) => e.day === i) ? " has" : ""}" data-mobile-day="${i}"><span>${d}</span><b>${dayDate(i).getDate()}</b></button>`).join("");
  }

  // ---------- Grid ----------
  function entryHtml(e) {
    const t = typeOf(e.content_type);
    return `<div class="org-entry org-s-${e.status}" draggable="true" data-entry="${e.id}" title="${esc(e.label || "Untitled")}">
      <div class="org-entry-tools">
        <button type="button" data-dup="${e.id}" aria-label="Duplicate">${icon("copy")}</button>
        <button type="button" data-del="${e.id}" aria-label="Delete">${icon("trash-2")}</button>
      </div>
      <p class="org-entry-title">${e.label ? esc(e.label) : `<span class="org-untitled">Untitled</span>`}</p>
      <div class="org-entry-meta">
        ${t ? `<span class="org-type">${icon(t.icon)}${t.label}</span>` : ""}
        ${e.copy ? `<span class="org-flag" title="Has copy">${icon("pencil")}</span>` : ""}
        ${e.inspiration ? `<span class="org-flag org-flag-gold" title="Has inspiration">${icon("sparkles")}</span>` : ""}
      </div>
    </div>`;
  }
  function render() {
    renderHeader();
    const today = iso(new Date());
    const baseIn = (d, t) => base.filter((s) => s.day === d && s.time_slot === t);
    const head = `<thead><tr><th class="org-time-h">Time</th>${DAYS.map((d, i) => {
      const date = dayDate(i);
      return `<th class="${iso(date) === today ? "is-today" : ""}${i === mobileDay ? "" : " m-hide"}"><span>${d}</span><b>${date.getDate()}</b></th>`;
    }).join("")}</tr></thead>`;
    const rows = TIMES.map((t) => `<tr><td class="org-time">${t}</td>${DAYS.map((_, d) => {
      const cell = entries.filter((e) => e.day === d && e.time_slot === t);
      const ghosts = baseIn(d, t).slice(cell.length);
      return `<td class="org-cell${ghosts.length ? " has-ghost" : ""}${d === mobileDay ? "" : " m-hide"}" data-cell="${d}|${t}">
        ${cell.map(entryHtml).join("")}
        ${ghosts.map((g) => `<button type="button" class="org-ghost" data-ghost="${g.id}"><b>${esc(g.label)}</b><span>${typeOf(g.content_type)?.label || "Recurring"} · to plan</span></button>`).join("")}
        <button type="button" class="org-add" data-add aria-label="Add a post on ${DAY_NAMES[d]} at ${t}">${icon("plus")}</button>
      </td>`;
    }).join("")}</tr>`).join("");
    $("[data-grid]").innerHTML = head + `<tbody>${rows}</tbody>`;
  }

  // ---------- Grid interactions ----------
  const grid = $("[data-grid]");
  grid.addEventListener("click", async (e) => {
    const cellEl = e.target.closest("[data-cell]");
    const [d, t] = cellEl ? cellEl.dataset.cell.split("|") : [];
    const del = e.target.closest("[data-del]");
    if (del) return remove(del.dataset.del);
    const dup = e.target.closest("[data-dup]");
    if (dup) {
      const src = entries.find((x) => x.id === dup.dataset.dup);
      const { label, status, content_type, copy, inspiration: insp } = src;
      return create(src.day, src.time_slot, { label, status, content_type, copy, inspiration: insp });
    }
    const ent = e.target.closest("[data-entry]");
    if (ent) return openEntry(ent.dataset.entry);
    const ghost = e.target.closest("[data-ghost]");
    if (ghost) {
      const g = base.find((s) => s.id === ghost.dataset.ghost);
      const created = await create(Number(d), t, { label: g.label, content_type: g.content_type });
      return created && openEntry(created.id);
    }
    if (e.target.closest("[data-add]")) {
      const created = await create(Number(d), t);
      return created && openEntry(created.id);
    }
  });
  // Drag: move entries between cells, or drop a saved post (inspiration) to plan it
  grid.addEventListener("dragstart", (e) => {
    const ent = e.target.closest("[data-entry]");
    if (!ent) return;
    e.dataTransfer.setData("text/scp-org-entry", ent.dataset.entry);
    e.dataTransfer.effectAllowed = "move";
    ent.classList.add("is-dragging");
  });
  grid.addEventListener("dragend", () => $$(".is-dragging").forEach((x) => x.classList.remove("is-dragging")));
  grid.addEventListener("dragover", (e) => {
    const cellEl = e.target.closest("[data-cell]");
    if (!cellEl) return;
    e.preventDefault();
    $$(".org-cell.is-over").forEach((c) => c !== cellEl && c.classList.remove("is-over"));
    cellEl.classList.add("is-over");
  });
  grid.addEventListener("dragleave", (e) => { const c = e.target.closest("[data-cell]"); if (c && !c.contains(e.relatedTarget)) c.classList.remove("is-over"); });
  grid.addEventListener("drop", async (e) => {
    const cellEl = e.target.closest("[data-cell]");
    if (!cellEl) return;
    e.preventDefault();
    cellEl.classList.remove("is-over");
    const [d, t] = cellEl.dataset.cell.split("|");
    const moving = e.dataTransfer.getData("text/scp-org-entry");
    if (moving) return update(moving, { day: Number(d), time_slot: t });
    const insp = e.dataTransfer.getData("text/scp-inspiration");
    if (insp) {
      const p = inspiration.get(Number(insp));
      const fmt = (p?.tags.format?.[0] || "").toLowerCase();
      const type = /reel|video/.test(fmt) ? "reel" : /carousel/.test(fmt) ? "carousel" : /image/.test(fmt) ? "post" : null;
      const created = await create(Number(d), t, { label: p ? `Idea: ${p.who}` : "", content_type: type, inspiration: `ci-${insp}` });
      return created && openEntry(created.id);
    }
  });

  // ---------- Entry modal ----------
  const entryModal = $("[data-entry-modal]");
  const entryPanel = $("[data-entry-panel]");
  let openId = null;
  function openEntry(id) {
    const e = entries.find((x) => x.id === id);
    if (!e) return;
    openId = id;
    const insp = e.inspiration ? inspiration.get(Number(e.inspiration.replace(/^ci-/, ""))) : null;
    entryPanel.innerHTML = `
      <header class="org-m-head">
        <span class="org-m-icon">${icon(typeOf(e.content_type)?.icon || "layout-grid")}</span>
        <div><input class="org-m-title" type="text" maxlength="140" placeholder="What are you posting?" value="${esc(e.label)}" data-f-label>
        <p>${DAY_NAMES[e.day]} ${dayDate(e.day).getDate()} ${dayDate(e.day).toLocaleDateString("en-GB", { month: "short" })} · ${e.time_slot}</p></div>
        <button class="org-m-x" type="button" aria-label="Close" data-close>${icon("x")}</button>
      </header>
      <div class="org-m-body">
        <p class="org-m-label">Status</p>
        <div class="org-m-status">${Object.entries(STATUS).map(([k, v]) => `<button type="button" class="org-s-${k}" aria-pressed="${e.status === k}" data-f-status="${k}"><i></i>${v.label}</button>`).join("")}</div>
        <p class="org-m-label">Type</p>
        <div class="org-m-types">${TYPES.map((t) => `<button type="button" aria-pressed="${e.content_type === t.key}" data-f-type="${t.key}">${icon(t.icon)}<span>${t.label}</span></button>`).join("")}</div>
        <p class="org-m-label">Copy <span data-copy-count>${(e.copy || "").length}</span></p>
        <textarea class="org-m-copy" rows="6" maxlength="5000" placeholder="Write the caption for this post…" data-f-copy>${esc(e.copy || "")}</textarea>
        ${e.inspiration ? `<p class="org-m-label">Inspiration</p>
        <div class="org-m-insp">${icon("sparkles")}<div><b>${esc(insp?.who || "Saved post")}</b><span>${esc([insp?.tags.format?.[0], insp?.tags.sport?.[0]].filter(Boolean).join(" · "))}</span></div>
          <a class="pill pill-dark" href="content-library.html#post=${esc(e.inspiration.replace(/^ci-/, ""))}" target="_blank" rel="noopener">View ${icon("external-link")}</a>
          <button class="org-m-unlink" type="button" data-f-unlink aria-label="Remove inspiration">${icon("x")}</button></div>` : ""}
      </div>
      <footer class="org-m-foot">
        <button class="pill org-m-del" type="button" data-f-delete>${icon("trash-2")}Delete</button>
        <button class="btn btn-gold" type="button" data-close>Save</button>
      </footer>`;
    entryModal.hidden = false;
    setTimeout(() => !e.label && $("[data-f-label]", entryPanel).focus(), 30);
  }
  async function closeEntry() {
    if (!openId) return;
    const e = entries.find((x) => x.id === openId);
    const label = $("[data-f-label]", entryPanel)?.value.trim() ?? "";
    const copy = $("[data-f-copy]", entryPanel)?.value ?? "";
    entryModal.hidden = true;
    const id = openId; openId = null;
    if (e && (label !== e.label || copy !== (e.copy || ""))) await update(id, { label, copy });
  }
  entryModal.addEventListener("click", async (ev) => {
    if (ev.target === entryModal || ev.target.closest("[data-close]")) return closeEntry();
    const e = entries.find((x) => x.id === openId);
    if (!e) return;
    const st = ev.target.closest("[data-f-status]");
    if (st) { await update(e.id, { status: st.dataset.fStatus }); $$("[data-f-status]", entryPanel).forEach((b) => b.setAttribute("aria-pressed", String(b === st))); return; }
    const ty = ev.target.closest("[data-f-type]");
    if (ty) {
      const val = e.content_type === ty.dataset.fType ? null : ty.dataset.fType;
      await update(e.id, { content_type: val });
      $$("[data-f-type]", entryPanel).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.fType === val)));
      $(".org-m-icon", entryPanel).innerHTML = icon(typeOf(val)?.icon || "layout-grid");
      return;
    }
    if (ev.target.closest("[data-f-unlink]")) { await update(e.id, { inspiration: null }); return openEntry(e.id); }
    if (ev.target.closest("[data-f-delete]")) { entryModal.hidden = true; openId = null; return remove(e.id); }
  });
  entryModal.addEventListener("input", (ev) => { if (ev.target.matches("[data-f-copy]")) $("[data-copy-count]", entryPanel).textContent = ev.target.value.length; });

  // ---------- Weekly base modal ----------
  const baseModal = $("[data-base-modal]");
  const basePanel = $("[data-base-panel]");
  function renderBase() {
    const byDay = DAYS.map((_, d) => base.filter((s) => s.day === d));
    basePanel.innerHTML = `
      <header class="org-m-head">
        <span class="org-m-icon">${icon("repeat")}</span>
        <div><p class="org-m-h">Weekly base</p><p>Your recurring posts. Every week they appear in red in the planner until you plan them.</p></div>
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
  $("[data-edit-base]").addEventListener("click", () => { renderBase(); baseModal.hidden = false; });
  $(".org-progress").addEventListener("click", () => { renderBase(); baseModal.hidden = false; });
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
      </div>`).join("");
    render();
  }
  $("[data-insp-list]").addEventListener("dragstart", (e) => {
    const it = e.target.closest("[data-insp]");
    if (!it) return;
    e.dataTransfer.setData("text/scp-inspiration", it.dataset.insp);
    e.dataTransfer.effectAllowed = "copy";
  });
  $("[data-toggle-insp]").addEventListener("click", () => $("[data-layout]").classList.toggle("insp-hidden"));

  // ---------- Week + mobile navigation ----------
  root.addEventListener("click", (e) => {
    const w = e.target.closest("[data-week]");
    if (w) {
      const n = Number(w.dataset.week);
      week = n === 0 ? mondayOf(new Date()) : (() => { const d = new Date(week); d.setDate(d.getDate() + 7 * n); return d; })();
      return loadWeek();
    }
    const md = e.target.closest("[data-mobile-day]");
    if (md) { mobileDay = Number(md.dataset.mobileDay); render(); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!entryModal.hidden) closeEntry();
    if (!baseModal.hidden) { baseModal.hidden = true; render(); }
  });

  if (!db) return fail(new Error("not connected"));
  loadWeek();
  loadInspiration();
})();
