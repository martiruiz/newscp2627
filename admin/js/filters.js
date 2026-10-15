// SCP Admin — Filters: manage the catalog values of every filter category.
(async () => {
  const A = window.SCPA;
  const { $, $$, esc, icon, num, rpc } = A;
  try { await A.boot("filters"); } catch { return; }
  const main = $("[data-main]");
  let current = A.store.get("scpa-filters-cat", "sport");
  let catalog, totals = {};

  main.innerHTML = `
    <div class="page-head"><div><h1>Filters</h1><p>Manage catalog values for all filter categories</p></div></div>
    <div class="catalog">
      <nav class="panel cat-list" aria-label="Categories" data-cats></nav>
      <section class="panel" data-values><p class="muted panel-pad">Loading...</p></section>
    </div>`;

  async function load() {
    try {
      [catalog, totals] = await Promise.all([
        A.loadCatalog(true),
        rpc("catalog_category_totals").then((r) => Object.fromEntries((r || []).map((x) => [x.category, Number(x.ideas)]))),
      ]);
      renderCats(); renderValues();
    } catch (e) { $("[data-values]").innerHTML = `<p class="error-text panel-pad">${esc(A.errMsg(e))}</p>`; }
  }

  function renderCats() {
    $("[data-cats]").innerHTML = `<p class="cap">Categories</p>` + A.CATALOG_ORDER.map((k) =>
      `<button type="button" data-cat="${k}" aria-current="${k === current}">${A.CAT_LABEL[k]}<span class="n">${num(catalog.byCat[k].length)}</span></button>`).join("");
    $$("[data-cat]").forEach((b) => b.addEventListener("click", () => { current = b.dataset.cat; A.store.set("scpa-filters-cat", current); renderCats(); renderValues(); }));
  }

  function renderValues() {
    const label = A.CAT_LABEL[current];
    const values = catalog.byCat[current];
    const box = $("[data-values]");
    box.innerHTML = `
      <div class="values-head"><h2>${label}</h2><span class="muted">${num(values.length)} values · ${num(totals[current] || 0)} linked content ideas</span></div>
      <form class="values-add" data-add><input class="input" placeholder="Add new ${esc(label)} value..." maxlength="120" required><button class="btn btn-primary" type="submit">${icon("plus")}Add</button></form>
      ${values.length > 15 ? `<div class="values-search"><input class="input" type="search" placeholder="Search ${num(values.length)} values..." data-search></div>` : ""}
      <div data-list></div>`;
    const list = $("[data-list]", box);
    const draw = (q = "") => {
      const shown = values.filter((v) => v.name.toLowerCase().includes(q.toLowerCase()));
      list.innerHTML = shown.length ? shown.map((v) => `
        <div class="value-row" data-row="${v.id}">
          <span class="name">${esc(v.name)}</span>
          <span class="ideas">${num(v.ideas)} idea${v.ideas === 1 ? "" : "s"}</span>
          <span class="acts">
            <button class="icon-btn" type="button" data-rename="${v.id}" title="Rename" aria-label="Rename">${icon("edit")}</button>
            <button class="icon-btn danger" type="button" data-del="${v.id}" title="Delete" aria-label="Delete">${icon("trash")}</button>
          </span>
        </div>`).join("") : `<p class="table-empty">No values${q ? " match your search" : " yet"}.</p>`;
    };
    draw();
    $("[data-search]", box)?.addEventListener("input", (e) => draw(e.target.value.trim()));

    $("[data-add]", box).addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = $("input", e.target);
      const name = input.value.trim().replace(/\s+/g, " ");
      if (!name) return;
      if (values.some((v) => v.name.toLowerCase() === name.toLowerCase())) return A.toast(`“${name}” already exists in ${label}.`, "err");
      const { error } = await A.db.from("idea_catalog").insert({ category: current, name });
      if (error) return A.toast(A.errMsg(error), "err");
      A.toast(`“${name}” added to ${label}.`);
      load();
    });

    list.addEventListener("click", async (e) => {
      const ren = e.target.closest("[data-rename]");
      const del = e.target.closest("[data-del]");
      if (ren) {
        const v = catalog.byId.get(Number(ren.dataset.rename));
        const row = ren.closest(".value-row");
        row.innerHTML = `<input class="input" value="${esc(v.name)}" maxlength="120" aria-label="New name"><button class="btn btn-primary btn-sm" type="button" data-ok>Save</button><button class="btn btn-ghost btn-sm" type="button" data-cancel>Cancel</button>`;
        const input = $("input", row);
        input.focus(); input.select();
        const save = async () => {
          const name = input.value.trim().replace(/\s+/g, " ");
          if (!name || name === v.name) return renderValues();
          if (values.some((x) => x.id !== v.id && x.name.toLowerCase() === name.toLowerCase())) return A.toast(`“${name}” already exists in ${label}.`, "err");
          const { error } = await A.db.from("idea_catalog").update({ name }).eq("id", v.id);
          if (error) return A.toast(A.errMsg(error), "err");
          A.toast("Value renamed.");
          load();
        };
        $("[data-ok]", row).addEventListener("click", save);
        $("[data-cancel]", row).addEventListener("click", renderValues);
        input.addEventListener("keydown", (k) => { if (k.key === "Enter") save(); if (k.key === "Escape") renderValues(); });
      }
      if (del) {
        const v = catalog.byId.get(Number(del.dataset.del));
        const ok = await A.confirmDialog({
          title: `Delete “${esc(v.name)}”?`,
          text: v.ideas ? `It will be removed from ${num(v.ideas)} content idea${v.ideas === 1 ? "" : "s"}. The ideas themselves are kept. This cannot be undone.` : "No content ideas use this value.",
          confirm: "Delete", danger: true,
        });
        if (!ok) return;
        const { error } = await A.db.from("idea_catalog").delete().eq("id", v.id);
        if (error) return A.toast(A.errMsg(error), "err");
        A.toast("Value deleted.");
        load();
      }
    });
  }

  load();
})();
