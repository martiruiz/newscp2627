// SCP Admin — Content Ideas: filterable table, columns, CSV export, create/edit, bulk edit and delete.
(async () => {
  const A = window.SCPA;
  const { $, $$, esc, icon, num, rpc } = A;
  try { await A.boot("ideas"); } catch { return; }
  const main = $("[data-main]");

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

  const tagNames = (row, cat) => (row.tags?.[cat] || []).map((t) => t.name).join(", ") || "—";

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
          if (c.key === "title") return `<td class="td-title" title="${esc(r.title || "")}">${esc(r.title || "(no title)")}</td>`;
          if (c.key === "id") return `<td class="td-id mono" title="${esc(r.external_id)}">${esc(r.external_id)}</td>`;
          if (c.key === "published") return `<td class="td-date">${A.fmtDate(r.published_at)}</td>`;
          return `<td class="td-tags">${esc(tagNames(r, c.key))}</td>`;
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

  // ---------- Posts that no longer exist on Instagram (marked by pipeline/library/check-embeds.mjs) ----------
  async function loadBroken() {
    const box = $("[data-broken]");
    const { count, error } = await A.db.from("content_ideas").select("id", { count: "exact", head: true }).not("unavailable_at", "is", null);
    if (error || !count) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = `<span><b>${num(count)} post${count === 1 ? "" : "s"}</b> no longer exist${count === 1 ? "s" : ""} on Instagram (deleted or made private). They're already hidden from the Content Library.</span>
      <button class="btn btn-danger btn-sm" type="button" data-delete-broken>${icon("trash")}Delete them</button>`;
    $("[data-delete-broken]", box).addEventListener("click", async () => {
      const ok = await A.confirmDialog({
        title: `Delete ${num(count)} unavailable post${count === 1 ? "" : "s"}?`,
        text: "They will be permanently deleted with all their filter links. This cannot be undone.",
        confirm: "Delete", danger: true,
      });
      if (!ok) return;
      const { error: e } = await A.db.from("content_ideas").delete().not("unavailable_at", "is", null);
      if (e) return A.toast(A.errMsg(e), "err");
      A.toast(`${num(count)} unavailable post${count === 1 ? "" : "s"} deleted.`);
      A.resetCatalog(); loadBroken(); load();
    });
  }
  loadBroken();

  // ---------- Posts a superadmin removed from the Content Library (supabase/quality.sql) ----------
  async function loadRemoved() {
    const box = $("[data-removed]");
    const { data, error } = await A.db.from("content_removals").select("*").order("removed_at", { ascending: false });
    if (error || !data?.length) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = `<span><b>${num(data.length)} post${data.length === 1 ? "" : "s"}</b> removed from the Content Library for quality. They stay hidden in future imports.</span>
      <button class="btn btn-sm" type="button" data-toggle-removed>Review</button>
      <div class="removed-list" hidden data-removed-list>${data.map((r) => `<div class="removed-row">
        <div><a href="${esc(r.url || "#")}" target="_blank" rel="noopener">${esc((r.title || r.external_id || "").slice(0, 90) || "Post")}</a>
          <div class="muted">${esc(r.reason || "No reason")} · ${new Date(r.removed_at).toLocaleDateString("en-GB")}</div></div>
        <button class="btn btn-sm" type="button" data-restore="${esc(r.external_id)}">${icon("undo")}Restore</button></div>`).join("")}</div>`;
    $("[data-toggle-removed]", box).addEventListener("click", () => { const l = $("[data-removed-list]", box); l.hidden = !l.hidden; });
    box.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-restore]");
      if (!b) return;
      b.disabled = true;
      const { error: err } = await A.db.rpc("restore_content_idea", { p_external_id: b.dataset.restore });
      if (err) { b.disabled = false; return A.toast(A.errMsg(err), "err"); }
      A.toast("Post restored to the Content Library.");
      loadRemoved();
    });
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
