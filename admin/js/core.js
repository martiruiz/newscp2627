// SCP Admin — shared code: auth guard, sidebar, catalog, multi-select, filter panel, modals, CSV and embeds.
// Needs supabase-js (UMD), ../js/config.js and ../js/auth.js loaded first.
(() => {
  const auth = window.SCP_AUTH;
  const db = auth?.client || null;

  // ---------- Constants ----------
  const CATEGORIES = [
    { key: "trend", label: "Trend" },
    { key: "sport", label: "Sport" },
    { key: "entity", label: "Entity" },
    { key: "competition", label: "Competition" },
    { key: "club", label: "Club" },
    { key: "format", label: "Format" },
    { key: "platform", label: "Platform" },
    { key: "campaign", label: "Campaign" },
  ];
  const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));
  // Order used on the Filters page (same as the previous back-end)
  const CATALOG_ORDER = ["sport", "entity", "competition", "club", "platform", "format", "campaign", "trend"];

  const ICONS = {
    ideas: '<path d="M4 7h16M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/>',
    library: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    filters: '<path d="M3 4h18l-7 8.5V19l-4 2v-8.5z"/>',
    import: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    smart: '<path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    billing: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h4"/>',
    audience: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2a5 5 0 0 1 6 4.8"/>',
    account: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    columns: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-1"/>',
    alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    external: '<path d="M15 3h6v6M10 14L21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;

  // ---------- Small helpers ----------
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const store = {
    get(k, fallback = null) { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const pad = (n) => String(n).padStart(2, "0");
  // Dates are stored and shown in UTC, like the previous back-end.
  function fmtDate(iso, withTime = true) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d)) return "—";
    const day = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    return withTime ? `${day} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : day;
  }
  function fmtDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  const toLocalInput = (iso) => (iso ? new Date(iso).toISOString().slice(0, 16) : ""); // UTC value for <input type=datetime-local>
  const fromLocalInput = (v) => (v ? new Date(`${v}:00Z`).toISOString() : null);
  const num = (n) => Number(n || 0).toLocaleString("es-ES");
  const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const chunk = (arr, size) => { const out = []; for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size)); return out; };

  // Turn a Supabase error into a readable message
  function errMsg(e) {
    if (!e) return "Something went wrong.";
    const m = e.message || String(e);
    if (/Failed to fetch|NetworkError/i.test(m)) return "Can't reach the database. Check your connection and try again.";
    if (/does not exist|schema cache/i.test(m)) return "The admin database isn't set up yet — run supabase/admin.sql in Supabase.";
    return m;
  }
  async function rpc(name, params = {}) {
    if (!db) throw new Error("Supabase isn't connected (keys missing in js/config.js).");
    const { data, error } = await db.rpc(name, params);
    if (error) throw new Error(errMsg(error));
    return data;
  }

  // ---------- Toasts ----------
  function toast(text, kind = "ok") {
    let box = $(".toasts");
    if (!box) { box = document.createElement("div"); box.className = "toasts"; document.body.append(box); }
    const t = document.createElement("div");
    t.className = `toast ${kind}`;
    t.textContent = text;
    box.append(t);
    setTimeout(() => t.remove(), kind === "err" ? 7000 : 3500);
  }

  // ---------- Modals ----------
  // modal({ title, sub, body (html), foot (html), size }) → { el, close, body }
  function modal({ title, sub = "", body = "", foot = "", size = "", onClose } = {}) {
    const back = document.createElement("div");
    back.className = "modal-back";
    back.innerHTML = `
      <div class="modal ${size === "sm" ? "modal-sm" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="modal-head"><div><h2>${esc(title)}</h2>${sub ? `<p>${sub}</p>` : ""}</div><button class="modal-close" type="button" aria-label="Close">×</button></div>
        <div class="modal-body">${body}</div>
        ${foot ? `<div class="modal-foot">${foot}</div>` : ""}
      </div>`;
    document.body.append(back);
    document.body.style.overflow = "hidden";
    const close = () => {
      back.remove();
      if (!$(".modal-back")) document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
      onClose?.();
    };
    const onKey = (e) => {
      if (e.key !== "Escape" || back !== $$(".modal-back").pop()) return;
      if (MultiSelect.openOne) return MultiSelect.closeAll(); // first Escape closes an open dropdown
      close();
    };
    document.addEventListener("keydown", onKey);
    $(".modal-close", back).addEventListener("click", close);
    back.addEventListener("mousedown", (e) => { if (e.target === back) close(); });
    return { el: back, body: $(".modal-body", back), close };
  }

  function confirmDialog({ title, text, confirm = "Confirm", danger = false }) {
    return new Promise((resolve) => {
      let done = false;
      const m = modal({
        title, size: "sm",
        body: `<p class="muted">${text}</p>`,
        foot: `<button class="btn btn-ghost" type="button" data-no>Cancel</button><button class="btn ${danger ? "btn-danger" : "btn-primary"}" type="button" data-yes>${esc(confirm)}</button>`,
        onClose: () => { if (!done) resolve(false); },
      });
      $("[data-no]", m.el).addEventListener("click", () => m.close());
      $("[data-yes]", m.el).addEventListener("click", () => { done = true; m.close(); resolve(true); });
      $("[data-yes]", m.el).focus();
    });
  }

  // ---------- Auth guard + layout ----------
  const NAV = [
    { href: "content-ideas.html", label: "Content Ideas", icon: "ideas", key: "ideas" },
    { href: "library.html", label: "Content Library", icon: "library", key: "library" },
    { href: "filters.html", label: "Filters", icon: "filters", key: "filters" },
    { href: "import.html", label: "Import", icon: "import", key: "import" },
    { href: "audience.html", label: "Audience", icon: "audience", key: "audience" },
    { href: "smart-review.html", label: "Smart filters", icon: "smart", key: "smart" },
    { href: "billing.html", label: "Plans & AI", icon: "billing", key: "billing" },
    { href: "users.html", label: "Users", icon: "users", key: "users" },
  ];
  const here = () => location.pathname.split("/").pop() || "content-ideas.html";
  let loggingOut = false;

  async function boot(pageKey) {
    const main = $("[data-main]");
    const toLogin = () => location.replace(`login.html?next=${encodeURIComponent(here())}`);
    if (!db) { main.innerHTML = `<p class="error-text">Supabase isn't connected yet (keys missing in <code>js/config.js</code>).</p>`; throw new Error("no db"); }
    const { data: { session } } = await db.auth.getSession();
    if (!session) { toLogin(); throw new Error("no session"); }
    const { data: profile } = await db.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
    renderSide(pageKey, session, profile);
    // Logged out in another tab → go to the login page (our own Logout button navigates by itself)
    db.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT" && !loggingOut) toLogin(); });
    if (profile?.role !== "superadmin") {
      main.innerHTML = `
        <div class="panel panel-pad" style="max-width:520px">
          <h2>No access</h2>
          <p class="muted" style="margin-top:6px">Your account (${esc(session.user.email)}) doesn't have access to the back-end. Only superadmins can use it.</p>
        </div>`;
      document.documentElement.classList.remove("auth-checking");
      throw new Error("not admin");
    }
    document.documentElement.classList.remove("auth-checking");
    return { session, profile };
  }

  function renderSide(pageKey, session, profile) {
    const side = $("[data-side]");
    if (!side) return;
    side.innerHTML = `
      <div class="side-brand"><img src="../assets/icon-logo-lg.svg" alt=""><div><b>SCP Admin</b><span>Sports Content Playbook</span></div></div>
      <nav aria-label="Admin">${NAV.map((n) => `<a href="${n.href}"${n.key === pageKey ? ' aria-current="page"' : ""}>${icon(n.icon)}${n.label}</a>`).join("")}</nav>
      <a class="side-cta" href="../content-library.html">Open Content Library<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg></a>
      <div class="side-foot">
        <p class="side-user" title="${esc(session.user.email)}">${esc(session.user.email)}${profile?.role ? ` · ${esc(profile.role)}` : ""}</p>
        <a href="account.html"${pageKey === "account" ? ' aria-current="page"' : ""}>${icon("account")}Account</a>
        <button class="side-btn" type="button" data-logout>${icon("logout")}Logout</button>
      </div>`;
    $("[data-logout]", side).addEventListener("click", async () => {
      loggingOut = true;
      await db.auth.signOut();
      location.href = "login.html";
    });
  }

  // ---------- Catalog (filter values) ----------
  let catalogCache = null;
  async function loadCatalog(force = false) {
    if (catalogCache && !force) return catalogCache;
    const rows = await rpc("catalog_with_counts");
    const byCat = Object.fromEntries(CATEGORIES.map((c) => [c.key, []]));
    const byId = new Map();
    for (const r of rows || []) {
      const v = { id: Number(r.id), category: r.category, name: r.name, ideas: Number(r.ideas) };
      (byCat[v.category] ||= []).push(v);
      byId.set(v.id, v);
    }
    for (const k in byCat) byCat[k].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
    catalogCache = { byCat, byId };
    return catalogCache;
  }

  // ---------- Multi-select dropdown ----------
  // new MultiSelect(container, { options: [{id, name, count}], selected: [ids], label: "select" | "count",
  //   chips: element|null, onChange(ids), onCreate(name) → Promise<option> })
  class MultiSelect {
    constructor(container, opts) {
      this.el = container;
      this.opts = opts;
      this.options = opts.options || [];
      this.selected = new Set((opts.selected || []).map(Number));
      this.counts = null;
      this.el.classList.add("ms");
      this.el.innerHTML = `<button class="ms-trigger" type="button" aria-haspopup="listbox" aria-expanded="false"><span></span>${icon("chevron")}</button>`;
      this.trigger = $(".ms-trigger", this.el);
      this.trigger.addEventListener("click", (e) => { e.stopPropagation(); this.pop ? this.close() : this.open(); });
      this.render();
    }
    setOptions(options) { this.options = options; this.render(); if (this.pop) this.renderList(); }
    setCounts(counts) { this.counts = counts; if (this.pop) this.renderList(); }
    setSelected(ids, silent = true) { this.selected = new Set((ids || []).map(Number)); this.render(); if (this.pop) this.renderList(); if (!silent) this.opts.onChange?.([...this.selected]); }
    value() { return [...this.selected]; }
    nameOf(id) { return this.options.find((o) => o.id === id)?.name ?? `#${id}`; }
    render() {
      const n = this.selected.size;
      const span = $("span", this.trigger);
      if (this.opts.label === "count") span.textContent = n ? `${n} selected` : "None";
      else span.textContent = n === 0 ? "Select" : n === 1 ? this.nameOf([...this.selected][0]) : `${n} selected`;
      this.trigger.classList.toggle("has-value", n > 0);
      if (this.opts.chips) {
        this.opts.chips.innerHTML = [...this.selected].map((id) => `<span class="chip">${esc(this.nameOf(id))}<button type="button" data-rm="${id}" aria-label="Remove ${esc(this.nameOf(id))}">×</button></span>`).join("");
        $$("[data-rm]", this.opts.chips).forEach((b) => b.addEventListener("click", () => this.toggle(Number(b.dataset.rm))));
      }
    }
    toggle(id) {
      if (this.opts.single) {
        this.selected = new Set(this.selected.has(id) ? [] : [id]);
        this.render();
        this.close();
        this.trigger.focus();
        this.opts.onChange?.([...this.selected]);
        return;
      }
      this.selected.has(id) ? this.selected.delete(id) : this.selected.add(id);
      this.render();
      if (this.pop) this.renderList();
      this.opts.onChange?.([...this.selected]);
    }
    open() {
      MultiSelect.closeAll();
      this.pop = document.createElement("div");
      this.pop.className = "ms-pop";
      this.pop.innerHTML = `<input class="input" type="search" placeholder="Search..." aria-label="Search values"><div class="ms-list" role="listbox" aria-multiselectable="true"></div>`;
      this.el.append(this.pop);
      this.trigger.setAttribute("aria-expanded", "true");
      this.search = $("input", this.pop);
      this.search.addEventListener("input", () => this.renderList());
      this.search.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); $(".ms-opt", this.pop)?.click(); }
        if (e.key === "ArrowDown") { e.preventDefault(); $(".ms-opt", this.pop)?.focus(); }
      });
      this.pop.addEventListener("click", (e) => e.stopPropagation());
      this.pop.addEventListener("keydown", (e) => {
        if (e.key === "Escape") { e.stopPropagation(); this.close(); this.trigger.focus(); }
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          const items = $$(".ms-opt", this.pop); const i = items.indexOf(document.activeElement);
          if (i >= 0) { e.preventDefault(); items[Math.max(0, Math.min(items.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))].focus(); }
        }
      });
      this.renderList();
      this.search.focus();
      MultiSelect.openOne = this;
    }
    renderList() {
      const q = this.search.value.trim().toLowerCase();
      let list = this.options;
      if (q) list = list.filter((o) => o.name.toLowerCase().includes(q));
      // selected first, then by name
      list = [...list].sort((a, b) => (this.selected.has(b.id) - this.selected.has(a.id)) || a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
      const shown = list.slice(0, 300);
      const count = (o) => (this.counts ? this.counts.get(o.id) || 0 : o.count);
      let html = shown.map((o) => `<button class="ms-opt" type="button" role="option" data-id="${o.id}" aria-checked="${this.selected.has(o.id)}"><span class="box"></span><span class="name">${esc(o.name)}</span>${count(o) != null ? `<span class="count">(${num(count(o))})</span>` : ""}</button>`).join("");
      if (list.length > shown.length) html += `<p class="ms-empty">${list.length - shown.length} more — type to narrow down</p>`;
      if (!list.length) html = `<p class="ms-empty">No results</p>`;
      if (this.opts.onCreate && q && !this.options.some((o) => o.name.toLowerCase() === q)) {
        html += `<button class="ms-opt ms-create" type="button" data-create>+ Create “${esc(this.search.value.trim())}”</button>`;
      }
      const box = $(".ms-list", this.pop);
      box.innerHTML = html;
      $$(".ms-opt[data-id]", box).forEach((b) => b.addEventListener("click", () => this.toggle(Number(b.dataset.id))));
      $("[data-create]", box)?.addEventListener("click", async () => {
        try {
          const created = await this.opts.onCreate(this.search.value.trim());
          if (!created) return;
          this.options = [...this.options, created];
          this.search.value = "";
          this.toggle(created.id);
        } catch (e) { toast(errMsg(e), "err"); }
      });
    }
    close() {
      this.pop?.remove();
      this.pop = null;
      this.trigger.setAttribute("aria-expanded", "false");
      if (MultiSelect.openOne === this) MultiSelect.openOne = null;
    }
    static closeAll() { MultiSelect.openOne?.close(); }
  }
  document.addEventListener("click", () => MultiSelect.closeAll());

  // ---------- Filter panel (Content Ideas + Content Library) ----------
  // new FilterPanel(el, { catalog, storageKey, showExternalId, onChange(state) })
  class FilterPanel {
    constructor(el, opts) {
      this.el = el;
      this.opts = opts;
      const empty = () => ({ filters: Object.fromEntries(CATEGORIES.map((c) => [c.key, { ids: [], mode: "any" }])), q: "", external_id: "", from: "", to: "" });
      this.empty = empty;
      const saved = store.get(opts.storageKey);
      this.state = saved ? { ...empty(), ...saved, filters: { ...empty().filters, ...(saved.filters || {}) } } : empty();
      this.selects = {};
      el.classList.add("panel", "filters");
      el.innerHTML = `
        <div class="filter-grid">${CATEGORIES.map((c) => `
          <div class="filter-item" data-cat="${c.key}">
            <div class="fhead"><span>${c.label}</span><div class="mode"><button type="button" data-mode="all">ALL</button><button type="button" data-mode="any">ANY</button></div></div>
            <div data-ms></div>
          </div>`).join("")}
        </div>
        <div class="filter-extra">
          <label class="field"><span class="label">Search</span><input class="input" type="search" placeholder="Search by title..." data-q></label>
          ${opts.showExternalId ? `<label class="field"><span class="label">External ID</span><input class="input" type="search" placeholder="Filter by ID..." data-ext></label>` : ""}
          <label class="field"><span class="label">From</span><input class="input" type="date" data-from></label>
          <label class="field"><span class="label">To</span><input class="input" type="date" data-to></label>
        </div>`;
      for (const c of CATEGORIES) {
        const item = $(`[data-cat="${c.key}"]`, el);
        const ms = new MultiSelect($("[data-ms]", item), {
          options: opts.catalog.byCat[c.key].map((v) => ({ id: v.id, name: v.name, count: v.ideas })),
          selected: this.state.filters[c.key].ids,
          onChange: (ids) => { this.state.filters[c.key].ids = ids; this.changed(); },
        });
        this.selects[c.key] = ms;
        $$("[data-mode]", item).forEach((b) => b.addEventListener("click", () => {
          this.state.filters[c.key].mode = b.dataset.mode;
          this.renderModes();
          if (this.state.filters[c.key].ids.length) this.changed();
          else this.save();
        }));
      }
      const q = $("[data-q]", el), ext = $("[data-ext]", el), from = $("[data-from]", el), to = $("[data-to]", el);
      q.value = this.state.q; if (ext) ext.value = this.state.external_id; from.value = this.state.from; to.value = this.state.to;
      const typed = debounce(() => this.changed(), 350);
      q.addEventListener("input", () => { this.state.q = q.value; typed(); });
      ext?.addEventListener("input", () => { this.state.external_id = ext.value; typed(); });
      from.addEventListener("change", () => { this.state.from = from.value; this.changed(); });
      to.addEventListener("change", () => { this.state.to = to.value; this.changed(); });
      this.renderModes();
    }
    renderModes() {
      for (const c of CATEGORIES) $$(`[data-cat="${c.key}"] [data-mode]`, this.el).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === this.state.filters[c.key].mode)));
    }
    save() { store.set(this.opts.storageKey, this.state); }
    changed() { this.save(); this.opts.onChange?.(this.state); }
    clear() {
      this.state = this.empty();
      for (const c of CATEGORIES) this.selects[c.key].setSelected([]);
      $$("input", this.el).forEach((i) => (i.value = ""));
      this.renderModes();
      this.changed();
    }
    // remove a single value (used by the tag chips on the Library page)
    params() {
      const f = {};
      for (const [k, v] of Object.entries(this.state.filters)) if (v.ids.length) f[k] = { ids: v.ids, mode: v.mode };
      return {
        p_filters: f,
        p_q: this.state.q.trim() || null,
        p_external_id: this.state.external_id?.trim() || null,
        p_from: this.state.from || null,
        p_to: this.state.to || null,
      };
    }
    isFiltered() { const p = this.params(); return Object.keys(p.p_filters).length || p.p_q || p.p_external_id || p.p_from || p.p_to; }
    async refreshCounts() {
      try {
        const rows = await rpc("available_filter_counts", this.params());
        const counts = new Map((rows || []).map((r) => [Number(r.value_id), Number(r.ideas)]));
        for (const c of CATEGORIES) this.selects[c.key].setCounts(counts);
      } catch { /* counts are a nice-to-have */ }
    }
  }

  // ---------- Pagination ----------
  function pager(el, { page, totalPages, onPage }) {
    el.innerHTML = `
      <span class="muted">Page ${num(page)} of ${num(totalPages)}</span>
      <div class="pager-btns">
        <button type="button" data-p="1" ${page <= 1 ? "disabled" : ""} aria-label="First page">«</button>
        <button type="button" data-p="${page - 1}" ${page <= 1 ? "disabled" : ""} aria-label="Previous page">‹</button>
        <span class="cur">${num(page)}</span>
        <button type="button" data-p="${page + 1}" ${page >= totalPages ? "disabled" : ""} aria-label="Next page">›</button>
        <button type="button" data-p="${totalPages}" ${page >= totalPages ? "disabled" : ""} aria-label="Last page">»</button>
      </div>`;
    $$("[data-p]", el).forEach((b) => b.addEventListener("click", () => onPage(Number(b.dataset.p))));
  }

  // ---------- CSV ----------
  const CSV_COLUMNS = ["external_id", "published_at", "embed", "url", "format", "title", "sport", "competition", "club", "platform", "entity", "trend", "campaign"];
  function csvCell(v) {
    const s = String(v ?? "");
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  function toCSV(rows, columns) {
    return [columns.join(","), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(","))].join("\r\n");
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  // Idea (with tags map) → CSV row in the import format
  function ideaToCsvRow(idea) {
    const row = { external_id: idea.external_id, published_at: idea.published_at ? new Date(idea.published_at).toISOString() : "", embed: idea.embed || "", url: idea.url || "", title: idea.title || "" };
    for (const c of CATEGORIES) row[c.key] = (idea.tags?.[c.key] || []).map((t) => t.name).join(",");
    return row;
  }

  // ---------- Embeds ----------
  // Embed HTML comes from our own imports. Scripts inside it are removed; the official platform scripts are loaded once instead.
  function cleanEmbed(html) {
    const tpl = document.createElement("template");
    tpl.innerHTML = String(html || "");
    $$("script", tpl.content).forEach((s) => s.remove());
    $$("*", tpl.content).forEach((el) => [...el.attributes].forEach((a) => { if (/^on/i.test(a.name) || /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name); }));
    return tpl.innerHTML;
  }
  const SCRIPTS = {
    instagram: "https://www.instagram.com/embed.js",
    tiktok: "https://www.tiktok.com/embed.js",
    x: "https://platform.twitter.com/widgets.js",
  };
  function embedKind(html) {
    if (/instagram-media/.test(html)) return "instagram";
    if (/tiktok-embed/.test(html)) return "tiktok";
    if (/twitter-tweet/.test(html)) return "x";
    return "other";
  }
  function loadScript(src) {
    return new Promise((resolve) => {
      const s = document.createElement("script");
      s.async = true; s.src = src; s.onload = resolve; s.onerror = resolve;
      document.body.append(s);
    });
  }
  let tiktokTimer;
  async function activateEmbeds(root) {
    const html = root.innerHTML;
    if (/instagram-media/.test(html)) {
      if (window.instgrm) window.instgrm.Embeds.process();
      else if (!document.querySelector(`script[src="${SCRIPTS.instagram}"]`)) loadScript(SCRIPTS.instagram);
    }
    if (/twitter-tweet/.test(html)) {
      if (window.twttr?.widgets) window.twttr.widgets.load(root);
      else if (!document.querySelector(`script[src="${SCRIPTS.x}"]`)) loadScript(SCRIPTS.x);
    }
    if (/tiktok-embed/.test(html)) {
      // TikTok's script only scans once, so reload it (debounced) when new embeds appear
      clearTimeout(tiktokTimer);
      tiktokTimer = setTimeout(() => {
        document.querySelectorAll(`script[src="${SCRIPTS.tiktok}"]`).forEach((s) => s.remove());
        loadScript(SCRIPTS.tiktok);
      }, 150);
    }
  }
  function platformOfUrl(url = "") {
    if (/instagram\.com/.test(url)) return "Instagram";
    if (/tiktok\.com/.test(url)) return "TikTok";
    if (/twitter\.com|x\.com/.test(url)) return "X";
    if (/youtube\.com|youtu\.be/.test(url)) return "YouTube";
    if (/facebook\.com|fb\.watch/.test(url)) return "Facebook";
    if (/linkedin\.com/.test(url)) return "LinkedIn";
    return "the platform";
  }
  // URL of a post, taken from the url column or from the embed HTML
  function postUrl(idea) {
    if (idea.url) return idea.url;
    const m = String(idea.embed || "").match(/(?:cite|data-instgrm-permalink|href|src)=["']([^"']+)["']/);
    return m ? m[1].replace("https://www.youtube.com/embed/", "https://www.youtube.com/watch?v=") : "";
  }

  // ---------- Content idea editor (create + edit) ----------
  async function openIdeaEditor({ idea = null, onSaved } = {}) {
    const catalog = await loadCatalog();
    const isNew = !idea;
    const m = modal({
      title: isNew ? "Create Content Idea" : "Edit Content Idea",
      sub: isNew ? "Add a new content idea manually" : `ID: ${esc(idea.external_id)}`,
      body: `
        <div class="grid-2">
          <label class="field"><span class="label">Title</span><input class="input" name="title" value="${esc(idea?.title || "")}"></label>
          <label class="field"><span class="label">External ID</span><input class="input mono" name="external_id" value="${esc(idea?.external_id || "")}" required>${isNew ? '<span class="hint">Required — must be unique</span>' : ""}</label>
        </div>
        <label class="field" style="max-width:330px"><span class="label">Published At (UTC)</span><input class="input" type="datetime-local" name="published_at" value="${esc(toLocalInput(idea?.published_at))}"></label>
        <label class="field"><span class="label">URL</span><input class="input" name="url" placeholder="https://..." value="${esc(idea?.url || "")}"></label>
        <label class="field"><span class="label">Embed</span><textarea class="textarea" name="embed" rows="5" placeholder="Paste the social embed HTML here...">${esc(idea?.embed || "")}</textarea></label>
        <p class="modal-section">Filter values</p>
        <div class="grid-2">${CATEGORIES.map((c) => `<div class="field" data-ed="${c.key}"><span class="label">${c.label}</span><div data-ms></div><div class="chips" data-chips></div></div>`).join("")}</div>
        <p class="error-text" data-err hidden></p>`,
      foot: `<button class="btn btn-ghost" type="button" data-cancel>Cancel</button><button class="btn btn-primary" type="button" data-save>${isNew ? "Create" : "Save Changes"}</button>`,
    });
    const selects = {};
    for (const c of CATEGORIES) {
      const box = $(`[data-ed="${c.key}"]`, m.el);
      selects[c.key] = new MultiSelect($("[data-ms]", box), {
        label: "count",
        options: catalog.byCat[c.key].map((v) => ({ id: v.id, name: v.name, count: v.ideas })),
        selected: (idea?.tags?.[c.key] || []).map((t) => t.id),
        chips: $("[data-chips]", box),
        onCreate: async (name) => {
          const id = await rpc("catalog_value_id", { p_category: c.key, p_name: name });
          await loadCatalog(true);
          return { id: Number(id), name, count: 0 };
        },
      });
    }
    $("[data-cancel]", m.el).addEventListener("click", m.close);
    $("[data-save]", m.el).addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const err = $("[data-err]", m.el);
      const val = (n) => $(`[name="${n}"]`, m.el).value;
      const data = { title: val("title").trim(), external_id: val("external_id").trim(), published_at: fromLocalInput(val("published_at")), embed: val("embed").trim(), url: val("url").trim() };
      if (!data.external_id) { err.textContent = "External ID is required."; err.hidden = false; return; }
      if (data.published_at && new Date(data.published_at) > new Date()) { err.textContent = "Published at can't be in the future."; err.hidden = false; return; }
      const ids = CATEGORIES.flatMap((c) => selects[c.key].value());
      btn.disabled = true;
      try {
        await rpc("save_content_idea", { p_id: idea?.id ?? null, p_data: data, p_value_ids: ids });
        m.close();
        toast(isNew ? "Content idea created." : "Changes saved.");
        catalogCache = null;
        onSaved?.();
      } catch (e2) {
        err.textContent = errMsg(e2); err.hidden = false;
      } finally { btn.disabled = false; }
    });
  }

  function openIdeaPreview(idea) {
    const url = postUrl(idea);
    const m = modal({
      title: idea.title || "(no title)",
      sub: `${fmtDate(idea.published_at)} · <span class="mono">${esc(idea.external_id)}</span>`,
      body: `
        <div class="embed-preview" data-embed>${idea.embed ? cleanEmbed(idea.embed) : '<p class="muted">No embed.</p>'}</div>
        ${url ? `<a class="link" href="${esc(url)}" target="_blank" rel="noopener">Open on ${esc(platformOfUrl(url))} ↗</a>` : ""}
        <div class="chips">${CATEGORIES.flatMap((c) => (idea.tags?.[c.key] || []).map((t) => `<span class="chip"><b>${c.label}:</b> ${esc(t.name)}</span>`)).join("")}</div>`,
    });
    activateEmbeds($("[data-embed]", m.el));
  }

  window.SCPA = {
    db, auth, CATEGORIES, CAT_LABEL, CATALOG_ORDER, icon, $, $$, esc, store, fmtDate, fmtDateTime, num, debounce, chunk, errMsg, rpc,
    toast, modal, confirmDialog, boot, loadCatalog, MultiSelect, FilterPanel, pager, CSV_COLUMNS, toCSV, csvCell, downloadBlob,
    ideaToCsvRow, cleanEmbed, embedKind, activateEmbeds, platformOfUrl, postUrl, openIdeaEditor, openIdeaPreview,
    resetCatalog: () => { catalogCache = null; },
  };
})();
