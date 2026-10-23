// Saved boards page (Pinterest-style): boards with collage covers → a board's posts in a masonry grid.
// URL: saved.html (all boards) · saved.html#board=<id> · saved.html#board=all
(() => {
  const root = document.querySelector("[data-saved]");
  if (!root) return;
  const db = window.SCP_AUTH?.client;
  const B = window.SCP_BOARDS;
  const icon = (n) => (window.SCP_ICONS ? window.SCP_ICONS(n) : "");
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const pretty = (n) => (n && n[0] === n[0].toLowerCase() ? n[0].toUpperCase() + n.slice(1) : n || "");
  const date = (d) => (d ? new Date(d).toLocaleDateString(window.SCP_LOC || "en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
  const ago = (d) => {
    const days = Math.floor((Date.now() - new Date(d)) / 864e5);
    return days < 1 ? "today" : days === 1 ? "yesterday" : days < 30 ? `${days} days ago` : date(d);
  };
  const posts = new Map(); // id -> post (with tags by category)

  // ---------- Post helpers (same rules as the library) ----------
  const first = (p, cat) => p.tags?.[cat]?.[0]?.name || "";
  const isReel = (p) => /^(reels?|shorts?|video)$/i.test(first(p, "format")) || /\/(reel|shorts)\//.test(p.url || "");
  const igSrc = (p) => { const m = /instagram\.com\/(?:[\w.]+\/)?(p|reel|tv)\/([\w-]+)/.exec(p.url || ""); return m ? `https://www.instagram.com/${m[1]}/${m[2]}/embed/` : ""; };
  // Other platforms (TikTok, YouTube, X, Facebook, LinkedIn): their own player
  const otherSrc = (p) => {
    const u = p.url || ""; let m;
    if ((m = /tiktok\.com\/.*video\/(\d+)/.exec(u))) return `https://www.tiktok.com/embed/v2/${m[1]}`;
    if ((m = /(?:shorts\/|v=|youtu\.be\/)([\w-]{11})/.exec(u))) return `https://www.youtube-nocookie.com/embed/${m[1]}`;
    if ((m = /(?:twitter|x)\.com\/[^/]+\/status\/(\d+)/.exec(u))) return `https://platform.twitter.com/embed/Tweet.html?id=${m[1]}&theme=dark&dnt=true&hideThread=true`;
    if (/facebook\.com\//.test(u)) return `https://www.facebook.com/plugins/${/\/(reel|videos?)\//.test(u) ? "video" : "post"}.php?href=${encodeURIComponent(u)}&show_text=false&width=500`;
    if ((m = /linkedin\.com\/feed\/update\/(urn:li:[\w:]+)/.exec(u))) return `https://www.linkedin.com/embed/feed/update/${m[1]}?collapsed=1`;
    return "";
  };
  const OTHER_RATIO = (p) => { const u = p.url || ""; return /tiktok/.test(u) ? 1.78 : /youtu/.test(u) ? (/shorts/.test(u) ? 1.78 : 0.5625) : 1.25; };
  function shape(p) {
    if (!igSrc(p) && otherSrc(p)) return { ratio: OTHER_RATIO(p) };
    const box = Number(p.media_ratio) || 1.25;
    if (!isReel(p) || box >= 16 / 9) return { ratio: box };
    return { ratio: 16 / 9, zoom: 1 / (box * 9 / 16), boxFrac: box / (16 / 9) };
  }
  const who = (p) => first(p, "club") || first(p, "competition") || first(p, "entity") || "Post";

  async function loadPosts() {
    const ids = [...new Set(B.itemsOf().map((it) => Number(it.post_id.replace(/^ci-/, ""))).filter(Boolean))].filter((id) => !posts.has(id));
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await db.from("content_ideas").select("id,url,title,published_at,embed,media_ratio,unavailable_at,cover_url,content_idea_tags(idea_catalog(id,category,name))").in("id", ids.slice(i, i + 200));
      for (const row of data || []) {
        const tags = {};
        for (const { idea_catalog: v } of row.content_idea_tags || []) if (v) (tags[v.category] ||= []).push({ id: v.id, name: v.name });
        posts.set(Number(row.id), { ...row, tags });
      }
    }
  }
  const postsOf = (boardId) => B.itemsOf(boardId === "all" ? null : boardId)
    .map((it) => posts.get(Number(it.post_id.replace(/^ci-/, ""))))
    .filter((p, i, arr) => p && !p.unavailable_at && arr.indexOf(p) === i);

  // ---------- Saved creators (folder_items "cr-<platform>|<handle>", saved from the Content Library's creators' rows) ----------
  const creators = new Map();   // "platform|handle" -> row of creator_rows() (photo, name, followers)
  const creatorsOf = (boardId) => [...new Set(B.itemsOf(boardId === "all" ? null : boardId).filter((it) => it.post_id.startsWith("cr-")).map((it) => it.post_id.slice(3)))];
  async function loadCreators() {
    if (creators.size || !creatorsOf("all").length) return;
    const { data } = await db.rpc("creator_rows");
    for (const r of Array.isArray(data) ? data : []) creators.set(`${r.platform}|${r.handle}`, r);
  }
  const T = (s, v) => (window.tx ? window.tx(s, v) : s);
  const compact = (n) => Number(n).toLocaleString(window.SCP_LOC || "en-GB", { notation: "compact", maximumFractionDigits: 1 });
  const PROFILE = { instagram: (h) => `https://www.instagram.com/${h}/`, tiktok: (h) => `https://www.tiktok.com/@${h}`, youtube: (h) => `https://www.youtube.com/@${h}`, x: (h) => `https://x.com/${h}` };
  function creatorsHtml(keys) {
    if (!keys.length) return "";
    return `<section class="sv-cr"><h2>${esc(T("Saved creators"))} <span>${keys.length}</span></h2><div class="sv-cr-list">${keys.map((k) => {
      const [platform, handle] = k.split("|"), r = creators.get(k) || {}, name = r.name || handle;
      return `<article class="sv-cr-card">
        <span class="cr-ava">${r.avatar ? `<img src="${esc(r.avatar)}" alt="" loading="lazy">` : `<b>${esc(name.slice(0, 2).toUpperCase())}</b>`}</span>
        <span class="cr-name"><b>${esc(name)}</b><small>@${esc(handle)} · ${esc(pretty(platform))}</small></span>
        <span class="cr-stat"><b>${r.followers ? compact(r.followers) : "—"}</b><small>${esc(T("Followers"))}</small></span>
        <span class="sv-cr-acts">${B.button(`cr-${k}`)}${PROFILE[platform] ? `<a class="pill pill-dark" href="${esc(PROFILE[platform](handle))}" target="_blank" rel="noopener">${esc(T("Profile"))} ↗</a>` : ""}</span>
      </article>`;
    }).join("")}</div></section>`;
  }

  // ---------- Mini previews for board covers: Instagram's embed page scaled + cropped to "cover" the tile ----------
  const W0 = 360, HEADER = 55;
  function mini(p) {
    // the post's cover picture (same as the library's cards); the embed only when there's none
    if (p.cover_url) return `<div class="mini mini-img"><img src="${esc(p.cover_url)}" alt="" loading="lazy" decoding="async"></div>`;
    const src = igSrc(p);
    return `<div class="mini" data-mini="${p.id}">${src ? `<iframe src="${esc(src)}" loading="lazy" tabindex="-1" scrolling="no" title=""></iframe>` : ""}</div>`;
  }
  function fitMinis(scope = root) {
    scope.querySelectorAll("[data-mini]").forEach((tile) => {
      const f = tile.querySelector("iframe");
      if (!f) return;
      const p = posts.get(Number(tile.dataset.mini));
      const box = Number(p?.media_ratio) || 1.25;
      const h = W0 * box;
      const w = p && isReel(p) && box < 16 / 9 ? h * 9 / 16 : W0; // reels: the 9:16 video sits in the middle of the box
      const tw = tile.clientWidth, th = tile.clientHeight;
      const s = Math.max(tw / w, th / h);
      f.style.width = `${W0}px`;
      f.style.height = `${HEADER + h + 320}px`;
      f.style.transform = `translate(${tw / 2 - (W0 / 2) * s}px, ${th / 2 - (HEADER + h / 2) * s}px) scale(${s})`;
    });
  }
  new ResizeObserver(() => fitMinis()).observe(root);

  // ---------- Boards grid ----------
  const tint = (name) => { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  function cover(list, name) {
    const [a, b, c] = [...list].sort((x, y) => Boolean(y.cover_url) - Boolean(x.cover_url));   // posts with a picture first
    if (!a) return `<div class="bd-cover is-empty" style="--h:${tint(name)}"><span>${esc(name.slice(0, 1).toUpperCase())}</span></div>`;
    return `<div class="bd-cover">
      <div class="bd-main">${mini(a)}</div>
      <div class="bd-side">${b ? mini(b) : `<div class="bd-fill"></div>`}</div>
      <div class="bd-side">${c ? mini(c) : `<div class="bd-fill"></div>`}</div>
    </div>`;
  }
  function boardTile(id, name, list, lastAt, extraCls = "") {
    return `<a class="bd${extraCls}" href="#board=${esc(id)}">
      ${cover(list, name)}
      <div class="bd-meta"><b>${esc(name)}</b><span>${list.length} post${list.length === 1 ? "" : "s"}${lastAt ? ` · ${ago(lastAt)}` : ""}</span></div>
    </a>`;
  }
  function renderBoards() {
    const all = postsOf("all");
    const lastOf = (id) => B.itemsOf(id)[0]?.added_at;
    root.innerHTML = `
      <header class="sv-head">
        <div><p class="sv-eyebrow">${icon("bookmark")}Your saved ideas</p><h1>Saved boards</h1>
        <p class="sv-sub">${all.length} post${all.length === 1 ? "" : "s"} saved in ${B.boards.length} board${B.boards.length === 1 ? "" : "s"}</p></div>
        <button class="btn btn-gold sv-new" type="button" data-new-board>${icon("plus")}New board</button>
      </header>
      <div class="bd-grid">
        ${all.length ? boardTile("all", "All saves", all, B.itemsOf()[0]?.added_at, " bd-all") : ""}
        ${B.boards.slice().sort((x, y) => (lastOf(y.id) || y.created_at).localeCompare(lastOf(x.id) || x.created_at)).map((b) => boardTile(b.id, b.name, postsOf(b.id), lastOf(b.id))).join("")}
        <form class="bd bd-create" data-create-form>
          <div class="bd-cover is-new">${icon("folder-plus")}</div>
          <div class="bd-meta"><input type="text" maxlength="60" placeholder="New board name" aria-label="New board name" required data-create-name><button class="pill pill-gold" type="submit">Create</button></div>
        </form>
      </div>
      ${creatorsHtml(creatorsOf("all"))}
      ${!all.length && !creatorsOf("all").length ? `<div class="sv-empty">${icon("bookmark-plus")}<div><b>Save ideas you want to make</b><p>Tap the <span class="sv-inline">${icon("bookmark-plus")}</span> button on any post in the <a href="content-library.html">Content Library</a> to save it to a board.</p></div></div>` : ""}`;
    requestAnimationFrame(() => fitMinis());
  }

  // ---------- One board ----------
  function cardHtml(p) {
    const sh = shape(p);
    const src = igSrc(p);
    const other = !src && otherSrc(p);
    const zoom = sh.zoom ? ` style="--zoom:${sh.zoom.toFixed(4)};--inset:${((1 - sh.boxFrac) / 2 * 100).toFixed(3)}%"` : "";
    return `
      <article class="pin" data-pin="${p.id}">
        <div class="lib-media${sh.zoom ? " is-reel" : ""}" style="aspect-ratio: 1 / ${sh.ratio.toFixed(4)}">
          ${src ? `<div class="lib-zoom"${zoom}><iframe class="lib-frame is-ig" src="${esc(src)}" loading="lazy" title="${esc(who(p))}" scrolling="no" allow="encrypted-media; picture-in-picture; fullscreen"></iframe></div>`
            : other ? `<div class="lib-zoom"><iframe class="lib-frame" src="${esc(other)}" loading="lazy" title="${esc(who(p))}" scrolling="no" allow="encrypted-media; picture-in-picture; fullscreen"></iframe></div>` : `<span class="lib-noimg"></span>`}
          ${sh.zoom ? "" : `<a class="lib-hit" href="content-library.html#post=${p.id}" aria-label="Details · ${esc(who(p))}"></a>`}
          <div class="lib-top">
            ${first(p, "format") ? `<span class="lib-badge">${esc(pretty(first(p, "format")))}</span>` : ""}
            <span class="lib-save">${B.button(p.id)}</span>
          </div>
          <div class="lib-bottom"><p class="lib-who">${esc(who(p))}</p><p class="lib-when">${date(p.published_at)}</p></div>
        </div>
        <div class="pin-actions">
          <a class="pin-details" href="content-library.html#post=${p.id}">${icon("sparkles")}Details</a>
          <button class="pin-remove" type="button" data-remove="${p.id}" title="Remove from this board" aria-label="Remove from this board">${icon("trash-2")}</button>
        </div>
      </article>`;
  }
  let boardId = null;
  function renderBoard(id) {
    boardId = id;
    const isAll = id === "all";
    const board = B.boards.find((b) => b.id === id);
    if (!isAll && !board) { location.hash = ""; return; }
    const list = postsOf(id);
    root.innerHTML = `
      <header class="sv-head sv-head-board">
        <div>
          <a class="sv-back" href="#">${icon("arrow-left")}All boards</a>
          <h1 data-board-title>${esc(isAll ? "All saves" : board.name)}</h1>
          <p class="sv-sub">${list.length} post${list.length === 1 ? "" : "s"}</p>
        </div>
        ${isAll ? "" : `<div class="sv-actions" data-board-actions>
          <button class="pill pill-dark" type="button" data-rename>${icon("pencil")}Rename</button>
          <button class="pill pill-dark sv-danger" type="button" data-delete>${icon("trash-2")}Delete board</button>
        </div>`}
      </header>
      ${creatorsHtml(creatorsOf(id))}
      ${list.length ? `<div class="pins" data-pins></div>` : creatorsOf(id).length ? "" : `<div class="sv-empty">${icon("layers")}<div><b>This board is empty</b><p>Save posts from the <a href="content-library.html">Content Library</a> with the <span class="sv-inline">${icon("bookmark-plus")}</span> button.</p></div></div>`}`;
    if (list.length) layoutPins(list);
  }
  // Masonry: each pin goes to the shortest column
  let pinList = [];
  function layoutPins(list = pinList) {
    pinList = list;
    const wrap = root.querySelector("[data-pins]");
    if (!wrap) return;
    const n = Math.max(1, Math.min(5, Math.floor((wrap.clientWidth + 20) / (250 + 20))));
    if (wrap.dataset.cols === String(n) && wrap.children.length) return;
    wrap.dataset.cols = n;
    wrap.innerHTML = "";
    const cols = Array.from({ length: n }, () => wrap.appendChild(Object.assign(document.createElement("div"), { className: "mcol" })));
    const hs = cols.map(() => 0);
    const tpl = document.createElement("template");
    for (const p of list) {
      tpl.innerHTML = cardHtml(p);
      const i = hs.indexOf(Math.min(...hs));
      cols[i].appendChild(tpl.content.firstElementChild);
      hs[i] += shape(p).ratio + 0.2;
    }
  }
  new ResizeObserver(() => boardId && layoutPins()).observe(root);

  // ---------- Events ----------
  root.addEventListener("click", async (e) => {
    if (e.target.closest("[data-new-board]")) { const i = root.querySelector("[data-create-name]"); i.scrollIntoView({ block: "center", behavior: "smooth" }); return i.focus(); }
    const rm = e.target.closest("[data-remove]");
    if (rm) {
      const id = Number(rm.dataset.remove);
      const targets = boardId === "all" ? [...B.boardsOf(id)] : [boardId];
      for (const b of targets) await B.remove(b, id);
      rm.closest(".pin").classList.add("is-leaving");
      setTimeout(() => renderBoard(boardId), 220);
      return;
    }
    if (e.target.closest("[data-rename]")) {
      const h1 = root.querySelector("[data-board-title]");
      const current = B.boards.find((b) => b.id === boardId)?.name || "";
      h1.innerHTML = `<form class="sv-rename" data-rename-form><input type="text" maxlength="60" value="${esc(current)}" required aria-label="Board name"><button class="pill pill-gold" type="submit">Save</button><button class="pill pill-dark" type="button" data-cancel>Cancel</button></form>`;
      const i = h1.querySelector("input"); i.focus(); i.select();
      return;
    }
    if (e.target.closest("[data-cancel]")) return renderBoard(boardId);
    if (e.target.closest("[data-delete]")) {
      root.querySelector("[data-board-actions]").innerHTML = `<span class="sv-confirm">Delete this board? Saved posts stay in other boards.</span>
        <button class="pill sv-danger-solid" type="button" data-delete-yes>${icon("trash-2")}Delete</button><button class="pill pill-dark" type="button" data-cancel>Cancel</button>`;
      return;
    }
    if (e.target.closest("[data-delete-yes]")) { await B.destroy(boardId); location.hash = ""; }
  });
  root.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (e.target.matches("[data-create-form]")) {
      const name = e.target.querySelector("[data-create-name]").value.trim();
      if (!name) return;
      try { const b = await B.create(name); location.hash = `board=${b.id}`; } catch (err) { alert(err.message); }
    }
    if (e.target.matches("[data-rename-form]")) {
      const name = e.target.querySelector("input").value.trim();
      if (!name) return;
      try { await B.rename(boardId, name); renderBoard(boardId); } catch (err) { alert(err.message); }
    }
  });

  function route() {
    const id = /^#board=(.+)$/.exec(location.hash)?.[1];
    if (id) renderBoard(decodeURIComponent(id)); else { boardId = null; renderBoards(); }
    window.scrollTo({ top: 0 });
  }
  window.addEventListener("hashchange", route);
  // Saving / unsaving from a pin's picker changes board contents: refresh the current view
  B.onChange(async () => { await loadPosts(); await loadCreators(); if (!boardId) renderBoards(); });

  (async () => {
    if (!db) { root.innerHTML = `<p class="sv-empty">Not connected.</p>`; return; }
    await B.load();
    await Promise.all([loadPosts(), loadCreators()]);
    route();
  })();
})();
