// Saved boards (Pinterest-style) shared by the Content Library and the Saved page.
// Tables: folders (= boards, per user) and folder_items (post_id "ci-<content idea id>", or "cr-<platform>|<handle>"
// for a content creator saved from the Content Library's creators' rows).
window.SCP_BOARDS = (() => {
  const db = window.SCP_AUTH?.client;
  const icon = (n) => (window.SCP_ICONS ? window.SCP_ICONS(n) : "");
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const key = (id) => (String(id).startsWith("cr-") ? String(id) : `ci-${id}`);

  let boards = [];            // [{ id, name, created_at }]
  let items = [];             // [{ folder_id, post_id, added_at }]
  let saved = new Map();      // post key -> Set(board id)
  const listeners = new Set();
  const emit = (k) => listeners.forEach((fn) => fn(k));

  function index() {
    saved = new Map();
    for (const it of items) {
      if (!saved.has(it.post_id)) saved.set(it.post_id, new Set());
      saved.get(it.post_id).add(it.folder_id);
    }
  }
  async function load() {
    if (!db) return;
    const [{ data: f }, { data: i }] = await Promise.all([
      db.from("folders").select("id,name,created_at").order("created_at"),
      db.from("folder_items").select("folder_id,post_id,added_at").order("added_at", { ascending: false }),
    ]);
    boards = f || [];
    items = i || [];
    index();
    emit();
  }
  const isSaved = (id) => saved.has(key(id));
  const boardsOf = (id) => saved.get(key(id)) || new Set();
  const itemsOf = (boardId) => items.filter((it) => !boardId || it.folder_id === boardId);

  async function add(boardId, id) {
    const { error } = await db.from("folder_items").insert({ folder_id: boardId, post_id: key(id) });
    if (error && !/duplicate/i.test(error.message)) throw error;
    items.unshift({ folder_id: boardId, post_id: key(id), added_at: new Date().toISOString() });
    index(); emit(key(id));
  }
  async function remove(boardId, id) {
    const { error } = await db.from("folder_items").delete().eq("folder_id", boardId).eq("post_id", key(id));
    if (error) throw error;
    items = items.filter((it) => !(it.folder_id === boardId && it.post_id === key(id)));
    index(); emit(key(id));
  }
  async function create(name) {
    const { data, error } = await db.from("folders").insert({ name }).select("id,name,created_at").single();
    if (error) throw new Error(/duplicate/i.test(error.message) ? "You already have a board with that name." : error.message);
    boards.push(data);
    emit();
    return data;
  }
  async function rename(boardId, name) {
    const { error } = await db.from("folders").update({ name }).eq("id", boardId);
    if (error) throw new Error(/duplicate/i.test(error.message) ? "You already have a board with that name." : error.message);
    boards.find((b) => b.id === boardId).name = name;
    emit();
  }
  async function destroy(boardId) {
    const { error } = await db.from("folders").delete().eq("id", boardId);
    if (error) throw error;
    boards = boards.filter((b) => b.id !== boardId);
    items = items.filter((it) => it.folder_id !== boardId);
    index(); emit();
  }

  // ---------- "Save to board" picker ----------
  const pop = document.createElement("div");
  pop.className = "bp";
  pop.hidden = true;
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-label", "Save to board");
  document.body.append(pop);
  let current = null; // content idea id
  let anchor = null;
  let creating = false;

  const tint = (name) => { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  function render(filter = "") {
    const on = boardsOf(current);
    const q = filter.trim().toLowerCase();
    const list = boards.filter((b) => !q || b.name.toLowerCase().includes(q));
    pop.innerHTML = `
      <div class="bp-head"><b>Save to board</b><button class="bp-x" type="button" aria-label="Close" data-bp-close>${icon("x")}</button></div>
      ${boards.length > 5 ? `<label class="bp-search">${icon("search")}<input type="search" placeholder="Search boards" value="${esc(filter)}" data-bp-search></label>` : ""}
      <ul class="bp-list">
        ${list.map((b) => {
          const n = itemsOf(b.id).length;
          return `<li><button type="button" class="bp-row${on.has(b.id) ? " is-on" : ""}" data-bp-board="${b.id}">
            <span class="bp-tile" style="--h:${tint(b.name)}">${esc(b.name.slice(0, 1).toUpperCase())}</span>
            <span class="bp-name">${esc(b.name)}<small>${n} saved</small></span>
            <span class="bp-state">${on.has(b.id) ? `${icon("check")}Saved` : "Save"}</span>
          </button></li>`;
        }).join("") || `<li class="bp-empty">${boards.length ? "No boards match." : "No boards yet — create your first one."}</li>`}
      </ul>
      ${creating
        ? `<form class="bp-new" data-bp-form><input type="text" maxlength="60" placeholder="Board name, e.g. Matchday ideas" required data-bp-name><button class="pill pill-gold" type="submit">Create</button></form>`
        : `<button class="bp-create" type="button" data-bp-create><span class="bp-tile bp-tile-plus">${icon("plus")}</span>Create board</button>`}
      <p class="bp-error" hidden data-bp-error></p>`;
    if (creating) pop.querySelector("[data-bp-name]").focus();
  }
  function place() {
    const r = anchor.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = `${Math.max(12, Math.min(window.innerWidth - w - 12, r.right - w))}px`;
    pop.style.top = `${r.bottom + 8 + h > window.innerHeight - 12 ? Math.max(12, r.top - h - 8) : r.bottom + 8}px`;
  }
  function open(btn, id) {
    if (!pop.hidden && current === id) return close();
    current = id; anchor = btn; creating = boards.length === 0;
    render();
    pop.hidden = false;
    place();
  }
  function close() { pop.hidden = true; current = null; creating = false; }
  const fail = (e) => { const el = pop.querySelector("[data-bp-error]"); if (el) { el.textContent = e.message || String(e); el.hidden = false; } };

  pop.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (e.target.closest("[data-bp-close]")) return close();
    if (e.target.closest("[data-bp-create]")) { creating = true; render(pop.querySelector("[data-bp-search]")?.value || ""); return place(); }
    const row = e.target.closest("[data-bp-board]");
    if (!row) return;
    const boardId = row.dataset.bpBoard;
    try { boardsOf(current).has(boardId) ? await remove(boardId, current) : await add(boardId, current); render(pop.querySelector("[data-bp-search]")?.value || ""); }
    catch (err) { fail(err); }
  });
  pop.addEventListener("input", (e) => { if (e.target.matches("[data-bp-search]")) { render(e.target.value); const i = pop.querySelector("[data-bp-search]"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } });
  pop.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = pop.querySelector("[data-bp-name]").value.trim();
    if (!name) return;
    try { const b = await create(name); await add(b.id, current); creating = false; render(); place(); }
    catch (err) { fail(err); }
  });
  document.addEventListener("click", (e) => { if (!pop.hidden && !e.target.closest("[data-save]")) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !pop.hidden) close(); });
  window.addEventListener("resize", () => !pop.hidden && place());
  document.addEventListener("scroll", () => !pop.hidden && place(), true);

  // Card button: bookmark + plus (bookmark-check when saved)
  const button = (id, cls = "") => {
    const on = isSaved(id);
    return `<button class="save-btn${on ? " is-on" : ""}${cls ? ` ${cls}` : ""}" type="button" data-save="${esc(id)}" aria-label="${on ? "Saved — change boards" : "Save to a board"}" title="${on ? "Saved" : "Save"}">${icon(on ? "bookmark-check" : "bookmark-plus")}<span>${on ? "Saved" : "Save"}</span></button>`;
  };
  // Any [data-save] button opens the picker (library cards, pop-up, saved page)
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-save]");
    if (!b) return;
    e.stopPropagation();
    open(b, b.dataset.save);
  }, true);
  // Keep every visible button in sync
  listeners.add(() => document.querySelectorAll("[data-save]").forEach((b) => {
    const on = isSaved(b.dataset.save);
    b.classList.toggle("is-on", on);
    b.innerHTML = `${icon(on ? "bookmark-check" : "bookmark-plus")}<span>${on ? "Saved" : "Save"}</span>`;
  }));

  return {
    load, isSaved, boardsOf, itemsOf, add, remove, create, rename, destroy, button, key,
    get boards() { return boards; },
    onChange: (fn) => listeners.add(fn),
  };
})();
