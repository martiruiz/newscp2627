// SCP Admin — Content Library: the same filters as Content Ideas, shown as cards with the live embed.
(async () => {
  const A = window.SCPA;
  const { $, $$, esc, icon, num, rpc } = A;
  try { await A.boot("library"); } catch { return; }
  const main = $("[data-main]");
  const PER_PAGE = 12;
  let page = 1;
  let rows = [];
  let token = 0;
  let totalPages = 1;

  main.innerHTML = `
    <div class="page-head">
      <div><h1>Content Library</h1><p data-total>Loading…</p></div>
      <div class="head-actions"><button class="btn btn-ghost" type="button" data-clear>Clear Filters</button></div>
    </div>
    <section data-filters></section>
    <div class="lib-grid" data-grid></div>
    <section class="panel" style="margin-top:18px"><div class="pager" data-pager></div></section>`;

  let catalog;
  try { catalog = await A.loadCatalog(); } catch (e) { $("[data-total]").textContent = A.errMsg(e); $("[data-total]").className = "error-text"; return; }

  const panel = new A.FilterPanel($("[data-filters]"), {
    catalog, storageKey: "scpa-library-filters", showExternalId: false,
    onChange: () => { page = 1; load(); },
  });
  $("[data-clear]").addEventListener("click", () => panel.clear());

  // Only start the platform embeds when a card scrolls into view
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const box = en.target;
      io.unobserve(box);
      const idea = rows.find((r) => r.id === Number(box.dataset.embed));
      if (!idea?.embed) continue;
      box.innerHTML = A.cleanEmbed(idea.embed);
      A.activateEmbeds(box);
    }
  }, { rootMargin: "300px" });

  async function load() {
    const my = ++token;
    $("[data-grid]").innerHTML = `<p class="muted"><span class="spinner sm"></span> Loading...</p>`;
    try {
      const res = await rpc("search_content_ideas", { ...panel.params(), p_page: page, p_per_page: PER_PAGE });
      if (my !== token) return;
      rows = res.data || [];
      totalPages = res.meta.total_pages;
      if (page > totalPages && res.meta.total > 0) { page = totalPages; return load(); }
      $("[data-total]").textContent = `${num(res.meta.total)} items · page ${num(page)} of ${num(totalPages)}`;
      render();
      A.pager($("[data-pager]"), { page, totalPages, onPage: (p) => { page = p; load(); window.scrollTo({ top: 0, behavior: "smooth" }); } });
      panel.refreshCounts();
    } catch (e) {
      if (my !== token) return;
      $("[data-grid]").innerHTML = `<p class="error-text">${esc(A.errMsg(e))}</p>`;
      $("[data-total]").textContent = "";
    }
  }

  function card(r) {
    const url = A.postUrl(r);
    const tags = A.CATEGORIES.slice().sort((a, b) => ["platform", "sport", "competition", "club", "entity", "format", "campaign", "trend"].indexOf(a.key) - ["platform", "sport", "competition", "club", "entity", "format", "campaign", "trend"].indexOf(b.key))
      .flatMap((c) => (r.tags?.[c.key] || []).map((t) => `<span class="chip"><b>${c.label}:</b> ${esc(t.name)}<button type="button" data-untag="${r.id}:${t.id}" aria-label="Remove ${esc(c.label)} ${esc(t.name)}">×</button></span>`)).join("");
    return `
      <article class="lib-card">
        <div class="lib-card-head">
          <div style="min-width:0">
            <h3 title="${esc(r.title || "")}">${esc(r.title || "(no title)")}</h3>
            <p>${A.fmtDate(r.published_at, false)} · <span class="mono">${esc(r.external_id)}</span></p>
          </div>
          <div class="lib-card-actions">
            <button class="btn btn-sm" type="button" data-edit="${r.id}">${icon("edit")}Edit</button>
            <button class="icon-btn danger" type="button" data-delete="${r.id}" title="Delete" aria-label="Delete">${icon("trash")}</button>
          </div>
        </div>
        <div class="lib-embed" data-embed="${r.id}">
          <div class="embed-fallback">${r.embed ? '<span class="spinner sm"></span>' : "No embed"}</div>
        </div>
        ${url ? `<p style="padding:10px 14px 0;font-size:12.5px"><a class="link" href="${esc(url)}" target="_blank" rel="noopener">Open on ${esc(A.platformOfUrl(url))} ↗</a></p>` : ""}
        <div class="lib-tags">${tags || '<span class="dim" style="font-size:12.5px">No filter values</span>'}</div>
      </article>`;
  }

  function render() {
    const grid = $("[data-grid]");
    grid.innerHTML = rows.length ? rows.map(card).join("") : `<p class="muted">No content ideas found</p>`;
    $$("[data-embed]", grid).forEach((el) => io.observe(el));
  }

  $("[data-grid]").addEventListener("click", async (e) => {
    const edit = e.target.closest("[data-edit]");
    const del = e.target.closest("[data-delete]");
    const untag = e.target.closest("[data-untag]");
    if (edit) A.openIdeaEditor({ idea: rows.find((r) => r.id === Number(edit.dataset.edit)), onSaved: load });
    if (del) {
      const idea = rows.find((r) => r.id === Number(del.dataset.delete));
      const ok = await A.confirmDialog({ title: "Delete content idea?", text: `“${esc(idea.title || idea.external_id)}” and all its filter links will be permanently deleted. This cannot be undone.`, confirm: "Delete", danger: true });
      if (!ok) return;
      const { error } = await A.db.from("content_ideas").delete().eq("id", idea.id);
      if (error) return A.toast(A.errMsg(error), "err");
      A.toast("Content idea deleted.");
      load();
    }
    if (untag) {
      const [ideaId, valueId] = untag.dataset.untag.split(":").map(Number);
      untag.disabled = true;
      try {
        await rpc("bulk_edit_content_ideas", { p_ids: [ideaId], p_operations: [{ action: "remove", value_id: valueId }] });
        const idea = rows.find((r) => r.id === ideaId);
        for (const k in idea.tags) idea.tags[k] = idea.tags[k].filter((t) => t.id !== valueId);
        untag.closest(".chip").remove();
      } catch (err) { A.toast(A.errMsg(err), "err"); untag.disabled = false; }
    }
  });

  load();
})();
