// Content Library: "Saved boards" as a side panel on the right (same column as the Content Plan; one or the other).
// Your boards (js/boards.js) with their covers; drag a post from the library onto a board to save it there.
// The menu's "Saved boards" and small screens go to the full page (saved.html).
(() => {
  const lib = document.querySelector("[data-library]");
  const btn = document.querySelector("[data-boards-toggle]");
  const B = window.SCP_BOARDS;
  const db = window.SCP_AUTH?.client;
  if (!lib || !btn || !B || !db) return;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const icon = (n) => (window.SCP_ICONS ? window.SCP_ICONS(n) : "");
  const tx = (t, v) => (window.tx ? window.tx(t, v) : t);
  const wide = () => innerWidth > 960;

  const panel = document.createElement("aside");
  panel.className = "pp sbp";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Saved boards");
  lib.append(panel);

  const S = { open: false, openBoard: null, creating: false };
  const covers = new Map();   // content idea id → cover url
  const idOf = (key) => Number(String(key).replace(/^ci-/, ""));

  async function loadCovers() {
    const ids = [...new Set(B.itemsOf(null).map((it) => idOf(it.post_id)))].filter((id) => id && !covers.has(id));
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await db.from("content_ideas").select("id,cover_url").in("id", ids.slice(i, i + 200));
      (data || []).forEach((r) => r.cover_url && covers.set(Number(r.id), r.cover_url));   // only found covers: the rest is asked again next time
    }
  }
  const thumb = (id) => { const c = covers.get(id); return `<i${c ? ` style="background-image:url('${esc(c)}')"` : ""}></i>`; };

  function render() {
    if (!S.open) return;
    const boards = B.boards;
    panel.innerHTML = `<header class="pp-head">
        <div class="pp-title"><span class="pp-eyebrow">${icon("bookmark")}${esc(tx("Saved boards"))}</span><b class="pp-plan-name">${esc(tx("Drag posts onto a board"))}</b></div>
        <a class="pp-icon" href="saved.html" title="${esc(tx("Open the full page"))}">${icon("arrow-up-right")}</a>
        <button class="pp-icon" type="button" data-bp-close aria-label="${esc(tx("Close"))}">${icon("x")}</button>
      </header>
      <div class="pp-bar sbp-bar"><span><b>${boards.length}</b> ${esc(tx(boards.length === 1 ? "board" : "boards"))} · <b>${B.itemsOf(null).length}</b> ${esc(tx("saved posts"))}</span></div>
      <div class="pp-scroll sbp-scroll">
        ${S.creating
          ? `<form class="sbp-new" data-bp-new><input class="input" name="name" maxlength="60" required placeholder="${esc(tx("Board name"))}" autocomplete="off"><button class="btn btn-gold btn-sm" type="submit">${esc(tx("Create"))}</button></form>`
          : `<button class="sbp-add" type="button" data-bp-create>${icon("plus")}${esc(tx("New board"))}</button>`}
        ${boards.length ? boards.map((b) => {
          const its = B.itemsOf(b.id), open = S.openBoard === b.id;
          return `<section class="sbp-board${open ? " is-open" : ""}" data-bp-drop="${b.id}">
            <button class="sbp-board-h" type="button" data-bp-toggle="${b.id}" aria-expanded="${open}">
              <span class="sbp-covers">${[...its].sort((x, y) => covers.has(idOf(y.post_id)) - covers.has(idOf(x.post_id))).slice(0, 3).map((it) => thumb(idOf(it.post_id))).join("") || `<i class="is-empty">${icon("bookmark")}</i>`}</span>
              <span class="sbp-name"><b>${esc(b.name)}</b><small>${esc(tx(its.length === 1 ? "{n} post" : "{n} posts", { n: its.length }))}</small></span>
              ${icon("chevron-down")}
            </button>
            ${open ? `<div class="sbp-grid">${its.map((it) => `<span class="sbp-item">${thumb(idOf(it.post_id))}<button type="button" data-bp-remove="${b.id}|${idOf(it.post_id)}" aria-label="${esc(tx("Remove from the board"))}">${icon("x")}</button></span>`).join("") || `<p class="sbp-empty">${esc(tx("Drag posts from the library here."))}</p>`}</div>` : ""}
            <p class="sbp-drop-hint">${esc(tx("Drop to save here"))}</p>
          </section>`;
        }).join("") : `<p class="sbp-none">${icon("bookmark")}<span>${esc(tx("You don't have any boards yet. Create one and drag posts into it."))}</span></p>`}
      </div>`;
    if (S.creating) $("[data-bp-new] input", panel)?.focus();
  }

  function syncCards() { if (S.open) $$(".lib-card").forEach((c) => { c.draggable = true; }); }
  new MutationObserver(syncCards).observe($("[data-posts]") || lib, { childList: true, subtree: true });

  // as wide as the Content Plan was (week 380 px, day view 540 px): its width is remembered whenever it's open
  const planW = () => { const pp = $(".pp:not(.sbp)"); return pp && !pp.hidden ? Math.round(pp.getBoundingClientRect().width) : 0; };
  const rememberPlanW = () => { const w = planW(); if (w) try { localStorage.setItem("scp-side-w", String(w)); } catch {} };
  const sideW = () => { try { return Number(localStorage.getItem("scp-side-w")) || 0; } catch { return 0; } };
  async function open() {
    if (!wide()) { location.href = "saved.html"; return; }
    rememberPlanW();
    if ($("[data-plan-toggle]")?.getAttribute("aria-pressed") === "true") $("[data-plan-toggle]").click();   // one panel at a time
    const w = sideW();
    if (w) lib.style.setProperty("--side-w", `${w}px`); else lib.style.removeProperty("--side-w");
    S.open = true;
    panel.hidden = false;
    lib.classList.add("plan-open", "boards-open");
    btn.setAttribute("aria-pressed", "true");
    panel.innerHTML = `<div class="pp-loading"><span class="ai-spinner"></span></div>`;
    syncCards();
    try { await B.load(); await loadCovers(); } catch {}
    render();
  }
  function close() {
    S.open = false; S.creating = false;
    panel.hidden = true;
    lib.classList.remove("boards-open");
    if ($("[data-plan-toggle]")?.getAttribute("aria-pressed") !== "true") lib.classList.remove("plan-open");
    btn.setAttribute("aria-pressed", "false");
    $$(".lib-card").forEach((c) => { c.draggable = false; });
  }
  btn.addEventListener("click", (e) => {
    if (!wide()) return;   // small screens: the full page
    e.preventDefault();
    S.open ? close() : open();
  });
  // opening the Content Plan closes this panel (they share the column)
  $("[data-plan-toggle]")?.addEventListener("click", () => { rememberPlanW(); if (S.open) close(); }, true);
  addEventListener("pagehide", rememberPlanW);
  B.onChange(async () => { if (!S.open) return; await loadCovers(); render(); });

  panel.addEventListener("click", async (e) => {
    if (e.target.closest("[data-bp-close]")) return close();
    if (e.target.closest("[data-bp-create]")) { S.creating = true; return render(); }
    const tg = e.target.closest("[data-bp-toggle]");
    if (tg) { S.openBoard = S.openBoard === tg.dataset.bpToggle ? null : tg.dataset.bpToggle; return render(); }
    const rm = e.target.closest("[data-bp-remove]");
    if (rm) { const [b, id] = rm.dataset.bpRemove.split("|"); try { await B.remove(b, Number(id)); } catch (err) { alert(err.message); } }
  });
  panel.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = new FormData(e.target).get("name")?.toString().trim();
    if (!name) return;
    try { const b = await B.create(name); S.creating = false; S.openBoard = b.id; render(); } catch (err) { alert(err.message); }
  });
  panel.addEventListener("keydown", (e) => { if (e.key === "Escape" && S.creating) { S.creating = false; render(); } });

  // ---------- drag a post from the library onto a board ----------
  document.addEventListener("dragstart", (e) => {
    if (!S.open || !e.target.closest) return;
    const card = e.target.closest(".lib-card");
    if (!card) return;
    e.dataTransfer.setData("text/scp-ideas", JSON.stringify([Number(card.dataset.id)]));
    e.dataTransfer.effectAllowed = "copy";
    card.classList.add("is-dragging");
    panel.classList.add("is-receiving");
  });
  document.addEventListener("dragend", () => { panel.classList.remove("is-receiving"); $$(".sbp-board.is-over", panel).forEach((x) => x.classList.remove("is-over")); $$(".lib-card.is-dragging").forEach((c) => c.classList.remove("is-dragging")); });
  const accepts = (e) => [...(e.dataTransfer?.types || [])].includes("text/scp-ideas");
  panel.addEventListener("dragover", (e) => {
    const zone = e.target.closest("[data-bp-drop]");
    if (!zone || !accepts(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    $$(".sbp-board.is-over", panel).forEach((x) => x !== zone && x.classList.remove("is-over"));
    zone.classList.add("is-over");
  });
  panel.addEventListener("dragleave", (e) => { const z = e.target.closest("[data-bp-drop]"); if (z && !z.contains(e.relatedTarget)) z.classList.remove("is-over"); });
  panel.addEventListener("drop", async (e) => {
    const zone = e.target.closest("[data-bp-drop]");
    if (!zone || !accepts(e)) return;
    e.preventDefault();
    zone.classList.remove("is-over");
    let ids = [];
    try { ids = JSON.parse(e.dataTransfer.getData("text/scp-ideas")).map(Number).filter(Boolean); } catch {}
    const board = zone.dataset.bpDrop;
    try { for (const id of ids) await B.add(board, id); S.openBoard = board; render(); zone.classList.add("is-saved"); }
    catch (err) { alert(err.message); }
  });
})();
