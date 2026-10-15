// Content Library — reads posts from Supabase ("posts"), filters, detail drawer and saved folders.
(() => {
  const root = document.querySelector("[data-library]");
  if (!root) return;
  const auth = window.SCP_AUTH;
  const db = auth?.client;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const PAGE = 24;

  const grid = $("[data-posts]");
  const empty = $("[data-empty]");
  const more = $("[data-more]");
  const note = $("[data-feed-note]");

  // ---------- Sidebar basics ----------
  const collapse = $("[data-collapse]");
  collapse.addEventListener("click", () => {
    const collapsed = root.classList.toggle("filters-collapsed");
    collapse.setAttribute("aria-expanded", String(!collapsed));
    collapse.lastChild.textContent = collapsed ? "Show filters" : "Collapse filters";
  });
  const compSearch = $("[data-search]");
  compSearch.addEventListener("input", () => {
    const q = compSearch.value.trim().toLowerCase();
    $$("[data-competitions] li").forEach((li) => (li.hidden = q && !li.textContent.toLowerCase().includes(q)));
  });

  // ---------- Filter state ----------
  const pressed = (sel) => $$(`${sel} [aria-pressed="true"]`).map((b) => b.dataset.value ?? b.textContent.trim());
  const state = () => ({
    order: pressed("[data-order]")[0] || "outlier",
    from: $("[data-from]").value,
    to: $("[data-to]").value,
    labels: pressed("[data-smart]"),
    sport: $("[data-sport]").value,
    entities: pressed("[data-entities]"),
    competitions: pressed("[data-competitions]"),
    formats: pressed("[data-formats]"),
    platforms: pressed("[data-platforms]"),
    q: $("[data-q]").value.trim(),
  });
  let view = { kind: "all", folder: null };
  let offset = 0;
  let token = 0;

  // ---------- Saved folders ----------
  let folders = [];
  let saved = new Map(); // post_id -> Set(folder_id)
  async function loadFolders() {
    if (!db) return;
    const [{ data: f }, { data: items }] = await Promise.all([
      db.from("folders").select("id,name").order("created_at"),
      db.from("folder_items").select("folder_id,post_id"),
    ]);
    folders = f || [];
    saved = new Map();
    for (const it of items || []) {
      if (!saved.has(it.post_id)) saved.set(it.post_id, new Set());
      saved.get(it.post_id).add(it.folder_id);
    }
    const sel = $("[data-folder-select]");
    sel.innerHTML = `<option value="">Choose a folder…</option>` + folders.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("");
  }

  // ---------- Query ----------
  const isFiltered = (s) => s.from || s.to || s.labels.length || s.sport || s.entities.length || s.competitions.length || s.formats.length || s.platforms.length || s.q;

  async function load(reset) {
    if (reset) { offset = 0; grid.innerHTML = ""; empty.hidden = true; note.hidden = true; }
    if (!db) return showDemo("Content isn't connected yet.");
    const my = ++token;
    const s = state();
    more.hidden = true;
    grid.setAttribute("aria-busy", "true");

    let q = db.from("posts").select("id,platform,url,account_handle,posted_at,format,caption,thumbnail_url,views,likes,comments,engagement_rate,labels,outlier_score,outlier_metric,suspicious,sport,competition,topics,entities,analysis");
    if (s.order === "latest") q = q.order("posted_at", { ascending: false, nullsFirst: false });
    else if (s.order === "random") q = q.order("id"); // ids are shortcodes: effectively random order
    else q = q.order("outlier_score", { ascending: false, nullsFirst: false }).order("posted_at", { ascending: false });
    if (s.from) q = q.gte("posted_at", `${s.from}T00:00:00Z`);
    if (s.to) q = q.lte("posted_at", `${s.to}T23:59:59Z`);
    if (s.labels.length) q = q.overlaps("labels", s.labels);
    if (s.sport) q = q.eq("sport", s.sport);
    if (s.entities.length) q = q.overlaps("entity_types", s.entities);
    if (s.competitions.length) q = q.in("competition", s.competitions);
    if (s.formats.length) q = q.in("format", s.formats.flatMap((f) => (f === "reel" ? ["reel", "short"] : [f])));
    if (s.platforms.length) q = q.in("platform", s.platforms);
    if (s.q) q = q.textSearch("search", s.q, { type: "websearch", config: "simple" });
    if (view.kind !== "all") {
      const ids = [...saved.entries()].filter(([, set]) => view.kind === "saved" || set.has(view.folder)).map(([id]) => id);
      if (!ids.length) { grid.removeAttribute("aria-busy"); return showEmpty(view.kind === "saved" ? "You haven't saved any posts yet." : "This folder is empty."); }
      q = q.in("id", ids.slice(0, 500));
    }
    q = q.range(offset, offset + PAGE - 1);

    const { data, error } = await q;
    if (my !== token) return;
    grid.removeAttribute("aria-busy");
    if (error) {
      // Table not created yet, or no access: fall back to the demo grid
      return showDemo(/does not exist|schema cache/i.test(error.message) ? "The library database isn't set up yet." : "Couldn't load posts right now.");
    }
    if (!data.length && offset === 0) {
      if (!isFiltered(s) && view.kind === "all") return showDemo("The library is empty for now — real posts appear here after the first upload.");
      return showEmpty("No posts match these filters.");
    }
    grid.insertAdjacentHTML("beforeend", data.map(card).join(""));
    data.forEach((p) => cache.set(p.id, p));
    offset += data.length;
    more.hidden = data.length < PAGE;
  }
  const cache = new Map();

  function showEmpty(text) { empty.textContent = text; empty.hidden = false; }
  function showDemo(text) {
    note.textContent = `${text} Showing example posts.`;
    note.hidden = false;
    grid.innerHTML = [1, 2, 3, 4, 5, 6].map((n) => `
      <article class="post"><div class="post-shot"><img src="assets/post-${n}.png" alt="Example post" loading="lazy"></div></article>`).join("");
  }

  // ---------- Rendering ----------
  const LABELS = { top_pick: ["Top Picks", "pill-top"], replicable: ["Replicable ideas", "pill-replicable"], overperforming: ["Overperforming", "pill-over"] };
  const compact = (n) => (n == null ? "n/a" : n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K` : String(n));
  const date = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
  const FORMAT_NAME = { reel: "Reel", short: "Short", video: "Video", carousel: "Carousel", image: "Image", text: "Post" };

  function saveBtn(id) {
    const on = saved.has(id);
    return `<button class="pill ${on ? "pill-gold" : "pill-dark"}" type="button" data-save="${esc(id)}">${on ? "Saved" : "Save"} <img src="assets/${on ? "folder-gold.svg" : "plus-grey.svg"}" width="${on ? 21 : 14}" height="${on ? 21 : 14}" alt=""></button>`;
  }

  function card(p) {
    const label = ["top_pick", "replicable", "overperforming"].filter((l) => (p.labels || []).includes(l)).map((l) => LABELS[l])[0];
    const thumb = p.thumbnail_url
      ? `<img src="${esc(p.thumbnail_url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'lib-noimg'}))">`
      : `<span class="lib-noimg"></span>`;
    return `
      <article class="lib-card" data-id="${esc(p.id)}">
        <div class="post-head">${label ? `<span class="pill ${label[1]}">${label[0]}</span>` : "<span></span>"}${saveBtn(p.id)}</div>
        <button class="lib-thumb" type="button" data-open="${esc(p.id)}" aria-label="Open post by @${esc(p.account_handle)}">
          ${thumb}
          <span class="lib-platform"><img src="assets/pf-${esc(p.platform === "facebook" ? "facebook" : p.platform)}.svg" alt=""></span>
          ${p.outlier_score ? `<span class="lib-outlier" title="vs. the account's usual ${esc(p.outlier_metric || "")}">${Number(p.outlier_score).toFixed(1)}x</span>` : ""}
          ${p.format ? `<span class="lib-format">${FORMAT_NAME[p.format] || ""}</span>` : ""}
        </button>
        <div class="lib-meta">
          <p class="lib-account">@${esc(p.account_handle)} <time>${date(p.posted_at)}</time></p>
          <p class="lib-stats">${p.views != null ? `<span>▶ ${compact(p.views)}</span>` : ""}<span>♥ ${compact(p.likes)}</span><span>💬 ${compact(p.comments)}</span></p>
          ${p.caption ? `<p class="lib-caption">${esc(p.caption.slice(0, 140))}</p>` : ""}
        </div>
      </article>`;
  }

  // ---------- Detail drawer ----------
  const drawer = $("[data-drawer]");
  const body = $("[data-drawer-body]");
  function embed(p) {
    let m;
    if (p.platform === "instagram") return `<blockquote class="instagram-media" data-instgrm-permalink="${esc(p.url)}?utm_source=ig_embed" data-instgrm-version="14"><a href="${esc(p.url)}" target="_blank" rel="noopener">View on Instagram</a></blockquote>`;
    if (p.platform === "tiktok" && (m = p.url.match(/video\/(\d+)/))) return `<blockquote class="tiktok-embed" cite="${esc(p.url)}" data-video-id="${m[1]}"><section><a href="${esc(p.url)}" target="_blank" rel="noopener">View on TikTok</a></section></blockquote>`;
    if (p.platform === "youtube" && (m = p.url.match(/(?:shorts\/|v=)([\w-]{11})/))) return `<div class="yt-frame${/shorts/.test(p.url) ? " is-vertical" : ""}"><iframe src="https://www.youtube-nocookie.com/embed/${m[1]}" title="YouTube video" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`;
    if (p.platform === "x") return `<blockquote class="twitter-tweet" data-theme="dark"><a href="${esc(p.url.replace("x.com", "twitter.com"))}">View on X</a></blockquote>`;
    return `<a class="btn btn-outline" href="${esc(p.url)}" target="_blank" rel="noopener">Open post</a>`;
  }
  const SCRIPTS = { instagram: "https://www.instagram.com/embed.js", tiktok: "https://www.tiktok.com/embed.js", x: "https://platform.twitter.com/widgets.js" };
  function runEmbedScript(platform) {
    if (platform === "instagram" && window.instgrm) return window.instgrm.Embeds.process();
    if (platform === "x" && window.twttr?.widgets) return window.twttr.widgets.load(body);
    const src = SCRIPTS[platform];
    if (!src) return;
    document.querySelectorAll(`script[src="${src}"]`).forEach((s) => platform === "tiktok" && s.remove());
    if (platform === "tiktok" || !document.querySelector(`script[src="${src}"]`)) {
      const s = document.createElement("script"); s.async = true; s.src = src; document.body.append(s);
    }
  }

  function section(title, html) { return html ? `<section class="dr-sec"><h3>${title}</h3>${html}</section>` : ""; }
  function openPost(id) {
    const p = cache.get(id);
    if (!p) return;
    const a = p.analysis || {};
    const labels = (p.labels || []).map((l) => LABELS[l]).filter(Boolean).map(([t, c]) => `<span class="pill ${c} pill-xs-solid">${t}</span>`).join("");
    body.innerHTML = `
      <div class="dr-media">${embed(p)}</div>
      <div class="dr-info">
        <p class="dr-account">@${esc(p.account_handle)} · ${date(p.posted_at)}</p>
        <div class="dr-labels">${labels}${p.suspicious ? '<span class="pill pill-dark pill-xs-solid">Reach without engagement</span>' : ""}</div>
        <dl class="dr-stats">
          <div><dt>Views</dt><dd>${compact(p.views)}</dd></div>
          <div><dt>Likes</dt><dd>${compact(p.likes)}</dd></div>
          <div><dt>Comments</dt><dd>${compact(p.comments)}</dd></div>
          <div><dt>Vs. usual</dt><dd class="gold">${p.outlier_score ? Number(p.outlier_score).toFixed(1) + "x" : "n/a"}</dd></div>
        </dl>
        ${a.whyItWorks ? section("Why it works", `<p>${esc(a.whyItWorks)}</p>`) : '<p class="dr-pending">The detailed breakdown is added for the posts that stand out most.</p>'}
        ${a.hook ? section("Hook", `<blockquote>${esc(a.hook.text || "")}</blockquote>${a.hook.category ? `<p><b>Type:</b> ${esc(a.hook.category)}</p>` : ""}${a.hook.template ? `<p><b>Template:</b> ${esc(a.hook.template)}</p>` : ""}${a.hook.whyItWorks ? `<p>${esc(a.hook.whyItWorks)}</p>` : ""}`) : ""}
        ${a.format ? section("Format", `<p>${[a.format.category, a.format.type, a.format.visualLayout, a.format.pacing].filter(Boolean).map(esc).join(" · ")}</p>`) : ""}
        ${a.angle ? section("Angle", `<p>${esc(a.angle.angle || a.angle.topic || "")}</p>`) : ""}
        ${a.scrollStoppers?.length ? section("Scroll stoppers", `<ul>${a.scrollStoppers.map((s) => `<li><b>${esc(s.t)}s</b> ${esc(s.moment)} — ${esc(s.why)}</li>`).join("")}</ul>`) : ""}
        ${a.replicable?.howToAdapt ? section("How to adapt it", `<p>${esc(a.replicable.howToAdapt)}</p>`) : ""}
        ${p.caption ? section("Caption", `<p class="dr-caption">${esc(p.caption)}</p>`) : ""}
        <div class="dr-actions">${saveBtn(p.id)}<a class="pill pill-dark" href="${esc(p.url)}" target="_blank" rel="noopener">Open on ${esc(p.platform)} ↗</a></div>
      </div>`;
    drawer.hidden = false;
    document.body.style.overflow = "hidden";
    runEmbedScript(p.platform);
  }
  function closeDrawer() { drawer.hidden = true; body.innerHTML = ""; document.body.style.overflow = ""; }
  $("[data-drawer-close]").addEventListener("click", closeDrawer);
  drawer.addEventListener("click", (e) => { if (e.target === drawer) closeDrawer(); });

  // ---------- Save to folder menu ----------
  const menu = $("[data-folder-menu]");
  let menuPost = null;
  function renderMenu() {
    const set = saved.get(menuPost) || new Set();
    $("[data-folder-list]").innerHTML = folders.length
      ? folders.map((f) => `<li><button type="button" data-folder="${f.id}" aria-pressed="${set.has(f.id)}">${set.has(f.id) ? "✓ " : ""}${esc(f.name)}</button></li>`).join("")
      : `<li class="folder-menu-empty">No folders yet — create your first one.</li>`;
  }
  function openMenu(btn, id) {
    menuPost = id;
    renderMenu();
    menu.hidden = false;
    const r = btn.getBoundingClientRect();
    menu.style.top = `${Math.min(window.innerHeight - menu.offsetHeight - 12, r.bottom + 8)}px`;
    menu.style.left = `${Math.max(12, Math.min(window.innerWidth - menu.offsetWidth - 12, r.right - menu.offsetWidth))}px`;
  }
  function refreshSaveButtons(id) {
    $$(`[data-save="${CSS.escape(id)}"]`).forEach((b) => (b.outerHTML = saveBtn(id)));
  }
  document.addEventListener("click", (e) => {
    const save = e.target.closest("[data-save]");
    if (save) { e.stopPropagation(); return openMenu(save, save.dataset.save); }
    const open = e.target.closest("[data-open]");
    if (open) return openPost(open.dataset.open);
    if (!menu.hidden && !e.target.closest("[data-folder-menu]")) menu.hidden = true;
  });
  $("[data-folder-list]").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-folder]");
    if (!b) return;
    const folderId = b.dataset.folder;
    const set = saved.get(menuPost) || new Set();
    if (set.has(folderId)) {
      await db.from("folder_items").delete().eq("folder_id", folderId).eq("post_id", menuPost);
      set.delete(folderId);
    } else {
      await db.from("folder_items").insert({ folder_id: folderId, post_id: menuPost });
      set.add(folderId);
    }
    set.size ? saved.set(menuPost, set) : saved.delete(menuPost);
    renderMenu();
    refreshSaveButtons(menuPost);
  });
  $("[data-folder-new]").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = e.target.querySelector("input");
    const name = input.value.trim();
    if (!name) return;
    const { data, error } = await db.from("folders").insert({ name }).select("id,name").single();
    if (error) return alert(/duplicate/i.test(error.message) ? "You already have a folder with that name." : error.message);
    folders.push(data);
    await db.from("folder_items").insert({ folder_id: data.id, post_id: menuPost });
    saved.set(menuPost, new Set([...(saved.get(menuPost) || []), data.id]));
    input.value = "";
    renderMenu();
    refreshSaveButtons(menuPost);
    const sel = $("[data-folder-select]");
    sel.insertAdjacentHTML("beforeend", `<option value="${data.id}">${esc(data.name)}</option>`);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { menu.hidden = true; if (!drawer.hidden) closeDrawer(); } });

  // ---------- Views: all / saved / folder ----------
  const viewBtns = $$("[data-view-btn]");
  const folderPick = $("[data-folder-pick]");
  const setView = (v) => {
    view = v;
    viewBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.viewBtn === v.kind)));
    folderPick.classList.toggle("is-active", v.kind === "folder");
    load(true);
  };
  viewBtns.forEach((b) => b.addEventListener("click", () => setView({ kind: b.dataset.viewBtn, folder: null })));
  $("[data-folder-select]").addEventListener("change", (e) => (e.target.value ? setView({ kind: "folder", folder: e.target.value }) : setView({ kind: "all" })));

  // ---------- Filter events ----------
  root.addEventListener("change", (e) => {
    if (e.target.closest("[data-folder-select]")) return;
    load(true);
  });
  let timer;
  $("[data-q]").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => load(true), 350); });
  more.addEventListener("click", () => load(false));
  $("[data-clear]").addEventListener("click", () => {
    $$(".filters [aria-pressed='true']").forEach((b) => { if (!b.closest("[data-order]")) b.setAttribute("aria-pressed", "false"); });
    $("[data-from]").value = ""; $("[data-to]").value = ""; $("[data-sport]").value = ""; $("[data-q]").value = "";
    compSearch.value = ""; compSearch.dispatchEvent(new Event("input"));
    load(true);
  });

  loadFolders().then(() => load(true));
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
