// Content Plan side panel inside the Content Library.
// Open it from the "Content Plan" button: the member's plan for the week (or month) sits next to the posts, and any post
// can be dragged onto a day (or onto "No date" to keep it as an idea). Shift+click or the grip selects several posts to
// drag at once. "+" under each card adds it to a day from a mini calendar (works on touch screens too).
// "Fill my week" proposes posts from the member's favourite profiles / sports for the empty days.
// Entries are rows of org_entries with the post as inspiration ("ci-<id>"), like the full Content Plan page.
// Only plans with the Content Plan feature can use it (my_entitlements.has_planner, also enforced by RLS).
(() => {
  const lib = document.querySelector("[data-library]");
  const db = window.SCP_AUTH?.client;
  const toggleBtn = document.querySelector("[data-plan-toggle]");
  if (!lib || !db || !toggleBtn) return;
  const T = window.SCP_THUMB;
  const icon = (n) => (window.SCP_ICONS ? window.SCP_ICONS(n) : "");
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => tx(d));
  const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((d) => tx(d));
  const STATUS = { idea: "Idea", planned: "Planned", in_production: "In production", published: "Published" };
  const TYPE_ICON = { post: "image", carousel: "layers", reel: "film", story: "zap", video: "square-play", tiktok: "music-2" };
  const COLS = "id,plan_id,entry_date,time_slot,label,status,content_type,copy,notes,inspiration";

  // ---------- Dates ----------
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const mondayOf = (d) => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7));
  const dow = (d) => (d.getDay() + 6) % 7;
  const fmtDay = (date) => { const d = parse(date); return `${DAY_NAMES[dow(d)]} ${d.getDate()} ${d.toLocaleDateString(window.SCP_LOC || "en-GB", { month: "short" })}`; };
  const monthGrid = (anchor) => { const start = mondayOf(new Date(anchor.getFullYear(), anchor.getMonth(), 1)); return Array.from({ length: 42 }, (_, i) => addDays(start, i)); };

  // ---------- State ----------
  const S = {
    open: false, ready: null, ent: null, plans: [], planId: null,
    view: store.get("scp-pp-view") === "month" ? "month" : "week", anchor: mondayOf(new Date()),
    entries: [], refs: new Map(), selected: new Set(), suggest: null,
  };
  const allowed = () => !S.ent || S.ent.has_planner;
  const range = () => {
    if (S.view === "week") { const m = mondayOf(S.anchor); return [m, addDays(m, 6)]; }
    const g = monthGrid(S.anchor); return [g[0], g[41]];
  };
  const dated = () => S.entries.filter((e) => e.entry_date);
  const undated = () => S.entries.filter((e) => !e.entry_date);

  // ---------- Posts: what we know about each one (from the library, or fetched) ----------
  const nameOf = (p, c) => { const v = p.tags?.[c]?.[0]; return (typeof v === "string" ? v : v?.name) || ""; };
  const pretty = (s) => String(s || "").replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  function norm(p) {
    const fmt = nameOf(p, "format");
    return {
      id: Number(p.id), url: p.url, media_ratio: p.media_ratio, cover: p.cover_url || null,
      reel: /^(reels?|shorts?|video)$/i.test(fmt) || /\/(reel|shorts)\//.test(p.url || ""),
      who: pretty(nameOf(p, "club") || nameOf(p, "competition") || nameOf(p, "entity")) || "Post",
      format: pretty(fmt),
    };
  }
  const postInfo = (id) => S.refs.get(Number(id)) || (window.SCP_LIB?.post(id) ? norm(window.SCP_LIB.post(id)) : null);
  const refId = (e) => (/^ci-\d+$/.test(e?.inspiration || "") ? Number(e.inspiration.slice(3)) : null);
  const typeFor = (fmt) => { const f = (fmt || "").toLowerCase(); return /reel|video/.test(f) ? "reel" : /carousel/.test(f) ? "carousel" : /image|photo|post/.test(f) ? "post" : null; };
  async function loadRefs(ids) {
    const missing = [];
    for (const id of new Set(ids.filter(Boolean))) {
      if (S.refs.has(id)) continue;
      const p = window.SCP_LIB?.post(id);
      if (p) S.refs.set(id, norm(p)); else missing.push(id);
    }
    if (!missing.length) return;
    const { data } = await db.from("content_ideas").select("id,url,media_ratio,cover_url,content_idea_tags(idea_catalog(category,name))").in("id", missing.slice(0, 200));
    for (const row of data || []) {
      const tags = {};
      for (const { idea_catalog: v } of row.content_idea_tags || []) if (v) (tags[v.category] ||= []).push({ name: v.name });
      S.refs.set(Number(row.id), norm({ ...row, tags }));
    }
  }

  // ---------- Data ----------
  function ready() {
    S.ready ||= (async () => {
      const { data: ent, error } = await db.rpc("my_entitlements");
      if (!error) S.ent = ent;
      if (!allowed()) return;
      const { data, error: e1 } = await db.from("org_plans").select("id,name").order("created_at");
      if (e1) throw e1;
      S.plans = data || [];
      if (!S.plans.length) {
        const { data: created, error: e2 } = await db.from("org_plans").insert({ name: "My plan" }).select("id,name").single();
        if (e2) throw e2;
        S.plans = [created];
      }
      const saved = store.get("scp-org-plan");
      S.planId = S.plans.some((p) => p.id === saved) ? saved : S.plans[0].id;
    })().catch((e) => { S.ready = null; throw e; });
    return S.ready;
  }
  async function loadEntries() {
    const [from, to] = range();
    const [a, b] = await Promise.all([
      db.from("org_entries").select(COLS).eq("plan_id", S.planId).gte("entry_date", iso(from)).lte("entry_date", iso(to)).order("time_slot").order("created_at"),
      db.from("org_entries").select(COLS).eq("plan_id", S.planId).is("entry_date", null).order("created_at", { ascending: false }).limit(40),
    ]);
    if (a.error || b.error) throw a.error || b.error;
    S.entries = [...(a.data || []), ...(b.data || [])];
    await loadRefs(S.entries.map(refId));
  }
  // Creates one entry per post. Returns the created rows (or null on error).
  async function addPosts(ids, date, planId = S.planId) {
    await loadRefs(ids);
    const rows = ids.map((id) => {
      const p = postInfo(id);
      return {
        plan_id: planId, entry_date: date || null, time_slot: "12:00", status: date ? "planned" : "idea",
        label: (p ? `Idea: ${p.who}${p.format ? ` · ${p.format}` : ""}` : "Idea from the library").slice(0, 140),
        content_type: typeFor(p?.format), inspiration: `ci-${id}`,
      };
    });
    const { data, error } = await db.from("org_entries").insert(rows).select(COLS);
    if (error) { toast(errText(error)); return null; }
    if (planId === S.planId) {
      const [from, to] = range();
      for (const e of data) if (!e.entry_date || (e.entry_date >= iso(from) && e.entry_date <= iso(to))) S.entries.push(e);
      render(data.map((e) => e.id));
    }
    clearSelection();
    const where = date ? fmtDay(date) : "No date";
    const planName = planId !== S.planId ? ` in “${S.plans.find((p) => p.id === planId)?.name || "your plan"}”` : "";
    toast(`${data.length === 1 ? "Added" : `${data.length} posts added`} to ${where}${planName}`, "Undo", async () => {
      const { error: e } = await db.from("org_entries").delete().in("id", data.map((x) => x.id));
      if (e) return toast(errText(e));
      S.entries = S.entries.filter((x) => !data.some((d) => d.id === x.id));
      render();
      toast("Undone.");
    });
    return data;
  }
  async function moveEntry(id, date) {
    const e = S.entries.find((x) => x.id === id);
    if (!e || e.entry_date === (date || null)) return;
    const before = { entry_date: e.entry_date, status: e.status };
    const changes = { entry_date: date || null, ...(date && e.status === "idea" ? { status: "planned" } : {}) };
    Object.assign(e, changes);
    const [from, to] = range();
    if (date && (date < iso(from) || date > iso(to))) S.entries = S.entries.filter((x) => x !== e);
    render([id]);
    const { error } = await db.from("org_entries").update({ ...changes, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { Object.assign(e, before); toast(errText(error)); return render(); }
    toast(`Moved to ${date ? fmtDay(date) : "No date"}`);
  }
  async function deleteEntry(id) {
    const e = S.entries.find((x) => x.id === id);
    if (!e) return;
    S.entries = S.entries.filter((x) => x !== e);
    render();
    const { error } = await db.from("org_entries").delete().eq("id", id);
    if (error) { S.entries.push(e); render(); return toast(errText(error)); }
    toast("Removed from your plan", "Undo", async () => {
      const { error: e2 } = await db.from("org_entries").insert(e);
      if (e2) return toast(errText(e2));
      S.entries.push(e); render([e.id]);
    });
  }
  const errText = (e) => {
    const m = e?.message || String(e);
    return /row-level security|policy/i.test(m) ? "Your plan doesn't include the Content Plan." : /does not exist|schema cache/i.test(m) ? "The Content Plan isn't set up yet." : m;
  };

  // ---------- Panel ----------
  const panel = document.createElement("aside");
  panel.className = "pp";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Content Plan");
  lib.append(panel);
  let collapsedByUs = false;

  async function open() {
    S.open = true;
    panel.hidden = false;
    lib.classList.add("plan-open");
    toggleBtn.setAttribute("aria-pressed", "true");
    store.set("scp-pp-open", "1");
    // On laptop screens, make room for the posts by folding the filters (restored on close)
    if (innerWidth > 960 && innerWidth < 1320 && !lib.classList.contains("filters-collapsed")) { $("[data-collapse]")?.click(); collapsedByUs = true; }
    syncCards();
    panel.innerHTML = `<div class="pp-loading"><span class="ai-spinner"></span></div>`;
    try { await ready(); if (allowed()) await loadEntries(); render(); }
    catch (e) { panel.innerHTML = `${headHtml()}<p class="pp-error">${esc(errText(e))}</p>`; }
  }
  function close() {
    S.open = false;
    panel.hidden = true;
    lib.classList.remove("plan-open");
    toggleBtn.setAttribute("aria-pressed", "false");
    store.set("scp-pp-open", "");
    if (collapsedByUs && lib.classList.contains("filters-collapsed")) $("[data-collapse]")?.click();
    collapsedByUs = false;
    clearSelection();
    syncCards();
  }
  toggleBtn.addEventListener("click", () => (S.open ? close() : open()));

  function headHtml() {
    return `<header class="pp-head">
      <div class="pp-title"><span class="pp-eyebrow">${icon("calendar-days")}Content Plan</span>
        ${S.plans.length ? `<select class="pp-plan" data-pp-plan aria-label="Plan">${S.plans.map((p) => `<option value="${p.id}"${p.id === S.planId ? " selected" : ""}>${esc(p.name)}</option>`).join("")}<option value="__rename">✎ Rename this plan…</option><option value="__new">+ New plan…</option></select><button class="pp-icon pp-rename" type="button" data-pp-rename title="Rename this plan" aria-label="Rename this plan">${icon("pencil")}</button>` : `<b class="pp-plan-name">Your plan</b>`}</div>
      <a class="pp-icon" href="content-plan.html" title="Open the full Content Plan">${icon("arrow-up-right")}</a>
      <button class="pp-icon" type="button" data-pp-close aria-label="Close the Content Plan">${icon("x")}</button>
    </header>`;
  }
  function entryHtml(e) {
    const r = S.refs.get(refId(e));
    return `<div class="pp-entry s-${e.status}" draggable="true" data-pp-entry="${e.id}" aria-label="${esc(e.label || "Untitled")} · open in the Content Plan">
      ${r?.cover ? `<span class="pp-thumb pp-thumb-img" style="background-image:url('${esc(r.cover)}')"></span>` : r ? T.html(r, "pp-thumb") : `<span class="pp-thumb pp-thumb-none">${icon(TYPE_ICON[e.content_type] || "layout-grid")}</span>`}
      <span class="pp-entry-txt"><b>${esc(e.label || "Untitled")}</b><small><i></i>${STATUS[e.status] || ""}${e.entry_date && e.time_slot !== "12:00" ? ` · ${e.time_slot}` : ""}</small></span>
      <button type="button" class="pp-entry-x" data-pp-del="${e.id}" aria-label="Remove from the plan" title="Remove from the plan">${icon("x")}</button>
    </div>`;
  }
  function render(fresh = []) {
    if (!S.open) return;
    if (!allowed()) {
      panel.innerHTML = `${headHtml()}<div class="pp-gate">${icon("lock")}<b>The Content Plan is part of Library + Content Plan and All Access</b>
        <p>Drag posts from the library onto the days of your week, keep ideas for later and track every post from idea to published.</p>
        <a class="btn btn-gold" href="pricing.html">See plans</a></div>`;
      return;
    }
    const [from, to] = range();
    const today = iso(new Date());
    const label = S.view === "week"
      ? (() => { const diff = Math.round((mondayOf(S.anchor) - mondayOf(new Date())) / (7 * 864e5)); return diff === 0 ? "This week" : diff === 1 ? "Next week" : diff === -1 ? "Last week" : `${from.toLocaleDateString(window.SCP_LOC || "en-GB", { day: "numeric", month: "short" })} – ${to.toLocaleDateString(window.SCP_LOC || "en-GB", { day: "numeric", month: "short" })}`; })()
      : S.anchor.toLocaleDateString(window.SCP_LOC || "en-GB", { month: "long", year: "numeric" });
    const days = Array.from({ length: 7 }, (_, i) => addDays(mondayOf(S.anchor), i));
    const filled = new Set(dated().map((e) => e.entry_date));
    const covered = days.filter((d) => filled.has(iso(d))).length;
    const ideas = undated();

    let body;
    if (S.view === "week") {
      body = `
        <div class="pp-occ"><div class="pp-occ-top"><span><b>${covered}/7</b> days with content</span>${covered === 7 ? `<em>${icon("check")}Full week</em>` : ""}</div>
          <div class="pp-dots">${days.map((d, i) => { const n = dated().filter((e) => e.entry_date === iso(d)).length; return `<span class="${n ? "is-on" : ""}${iso(d) === today ? " is-today" : ""}" title="${DAYS[i]} · ${n}"><i></i><small>${DAYS[i][0]}</small></span>`; }).join("")}</div></div>
        <button class="pp-fill" type="button" data-pp-fill>${icon("sparkles")}Fill my week<small>posts from your favourites</small></button>
        <div class="pp-suggest" data-pp-suggest ${S.suggest ? "" : "hidden"}>${S.suggest ? suggestHtml() : ""}</div>
        <div class="pp-days">${days.map((d, i) => {
          const date = iso(d);
          const list = dated().filter((e) => e.entry_date === date);
          return `<section class="pp-day pp-drop${date === today ? " is-today" : ""}${date < today ? " is-past" : ""}${list.length ? "" : " is-empty"}" data-pp-drop="${date}">
            <header><span>${DAYS[i]}</span><b>${d.getDate()}</b>${date === today ? `<em>Today</em>` : ""}${list.length ? `<i class="pp-n">${list.length}</i>` : ""}</header>
            <div class="pp-list">${list.map(entryHtml).join("")}<p class="pp-drop-hint">${list.length ? "" : "Drop a post here"}</p></div>
          </section>`;
        }).join("")}</div>`;
    } else {
      const month = S.anchor.getMonth();
      body = `<div class="pp-month"><div class="pp-mhead">${DAYS.map((d) => `<span>${d[0]}</span>`).join("")}</div>
        <div class="pp-mgrid">${monthGrid(S.anchor).map((d) => {
          const date = iso(d);
          const list = dated().filter((e) => e.entry_date === date);
          return `<div class="pp-mday pp-drop${d.getMonth() !== month ? " is-out" : ""}${date === today ? " is-today" : ""}" data-pp-drop="${date}" title="${esc(list.map((e) => e.label || "Untitled").join("\n"))}">
            <span>${d.getDate()}</span><div class="pp-mdots">${list.slice(0, 4).map((e) => `<i class="s-${e.status}"></i>`).join("")}${list.length > 4 ? `<em>+${list.length - 4}</em>` : ""}</div>
          </div>`;
        }).join("")}</div>
        <p class="pp-month-note">${dated().filter((e) => parse(e.entry_date).getMonth() === month).length} posts planned this month · drop posts on a day</p></div>`;
    }
    panel.innerHTML = `${headHtml()}
      <div class="pp-bar">
        <div class="pp-seg" role="tablist"><button type="button" role="tab" aria-selected="${S.view === "week"}" data-pp-view="week">Week</button><button type="button" role="tab" aria-selected="${S.view === "month"}" data-pp-view="month">Month</button></div>
        <div class="pp-nav"><button type="button" data-pp-go="-1" aria-label="Previous">${icon("chevron-left")}</button><b>${esc(label)}</b><button type="button" data-pp-go="1" aria-label="Next">${icon("chevron-right")}</button>
          <button type="button" class="pp-today" data-pp-go="0">Today</button></div>
      </div>
      <div class="pp-scroll">
        <section class="pp-tray pp-drop" data-pp-drop="">
          <header>${icon("inbox")}<b>No date</b><span>${ideas.length || ""}</span><small>ideas for later</small></header>
          <div class="pp-list">${ideas.map(entryHtml).join("")}<p class="pp-drop-hint">${ideas.length ? "" : "Drop posts here to keep them as ideas"}</p></div>
        </section>
        ${body}
      </div>
      <footer class="pp-foot" data-pp-foot>${footHtml()}</footer>`;
    fresh.forEach((id) => $(`[data-pp-entry="${CSS.escape(String(id))}"]`, panel)?.classList.add("is-new"));
    requestAnimationFrame(() => T.fit(panel));
  }
  const footHtml = () => S.selected.size
    ? `<span><b>${S.selected.size} selected</b> · drag one of them onto a day</span><button type="button" data-pp-clear>Clear</button>`
    : `<span>${icon("hand")}Drag posts onto a day · <kbd>Shift</kbd>+click to select several</span>`;
  const renderFoot = () => { const f = $("[data-pp-foot]", panel); if (f) f.innerHTML = footHtml(); };

  // Hover preview of a planned post (js/post-preview.js)
  window.SCP_PREVIEW?.attach(panel, "[data-pp-entry]", (el) => {
    const e = S.entries.find((x) => x.id === el.dataset.ppEntry);
    if (!e) return null;
    const r = S.refs.get(refId(e));
    return {
      post: r, title: e.label, status: e.status, statusLabel: STATUS[e.status],
      lines: [e.entry_date ? `${fmtDay(e.entry_date)} · ${e.time_slot}` : "No date · idea", r ? `Reference: ${esc(r.who)}${r.format ? ` · ${esc(r.format)}` : ""}` : ""],
      copy: e.copy, href: r?.url,
    };
  });

  // Panel clicks
  panel.addEventListener("click", async (e) => {
    if (e.target.closest("[data-pp-close]")) return close();
    const v = e.target.closest("[data-pp-view]");
    if (v) { S.view = v.dataset.ppView; store.set("scp-pp-view", S.view); S.anchor = S.view === "week" ? mondayOf(S.anchor) : new Date(S.anchor); S.suggest = null; return reload(); }
    const go = e.target.closest("[data-pp-go]");
    if (go) {
      const n = Number(go.dataset.ppGo);
      S.anchor = n === 0 ? (S.view === "week" ? mondayOf(new Date()) : new Date())
        : S.view === "week" ? addDays(mondayOf(S.anchor), 7 * n) : new Date(S.anchor.getFullYear(), S.anchor.getMonth() + n, 1);
      S.suggest = null;
      return reload();
    }
    const del = e.target.closest("[data-pp-del]");
    if (del) { e.stopPropagation(); return deleteEntry(del.dataset.ppDel); }
    const ent = e.target.closest("[data-pp-entry]");
    if (ent) return window.open(`content-plan.html#entry=${ent.dataset.ppEntry}`, "_blank", "noopener");
    if (e.target.closest("[data-pp-clear]")) return clearSelection();
    if (e.target.closest("[data-pp-fill]")) return fillWeek();
    const sAct = e.target.closest("[data-sg]");
    if (sAct) return suggestAction(sAct);
    const mday = e.target.closest(".pp-mday");
    if (mday) { S.view = "week"; store.set("scp-pp-view", "week"); S.anchor = mondayOf(parse(mday.dataset.ppDrop)); return reload(); }
  });
  panel.addEventListener("change", async (e) => {
    if (e.target.matches("[data-pp-plan]")) {
      if (e.target.value === "__rename") { e.target.value = S.planId; return renamePlan(); }
      if (e.target.value === "__new") {
        const name = window.prompt("Name of the new plan (e.g. Pre-season, Kit launch, Women's team)")?.trim();
        if (name) {
          const { data, error } = await db.from("org_plans").insert({ name }).select("id,name").single();
          if (error) toast(errText(error)); else { S.plans.push(data); S.planId = data.id; }
        }
      } else S.planId = e.target.value;
      store.set("scp-org-plan", S.planId);
      S.suggest = null;
      return reload();
    }
    if (e.target.matches("[data-sg-day]")) { const s = S.suggest?.items[Number(e.target.dataset.sgDay)]; if (s) s.date = e.target.value; }
  });
  async function renamePlan() {
    const cur = S.plans.find((p) => p.id === S.planId);
    if (!cur) return;
    const name = window.prompt("New name for this plan", cur.name)?.trim();
    if (!name || name === cur.name) return;
    const { error } = await db.from("org_plans").update({ name: name.slice(0, 80) }).eq("id", cur.id);
    if (error) return toast(errText(error));
    cur.name = name.slice(0, 80);
    render();
  }
  panel.addEventListener("click", (e) => { if (e.target.closest("[data-pp-rename]")) renamePlan(); });
  async function reload() {
    try { await loadEntries(); } catch (e) { toast(errText(e)); }
    render();
  }

  // ---------- Selecting several posts (Shift+click or the grip on each card) ----------
  function syncCards() {
    $$(".lib-card").forEach((c) => {
      c.draggable = S.open;
      c.classList.toggle("is-selected", S.selected.has(Number(c.dataset.id)));
    });
  }
  new MutationObserver(() => { if (S.open || S.selected.size) syncCards(); }).observe($("[data-posts]") || lib, { childList: true, subtree: true });
  function toggleSelect(id) {
    S.selected.has(id) ? S.selected.delete(id) : S.selected.add(id);
    syncCards();
    renderFoot();
  }
  function clearSelection() { S.selected.clear(); syncCards(); renderFoot(); }
  document.addEventListener("click", (e) => {
    const card = e.target.closest?.(".lib-card");
    if (!card || e.target.closest("[data-plan-add]")) return;
    const grip = e.target.closest("[data-pp-grip]");
    if (!grip && !(e.shiftKey && S.open)) return;
    e.preventDefault(); e.stopPropagation();
    if (!S.open) open();
    toggleSelect(Number(card.dataset.id));
  }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && S.selected.size && !document.querySelector(".pp-pop")) clearSelection(); });

  // ---------- Drag & drop ----------
  let ghostEl = null;
  function dragGhost(ids, ev) {
    ghostEl?.remove();
    const p = postInfo(ids[0]);
    ghostEl = document.createElement("div");
    ghostEl.className = "pp-ghost";
    ghostEl.innerHTML = `${icon("calendar-plus")}<span><b>${ids.length > 1 ? `${ids.length} posts` : esc(p?.who || "Post")}</b><small>${ids.length > 1 ? "drop on a day" : esc(p?.format || "drop on a day")}</small></span>`;
    document.body.append(ghostEl);
    ev.dataTransfer.setDragImage(ghostEl, 22, 22);
    setTimeout(() => { ghostEl?.remove(); ghostEl = null; }, 0);
  }
  document.addEventListener("dragstart", (e) => {
    if (!S.open || !e.target.closest) return;
    const ent = e.target.closest("[data-pp-entry]");
    if (ent) {
      e.dataTransfer.setData("text/scp-entry", ent.dataset.ppEntry);
      e.dataTransfer.effectAllowed = "move";
      ent.classList.add("is-dragging");
      panel.classList.add("is-receiving");
      return;
    }
    const card = e.target.closest(".lib-card");
    if (!card) return;
    const id = Number(card.dataset.id);
    const ids = S.selected.has(id) ? [...S.selected] : [id];
    e.dataTransfer.setData("text/scp-ideas", JSON.stringify(ids));
    e.dataTransfer.effectAllowed = "copy";
    dragGhost(ids, e);
    ids.forEach((x) => $(`.lib-card[data-id="${x}"]`)?.classList.add("is-dragging"));
    panel.classList.add("is-receiving");
  });
  document.addEventListener("dragend", () => {
    $$(".is-dragging").forEach((x) => x.classList.remove("is-dragging"));
    $$(".pp-drop.is-over", panel).forEach((x) => x.classList.remove("is-over"));
    panel.classList.remove("is-receiving");
  });
  const accepts = (e) => e.dataTransfer && [...e.dataTransfer.types].some((t) => t === "text/scp-ideas" || t === "text/scp-entry");
  panel.addEventListener("dragover", (e) => {
    const zone = e.target.closest("[data-pp-drop]");
    if (!zone || !accepts(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = [...e.dataTransfer.types].includes("text/scp-entry") ? "move" : "copy";
    $$(".pp-drop.is-over", panel).forEach((x) => x !== zone && x.classList.remove("is-over"));
    zone.classList.add("is-over");
  });
  panel.addEventListener("dragleave", (e) => { const z = e.target.closest("[data-pp-drop]"); if (z && !z.contains(e.relatedTarget)) z.classList.remove("is-over"); });
  panel.addEventListener("drop", async (e) => {
    const zone = e.target.closest("[data-pp-drop]");
    if (!zone || !accepts(e)) return;
    e.preventDefault();
    zone.classList.remove("is-over");
    panel.classList.remove("is-receiving");
    const date = zone.dataset.ppDrop || null;
    const moving = e.dataTransfer.getData("text/scp-entry");
    if (moving) return moveEntry(moving, date);
    let ids = [];
    try { ids = JSON.parse(e.dataTransfer.getData("text/scp-ideas")).map(Number).filter(Boolean); } catch {}
    if (ids.length) addPosts(ids, date);
  });

  // ---------- "+" under each card: add to a day from a mini calendar (also on touch screens) ----------
  let pop = null;
  const closePop = () => { pop?.remove(); pop = null; document.removeEventListener("mousedown", outsidePop, true); };
  const outsidePop = (e) => { if (pop && !pop.contains(e.target) && !e.target.closest("[data-plan-add]")) closePop(); };
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest?.("[data-plan-add]");
    if (!btn) return;
    e.preventDefault(); e.stopPropagation();
    if (pop && pop.dataset.for === btn.dataset.planAdd) return closePop();
    const id = Number(btn.dataset.planAdd);
    quickAdd(btn, S.selected.has(id) ? [...S.selected] : [id]);
  }, true);
  async function quickAdd(btn, ids) {
    closePop();
    pop = document.createElement("div");
    pop.className = "pp-pop";
    pop.dataset.for = btn.dataset.planAdd;
    pop.innerHTML = `<div class="pp-loading"><span class="ai-spinner"></span></div>`;
    document.body.append(pop);
    place(btn);
    setTimeout(() => document.addEventListener("mousedown", outsidePop, true));
    try { await ready(); } catch (e) { pop.innerHTML = `<p class="pp-error">${esc(errText(e))}</p>`; return; }
    if (!pop) return;
    if (!allowed()) {
      pop.innerHTML = `<div class="pp-gate is-small">${icon("lock")}<b>Plan this post in your Content Plan</b><p>Part of Library + Content Plan and All Access.</p><a class="btn btn-gold" href="pricing.html">See plans</a></div>`;
      return place(btn);
    }
    const st = { planId: S.planId, month: new Date(), counts: new Map() };
    const draw = async () => {
      const g = monthGrid(st.month);
      const { data } = await db.from("org_entries").select("entry_date").eq("plan_id", st.planId).gte("entry_date", iso(g[0])).lte("entry_date", iso(g[41]));
      st.counts = new Map();
      for (const r of data || []) st.counts.set(r.entry_date, (st.counts.get(r.entry_date) || 0) + 1);
      if (!pop) return;
      const today = iso(new Date());
      const p = postInfo(ids[0]);
      pop.innerHTML = `
        <header class="pp-pop-head"><b>${icon("calendar-plus")}Add to Content Plan</b><span>${ids.length > 1 ? `${ids.length} posts selected` : esc([p?.who, p?.format].filter(Boolean).join(" · "))}</span></header>
        ${S.plans.length > 1 ? `<select class="pp-plan" data-qp-plan aria-label="Plan">${S.plans.map((x) => `<option value="${x.id}"${x.id === st.planId ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select>` : ""}
        <div class="pp-cal-nav"><button type="button" data-qp-month="-1" aria-label="Previous month">${icon("chevron-left")}</button><b>${st.month.toLocaleDateString(window.SCP_LOC || "en-GB", { month: "long", year: "numeric" })}</b><button type="button" data-qp-month="1" aria-label="Next month">${icon("chevron-right")}</button></div>
        <div class="pp-cal">${DAYS.map((d) => `<span class="pp-cal-h">${d[0]}</span>`).join("")}${g.map((d) => {
          const date = iso(d), n = st.counts.get(date) || 0;
          return `<button type="button" class="${d.getMonth() !== st.month.getMonth() ? "is-out" : ""}${date === today ? " is-today" : ""}${date < today ? " is-past" : ""}" data-qp-day="${date}" title="${fmtDay(date)}${n ? ` · ${n} planned` : ""}">${d.getDate()}${n ? `<i>${"•".repeat(Math.min(n, 3))}</i>` : ""}</button>`;
        }).join("")}</div>
        <button type="button" class="pp-pop-idea" data-qp-day="">${icon("inbox")}No date — keep it as an idea</button>`;
      place(btn);
    };
    pop.addEventListener("click", async (e) => {
      const m = e.target.closest("[data-qp-month]");
      if (m) { st.month = new Date(st.month.getFullYear(), st.month.getMonth() + Number(m.dataset.qpMonth), 1); return draw(); }
      const d = e.target.closest("[data-qp-day]");
      if (d) { const date = d.dataset.qpDay || null; closePop(); addPosts(ids, date, st.planId); }
    });
    pop.addEventListener("change", (e) => { if (e.target.matches("[data-qp-plan]")) { st.planId = e.target.value; draw(); } });
    draw();
  }
  function place(btn) {
    if (!pop) return;
    if (innerWidth <= 640) { pop.classList.add("is-sheet"); pop.style.left = pop.style.top = ""; return; }
    const r = btn.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = `${Math.max(12, Math.min(innerWidth - w - 12, r.right - w))}px`;
    pop.style.top = `${r.bottom + 8 + h > innerHeight ? Math.max(12, r.top - h - 8) : r.bottom + 8}px`;
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && pop) closePop(); });
  addEventListener("scroll", () => pop && !pop.classList.contains("is-sheet") && closePop(), { passive: true });

  // ---------- "Fill my week": posts from the member's favourite profiles / sports for the empty days ----------
  async function fillWeek() {
    S.suggest = { loading: true, items: [], queue: [] };
    render();
    try {
      const prefs = (await window.SCP_AUTH?.getProfile?.())?.profile?.preferences || {};
      const boost = [...(prefs.favouriteProfiles || []), ...(prefs.favouriteCreators || [])].map((f) => Number(f.id)).filter(Boolean);
      const boost2 = [...(prefs.sports || []), ...(prefs.competitions || [])].map(Number).filter(Boolean);
      const [{ data: used }, { data: res, error }] = await Promise.all([
        db.from("org_entries").select("inspiration").eq("plan_id", S.planId).not("inspiration", "is", null),
        db.rpc("library_ideas", { p_order: boost.length || boost2.length ? "foryou" : "random", p_seed: String(Date.now()), p_boost: boost.length ? boost : null, p_boost2: boost2.length ? boost2 : null, p_limit: 60 }),
      ]);
      if (error) throw error;
      const taken = new Set((used || []).map((u) => u.inspiration));
      // one post per profile first, so the week isn't five posts of the same club
      const rows = (res?.data || []).filter((p) => !taken.has(`ci-${p.id}`));
      const seen = new Set(), first = [], rest = [];
      for (const p of rows) { const n = norm(p); S.refs.set(n.id, n); (seen.has(n.who) ? rest : (seen.add(n.who), first)).push(n.id); }
      const queue = [...first, ...rest];
      // Empty days of this week (from today on, if it's the current week), then the other days
      const days = Array.from({ length: 7 }, (_, i) => iso(addDays(mondayOf(S.anchor), i)));
      const today = iso(new Date());
      const avail = days.filter((d) => d >= today);
      if (!avail.length) { S.suggest = { done: "This week is over — move to next week to fill it." }; return render(); }
      const filled = new Set(dated().map((e) => e.entry_date));
      const order = [...avail.filter((d) => !filled.has(d)), ...avail.filter((d) => filled.has(d))];
      const items = queue.splice(0, 5).map((id, i) => ({ id, date: order[i % order.length] }));
      if (!items.length) { S.suggest = { done: "No new posts to suggest right now — every match is already in your plan." }; return render(); }
      S.suggest = { items, queue, days: avail, personal: Boolean(boost.length || boost2.length) };
    } catch (e) { S.suggest = { done: errText(e) }; }
    render();
  }
  function suggestHtml() {
    const s = S.suggest;
    if (s.loading) return `<div class="pp-loading is-inline"><span class="ai-spinner"></span>Finding posts for your week…</div>`;
    if (s.done) return `<p class="pp-sg-note">${esc(s.done)}</p><div class="pp-sg-actions"><button type="button" data-sg="cancel">Close</button></div>`;
    return `<p class="pp-sg-title">${icon("sparkles")}${s.items.length} ideas for this week<small>${s.personal ? "from your favourite profiles and sports" : "add favourites in your profile for better picks"}</small></p>
      <div class="pp-sg-list">${s.items.map((it, i) => {
        const p = S.refs.get(it.id);
        return `<div class="pp-sg">${T.html(p, "pp-thumb")}
          <span class="pp-entry-txt"><b>${esc(p?.who)}</b><small>${esc(p?.format || "Post")}</small></span>
          <select data-sg-day="${i}" aria-label="Day">${s.days.map((d) => `<option value="${d}"${d === it.date ? " selected" : ""}>${DAYS[dow(parse(d))]} ${parse(d).getDate()}</option>`).join("")}</select>
          <a class="pp-sg-btn" href="content-library.html#post=${it.id}" target="_blank" rel="noopener" title="See the post">${icon("arrow-up-right")}</a>
          <button type="button" class="pp-sg-btn" data-sg="skip" data-i="${i}" title="Show me another one" aria-label="Show another post">${icon("repeat")}</button>
        </div>`;
      }).join("")}</div>
      <div class="pp-sg-actions"><button type="button" data-sg="cancel">Cancel</button><button type="button" data-sg="shuffle">${icon("repeat")}New ideas</button><button type="button" class="is-gold" data-sg="add">Add ${s.items.length} to my week</button></div>`;
  }
  async function suggestAction(b) {
    const s = S.suggest;
    const act = b.dataset.sg;
    if (act === "cancel") { S.suggest = null; return render(); }
    if (act === "shuffle") return fillWeek();
    if (act === "skip") {
      const i = Number(b.dataset.i);
      const next = s.queue.shift();
      if (next) s.items[i] = { id: next, date: s.items[i].date }; else s.items.splice(i, 1);
      if (!s.items.length) S.suggest = null;
      return render();
    }
    if (act === "add") {
      b.disabled = true;
      const items = s.items;
      S.suggest = null;
      const rows = [];
      for (const it of items) {
        const p = S.refs.get(it.id);
        rows.push({ plan_id: S.planId, entry_date: it.date, time_slot: "12:00", status: "planned", label: `Idea: ${p?.who || "Post"}${p?.format ? ` · ${p.format}` : ""}`.slice(0, 140), content_type: typeFor(p?.format), inspiration: `ci-${it.id}` });
      }
      const { data, error } = await db.from("org_entries").insert(rows).select(COLS);
      if (error) { toast(errText(error)); return render(); }
      S.entries.push(...data);
      render(data.map((e) => e.id));
      toast(`${data.length} posts added to your week`, "Undo", async () => {
        const { error: e } = await db.from("org_entries").delete().in("id", data.map((x) => x.id));
        if (e) return toast(errText(e));
        S.entries = S.entries.filter((x) => !data.some((d) => d.id === x.id));
        render();
      });
    }
  }

  // ---------- Toast ----------
  let toastTimer;
  function toast(text, action, onAction) {
    $(".lib-toast")?.remove();
    const t = document.createElement("div");
    t.className = "lib-toast";
    t.innerHTML = `<span>${esc(text)}</span>${action ? `<button type="button">${esc(action)}</button>` : ""}`;
    document.body.append(t);
    if (action) t.querySelector("button").addEventListener("click", () => { t.remove(); onAction(); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.remove(), action ? 8000 : 3200);
  }

  new ResizeObserver(() => S.open && T.fit(panel)).observe(panel);
  if (store.get("scp-pp-open") === "1" && innerWidth > 960) open();
})();
