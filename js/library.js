// Content Library — creator-first filters over Supabase ("library_posts"), detail drawer, folders, saved searches.
(() => {
  const root = document.querySelector("[data-library]");
  if (!root) return;
  const auth = window.SCP_AUTH;
  const db = auth?.client;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
  const PAGE = 24;

  const grid = $("[data-posts]");
  const empty = $("[data-empty]");
  const more = $("[data-more]");
  const note = $("[data-feed-note]");

  // ---------- Labels ----------
  const MOMENTS = { matchday: "Matchday", signing: "Signings", kit: "Kit", sponsor: "Sponsors", behind_the_scenes: "Behind the scenes", fans: "Fans", milestone: "Milestones", training: "Training", humour: "Humour", community: "Community", ticketing: "Tickets" };
  const MOMENT_ICONS = { matchday: "goal", signing: "pen-line", kit: "shirt", sponsor: "handshake", behind_the_scenes: "clapperboard", fans: "megaphone", milestone: "trophy", training: "dumbbell", humour: "laugh", community: "heart-handshake", ticketing: "ticket" };
  const icon = (name) => (window.SCP_ICONS ? window.SCP_ICONS(name) : "");
  const LABELS = { top_pick: ["Top Picks", "pill-top"], replicable: ["Replicable ideas", "pill-replicable"], overperforming: ["Overperforming", "pill-over"] };
  const PERIODS = { 7: "This week", 31: "This month", season: "This season", custom: "Custom dates" };
  const SIZES = { s: ["Under 10K", 0, 1e4], m: ["10K–100K", 1e4, 1e5], l: ["100K–1M", 1e5, 1e6], xl: ["Over 1M", 1e6, null] };
  const PLATFORM_NAMES = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", x: "X", facebook: "Facebook", linkedin: "LinkedIn" };
  const textOf = (sel, value) => $(`${sel} [data-value="${CSS.escape(value)}"]`)?.textContent.trim() ?? value;

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

  const compSearch = $("[data-search]");
  compSearch.addEventListener("input", () => {
    const q = compSearch.value.trim().toLowerCase();
    $$("[data-competitions] li").forEach((li) => (li.hidden = q && !li.textContent.toLowerCase().includes(q)));
  });

  // ---------- Moments (single choice, click again to clear) ----------
  $$("[data-moments] button").forEach((b) => b.addEventListener("click", () => {
    const on = b.getAttribute("aria-pressed") !== "true";
    $$("[data-moments] button").forEach((o) => o.setAttribute("aria-pressed", String(o === b && on)));
    load(true);
  }));

  // ---------- Clubs like mine ----------
  const likeToggle = $("[data-like-toggle]");
  const likeModal = $("[data-like-modal]");
  const likeForm = $("[data-like-form]");
  const getLike = () => { try { return JSON.parse(store.get("scp-like-mine") || "null"); } catch { return null; } };
  function renderLike() {
    const like = getLike();
    $("[data-like-summary]").textContent = like ? `${like.sport} · ${SIZES[like.size][0]} followers` : "Set your sport and size";
  }
  const openLike = () => {
    const like = getLike();
    if (like) { likeForm.sport.value = like.sport; likeForm.querySelector(`[value="${like.size}"]`).checked = true; }
    likeModal.hidden = false;
  };
  likeToggle.addEventListener("click", () => {
    if (!getLike()) return openLike();
    likeToggle.setAttribute("aria-checked", String(likeToggle.getAttribute("aria-checked") !== "true"));
    load(true);
  });
  $("[data-like-edit]").addEventListener("click", openLike);
  $("[data-like-cancel]").addEventListener("click", () => (likeModal.hidden = true));
  likeModal.addEventListener("click", (e) => { if (e.target === likeModal) likeModal.hidden = true; });
  likeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    store.set("scp-like-mine", JSON.stringify({ sport: likeForm.sport.value, size: likeForm.querySelector("[name=size]:checked").value }));
    likeModal.hidden = true;
    likeToggle.setAttribute("aria-checked", "true");
    renderLike();
    load(true);
  });
  renderLike();

  // ---------- Upcoming dates (seasonal ideas) ----------
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
      const fri = 1 + ((5 - first.getDay() + 7) % 7) + 21;
      return new Date(y, 10, fri);
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
  const pressed = (sel) => $$(`${sel} [aria-pressed="true"]`).map((b) => b.dataset.value ?? b.textContent.trim());
  const state = () => ({
    order: pressed("[data-order]")[0] || "outlier",
    moment: pressed("[data-moments]")[0] || "",
    period: pressed("[data-period]")[0] || "all",
    from: $("[data-from]").value,
    to: $("[data-to]").value,
    labels: pressed("[data-smart]"),
    platforms: pressed("[data-platforms]"),
    formats: pressed("[data-formats]"),
    styles: pressed("[data-styles]"),
    sport: $("[data-sport]").value,
    entities: pressed("[data-entities]"),
    competitions: pressed("[data-competitions]"),
    languages: pressed("[data-languages]"),
    q: $("[data-q]").value.trim(),
    likeMine: likeToggle.getAttribute("aria-checked") === "true",
  });

  // Apply a saved / "more like this" filter set to the controls
  function applyState(f) {
    const setGroup = (sel, values = []) => $$(`${sel} [aria-pressed]`).forEach((b) => b.setAttribute("aria-pressed", String(values.includes(b.dataset.value ?? b.textContent.trim()))));
    setGroup("[data-moments]", f.moment ? [f.moment] : []);
    setGroup("[data-smart]", f.labels); setGroup("[data-platforms]", f.platforms); setGroup("[data-formats]", f.formats);
    setGroup("[data-styles]", f.styles); setGroup("[data-entities]", f.entities); setGroup("[data-competitions]", f.competitions);
    setGroup("[data-languages]", f.languages);
    if (f.order) setGroup("[data-order]", [f.order]);
    setPeriod(f.period || "all");
    for (const k of ["from", "to"]) { const el = $(`[data-${k}]`); el.value = f[k] || ""; el.dispatchEvent(new Event("input")); }
    $("[data-sport]").value = f.sport || "";
    $("[data-q]").value = f.q || "";
    likeToggle.setAttribute("aria-checked", String(Boolean(f.likeMine && getLike())));
  }

  // ---------- Active filter chips ----------
  function chipsFor(s) {
    const c = [];
    if (s.likeMine) { const l = getLike(); c.push({ label: `Like mine: ${l.sport}, ${SIZES[l.size][0]}`, clear: () => likeToggle.setAttribute("aria-checked", "false") }); }
    if (s.moment) c.push({ label: MOMENTS[s.moment], clear: () => $$("[data-moments] button").forEach((b) => b.setAttribute("aria-pressed", "false")) });
    const group = (list, sel, nameFn) => list.forEach((v) => c.push({ label: nameFn ? nameFn(v) : textOf(sel, v), clear: () => $(`${sel} [data-value="${CSS.escape(v)}"]`)?.setAttribute("aria-pressed", "false") }));
    group(s.labels, "[data-smart]");
    group(s.platforms, "[data-platforms]", (v) => PLATFORM_NAMES[v]);
    group(s.formats, "[data-formats]");
    group(s.styles, "[data-styles]");
    if (s.period !== "all") c.push({ label: s.period === "custom" ? `${s.from || "…"} → ${s.to || "…"}` : PERIODS[s.period], clear: () => { setPeriod("all"); ["from", "to"].forEach((k) => { const el = $(`[data-${k}]`); el.value = ""; el.dispatchEvent(new Event("input")); }); } });
    if (s.sport) c.push({ label: s.sport, clear: () => ($("[data-sport]").value = "") });
    group(s.entities, "[data-entities]");
    s.competitions.forEach((v) => c.push({ label: v, clear: () => $$("[data-competitions] button").find((b) => b.textContent.trim() === v)?.setAttribute("aria-pressed", "false") }));
    group(s.languages, "[data-languages]");
    if (s.q) c.push({ label: `“${s.q}”`, clear: () => ($("[data-q]").value = "") });
    return c;
  }
  let chipClears = [];
  function renderActive(s) {
    const chips = chipsFor(s);
    chipClears = chips.map((x) => x.clear);
    $("[data-active-bar]").hidden = chips.length === 0 && !savedSearches.length;
    $("[data-active-chips]").innerHTML = chips.map((x, i) => `<button type="button" class="active-chip" data-chip="${i}">${esc(x.label)} <span aria-hidden="true">×</span><span class="sr-only">Remove</span></button>`).join("")
      + (chips.length > 1 ? `<button type="button" class="link-muted active-clear" data-chip-clear>Clear all</button>` : "");
    $("[data-save-search]").hidden = chips.length === 0;
    const sidebarCount = chips.length - (s.moment ? 1 : 0) - (s.q ? 1 : 0);
    const badge = $("[data-filter-count]");
    badge.textContent = sidebarCount; badge.hidden = sidebarCount <= 0;
    const moreCount = (s.period !== "all" ? 1 : 0) + (s.sport ? 1 : 0) + s.entities.length + s.competitions.length + s.languages.length;
    const mb = $("[data-more-count]");
    mb.textContent = moreCount; mb.hidden = moreCount === 0;
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
    if (!db) return;
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
    const name = window.prompt("Name this search (e.g. “Matchday ideas”)");
    if (!name?.trim()) return;
    const { error } = await db.from("saved_searches").upsert({ name: name.trim(), filters: state() }, { onConflict: "user_id,name" });
    if (error) return alert(error.message);
    await loadSavedSearches();
  });

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
    $("[data-folder-select]").innerHTML = `<option value="">Choose a folder…</option>` + folders.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("");
  }

  // ---------- Query ----------
  let view = { kind: "all", folder: null };
  let offset = 0;
  let token = 0;
  const cache = new Map();
  const isFiltered = (s) => chipsFor(s).length > 0;

  function seasonStart() {
    const now = new Date();
    const y = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1; // seasons start in July
    return `${y}-07-01T00:00:00Z`;
  }

  async function load(reset) {
    const s = state();
    renderActive(s);
    if (reset) { offset = 0; grid.innerHTML = ""; empty.hidden = true; note.hidden = true; }
    if (!db) return showDemo("Content isn't connected yet.");
    const my = ++token;
    more.hidden = true;
    grid.setAttribute("aria-busy", "true");

    let q = db.from("library_posts").select("id,platform,url,account_handle,posted_at,format,style,moment,caption,thumbnail_url,views,likes,comments,labels,outlier_score,outlier_metric,suspicious,sport,competition,topics,entities,analysis,account_followers");
    if (s.order === "latest") q = q.order("posted_at", { ascending: false, nullsFirst: false });
    else if (s.order === "random") q = q.order("id");
    else q = q.order("outlier_score", { ascending: false, nullsFirst: false }).order("posted_at", { ascending: false });

    if (s.moment) q = q.eq("moment", s.moment);
    if (s.period === "7" || s.period === "31") q = q.gte("posted_at", new Date(Date.now() - Number(s.period) * 864e5).toISOString());
    if (s.period === "season") q = q.gte("posted_at", seasonStart());
    if (s.period === "custom") { if (s.from) q = q.gte("posted_at", `${s.from}T00:00:00Z`); if (s.to) q = q.lte("posted_at", `${s.to}T23:59:59Z`); }
    if (s.labels.length) q = q.overlaps("labels", s.labels);
    if (s.platforms.length) q = q.in("platform", s.platforms);
    if (s.formats.length) q = q.in("format", s.formats.flatMap((f) => (f === "reel" ? ["reel", "short"] : [f])));
    if (s.styles.length) q = q.in("style", s.styles);
    if (s.sport) q = q.eq("sport", s.sport);
    if (s.entities.length) q = q.overlaps("entity_types", s.entities);
    if (s.competitions.length) q = q.in("competition", s.competitions);
    if (s.languages.length) q = q.in("language", s.languages);
    if (s.q) q = q.textSearch("search", s.q, { type: "websearch", config: "simple" });
    if (s.likeMine) {
      const like = getLike();
      const [, min, max] = SIZES[like.size];
      q = q.or(`sport.eq.${like.sport},account_sport.eq.${like.sport}`).gte("account_followers", min);
      if (max) q = q.lt("account_followers", max);
    }
    if (view.kind !== "all") {
      const ids = [...saved.entries()].filter(([, set]) => view.kind === "saved" || set.has(view.folder)).map(([id]) => id);
      if (!ids.length) { grid.removeAttribute("aria-busy"); return showEmpty(view.kind === "saved" ? "You haven't saved any posts yet." : "This folder is empty."); }
      q = q.in("id", ids.slice(0, 500));
    }
    q = q.range(offset, offset + PAGE - 1);

    const { data, error } = await q;
    if (my !== token) return;
    grid.removeAttribute("aria-busy");
    if (error) return showDemo(/does not exist|schema cache/i.test(error.message) ? "The library database isn't set up yet." : "Couldn't load posts right now.");
    if (!data.length && offset === 0) {
      if (!isFiltered(s) && view.kind === "all") return showDemo("The library is empty for now — real posts appear here after the first upload.");
      return showEmpty(s.likeMine ? "No posts from accounts like yours match these filters yet. Try turning off “Clubs like mine”." : "No posts match these filters.");
    }
    grid.insertAdjacentHTML("beforeend", data.map(card).join(""));
    data.forEach((p) => cache.set(p.id, p));
    offset += data.length;
    more.hidden = data.length < PAGE;
  }

  function showEmpty(text) { empty.textContent = text; empty.hidden = false; }
  function showDemo(text) {
    note.textContent = `${text} Showing example posts.`;
    note.hidden = false;
    grid.innerHTML = [1, 2, 3, 4, 5, 6].map((n) => `
      <article class="post"><div class="post-shot"><img src="assets/post-${n}.png" alt="Example post" loading="lazy"></div></article>`).join("");
  }

  // ---------- Rendering ----------
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
          <span class="lib-platform"><img src="assets/pf-${esc(p.platform)}.svg" alt=""></span>
          ${p.outlier_score ? `<span class="lib-outlier" title="vs. the account's usual ${esc(p.outlier_metric || "")}">${Number(p.outlier_score).toFixed(1)}x</span>` : ""}
          ${p.format ? `<span class="lib-format">${FORMAT_NAME[p.format] || ""}${p.moment && MOMENTS[p.moment] ? ` · ${MOMENTS[p.moment]}` : ""}</span>` : ""}
        </button>
        <div class="lib-meta">
          <p class="lib-account">@${esc(p.account_handle)} <time>${date(p.posted_at)}</time></p>
          <p class="lib-stats">${p.views != null ? `<span title="Views">${icon("play")}${compact(p.views)}</span>` : ""}<span title="Likes">${icon("heart")}${compact(p.likes)}</span><span title="Comments">${icon("message-circle")}${compact(p.comments)}</span>${p.account_followers ? `<span title="Account followers">${icon("users")}${compact(p.account_followers)}</span>` : ""}</p>
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
    if (platform === "tiktok") document.querySelectorAll(`script[src="${src}"]`).forEach((s) => s.remove());
    if (platform === "tiktok" || !document.querySelector(`script[src="${src}"]`)) {
      const s = document.createElement("script"); s.async = true; s.src = src; document.body.append(s);
    }
  }
  const section = (title, html) => (html ? `<section class="dr-sec"><h3>${title}</h3>${html}</section>` : "");

  function openPost(id) {
    const p = cache.get(id);
    if (!p) return;
    const a = p.analysis || {};
    const labels = (p.labels || []).map((l) => LABELS[l]).filter(Boolean).map(([t, c]) => `<span class="pill ${c} pill-xs-solid">${t}</span>`).join("");
    body.innerHTML = `
      <div class="dr-media">${embed(p)}</div>
      <div class="dr-info">
        <p class="dr-account">@${esc(p.account_handle)} · ${date(p.posted_at)}${p.account_followers ? ` · ${compact(p.account_followers)} followers` : ""}</p>
        <div class="dr-labels">${p.moment && MOMENTS[p.moment] ? `<span class="pill pill-dark pill-xs-solid">${icon(MOMENT_ICONS[p.moment])}${MOMENTS[p.moment]}</span>` : ""}${labels}${p.suspicious ? '<span class="pill pill-dark pill-xs-solid">Reach without engagement</span>' : ""}</div>
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
        <div class="dr-actions">
          <button class="pill pill-gold" type="button" data-more-like="${esc(p.id)}">${icon("sparkles")}More like this</button>
          ${saveBtn(p.id)}
          <a class="pill pill-dark" href="${esc(p.url)}" target="_blank" rel="noopener">Open on ${esc(PLATFORM_NAMES[p.platform] || p.platform)} ↗</a>
        </div>
      </div>`;
    drawer.hidden = false;
    document.body.style.overflow = "hidden";
    runEmbedScript(p.platform);
  }
  function closeDrawer() { drawer.hidden = true; body.innerHTML = ""; document.body.style.overflow = ""; }
  $("[data-drawer-close]").addEventListener("click", closeDrawer);
  drawer.addEventListener("click", (e) => { if (e.target === drawer) closeDrawer(); });

  // "More like this": same moment, format and style
  function moreLikeThis(id) {
    const p = cache.get(id);
    if (!p) return;
    applyState({
      order: "outlier",
      moment: p.moment || "",
      formats: p.format ? [p.format === "short" ? "reel" : p.format] : [],
      styles: p.style ? [p.style] : [],
      likeMine: state().likeMine,
    });
    closeDrawer();
    load(true);
    $(".feed").scrollIntoView({ behavior: "smooth" });
  }

  // ---------- Save to folder menu ----------
  const menu = $("[data-folder-menu]");
  let menuPost = null;
  function renderMenu() {
    const set = saved.get(menuPost) || new Set();
    $("[data-folder-list]").innerHTML = folders.length
      ? folders.map((f) => `<li><button type="button" data-folder="${f.id}" aria-pressed="${set.has(f.id)}">${set.has(f.id) ? icon("check") : ""}${esc(f.name)}</button></li>`).join("")
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
  const refreshSaveButtons = (id) => $$(`[data-save="${CSS.escape(id)}"]`).forEach((b) => (b.outerHTML = saveBtn(id)));
  document.addEventListener("click", (e) => {
    const save = e.target.closest("[data-save]");
    if (save) { e.stopPropagation(); return openMenu(save, save.dataset.save); }
    const open = e.target.closest("[data-open]");
    if (open) return openPost(open.dataset.open);
    const like = e.target.closest("[data-more-like]");
    if (like) return moreLikeThis(like.dataset.moreLike);
    if (!menu.hidden && !e.target.closest("[data-folder-menu]")) menu.hidden = true;
  });
  $("[data-folder-list]").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-folder]");
    if (!b) return;
    const folderId = b.dataset.folder;
    const set = saved.get(menuPost) || new Set();
    if (set.has(folderId)) { await db.from("folder_items").delete().eq("folder_id", folderId).eq("post_id", menuPost); set.delete(folderId); }
    else { await db.from("folder_items").insert({ folder_id: folderId, post_id: menuPost }); set.add(folderId); }
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
    $("[data-folder-select]").insertAdjacentHTML("beforeend", `<option value="${data.id}">${esc(data.name)}</option>`);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    menu.hidden = true;
    likeModal.hidden = true;
    if (!drawer.hidden) closeDrawer();
  });

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
    if (e.target.closest("[data-folder-select], [data-saved-searches], [data-search], [data-like-form]")) return;
    load(true);
  });
  let timer;
  $("[data-q]").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => load(true), 350); });
  more.addEventListener("click", () => load(false));
  function clearAll() {
    applyState({ order: state().order });
    compSearch.value = ""; compSearch.dispatchEvent(new Event("input"));
    load(true);
  }
  $("[data-clear]").addEventListener("click", clearAll);

  Promise.all([loadFolders(), loadSavedSearches()]).then(() => load(true));
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
