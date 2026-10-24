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
    return days < 1 ? T("today") : days === 1 ? T("yesterday") : days < 30 ? T("{n} days ago", { n: days }) : date(d);
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
  const T = (s, v = {}) => (window.tx ? window.tx(s, v) : s.replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m));
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

  // ---------- Boards page ----------
  // a name typed in capitals (old boards were saved that way) reads as a normal sentence
  const nice = (n) => { n = n && n === n.toUpperCase() && /[A-Z]/.test(n) ? n.charAt(0) + n.slice(1).toLowerCase() : n || ""; return n.charAt(0).toUpperCase() + n.slice(1); };
  const tint = (name) => { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  const netOf = (p) => { const u = p.url || ""; return /instagram/.test(u) ? "instagram" : /tiktok/.test(u) ? "tiktok" : /youtu/.test(u) ? "youtube" : /twitter\.com|x\.com/.test(u) ? "x" : /facebook/.test(u) ? "facebook" : /linkedin/.test(u) ? "linkedin" : ""; };
  const nets = (list) => { const m = new Map(); for (const p of list) { const n = netOf(p); if (n) m.set(n, (m.get(n) || 0) + 1); } return [...m].sort((a, b) => b[1] - a[1]); };
  const netChips = (list) => nets(list).map(([n, c]) => `<span class="sv3-chip"><i class="sv3-net" style="-webkit-mask-image:url('assets/pf-${n}.svg');mask-image:url('assets/pf-${n}.svg')"></i>${c}</span>`).join("");
  const topOf = (list, cat) => { const m = new Map(); for (const p of list) { const v = first(p, cat); if (v) m.set(v, (m.get(v) || 0) + 1); } return [...m].sort((a, b) => b[1] - a[1])[0]?.[0] || ""; };
  const isVideo = (p) => isReel(p) || /tiktok\.com|youtu/.test(p.url || "");
  // smart boards: they fill themselves
  let planned = new Set();   // "ci-<id>" already in the Content Plan (org_entries.inspiration)
  const SMART = {
    "smart-video": { name: "Your Reels and TikToks", ic: "play", c: "225, 48, 108", list: () => postsOf("all").filter(isVideo), sub: (n) => T(n === 1 ? "{n} video saved" : "{n} videos saved", { n }) },
    "smart-week": { name: "Saved this week", ic: "zap", c: "240, 184, 74", list: () => { const since = Date.now() - 7 * 864e5; return postsOf("all").filter((p) => B.itemsOf().some((it) => it.post_id === `ci-${p.id}` && new Date(it.added_at) > since)); }, sub: (n) => T(n === 1 ? "{n} new post" : "{n} new posts", { n }) },
    "smart-planned": { name: "Already planned", ic: "calendar-check", c: "37, 211, 102", list: () => postsOf("all").filter((p) => planned.has(`ci-${p.id}`)), sub: (n) => T("{n} in your Content Plan", { n }) },
  };
  async function loadPlanned() {
    const { data } = await db.from("org_entries").select("inspiration").not("inspiration", "is", null).then((r) => r, () => ({}));
    planned = new Set((data || []).map((e) => e.inspiration));
  }
  const view = { q: "", sort: "recent" };

  function cover(list, name, coverId) {
    const sorted = [...list].sort((x, y) => (y.id === coverId) - (x.id === coverId) || Boolean(y.cover_url) - Boolean(x.cover_url));   // the chosen cover, then posts with a picture
    const [a, b, c] = sorted;
    if (!a) return `<div class="bd-cover is-empty" style="--h:${tint(name)}"><span>${esc(nice(name).slice(0, 1).toUpperCase())}</span></div>`;
    return `<div class="bd-cover">
      <div class="bd-main">${mini(a)}</div>
      <div class="bd-side">${b ? mini(b) : `<div class="bd-fill"></div>`}</div>
      <div class="bd-side">${c ? mini(c) : `<div class="bd-fill"></div>`}</div>
    </div>`;
  }
  const lastOf = (id) => B.itemsOf(id)[0]?.added_at;
  function boardCard(b) {
    const list = postsOf(b.id), last = lastOf(b.id), fmt = topOf(list, "format");
    return `<article class="sv3-b${b.pinned ? " is-pinned" : ""}" data-b="${esc(b.id)}">
      <a class="sv3-b-link" href="#board=${esc(b.id)}" aria-label="${esc(nice(b.name))}"></a>
      ${cover(list, b.name, Number(String(b.cover_post || "").replace(/^ci-/, "")))}
      ${b.pinned ? `<span class="sv3-pin">${icon("pin")}Pinned</span>` : ""}
      <div class="sv3-b-acts">
        <button type="button" data-act="pin" title="${b.pinned ? "Unpin" : "Pin on top"}" aria-label="${b.pinned ? "Unpin" : "Pin on top"}">${icon("pin")}</button>
        <button type="button" data-act="share" title="Copy the posts' links" aria-label="Copy the posts' links">${icon("link")}</button>
        <button type="button" data-act="menu" title="More" aria-label="More">${icon("more-horizontal")}</button>
      </div>
      <div class="sv3-b-meta">
        <b><em class="sv3-bic">${icon(b.icon || "folder")}</em>${esc(nice(b.name))}</b>
        <small><span>${list.length} post${list.length === 1 ? "" : "s"}</span>${last ? `<span>${ago(last)}</span>` : ""}</small>
        <div class="sv3-chips">${netChips(list)}${fmt ? `<span class="sv3-chip">${esc(pretty(fmt))}</span>` : ""}</div>
      </div>
    </article>`;
  }
  const SUGGEST = ["Matchday", "Signings", "Sponsors", "Behind the scenes", "Previews", "Fans"];
  function renderBoards() {
    const all = postsOf("all");
    const q = view.q.trim().toLowerCase();
    const match = (b) => !q || nice(b.name).toLowerCase().includes(q) || postsOf(b.id).some((p) => `${who(p)} ${p.title || ""}`.toLowerCase().includes(q));
    const order = { recent: (x, y) => (lastOf(y.id) || y.created_at).localeCompare(lastOf(x.id) || x.created_at), az: (x, y) => nice(x.name).localeCompare(nice(y.name)), most: (x, y) => postsOf(y.id).length - postsOf(x.id).length };
    const boards = B.boards.filter(match).sort((x, y) => Boolean(y.pinned) - Boolean(x.pinned) || order[view.sort](x, y));
    const lastAll = B.itemsOf()[0]?.added_at;
    const withPic = all.filter((p) => p.cover_url), pics = (withPic.length ? withPic : all).slice(0, 5);   // the mosaic only with real pictures
    const smart = Object.entries(SMART).map(([id, sb]) => [id, sb, sb.list()]);
    root.innerHTML = `
      <header class="sv3-head">
        <div>
          <p class="sec-pill"><span class="sec-pill-ic">${icon("bookmark")}</span><span class="sec-pill-k">You are in</span><b>Your saved ideas</b></p>
          <h1>Your <span>boards</span></h1>
          <p class="sv-sub">The ideas you want to make, organised for your team.</p>
        </div>
        <button class="btn btn-gold sv-new" type="button" data-new-board>${icon("plus")}New board</button>
      </header>
      <div class="sv3-stats">
        <div><small>Saved posts</small><b>${all.length}</b></div>
        <div><small>Boards</small><b>${B.boards.length}</b></div>
        <div><small>Networks</small><b>${nets(all).length}</b><span class="sv3-chips">${netChips(all)}</span></div>
        <div><small>Last saved</small><b class="sv3-cap">${lastAll ? ago(lastAll) : "—"}</b></div>
      </div>
      <div class="sv3-bar">
        <label class="sv3-search">${icon("search")}<input type="search" placeholder="Search your boards…" value="${esc(view.q)}" data-q aria-label="Search your boards"></label>
        <div class="sv3-seg" role="group" aria-label="Order">${[["recent", "Recent"], ["az", "A–Z"], ["most", "Most posts"]].map(([k, t]) => `<button type="button" data-sort="${k}" aria-pressed="${view.sort === k}">${t}</button>`).join("")}</div>
      </div>
      ${all.length && !q ? `<div class="sv3-feat">
        <a class="sv3-all" href="#board=all">
          <span class="sv3-all-pics n${Math.min(pics.length, 5)}">${pics.map((p) => mini(p)).join("")}</span>
          <span class="sv3-all-cap"><span><b>All saves</b><small>${all.length} post${all.length === 1 ? "" : "s"}${lastAll ? ` · ${ago(lastAll)}` : ""}</small></span><span class="sv3-glass">See all →</span></span>
        </a>
        <div class="sv3-plan">
          <div><small>From your boards to your calendar</small><h3>Turn your ideas into this week</h3><p>Open the Content Plan with your saved posts beside it and drag them onto a day.</p></div>
          <div class="sv3-week">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => `<span>${all[i * 2] && (i % 2 === 0) ? mini(all[i * 2]) : `<i>${d}</i>`}</span>`).join("")}</div>
          <a class="btn btn-gold" href="content-plan.html" data-plan="all">Plan this week →</a>
        </div>
      </div>` : ""}
      <h2 class="sv3-h2 sv3-folders-h"><span class="sv3-folders-ic">${icon("folder")}</span>Your folders <span class="sv3-count">${B.boards.length}</span><small>Each board is a folder with the posts you saved</small></h2>
      <div class="sv3-grid">
        ${boards.map(boardCard).join("")}
        ${!q ? `<form class="sv3-new" data-create-form>
          <span class="sv3-new-ic">${icon("folder-plus")}</span>
          <span class="sv3-new-t"><b>New board</b><small>A folder for the ideas you want to make</small></span>
          <span class="sv3-new-in"><input type="text" maxlength="60" placeholder="Board name" aria-label="New board name" required data-create-name><button class="sv3-new-go" type="submit" aria-label="Create">${icon("plus")}<span>Create</span></button></span>
          <span class="sv3-sug"><small>Ideas</small>${SUGGEST.map((n) => `<button type="button" data-suggest="${esc(n)}">${esc(n)}</button>`).join("")}</span>
        </form>` : ""}
      </div>
      ${q && !boards.length ? `<p class="sv3-none">No boards match “${esc(view.q)}”.</p>` : ""}
      ${all.length && !q ? `<h2 class="sv3-h2">Smart boards <small>They fill themselves with what you save</small></h2>
      <div class="sv3-smart">${smart.map(([id, sb, list]) => `<a class="sv3-sm" href="#board=${id}" style="--c:${sb.c}"><span class="sv3-sm-ic">${icon(sb.ic)}</span><span><b>${sb.name}</b><small>${sb.sub(list.length)}</small></span>${icon("chevron-right")}</a>`).join("")}</div>
      <h2 class="sv3-h2">Ideas like the ones you save <small>From the Content Library</small></h2>
      <div class="sv3-recs" data-recs><div class="sv-loading"></div></div>` : ""}
      ${creatorsHtml(creatorsOf("all"))}
      ${!all.length && !creatorsOf("all").length ? `<div class="sv-empty">${icon("bookmark-plus")}<div><b>Save ideas you want to make</b><p>Tap the <span class="sv-inline">${icon("bookmark-plus")}</span> button on any post in the <a href="content-library.html">Content Library</a> to save it to a board.</p></div></div>` : ""}`;
    requestAnimationFrame(() => fitMinis());
    if (all.length && !q) loadRecs(all);
  }
  // ---------- Ideas like the ones you save: the library's own search (same plan rules) on what you save most ----------
  let recsP = null;   // asked once (the page can be drawn twice while it loads)
  async function loadRecs(all) {
    if (!root.querySelector("[data-recs]")) return;
    recsP ||= (async () => {
      const count = new Map();
      for (const p of all) for (const cat of ["club", "competition", "topic", "sport", "format"]) for (const t of p.tags?.[cat] || []) { const k = `${cat}|${t.id}`; count.set(k, (count.get(k) || 0) + 1); }
      const top = [...count].sort((a, b) => b[1] - a[1])[0]?.[0];
      if (!top) return [];
      const [cat, id] = top.split("|");
      const { data } = await db.rpc("library_ideas", { p_filters: { [cat]: { ids: [Number(id)] } }, p_q: null, p_from: null, p_to: null, p_order: "latest", p_seed: "", p_ids: null, p_limit: 24, p_offset: 0, p_min_views: null, p_max_views: null }).then((r) => r, () => ({}));
      const have = new Set(all.map((p) => p.id));
      return (data?.data || []).filter((p) => !have.has(Number(p.id)) && p.cover_url).slice(0, 8);
    })();
    const recs = await recsP;
    const b = root.querySelector("[data-recs]"); if (!b) return;
    if (!recs.length) { b.previousElementSibling?.remove(); b.remove(); return; }
    b.innerHTML = recs.map((p) => `<a class="sv3-rec" href="content-library.html#post=${p.id}">
        <span class="sv3-rec-img"><img src="${esc(p.cover_url)}" alt="" loading="lazy">${netOf(p) ? `<i><img src="assets/pf-${netOf(p)}.svg" alt=""></i>` : ""}</span>
        <b>${esc((p.tags?.club?.[0]?.name || p.tags?.club?.[0] || p.tags?.competition?.[0]?.name || p.tags?.competition?.[0] || "Post"))}</b>
        <small>${esc([pretty(p.tags?.format?.[0]?.name || p.tags?.format?.[0] || ""), date(p.published_at)].filter(Boolean).join(" · "))}</small></a>`).join("");
  }
  // ---------- A board's quick menu: icon, rename, plan, delete ----------
  const ICONS = ["trophy", "goal", "flame", "star", "camera", "clapperboard", "megaphone", "handshake", "lightbulb", "palette", "ticket", "medal", "users", "rocket"];
  function boardMenu(card) {
    root.querySelectorAll(".sv3-menu").forEach((m) => m.remove());
    const b = B.boards.find((x) => x.id === card.dataset.b);
    card.insertAdjacentHTML("beforeend", `<div class="sv3-menu" role="menu">
      <p class="sv3-menu-k">Icon</p>
      <div class="sv3-icons">${ICONS.map((n) => `<button type="button" data-bicon="${n}" aria-pressed="${b.icon === n}" aria-label="${n}">${icon(n)}</button>`).join("")}${b.icon ? `<button type="button" data-bicon="" title="No icon" aria-label="No icon">${icon("x")}</button>` : ""}</div>
      <a href="#board=${esc(b.id)}&rename" role="menuitem">${icon("pencil")}Rename</a>
      <a href="content-plan.html" data-plan="${esc(b.id)}" role="menuitem">${icon("calendar-days")}Plan this board</a>
      <a href="#board=${esc(b.id)}&delete" role="menuitem" class="is-danger">${icon("trash-2")}Delete board</a>
    </div>`);
  }
  async function copyLinks(id) {
    const list = postsOf(id), name = id === "all" ? T("All saves") : nice(B.boards.find((b) => b.id === id)?.name || "");
    const text = `${name}\n${list.map((p) => `• ${who(p)} — ${p.url}`).join("\n")}`;
    try { await navigator.clipboard.writeText(text); toast(T("Links copied: paste them for your team")); } catch { toast(T("Couldn't copy the links")); }
  }
  function toast(t) {
    const el = Object.assign(document.createElement("div"), { className: "sv3-toast", textContent: t });
    document.body.appendChild(el); setTimeout(() => el.remove(), 2600);
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
          ${B.boards.some((b) => b.id === boardId) ? `<button class="pin-cover" type="button" data-cover-post="${p.id}" title="Use as the board's cover" aria-label="Use as the board's cover">${icon("image")}</button>` : ""}
          <button class="pin-remove" type="button" data-remove="${p.id}" title="Remove from this board" aria-label="Remove from this board">${icon("trash-2")}</button>
        </div>
      </article>`;
  }
  let boardId = null;
  function renderBoard(id) {
    boardId = id;
    const isAll = id === "all", sm = SMART[id];
    const board = B.boards.find((b) => b.id === id);
    if (!isAll && !sm && !board) { location.hash = ""; return; }
    const list = sm ? sm.list() : postsOf(id);
    root.innerHTML = `
      <header class="sv-head sv-head-board">
        <div>
          <a class="sv-back" href="#">${icon("arrow-left")}All boards</a>
          <h1 data-board-title${!isAll && !sm ? ' class="is-board"' : ""}>${board?.icon ? `<em class="sv3-bic is-lg">${icon(board.icon)}</em>` : ""}${esc(isAll ? "All saves" : sm ? sm.name : nice(board.name))}</h1>
          <p class="sv-sub">${list.length} post${list.length === 1 ? "" : "s"}${sm ? ` · ${esc(T("Fills itself with what you save"))}` : ""}</p>
        </div>
        ${sm ? "" : `<div class="sv-actions">
          <a class="pill pill-gold" href="content-plan.html" data-plan="${esc(id)}">${icon("calendar-days")}Plan this board</a>
          <button class="pill pill-dark" type="button" data-share="${esc(id)}">${icon("link")}Copy links</button>
        </div>`}
        ${isAll || sm ? "" : `<div class="sv-actions" data-board-actions>
          <button class="pill pill-dark" type="button" data-act-pin>${icon("pin")}${board.pinned ? "Unpin" : "Pin on top"}</button>
          <button class="pill pill-dark" type="button" data-rename>${icon("pencil")}Rename</button>
          <button class="pill pill-dark sv-danger" type="button" data-delete>${icon("trash-2")}Delete board</button>
        </div>`}
      </header>
      ${creatorsHtml(creatorsOf(id))}
      ${list.length ? `<div class="pins" data-pins></div>` : creatorsOf(id).length ? "" : `<div class="sv-empty">${icon("layers")}<div><b>This board is empty</b><p>Save posts from the <a href="content-library.html">Content Library</a> with the <span class="sv-inline">${icon("bookmark-plus")}</span> button.</p></div></div>`}`;
    if (list.length) layoutPins(list);
    const act = /&(rename|delete)$/.exec(location.hash)?.[1];   // from a board's quick menu
    if (act && board) { history.replaceState(null, "", `#board=${encodeURIComponent(id)}`); root.querySelector(act === "rename" ? "[data-rename]" : "[data-delete]")?.click(); }
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
    const sort = e.target.closest("[data-sort]"); if (sort) { view.sort = sort.dataset.sort; return renderBoards(); }
    const sug = e.target.closest("[data-suggest]"); if (sug) { const i = root.querySelector("[data-create-name]"); i.value = T(sug.dataset.suggest); return i.focus(); }
    const plan = e.target.closest("[data-plan]");   // the Content Plan opens with this board in its "saved posts" side list
    if (plan) { try { localStorage.setItem("scp-plan-board", plan.dataset.plan); } catch {} return; }
    const share = e.target.closest("[data-share]"); if (share) return copyLinks(share.dataset.share);
    const card = e.target.closest("[data-b]"), a = e.target.closest("[data-act]");
    if (a && card) {
      e.preventDefault();
      if (a.dataset.act === "share") return copyLinks(card.dataset.b);
      if (a.dataset.act === "menu") return card.querySelector(".sv3-menu") ? card.querySelector(".sv3-menu").remove() : boardMenu(card);
      if (a.dataset.act === "pin") { const b = B.boards.find((x) => x.id === card.dataset.b); try { await B.update(b.id, { pinned: !b.pinned }); renderBoards(); } catch (err) { toast(err.message); } return; }
    }
    const bi = e.target.closest("[data-bicon]");
    if (bi && card) { try { await B.update(card.dataset.b, { icon: bi.dataset.bicon || null }); renderBoards(); } catch (err) { toast(err.message); } return; }
    if (!e.target.closest(".sv3-menu")) root.querySelectorAll(".sv3-menu").forEach((m) => m.remove());
    if (e.target.closest("[data-act-pin]")) { const b = B.boards.find((x) => x.id === boardId); try { await B.update(b.id, { pinned: !b.pinned }); renderBoard(boardId); } catch (err) { toast(err.message); } return; }
    const cv = e.target.closest("[data-cover-post]");
    if (cv) { try { await B.update(boardId, { cover_post: `ci-${cv.dataset.coverPost}` }); toast(T("Cover changed")); } catch (err) { toast(err.message); } return; }
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
  let qTimer;
  root.addEventListener("input", (e) => {
    if (!e.target.matches("[data-q]")) return;
    clearTimeout(qTimer);
    qTimer = setTimeout(() => { view.q = e.target.value; const pos = e.target.selectionStart; renderBoards(); const i = root.querySelector("[data-q]"); i.focus(); i.setSelectionRange(pos, pos); }, 200);
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
    const id = /^#board=([^&]+)/.exec(location.hash)?.[1];
    if (id) renderBoard(decodeURIComponent(id)); else { boardId = null; renderBoards(); }
    window.scrollTo({ top: 0 });
  }
  window.addEventListener("hashchange", route);
  // Saving / unsaving from a pin's picker changes board contents: refresh the current view
  B.onChange(async () => { await loadPosts(); await loadCreators(); if (!boardId) renderBoards(); });

  (async () => {
    if (!db) { root.innerHTML = `<p class="sv-empty">Not connected.</p>`; return; }
    await B.load();
    await Promise.all([loadPosts(), loadCreators(), loadPlanned()]);
    route();
  })();
})();
