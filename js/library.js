// Content Library — imported content ("content_ideas") with filters built from the import columns
// (idea_catalog categories), details / analysis pop-up, saved boards (js/boards.js) and saved searches.
(() => {
  const root = document.querySelector("[data-library]");
  if (!root) return;
  const auth = window.SCP_AUTH;
  const db = auth?.client;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
  const icon = (name) => (window.SCP_ICONS ? window.SCP_ICONS(name) : "");
  const PAGE = 24;

  const grid = $("[data-posts]");
  const empty = $("[data-empty]");
  const more = $("[data-more]");
  const note = $("[data-feed-note]");

  // ---------- Filter categories (same as the admin import columns) ----------
  // Small categories show as pills; big ones as a searchable list. Empty categories are hidden.
  const CATEGORIES = [
    { key: "platform", label: "Platform" },
    { key: "format", label: "Format" },
    { key: "sport", label: "Sport" },
    { key: "entity", label: "Entity" },
    { key: "competition", label: "Competition", list: true },
    { key: "club", label: "Club", list: true },
    { key: "trend", label: "Trend", list: true },
    { key: "campaign", label: "Campaign", list: true },
  ];
  const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));
  const PLATFORM_ICONS = ["instagram", "tiktok", "youtube", "x", "facebook", "linkedin"];
  const PERIODS = { 7: "This week", 31: "This month", season: "This season", custom: "Custom dates" };
  const pretty = (name) => (name && name[0] === name[0].toLowerCase() ? name[0].toUpperCase() + name.slice(1) : name);

  let catalog = { byCat: {}, byId: new Map() };
  const selected = Object.fromEntries(CATEGORIES.map((c) => [c.key, new Set()])); // category -> Set(value ids)

  // ---------- Show / hide the filters column (remembered) ----------
  const collapse = $("[data-collapse]");
  const setCollapsed = (collapsed) => {
    root.classList.toggle("filters-collapsed", collapsed);
    collapse.setAttribute("aria-expanded", String(!collapsed));
    $("[data-collapse-label]").textContent = collapsed ? "Show filters" : "Hide filters";
    store.set("scp-filters-collapsed", collapsed ? "1" : "0");
  };
  collapse.addEventListener("click", () => setCollapsed(!root.classList.contains("filters-collapsed")));
  $("[data-hide-filters]").addEventListener("click", () => setCollapsed(true));
  if (store.get("scp-filters-collapsed") === "1") setCollapsed(true);

  // ---------- Facets ----------
  async function loadCatalog() {
    const { data, error } = await db.rpc("catalog_with_counts");
    if (error) throw error;
    const byCat = {};
    const byId = new Map();
    for (const r of data || []) {
      const v = { id: Number(r.id), category: r.category, name: r.name, total: Number(r.ideas) };
      if (!v.total) continue;
      (byCat[v.category] ||= []).push(v);
      byId.set(v.id, v);
    }
    for (const k in byCat) byCat[k].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    catalog = { byCat, byId };
  }

  function renderFacets() {
    $("[data-facets]").innerHTML = CATEGORIES.filter((c) => catalog.byCat[c.key]?.length).map((c) => {
      const values = catalog.byCat[c.key];
      const btn = (v) => {
        const pf = c.key === "platform" && PLATFORM_ICONS.includes(v.name.toLowerCase()) ? `<img src="assets/pf-${v.name.toLowerCase()}.svg" alt="">` : "";
        return `<button class="${c.list ? "" : "pill seg-btn"}" type="button" aria-pressed="${selected[c.key].has(v.id)}" data-facet="${c.key}" data-id="${v.id}">${pf}<span class="fv-name">${esc(pretty(v.name))}</span><span class="fv-count" data-count="${v.id}">${v.total}</span></button>`;
      };
      const body = c.list
        ? `<div class="f-list">
             <label class="search"><input type="search" placeholder="Search ${esc(c.label.toLowerCase())}…" aria-label="Search ${esc(c.label.toLowerCase())}" data-facet-search="${c.key}"><img src="assets/search.svg" alt=""></label>
             <ul class="fv-list">${values.map((v) => `<li data-name="${esc(v.name.toLowerCase())}">${btn(v)}</li>`).join("")}</ul>
           </div>`
        : `<div class="f-row">${values.map(btn).join("")}</div>`;
      return `<section class="fx" data-facet-section="${c.key}"><h2 class="fx-title">${esc(c.label)}</h2>${body}</section>`;
    }).join("");
  }

  $("[data-facets]").addEventListener("click", (e) => {
    const b = e.target.closest("[data-facet]");
    if (!b) return;
    const set = selected[b.dataset.facet];
    const id = Number(b.dataset.id);
    set.has(id) ? set.delete(id) : set.add(id);
    b.setAttribute("aria-pressed", String(set.has(id)));
    load(true);
  });
  $("[data-facets]").addEventListener("input", (e) => {
    const input = e.target.closest("[data-facet-search]");
    if (!input) return;
    const q = input.value.trim().toLowerCase();
    $$(`[data-facet-section="${input.dataset.facetSearch}"] li`).forEach((li) => (li.hidden = q && !li.dataset.name.includes(q)));
  });

  // Live counts: how many posts each value would show with the other filters applied.
  // Categories with a selection are counted without their own filter (values within a category are OR'ed).
  let countToken = 0;
  async function refreshCounts(args) {
    const my = ++countToken;
    const active = CATEGORIES.filter((c) => selected[c.key].size).map((c) => c.key);
    const call = async (filters) => {
      const r = useAdminSearch ? { error: { message: "schema cache" } } : await db.rpc("library_filter_counts", { ...args, p_filters: filters });
      return r.error && /schema cache|does not exist/i.test(r.error.message) ? db.rpc("available_filter_counts", { ...args, p_filters: filters }) : r;
    };
    const [base, ...own] = await Promise.all([
      call(args.p_filters),
      ...active.map((k) => { const f = { ...args.p_filters }; delete f[k]; return call(f); }),
    ]);
    if (my !== countToken) return;
    const counts = new Map((base.data || []).map((r) => [Number(r.value_id), Number(r.ideas)]));
    active.forEach((k, i) => {
      const m = new Map((own[i].data || []).map((r) => [Number(r.value_id), Number(r.ideas)]));
      for (const v of catalog.byCat[k] || []) counts.set(v.id, m.get(v.id) || 0);
    });
    $$("[data-count]").forEach((el) => {
      const id = Number(el.dataset.count);
      const n = counts.get(id) || 0;
      el.textContent = n;
      el.closest("button").classList.toggle("is-zero", n === 0 && !selected[catalog.byId.get(id)?.category]?.has(id));
    });
  }

  // ---------- Upcoming dates (seasonal ideas → caption search) ----------
  const KEY_DATES = [
    { m: 1, d: 1, icon: "party-popper", name: "New Year", q: "new year" },
    { m: 2, d: 14, icon: "heart", name: "Valentine’s Day", q: "valentine" },
    { m: 3, d: 8, icon: "sparkles", name: "Women’s Day", q: "women's day" },
    { m: 4, d: 1, icon: "drama", name: "April Fools", q: "april fools" },
    { m: 4, d: 22, icon: "earth", name: "Earth Day", q: "earth day" },
    { m: 6, d: 28, icon: "rainbow", name: "Pride", q: "pride" },
    { m: 7, d: 15, icon: "plane", name: "Pre-season", q: "preseason" },
    { m: 8, d: 15, icon: "calendar-days", name: "Fixture release", q: "fixtures" },
    { m: 10, d: 31, icon: "ghost", name: "Halloween", q: "halloween" },
    { m: 11, d: 0, icon: "shopping-bag", name: "Black Friday", q: "black friday" }, // 4th Friday of November
    { m: 12, d: 25, icon: "tree-pine", name: "Christmas", q: "christmas" },
    { m: 12, d: 28, icon: "drama", name: "Inocentes", q: "inocentes" },
  ];
  function nextOccurrence(k, now) {
    const make = (y) => {
      if (k.d) return new Date(y, k.m - 1, k.d);
      const first = new Date(y, 10, 1); // Black Friday
      return new Date(y, 10, 1 + ((5 - first.getDay() + 7) % 7) + 21);
    };
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let d = make(now.getFullYear());
    if (d < today) d = make(now.getFullYear() + 1);
    return d;
  }
  function renderUpcoming() {
    const now = new Date();
    const list = KEY_DATES.map((k) => ({ ...k, date: nextOccurrence(k, now) }))
      .map((k) => ({ ...k, days: Math.round((k.date - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5) }))
      .filter((k) => k.days <= 75).sort((a, b) => a.days - b.days).slice(0, 4);
    const q = $("[data-q]").value.trim().toLowerCase();
    $("[data-upcoming]").innerHTML = list.length
      ? `<span class="upcoming-label">Coming up</span>` + list.map((k) => `<button type="button" class="upcoming-chip" data-upcoming-q="${esc(k.q)}" aria-pressed="${q === k.q}">${icon(k.icon)}${esc(k.name)} <small>${k.days === 0 ? "today" : `in ${k.days} day${k.days === 1 ? "" : "s"}`}</small></button>`).join("")
      : "";
  }
  $("[data-upcoming]").addEventListener("click", (e) => {
    const b = e.target.closest("[data-upcoming-q]");
    if (!b) return;
    const input = $("[data-q]");
    input.value = input.value.trim().toLowerCase() === b.dataset.upcomingQ ? "" : b.dataset.upcomingQ;
    setPeriod("all");
    load(true);
  });

  // ---------- Period (When) ----------
  const setPeriod = (value) => {
    $$("[data-period] button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === value)));
    $("[data-custom-dates]").hidden = value !== "custom";
  };
  $("[data-period]").addEventListener("change", () => { $("[data-custom-dates]").hidden = state().period !== "custom"; });

  // ---------- Filter state ----------
  const pressed = (sel) => $$(`${sel} [aria-pressed="true"]`).map((b) => b.dataset.value);
  const state = () => ({
    order: pressed("[data-order]")[0] || "latest",
    period: pressed("[data-period]")[0] || "all",
    from: $("[data-from]").value,
    to: $("[data-to]").value,
    facets: Object.fromEntries(Object.entries(selected).filter(([, s]) => s.size).map(([k, s]) => [k, [...s]])),
    q: $("[data-q]").value.trim(),
  });

  function applyState(f) {
    for (const c of CATEGORIES) selected[c.key] = new Set((f.facets?.[c.key] || []).map(Number).filter((id) => catalog.byId.has(id)));
    $$("[data-facet]").forEach((b) => b.setAttribute("aria-pressed", String(selected[b.dataset.facet].has(Number(b.dataset.id)))));
    if (f.order) $$("[data-order] button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === f.order)));
    setPeriod(f.period || "all");
    for (const k of ["from", "to"]) { const el = $(`[data-${k}]`); el.value = f[k] || ""; el.dispatchEvent(new Event("input")); }
    $("[data-q]").value = f.q || "";
  }

  function seasonStart() {
    const now = new Date();
    return `${now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1}-07-01`; // seasons start in July
  }
  const isoDay = (d) => d.toISOString().slice(0, 10);
  function queryArgs(s) {
    let from = null, to = null;
    if (s.period === "7" || s.period === "31") from = isoDay(new Date(Date.now() - Number(s.period) * 864e5));
    if (s.period === "season") from = seasonStart();
    if (s.period === "custom") { from = s.from || null; to = s.to || null; }
    const filters = Object.fromEntries(Object.entries(s.facets).map(([k, ids]) => [k, { ids, mode: "any" }]));
    return { p_filters: filters, p_q: s.q || null, p_from: from, p_to: to };
  }

  // ---------- Active filter chips ----------
  function chipsFor(s) {
    const c = [];
    for (const cat of CATEGORIES) for (const id of s.facets[cat.key] || []) {
      const v = catalog.byId.get(id);
      if (v) c.push({ label: `${pretty(v.name)}`, title: cat.label, clear: () => { selected[cat.key].delete(id); $(`[data-facet="${cat.key}"][data-id="${id}"]`)?.setAttribute("aria-pressed", "false"); } });
    }
    if (s.period !== "all") c.push({ label: s.period === "custom" ? `${s.from || "…"} → ${s.to || "…"}` : PERIODS[s.period], clear: () => { setPeriod("all"); ["from", "to"].forEach((k) => { const el = $(`[data-${k}]`); el.value = ""; el.dispatchEvent(new Event("input")); }); } });
    if (s.q) c.push({ label: `“${s.q}”`, clear: () => ($("[data-q]").value = "") });
    return c;
  }
  let chipClears = [];
  function renderActive(s) {
    const chips = chipsFor(s);
    chipClears = chips.map((x) => x.clear);
    $("[data-active-bar]").hidden = chips.length === 0 && !savedSearches.length;
    $("[data-active-chips]").innerHTML = chips.map((x, i) => `<button type="button" class="active-chip" data-chip="${i}"${x.title ? ` title="${esc(x.title)}"` : ""}>${esc(x.label)} <span aria-hidden="true">×</span><span class="sr-only">Remove</span></button>`).join("")
      + (chips.length > 1 ? `<button type="button" class="link-muted active-clear" data-chip-clear>Clear all</button>` : "");
    $("[data-save-search]").hidden = chips.length === 0;
    const sidebarCount = chips.length - (s.q ? 1 : 0);
    const badge = $("[data-filter-count]");
    badge.textContent = sidebarCount; badge.hidden = sidebarCount <= 0;
    renderUpcoming();
  }
  $("[data-active-chips]").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-chip]");
    if (chip) { chipClears[Number(chip.dataset.chip)]?.(); return load(true); }
    if (e.target.closest("[data-chip-clear]")) clearAll();
  });

  // ---------- Saved searches ----------
  let savedSearches = [];
  async function loadSavedSearches() {
    const { data } = await db.from("saved_searches").select("id,name,filters").order("created_at");
    savedSearches = data || [];
    $("[data-saved-searches]").innerHTML = `<option value="">Saved searches…</option>` + savedSearches.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("");
  }
  $("[data-saved-searches]").addEventListener("change", (e) => {
    const found = savedSearches.find((x) => x.id === e.target.value);
    if (!found) return;
    applyState(found.filters);
    e.target.value = "";
    load(true);
  });
  $("[data-save-search]").addEventListener("click", async () => {
    const name = window.prompt("Name this search (e.g. “Basketball carousels”)");
    if (!name?.trim()) return;
    const { error } = await db.from("saved_searches").upsert({ name: name.trim(), filters: state() }, { onConflict: "user_id,name" });
    if (error) return alert(error.message);
    await loadSavedSearches();
  });

  // ---------- "For you": the member's favourite profiles / creators first, then their sports / competitions ----------
  const me = { boost: [], boost2: [], fav: new Set(), isSuper: false };
  async function loadMe() {
    const profile = (await auth?.getProfile?.())?.profile;
    me.isSuper = profile?.role === "superadmin";
    const prefs = profile?.preferences || {};
    const favIds = [...(prefs.favouriteProfiles || []), ...(prefs.favouriteCreators || [])].map((f) => f.id).filter(Boolean).map(Number);
    me.boost = favIds;
    me.fav = new Set(favIds);
    me.boost2 = [...(prefs.sports || []), ...(prefs.competitions || [])].map(Number);
    if (!me.boost.length && !me.boost2.length) return;
    const order = $("[data-order]");
    order.insertAdjacentHTML("afterbegin", `<button type="button" aria-pressed="false" data-value="foryou" title="Your favourite profiles first, then your sports">${icon("star")}For you</button>`);
    const btn = order.firstElementChild;
    btn.addEventListener("click", () => {
      $$("button", order).forEach((o) => o.setAttribute("aria-pressed", String(o === btn)));
      order.dispatchEvent(new CustomEvent("change", { bubbles: true }));
    });
    $$("button", order).forEach((o) => o.setAttribute("aria-pressed", String(o === btn)));
  }

  // ---------- Saved boards (js/boards.js) ----------
  const boards = window.SCP_BOARDS;
  $$("[data-icon]").forEach((el) => (el.outerHTML = icon(el.dataset.icon)));

  // ---------- Query ----------
  let offset = 0;
  let token = 0;
  let seed = String(Math.random()).slice(2, 10);
  const cache = new Map();

  async function load(reset) {
    const s = state();
    renderActive(s);
    if (reset) { offset = 0; resetGrid(); empty.hidden = true; note.hidden = true; }
    if (!db) return showNote("Content isn't connected yet.");
    const my = ++token;
    more.hidden = true;
    grid.setAttribute("aria-busy", "true");

    const args = queryArgs(s);
    const ids = null;
    if (reset) refreshCounts(args);
    const boost = s.order === "foryou" ? { p_boost: me.boost, p_boost2: me.boost2 } : {};
    const { data, error } = await fetchIdeas({ ...args, p_order: s.order, p_seed: seed, p_ids: ids, p_limit: PAGE, p_offset: offset, ...boost });
    if (my !== token) return;
    grid.removeAttribute("aria-busy");
    if (error) return showNote(/schema cache|does not exist|function/i.test(error.message) ? "The library isn't connected yet (run supabase/library-ideas.sql in Supabase)." : "Couldn't load posts right now.");
    const rows = data?.data || [];
    if (reset) $("[data-result-count]").textContent = `${Number(data.total).toLocaleString("en-GB")} post${data.total === 1 ? "" : "s"}`;
    if (!rows.length && offset === 0) {
      if (!chipsFor(s).length) return showEmpty("The library is empty for now — posts appear here after the first import.");
      return showEmpty("No posts match these filters.");
    }
    addCards(rows);
    rows.forEach((p) => cache.set(String(p.id), p));
    offset += rows.length;
    more.hidden = offset >= data.total;
  }

  function showEmpty(text) { empty.textContent = text; empty.hidden = false; $("[data-result-count]").textContent = ""; }
  function showNote(text) { note.textContent = text; note.hidden = false; $("[data-result-count]").textContent = ""; }

  // library_ideas (members). Until supabase/library-ideas.sql has been run, superadmins fall back to the admin search
  // (newest first only; saved posts are filtered from the page).
  let useAdminSearch = false;
  async function fetchIdeas(a) {
    if (!useAdminSearch) {
      const r = await db.rpc("library_ideas", a);
      if (!r.error || !/schema cache|does not exist/i.test(r.error.message)) return r;
      useAdminSearch = true;
    }
    const page = Math.floor(a.p_offset / a.p_limit) + 1;
    const r = await db.rpc("search_content_ideas", { p_filters: a.p_filters, p_q: a.p_q, p_from: a.p_from, p_to: a.p_to, p_page: page, p_per_page: a.p_limit });
    if (r.error) return r;
    let rows = r.data.data;
    if (a.p_ids) rows = rows.filter((x) => a.p_ids.includes(Number(x.id)));
    return { data: { total: a.p_ids ? rows.length : r.data.meta.total, data: rows } };
  }

  // ---------- Rendering ----------
  const date = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
  const first = (p, cat) => p.tags?.[cat]?.[0]?.name || "";
  const platformOf = (p) => {
    const t = first(p, "platform").toLowerCase();
    if (PLATFORM_ICONS.includes(t)) return t;
    const u = p.url || "";
    return /instagram\./.test(u) ? "instagram" : /tiktok\./.test(u) ? "tiktok" : /youtu/.test(u) ? "youtube" : /(twitter|x)\.com/.test(u) ? "x" : /facebook\./.test(u) ? "facebook" : /linkedin\./.test(u) ? "linkedin" : "";
  };
  // Lightweight preview: the platform's own embed page in a lazy iframe (no script per card)
  function previewSrc(p) {
    const u = p.url || "";
    let m;
    if ((m = u.match(/instagram\.com\/(?:[\w.]+\/)?(p|reel|tv)\/([\w-]+)/))) return `https://www.instagram.com/${m[1]}/${m[2]}/embed/`;
    if ((m = u.match(/tiktok\.com\/.*video\/(\d+)/))) return `https://www.tiktok.com/embed/v2/${m[1]}`;
    if ((m = u.match(/(?:shorts\/|v=|youtu\.be\/)([\w-]{11})/))) return `https://www.youtube-nocookie.com/embed/${m[1]}`;
    return "";
  }

  const saveBtn = (id) => boards.button(id);
  const tagChips = (p, cats) => cats.flatMap((c) => (p.tags?.[c] || []).map((v) => `<button type="button" class="lib-tag" data-tag="${c}:${v.id}" title="${esc(CAT_LABEL[c])}">${esc(pretty(v.name))}</button>`)).join("");

  // Media-first card at the post's real shape. Reels play right in the grid; on photos and carousels a click opens
  // the details pop-up, except on the carousel arrows (left / right, middle), which stay live to swipe in the card.
  const isReel = (p) => /^(reels?|shorts?|video)$/i.test(first(p, "format")) || /\/(reel|shorts)\//.test(p.url || "");
  // Instagram's embed shows reels (9:16) letterboxed inside its media box (usually 4:5): the card is 9:16 and the box is zoomed to fill it.
  function shape(p) {
    const box = Number(p.media_ratio) || 1.25;
    if (!isReel(p) || box >= 16 / 9) return { ratio: box };
    return { ratio: 16 / 9, zoom: 1 / (box * 9 / 16), boxFrac: box / (16 / 9) };
  }
  function card(p) {
    const pf = platformOf(p);
    const src = previewSrc(p);
    const who = first(p, "club") || first(p, "competition") || first(p, "entity");
    const fmt = pretty(first(p, "format"));
    const sh = shape(p);
    const zoomStyle = sh.zoom ? ` style="--zoom:${sh.zoom.toFixed(4)};--inset:${((1 - sh.boxFrac) / 2 * 100).toFixed(3)}%"` : "";
    return `
      <article class="lib-card" data-id="${esc(p.id)}">
        <div class="lib-media${sh.zoom ? " is-reel" : ""}" style="aspect-ratio: 1 / ${sh.ratio.toFixed(4)}">
          ${src ? `<div class="lib-zoom"${zoomStyle}><iframe class="lib-frame${pf === "instagram" ? " is-ig" : ""}" src="${esc(src)}" loading="lazy" title="${esc(who || "Post")}" scrolling="no" allow="encrypted-media; picture-in-picture; fullscreen"></iframe></div>` : `<span class="lib-noimg"></span>`}
          ${sh.zoom ? "" : `<button class="lib-hit" type="button" data-open="${esc(p.id)}" aria-label="Details${who ? ` · ${esc(who)}` : ""}"></button>`}
          <div class="lib-top">
            ${pf ? `<span class="lib-badge lib-badge-pf"><img src="assets/pf-${pf}.svg" alt="${esc(pf)}"></span>` : ""}
            ${fmt ? `<span class="lib-badge">${esc(fmt)}</span>` : ""}
            ${(p.tags?.club || []).some((v) => me.fav.has(Number(v.id))) ? `<span class="lib-badge lib-badge-fav" title="One of your favourite profiles">${icon("star")}Favourite</span>` : ""}
            <span class="lib-save">${saveBtn(p.id)}</span>
            ${me.isSuper ? `<button class="lib-remove" type="button" data-remove="${esc(p.id)}" title="Remove from the library (superadmin)" aria-label="Remove from the library">${icon("trash-2")}</button>` : ""}
          </div>
          <div class="lib-bottom">
            <div class="lib-tags">${tagChips(p, ["sport", "competition"])}</div>
            <p class="lib-who">${esc(who)}</p>
            <p class="lib-when">${date(p.published_at)}${first(p, "entity") ? ` · ${esc(pretty(first(p, "entity")))}` : ""}</p>
          </div>
        </div>
        ${aiButton(p.id)}
      </article>`;
  }

  // ---------- AI analyses: credits & unlocks (supabase/billing.sql) ----------
  // Unlocking spends 1 credit (monthly units first, then packs); re-opening an unlocked analysis is free.
  const ai = { ent: null, unlocked: new Set() };
  async function loadAi() {
    const [{ data: ent }, { data: ids }] = await Promise.all([db.rpc("my_entitlements"), db.rpc("my_unlocked_posts")]);
    ai.ent = ent || null;
    ai.unlocked = new Set((ids || []).map(Number));
    renderCredits();
  }
  const credits = () => (ai.ent ? (ai.ent.monthly_left || 0) + (ai.ent.pack_left || 0) : 0);
  function renderCredits() {
    const el = $("[data-ai-credits]");
    if (!el) return;
    if (!ai.ent?.has_ai) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = ai.ent.is_staff ? `${icon("sparkles")}AI · team access`
      : `${icon("sparkles")}<b>${credits()}</b> AI credit${credits() === 1 ? "" : "s"}${ai.ent.pack_left ? `<small>${ai.ent.monthly_left} monthly + ${ai.ent.pack_left} pack</small>` : `<small>renews ${new Date(ai.ent.cycle_end).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</small>`}`;
  }
  function aiButton(id) {
    const n = Number(id);
    if (ai.ent && !ai.ent.has_ai) return `<button class="lib-analysis is-locked" type="button" data-open="${esc(id)}">${icon("lock")}<span>AI Analysis</span>${icon("arrow-up-right")}</button>`;
    if (ai.unlocked.has(n)) return `<button class="lib-analysis is-ready" type="button" data-open="${esc(id)}">${icon("sparkles")}<span>View AI Analysis</span>${icon("arrow-up-right")}</button>`;
    return `<button class="lib-analysis" type="button" data-open="${esc(id)}">${icon("sparkles")}<span>Unlock AI Analysis <small>· 1 credit</small></span>${icon("arrow-up-right")}</button>`;
  }
  const refreshAiButtons = (id) => $$(`.lib-card[data-id="${CSS.escape(String(id))}"] .lib-analysis`).forEach((b) => (b.outerHTML = aiButton(id)));

  // ---------- Masonry: N columns, each card goes to the shortest one (heights known from the ratios) ----------
  const GAP = 22;
  let cols = [], colH = [], placed = [];
  function columnCount() {
    const w = grid.clientWidth - parseFloat(getComputedStyle(grid).paddingLeft) - parseFloat(getComputedStyle(grid).paddingRight);
    // as many ~240px columns as fit (with or without the filters column), up to 6 on very wide screens
    const MAX = 6, MIN = 240;
    return Math.max(1, Math.min(MAX, Math.floor((w + GAP) / (MIN + GAP))));
  }
  function buildColumns(n) {
    grid.innerHTML = "";
    grid.classList.add("masonry");
    cols = Array.from({ length: n }, () => grid.appendChild(Object.assign(document.createElement("div"), { className: "mcol" })));
    colH = cols.map(() => 0);
  }
  function place(el, ratio) {
    const i = colH.indexOf(Math.min(...colH));
    cols[i].appendChild(el);
    colH[i] += ratio + 0.25; // + caption / button area
  }
  function resetGrid() { placed = []; buildColumns(columnCount()); }
  function addCards(rows) {
    const tpl = document.createElement("template");
    tpl.innerHTML = rows.map(card).join("");
    [...tpl.content.children].forEach((el, i) => {
      const ratio = shape(rows[i]).ratio;
      placed.push({ el, ratio });
      place(el, ratio);
    });
  }
  // Re-flow only when the number of columns changes (moving iframes reloads them)
  new ResizeObserver(() => {
    if (!cols.length) return;
    const n = columnCount();
    if (n === cols.length) return;
    const keep = placed;
    buildColumns(n);
    keep.forEach(({ el, ratio }) => place(el, ratio));
  }).observe(grid);

  // ---------- Detail drawer ----------
  const drawer = $("[data-drawer]");
  const body = $("[data-drawer-body]");
  const PLATFORM_NAMES = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", x: "X", facebook: "Facebook", linkedin: "LinkedIn" };
  function embedHtml(p) {
    if (/^\s*<blockquote class="(instagram-media|tiktok-embed|twitter-tweet)/.test(p.embed || "")) return p.embed;
    const src = previewSrc(p);
    if (src) return `<div class="yt-frame is-vertical"><iframe src="${esc(src)}" title="Post" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`;
    return `<a class="btn btn-outline" href="${esc(p.url)}" target="_blank" rel="noopener">Open post</a>`;
  }
  const SCRIPTS = { "instagram-media": "https://www.instagram.com/embed.js", "tiktok-embed": "https://www.tiktok.com/embed.js", "twitter-tweet": "https://platform.twitter.com/widgets.js" };
  function runEmbedScript() {
    if ($(".instagram-media", body) && window.instgrm) return window.instgrm.Embeds.process();
    if ($(".twitter-tweet", body) && window.twttr?.widgets) return window.twttr.widgets.load(body);
    for (const [cls, src] of Object.entries(SCRIPTS)) {
      if (!$(`.${cls}`, body)) continue;
      if (cls === "tiktok-embed") document.querySelectorAll(`script[src="${src}"]`).forEach((s) => s.remove());
      if (cls === "tiktok-embed" || !document.querySelector(`script[src="${src}"]`)) {
        const s = document.createElement("script"); s.async = true; s.src = src; document.body.append(s);
      }
    }
  }
  const MOMENT_NAMES = { matchday: "Matchday", signing: "Signing", kit: "Kit", sponsor: "Sponsor", behind_the_scenes: "Behind the scenes", fans: "Fans", milestone: "Milestone", community: "Community", ticketing: "Tickets", training: "Training", humour: "Humour", other: "Other" };
  const STYLE_NAMES = { talking_head: "Talking head", pov: "POV", meme: "Meme", graphic: "Graphic", montage: "Montage", interview: "Interview", challenge: "Challenge", vlog: "Vlog", live_action: "Live action", other: "Other" };
  const block = (title, ico, html, cls = "") => (html ? `<section class="an-block ${cls}"><h3>${icon(ico)}${title}</h3>${html}</section>` : "");
  const stamp = (t, basis) => (basis === "video" ? `${t}s` : `#${t}`);

  function analysisHtml(a) {
    if (!a) return `<div class="an-empty">${icon("sparkles")}<div><b>Analysis not available</b><p>Please try again later.</p></div></div>`;
    const fmt = a.format || {};
    const facts = [["Category", fmt.category], ["Type", fmt.type], ["Layout", fmt.visualLayout], ["Pacing", fmt.pacing], ["Moment", MOMENT_NAMES[a.moment]], ["Style", STYLE_NAMES[a.style]]].filter(([, v]) => v);
    return `
      ${a.summary ? `<p class="an-summary">${esc(a.summary)}</p>` : ""}
      ${block("Hook", "zap", a.hook ? `
        <blockquote class="an-hook">${esc(a.hook.text || "")}</blockquote>
        ${a.hook.category ? `<span class="an-chip">${esc(a.hook.category)}</span>` : ""}
        ${a.hook.whyItWorks ? `<p>${esc(a.hook.whyItWorks)}</p>` : ""}
        ${a.hook.template ? `<div class="an-template"><span>Template</span><p>${esc(a.hook.template)}</p><button class="an-copy" type="button" data-copy="${esc(a.hook.template)}">${icon("copy")}Copy</button></div>` : ""}` : "", "an-hook-block")}
      ${block("Why it works", "lightbulb", a.whyItWorks ? `<p>${esc(a.whyItWorks)}</p>` : "")}
      ${block("Format", "layout-grid", facts.length ? `<dl class="an-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : "")}
      ${block("Angle", "compass", a.angle?.angle || a.angle?.topic ? `${a.angle.topic ? `<span class="an-chip">${esc(a.angle.topic)}</span>` : ""}<p>${esc(a.angle.angle || "")}</p>` : "")}
      ${block(a.basis === "video" ? "Visual breakdown" : "Slide by slide", "clapperboard", a.visualBreakdown?.length ? `<ol class="an-timeline">${a.visualBreakdown.map((v) => `<li><span class="an-t">${stamp(v.t, a.basis)}</span><div><b>${esc(v.shot)}</b>${v.onScreenText ? `<q>${esc(v.onScreenText)}</q>` : ""}${v.why ? `<p>${esc(v.why)}</p>` : ""}</div></li>`).join("")}</ol>` : "")}
      ${block("Scroll stoppers", "hand", a.scrollStoppers?.length ? `<ul class="an-stoppers">${a.scrollStoppers.map((v) => `<li><span class="an-t">${stamp(v.t, a.basis)}</span><div><b>${esc(v.moment)}</b>${v.why ? `<p>${esc(v.why)}</p>` : ""}</div></li>`).join("")}</ul>` : "")}
      ${block(a.replicable?.is === false ? "Hard to replicate" : "How to adapt it to your club", "repeat", a.replicable?.howToAdapt ? `<p>${esc(a.replicable.howToAdapt)}</p>` : "", "an-adapt")}
      ${a.topics?.length ? `<div class="an-topics">${a.topics.map((t) => `<span class="an-chip">${esc(t)}</span>`).join("")}</div>` : ""}`;
  }

  async function openPost(id) {
    const p = cache.get(String(id));
    if (!p) return;
    const pf = platformOf(p);
    const who = first(p, "club") || first(p, "competition") || first(p, "entity");
    const groups = CATEGORIES.filter((c) => p.tags?.[c.key]?.length).map((c) => `<div class="dr-tag-row"><dt>${esc(c.label)}</dt><dd>${tagChips(p, [c.key])}</dd></div>`).join("");
    body.innerHTML = `
      <div class="an-media">${embedHtml(p)}</div>
      <div class="an-info">
        <header class="an-head">
          <p class="an-eyebrow">${esc(pretty(first(p, "format")) || "Post")}${p.published_at ? ` · ${date(p.published_at)}` : ""}</p>
          <h2>${esc(who || "Post")}</h2>
          <div class="an-actions">
            <button class="pill pill-gold" type="button" data-more-like="${esc(p.id)}">${icon("sparkles")}More like this</button>
            ${saveBtn(p.id)}
            ${p.url ? `<a class="pill pill-dark" href="${esc(p.url)}" target="_blank" rel="noopener">Open on ${esc(PLATFORM_NAMES[pf] || "the platform")} ↗</a>` : ""}
            ${me.isSuper ? `<button class="pill pill-danger" type="button" data-remove="${esc(p.id)}">${icon("trash-2")}Remove from library</button>` : ""}
          </div>
        </header>
        <div data-analysis><div class="an-loading"></div></div>
        ${groups ? `<section class="an-block"><h3>${icon("tags")}Tags</h3><dl class="dr-tags">${groups}</dl><p class="dr-hint">Click a tag to see more posts like it.</p></section>` : ""}
        ${p.title ? `<details class="an-caption"><summary>Caption</summary><p>${esc(p.title)}</p></details>` : ""}
      </div>`;
    drawer.hidden = false;
    document.body.style.overflow = "hidden";
    runEmbedScript();
    showAnalysisArea(p.id);
  }

  const area = () => body.querySelector("[data-analysis]");
  const balanceLine = () => ai.ent?.is_staff ? "Team access: no credits used."
    : `You have <b>${credits()} credit${credits() === 1 ? "" : "s"}</b> left${ai.ent?.pack_left ? ` (${ai.ent.monthly_left} monthly + ${ai.ent.pack_left} from packs)` : " this month"}.`;
  async function showAnalysisArea(id) {
    const n = Number(id);
    if (!ai.ent) await loadAi().catch(() => {});
    if (!area()) return;
    if (!ai.ent?.has_ai) {
      area().innerHTML = `<div class="ai-gate">${icon("lock")}<div><b>AI analyses are part of Library + AI and All Access</b>
        <p>Hook, why it works, format, angle, visual breakdown and how to adapt it to your club, for any post in the library.</p>
        <a class="btn btn-gold" href="pricing.html">See plans</a></div></div>`;
      return;
    }
    if (ai.unlocked.has(n)) return loadUnlocked(n);
    area().innerHTML = `<div class="ai-unlock">
      <div class="ai-unlock-top">${icon("sparkles")}<div><b>AI analysis of this post</b><p>Hook, why it works, format, angle, visual breakdown and how to adapt it to your club.</p></div></div>
      ${credits() > 0 || ai.ent.is_staff
        ? `<button class="btn btn-gold ai-unlock-btn" type="button" data-unlock="${n}">${icon("sparkles")}Unlock AI Analysis — 1 credit</button>
           <p class="ai-balance">${balanceLine()} Once unlocked, you can open it again for free.</p>`
        : noCreditsHtml()}
    </div>`;
  }
  const noCreditsHtml = () => `<div class="ai-empty"><b>You've used all your AI credits</b>
    <p>Your monthly credits renew on ${ai.ent?.cycle_end ? new Date(ai.ent.cycle_end).toLocaleDateString("en-GB", { day: "numeric", month: "long" }) : "your next billing date"}. Need more now?</p>
    <div class="ai-empty-actions"><a class="btn btn-gold" href="pricing.html#packs">Buy an analysis pack</a><a class="btn btn-outline" href="pricing.html">Upgrade your plan</a></div></div>`;
  function generating(text = "Unlocking the analysis…") {
    area().innerHTML = `<div class="ai-working"><span class="ai-spinner"></span><div><b>${text}</b><p>Reading the post, the hook and the format. This can take up to a minute.</p></div></div>`;
  }
  async function loadUnlocked(n) {
    const { data } = await db.rpc("get_unlocked_analysis", { p_post_id: n });
    if (!area()) return;
    if (data?.status === "unlocked") { area().innerHTML = analysisHtml(data.analysis); return; }
    if (data?.status === "pending") return waitFor(n);
    if (data?.status === "failed") { ai.unlocked.delete(n); refreshAiButtons(n); return showAnalysisArea(n); }
    area().innerHTML = analysisHtml(null);
  }
  // A pending unlock: ask the server to generate it (only the first request actually runs) and poll until it's ready
  async function waitFor(n) {
    generating();
    const { data: { session } } = await db.auth.getSession();
    const cfg = window.SCP_CONFIG;
    fetch(`${cfg.supabaseUrl}/functions/v1/ai-analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ post_id: n }),
    }).catch(() => null);
    const started = Date.now();
    while (Date.now() - started < 150000) {
      await new Promise((r) => setTimeout(r, 2500));
      if (!area()) return;
      const { data } = await db.rpc("get_unlocked_analysis", { p_post_id: n });
      if (data?.status === "unlocked") { area().innerHTML = analysisHtml(data.analysis); return; }
      if (data?.status === "failed") {
        ai.unlocked.delete(n); refreshAiButtons(n); await loadAi();
        area().innerHTML = `<div class="ai-empty"><b>We couldn't generate this analysis</b><p>Your credit has been refunded. Please try again in a few minutes.</p>
          <div class="ai-empty-actions"><button class="btn btn-gold" type="button" data-unlock="${n}">Try again — 1 credit</button></div></div>`;
        return;
      }
    }
    area().innerHTML = `<div class="ai-empty"><b>Still working on it</b><p>Close this window and open the post again in a minute — you won't be charged again.</p></div>`;
  }
  async function unlock(n) {
    generating();
    const minWait = new Promise((r) => setTimeout(r, 1200)); // same feel whether it was ready or not
    const { data, error } = await db.rpc("unlock_analysis", { p_post_id: n });
    await minWait;
    if (error) { area().innerHTML = `<div class="ai-empty"><b>Something went wrong</b><p>${esc(error.message)}</p></div>`; return; }
    if (data.balance) { ai.ent = data.balance; renderCredits(); }
    if (data.status === "no_access") return showAnalysisArea(n);
    if (data.status === "no_credits") { area().innerHTML = noCreditsHtml(); return; }
    ai.unlocked.add(n); refreshAiButtons(n);
    if (data.status === "unlocked") { area().innerHTML = analysisHtml(data.analysis); return; }
    if (data.status === "pending") return waitFor(n);
  }
  body.addEventListener("click", async (e) => {
    const u = e.target.closest("[data-unlock]");
    if (u) { u.disabled = true; return unlock(Number(u.dataset.unlock)); }
    const b = e.target.closest("[data-copy]");
    if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copy); b.lastChild.textContent = "Copied"; setTimeout(() => (b.lastChild.textContent = "Copy"), 1600); } catch {}
  });
  function closeDrawer() {
    drawer.hidden = true; body.innerHTML = ""; document.body.style.overflow = "";
    if (location.hash.startsWith("#post=")) history.replaceState(null, "", location.pathname + location.search);
  }
  $("[data-drawer-close]").addEventListener("click", closeDrawer);
  drawer.addEventListener("click", (e) => { if (e.target === drawer) closeDrawer(); });

  const goToResults = () => { closeDrawer(); load(true); $(".feed").scrollIntoView({ behavior: "smooth" }); };
  // "More like this": same format, sport and competition
  function moreLikeThis(id) {
    const p = cache.get(String(id));
    if (!p) return;
    const facets = {};
    for (const c of ["format", "sport", "competition"]) if (p.tags?.[c]?.length) facets[c] = p.tags[c].map((v) => v.id);
    applyState({ order: state().order, facets });
    goToResults();
  }
  // Clicking a tag filters by that value only
  function filterByTag(tag) {
    const [cat, id] = tag.split(":");
    applyState({ order: state().order, facets: { [cat]: [Number(id)] } });
    goToResults();
  }

  // ---------- Quality review (superadmins only, supabase/quality.sql) ----------
  // Removing hides the post for everyone and keeps it hidden in future imports. Undo / restore any time.
  const REASONS = ["Low quality", "Not sports content", "Duplicate", "Off-brand", "Other"];
  function askRemove(btn, id) {
    document.querySelectorAll(".rm-pop").forEach((x) => x.remove());
    const pop = document.createElement("div");
    pop.className = "rm-pop";
    pop.innerHTML = `<b>Remove this post from the library?</b><p>Members won't see it any more, and it stays hidden in future imports.</p>
      <div class="rm-reasons">${REASONS.map((r, i) => `<label><input type="radio" name="rm-reason" value="${esc(r)}"${i ? "" : " checked"}>${esc(r)}</label>`).join("")}</div>
      <div class="rm-actions"><button type="button" data-rm-cancel>Cancel</button><button type="button" data-rm-ok>${icon("trash-2")}Remove</button></div>`;
    document.body.append(pop);
    const r = btn.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = `${Math.max(12, Math.min(innerWidth - w - 12, r.right - w))}px`;
    pop.style.top = `${r.bottom + 8 + h > innerHeight ? Math.max(12, r.top - h - 8) : r.bottom + 8}px`;
    const close = () => { pop.remove(); document.removeEventListener("mousedown", outside, true); };
    const outside = (e) => { if (!pop.contains(e.target)) close(); };
    setTimeout(() => document.addEventListener("mousedown", outside, true));
    pop.querySelector("[data-rm-cancel]").addEventListener("click", close);
    pop.querySelector("[data-rm-ok]").addEventListener("click", async (e) => {
      e.target.disabled = true;
      const reason = pop.querySelector("input:checked")?.value || null;
      const { error } = await db.rpc("remove_content_idea", { p_post_id: Number(id), p_reason: reason });
      close();
      if (error) return toast(/schema cache|does not exist/i.test(error.message) ? "Run supabase/quality.sql in Supabase first." : error.message);
      removeCard(id);
    });
  }
  function removeCard(id) {
    const p = cache.get(String(id));
    if (!drawer.hidden && body.querySelector(`[data-remove="${CSS.escape(String(id))}"]`)) closeDrawer();
    const el = grid.querySelector(`.lib-card[data-id="${CSS.escape(String(id))}"]`);
    const spot = el && { parent: el.parentNode, next: el.nextSibling, entry: placed.find((x) => x.el === el) };
    if (el) {
      el.classList.add("is-removing");
      setTimeout(() => { el.remove(); placed = placed.filter((x) => x.el !== el); }, 260);
    }
    toast("Removed from the library.", "Undo", async () => {
      const { error } = await db.rpc("restore_content_idea", { p_external_id: p?.external_id });
      if (error) return toast(error.message);
      if (spot?.parent?.isConnected) {
        el.classList.remove("is-removing");
        spot.parent.insertBefore(el, spot.next?.parentNode === spot.parent ? spot.next : null);
        if (spot.entry) placed.push(spot.entry);
      }
      toast("Post restored.");
    });
  }
  let toastTimer;
  function toast(text, action, onAction) {
    document.querySelector(".lib-toast")?.remove();
    const t = document.createElement("div");
    t.className = "lib-toast";
    t.innerHTML = `<span>${esc(text)}</span>${action ? `<button type="button">${esc(action)}</button>` : ""}`;
    document.body.append(t);
    if (action) t.querySelector("button").addEventListener("click", () => { t.remove(); onAction(); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.remove(), action ? 8000 : 3500);
  }

  document.addEventListener("click", (e) => {
    const rm = e.target.closest("[data-remove]");
    if (rm && me.isSuper) { e.preventDefault(); e.stopPropagation(); return askRemove(rm, rm.dataset.remove); }
    const tag = e.target.closest("[data-tag]");
    if (tag) return filterByTag(tag.dataset.tag);
    const open = e.target.closest("[data-open]");
    if (open) return openPost(open.dataset.open);
    const like = e.target.closest("[data-more-like]");
    if (like) return moreLikeThis(like.dataset.moreLike);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !drawer.hidden) closeDrawer(); });

  // Deep link from the Saved page: content-library.html#post=<id> opens that post's details
  async function openFromHash() {
    const id = /^#post=(\d+)$/.exec(location.hash)?.[1];
    if (!id) return;
    if (!cache.has(id)) {
      const { data } = await db.from("content_ideas").select("id,external_id,url,title,published_at,embed,media_ratio,content_idea_tags(idea_catalog(id,category,name))").eq("id", id).maybeSingle();
      if (!data) return;
      const tags = {};
      for (const { idea_catalog: v } of data.content_idea_tags || []) if (v) (tags[v.category] ||= []).push({ id: v.id, name: v.name });
      cache.set(id, { ...data, tags });
    }
    openPost(id);
  }
  window.addEventListener("hashchange", openFromHash);

  // ---------- Filter events ----------
  root.addEventListener("change", (e) => {
    if (e.target.closest("[data-saved-searches], [data-facet-search]")) return;
    if (e.target.closest("[data-order]")) seed = String(Math.random()).slice(2, 10); // new shuffle each "Surprise me"
    load(true);
  });
  let timer;
  $("[data-q]").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => load(true), 350); });
  more.addEventListener("click", () => load(false));
  function clearAll() {
    applyState({ order: state().order });
    $$("[data-facet-search]").forEach((i) => { i.value = ""; i.dispatchEvent(new Event("input", { bubbles: true })); });
    load(true);
  }
  $("[data-clear]").addEventListener("click", clearAll);

  if (!db) return load(true);
  Promise.all([loadCatalog().then(renderFacets).catch(() => {}), boards.load(), loadSavedSearches(), loadMe().catch(() => {}), loadAi().catch(() => {})]).then(() => { load(true); openFromHash(); });
})();

// Welcome offer shown when entering the platform (once per browser session)
(() => {
  const modal = document.querySelector("[data-offer]");
  if (!modal) return;
  const KEY = "scp-offer-seen";
  let seen = false;
  try { seen = sessionStorage.getItem(KEY) === "1"; } catch {}
  const close = () => {
    modal.hidden = true;
    document.body.style.overflow = "";
    try { sessionStorage.setItem(KEY, "1"); } catch {}
  };
  if (!seen) {
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    modal.querySelector(".offer-cta").focus({ preventScroll: true });
  }
  modal.querySelector("[data-offer-close]").addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) close(); });
})();
