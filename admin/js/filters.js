// SCP Admin — Filters: manage the catalog values of every filter category.
(async () => {
  const A = window.SCPA;
  const { $, $$, esc, icon, num, rpc } = A;
  try { await A.boot("filters"); } catch { return; }
  const main = $("[data-main]");
  // every filter category of the Content Library (same names as there, js/library.js), in groups; a category found in the
  // catalog but not listed here still shows, under "Other"
  const GROUPS = [
    ["Where & how", [["platform", "Platform"], ["format", "Format"], ["aspect_ratio", "Aspect ratio"], ["duration", "Duration"], ["language", "Language"], ["trend", "Trend"]]],
    ["Who", [["sport", "Sport"], ["entity", "Publisher type"], ["competition", "Competition"], ["club", "Club"], ["media", "Media outlets"], ["team", "Team"]]],
    ["Occasion", [["campaign", "Campaign"], ["moment", "Campaign moment"], ["matchday_graphic", "Matchday graphic"], ["season_moment", "Season moment"], ["outcome", "Result"], ["opponent", "Opponent"], ["city", "City"], ["transfer", "Transfers"], ["kit", "Kit"]]],
    ["Story", [["angle", "Angle and tone"], ["comms", "Press and comms"], ["crisis", "Sensitive topics"]]],
    ["Brands & goals", [["sponsor", "Sponsors"], ["sponsor_sector", "Sponsor sector"], ["sponsor_integration", "Integration"], ["collab", "Collaborations"], ["goal", "Business goal"], ["cta", "Call to action"]]],
    ["Content creators", [["creator_type", "Creator type"], ["creator_language", "Creator's language"], ["creator_country", "Country"], ["creator_gender", "Gender"]]],
  ];
  const LABEL = Object.fromEntries(GROUPS.flatMap(([, cats]) => cats));
  const labelOf = (k) => LABEL[k] || A.CAT_LABEL[k] || k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
  let current = A.store.get("scpa-filters-cat", "sport");
  let catalog, totals = {}, sort = A.store.get("scpa-filters-sort", "az"), unusedOnly = false, noLogoOnly = false;
  // brands, clubs, competitions and media outlets show a logo in the Content Library: set it here (a link or an uploaded image, bucket
  // "logos" → idea_catalog.logo_url; supabase/catalog-logos.sql lets admins upload)
  const LOGO_CATS = new Set(["sponsor", "club", "competition", "media"]);
  let logos = new Map();

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
      logos = new Map();
      for (let from = 0; ; from += 1000) {   // a thousand rows per request
        const { data: lg } = await A.db.from("idea_catalog").select("id,logo_url").in("category", [...LOGO_CATS]).not("logo_url", "is", null).order("id").range(from, from + 999);
        (lg || []).forEach((r) => logos.set(r.id, r.logo_url));
        if (!lg || lg.length < 1000) break;
      }
      renderCats(); renderValues();
    } catch (e) { $("[data-values]").innerHTML = `<p class="error-text panel-pad">${esc(A.errMsg(e))}</p>`; }
  }

  function renderCats() {
    const listed = new Set(Object.keys(LABEL));
    const other = Object.keys(catalog.byCat).filter((k) => !listed.has(k) && catalog.byCat[k].length).sort();
    const BY_IDEAS = new Set(["Where & how"]);   // these groups list their categories by linked ideas, most first
    const groups = [...GROUPS.map(([g, cats]) => [g, cats.map(([k]) => k)]), ...(other.length ? [["Other", other]] : [])]
      .map(([g, ks]) => [g, BY_IDEAS.has(g) ? [...ks].sort((x, y) => (totals[y] || 0) - (totals[x] || 0)) : ks]);
    if (!groups.some(([, ks]) => ks.includes(current))) current = "sport";
    $("[data-cats]").innerHTML = groups.map(([g, ks]) => `<p class="cap">${esc(g)}</p>` + ks.map((k) =>
      `<button type="button" data-cat="${k}" aria-current="${k === current}"><span class="cat-t"><b>${esc(labelOf(k))}</b><small>${num(totals[k] || 0)} ideas</small></span><span class="n">${num((catalog.byCat[k] || []).length)}</span></button>`).join("")).join("");
    $$("[data-cat]").forEach((b) => b.addEventListener("click", () => { current = b.dataset.cat; unusedOnly = false; A.store.set("scpa-filters-cat", current); renderCats(); renderValues(); }));
  }

  function renderValues() {
    const label = labelOf(current);
    const values = catalog.byCat[current] || [];
    const box = $("[data-values]");
    const unused = values.filter((v) => !v.ideas).length;
    const withLogo = LOGO_CATS.has(current);
    const noLogo = withLogo ? values.filter((v) => !logos.get(v.id)).length : 0;
    const max = Math.max(1, ...values.map((v) => v.ideas || 0));
    box.innerHTML = `
      <div class="values-head">
        <div><p class="cap">Filter category</p><h2>${label}</h2></div>
        <div class="values-stats">
          <span><b>${num(values.length)}</b>values</span>
          <span><b>${num(totals[current] || 0)}</b>linked ideas</span>
          <span class="${unused ? "is-warn" : ""}"><b>${num(unused)}</b>unused</span>
        </div>
      </div>
      <form class="values-add" data-add><span class="values-add-ic">${icon("plus")}</span><input class="input" placeholder="Add a new ${esc(label)} value…" maxlength="120" required><button class="btn btn-primary" type="submit">Add value</button></form>
      <div class="values-tools">
        <input class="input values-q" type="search" placeholder="Search ${num(values.length)} values…" data-search>
        <div class="seg" role="group" aria-label="Sort"><button type="button" data-sort="az" aria-pressed="${sort === "az"}">A–Z</button><button type="button" data-sort="used" aria-pressed="${sort === "used"}">Most used</button></div>
        ${unused ? `<button class="vchip${unusedOnly ? " is-on" : ""}" type="button" data-unused>Unused <em>${num(unused)}</em></button>` : ""}
        ${noLogo ? `<button class="vchip${noLogoOnly ? " is-on" : ""}" type="button" data-nologo>No logo <em>${num(noLogo)}</em></button>` : ""}
      </div>
      <div class="values-list" data-list></div>`;
    const list = $("[data-list]", box);
    let q = "";
    const draw = () => {
      const shown = values.filter((v) => v.name.toLowerCase().includes(q.toLowerCase()) && (!unusedOnly || !v.ideas) && (!noLogoOnly || !logos.get(v.id)))
        .sort((a, b) => sort === "used" ? (b.ideas || 0) - (a.ideas || 0) : a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
      list.innerHTML = shown.length ? shown.map((v) => `
        <div class="value-row${v.ideas ? "" : " is-unused"}" data-row="${v.id}">
          ${withLogo ? `<button class="value-logo${logos.get(v.id) ? " has-logo" : ""}" type="button" data-logo="${v.id}" title="${logos.get(v.id) ? "Change the logo" : "Add a logo"}" aria-label="Logo">${logos.get(v.id) ? `<img src="${esc(logos.get(v.id))}" alt="" loading="lazy">` : icon("plus")}</button>` : ""}
          <span class="name">${esc(v.name)}</span>
          <span class="usage" aria-hidden="true"><i style="width:${v.ideas ? Math.max(2, Math.round((v.ideas / max) * 100)) : 0}%"></i></span>
          <span class="ideas">${v.ideas ? `<b>${num(v.ideas)}</b> idea${v.ideas === 1 ? "" : "s"}` : "Unused"}</span>
          <span class="acts">
            <button class="icon-btn" type="button" data-rename="${v.id}" title="Rename" aria-label="Rename">${icon("edit")}</button>
            <button class="icon-btn danger" type="button" data-del="${v.id}" title="Delete" aria-label="Delete">${icon("trash")}</button>
          </span>
        </div>`).join("") : `<p class="table-empty">No values${q ? " match your search" : " yet"}.</p>`;
    };
    draw();
    $("[data-search]", box).addEventListener("input", (e) => { q = e.target.value.trim(); draw(); });
    box.querySelectorAll("[data-sort]").forEach((b) => b.addEventListener("click", () => {
      sort = b.dataset.sort; A.store.set("scpa-filters-sort", sort);
      box.querySelectorAll("[data-sort]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); draw();
    }));
    $("[data-unused]", box)?.addEventListener("click", (e) => { unusedOnly = !unusedOnly; e.currentTarget.classList.toggle("is-on", unusedOnly); draw(); });
    $("[data-nologo]", box)?.addEventListener("click", (e) => { noLogoOnly = !noLogoOnly; e.currentTarget.classList.toggle("is-on", noLogoOnly); draw(); });

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
      const lg = e.target.closest("[data-logo]");
      if (lg) return logoDialog(catalog.byId.get(Number(lg.dataset.logo)));
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

  // a value's logo: paste a link to an image or upload one (PNG, JPG, WebP or SVG, up to 1 MB), or take it away
  function logoDialog(v) {
    const cur = logos.get(v.id) || "";
    const m = A.modal({ title: `Logo · ${v.name}`, body: `<form class="ms-form" data-f>
      <div class="logo-prev" data-prev>${cur ? `<img src="${esc(cur)}" alt="">` : `<span class="muted">No logo yet</span>`}</div>
      <label>Link to the image<input class="input" type="url" name="url" placeholder="https://…/logo.png" value="${esc(cur)}"></label>
      <label>Or upload an image (PNG, JPG, WebP or SVG, up to 1 MB)<input class="input" type="file" name="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"></label>
      <p class="muted ms-small">A square logo on a transparent or white background looks best. It shows in the Content Library filters.</p>
    </form>`, foot: `${cur ? `<button class="btn btn-ghost" type="button" data-rm>Remove logo</button>` : ""}<button class="btn btn-ghost" type="button" data-x>Cancel</button><button class="btn btn-primary" type="button" data-save>Save</button>` });
    const f = $("[data-f]", m.el), prev = $("[data-prev]", m.el);
    const show = (src) => { prev.innerHTML = src ? `<img src="${esc(src)}" alt="">` : `<span class="muted">No logo yet</span>`; };
    f.url.addEventListener("input", () => show(f.url.value.trim()));
    f.file.addEventListener("change", () => { const file = f.file.files[0]; if (file) show(URL.createObjectURL(file)); });
    const set = async (url, source) => {
      const { error } = await A.db.from("idea_catalog").update({ logo_url: url, logo_source: source }).eq("id", v.id);
      if (error) return A.toast(A.errMsg(error), "err");
      url ? logos.set(v.id, url) : logos.delete(v.id);
      A.toast(url ? "Logo saved." : "Logo removed."); m.close(); renderValues();
    };
    $("[data-x]", m.el).onclick = () => m.close();
    $("[data-rm]", m.el)?.addEventListener("click", () => set(null, null));
    const save = async () => {
      const btn = $("[data-save]", m.el);
      const file = f.file.files[0], url = f.url.value.trim();
      if (file) {
        if (file.size > 1048576) return A.toast("The image is over 1 MB.", "err");
        const ext = ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" })[file.type];
        if (!ext) return A.toast("Use a PNG, JPG, WebP or SVG image.", "err");
        btn.disabled = true;
        const path = `catalog/${v.id}-${Date.now()}.${ext}`;
        const { error } = await A.db.storage.from("logos").upload(path, file, { contentType: file.type, upsert: true });
        btn.disabled = false;
        if (error) return A.toast(/row-level|policy|unauthorized|403/i.test(error.message) ? "Run supabase/catalog-logos.sql in Supabase first (it lets admins upload logos)." : error.message, "err");
        return set(A.db.storage.from("logos").getPublicUrl(path).data.publicUrl, "admin upload");
      }
      if (!url) return A.toast("Paste a link or choose an image.", "err");
      if (!/^https:\/\//i.test(url)) return A.toast("The link has to start with https://", "err");
      set(url, "admin link");
    };
    $("[data-save]", m.el).onclick = save;
    // saved by itself: an uploaded image at once, a pasted link as soon as it loads as an image
    f.file.addEventListener("change", () => { if (f.file.files[0]) save(); });
    let linkTimer = 0;
    f.url.addEventListener("input", () => {
      clearTimeout(linkTimer);
      const url = f.url.value.trim();
      if (!/^https:\/\/\S+$/i.test(url) || url === cur) return;
      linkTimer = setTimeout(() => { const img = new Image(); img.onload = () => { if (f.url.value.trim() === url && !f.file.files[0]) save(); }; img.src = url; }, 500);
    });
  }

  load();
})();
