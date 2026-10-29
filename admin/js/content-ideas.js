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
  let sideId = null;            // the post open in the side panel
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
    <section class="panel ci-scrape" data-scrape-box></section>
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
    // the post open in the side panel stays marked; gone from this page (another page, a filter) → the panel closes
    if (sideId !== null) { const tr = document.querySelector(`tr[data-row="${sideId}"]`); if (tr) tr.classList.add("is-open"); else closeSide(); }
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
    if (view) openSide(Number(view.dataset.view));
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

  // ---------- Posts a platform no longer shows (flagged by check-embeds.mjs, covers, views-cron, fb-shape) ----------
  // With supabase/gone-not-hidden.sql they stay in the library, flagged (gone_at), until someone keeps or deletes them here;
  // before it, they were hidden (unavailable_at). LinkedIn posts are hidden on purpose (hide-linkedin.sql): never listed here.
  async function loadBroken() {
    const box = $("[data-broken]");
    let G = true;   // gone_at exists
    const flagged = (q) => (G ? q.or("gone_at.not.is.null,unavailable_at.not.is.null") : q.not("unavailable_at", "is", null)).not("url", "ilike", "%linkedin.com%");
    let { count, error } = await flagged(A.db.from("content_ideas").select("id", { count: "exact", head: true }));
    if (error && /gone_at/.test(error.message)) { G = false; ({ count, error } = await flagged(A.db.from("content_ideas").select("id", { count: "exact", head: true }))); }
    if (error || !count) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = `<span><b>${num(count)} post${count === 1 ? "" : "s"}</b> ${G ? `the platform no longer shows (deleted, private or with embedding switched off). They're still in the Content Library: keep them or delete them.` : `no longer exist${count === 1 ? "s" : ""} on Instagram or Facebook (deleted or made private). They're already hidden from the Content Library.`}</span>
      <span class="brk-btns"><button class="btn btn-sm" type="button" data-review-broken>Review</button>
      <button class="btn btn-danger btn-sm" type="button" data-delete-broken>${icon("trash")}Delete all</button></span>
      <div class="brk-list" hidden data-broken-list></div>`;
    // review: each post (cover, text, account) to recover it (back to the library) or delete it; a click on a row opens
    // its preview (bigger cover, full caption, dates, the original link)
    const posts = new Map();
    const when = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");
    const IMG = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>`;
    const acts = `<span class="brk-acts"><button class="btn btn-sm" type="button" data-cover title="Add its cover">${IMG}Cover</button><button class="btn btn-sm" type="button" data-keep>${icon(G ? "check" : "undo")}${G ? "Keep" : "Recover"}</button><button class="btn btn-danger btn-sm" type="button" data-del aria-label="Delete">${icon("trash")}</button></span>`;
    $("[data-review-broken]", box).addEventListener("click", async () => {
      const list = $("[data-broken-list]", box);
      if (!list.hidden) { list.hidden = true; return; }
      const { data } = await flagged(A.db.from("content_ideas").select(`id,title,url,account,account_platform,cover_url,published_at,unavailable_at${G ? ",gone_at" : ""}`)).order(G ? "gone_at" : "unavailable_at", { ascending: false, nullsFirst: false }).limit(300);
      (data || []).forEach((p) => posts.set(String(p.id), p));
      list.innerHTML = (data || []).map((p) => `<div class="brk-row" data-id="${p.id}" role="button" tabindex="0" aria-expanded="false">
          <span class="brk-th"${p.cover_url ? ` style="background-image:url('${esc(p.cover_url)}')"` : ""}></span>
          <span class="brk-tx"><b>${esc(p.title || p.url)}</b><small>${esc([p.account, p.account_platform, when(p.published_at)].filter(Boolean).join(" · "))}</small></span>${acts}</div>`).join("")
        + (count > 300 ? `<small>Showing the latest 300 of ${num(count)}.</small>` : "");
      list.hidden = false;
    });
    const preview = (row) => {
      const open = row.nextElementSibling?.matches(".brk-pv");
      $$(".brk-pv, .brk-cv", box).forEach((el) => { el.previousElementSibling?.setAttribute("aria-expanded", "false"); el.remove(); });
      if (open) return;
      const p = posts.get(row.dataset.id); if (!p) return;
      row.setAttribute("aria-expanded", "true");
      row.insertAdjacentHTML("afterend", `<div class="brk-pv" data-id="${p.id}">
          <div class="brk-pv-img">${p.cover_url ? `<img src="${esc(p.cover_url)}" alt="" loading="lazy">` : A.libPreview(p.url, { gone: G, title: p.title, who: p.account })}</div>
          <div class="brk-pv-body"><p class="brk-pv-acc">${esc([p.account, p.account_platform].filter(Boolean).join(" · "))}</p>
            <p class="brk-pv-cap">${esc(p.title || "")}</p>
            <dl><dt>Published</dt><dd>${esc(when(p.published_at) || "–")}</dd><dt>Marked unavailable</dt><dd>${esc(when(p.gone_at || p.unavailable_at))}</dd></dl>
            <a href="${esc(p.url)}" target="_blank" rel="noopener">${icon("external")}Open the original</a>
            <div class="brk-pv-acts"><button class="btn btn-sm" type="button" data-keep>${icon(G ? "check" : "undo")}${G ? "Keep: it's fine" : "Recover: show it in the library again"}</button><button class="btn btn-danger btn-sm" type="button" data-del>${icon("trash")}Delete</button></div></div></div>`);
    };
    // ---------- Cover of a post: look for it again on the platform (Edge Function "covers"), or upload / paste / drop an image
    // (e.g. a screenshot of the post) → Storage covers/{id/1000}/{id}-m.jpg (supabase/cover-upload.sql) ----------
    const coverPanel = (row) => {
      const open = row.nextElementSibling?.matches(".brk-cv");
      $$(".brk-cv, .brk-pv", box).forEach((el) => { el.previousElementSibling?.setAttribute("aria-expanded", "false"); el.remove(); });
      if (open) return;
      const p = posts.get(row.dataset.id); if (!p) return;
      row.insertAdjacentHTML("afterend", `<div class="brk-cv" data-id="${p.id}" tabindex="-1">
          <button class="btn btn-sm" type="button" data-cv-find>${icon("search")}Look for it on ${esc(p.account_platform === "facebook" ? "Facebook" : "Instagram")}</button>
          <label class="brk-cv-drop" data-cv-drop>${IMG}<span><b>Upload an image</b><small>Click, drop it here or paste it (Ctrl+V). A screenshot of the post works.</small></span>
            <input type="file" accept="image/*" hidden data-cv-file></label>
          <a href="${esc(p.url)}" target="_blank" rel="noopener">${icon("external")}Open the original</a>
          <p class="brk-cv-msg" data-cv-msg></p></div>`);
      $(".brk-cv", box).focus();
    };
    const setRowCover = (id, url) => {
      const p = posts.get(String(id)); if (p) p.cover_url = url;
      $$(`.brk-row[data-id="${id}"] .brk-th`, box).forEach((th) => { th.style.backgroundImage = `url('${url}')`; });
    };
    const cvMsg = (id, text, bad) => { const el = $(`.brk-cv[data-id="${id}"] [data-cv-msg]`, box); if (el) { el.textContent = text; el.classList.toggle("is-bad", !!bad); } };
    // an image file → JPEG (max 1080 px wide) → Storage → the post's cover and shape
    async function uploadCover(id, file) {
      if (!file || !/^image\//.test(file.type)) return cvMsg(id, "That isn't an image.", true);
      cvMsg(id, "Uploading…");
      try {
        const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = URL.createObjectURL(file); });
        const k = Math.min(1, 1080 / img.naturalWidth), cv = document.createElement("canvas");
        cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(img.src);
        const blob = await new Promise((ok) => cv.toBlob(ok, "image/jpeg", 0.85));
        const path = `${Math.floor(id / 1000)}/${id}-m.jpg`;
        const up = await A.db.storage.from("covers").upload(path, blob, { contentType: "image/jpeg", upsert: true, cacheControl: "31536000" });
        if (up.error) throw new Error(/policy|row-level|not allowed|unauthorized/i.test(up.error.message) ? "Run supabase/cover-upload.sql in Supabase first (it lets admins upload covers)." : up.error.message);
        const url = `${A.db.storage.from("covers").getPublicUrl(path).data.publicUrl}?v=${Date.now().toString(36)}`;
        const { error } = await A.db.from("content_ideas").update({ cover_url: url, cover_at: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
        await A.db.rpc("apply_media_shape", { p_rows: [{ id, width: cv.width, height: cv.height }] }).catch(() => {});
        setRowCover(id, url);
        cvMsg(id, G ? "Cover added." : "Cover added. Press Recover to show the post in the library again.");
      } catch (err) { cvMsg(id, A.errMsg(err), true); }
    }
    // the platform again (same function as the import): found → cover saved; gone → stays hidden
    async function findCover(id, btn) {
      btn.disabled = true; cvMsg(id, "Looking for it…");
      try {
        const cfg = window.SCP_CONFIG || {};
        const session = (await A.db.auth.getSession()).data.session;
        const r = await fetch(`${cfg.supabaseUrl}/functions/v1/covers`, { method: "POST", headers: { "Content-Type": "application/json", apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify({ ids: [id] }) }).catch(() => null);
        const d = r ? await r.json().catch(() => ({})) : {};
        if (!r?.ok) throw new Error(d.error || "The covers function didn't answer.");
        if (d.done) {
          const { data } = await A.db.from("content_ideas").select("cover_url").eq("id", id).single();
          if (data?.cover_url) setRowCover(id, data.cover_url);
          cvMsg(id, G ? "Found it: the post exists and its cover is saved." : "Found it: the post exists and its cover is saved. Press Recover to show it in the library again.");
        } else cvMsg(id, d.removed ? "The platform says the post is gone or private. Upload an image if you know it's there." : "No image found on the platform (it may be blocking us). Upload an image instead.", true);
      } catch (err) { cvMsg(id, A.errMsg(err), true); }
      btn.disabled = false;
    }
    box.addEventListener("change", (e) => { if (e.target.matches("[data-cv-file]")) { const id = Number(e.target.closest(".brk-cv").dataset.id); uploadCover(id, e.target.files[0]); e.target.value = ""; } });
    box.addEventListener("dragover", (e) => { const d = e.target.closest?.("[data-cv-drop]"); if (d) { e.preventDefault(); d.classList.add("is-over"); } });
    box.addEventListener("dragleave", (e) => { e.target.closest?.("[data-cv-drop]")?.classList.remove("is-over"); });
    box.addEventListener("drop", (e) => { const d = e.target.closest?.("[data-cv-drop]"); if (!d) return; e.preventDefault(); d.classList.remove("is-over"); uploadCover(Number(d.closest(".brk-cv").dataset.id), e.dataTransfer.files[0]); });
    // paste anywhere on the page while a cover panel is open (one listener for the page, whatever the redraws)
    if (!window.__brkPaste) window.__brkPaste = document.addEventListener("paste", (e) => window.__brkPasteFn?.(e)) || true;
    window.__brkPasteFn = (e) => {
      const cvBox = $(".brk-cv", box); if (!cvBox) return;
      const f = [...(e.clipboardData?.files || [])].find((x) => /^image\//.test(x.type)); if (!f) return;
      e.preventDefault(); uploadCover(Number(cvBox.dataset.id), f);
    };
    $("[data-broken-list]", box).addEventListener("click", async (e) => {
      const find = e.target.closest("[data-cv-find]");
      if (find) return findCover(Number(find.closest(".brk-cv").dataset.id), find);
      if (e.target.closest(".brk-cv")) return;
      const cvb = e.target.closest("[data-cover]");
      if (cvb) return coverPanel(cvb.closest(".brk-row") || cvb.closest(".brk-pv")?.previousElementSibling);
      const b = e.target.closest("[data-keep],[data-del]");
      if (!b) { const row = e.target.closest(".brk-row"); if (row && !e.target.closest("a")) preview(row); return; }
      const holder = b.closest("[data-id]"), id = holder.dataset.id;
      const q = A.db.from("content_ideas");
      const { error: e2 } = b.matches("[data-keep]") ? await q.update(G ? { unavailable_at: null, gone_at: null } : { unavailable_at: null }).eq("id", Number(id)) : await q.delete().eq("id", Number(id));
      if (e2) return A.toast(A.errMsg(e2), "err");
      $$(`[data-id="${id}"]`, box).forEach((el) => el.remove());
      A.toast(b.matches("[data-keep]") ? (G ? "Kept: no longer flagged." : "Back in the Content Library.") : "Post deleted.");
      A.resetCatalog();
    });
    $("[data-broken-list]", box).addEventListener("keydown", (e) => { const row = e.target.closest?.(".brk-row"); if (row && (e.key === "Enter" || e.key === " ") && e.target === row) { e.preventDefault(); preview(row); } });
    $("[data-delete-broken]", box).addEventListener("click", async () => {
      const ok = await A.confirmDialog({
        title: `Delete ${num(count)} unavailable post${count === 1 ? "" : "s"}?`,
        text: "They will be permanently deleted with all their filter links. This cannot be undone.",
        confirm: "Delete", danger: true,
      });
      if (!ok) return;
      const { error: e } = await flagged(A.db.from("content_ideas").delete());
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

  // ---------- Bulk edit: tags to add (search any filter value) and tags to take away (the ones the selected posts have,
  // or any value searched), one Apply ----------
  const catLabel = (k) => A.CAT_LABEL[k] || k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
  const allValues = () => [...catalog.byId.values()];
  const fold = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  $("[data-bulk-edit]").addEventListener("click", () => {
    const ids = selectionIds();
    const add = new Map(), remove = new Map();   // value id → value
    // the tags the selected posts on this page already have, with how many of them have each
    const have = new Map();
    rows.filter((r) => allFiltered ? allFiltered.includes(r.id) : selected.has(r.id)).forEach((r) => Object.values(r.tags || {}).flat().forEach((t) => {
      const v = catalog.byId.get(Number(t.id)) || { id: Number(t.id), name: t.name, category: "" };
      have.set(v.id, { v, n: (have.get(v.id)?.n || 0) + 1 });
    }));
    const m = A.modal({
      title: "Bulk Edit",
      sub: `${num(ids.length)} content idea${ids.length === 1 ? "" : "s"} selected`,
      body: `
        <div class="bk-sec"><p class="bk-h">${icon("plus")}Add tags</p>
          <input class="input" type="search" placeholder="Search a club, sport, sponsor, moment…" autocomplete="off" data-bk-q="add">
          <div class="bk-sugg" data-bk-sugg="add" hidden></div><div class="bk-chips" data-bk-list="add"></div></div>
        <div class="bk-sec"><p class="bk-h">${icon("trash")}Remove tags</p>
          ${have.size ? `<p class="hint">Tags the selected posts on this page have. Click one to remove it from all of them.</p><div class="bk-chips" data-bk-have></div>` : ""}
          <input class="input" type="search" placeholder="Or search any tag to remove…" autocomplete="off" data-bk-q="remove">
          <div class="bk-sugg" data-bk-sugg="remove" hidden></div><div class="bk-chips" data-bk-list="remove"></div></div>`,
      foot: `<span class="bk-sum" data-bk-sum></span><button class="btn btn-ghost" type="button" data-cancel>Cancel</button><button class="btn btn-primary" type="button" data-apply disabled>Apply changes</button>`,
    });
    const chip = (v, kind, extra = "") => `<button type="button" class="bk-chip is-${kind}" data-bk-x="${kind}" data-id="${v.id}"><small>${esc(catLabel(v.category))}</small>${esc(v.name)}${extra}<i aria-hidden="true">${kind === "have" ? "−" : "×"}</i></button>`;
    const draw = () => {
      $("[data-bk-list=add]", m.el).innerHTML = [...add.values()].map((v) => chip(v, "add")).join("");
      $("[data-bk-list=remove]", m.el).innerHTML = [...remove.values()].filter((v) => !have.has(v.id)).map((v) => chip(v, "remove")).join("");
      const hv = $("[data-bk-have]", m.el);
      if (hv) hv.innerHTML = [...have.values()].sort((a, b) => b.n - a.n).map(({ v, n }) => chip(v, remove.has(v.id) ? "remove" : "have", ` <em>${num(n)}</em>`)).join("");
      const n = add.size + remove.size;
      $("[data-bk-sum]", m.el).textContent = n ? `${add.size ? `+${add.size}` : ""}${add.size && remove.size ? " · " : ""}${remove.size ? `−${remove.size}` : ""}` : "";
      $("[data-apply]", m.el).disabled = n === 0;
    };
    const suggest = (kind) => {
      const box = $(`[data-bk-sugg=${kind}]`, m.el), q = fold($(`[data-bk-q=${kind}]`, m.el).value.trim());
      if (q.length < 2) { box.hidden = true; return; }
      const hits = allValues().filter((v) => fold(v.name).includes(q)).sort((a, b) => (fold(a.name).startsWith(q) ? 0 : 1) - (fold(b.name).startsWith(q) ? 0 : 1) || b.ideas - a.ideas).slice(0, 12);
      box.innerHTML = hits.length ? hits.map((v) => `<button type="button" data-bk-pick="${kind}" data-id="${v.id}"><span>${esc(v.name)}</span><small>${esc(catLabel(v.category))} · ${num(v.ideas)}</small></button>`).join("") : `<p class="hint">No tag found</p>`;
      box.hidden = false;
    };
    $$("[data-bk-q]", m.el).forEach((inp) => inp.addEventListener("input", () => suggest(inp.dataset.bkQ)));
    m.el.addEventListener("click", (e) => {
      const pick = e.target.closest("[data-bk-pick]");
      if (pick) {
        const v = catalog.byId.get(Number(pick.dataset.id)), kind = pick.dataset.bkPick;
        (kind === "add" ? add : remove).set(v.id, v);
        (kind === "add" ? remove : add).delete(v.id);
        $(`[data-bk-q=${kind}]`, m.el).value = ""; $(`[data-bk-sugg=${kind}]`, m.el).hidden = true;
        return draw();
      }
      const x = e.target.closest("[data-bk-x]");
      if (x) {
        const id = Number(x.dataset.id), kind = x.dataset.bkX;
        if (kind === "add") add.delete(id);
        else if (kind === "have") { remove.set(id, have.get(id).v); add.delete(id); }
        else remove.delete(id);
        return draw();
      }
    });
    draw();
    $("[data-cancel]", m.el).addEventListener("click", m.close);
    const applyBtn = $("[data-apply]", m.el);
    applyBtn.addEventListener("click", async () => {
      const ops = [...[...add.keys()].map((value_id) => ({ action: "add", value_id })), ...[...remove.keys()].map((value_id) => ({ action: "remove", value_id }))];
      applyBtn.disabled = true; applyBtn.textContent = "Applying…";
      try {
        let added = 0, removed = 0;
        for (const part of A.chunk(ids, 1000)) {
          const r = await rpc("bulk_edit_content_ideas", { p_ids: part, p_operations: ops });
          added += r.links_added; removed += r.links_removed;
        }
        m.close();
        A.toast(`Bulk edit done: ${num(added)} links added, ${num(removed)} removed.`);
        A.resetCatalog(); load();
      } catch (err) { A.toast(A.errMsg(err), "err"); applyBtn.disabled = false; applyBtn.textContent = "Apply changes"; }
    });
  });

  // ---------- Side panel: a click on a row (not on its checkbox, buttons or links) opens the post in a column on the
  // right — preview, link, its tags to remove (×) or add (search any value), ↑ / ↓ to the previous / next post ----------
  const side = document.createElement("aside");
  side.className = "ci-side"; side.hidden = true; side.setAttribute("aria-label", "Post");
  document.body.append(side);
  const sideRow = () => rows.find((r) => r.id === sideId);
  const tagsOf = (r) => Object.entries(r.tags || {}).flatMap(([cat, list]) => (list || []).map((t) => ({ id: Number(t.id), name: t.name, category: cat })));
  function openSide(id) {
    const r = rows.find((x) => x.id === id); if (!r) return;
    sideId = id; side.hidden = false; document.body.classList.add("ci-side-open");
    $$("tr[data-row].is-open").forEach((tr) => tr.classList.remove("is-open"));
    document.querySelector(`tr[data-row="${id}"]`)?.classList.add("is-open");
    const url = A.postUrl(r), i = rows.indexOf(r);
    side.innerHTML = `
      <header class="ci-side-h"><div><p class="ci-side-t">${esc(r.title || "(no title)")}</p><p class="ci-side-s">${A.fmtDate(r.published_at)} · <span class="mono">${esc(r.external_id)}</span></p></div>
        <span class="ci-side-nav"><button class="icon-btn" type="button" data-side-step="-1" aria-label="Previous" ${i <= 0 ? "disabled" : ""}>↑</button><button class="icon-btn" type="button" data-side-step="1" aria-label="Next" ${i >= rows.length - 1 ? "disabled" : ""}>↓</button><button class="icon-btn" type="button" data-side-close aria-label="Close">×</button></span></header>
      <div class="ci-side-b">
        <div class="embed-preview" data-embed>${r.embed ? A.cleanEmbed(r.embed) : '<p class="muted">No embed.</p>'}</div>
        ${url ? `<a class="link" href="${esc(url)}" target="_blank" rel="noopener">Open on ${esc(A.platformOfUrl(url))} ↗</a>` : ""}
        <p class="ci-side-k">Tags</p>
        <div class="bk-chips" data-side-tags>${tagsOf(r).map((t) => `<button type="button" class="bk-chip is-have" data-side-rm="${t.id}" title="Remove"><small>${esc(catLabel(t.category))}</small>${esc(t.name)}<i aria-hidden="true">×</i></button>`).join("") || '<span class="muted">No tags yet.</span>'}</div>
        <input class="input" type="search" placeholder="Add a tag: club, sport, sponsor, moment…" autocomplete="off" data-side-q>
        <div class="bk-sugg" data-side-sugg hidden></div>
      </div>
      <footer class="ci-side-f"><button class="btn btn-sm" type="button" data-side-edit>${icon("edit")}Edit all</button></footer>`;
    A.activateEmbeds($("[data-embed]", side));
  }
  function closeSide() {
    sideId = null; side.hidden = true; side.innerHTML = ""; document.body.classList.remove("ci-side-open");
    $$("tr[data-row].is-open").forEach((tr) => tr.classList.remove("is-open"));
  }
  // one tag on / off for the open post, saved at once; the row and the panel show it straight away
  async function sideTag(action, valueId) {
    const r = sideRow(); if (!r) return;
    try {
      await rpc("bulk_edit_content_ideas", { p_ids: [r.id], p_operations: [{ action, value_id: valueId }] });
      const v = catalog.byId.get(valueId); const cat = v?.category;
      r.tags ||= {};
      if (action === "add" && cat) r.tags[cat] = [...(r.tags[cat] || []).filter((t) => Number(t.id) !== valueId), { id: valueId, name: v.name }];
      if (action === "remove") for (const k in r.tags) r.tags[k] = r.tags[k].filter((t) => Number(t.id) !== valueId);
      A.resetCatalog();
      const keep = sideId; render(); openSide(keep);
      if (action === "add") $("[data-side-q]", side)?.focus();
    } catch (err) { A.toast(A.errMsg(err), "err"); }
  }
  side.addEventListener("click", (e) => {
    if (e.target.closest("[data-side-close]")) return closeSide();
    const st = e.target.closest("[data-side-step]");
    if (st) { const i = rows.findIndex((r) => r.id === sideId) + Number(st.dataset.sideStep); if (rows[i]) openSide(rows[i].id); return; }
    const rm = e.target.closest("[data-side-rm]"); if (rm) return sideTag("remove", Number(rm.dataset.sideRm));
    const pick = e.target.closest("[data-side-pick]"); if (pick) return sideTag("add", Number(pick.dataset.sidePick));
    if (e.target.closest("[data-side-edit]")) A.openIdeaEditor({ idea: sideRow(), onSaved: () => { const keep = sideId; load().then?.(() => openSide(keep)); } });
  });
  side.addEventListener("input", (e) => {
    if (!e.target.matches("[data-side-q]")) return;
    const box = $("[data-side-sugg]", side), q = fold(e.target.value.trim());
    if (q.length < 2) { box.hidden = true; return; }
    const has = new Set(tagsOf(sideRow() || {}).map((t) => t.id));
    const hits = allValues().filter((v) => !has.has(v.id) && fold(v.name).includes(q)).sort((a, b) => (fold(a.name).startsWith(q) ? 0 : 1) - (fold(b.name).startsWith(q) ? 0 : 1) || b.ideas - a.ideas).slice(0, 10);
    box.innerHTML = hits.length ? hits.map((v) => `<button type="button" data-side-pick="${v.id}"><span>${esc(v.name)}</span><small>${esc(catLabel(v.category))} · ${num(v.ideas)}</small></button>`).join("") : '<p class="hint">No tag found</p>';
    box.hidden = false;
  });
  document.addEventListener("keydown", (e) => {
    if (sideId === null || e.target.closest?.("input, textarea, select, .modal")) return;
    if (e.key === "Escape") closeSide();
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); const i = rows.findIndex((r) => r.id === sideId) + (e.key === "ArrowDown" ? 1 : -1); if (rows[i]) openSide(rows[i].id); }
  });
  $("[data-tbody]").addEventListener("click", (e) => {
    if (e.target.closest("input, button, a, label")) return;
    const tr = e.target.closest("tr[data-row]");
    if (tr) Number(tr.dataset.row) === sideId ? closeSide() : openSide(Number(tr.dataset.row));
  });

  // ---------- Scrape an account: any club, player, creator, competition, media… (Bright Data → the library) ----------
  // Its tags: copied from the account's other posts when it has any (admin_account_tags), else chosen here (or created).
  // The collection runs in core.js (scrapeAndImport) and shows as a console; the posts go to the library with their covers.
  const SC_TAB = Math.random().toString(36).slice(2);
  const SC_STEPS = ["Bright Data", "Collecting posts", "Importing", "Tags", "Covers", "Done"];
  const SC_CATS = ["entity", "club", "sport", "competition"];
  const scBox = $("[data-scrape-box]");
  scBox.innerHTML = `
    <div class="ci-sc-h"><b>${icon("download")}Scrape an account</b><small>Any club, player, creator, competition or media outlet: its latest posts come into the library with their tags.</small></div>
    <form class="ci-sc-f" data-sc-form autocomplete="off">
      <select class="select" name="platform"><option value="instagram">Instagram</option><option value="tiktok">TikTok</option></select>
      <label class="ci-sc-handle"><span>@</span><input class="input" name="handle" placeholder="account (e.g. realmadrid, lamine.yamal)" required></label>
      <select class="select" name="num" title="How many posts"><option value="10">10 posts</option><option value="25">25 posts</option><option value="50">50 posts</option></select>
      <button class="btn btn-primary" type="submit" data-sc-go>${icon("download")}Scrape</button>
    </form>
    <div class="ci-sc-tags" data-sc-tags hidden>
      <p class="hint" data-sc-hint></p>
      <div class="ci-sc-grid">${SC_CATS.map((k) => `<div class="field"><span class="label">${esc(A.CATEGORIES.find((c) => c.key === k).label)}</span><div data-sc-ms="${k}"></div></div>`).join("")}</div>
    </div>
    <div class="ci-sc-live" data-sc-live></div>`;
  const scForm = $("[data-sc-form]", scBox);
  const scMs = {};
  for (const k of SC_CATS) scMs[k] = new A.MultiSelect($(`[data-sc-ms="${k}"]`, scBox), { single: true,
    options: catalog.byCat[k].map((v) => ({ id: v.id, name: v.name, count: v.ideas })), onCreate: async (name) => ({ id: -Date.now(), name }) });
  const scHandle = () => scForm.handle.value.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?(instagram|tiktok)\.com\/@?/, "").replace(/\/.*$/, "").toLowerCase();
  // the account's tags from its other posts, as soon as it's typed
  const scLookup = A.debounce(async () => {
    const h = scHandle(), tags = $("[data-sc-tags]", scBox), hint = $("[data-sc-hint]", scBox);
    if (h.length < 2) { tags.hidden = true; return; }
    tags.hidden = false;
    const got = await rpc("admin_account_tags", { p_platform: scForm.platform.value, p_account: h }).catch(() => ({}));
    const n = Object.values(got || {}).flat().length;
    for (const k of SC_CATS) scMs[k].setSelected((got?.[k] || []).slice(0, 1));
    hint.textContent = n ? `@${h} is already in SCP: its tags are taken from its other posts (change them if you want).` : `@${h} is new in SCP: choose its tags (they go on every post). Type to create one.`;
  }, 450);
  scForm.handle.addEventListener("input", scLookup);
  scForm.platform.addEventListener("change", scLookup);

  const scJobs = new Map();
  let scTimer = 0;
  const scMmss = (ms) => { const x = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, "0")}`; };
  function scRender() {
    const list = [...scJobs.values()];
    $("[data-sc-live]", scBox).innerHTML = list.map((j) => `<article class="mcl-job${j.error ? " is-err" : j.done ? " is-done" : ""}">
      <div class="mcl-job-h"><b>${j.platform === "tiktok" ? "TikTok" : "Instagram"} @${esc(j.handle)}</b><span class="mono">${scMmss((j.end || Date.now()) - j.t0)}</span>
        ${!j.done && !j.error && j.snap ? `<button class="mcl-job-x" type="button" data-sc-cancel="${esc(j.id)}">✕ Cancel</button>` : ""}${j.done || j.error ? `<button class="mcl-job-close" type="button" data-sc-close="${esc(j.id)}" aria-label="Close">✕</button>` : ""}
        <span class="mcl-job-st">${j.error ? `${icon("alert")}${esc(j.error)}` : j.done ? `${icon("check")}${num(j.n)} posts in the library` : `<i class="hk-dot"></i>${esc(SC_STEPS[j.step])}${j.step === 1 && j.records ? ` · ${num(j.records)} posts so far` : ""}`}</span></div>
      <ol class="mcl-steps">${SC_STEPS.map((t, k) => `<li class="${k < j.step || j.done ? "is-ok" : k === j.step && !j.error ? "is-on" : k === j.step && j.error ? "is-err" : ""}">${esc(t)}</li>`).join("")}</ol>
      <div class="mcl-job-log${j.done || j.error ? "" : " is-live"}"><p class="is-cmd">scp@ideas:~$ scrape --${esc(j.platform)} @${esc(j.handle)} --posts ${j.num}</p>${j.log.slice(-7).map(([t, k, x]) => `<p class="is-${k}${Date.now() - t < 900 ? " is-new" : ""}"><span>[${scMmss(t - j.t0)}]</span>${esc(x)}</p>`).join("")}${j.done || j.error ? "" : `<p class="is-prompt">&gt; <i class="hk-cur"></i></p>`}</div>
    </article>`).join("");
    clearInterval(scTimer);
    if (list.some((j) => !j.done && !j.error)) scTimer = setInterval(scRender, 1000);
  }
  async function scrapeAccount(platform, handle, n, tagNames) {
    const id = `${platform}|${handle}`;
    if (scJobs.get(id) && !scJobs.get(id).done && !scJobs.get(id).error) return A.toast(`@${handle} is already being scraped`);
    const job = { id, platform, handle, num: n, step: 0, t0: Date.now(), log: [], records: 0, n: 0 };
    scJobs.set(id, job);
    const log = (kind, text) => { job.log.push([Date.now(), kind, text]); scRender(); };
    const step = (k, text) => { job.step = k; log("step", text); };
    const tagKey = `scp-scrape-tags:ideas:${id}`;   // the chosen tags, for a reload in the middle
    try { localStorage.setItem(tagKey, JSON.stringify(tagNames)); } catch {}
    try {
      const { rows, out } = await A.scrapeAndImport({ platform, handle, num: n, job, log, step, say: () => {}, tab: SC_TAB,
        key: `scp-scrape:ideas:${id}`, filename: `Bright Data · @${handle} · Content ideas`,
        mapRows: (r) => ({ ...r, ...tagNames }) });
      step(3, "Tags");
      log("ok", Object.keys(tagNames).length ? `Tagged: ${Object.entries(tagNames).map(([k, v]) => `${k} ${v}`).join(" · ")}` : "No tags chosen (only platform and format)");
      const { data: ids } = await A.db.from("content_ideas").select("id").in("external_id", rows.map((r) => r.external_id));
      step(4, `Loading ${num((ids || []).length)} covers`);
      await A.loadCovers((ids || []).map((x) => x.id));
      const { count: withCover } = await A.db.from("content_ideas").select("id", { count: "exact", head: true }).in("external_id", rows.map((r) => r.external_id)).not("cover_url", "is", null);
      log("ok", `${num(withCover || 0)} of ${num(rows.length)} with cover`);
      job.n = out.created + out.replaced; job.step = 5; job.done = true; job.end = Date.now();
      log("ok", `Done: ${num(job.n)} posts in the library`);
      A.toast(`@${handle}: ${num(job.n)} posts in the library.`);
      try { localStorage.removeItem(tagKey); } catch {}
      A.resetCatalog(); load();
    } catch (x) {
      if (!localStorage.getItem(`scp-scrape:ideas:${id}`)) try { localStorage.removeItem(tagKey); } catch {}
      job.error = x.message || String(x); job.end = Date.now(); log("err", job.error);
    }
  }
  scForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const h = scHandle();
    if (!/^[\w.]{2,30}$/.test(h)) return A.toast("Type the account's @name", "err");
    const tagNames = {};
    for (const k of SC_CATS) { const v = scMs[k].value()[0]; if (v != null) tagNames[k] = scMs[k].nameOf(v); }
    scrapeAccount(scForm.platform.value, h, Number(scForm.num.value), tagNames);
    scForm.handle.value = ""; $("[data-sc-tags]", scBox).hidden = true;
  });
  scBox.addEventListener("click", async (e) => {
    const c = e.target.closest("[data-sc-close]"); if (c) { scJobs.delete(c.dataset.scClose); return scRender(); }
    const x = e.target.closest("[data-sc-cancel]"); if (!x) return;
    const j = scJobs.get(x.dataset.scCancel); if (!j?.snap) return;
    x.disabled = true;
    const { data, error } = await A.db.functions.invoke("club-scrape", { body: { action: "cancel", snapshot_id: j.snap } });
    if (error || data?.error) { x.disabled = false; return A.toast(data?.error || "Bright Data didn't answer.", "err"); }
    try { localStorage.removeItem(`scp-scrape:ideas:${j.id}`); } catch {}
    j.cancelled = true; j.log.push([Date.now(), "warn", `Cancelled at Bright Data (${j.snap})`]); scRender();
  });
  // collections started before a reload (and not kept by another open tab) carry on
  for (const k of Object.keys(localStorage).filter((x) => x.startsWith("scp-scrape:ideas:"))) {
    let sv = null; try { sv = JSON.parse(localStorage.getItem(k)); } catch {}
    if (!sv || (sv.tab && sv.tab !== SC_TAB && Date.now() - (sv.beat || 0) < 25000)) continue;
    const [platform, handle] = k.slice("scp-scrape:ideas:".length).split("|");
    let tags = {}; try { tags = JSON.parse(localStorage.getItem(`scp-scrape-tags:ideas:${platform}|${handle}`) || "{}"); } catch {}
    scrapeAccount(platform, handle, 10, tags);
  }

  load();
})();
