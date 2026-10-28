// SCP Admin — Content Ideas: filterable table, columns, CSV export, create/edit, bulk edit and delete.
(async () => {
  const A = window.SCPA;
  const { $, $$, esc, icon, num, rpc } = A;
  try { await A.boot("ideas"); } catch { return; }
  const main = $("[data-main]");
  main.classList.add("ci-page");

  const COLUMNS = [
    { key: "title", label: "Title", on: true },
    { key: "id", label: "ID", on: true },
    { key: "published", label: "Published", on: true },
    { key: "sport", label: "Sport", on: true },
    { key: "entity", label: "Entity", on: true },
    { key: "platform", label: "Platform", on: true },
    { key: "competition", label: "Competition", on: false },
    { key: "club", label: "Club", on: false },
    { key: "format", label: "Format", on: false },
    { key: "campaign", label: "Campaign", on: false },
    { key: "trend", label: "Trend", on: false },
  ];
  let visible = A.store.get("scpa-ideas-columns", COLUMNS.filter((c) => c.on).map((c) => c.key));
  const PER_PAGE = 25;
  let page = 1;
  let rows = [];
  let total = 0;
  let token = 0;
  const selected = new Set();   // ids on screen that are ticked
  let allFiltered = null;       // array of every filtered id when "select all" is used

  main.innerHTML = `
    <div class="page-head">
      <div><h1>Content Ideas</h1><p data-total>Loading…</p></div>
      <div class="head-actions">
        <button class="btn btn-primary" type="button" data-add title="Create a new content idea manually">${icon("plus")}Add</button>
        <div class="menu-wrap">
          <button class="btn" type="button" data-columns aria-expanded="false">${icon("columns")}Columns</button>
          <div class="menu" hidden data-columns-menu>${COLUMNS.map((c) => `<label><input class="check" type="checkbox" value="${c.key}" ${visible.includes(c.key) ? "checked" : ""}>${c.label}</label>`).join("")}</div>
        </div>
        <button class="btn" type="button" data-export>${icon("download")}Export CSV</button>
        <button class="btn btn-ghost" type="button" data-clear>Clear Filters</button>
      </div>
    </div>
    <div class="info-box notice-broken" hidden data-broken></div>
    <div class="info-box notice-removed" hidden data-removed></div>
    <section data-filters></section>
    <div class="selbar" hidden data-selbar>
      <span data-selcount></span>
      <button class="link" type="button" data-select-all hidden></button>
      <button class="btn btn-ghost btn-sm" type="button" data-clear-sel>Clear selection</button>
      <span class="spacer"></span>
      <button class="btn btn-sm" type="button" data-bulk-edit>${icon("edit")}Bulk Edit</button>
      <button class="btn btn-danger btn-sm" type="button" data-bulk-delete>${icon("trash")}Delete</button>
    </div>
    <section class="panel">
      <div class="table-wrap"><table class="data"><thead data-thead></thead><tbody data-tbody></tbody></table></div>
      <div class="pager" data-pager></div>
    </section>`;

  let catalog;
  try { catalog = await A.loadCatalog(); } catch (e) { $("[data-total]").textContent = A.errMsg(e); $("[data-total]").className = "error-text"; return; }

  const panel = new A.FilterPanel($("[data-filters]"), {
    catalog, storageKey: "scpa-ideas-filters", showExternalId: true,
    onChange: () => { page = 1; clearSelection(); load(); },
  });

  // ---------- Loading ----------
  async function load() {
    const my = ++token;
    $("[data-tbody]").innerHTML = `<tr><td class="table-empty" colspan="20"><span class="spinner sm"></span> Loading...</td></tr>`;
    try {
      const res = await rpc("search_content_ideas", { ...panel.params(), p_page: page, p_per_page: PER_PAGE });
      if (my !== token) return;
      rows = res.data || [];
      total = res.meta.total;
      if (page > res.meta.total_pages && total > 0) { page = res.meta.total_pages; return load(); }
      $("[data-total]").textContent = `${num(total)} items total`;
      $("[data-export]").title = `Export ${num(total)} filtered ideas as CSV`;
      $("[data-export]").disabled = total === 0;
      render();
      A.pager($("[data-pager]"), { page, totalPages: res.meta.total_pages, onPage: (p) => { page = p; load(); window.scrollTo({ top: 0, behavior: "smooth" }); } });
      panel.refreshCounts();
    } catch (e) {
      if (my !== token) return;
      $("[data-tbody]").innerHTML = `<tr><td class="table-empty error-text" colspan="20">${esc(A.errMsg(e))}</td></tr>`;
      $("[data-total]").textContent = "";
    }
  }

  // premium cells: brand dot per network, tags as chips (2 + "+n"), date over time
  const NET = { instagram: "#e1306c", tiktok: "#25f4ee", facebook: "#1877f2", youtube: "#ff0033", x: "#9aa4b5", twitter: "#1d9bf0", linkedin: "#0a66c2", threads: "#9aa4b5" };
  const netColor = (name) => NET[String(name || "").toLowerCase()] || "var(--muted)";
  // the network's logo (line drawing) instead of its initial; an unknown network keeps the initial
  const LOGO = {
    instagram: '<rect x="2.5" y="2.5" width="19" height="19" rx="5.5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="0.6" fill="currentColor"/>',
    tiktok: '<path d="M9.5 11.5a4.2 4.2 0 1 0 4.2 4.2V3c.5 2.6 2.4 4.5 5.3 4.7"/>',
    facebook: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
    youtube: '<path d="M2.5 17a24 24 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.6 49.6 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24 24 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.6 49.6 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/>',
    linkedin: '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>',
    x: '<path d="M4 4h4.5L20 20h-4.5z"/><path d="M4 20l6.6-6.6M20 4l-6.6 6.6"/>',
  };
  LOGO.twitter = LOGO.x;
  const mark = (name) => { const k = String(name || "").toLowerCase(); return LOGO[k] ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${LOGO[k]}</svg>` : esc((name || "?").charAt(0).toUpperCase()); };
  const chips = (row, cat) => {
    const list = (row.tags?.[cat] || []).map((t) => t.name);
    if (!list.length) return `<span class="ci-none">—</span>`;
    return list.slice(0, 2).map((n) => cat === "platform" ? `<span class="ci-chip ci-net" style="--nc:${netColor(n)}"><i></i>${esc(n)}</span>` : `<span class="ci-chip">${esc(n)}</span>`).join("")
      + (list.length > 2 ? `<span class="ci-chip ci-more" title="${esc(list.slice(2).join(", "))}">+${list.length - 2}</span>` : "");
  };
  const when = (iso) => { if (!iso) return "—"; const d = new Date(iso); return `<b>${d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}</b><small>${d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</small>`; };

  function render() {
    const cols = COLUMNS.filter((c) => visible.includes(c.key));
    const pageIds = rows.map((r) => r.id);
    const allOnPage = pageIds.length > 0 && pageIds.every((id) => allFiltered || selected.has(id));
    $("[data-thead]").innerHTML = `<tr>
      <th class="td-check"><input class="check" type="checkbox" data-check-page aria-label="Select all on this page" ${allOnPage ? "checked" : ""}></th>
      ${cols.map((c) => `<th>${c.label}</th>`).join("")}
      <th class="td-actions">Actions</th></tr>`;
    if (!rows.length) {
      $("[data-tbody]").innerHTML = `<tr><td class="table-empty" colspan="20">No content ideas found</td></tr>`;
    } else {
      $("[data-tbody]").innerHTML = rows.map((r) => {
        const on = Boolean(allFiltered) || selected.has(r.id);
        const cell = (c) => {
          if (c.key === "title") { const net = r.tags?.platform?.[0]?.name;
            return `<td class="td-title ci-title" title="${esc(r.title || "")}"><span class="ci-mark" style="--nc:${netColor(net)}" aria-hidden="true" title="${esc(net || "")}">${mark(net)}</span><span class="ci-tt"><b>${esc((r.title || "(no title)").replace(/\s+/g, " "))}</b>${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener" data-i18n-skip>${esc(r.url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0])} ↗</a>` : ""}</span></td>`; }
          if (c.key === "id") return `<td class="td-id"><span class="ci-id mono" title="${esc(r.external_id)}">${esc(r.external_id)}</span></td>`;
          if (c.key === "published") return `<td class="td-date ci-date">${when(r.published_at)}</td>`;
          return `<td class="td-tags ci-tags">${chips(r, c.key)}</td>`;
        };
        return `<tr data-row="${r.id}" class="${on ? "is-selected" : ""}">
          <td class="td-check"><input class="check" type="checkbox" data-check="${r.id}" aria-label="Select" ${on ? "checked" : ""}></td>
          ${cols.map(cell).join("")}
          <td class="td-actions">
            <button class="icon-btn" type="button" data-view="${r.id}" title="Detail" aria-label="Detail">${icon("eye")}</button>
            <button class="icon-btn" type="button" data-edit="${r.id}" title="Edit" aria-label="Edit">${icon("edit")}</button>
          </td></tr>`;
      }).join("");
    }
    renderSelbar();
  }

  // ---------- Selection ----------
  function clearSelection() { selected.clear(); allFiltered = null; }
  function renderSelbar() {
    const count = allFiltered ? allFiltered.length : selected.size;
    $("[data-selbar]").hidden = count === 0;
    $("[data-selcount]").innerHTML = `<b>${num(count)}</b> selected`;
    const sa = $("[data-select-all]");
    const pageFull = rows.length > 0 && rows.every((r) => selected.has(r.id));
    sa.hidden = Boolean(allFiltered) || !pageFull || total <= rows.length;
    sa.textContent = `Select all ${num(total)} filtered ideas`;
  }
  $("[data-tbody]").addEventListener("change", (e) => {
    const box = e.target.closest("[data-check]");
    if (!box) return;
    const id = Number(box.dataset.check);
    if (allFiltered) { // leaving "all" mode: keep the page selection minus this one
      allFiltered = null;
      rows.forEach((r) => selected.add(r.id));
    }
    box.checked ? selected.add(id) : selected.delete(id);
    render();
  });
  $("[data-thead]").addEventListener("change", (e) => {
    if (!e.target.matches("[data-check-page]")) return;
    if (e.target.checked) rows.forEach((r) => selected.add(r.id));
    else { allFiltered = null; rows.forEach((r) => selected.delete(r.id)); }
    render();
  });
  $("[data-select-all]").addEventListener("click", async () => {
    try { allFiltered = (await rpc("search_content_idea_ids", panel.params())).map(Number); render(); }
    catch (e) { A.toast(A.errMsg(e), "err"); }
  });
  $("[data-clear-sel]").addEventListener("click", () => { clearSelection(); render(); });
  const selectionIds = () => (allFiltered ? [...allFiltered] : [...selected]);

  // ---------- Row actions ----------
  $("[data-tbody]").addEventListener("click", (e) => {
    const edit = e.target.closest("[data-edit]");
    const view = e.target.closest("[data-view]");
    if (edit) A.openIdeaEditor({ idea: rows.find((r) => r.id === Number(edit.dataset.edit)), onSaved: load });
    if (view) A.openIdeaPreview(rows.find((r) => r.id === Number(view.dataset.view)));
  });
  $("[data-add]").addEventListener("click", () => A.openIdeaEditor({ onSaved: () => { page = 1; load(); } }));
  $("[data-clear]").addEventListener("click", () => panel.clear());

  // ---------- Columns ----------
  const colBtn = $("[data-columns]"), colMenu = $("[data-columns-menu]");
  colBtn.addEventListener("click", (e) => { e.stopPropagation(); colMenu.hidden = !colMenu.hidden; colBtn.setAttribute("aria-expanded", String(!colMenu.hidden)); });
  colMenu.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", () => { colMenu.hidden = true; colBtn.setAttribute("aria-expanded", "false"); });
  colMenu.addEventListener("change", () => {
    visible = $$("input:checked", colMenu).map((i) => i.value);
    A.store.set("scpa-ideas-columns", visible);
    render();
  });

  // ---------- Export CSV (same columns as the import format) ----------
  $("[data-export]").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const label = btn.innerHTML;
    btn.disabled = true;
    try {
      const ids = (await rpc("search_content_idea_ids", panel.params())).map(Number);
      const out = [];
      for (const part of A.chunk(ids, 500)) {
        btn.innerHTML = `<span class="spinner sm"></span> ${num(out.length)} / ${num(ids.length)}`;
        const data = await rpc("content_ideas_by_ids", { p_ids: part });
        out.push(...data.map(A.ideaToCsvRow));
      }
      const csv = "﻿" + A.toCSV(out, A.CSV_COLUMNS);
      A.downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `content-ideas-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (err) { A.toast(A.errMsg(err), "err"); }
    finally { btn.innerHTML = label; btn.disabled = total === 0; }
  });

  // ---------- Bulk delete ----------
  $("[data-bulk-delete]").addEventListener("click", async () => {
    const ids = selectionIds();
    const ok = await A.confirmDialog({
      title: `Delete ${num(ids.length)} content idea${ids.length === 1 ? "" : "s"}?`,
      text: "This will permanently delete the content ideas and all their filter links. This cannot be undone.",
      confirm: "Delete", danger: true,
    });
    if (!ok) return;
    try {
      for (const part of A.chunk(ids, 300)) {
        const { error } = await A.db.from("content_ideas").delete().in("id", part);
        if (error) throw error;
      }
      A.toast(`${num(ids.length)} content idea${ids.length === 1 ? "" : "s"} deleted.`);
      clearSelection(); A.resetCatalog(); load();
    } catch (e) { A.toast(A.errMsg(e), "err"); }
  });

  // ---------- Posts that no longer exist on Instagram or Facebook (marked by check-embeds.mjs, covers, views-cron, fb-shape) ----------
  // LinkedIn posts are hidden on purpose with the same mark (supabase/hide-linkedin.sql): never listed or deleted here
  async function loadBroken() {
    const box = $("[data-broken]");
    const { count, error } = await A.db.from("content_ideas").select("id", { count: "exact", head: true }).not("unavailable_at", "is", null).not("url", "ilike", "%linkedin.com%");
    if (error || !count) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = `<span><b>${num(count)} post${count === 1 ? "" : "s"}</b> no longer exist${count === 1 ? "s" : ""} on Instagram or Facebook (deleted or made private). They're already hidden from the Content Library.</span>
      <span class="brk-btns"><button class="btn btn-sm" type="button" data-review-broken>Review</button>
      <button class="btn btn-danger btn-sm" type="button" data-delete-broken>${icon("trash")}Delete them</button></span>
      <div class="brk-list" hidden data-broken-list></div>`;
    // review: each post with its link, to keep it (back to the library) or delete it
    $("[data-review-broken]", box).addEventListener("click", async () => {
      const list = $("[data-broken-list]", box);
      if (!list.hidden) { list.hidden = true; return; }
      const { data } = await A.db.from("content_ideas").select("id,title,url,account,unavailable_at").not("unavailable_at", "is", null).not("url", "ilike", "%linkedin.com%").order("unavailable_at", { ascending: false }).limit(300);
      list.innerHTML = (data || []).map((p) => `<div class="brk-row" data-id="${p.id}"><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title || p.url)}</a><small>${esc(p.account || "")}</small>
        <button class="btn btn-sm" type="button" data-keep>Keep</button><button class="btn btn-danger btn-sm" type="button" data-del>${icon("trash")}</button></div>`).join("")
        + (count > 300 ? `<small>Showing the latest 300 of ${num(count)}.</small>` : "");
      list.hidden = false;
    });
    $("[data-broken-list]", box).addEventListener("click", async (e) => {
      const b = e.target.closest("[data-keep],[data-del]"), row = b?.closest("[data-id]");
      if (!row) return;
      const q = A.db.from("content_ideas"), id = Number(row.dataset.id);
      const { error: e2 } = b.matches("[data-keep]") ? await q.update({ unavailable_at: null }).eq("id", id) : await q.delete().eq("id", id);
      if (e2) return A.toast(A.errMsg(e2), "err");
      row.remove(); A.resetCatalog();
    });
    $("[data-delete-broken]", box).addEventListener("click", async () => {
      const ok = await A.confirmDialog({
        title: `Delete ${num(count)} unavailable post${count === 1 ? "" : "s"}?`,
        text: "They will be permanently deleted with all their filter links. This cannot be undone.",
        confirm: "Delete", danger: true,
      });
      if (!ok) return;
      const { error: e } = await A.db.from("content_ideas").delete().not("unavailable_at", "is", null).not("url", "ilike", "%linkedin.com%");
      if (e) return A.toast(A.errMsg(e), "err");
      A.toast(`${num(count)} unavailable post${count === 1 ? "" : "s"} deleted.`);
      A.resetCatalog(); loadBroken(); load();
    });
  }
  loadBroken();

  // ---------- Posts a superadmin removed from the Content Library (supabase/quality.sql) ----------
  async function loadRemoved() {
    const box = $("[data-removed]");
    let { data, error } = await A.db.from("content_removals").select("*").is("deleted_at", null).order("removed_at", { ascending: false });
    if (error && /deleted_at/.test(error.message)) ({ data, error } = await A.db.from("content_removals").select("*").order("removed_at", { ascending: false }));   // removed-delete.sql not run yet
    if (error || !data?.length) { box.hidden = true; return; }
    box.hidden = false;
    // the posts' covers, to recognise them at a glance (content_ideas, by their last known id)
    const ids = [...new Set(data.map((r) => r.post_id).filter(Boolean))], cover = {};
    for (let i = 0; i < ids.length; i += 200) {
      const { data: c } = await A.db.from("content_ideas").select("id,cover_url").in("id", ids.slice(i, i + 200));
      (c || []).forEach((x) => (cover[x.id] = x.cover_url));
    }
    const TONE = { "Low quality": "amber", "Not sports content": "blue", Duplicate: "violet", "Off-brand": "red" };
    const reasons = [...data.reduce((m, r) => m.set(r.reason || "No reason", (m.get(r.reason || "No reason") || 0) + 1), new Map())].sort((x, y) => y[1] - x[1]);
    const ui = { open: box.dataset.open === "1", reason: "", q: "", picked: new Set() };
    const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
    const shown = () => data.filter((r) => (!ui.reason || (r.reason || "No reason") === ui.reason)
      && (!ui.q || `${r.title || ""} ${r.url || ""}`.toLowerCase().includes(ui.q)));
    box.innerHTML = `
      <div class="rmv-head">
        <span class="rmv-ic">${icon("trash")}</span>
        <div class="rmv-t"><b>Removed for quality</b><span><b>${num(data.length)}</b> post${data.length === 1 ? "" : "s"} hidden from the Content Library · they stay hidden in future imports</span></div>
        <button class="btn btn-sm rmv-toggle" type="button" data-rmv-toggle aria-expanded="${ui.open}">${ui.open ? "Hide" : "Review"}${icon("chevron")}</button>
      </div>
      <div class="rmv-body" ${ui.open ? "" : "hidden"} data-rmv-body>
        <div class="rmv-tools">
          <div class="rmv-chips" data-rmv-chips></div>
          <input class="input input-sm rmv-search" type="search" placeholder="Search title or link" aria-label="Search removed posts" data-rmv-q>
        </div>
        <div class="rmv-bar"><label class="rmv-all"><input class="check" type="checkbox" data-rmv-all> Select all</label><span class="spacer"></span>
          <button class="btn btn-sm" type="button" hidden data-rmv-restore-sel>${icon("undo")}<span></span></button>
          <button class="btn btn-danger btn-sm" type="button" hidden data-rmv-delete-sel>${icon("trash")}<span></span></button></div>
        <div class="rmv-list" data-rmv-list></div>
      </div>`;
    const el = (k) => $(`[data-rmv-${k}]`, box);
    const draw = () => {
      el("chips").innerHTML = [["", data.length], ...reasons].map(([k, n]) => `<button type="button" class="rmv-chip${ui.reason === k ? " is-on" : ""}${k && TONE[k] ? ` t-${TONE[k]}` : ""}" data-rmv-reason="${esc(k)}">${esc(k || "All")}<em>${num(n)}</em></button>`).join("");
      const list = shown();
      el("list").innerHTML = list.length ? list.map((r) => `<div class="rmv-row${ui.picked.has(r.external_id) ? " is-picked" : ""}">
          <input class="check" type="checkbox" data-rmv-pick="${esc(r.external_id)}"${ui.picked.has(r.external_id) ? " checked" : ""} aria-label="Select">
          <span class="rmv-thumb"${cover[r.post_id] ? ` style="background-image:url('${esc(cover[r.post_id])}')"` : ""}>${cover[r.post_id] ? "" : icon("ideas")}</span>
          <div class="rmv-info"><b title="${esc(r.title || "")}">${esc((r.title || r.external_id || "Post").slice(0, 120))}</b>
            <span><i class="rmv-reason${TONE[r.reason] ? ` t-${TONE[r.reason]}` : ""}">${esc(r.reason || "No reason")}</i>${new Date(r.removed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}${host(r.url) ? ` · ${esc(host(r.url))}` : ""}</span></div>
          <div class="rmv-acts">${r.url ? `<a class="icon-btn" href="${esc(r.url)}" target="_blank" rel="noopener" title="Open the original post" aria-label="Open the original post">${icon("external")}</a>` : ""}
            <button class="btn btn-sm rmv-restore" type="button" data-restore="${esc(r.external_id)}">${icon("undo")}Restore</button>
            <button class="icon-btn rmv-del" type="button" data-rmv-del="${esc(r.external_id)}" title="Delete for good" aria-label="Delete for good">${icon("trash")}</button></div>
        </div>`).join("") : `<p class="rmv-empty">No removed posts match.</p>`;
      const vis = list.map((r) => r.external_id);
      el("all").checked = vis.length > 0 && vis.every((x) => ui.picked.has(x));
      el("all").indeterminate = !el("all").checked && vis.some((x) => ui.picked.has(x));
      el("restore-sel").hidden = !ui.picked.size;
      $("span", el("restore-sel")).textContent = `Restore ${num(ui.picked.size)} selected`;
      el("delete-sel").hidden = !ui.picked.size;
      $("span", el("delete-sel")).textContent = `Delete ${num(ui.picked.size)} selected`;
    };
    // restore one or several: they go back to the Content Library for everyone
    const restore = async (list, btn) => {
      btn.disabled = true;
      let ok = 0;
      for (const ext of list) { const { error: err } = await A.db.rpc("restore_content_idea", { p_external_id: ext }); if (err) { A.toast(A.errMsg(err), "err"); break; } ok++; }
      if (ok) A.toast(ok === 1 ? "Post restored to the Content Library." : `${num(ok)} posts restored to the Content Library.`);
      box.dataset.open = "1"; loadRemoved();
    };
    // delete for good: the posts are erased, but they stay blocked from future imports (supabase/removed-delete.sql)
    const erase = async (list, btn) => {
      const one = list.length === 1;
      const ok = await A.confirmDialog({
        title: one ? "Delete this post for good?" : `Delete ${num(list.length)} posts for good?`,
        text: `${one ? "It's" : "They're"} erased from the database, with ${one ? "its" : "their"} filters, AI analyses and Content Plan entries. ${one ? "It stays" : "They stay"} blocked, so future imports won't bring ${one ? "it" : "them"} back. This can't be undone.`,
        confirm: one ? "Delete" : `Delete ${num(list.length)}`, danger: true,
      });
      if (!ok) return;
      btn.disabled = true;
      const { data: n, error: err } = await A.db.rpc("delete_removed_ideas", { p_external_ids: list });
      if (err) { btn.disabled = false; return A.toast(/does not exist|schema cache|Could not find/i.test(err.message) ? "Run supabase/removed-delete.sql in Supabase first." : A.errMsg(err), "err"); }
      A.toast(`${num(list.length)} post${one ? "" : "s"} deleted for good.`);
      box.dataset.open = "1"; loadRemoved();
    };
    box.onclick = (e) => {
      const t = e.target;
      if (t.closest("[data-rmv-toggle]")) { ui.open = !ui.open; box.dataset.open = ui.open ? "1" : ""; el("body").hidden = !ui.open; el("toggle").setAttribute("aria-expanded", String(ui.open)); el("toggle").innerHTML = `${ui.open ? "Hide" : "Review"}${icon("chevron")}`; return; }
      const chip = t.closest("[data-rmv-reason]");
      if (chip) { ui.reason = chip.dataset.rmvReason; return draw(); }
      const one = t.closest("[data-restore]");
      if (one) return restore([one.dataset.restore], one);
      const sel = t.closest("[data-rmv-restore-sel]");
      if (sel) return restore([...ui.picked], sel);
      const del = t.closest("[data-rmv-del]");
      if (del) return erase([del.dataset.rmvDel], del);
      const delSel = t.closest("[data-rmv-delete-sel]");
      if (delSel) return erase([...ui.picked], delSel);
    };
    box.onchange = (e) => {
      const pick = e.target.closest("[data-rmv-pick]");
      if (pick) { pick.checked ? ui.picked.add(pick.dataset.rmvPick) : ui.picked.delete(pick.dataset.rmvPick); return draw(); }
      if (e.target.matches("[data-rmv-all]")) { shown().forEach((r) => (e.target.checked ? ui.picked.add(r.external_id) : ui.picked.delete(r.external_id))); draw(); }
    };
    el("q").addEventListener("input", (e) => { ui.q = e.target.value.trim().toLowerCase(); draw(); });
    draw();
  }
  loadRemoved();

  // ---------- Bulk edit (queue of add / remove operations) ----------
  $("[data-bulk-edit]").addEventListener("click", () => {
    const ids = selectionIds();
    const queue = [];
    const m = A.modal({
      title: "Bulk Edit",
      sub: `${num(ids.length)} content idea${ids.length === 1 ? "" : "s"} selected`,
      body: `
        <p class="modal-section" style="border:0;padding:0">Add operation</p>
        <div class="grid-2">
          <label class="field"><span class="label">Action</span>
            <select class="select" data-action><option value="add">Add value to selected</option><option value="remove">Remove value from selected</option></select></label>
          <label class="field"><span class="label">Category</span>
            <select class="select" data-cat>${A.CATEGORIES.map((c) => `<option value="${c.key}">${c.label}</option>`).join("")}</select></label>
        </div>
        <div class="field"><span class="label">Value</span><div data-value></div></div>
        <div><button class="btn btn-sm" type="button" data-queue-add>+ Add to queue</button></div>
        <div data-queue></div>`,
      foot: `<button class="btn btn-ghost" type="button" data-cancel>Cancel</button><button class="btn btn-primary" type="button" data-apply disabled>Apply</button>`,
    });
    let valueSel;
    const buildValue = () => {
      const cat = $("[data-cat]", m.el).value;
      valueSel = new A.MultiSelect($("[data-value]", m.el), {
        options: catalog.byCat[cat].map((v) => ({ id: v.id, name: v.name, count: v.ideas })),
        single: true,
      });
    };
    buildValue();
    $("[data-cat]", m.el).addEventListener("change", buildValue);
    const renderQueue = () => {
      $("[data-queue]", m.el).innerHTML = queue.length
        ? `<div class="chips">${queue.map((q, i) => `<span class="chip">${q.action === "add" ? "+ Add" : "− Remove"} <b>${A.CAT_LABEL[q.category]}:</b> ${esc(q.name)}<button type="button" data-rmq="${i}" aria-label="Remove operation">×</button></span>`).join("")}</div>`
        : `<p class="hint">No operations queued yet.</p>`;
      $("[data-apply]", m.el).disabled = queue.length === 0;
      $$("[data-rmq]", m.el).forEach((b) => b.addEventListener("click", () => { queue.splice(Number(b.dataset.rmq), 1); renderQueue(); }));
    };
    renderQueue();
    $("[data-queue-add]", m.el).addEventListener("click", () => {
      const id = valueSel.value()[0];
      if (!id) return A.toast("Choose a value first.", "err");
      const category = $("[data-cat]", m.el).value;
      queue.push({ action: $("[data-action]", m.el).value, category, value_id: id, name: catalog.byId.get(id)?.name || id });
      valueSel.setSelected([]);
      renderQueue();
    });
    $("[data-cancel]", m.el).addEventListener("click", m.close);
    $("[data-apply]", m.el).addEventListener("click", async (e) => {
      e.currentTarget.disabled = true;
      try {
        let added = 0, removed = 0;
        for (const part of A.chunk(ids, 1000)) {
          const r = await rpc("bulk_edit_content_ideas", { p_ids: part, p_operations: queue.map(({ action, value_id }) => ({ action, value_id })) });
          added += r.links_added; removed += r.links_removed;
        }
        m.close();
        A.toast(`Bulk edit done: ${num(added)} links added, ${num(removed)} removed.`);
        A.resetCatalog(); load();
      } catch (err) { A.toast(A.errMsg(err), "err"); e.currentTarget.disabled = false; }
    });
  });

  load();
})();
