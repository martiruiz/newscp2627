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

  // ---------- Filter categories ----------
  // The filters column (supabase/library-filters.sql + smart-filters.sql). Sections, top to bottom:
  //   Discover (Top Picks / Replicable ideas / Overperforming + Views) · Format · Platform · Explore by · Content · Brands.
  // A category shows only when it has posts; `more` rows sit behind "+N more"; `ai` rows come from the smart filters.
  const CATEGORIES = [
    { key: "trend", label: "Discover", sec: "discover" },
    { key: "format", label: "Format", sec: "format" },
    { key: "aspect_ratio", label: "Shape", sec: "format", extra: true },
    { key: "duration", label: "Length", sec: "format", extra: true },
    { key: "language", label: "Language", sec: "format", extra: true, logo: true, ico: "message" },
    { key: "platform", label: "Platform", sec: "platform" },
    { key: "sport", label: "Sport", sec: "explore", ico: "ball" },
    { key: "entity", label: "Publisher type", sec: "explore", ico: "users" },
    { key: "competition", label: "Competition", sec: "explore", ico: "trophy", crest: true },
    { key: "club", label: "Club", sec: "explore", ico: "shield", crest: true },
    { key: "campaign", label: "Campaign", sec: "content", ico: "megaphone" },
    { key: "moment", label: "Campaign moment", sec: "content", ico: "calendar" },
    { key: "matchday_graphic", label: "Matchday graphic", sec: "content", ico: "grid" },
    { key: "transfer", label: "Transfers", sec: "content", ico: "swap" },
    { key: "kit", label: "Kit", sec: "content", ico: "shirt" },
    { key: "angle", label: "Angle and tone", sec: "content", ico: "smile" },
    { key: "season_moment", label: "Season moment", sec: "content", ico: "flag", more: true },
    { key: "outcome", label: "Result", sec: "content", ico: "pulse", more: true },
    { key: "team", label: "Team", sec: "content", ico: "user", more: true },
    { key: "opponent", label: "Opponent", sec: "content", ico: "versus", more: true, search: true },
    { key: "city", label: "City", sec: "content", ico: "pin", more: true, search: true },
    { key: "comms", label: "Press and comms", sec: "content", ico: "message", more: true },
    { key: "crisis", label: "Sensitive topics", sec: "content", ico: "alert", more: true },
    { key: "sponsor", label: "Sponsors", sec: "brands", ico: "tag", logo: true, search: true },
    { key: "sponsor_sector", label: "Sponsor sector", sec: "brands", ico: "briefcase" },
    { key: "sponsor_integration", label: "Integration", sec: "brands", ico: "badge", more: true },
    { key: "collab", label: "Collaborations", sec: "brands", ico: "users", more: true },
    { key: "goal", label: "Business goal", sec: "brands", ico: "target", more: true },
    { key: "cta", label: "Call to action", sec: "brands", ico: "cursor", more: true },
    // the creator's profile (Admin → Scraped profiles; supabase/creator-filters.sql): only under Content Creators
    { key: "creator_type", label: "Creator type", sec: "creators" },
    { key: "creator_language", label: "Creator's language", sec: "creators", logo: true, ico: "message" },
    { key: "creator_country", label: "Country", sec: "creators" },
    { key: "creator_gender", label: "Gender", sec: "creators", ico: "user" },
  ];
  // New layout (default): the filters follow the questions a club's social team asks —
  //   What works · Occasion (matchday timeline, transfers, kit…) · Goal & sponsors · Where & how · Inspiration from.
  // ?filters=before shows the previous layout (Discover · Format · Platform · Explore by · Content · Brands) to compare.
  const LAYOUT_BEFORE = /[?&]filters=before\b/.test(location.search);
  // Wide screens: Occasion, Goal and Inspiration open as wide panels from a bar above the posts; the
  // column keeps the one-click shortcuts. ?filters=column shows everything in the column (the previous layout).
  const BAR_OK = !LAYOUT_BEFORE && !/[?&]filters=column\b/.test(location.search);
  const barMode = () => BAR_OK && innerWidth > 900;
  const BAR_SECS = ["benchmark", "occasion", "goal"];   // bar order: Inspiration first   // Where & how stays in the column, under Views
  if (!LAYOUT_BEFORE) {
    const NEW = [
      ["trend", "discover"], ["format", "format"], ["aspect_ratio", "format"], ["duration", "format"], ["language", "format"], ["platform", "platform"],
      ["matchday_graphic", "occasion"], ["outcome", "occasion"], ["opponent", "occasion"],
      ["transfer", "occasion"], ["kit", "occasion"], ["season_moment", "occasion"], ["moment", "occasion"], ["angle", "occasion"],
      ["comms", "occasion", true], ["crisis", "occasion", true],
      ["goal", "goal"], ["sponsor", "goal"], ["sponsor_integration", "goal"], ["sponsor_sector", "goal"], ["cta", "goal", true], ["collab", "goal", true],
      ["sport", "benchmark"], ["competition", "benchmark"], ["club", "benchmark"], ["entity", "who"], ["team", "benchmark"], ["city", "benchmark", true],
    ];
    const pos = new Map(NEW.map(([k], i) => [k, i]));
    for (const [k, sec, more] of NEW) { const c = CATEGORIES.find((x) => x.key === k); if (c) { c.sec = sec; c.more = !!more; } }
    CATEGORIES.sort((a, b) => (pos.get(a.key) ?? 99) - (pos.get(b.key) ?? 99));
    Object.assign(CATEGORIES.find((c) => c.key === "moment") || {}, { label: "Campaign moment" });
    Object.assign(CATEGORIES.find((c) => c.key === "team") || {}, { label: "Team" });
  }
  // Matchday as a timeline: before / live / after the game (graphics + campaign moments that belong to each phase)
  const MATCHDAY = [
    { key: "before", label: "Before", vals: [["moment", "Matchday preview"], ["matchday_graphic", "Matchday poster"], ["matchday_graphic", "Countdown"], ["matchday_graphic", "Squad list"], ["matchday_graphic", "Starting XI"], ["matchday_graphic", "Fixture / schedule"]] },
    { key: "live", label: "Live", vals: [["matchday_graphic", "Goal"], ["campaign", "Goals & Highlights"], ["matchday_graphic", "Half-time"]] },
    { key: "after", label: "After", vals: [["matchday_graphic", "Full-time"], ["moment", "Match coverage"], ["matchday_graphic", "MOTM vote"], ["matchday_graphic", "Stats card"], ["matchday_graphic", "Quote card"], ["matchday_graphic", "Weekly recap"], ["matchday_graphic", "Standings"]] },
  ];
  const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));
  const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));
  const AI_TIP = "Detected by AI on Instagram posts from October 2026. Older posts are still being analysed.";
  const SECTIONS = LAYOUT_BEFORE ? [
    { key: "discover", label: "Discover" }, { key: "format", label: "Format" }, { key: "platform", label: "Platform" },
    { key: "explore", label: "Explore by" }, { key: "content", label: "Content", ai: true }, { key: "brands", label: "Brands", ai: true },
  ] : [
    { key: "discover", label: "What works", jump: "Works" }, { key: "occasion", label: "Match Day", ai: true, q: "What are you posting about?" },
    { key: "goal", label: "Brands & sponsors", ai: true, jump: "Brands", q: "What should it achieve?" }, { key: "where", label: "Where & how", jump: "Where", q: "Platform and format" },
    { key: "benchmark", label: "Inspiration from", jump: "Inspiration", q: "Sports, competitions and clubs" },
  ];
  const PERIODS = { 7: "This week", 31: "This month", season: "This season", custom: "Custom dates" };
  // Some catalog values were saved with a mis-encoded dash ("15‚Äì30s"): show the real characters
  const fixText = (t) => (typeof t === "string" && t.includes("\u201aÄ") ? t.replace(/\u201aÄì/g, "\u2013").replace(/\u201aÄî/g, "\u2014").replace(/\u201aÄô/g, "\u2019").replace(/\u201aÄú/g, "\u201c").replace(/\u201aÄù/g, "\u201d") : t);
  const pretty = (raw) => { const name = fixText(raw); return name && name[0] === name[0].toLowerCase() ? name[0].toUpperCase() + name.slice(1) : name; };
  const shortDate = (v) => v ? new Date(`${v}T12:00:00`).toLocaleDateString(window.SCP_LOC || "en-GB", { day: "numeric", month: "short" }) : "";
  const kfmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(n < 1e7 ? 1 : 0).replace(".0", "")}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(".0", "")}k` : String(n));

  let catalog = { byCat: {}, byId: new Map() };
  // parts of the library that depend on the plan (supabase/plans-2026-10.sql): Content creators (Plus and up),
  // Brands & sponsors (Pro); Match Day is in every plan. Unknown until the member's permissions load → open.
  let perms = null;   // { staff, list }
  const can = (k) => !perms || perms.staff || perms.list.includes(k);
  const LOCK_MSG = { "library.creators": "Not in your plan: available from Plus", "library.matchday": "Not in your plan: available in every plan", "library.brands": "Not in your plan: available in Pro" };
  const lockedHtml = (k) => `<div class="lf-locked">${svg("lock")}<p>${esc(tx(LOCK_MSG[k]))}</p><a class="lf-locked-btn" href="pricing.html">${esc(tx("See plans"))}</a></div>`;
  const selected = Object.fromEntries(CATEGORIES.map((c) => [c.key, new Set()])); // category -> Set(value ids)
  let counts = null; // value id -> posts with the other filters applied (null = not counted: show catalog totals)

  // ---------- Icons (outline, currentColor) ----------
  const P = {
    // sports (one drawing per sport: SPORT_ICON)
    "sp-football": '<circle cx="12" cy="12" r="9"/><path d="m12 8.2 3.6 2.6-1.4 4.2H9.8l-1.4-4.2z"/><path d="M12 8.2V3M15.6 10.8l4.9-1.6M14.2 15l3 4.2M9.8 15l-3 4.2M8.4 10.8 3.5 9.2"/>',
    "sp-basketball": '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/><path d="M5.8 5.5Q10 12 5.8 18.5M18.2 5.5Q14 12 18.2 18.5"/>',
    "sp-baseball": '<circle cx="12" cy="12" r="9"/><path d="M7.2 4.4Q11 12 7.2 19.6M16.8 4.4Q13 12 16.8 19.6"/><path d="M7.4 7.5l1.6-.6M8.3 10.5l1.7-.2M8.3 13.5l1.7.2M7.4 16.5l1.6.6M16.6 7.5l-1.6-.6M15.7 10.5l-1.7-.2M15.7 13.5l-1.7.2M16.6 16.5l-1.6.6"/>',
    "sp-tennis": '<ellipse cx="9.5" cy="9.5" rx="5" ry="6.2" transform="rotate(-45 9.5 9.5)"/><path d="m13.4 13.4 6.6 6.6"/><path d="M6.3 9.7l3.4-3.4M8 12.3l4.3-4.3M10 13.9l3.4-3.4"/><circle cx="18.5" cy="5.5" r="2"/>',
    "sp-padel": '<path d="M12 2.5c3.6 0 6 2.6 6 6.2 0 3.8-2.6 6.3-6 6.3s-6-2.5-6-6.3c0-3.6 2.4-6.2 6-6.2z"/><path d="M10.6 15v6h2.8v-6"/><circle cx="10" cy="7" r=".4"/><circle cx="14" cy="7" r=".4"/><circle cx="12" cy="9" r=".4"/><circle cx="10" cy="11" r=".4"/><circle cx="14" cy="11" r=".4"/>',
    "sp-american-football": '<ellipse cx="12" cy="12" rx="10" ry="5.8" transform="rotate(-45 12 12)"/><path d="m9 15 6-6M9.6 11.6l2.8 2.8M11.6 9.6l2.8 2.8"/><path d="M5.3 14.5 9.5 18.7M14.5 5.3l4.2 4.2"/>',
    "sp-rugby": '<ellipse cx="12" cy="12" rx="9.8" ry="6.3"/><path d="M2.6 11Q12 6.5 21.4 11M2.6 13Q12 17.5 21.4 13"/>',
    "sp-motor": '<path d="M5 21V3.5"/><path d="M5 4h14v10H5"/><path d="M5 9h14M9.7 4v10M14.3 4v10"/>',
    "sp-f1": '<path d="M2 15.5V13l5-1.5 2-2.5h4l1.5 2.5H19l3 1v3"/><path d="M8.7 15.5h6.6M2 15.5h.3M21.7 15.5h.3"/><circle cx="5.5" cy="15.5" r="2.5"/><circle cx="18.5" cy="15.5" r="2.5"/><path d="M19.5 11.5V8.5h2.5"/>',
    "sp-cycling": '<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>',
    "sp-ice-hockey": '<path d="M16 3 9.6 17.2a2 2 0 0 1-1.8 1.3H3v-2.5h4.5L13.5 3"/><ellipse cx="17.5" cy="18" rx="3.5" ry="1.4"/><path d="M14 18v1.2c0 .8 1.6 1.4 3.5 1.4s3.5-.6 3.5-1.4V18"/>',
    "sp-handball": '<circle cx="18.5" cy="4.5" r="2.2"/><circle cx="9" cy="4.5" r="1.8"/><path d="M10.5 8l-1.5 6 3 2.5V21M9 14l-3 2-1 5"/><path d="M10.3 8.8l5.2-2.6M10.2 9.5 6 11.5"/>',
    "sp-martial-arts": '<path d="M8 21v-4.2C6.2 15.6 5 13.6 5 11V8a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v3.5c0 2.3-1 4.1-3 5.3V21z"/><path d="M8 17h8M5 10.5c2 0 3.5.8 3.5 2.8M9.5 3.5v4.5M14.5 3.5v4.5"/>',
    "sp-running": '<circle cx="15" cy="4" r="2"/><path d="M13 8.2 10.5 14l3.5 2.5-1 4.5M10.5 14l-2.5 3.5H4"/><path d="M6.5 10.5 9.5 8h3.6l2.4 3 3.5 1"/>',
    "sp-golf": '<path d="M10 18V3l7 3.5-7 3.5"/><path d="M3.5 19.5c0-1.2 2.9-2.2 6.5-2.2s6.5 1 6.5 2.2-2.9 2-6.5 2-6.5-.8-6.5-2z"/><circle cx="19" cy="16.5" r="1.5"/>',
    "sp-waterpolo": '<circle cx="12" cy="8.5" r="5.8"/><path d="M8 4.3c1.8 1.6 1.8 6.8 0 8.4M16 4.3c-1.8 1.6-1.8 6.8 0 8.4M6.3 8.5h11.4"/><path d="M2 18c1.7 0 1.7-1.3 3.3-1.3S7 18 8.7 18s1.6-1.3 3.3-1.3 1.6 1.3 3.3 1.3 1.7-1.3 3.4-1.3S20.3 18 22 18M4 21.5c1.3 0 1.4-1 2.7-1s1.4 1 2.7 1 1.3-1 2.6-1 1.4 1 2.7 1 1.3-1 2.6-1 1.4 1 2.7 1"/>',
    "sp-volleyball": '<circle cx="12" cy="12" r="9.5"/><path d="M12 12a12.6 12.6 0 0 1-8.7 5"/><path d="M11.2 7.3a15 15 0 0 1 10.3 3.9"/><path d="M16.4 13.5a15 15 0 0 1-8.7 7.5"/><path d="M20.3 16.6A12.8 12.8 0 0 0 12 12a13.3 13.3 0 0 1 0-9.5"/><path d="M6.6 4.3a15 15 0 0 0 1.8 10.9"/>',
    ball: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5l3.8 2.8-1.5 4.4H9.7l-1.5-4.4zM12 3v4.5M20.6 9.5l-4.8.8M17.5 19.5l-3.2-4.8M6.5 19.5l3.2-4.8M3.4 9.5l4.8.8"/>',
    basket: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5.6 5.6c3 3 3 9.8 0 12.8M18.4 5.6c-3 3-3 9.8 0 12.8"/>',
    tennis: '<circle cx="12" cy="12" r="9"/><path d="M5.5 5.5c3.5 3.5 3.5 9.5 0 13M18.5 5.5c-3.5 3.5-3.5 9.5 0 13"/>',
    oval: '<ellipse cx="12" cy="12" rx="9.5" ry="6" transform="rotate(-35 12 12)"/><path d="m9 15 6-6M10.5 10.5l3 3"/>',
    wheel: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M12 3v7M4.2 16.5l6-3.5M19.8 16.5l-6-3.5"/>',
    bike: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-7h5l3 7M10 9 8.5 6H7M15 9l-3 7"/>',
    puck: '<path d="M4 10c0-1.7 3.6-3 8-3s8 1.3 8 3v4c0 1.7-3.6 3-8 3s-8-1.3-8-3z"/><path d="M4 10c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    glove: '<path d="M7 11V7a3 3 0 0 1 6 0v1h2a3 3 0 0 1 3 3v3a6 6 0 0 1-6 6h-1a5 5 0 0 1-5-5z"/><path d="M7 13h8"/>',
    run: '<circle cx="15" cy="4.5" r="2"/><path d="M5 21l4-6 3 2 3-5-4-3-4 3M14 12l3 3h3"/>',
    flagc: '<path d="M4 21V4M4 4h14l-3 4 3 4H4"/>',
    golf: '<path d="M12 18V3l6 3-6 3"/><ellipse cx="12" cy="19" rx="6" ry="2"/>',
    racket: '<ellipse cx="10" cy="9" rx="6" ry="6.5"/><path d="M14 13.5 20 20"/>',
    dots: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M15 20a4 4 0 0 1 6-3.5"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3a3 3 0 0 1-3 4M7 5H4a3 3 0 0 0 3 4"/>',
    shield: '<path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6z"/>',
    megaphone: '<path d="M3 10v4h4l6 4V6L7 10z"/><path d="M17 8a5 5 0 0 1 0 8"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6M11 8v6"/>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
    grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
    swap: '<path d="M17 3l4 4-4 4"/><path d="M3 7h18"/><path d="M7 21l-4-4 4-4"/><path d="M21 17H3"/>',
    shirt: '<path d="M8 3 4 6l2 4 2-1v12h8V9l2 1 2-4-4-3c-1 2-2.5 3-4 3s-3-1-4-3z"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
    flag: '<path d="M4 21V4M4 4h14l-3 4 3 4H4"/>',
    pulse: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    versus: '<path d="M4 5l4 10 4-10M20 6.5C19 5.6 17.9 5 16.5 5 15 5 14 5.9 14 7.2c0 3 6 2 6 5.4 0 1.4-1.2 2.4-3 2.4-1.4 0-2.6-.6-3.4-1.6"/><path d="M4 19h16"/>',
    pin: '<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    message: '<path d="M4 4h16v12H8l-4 4z"/>',
    alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.01"/>',
    tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    badge: '<path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6z"/><path d="m9 12 2 2 4-4"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    cursor: '<path d="M3 11l18-8-8 18-2-8z"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    shape: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16"/>',
    chev: '<path d="m6 9 6 6 6-6"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
    reel: '<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="m10.5 9.5 4 2.5-4 2.5z"/>',
    carousel: '<rect x="5" y="4" width="11" height="16" rx="2"/><path d="M19 6v12M22 8v8"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    video: '<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="m10 9.5 5 2.5-5 2.5z"/>',
    story: '<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M12 7v10M7.5 12h9"/>',
  };
  const svg = (k, cls = "") => `<svg class="lf-i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[k] || P.dots}</svg>`;
  const FORMAT_ICON = { images: "image", image: "image", post: "image", photo: "image", reel: "reel", reels: "reel", shorts: "reel", carousel: "carousel", video: "video", story: "story", stories: "story" };
  const SPORT_ICON = { football: "football", soccer: "football", basketball: "basketball", tennis: "tennis", padel: "padel", "american football": "american-football", rugby: "rugby", baseball: "baseball", motor: "motor", motorsport: "motor", f1: "f1", "formula 1": "f1", cycling: "cycling", "ice hockey": "ice-hockey", hockey: "ice-hockey", handball: "handball", "martial arts": "martial-arts", running: "running", athletics: "running", golf: "golf", waterpolo: "waterpolo", "water polo": "waterpolo", volleyball: "volleyball" };
  const sportIco = (name) => { const k = SPORT_ICON[String(name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()]; return k ? `sp-${k}` : "dots"; };
  // Official platform logos (assets/pf-*.svg used as masks): muted at rest, brand colours on hover / when chosen
  const PLATFORM = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", x: "X", facebook: "Facebook", linkedin: "LinkedIn" };
  const pfLogo = (k, cls = "lf-pfl") => `<span class="${cls} lf-pf-${k}" style="-webkit-mask-image:url(assets/pf-${k}.svg);mask-image:url(assets/pf-${k}.svg)" aria-hidden="true"></span>`;
  // Top Picks / Replicable ideas / Overperforming (catalog "trend" values) — the home page badges
  const SPECIAL = {
    "top picks": { cls: "lf-sp-top", ico: "star", desc: "The best posts, picked by SCP",
      lead: "The posts we'd show a club first: a strong idea, well made and with results.",
      points: ["Start here when you need inspiration fast", "Benchmarks for what “great” looks like"] },
    "replicable ideas": { cls: "lf-sp-rep", ico: "copy", desc: "Easy to copy with your own assets",
      lead: "Formats you can recreate with your own players, venue and footage, without a big production.",
      points: ["Ideas you can publish this week", "Work for any club size"] },
    overperforming: { cls: "lf-sp-over", ico: "trend", desc: "Beat their account's own average",
      lead: "Posts that did far better than their account usually does.",
      points: ["Spot what moves the needle", "Compare against the club's own normal, not the giants"] },
    "content creators": { cls: "lf-sp-creators", ico: "user", desc: "Posts by sports content creators",
      lead: "Posts from creators who make sports content: fresh formats, trends and a native tone your club can borrow.",
      points: ["Trends before clubs adopt them", "Ideas for collabs with creators"] },
  };
  const special = (v) => SPECIAL[v.name.toLowerCase()] || { cls: "lf-sp-top", ico: "star", desc: "" };
  const SHAPE_WORD = { "9:16": "Vertical", "2:3": "Vertical", "3:4": "Vertical", "4:5": "Vertical", "1:1": "Square", "4:3": "Horizontal", "16:9": "Horizontal", "1.91:1": "Horizontal" };
  const shapeBox = (name) => {
    const [w, h] = String(name).split(":").map(Number);
    if (!w || !h) return "";
    const s = 21 / Math.max(w, h);
    return `<i class="lf-shape" style="width:${Math.round(w * s)}px;height:${Math.round(h * s)}px"></i>`;
  };

  // ---------- Language flags (flagcdn.com); "Emoji only" and "Other" get a symbol instead ----------
  const FLAG = { english: "gb", spanish: "es", french: "fr", italian: "it", portuguese: "pt",
    german: "de", dutch: "nl", turkish: "tr", arabic: "sa", polish: "pl", greek: "gr", japanese: "jp", korean: "kr", chinese: "cn", indonesian: "id",
    russian: "ru", ukrainian: "ua", swedish: "se", danish: "dk", norwegian: "no", finnish: "fi", croatian: "hr", serbian: "rs", czech: "cz", slovak: "sk",
    slovenian: "si", romanian: "ro", hungarian: "hu", bulgarian: "bg", hebrew: "il", hindi: "in", thai: "th", vietnamese: "vn", malay: "my",
    bosnian: "ba", kazakh: "kz", uzbek: "uz", azerbaijani: "az", "haitian creole": "ht" };
  const symbol = (ch) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 26"><rect width="40" height="26" fill="#eef1f6"/><text x="20" y="19" font-size="17" text-anchor="middle">${ch}</text></svg>`)}`;
  const SENYERA = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9 6"><rect width="9" height="6" fill="#fcdd09"/><path d="M0 1h9M0 2.33h9M0 3.67h9M0 5h9" stroke="#da121a" stroke-width=".67"/></svg>`)}`;
  const svgFlag = (body) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 26">${body}</svg>`)}`;
  const OWN_FLAG = {   // regions without an ISO flag: drawn here
    catalan: SENYERA,
    galician: svgFlag(`<rect width="40" height="26" fill="#fff"/><path d="M0 0L40 26" stroke="#0099cc" stroke-width="7"/>`),
    basque: svgFlag(`<rect width="40" height="26" fill="#d52b1e"/><path d="M0 0L40 26M40 0L0 26" stroke="#009b48" stroke-width="4"/><path d="M20 0v26M0 13h40" stroke="#fff" stroke-width="4"/>`),
  };
  const flagOf = (name) => { const n = name.toLowerCase(), c = FLAG[n]; return c ? `https://flagcdn.com/w40/${c}.png` : OWN_FLAG[n] || (n === "emoji only" ? symbol("😀") : symbol("🌐")); };

  // ---------- Catalog (values + totals; logos from library-filters.sql) ----------
  async function loadCatalog() {
    // The catalog is bigger than the 1,000 rows the API returns per request: read it page by page
    const allCatalog = async () => {
      const out = [];
      for (let from = 0; ; from += 1000) {
        const r = await db.rpc("catalog_with_counts").range(from, from + 999);
        if (r.error) return { data: out.length ? out : null, error: out.length ? null : r.error };
        out.push(...(r.data || []));
        if (!r.data || r.data.length < 1000) return { data: out, error: null };
      }
    };
    const [{ data, error }, logos] = await Promise.all([
      allCatalog(),
      // every logo, 1,000 at a time (one request stops at 1,000 and there are more: the rest showed no logo)
      (async () => {
        const out = [];
        for (let from = 0; ; from += 1000) {
          const r = await db.from("idea_catalog").select("id,logo_url,logo_source").not("logo_url", "is", null).order("id").range(from, from + 999).then((x) => x, () => ({ data: null }));
          out.push(...(r.data || []));
          if (!r.data || r.data.length < 1000) return out;
        }
      })(),
    ]);
    if (error) throw error;
    const logo = new Map(logos.map((l) => [Number(l.id), l.logo_url]));
    // Instagram profile pictures (pipeline/library/ig-avatars.mjs) fill their circle; Wikimedia crests sit inside one
    const igHandle = new Map(logos.map((l) => [Number(l.id), (/instagram\.com\/([\w.]+)/.exec(l.logo_source || "") || [])[1] || null]));
    const byCat = {};
    const byId = new Map();
    for (const r of data || []) {
      if (!CAT[r.category]) continue;
      if (r.category === "platform" && /^linkedin$/i.test(r.name)) continue;   // LinkedIn is no longer offered as a filter
      const v = { id: Number(r.id), category: r.category, name: fixText(r.name), total: Number(r.ideas), logo: logo.get(Number(r.id)) || (r.category === "language" || r.category === "creator_language" ? flagOf(r.name) : null), ig: igHandle.get(Number(r.id)) || null };
      if (!v.total) continue;
      (byCat[v.category] ||= []).push(v);
      byId.set(v.id, v);
    }
    for (const k in byCat) byCat[k].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    catalog = { byCat, byId };
  }

  // ---------- Views (supabase/library-filters.sql: views_histogram + p_min_views / p_max_views) ----------
  const VB = 28; // buckets on a log scale from 1K to 50M
  const vEdge = (i) => 1000 * Math.pow(50000, i / VB);
  const views = { hist: null, a: 0, b: VB, exact: null };   // exact: [min, max] typed in the search ("2M views"), else the slider buckets
  async function loadViews() {
    const { data, error } = await db.rpc("views_histogram");
    if (error || !data?.length) return;
    const h = Array(VB).fill(0);
    for (const r of data) h[Math.min(VB - 1, Math.max(0, Number(r.bucket)))] += Number(r.posts);
    if (h.some(Boolean)) { views.hist = h; $("[data-views-order]").hidden = false; }
  }
  const viewsSet = () => !!views.exact || views.a > 0 || views.b < VB;
  const viewsLabel = () => (views.exact ? (([lo, hi]) => (lo && hi ? `${kfmt(lo)} – ${kfmt(hi)}` : lo ? `${kfmt(lo)}+` : `≤ ${kfmt(hi)}`))(views.exact) : viewsSet() ? `${kfmt(Math.round(vEdge(views.a)))} – ${views.b === VB ? `${kfmt(Math.round(vEdge(VB)))}+` : kfmt(Math.round(vEdge(views.b)))}` : "Any");

  // ---------- Rendering ----------
  const countOf = (v) => (counts ? counts.get(v.id) ?? 0 : v.total);
  const isOn = (v) => selected[v.category].has(v.id);
  const byCount = (list) => [...list].sort((a, b) => (isOn(b) - isOn(a)) || ((countOf(b) > 0) - (countOf(a) > 0)) || countOf(b) - countOf(a) || a.name.localeCompare(b.name));
  const ui = { open: "views", more: new Set(), all: new Set(), q: {}, aiMode: null };   // Views starts open; it can be folded // open dropdown, expanded "+N more" sections, "Show all" lists, list searches
  const has = (k) => catalog.byCat[k]?.length > 0;

  function rowHead(c, title = c.label, icoKey = c.ico) {
    const sel = [...selected[c.key]].map((id) => catalog.byId.get(id)).filter(Boolean);
    const first = sel[0];
    const lead = first && (first.logo || c.crest) ? crestImg(first, "lf-mini") : "";
    const val = sel.length ? `${lead}${esc(pretty(first.name))}${sel.length > 1 ? ` +${sel.length - 1}` : ""}` : "Any";
    return `<button class="lf-rh" type="button" aria-expanded="${ui.open === c.key}" data-lf-row="${c.key}">${svg(icoKey)}<span class="lf-t">${esc(title)}</span>${sel.length ? `<span class="lf-badge">${sel.length}</span>` : ""}<span class="lf-v${sel.length ? " is-set" : ""}">${val}</span>${svg("chev", "lf-chev")}</button>`;
  }
  const initials = (name) => {
    const words = String(name).replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter((w) => w && !/^(fc|cf|club|de|the|ac|as|sc|afc|cd|ud|rc)$/i.test(w));
    return (words.length > 1 ? words.slice(0, 3).map((w) => w[0]).join("") : (words[0] || name).slice(0, 4)).toUpperCase();
  };
  const crestImg = (v, cls = "lf-crest") => `<span class="${cls}">${v.logo ? `<img src="${esc(v.logo)}" alt="" loading="lazy">` : `<b>${esc(initials(v.name))}</b>`}</span>`;

  // values not shown in the column's lists (repeated elsewhere, or dropped: collab "Influencer / creator", "Athlete takeover")
  const REPEATED = { entity: ["clubs", "competitions", "content creators"], collab: ["influencer / creator", "athlete takeover"] };
  function listHtml(c) {
    const all = (catalog.byCat[c.key] || []).filter((v) => LAYOUT_BEFORE || !REPEATED[c.key]?.includes(v.name.toLowerCase()) || isOn(v));
    const q = (ui.q[c.key] || "").toLowerCase();
    const items = byCount(all.filter((v) => !q || v.name.toLowerCase().includes(q)));
    if (c.key === "language") items.sort((a, b) => (a.name.toLowerCase() === "emoji only") - (b.name.toLowerCase() === "emoji only"));   // "Emoji only" always last
    const showAll = ui.all.has(c.key) || q;
    const N = c.crest ? 12 : c.key === "language" ? 5 : 7;
    // long lists (cities, opponents): only through the search box — the chosen ones stay visible
    const searchOnly = !LAYOUT_BEFORE && ["city", "opponent"].includes(c.key) && !q;
    const shown = searchOnly ? items.filter(isOn) : showAll ? items : items.slice(0, N);
    const searchBox = c.crest || c.search || all.length > 12
      ? `<input class="lf-lsearch" type="search" placeholder="${esc(tx("Search {n} {what}", { n: all.length.toLocaleString(window.SCP_LOC || "en-GB"), what: tx(c.label).toLowerCase() }))}" value="${esc(ui.q[c.key] || "")}" aria-label="${esc(tx("Search {what}", { what: tx(c.label).toLowerCase() }))}" data-facet-search="${c.key}">` : "";
    let body;
    if (c.crest) {
      body = `<div class="lf-crests">${shown.map((v) => `<button type="button" class="lf-cr${isOn(v) ? " is-on" : ""}${countOf(v) === 0 && !isOn(v) ? " is-zero" : ""}" aria-pressed="${isOn(v)}" data-facet="${c.key}" data-id="${v.id}" title="${esc(v.name)} · ${countOf(v).toLocaleString(window.SCP_LOC || "en-GB")} posts">${crestImg(v)}<span>${esc(pretty(v.name))}</span></button>`).join("")}</div>`;
    } else if (c.key === "sport") {
      body = `<div class="lf-tiles lf-tiles-3">${shown.map((v) => `<button type="button" class="lf-tile${isOn(v) ? " is-on" : ""}${countOf(v) === 0 && !isOn(v) ? " is-zero" : ""}" aria-pressed="${isOn(v)}" data-facet="${c.key}" data-id="${v.id}">${svg(sportIco(v.name))}<span>${esc(pretty(v.name))}</span></button>`).join("")}</div>`;
    } else {
      body = `<div class="lf-list">${shown.map((v) => {
        const n = countOf(v);
        const lead = c.logo ? (v.logo ? `<span class="lf-lead lf-lead-logo${c.key === "language" ? " lf-lead-flag" : ""}"><img src="${esc(v.logo)}" alt="" loading="lazy"></span>` : `<span class="lf-lead lf-lead-logo"><b>${esc(v.name.slice(0, 7))}</b></span>`) : "";
        return `<button type="button" class="lf-li${isOn(v) ? " is-on" : ""}${n === 0 && !isOn(v) ? " is-zero" : ""}" aria-pressed="${isOn(v)}" data-facet="${c.key}" data-id="${v.id}">${lead}<span class="lf-lab">${esc(pretty(v.name))}</span><span class="lf-cnt">${kfmt(n)}</span></button>`;
      }).join("") || `<p class="lf-none">Nothing matches “${esc(ui.q[c.key])}”.</p>`}</div>`;
    }
    if (searchOnly) return searchBox + (shown.length ? `<div class="lf-list">${shown.map((v) => `<button type="button" class="lf-li is-on" aria-pressed="true" data-facet="${c.key}" data-id="${v.id}"><span class="lf-lab">${esc(pretty(v.name))}</span><span class="lf-cnt">${kfmt(countOf(v))}</span></button>`).join("")}</div>` : `<p class="lf-none">${esc(tx("Type to search {n} {what}", { n: all.length.toLocaleString(window.SCP_LOC || "en-GB"), what: tx(c.label).toLowerCase() }))}</p>`);
    const moreBtn = !showAll && items.length > N ? `<button type="button" class="lf-showall" data-lf-all="${c.key}">${c.key === "language" ? tx("Show {n} more", { n: items.length - N }) : tx("Show all {n}", { n: items.length.toLocaleString(window.SCP_LOC || "en-GB") })}</button>` : "";
    return searchBox + body + moreBtn;
  }

  function rowHtml(c, extraCls = "") {
    const open = ui.open === c.key;
    return `<div class="lf-row${open ? " is-open" : ""}${extraCls}" data-lf-rowbox="${c.key}">${rowHead(c)}<div class="lf-rb"${open ? "" : " hidden"} data-lf-body-of="${c.key}">${open ? listHtml(c) : ""}</div></div>`;
  }

  // "Favs": the posts of the favourite profiles chosen in Profile → Favourites (instead of Top Picks)
  const favVals = () => [...me.fav].map((id) => catalog.byId.get(id)).filter(Boolean);
  // the favourite network (Profile → Favourites) goes with them: Instagram favourite → their Instagram posts
  const favNetwork = () => (me.favPlatform && (catalog.byCat.platform || []).find((v) => v.name.toLowerCase() === me.favPlatform)) || null;
  const favsOn = () => { const f = favVals(), pf = favNetwork(); return f.length > 0 && f.every(isOn) && (!pf || isOn(pf)); };
  // how many posts Favs shows (the same filters the button turns on), asked once per set of favourites
  let favsN = null, favsKey = "";
  async function loadFavsN(f, pf) {
    const key = [...f.map((v) => v.id), pf?.id].join(",");
    if (key === favsKey) return;
    favsKey = key; favsN = null;
    const facets = {};
    [...f, ...(pf ? [pf] : [])].forEach((v) => (facets[v.category] = [...(facets[v.category] || []), v.id]));
    const { data } = await fetchIdeas({ ...queryArgs({ facets, period: "all" }), p_order: "latest", p_seed: "", p_ids: null, p_limit: 1, p_offset: 0 }).catch(() => ({}));
    if (key !== favsKey || data?.total == null) return;
    favsN = data.total;
    const n = $(".lf-sp-favs [data-favs-n]");
    if (n) { n.textContent = kfmt(favsN); n.hidden = false; }
  }
  function favsHtml() {
    const f = favVals();
    if (!f.length) return `<a class="lf-sp lf-sp-top lf-sp-favs" href="profile.html#favourites" data-id="favs" data-sp-tip="favs"><span class="lf-sp-ic">${svg("star")}</span><span class="lf-sp-tx"><b>Favs</b><small>${esc(tx("Choose your favourite profiles"))}</small></span><span class="lf-sp-info" data-sp-info role="button" tabindex="0" aria-label="${esc(tx("What is this?"))}" title="${esc(tx("What is this?"))}">i</span></a>`;
    const on = favsOn();
    const pf = favNetwork();
    if (db) loadFavsN(f, pf);
    return `<button type="button" class="lf-sp lf-sp-top lf-sp-favs${on ? " is-on" : ""}" aria-pressed="${on}" data-favs data-id="favs" data-sp-tip="favs">
      <span class="lf-sp-ic">${svg("star")}</span><span class="lf-sp-tx"><b>Favs</b><small>${esc(tx(f.length === 1 ? "{n} profile" : "{n} profiles", { n: f.length }))}${pf ? ` · ${esc(pf.name)}` : ""}</small></span>
      <span class="lf-sp-info" data-sp-info role="button" tabindex="0" aria-label="${esc(tx("What is this?"))}" title="${esc(tx("What is this?"))}">i</span>
      <span class="lf-sp-n" data-favs-n${favsN == null ? " hidden" : ""}>${favsN == null ? "" : kfmt(favsN)}</span>${svg("check", "lf-sp-ck")}</button>`;
  }
  const notTopPicks = (v) => v.name.toLowerCase() !== "top picks";

  function discoverHtml() {
    const sp = byCountStable((catalog.byCat.trend || []).filter(notTopPicks));
    let rows = [favsHtml(), ...sp.map((v) => {
      const s = special(v), n = countOf(v), on = isOn(v), zero = n === 0 && !on;
      return `<button type="button" class="lf-sp ${s.cls}${on ? " is-on" : ""}${zero ? " is-zero" : ""}" aria-pressed="${on}" ${zero ? 'aria-disabled="true" ' : ""}data-facet="trend" data-id="${v.id}"${s.desc ? ` data-sp-tip="${esc(tx(s.desc))}"` : ""}>
        <span class="lf-sp-ic">${svg(s.ico)}</span><span class="lf-sp-tx"><b>${esc(pretty(v.name))}</b></span>${s.desc ? `<span class="lf-sp-info" data-sp-info role="button" tabindex="0" aria-label="${esc(tx("What is this?"))}" title="${esc(tx("What is this?"))}">i</span>` : ""}
        <span class="lf-sp-n">${zero ? "No matches" : kfmt(n)}</span>${svg("check", "lf-sp-ck")}</button>`;
    })];
    // Overperforming: always shown; until the catalog has the value (no post tagged yet) a placeholder that can't be clicked
    if (!sp.some((v) => v.name.toLowerCase() === "overperforming")) {
      const s = SPECIAL.overperforming;
      rows.push(`<button type="button" class="lf-sp ${s.cls} is-zero" aria-disabled="true" disabled title="${esc(tx(s.desc))}">
        <span class="lf-sp-ic">${svg(s.ico)}</span><span class="lf-sp-tx"><b>Overperforming</b></span><span class="lf-sp-n">${esc(tx("Soon"))}</span></button>`);
    }
    // "Content Creators" (Publisher type): its own gold button right under Replicable ideas
    const cc = (catalog.byCat.entity || []).find((v) => v.name.toLowerCase() === "content creators");
    if (cc && !can("library.creators")) {
      const s = special(cc);
      const at = sp.findIndex((v) => v.name.toLowerCase() === "replicable ideas");
      rows.splice(at >= 0 ? at + 2 : rows.length, 0, `<a class="lf-sp ${s.cls} is-locked" href="pricing.html" title="${esc(tx(LOCK_MSG["library.creators"]))}">
        <span class="lf-sp-ic">${svg(s.ico)}</span><span class="lf-sp-tx"><b>${esc(tx("Content Creators"))}</b></span><span class="lf-sp-n">${svg("lock")}</span></a>`);
    } else if (cc) {
      const n = countOf(cc), on = isOn(cc), zero = n === 0 && !on;
      const s = special(cc);
      const btn = `<button type="button" class="lf-sp ${s.cls}${on ? " is-on" : ""}${zero ? " is-zero" : ""}" aria-pressed="${on}" ${zero ? 'aria-disabled="true" ' : ""}data-facet="entity" data-id="${cc.id}" data-sp-tip="${esc(tx(s.desc))}">
        <span class="lf-sp-ic">${svg(s.ico)}</span><span class="lf-sp-tx"><b>${esc(tx("Content Creators"))}</b></span><span class="lf-sp-info" data-sp-info role="button" tabindex="0" aria-label="${esc(tx("What is this?"))}" title="${esc(tx("What is this?"))}">i</span>
        <span class="lf-sp-n">${zero ? "No matches" : kfmt(n)}</span>${svg("check", "lf-sp-ck")}</button>`;
      const at = sp.findIndex((v) => v.name.toLowerCase() === "replicable ideas");
      rows.splice(at >= 0 ? at + 2 : rows.length, 0, btn + (on ? creatorsHtml() : ""));   // +1: Favs is the first row
    }
    rows.push(whoHtml());
    rows = rows.join("");
    const vOpen = ui.open === "views";
    // Views exist only on Instagram, TikTok and YouTube (Shorts too): with only X / Facebook / LinkedIn chosen, no Views filter
    const pfSel = [...(selected.platform || [])].map((id) => catalog.byId.get(id)?.name.toLowerCase());
    const noViews = pfSel.length > 0 && pfSel.every((n) => ["x", "facebook", "linkedin"].includes(n));
    const viewsRow = views.hist && noViews ? `<div class="lf-row is-disabled" data-lf-rowbox="views">
        <button class="lf-rh" type="button" disabled aria-disabled="true">${svg("eye")}<span class="lf-t">Views</span><span class="lf-v">${viewsLabel()}</span>${svg("chev", "lf-chev")}</button></div>`
      : views.hist ? `<div class="lf-row${vOpen ? " is-open" : ""}" data-lf-rowbox="views">
        <button class="lf-rh" type="button" aria-expanded="${vOpen}" data-lf-row="views">${svg("eye")}<span class="lf-t">Views</span><span class="lf-v${viewsSet() ? " is-set" : ""}" data-views-v>${viewsLabel()}</span>${svg("chev", "lf-chev")}</button>
        <div class="lf-rb"${vOpen ? "" : " hidden"} data-lf-body-of="views">${viewsHtml()}</div></div>` : "";
    return rows + viewsRow;
  }
  // "Who publishes": media, memes (players' and brands' accounts are in Inspiration → Club, next to the squad)
  function whoHtml() {
    // clubs and competitions are already in "Inspiration"; Content Creators has its own button above
    const list = byCount((catalog.byCat.entity || []).filter((v) => !["content creators", "clubs", "competitions", "player", "brand", "media", "meme"].includes(v.name.toLowerCase()) && (countOf(v) > 0 || isOn(v))));
    if (!list.length) return "";
    return `<div class="lf-who"><div class="lf-chips">${list.map((v) => `<button type="button" class="lf-chip${isOn(v) ? " is-on" : ""}" aria-pressed="${isOn(v)}" data-facet="entity" data-id="${v.id}">${esc(pretty(v.name))}<em>${kfmt(countOf(v))}</em></button>`).join("")}</div></div>`;
  }
  // Content Creators on: the filters that describe creators' posts, right under the button (counts are already
  // limited to creators' posts, because the button is one of the active filters)
  // Followers: a range slider (as Views) on steps 0 · 1K · 2K · 5K … 10M+, with the creators per step above it
  const FOL = [0, 1e3, 2e3, 5e3, 1e4, 2e4, 5e4, 1e5, 2e5, 5e5, 1e6, 2e6, 5e6, 1e7], FB = FOL.length - 1;
  const folA = () => ui.fol?.a ?? 0, folB = () => ui.fol?.b ?? FB;
  const folLbl = (i) => (i === FB ? `${kfmt(FOL[FB])}+` : kfmt(FOL[i]));
  const folHtml = () => {
    const a = folA(), b = folB();
    const h = FOL.slice(0, FB).map((lo, i) => (cr.rows || []).filter((r) => r.followers != null && r.followers >= lo && (i === FB - 1 || r.followers < FOL[i + 1])).length);
    const mx = Math.max(1, ...h);
    return `<div class="lf-sub lf-fol-h">${esc(tx("Followers"))}${a > 0 || b < FB ? `<button type="button" class="lf-fol-clear" data-fol-clear>${esc(tx("Clear"))}</button>` : ""}</div>
      <div class="lf-fol-box">${cr.rows ? `<div class="lf-hist" aria-hidden="true">${h.map((n, i) => `<i class="${i >= a && i < b ? "is-in" : ""}" style="height:${Math.max(5, (n / mx) * 100)}%"></i>`).join("")}</div>` : ""}
      <div class="lf-rng"><div class="lf-tr"></div><div class="lf-fl" style="left:${(a / FB) * 100}%;right:${100 - (b / FB) * 100}%"></div>
        <input type="range" min="0" max="${FB}" step="1" value="${a}" aria-label="${esc(tx("Followers from"))}" data-fol-lo><input type="range" min="0" max="${FB}" step="1" value="${b}" aria-label="${esc(tx("Followers to"))}" data-fol-hi></div>
      <div class="lf-rl"><span data-fol-lo-l>${folLbl(a)}</span><span data-fol-hi-l>${folLbl(b)}</span></div></div>`;
  };
  async function setFollowers(a, b) {
    if (a <= 0 && b >= FB) ui.fol = null;
    else {
      const min = a > 0 ? FOL[a] : null, max = b < FB ? FOL[b] : null;
      const { data } = await db.rpc("followers_post_ids", { p_min: min, p_max: max });
      ui.fol = { a, b, min, max, ids: (data || []).map(Number) };
    }
    renderFacets();
    load(true);
  }
  function creatorsHtml() {
    // Content type: only the ones that describe creators' posts (Players is one filter in Inspiration → Players)
    const only = { angle: ["skills / tutorial", "behind the scenes"] };
    const chips = (cat, max = 8) => {
      const list = byCount((catalog.byCat[cat] || []).filter((v) => (countOf(v) > 0 || isOn(v)) && (!only[cat] || only[cat].includes(v.name.toLowerCase())))).slice(0, max);
      return list.map((v) => `<button type="button" class="lf-chip${isOn(v) ? " is-on" : ""}" aria-pressed="${isOn(v)}" data-facet="${v.category}" data-id="${v.id}">${esc(pretty(v.name))}<em>${kfmt(countOf(v))}</em></button>`).join("");
    };
    // the creators' own accounts (from the post URL or the import; supabase/scraped-profiles.sql)
    if (!cr.rows && !cr.asked && db) { cr.asked = true; db.rpc("creator_rows").then((r) => { if (Array.isArray(r.data)) { cr.rows = r.data; renderFacets(); } }, () => {}); }
    if (!ui.accts) { ui.accts = []; db?.rpc("creator_accounts").then((r) => { ui.accts = r.data || []; if (ui.accts.length) renderFacets(); }, () => {}); }
    const groups = [["Content type", "angle"]]
      .map(([label, cat, max, h]) => [label, h ?? chips(cat, max)]).filter(([, h]) => h);
    if (!groups.length) return "";
    // language (with flags) and gender as dropdowns
    const rows = ["creator_language", "creator_gender"].filter(has).map((k) => rowHtml(CAT[k])).join("");
    const lang = rows ? `<div class="lf-stack lf-row-gap">${rows}</div>` : "";
    return `<div class="lf-cc-sub"><div class="lf-cc-view">${crSwitch()}</div>${acctRowHtml()}${folHtml()}${lang}
      ${groups.map(([, h]) => `<div class="lf-chips lf-cc-chips">${h}</div>`).join("")}</div>`;
  }
  // Creators' accounts: a dropdown with a search box on top; a star marks up to 5 favourites (Profile → Favourites,
  // preferences.favouriteCreatorAccounts), which come first
  const starKeys = () => (me.favAccts || []).map((a) => a.id);
  function acctListHtml() {
    const q = fold(ui.acctQ || "").replace(/^@/, ""), stars = starKeys();
    const all = ui.accts.map((a) => ({ ...a, k: `${a.platform}|${a.handle}` }));
    const list = q ? all.filter((a) => fold(a.handle).includes(q) || fold(a.name || "").includes(q)).slice(0, 40)
      : [...stars.map((k) => all.find((a) => a.k === k)).filter(Boolean), ...all.filter((a) => !stars.includes(a.k)).slice(0, 30)];
    return list.map((a) => { const on = ui.acct?.key === a.k, st = stars.includes(a.k);
      return `<div class="lf-acct${on ? " is-on" : ""}"><button type="button" class="lf-star${st ? " is-on" : ""}" data-acct-star="${esc(a.k)}" aria-pressed="${st}" aria-label="${esc(tx(st ? "Remove from favourites" : "Add to favourites"))}">${svg("star")}</button>
        <button type="button" class="lf-acct-b" aria-pressed="${on}" data-acct="${esc(a.k)}"><span>@${esc(a.handle)}<small>${esc(PLATFORM[a.platform] || a.platform)}</small></span><em>${kfmt(Number(a.posts))}</em></button></div>`; }).join("")
      || `<p class="lf-none">${esc(tx("Nothing matches “{q}”.", { q: ui.acctQ }))}</p>`;
  }
  function acctRowHtml() {
    if (!ui.accts.length) return "";
    const open = ui.open === "accts", sel = ui.acct ? ui.accts.find((a) => `${a.platform}|${a.handle}` === ui.acct.key) : null;
    return `<div class="lf-row lf-row-gap${open ? " is-open" : ""}" data-lf-rowbox="accts">
      <button class="lf-rh" type="button" aria-expanded="${open}" data-lf-row="accts">${svg("user")}<span class="lf-t">${esc(tx("Accounts"))}</span><span class="lf-v${sel ? " is-set" : ""}">${sel ? `@${esc(sel.handle)}` : esc(tx("Any"))}</span>${svg("chev", "lf-chev")}</button>
      <div class="lf-rb"${open ? "" : " hidden"}><input class="lf-lsearch" type="search" placeholder="${esc(tx("Search an account"))}" value="${esc(ui.acctQ || "")}" data-acct-q>
        <div class="lf-accts" data-acct-list>${open ? acctListHtml() : ""}</div></div></div>`;
  }
  async function toggleStar(k) {
    const stars = me.favAccts || [];
    if (stars.some((a) => a.id === k)) me.favAccts = stars.filter((a) => a.id !== k);
    else if (stars.length >= 5) { alert(tx("You can mark up to 5 favourite accounts. Remove one first (or edit them in your profile).")); return; }
    else { const a = ui.accts.find((x) => `${x.platform}|${x.handle}` === k); me.favAccts = [...stars, { id: k, name: `@${a?.handle || k.split("|")[1]}` }]; }
    renderFacets();
    // saved in the profile's preferences (same place as Profile → Favourites)
    const r = await auth?.getProfile?.(); const p = r?.profile;
    if (!p) return;
    const prefs = { ...(p.preferences || {}), favouriteCreatorAccounts: me.favAccts };
    const { error } = await db.rpc("update_my_preferences", { p_preferences: prefs, p_newsletter: !!p.newsletter, p_frequency: p.newsletter_frequency || "weekly" });
    if (!error) p.preferences = prefs;
  }
  // Specials keep the catalog order (Top Picks, Replicable ideas, Overperforming) so they don't jump around
  const ORDER_SP = ["top picks", "replicable ideas", "overperforming"];
  const byCountStable = (list) => [...list].sort((a, b) => ((ORDER_SP.indexOf(a.name.toLowerCase()) + 1 || 9) - (ORDER_SP.indexOf(b.name.toLowerCase()) + 1 || 9)));

  function viewsHtml() {
    const h = views.hist, mx = Math.max(...h);
    const quick = [[0, "Any"], [6, "10K+"], [12, "100K+"], [18, "1M+"]];
    return `<div class="lf-vq">${quick.map(([a, l]) => `<button type="button" class="${views.a === a && views.b === VB ? "is-on" : ""}" data-vq="${a}">${l}</button>`).join("")}</div>
      <div class="lf-hist" aria-hidden="true">${h.map((n, i) => `<i class="${i >= views.a && i < views.b ? "is-in" : ""}" style="height:${Math.max(5, (n / mx) * 100)}%"></i>`).join("")}</div>
      <div class="lf-rng"><div class="lf-tr"></div><div class="lf-fl" style="left:${(views.a / VB) * 100}%;right:${100 - (views.b / VB) * 100}%"></div>
        <input type="range" min="0" max="${VB}" step="1" value="${views.a}" aria-label="Minimum views" data-views-lo><input type="range" min="0" max="${VB}" step="1" value="${views.b}" aria-label="Maximum views" data-views-hi></div>
      <div class="lf-rl"><span data-views-lo-l>${kfmt(Math.round(vEdge(views.a)))}</span><span data-views-hi-l>${views.b === VB ? `${kfmt(Math.round(vEdge(VB)))}+` : kfmt(Math.round(vEdge(views.b)))}</span></div>`;
  }

  function formatHtml() {
    // icons only, all formats in one row; the name shows on hover
    const tiles = (catalog.byCat.format || []).map((v) => { const name = esc(tx(pretty(v.name))); return `<button type="button" class="lf-tile${isOn(v) ? " is-on" : ""}${countOf(v) === 0 && !isOn(v) ? " is-zero" : ""}" aria-pressed="${isOn(v)}" aria-label="${name}" data-tip="${name}" data-facet="format" data-id="${v.id}">${svg(FORMAT_ICON[v.name.toLowerCase()] || "image")}</button>`; }).join("");
    // proportions only once a format is chosen: they open right under the tiles, only the ones that format has
    // (also while a proportion is still selected, so it can be removed)
    const shapes = (selected.format.size || selected.aspect_ratio.size) && has("aspect_ratio") ? catalog.byCat.aspect_ratio.filter((v) => countOf(v) > 0 || isOn(v)) : [];
    const shapeBtn = (v) => `<button type="button" class="lf-shp${isOn(v) ? " is-on" : ""}${countOf(v) === 0 && !isOn(v) ? " is-zero" : ""}" aria-pressed="${isOn(v)}" data-facet="aspect_ratio" data-id="${v.id}"${SHAPE_WORD[v.name] ? ` data-tip="${esc(tx(SHAPE_WORD[v.name]))}"` : ""}>${shapeBox(v.name)}<span>${esc(v.name)}</span></button>`;
    const shapesHtml = shapes.length ? `<div class="lf-fmt-ar"><div class="lf-sub">${esc(tx(CAT_LABEL.aspect_ratio))}</div><div class="lf-shapes">${byCount(shapes).map((v) => shapeBtn(v).replace("</span></button>", `</span><em>${kfmt(countOf(v))}</em></button>`)).join("")}</div></div>` : "";
    const extra = durationHtml();
    const lang = has("language") ? `<div class="lf-stack lf-row-gap">${rowHtml(CAT.language)}</div>` : "";
    return `<div class="lf-tiles lf-fmt-tiles" style="--n:${(catalog.byCat.format || []).length || 5}">${tiles}</div>${shapesHtml}${extra}${lang}`;
  }

  // Length as a timeline, like Views: the 4 length bands of the catalog as bars, a two-handle range over them
  const DUR_BANDS = [/^under/i, /^15/, /^30/, /^over/i];
  const durBands = () => DUR_BANDS.map((re) => (catalog.byCat.duration || []).find((v) => re.test(v.name))).filter(Boolean);
  const DUR_TICKS = ["0 s", "15 s", "30 s", "60 s", "60 s+"];
  function durRange() {
    const bands = durBands(), on = bands.map(isOn);
    if (!on.some(Boolean)) return [0, bands.length];
    return [on.indexOf(true), on.lastIndexOf(true) + 1];
  }
  const durLabel = ([a, b], n) => (a === 0 && b === n ? tx("Any") : b === n ? `${DUR_TICKS[a]}+` : a === 0 ? `< ${DUR_TICKS[b]}` : `${DUR_TICKS[a]} – ${DUR_TICKS[b]}`);
  function durationHtml() {
    const bands = durBands();
    if (bands.length < 2) return "";
    const n = bands.length, [a, b] = durRange(), open = ui.open === "duration", mx = Math.max(1, ...bands.map(countOf));
    const set = !(a === 0 && b === n);
    return `<div class="lf-row lf-row-gap lf-dur${open ? " is-open" : ""}" data-lf-rowbox="duration">
      <button class="lf-rh" type="button" aria-expanded="${open}" data-lf-row="duration">${svg("clock")}<span class="lf-t">${esc(tx(CAT_LABEL.duration))}</span><span class="lf-v${set ? " is-set" : ""}" data-dur-v>${esc(durLabel([a, b], n))}</span>${svg("chev", "lf-chev")}</button>
      <div class="lf-rb"${open ? "" : " hidden"}>
        <div class="lf-hist" aria-hidden="true">${bands.map((v, i) => `<i class="${i >= a && i < b ? "is-in" : ""}" style="height:${Math.max(6, (countOf(v) / mx) * 100)}%" title="${esc(pretty(v.name))} · ${kfmt(countOf(v))}"></i>`).join("")}</div>
        <div class="lf-rng"><div class="lf-tr"></div><div class="lf-fl" style="left:${(a / n) * 100}%;right:${100 - (b / n) * 100}%"></div>
          <input type="range" min="0" max="${n}" step="1" value="${a}" aria-label="${esc(tx("Shortest"))}" data-dur-lo><input type="range" min="0" max="${n}" step="1" value="${b}" aria-label="${esc(tx("Longest"))}" data-dur-hi></div>
        <div class="lf-rl lf-dur-ticks">${DUR_TICKS.slice(0, n + 1).map((t) => `<span>${t}</span>`).join("")}</div>
      </div></div>`;
  }

  function platformHtml() {
    const pfs = [...(catalog.byCat.platform || [])].sort((a, b) => (b.name.toLowerCase() === me.favPlatform) - (a.name.toLowerCase() === me.favPlatform));
    return `<div class="lf-tiles lf-tiles-3 lf-pf">${pfs.map((v) => {
      const k = v.name.toLowerCase();
      const inner = `${PLATFORM[k] ? pfLogo(k) : ""}<span>${esc(PLATFORM[k] || v.name)}</span>`;
      return `<button type="button" class="lf-tile lf-pf-${esc(k)}${isOn(v) ? " is-on" : ""}${countOf(v) === 0 && !isOn(v) ? " is-zero" : ""}" aria-pressed="${isOn(v)}" aria-label="${esc(v.name)}" title="${esc(v.name)}" data-facet="platform" data-id="${v.id}">${inner}</button>`;
    }).join("")}</div>`;
  }

  // Occasion → Matchday: a 3-step timeline (Before · Live · After), the result and the opponent
  function matchdayHtml() {
    const val = (cat, name) => (catalog.byCat[cat] || []).find((v) => v.name.toLowerCase() === name.toLowerCase());
    const phases = MATCHDAY.map((ph) => ({ ...ph, list: ph.vals.map(([cat, name]) => val(cat, name)).filter((v) => v && (countOf(v) > 0 || isOn(v))) })).filter((ph) => ph.list.length);
    if (!phases.length && !has("outcome") && !has("opponent")) return "";
    const nOn = (ph) => ph.list.filter(isOn).length;
    let cur = phases.find((ph) => ph.key === ui.phase) || phases.find(nOn) || phases[0];
    const chip = (v) => `<button type="button" class="lf-chip${isOn(v) ? " is-on" : ""}" aria-pressed="${isOn(v)}" data-facet="${v.category}" data-id="${v.id}">${esc(pretty(v.name))}<em>${kfmt(countOf(v))}</em></button>`;
    const results = (catalog.byCat.outcome || []).filter((v) => countOf(v) > 0 || isOn(v));
    return `<div class="lf-md">
      <div class="lf-md-h">${svg("ball")}<b>Matchday</b><small>${esc(tx("Pick a moment of the game"))}</small></div>
      ${phases.length ? `<div class="lf-md-steps" role="tablist" style="--n:${phases.length}">${phases.map((ph) => `<button type="button" role="tab" aria-selected="${ph === cur}" class="${ph === cur ? "is-cur" : ""}${nOn(ph) ? " has-on" : ""}" data-md-phase="${ph.key}"><i></i><span>${esc(ph.label)}</span>${nOn(ph) ? `<em>${nOn(ph)}</em>` : ""}</button>`).join("")}</div>
      <div class="lf-chips lf-md-chips">${cur.list.map(chip).join("")}</div>` : ""}
      ${results.length ? `<div class="lf-sub">Result</div><div class="lf-chips lf-md-res">${results.map(chip).join("")}</div>` : ""}
      ${has("opponent") || has("matchday_graphic") ? `<div class="lf-stack lf-md-opp">${has("opponent") ? rowHtml(CAT.opponent) : ""}${has("matchday_graphic") ? rowHtml({ ...CAT.matchday_graphic, label: "All matchday graphics" }) : ""}</div>` : ""}
    </div>`;
  }
  function groupHtml(sec) {
    const cats = CATEGORIES.filter((c) => c.sec === sec && has(c.key) && !(sec === "occasion" && ["matchday_graphic", "outcome", "opponent"].includes(c.key)));
    const top = cats.filter((c) => !c.more), rest = cats.filter((c) => c.more);
    // a hidden row with a selection (or open) stays reachable: the "+N more" group opens itself
    const expanded = ui.more.has(sec) || rest.some((c) => selected[c.key].size || ui.open === c.key);
    return `<div class="lf-stack">${top.map((c) => rowHtml(c)).join("")}${rest.length ? `<div class="lf-more-rows"${expanded ? "" : " hidden"}>${rest.map((c) => rowHtml(c)).join("")}</div><button type="button" class="lf-morebtn" data-lf-more="${sec}">${expanded ? "Show fewer" : `+${rest.length} more`}</button>` : ""}</div>`;
  }

  // ---------- Section order of the filter column ----------
  const DEFAULT_ORDER = ["discover", "occasion", "goal", "where", "benchmark"];

  const valByName = (cat, name) => (catalog.byCat[cat] || []).find((v) => v.name.toLowerCase() === name.toLowerCase());

  // ---------- "Clubs like mine": the member's competitions (or sports) from the profile ----------
  function likeMineIds() {
    const comp = (me.likeMine.competitions || []).filter((id) => catalog.byId.get(id)?.category === "competition");
    if (comp.length) return { cat: "competition", ids: comp };
    const sp = (me.likeMine.sports || []).filter((id) => catalog.byId.get(id)?.category === "sport");
    return sp.length ? { cat: "sport", ids: sp } : null;
  }
  function likeMineHtml() {
    const l = likeMineIds();
    if (!l) return `<a class="lf-like" href="profile.html#favourites">${svg("shield")}<span><b>Clubs like mine</b><small>Add your sport and competition in your profile</small></span></a>`;
    const on = l.ids.every((id) => selected[l.cat].has(id));
    const names = l.ids.map((id) => pretty(catalog.byId.get(id).name));
    return `<button type="button" class="lf-like${on ? " is-on" : ""}" aria-pressed="${on}" data-like-mine>${svg("shield")}<span><b>Clubs like mine</b><small>${esc(names.slice(0, 2).join(", "))}${names.length > 2 ? ` +${names.length - 2}` : ""}</small></span>${svg("check", "lf-sp-ck")}</button>`;
  }
  function toggleLikeMine() {
    const l = likeMineIds();
    if (!l) return;
    const on = l.ids.every((id) => selected[l.cat].has(id));
    l.ids.forEach((id) => (on ? selected[l.cat].delete(id) : selected[l.cat].add(id)));
    renderFacets(); load(true);
  }

  // ---------- Content Plan → what to look for: the next 10 days of the member's plan ----------
  let planHints = null;
  const HINT_WORDS = [
    [/\b(derb[iy]|clasico|classic)\b/, "season_moment", "Derby"], [/\b(final)\b/, "season_moment", "Cup final"],
    [/\b(fitxatge|fichaje|signing|welcome|bienvenid|benvingut)/, "transfer", "Signing"], [/\b(renova|renewal)/, "transfer", "Renewal"],
    [/\b(samarreta|camiseta|equipaci|kit|jersey)/, "kit", "Home kit"], [/\b(aniversari|cumplea|birthday)/, "moment", "Birthday"],
    [/\b(nadal|navidad|christmas|xmas)/, "moment", "Christmas"], [/\b(alineaci|onze|lineup|line-up|xi)\b/, "matchday_graphic", "Starting XI"],
    [/\b(convocat|squad)/, "matchday_graphic", "Squad list"], [/\b(entrades|entradas|tickets?)\b/, "goal", "Ticket sales"],
    [/\b(partit|partido|match|matchday|vs|jornada)\b/, "moment", "Matchday preview"],
  ];
  const fold = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  async function loadPlanHints() {
    if (planHints || !db) return;
    planHints = [];
    const today = new Date(), end = new Date(Date.now() + 10 * 864e5);
    const d = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    const { data } = await db.from("org_entries").select("entry_date,label,notes").gte("entry_date", d(today)).lte("entry_date", d(end)).order("entry_date").limit(60);
    for (const e of data || []) {
      const t = fold(`${e.label || ""} ${e.notes || ""}`).replace(/^idea:/, "");
      if (/^idea: /.test(fold(e.label))) continue;   // posts dragged from the library: nothing to look for
      for (const [re, cat, name] of HINT_WORDS) {
        const v = valByName(cat, name);
        if (v && re.test(t) && !planHints.some((h) => h.v.id === v.id)) { planHints.push({ date: e.entry_date, label: e.label, v }); break; }
      }
      if (planHints.length >= 2) break;
    }
    if (planHints.length) renderFacets();
  }
  function planHintsHtml() {
    if (!planHints?.length) return "";
    const day = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString(window.SCP_LOC || "en-GB", { weekday: "short", day: "numeric", month: "short" });
    return planHints.map((h) => `<button type="button" class="lf-hint${isOn(h.v) ? " is-on" : ""}" data-facet="${h.v.category}" data-id="${h.v.id}">${svg("calendar")}<span><small>${esc(tx("In your Content Plan"))} · ${esc(day(h.date))}</small><b>${esc(h.label || "")}</b><em>${esc(tx("See {what}", { what: pretty(h.v.name) }))}</em></span></button>`).join("");
  }

  // ---------- Occasion and Goal, grouped the way a club plans ----------
  function rowsOf(keys) { return keys.filter((k) => CAT[k] && has(k)).map((k) => rowHtml(CAT[k])).join(""); }
  function occasionHtml() {
    const groups = [["Transfer market", ["transfer"]], ["Launches", ["kit"]], ["Season", ["season_moment"]], ["Campaigns", ["moment"]]];
    const commsOpen = ui.more.has("occasion") || ["comms", "crisis"].some((k) => selected[k]?.size || ui.open === k);
    const comms = ["comms", "crisis"].filter(has);
    return planHintsHtml() + matchdayHtml()
      + groups.map(([label, keys]) => { const r = rowsOf(keys); return r ? `<div class="lf-grp"><div class="lf-sub">${esc(tx(label))}</div><div class="lf-stack">${r}</div></div>` : ""; }).join("")
      + (occasionOn() || selected.angle?.size ? toneRowHtml() : "")
      + (comms.length ? `<div class="lf-grp"><div class="lf-more-rows lf-stack"${commsOpen ? "" : " hidden"}><div class="lf-sub">${esc(tx("Communication"))}</div>${rowsOf(comms)}</div><button type="button" class="lf-morebtn" data-lf-more="occasion">${commsOpen ? "Show fewer" : esc(tx("Press and sensitive topics"))}</button></div>` : "");
  }
  // Tone: "How do you tell it?" — a dropdown that appears once an occasion is chosen, each tone with the cover of
  // its most viewed post for the current filters (loaded when the dropdown opens)
  const OCCASION_KEYS = ["matchday_graphic", "outcome", "opponent", "transfer", "kit", "season_moment", "moment", "comms", "crisis", "campaign"];
  const occasionOn = () => OCCASION_KEYS.some((k) => selected[k]?.size);
  const TONE_ICON = { "player-focused": "👤", "humour / meme": "😂", emotional: "❤️", "data & stats": "📊", "behind the scenes": "🎬", "skills / tutorial": "🎯", celebration: "🎉" };
  const toneIcon = (v) => TONE_ICON[v.name.toLowerCase()] || "✨";
  const toneThumbs = new Map();
  let toneKey = "";
  function toneRowHtml() {
    const tones = byCount((catalog.byCat.angle || []).filter((v) => countOf(v) > 0 || isOn(v)));
    if (!tones.length) return "";
    const open = ui.open === "angle", sel = tones.filter(isOn);
    const val = sel.length ? `${toneIcon(sel[0])} ${esc(pretty(sel[0].name))}${sel.length > 1 ? ` +${sel.length - 1}` : ""}` : esc(tx("Any"));
    return `<div class="lf-grp lf-tone-grp"><div class="lf-row${open ? " is-open" : ""}" data-lf-rowbox="angle">
      <button class="lf-rh" type="button" aria-expanded="${open}" data-lf-row="angle">${svg("smile")}<span class="lf-t">${esc(tx("How do you tell it?"))}</span>${sel.length ? `<span class="lf-badge">${sel.length}</span>` : ""}<span class="lf-v${sel.length ? " is-set" : ""}">${val}</span>${svg("chev", "lf-chev")}</button>
      <div class="lf-rb"${open ? "" : " hidden"}><div class="lf-tones">${tones.map((v) => {
        const img = toneThumbs.get(v.id);
        return `<button type="button" class="lf-tone${isOn(v) ? " is-on" : ""}${countOf(v) === 0 && !isOn(v) ? " is-zero" : ""}" aria-pressed="${isOn(v)}" data-facet="angle" data-id="${v.id}">
          <span class="lf-tone-img" data-tone-img="${v.id}">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ""}<i>${toneIcon(v)}</i></span>
          <span class="lf-tone-tx"><b>${esc(pretty(v.name))}</b><small>${esc(tx("{n} posts", { n: kfmt(countOf(v)) }))}</small></span></button>`;
      }).join("")}</div></div></div></div>`;
  }
  async function loadToneThumbs() {
    if (ui.open !== "angle") return;
    const base = state();
    const key = JSON.stringify({ ...base, facets: { ...base.facets, angle: [] } });
    if (key === toneKey) return;
    toneKey = key; toneThumbs.clear();
    const tones = (catalog.byCat.angle || []).filter((v) => countOf(v) > 0);
    for (let i = 0; i < tones.length; i += 2) {   // two at a time: these are full library queries
      await Promise.all(tones.slice(i, i + 2).map(async (v) => {
        const args = queryArgs({ ...base, facets: { ...base.facets, angle: [v.id] } });
        const { data } = await fetchIdeas({ ...args, p_order: "views", p_seed: "", p_ids: null, p_limit: 1, p_offset: 0 }).catch(() => ({}));
        const url = data?.data?.[0]?.cover_url;
        if (key !== toneKey || !url) return;
        toneThumbs.set(v.id, url);
        const box = $(`[data-tone-img="${v.id}"]`);
        if (box && !box.querySelector("img")) box.insertAdjacentHTML("afterbegin", `<img src="${esc(url)}" alt="" loading="lazy">`);
      }));
      if (key !== toneKey) return;
    }
  }
  function goalHtml() {
    const top = rowsOf(["goal"]);   // no "Call to action"
    const sp = rowsOf(["sponsor", "sponsor_sector", "collab"]);   // no "Integration"
    return (top ? `<div class="lf-grp"><div class="lf-stack">${top}</div></div>` : "")
      + (sp ? `<div class="lf-md lf-spons"><div class="lf-md-h">${svg("tag")}<b>${esc(tx("Sponsors"))}</b><small>${esc(tx("How other clubs activate their partners"))}</small></div><div class="lf-stack">${sp}</div></div>` : "");
  }

  function renderFacets() {
    const parts = {
      discover: (has("trend") || views.hist) && discoverHtml(),
      occasion: !LAYOUT_BEFORE && (CATEGORIES.some((c) => c.sec === "occasion" && has(c.key))) && (can("library.matchday") ? occasionHtml() : lockedHtml("library.matchday")),
      goal: !LAYOUT_BEFORE && CATEGORIES.some((c) => c.sec === "goal" && has(c.key)) && (can("library.brands") ? goalHtml() : lockedHtml("library.brands")),
      where: !LAYOUT_BEFORE && (has("platform") || has("format")) && `${has("platform") ? `<div class="lf-grp">${platformHtml()}</div>` : ""}${has("format") || has("aspect_ratio") || has("duration") || has("language") ? `<div class="lf-grp">${formatHtml()}</div>` : ""}`,
      benchmark: !LAYOUT_BEFORE && CATEGORIES.some((c) => c.sec === "benchmark" && has(c.key)) && likeMineHtml() + groupHtml("benchmark"),
      format: (has("format") || has("aspect_ratio") || has("duration") || has("language")) && formatHtml(),
      platform: has("platform") && platformHtml(),
      explore: CATEGORIES.some((c) => c.sec === "explore" && has(c.key)) && groupHtml("explore"),
      content: CATEGORIES.some((c) => c.sec === "content" && has(c.key)) && groupHtml("content"),
      brands: CATEGORIES.some((c) => c.sec === "brands" && has(c.key)) && groupHtml("brands"),
    };
    const ai = (s) => s.ai && CATEGORIES.some((c) => c.sec === s.key && c.key !== "campaign" && has(c.key))
      ? ` <span class="lf-ai" tabindex="0" data-tip="${esc(AI_TIP)}">AI <b>?</b></span>` : "";
    const ord = LAYOUT_BEFORE ? null : DEFAULT_ORDER;
    const secs = SECTIONS.filter((s) => parts[s.key]).sort((a, b) => (ord ? ord.indexOf(a.key) - ord.indexOf(b.key) : 0));
    const inBar = barMode() ? secs.filter((s) => BAR_SECS.includes(s.key)).sort((a, b) => BAR_SECS.indexOf(a.key) - BAR_SECS.indexOf(b.key)) : [];
    renderBar(inBar, parts);
    const colSecs = secs.filter((s) => !inBar.includes(s));
    const box = $("[data-facets]");
    const scroll = $("[data-lf-body]").scrollTop;
    const NO_TITLE = new Set(["discover", "where"]); // these column sections show their filters with no title
    box.innerHTML = colSecs.map((s) => `<section class="lf-sec${LAYOUT_BEFORE ? "" : " lf-sec-v2"}" data-lf-sec="${s.key}">${NO_TITLE.has(s.key) ? "" : `<h2 class="lf-lbl">${esc(s.label)}${ai(s)}</h2>${s.q ? `<p class="lf-q">${esc(s.q)}</p>` : ""}`}${parts[s.key]}</section>`).join("");
    $("[data-lf-body]").scrollTop = scroll;
    $("[data-lf-jump]").innerHTML = colSecs.map((s) => `<button type="button" data-lf-jump-to="${s.key}">${esc(s.jump || s.label.replace(" by", ""))}</button>`).join("");
    renderQuick();
    fadeEdges();
    loadToneThumbs();
  }

  // ---------- Bar panels (wide screens): the section's groups on the left, their options as cards on the right ----------
  // Each option shows the cover of its most viewed post (supabase/value-covers.sql); clubs, competitions and sponsors
  // show their logo, sports their icon. A search box looks through every group; the footer lists what's chosen.
  const BAR_GROUPS = {
    occasion: [
      { key: "matchday", label: "Matchday", ico: "ball", desc: "" },
      { key: "transfer", label: "Transfer market", ico: "swap", desc: "Signings, renewals and farewells", cats: ["transfer"] },
      { key: "kit", label: "Kit launches", ico: "shirt", desc: "Shirts and collections", cats: ["kit"] },
      { key: "season_moment", label: "Season", ico: "flag", desc: "The big moments of the year", cats: ["season_moment"] },
      { key: "moment", label: "Dates & campaigns", ico: "star", desc: "Records, tributes and birthdays", cats: ["moment"],
        skip: ["christmas", "halloween", "black friday", "valentine's day", "pride", "ramadan / eid", "international women's day", "lunar new year", "new year"] },   // no calendar holidays
      { key: "angle", label: "How do you tell it?", ico: "smile", desc: "The tone of the post", cats: ["angle"], skip: ["player-focused"] },   // → Players
      { key: "comms", label: "Press and comms", ico: "message", desc: "Announcements, press and practical info", cats: ["comms"] },
      { key: "crisis", label: "Sensitive topics", ico: "alert", desc: "How other clubs handle them, with care", cats: ["crisis"] },
      { key: "design", label: "Graphic design", ico: "image", desc: "Matchday graphics, posters and cards", vals: [["campaign", "Graphic Design"]] },
    ],
    goal: [
      // Sponsors: the brands · how they show (what was Inspiration → Sponsors) · the goal
      // the brands' own accounts (was Inspiration → Brands) as a chip above the sponsors' logos
      { key: "sponsor", label: "Brands", ico: "tag", desc: "", cats: ["sponsor"], logos: true, head: "The brands", chips: [["entity", "Brand", "Brand accounts"]] },
      { key: "sponsor_sector", label: "Sponsor sector", ico: "briefcase", desc: "Partners by industry", cats: ["sponsor_sector"] },
      { key: "sponsors", label: "How the brand shows", ico: "badge", desc: "Logo on a graphic, giveaway, a creator with a brand…", vals: [["collab", "Brand collab"], ["sponsor_integration", null]], head: "How they show" },
      { key: "collab", label: "Collaborations", ico: "users", desc: "Posts made with others", cats: ["collab"], skip: ["brand collab", "player collab", "influencer / creator", "athlete takeover"] },   // Player collab → Players; the last two dropped
      { key: "goal", label: "Business goal", ico: "target", desc: "What the post should achieve", cats: ["goal"], head: "What for" },
    ],
    benchmark: [
      { key: "sport", label: "Sport", ico: "ball", desc: "", cats: ["sport"], tiles: true, head: "Where it's played", chips: [["campaign", "Player Appearance", "Players"]] },   // Players: a chip in Sport, Competition and Club
      { key: "competition", label: "Competition", ico: "trophy", desc: "Leagues and cups", cats: ["competition"], logos: true, chips: [["campaign", "Player Appearance", "Players"]] },
      { key: "club", label: "Club", ico: "shield", desc: "", cats: ["club"], logos: true, chips: [["campaign", "Player Appearance", "Players"]] },
      // vals: [category, name] (every value of the category when name is null)
      { key: "memes", label: "Memes", ico: "smile", desc: "Meme accounts and humour pages", vals: [["entity", "Meme"]], head: "What's published" },
      { key: "media", label: "Media", ico: "megaphone", desc: "What sports media publish", vals: [["entity", "Media"]], head: "Who publishes it" },
      // the club's squad (women's team, academy…) shows inside Club; cities only through the search box
      { key: "team", label: "Team", ico: "user", desc: "Women's team, academy, legends…", cats: ["team"], hidden: true },
      { key: "city", label: "City", ico: "pin", desc: "Clubs by city", cats: ["city"], logos: true, hidden: true },
    ],
  };
  const MD_IDS = () => new Set(MATCHDAY.flatMap((ph) => ph.vals.map(([c, n]) => valByName(c, n)?.id)).filter(Boolean));
  const live = (v) => countOf(v) > 0 || isOn(v);
  function groupVals(g) {
    if (g.vals) return g.vals.flatMap(([c, n]) => (n ? [valByName(c, n)] : catalog.byCat[c] || [])).filter((v) => v && live(v));
    if (g.key === "matchday") { const md = MD_IDS(); return [...[...md].map((id) => catalog.byId.get(id)), ...(catalog.byCat.matchday_graphic || []), ...(catalog.byCat.outcome || [])].filter((v, i, a) => v && a.indexOf(v) === i && live(v)); }
    const md = g.key === "moment" ? MD_IDS() : null;   // matchday previews / coverage live in Matchday
    return [...g.cats.flatMap((k) => (catalog.byCat[k] || []).filter((v) => live(v) && !(md && md.has(v.id)) && !g.skip?.includes(v.name.toLowerCase()) && !(k === "entity" && REPEATED.entity.includes(v.name.toLowerCase()) && !isOn(v)))),
      ...(g.plus || []).map(([c, n]) => valByName(c, n)).filter((v) => v && live(v))];
  }
  const groupsOf = (sec) => (BAR_GROUPS[sec] || []).filter((g) => groupVals(g).length || (g.key === "matchday" && has("opponent")));
  const covers = new Map();   // value id → cover url ("" = none)
  const hotOf = (list) => list.reduce((b, v) => (countOf(v) > countOf(b || v) || !b ? v : b), null);
  function lfpCard(v, g, hot) {
    const on = isOn(v), n = countOf(v);
    const st = `${on ? " is-on" : ""}${n === 0 && !on ? " is-zero" : ""}${n < 20 && !on ? " is-low" : ""}`;
    const meta = `<span class="lfp-meta"><b>${esc(pretty(v.name))}</b><small>${esc(tx("{n} posts", { n: kfmt(n) }))}</small></span><span class="lfp-ck">${svg("check")}</span>`;
    // competitions, clubs, brands: their logo, in a small tile
    if (g.logos) return `<button type="button" class="lfp-logo${st}" aria-pressed="${on}" data-facet="${v.category}" data-id="${v.id}">${v.logo ? `<span class="lfp-lg${v.ig ? " is-photo" : ""}"><img src="${esc(v.logo)}" alt="" loading="lazy"></span>` : `<span class="lfp-lg"><b>${esc(initials(v.name))}</b></span>`}${meta}</button>`;
    // sports: a small button with the sport's icon (no cover photo)
    if (g.tiles) return `<button type="button" class="lfp-sport${st}" aria-pressed="${on}" data-facet="${v.category}" data-id="${v.id}"><span class="lfp-sp-ic">${svg(sportIco(v.name))}</span>${meta}</button>`;
    const c = covers.get(v.id);
    const ph = g.logos && v.logo ? `<img class="lfp-img-logo" src="${esc(v.logo)}" alt="" loading="lazy">` : svg(g.tiles ? sportIco(v.name) : g.ico);
    return `<button type="button" class="lfp-card${st}" aria-pressed="${on}" data-facet="${v.category}" data-id="${v.id}">
      <span class="lfp-img${c === undefined ? " is-loading" : ""}" data-cover="${v.id}"${c ? ` style="background-image:url('${esc(c)}')"` : ""}>${c ? "" : ph}</span>${hot ? `<span class="lfp-hot">${esc(tx("Popular"))}</span>` : ""}${meta}</button>`;
  }
  const lfpCards = (list, g, max = 0) => { const l = byCount(list), shown = max ? [...l.slice(0, max), ...l.slice(max).filter(isOn)] : l, hot = l.length > 2 ? l[0] : null;
    return `<div class="lfp-cards${g.logos ? " lfp-cards-logo" : g.tiles ? " lfp-cards-sport" : ""}">${shown.map((v) => lfpCard(v, g, v === hot && !g.logos && !g.tiles)).join("")}</div>`; };
  function lfpMatchday(g) {
    const phases = MATCHDAY.map((ph) => ({ ...ph, list: ph.vals.map(([cat, name]) => valByName(cat, name)).filter((v) => v && live(v)) })).filter((ph) => ph.list.length);
    const nOn = (ph) => ph.list.filter(isOn).length;
    const cur = phases.find((ph) => ph.key === ui.phase) || phases.find(nOn) || phases[0];
    const inPh = MD_IDS();
    const other = (catalog.byCat.matchday_graphic || []).filter((v) => live(v) && !inPh.has(v.id));
    const results = (catalog.byCat.outcome || []).filter(live);
    const DOT = { win: "#3ddc97", loss: "#ff6b6b", draw: "#b4c0d3" };
    return `${cur ? `<div class="lfp-phases" role="tablist">${phases.map((ph) => `<button type="button" role="tab" aria-selected="${ph === cur}" class="${ph === cur ? "is-on" : ""}${ph.key === "live" ? " is-live" : ""}" data-md-phase="${ph.key}"><i></i>${esc(tx(ph.label))}${nOn(ph) ? `<em>${nOn(ph)}</em>` : ""}</button>`).join("")}</div>${lfpCards(cur.list, g)}` : ""}
      ${results.length && (!cur || cur.key !== "before") ? `<p class="lfp-sub">${esc(tx("Result"))}</p><div class="lfp-chips">${results.map((v) => `<button type="button" class="lfp-chip${isOn(v) ? " is-on" : ""}" aria-pressed="${isOn(v)}" data-facet="outcome" data-id="${v.id}"><i style="background:${DOT[v.name.toLowerCase()] || "#b4c0d3"}"></i>${esc(pretty(v.name))}<em>${kfmt(countOf(v))}</em></button>`).join("")}</div>` : ""}
      ${has("opponent") ? `<p class="lfp-sub">${esc(tx("Opponent"))}</p><div class="lf-stack lfp-opp">${rowHtml(CAT.opponent)}</div>` : ""}
      ${other.length ? `<p class="lfp-sub">${esc(tx("More matchday graphics"))}</p>${lfpCards(other, g)}` : ""}`;
  }
  // a group with a single option (Memes, Media): choosing the group applies it; the panel shows it switched on
  function lfpSingle(v) {
    const on = isOn(v);
    return `<button type="button" class="lfp-single${on ? " is-on" : ""}" aria-pressed="${on}" data-facet="${v.category}" data-id="${v.id}"><span class="lfp-ck">${svg("check")}</span>
        <span><b>${esc(tx(on ? "Filter on" : "Turn the filter on"))}</b><small>${esc(tx("{n} posts", { n: kfmt(countOf(v)) }))}</small></span></button>`;
  }
  function lfpMain(sec) {
    const groups = groupsOf(sec);
    const q = fold(ui.barQ || "");
    if (q) {
      const hits = groups.map((g) => [g, groupVals(g).filter((v) => fold(v.name).includes(q) || fold(tx(pretty(v.name))).includes(q)).slice(0, 40)]).filter(([, l]) => l.length);
      return hits.length ? hits.map(([g, l]) => `<p class="lfp-sub">${esc(tx(g.label))}</p>${lfpCards(l, g)}`).join("")
        : `<p class="lfp-none">${esc(tx("Nothing matches “{q}”.", { q: ui.barQ }))}</p>`;
    }
    const shown = groups.filter((x) => !x.hidden);
    const g = shown.find((x) => x.key === ui.barG?.[sec]) || shown[0];
    if (!g) return "";
    const total = groupVals(g).reduce((s, v) => s + (g.key === "matchday" && v.category === "outcome" ? 0 : countOf(v)), 0);
    const head = `<div class="lfp-head"><div><h3>${esc(tx(g.label))}</h3></div>${total ? `<span>${esc(tx("{n} posts", { n: total.toLocaleString(window.SCP_LOC || "en-GB") }))}</span>` : ""}</div>`;
    if (g.key === "matchday") return head + lfpMatchday(g);
    if (g.vals?.length === 1 && groupVals(g).length === 1) return head + lfpSingle(groupVals(g)[0]);
    // Club: the squad as quick chips above the clubs
    const teamG = g.key === "club" && groups.find((x) => x.key === "team");
    // chips above the options: the club's squad (Club), Players (Sport, Competition, Club), the brands' own accounts
    // (Brands). They stay in place; one that the chosen filters leave without posts is switched off (greyed, not clickable)
    const chip = (v, label) => { const on = isOn(v), off = countOf(v) === 0 && !on;
      return `<button type="button" class="lfp-chip${on ? " is-on" : ""}${off ? " is-off" : ""}" aria-pressed="${on}"${off ? ' disabled aria-disabled="true"' : ""} data-facet="${v.category}" data-id="${v.id}">${esc(label)}<em>${off ? "0" : kfmt(countOf(v))}</em></button>`; };
    // (the players' accounts are inside Players: supabase/players-merge.sql)
    const squadVals = teamG ? [...(catalog.byCat.team || [])].sort((x, y) => y.total - x.total) : [];
    const squad = squadVals.length ? `<div class="lfp-chips lfp-squad">${squadVals.map((v) => chip(v, pretty(v.name))).join("")}</div>` : "";
    const chipVals = (g.chips || []).map(([c, n, l]) => [valByName(c, n), l]).filter(([v]) => v);
    const chips = chipVals.length ? `<div class="lfp-chips lfp-squad">${chipVals.map(([v, l]) => chip(v, tx(l))).join("")}</div>` : "";
    const many = g.logos && groupVals(g).length > 20;
    return head + squad + chips + (g.key === "city" ? "" : lfpCards(groupVals(g), g, many ? 20 : 0))
      + (many || g.key === "city" ? `<p class="lfp-tip">${svg("search")}${esc(tx("Search above to find any of the {n}", { n: groupVals(g).length.toLocaleString(window.SCP_LOC || "en-GB") }))}</p>` : "");
  }
  function lfpTop(sec) {
    let pills = "";
    if (sec === "occasion" && planHints?.length) pills = planHints.map((h) => `<button type="button" class="lfp-pill${isOn(h.v) ? " is-on" : ""}" data-facet="${h.v.category}" data-id="${h.v.id}">${svg("calendar")}${esc(pretty(h.v.name))}</button>`).join("");
    // no "Popular" row: the options already show their posts; Match Day keeps the occasions of your Content Plan
    const lbl = "In your Content Plan";
    return `<label class="lfp-search">${svg("search")}<input type="search" data-lfb-q value="${esc(ui.barQ || "")}" placeholder="${esc(tx(sec === "occasion" ? "Search an occasion: derby, signing, birthday…" : sec === "goal" ? "Search a goal, a sponsor or a sector…" : "Search a sport, a competition, a club or a city…"))}" autocomplete="off"></label>
      ${pills ? `<div class="lfp-now"><span class="lfp-now-l">${svg("trend")}${esc(tx(lbl))}</span>${pills}</div>` : ""}`;
  }
  function lfpRail(sec) {
    return groupsOf(sec).filter((g) => !g.hidden).map((g) => {
      const n = groupVals(g).filter(isOn).length + (g.key === "matchday" ? selected.opponent.size : g.key === "moment" ? 0 : 0);
      const cur = !ui.barQ && (ui.barG?.[sec] || groupsOf(sec).find((x) => !x.hidden)?.key) === g.key;
      return `${g.head ? `<p class="lfp-rh">${esc(tx(g.head))}</p>` : ""}<button type="button" class="lfp-r${cur ? " is-on" : ""}" data-lfb-g="${g.key}"><span class="lfp-ric">${svg(g.ico)}</span><span class="lfp-rtx"><b>${esc(tx(g.label))}</b><small>${esc(groupVals(g).length === 1 ? tx("{n} posts", { n: kfmt(countOf(groupVals(g)[0])) }) : tx("{n} options", { n: groupVals(g).length }))}</small></span>${n ? `<em>${n}</em>` : ""}</button>`;
    }).join("");
  }
  // the options of the groups picked by name (Players, Sponsors, Media, Brands, Graphic design) that are on
  const valsOn = (sec) => [...groupsOf(sec).filter((g) => g.vals).flatMap(groupVals), ...groupsOf(sec).flatMap((g) => (g.chips || []).map(([c, n]) => valByName(c, n)))].filter((v) => v && isOn(v));
  const selOf = (sec) => [...new Set([...CATEGORIES.filter((c) => secOf(c) === sec).flatMap((c) => [...selected[c.key]].map((id) => catalog.byId.get(id)).filter(Boolean)), ...valsOn(sec)])];
  function lfpFoot(sec) {
    const sel = selOf(sec);
    return `<div class="lfp-sel">${sel.length ? sel.map((v) => `<span class="lfp-tag">${esc(pretty(v.name))}<button type="button" data-facet="${v.category}" data-id="${v.id}" aria-label="${esc(tx("Remove"))}">${icon("x")}</button></span>`).join("") : `<span class="lfp-hint">${esc(tx("Pick one or more options"))}</span>`}</div>
      ${sel.length ? `<button type="button" class="lfp-clear" data-lfb-clear="${sec}">${esc(tx("Clear"))}</button>` : ""}
      <button type="button" class="lfp-go lfp-go-foot" data-lfb-close>${esc(goLabel())}${icon("arrow-up-right")}</button>`;
  }
  // the "Show N posts" button at the foot of the panel, kept up to date with the count
  const goFoot = () => { const b = $(".lfp-go-foot"); if (b) b.innerHTML = `${esc(goLabel())}${icon("arrow-up-right")}`; };
  const goLabel = () => (ui.total == null ? tx("Show posts") : ui.total ? tx("Show {n} posts", { n: Number(ui.total).toLocaleString(window.SCP_LOC || "en-GB") }) : tx("No posts — change the filters"));
  const SEC_PERM = { occasion: "library.matchday", goal: "library.brands" };
  const lfpHtml = (sec) => SEC_PERM[sec] && !can(SEC_PERM[sec]) ? `<div class="lfp-locked">${lockedHtml(SEC_PERM[sec])}</div>` : `<div class="lfp-top">${lfpTop(sec)}</div><div class="lfp-body"><nav class="lfp-rail" aria-label="${esc(tx("Groups"))}">${lfpRail(sec)}</nav><div class="lfp-main" data-lfp-main>${lfpMain(sec)}</div></div><div class="lfp-foot">${lfpFoot(sec)}</div>`;
  const coverAsked = new Set();
  const coverUsed = new Set();   // the photos already given to a card
  let noTopCovers = false;       // value_covers_top not in Supabase yet: the old function only
  async function loadCovers() {
    const ids = [...new Set($$("[data-lfb-host] [data-cover]").map((el) => Number(el.dataset.cover)))].filter((id) => !coverAsked.has(id));
    if (!ids.length || !db) return;
    ids.forEach((id) => coverAsked.add(id));
    // three at a time, three requests in parallel: a big value (Football: 367k posts) is slow, a long list times out
    const parts = []; for (let i = 0; i < ids.length; i += 3) parts.push(ids.slice(i, i + 3));
    // several candidates per option (supabase/value-covers-top.sql): each card gets a photo no other card is using
    // (one post tagged Emotional, Argentina and Messi was the cover of all three); with only the old function, a cover
    // already used leaves that card with its icon
    const run = async () => { for (let part; (part = parts.shift()); ) {
      let { data, error } = noTopCovers ? { error: true } : await db.rpc("value_covers_top", { p_ids: part }).then((r) => r, () => ({ error: true }));
      if (error) { noTopCovers = true; ({ data } = await db.rpc("value_covers", { p_ids: part }).then((r) => r, () => ({}))); }
      part.forEach((id) => covers.set(id, ""));
      for (const r of data || []) {
        const pick = (r.covers || (r.cover ? [r.cover] : [])).find((c) => c && !coverUsed.has(c));
        if (pick) { coverUsed.add(pick); covers.set(Number(r.id), pick); }
      }
      for (const id of part) $$(`[data-cover="${id}"]`).forEach((el) => { el.classList.remove("is-loading"); const c = covers.get(id); if (c) { el.style.backgroundImage = `url('${c}')`; el.innerHTML = ""; } });
    } };
    await Promise.all([run(), run(), run()]);
  }

  // ---------- Bar above the posts (wide screens): one button per section, its filters in a wide panel ----------
  const secOf = (c) => (c.key === "angle" || c.key === "campaign" ? "occasion" : ["format", "platform"].includes(c.sec) ? "where" : c.sec);
  const BAR_ICON = { benchmark: "shield", occasion: "flag", goal: "tag", discover: "trend", where: "grid" };
  function renderBar(list, parts) {
    const bar = $("[data-lf-bar]");
    if (!list.length) { bar.hidden = true; bar.innerHTML = ""; ui.bar = null; return; }
    const items = list.map((s) => ({ key: s.key, label: tx(s.label), q: s.q ? tx(s.q) : "", n: selOf(s.key).length, html: parts[s.key] }));
    if (!items.some((it) => it.key === ui.bar)) ui.bar = null;
    const open = items.find((it) => it.key === ui.bar);
    const keep = $(".lfp-main", bar)?.scrollTop || 0;
    bar.hidden = false;
    // one outlined capsule; the open section sits under a lens that glides between them. The capsule is built once and
    // then only updated (rebuilding it would cut the lens's movement short); the panel below is replaced.
    const oi = items.indexOf(open);
    const keys = items.map((it) => it.key).join();
    let row = $(".lfb-row", bar);
    if (!row || row.dataset.keys !== keys) {
      bar.innerHTML = `<div class="lfb-row lfb-glass" role="toolbar" aria-label="${esc(tx("Filters"))}" style="--n:${items.length}" data-keys="${keys}"><span class="lfb-lens"></span>${items.map((it) => `<button type="button" class="lfb-btn" data-lfb="${it.key}"><span class="lfb-ic">${svg(BAR_ICON[it.key] || "dots")}</span><span class="lfb-tx"><b>${esc(it.label)}</b></span><em hidden></em></button>`).join("")}</div><div data-lfb-host></div>`;
      row = $(".lfb-row", bar);
    }
    items.forEach((it, k) => {
      const b = row.querySelectorAll("[data-lfb]")[k], em = b.querySelector("em");
      b.classList.toggle("is-set", !!it.n); b.classList.toggle("is-open", open === it); b.setAttribute("aria-expanded", String(open === it));
      em.hidden = !it.n; em.textContent = it.n || "";
    });
    const lens = $(".lfb-lens", row);
    if (oi >= 0) {
      if (!lens.classList.contains("is-on")) { lens.style.transition = "none"; lens.style.setProperty("--x", oi); void lens.offsetWidth; lens.style.transition = ""; }   // appears where it is, then glides
      lens.style.setProperty("--x", oi);
    }
    lens.classList.toggle("is-on", oi >= 0);
    // the open panel is kept and only its content changes (a new panel would replay its opening animation on every
    // click inside it — the panel seemed to blink); a new panel only when another section opens
    const host = $("[data-lfb-host]", bar);
    const cur = $(".lfb-panel", host);
    if (!open) host.innerHTML = "";
    else if (cur && cur.dataset.sec === open.key) cur.innerHTML = lfpHtml(open.key);
    else host.innerHTML = `<div class="lfb-panel lfp" role="dialog" aria-label="${esc(open.label)}" data-sec="${open.key}">${lfpHtml(open.key)}</div>`;
    if (open) { $(".lfp-main", bar).scrollTop = keep; loadCovers(); fitPanel(bar); }
  }
  // computers: the open panel exactly under the tabs (their width, at least 640px, centred on them) instead of the whole head
  let fitBar = null;
  function fitPanel(bar = fitBar) {
    fitBar = bar;
    const p = bar && $(".lfb-panel", bar), row = bar && $(".lfb-row", bar);
    if (!p || !row || !p.offsetParent) return;
    if (innerWidth < 961) { p.style.left = p.style.right = ""; return; }
    const r = row.getBoundingClientRect(), op = p.offsetParent.getBoundingClientRect();
    const w = Math.min(op.width - 28, Math.max(640, r.width));
    const left = Math.min(Math.max(14, r.left - op.left - (w - r.width) / 2), op.width - 14 - w);
    p.style.left = `${Math.round(left)}px`; p.style.right = `${Math.round(op.width - left - w)}px`;
  }
  addEventListener("resize", () => fitPanel());

  // Mobile: the three specials as quick chips above the posts
  function renderQuick() {
    $("[data-lf-quick]").innerHTML = byCountStable((catalog.byCat.trend || []).filter(notTopPicks)).map((v) => {
      const s = special(v), on = isOn(v), zero = countOf(v) === 0 && !on;
      return `<button type="button" class="lf-q ${s.cls}${on ? " is-on" : ""}${zero ? " is-zero" : ""}" aria-pressed="${on}" data-facet="trend" data-id="${v.id}">${svg(s.ico)}${esc(pretty(v.name))}</button>`;
    }).join("");
  }

  // ---------- Top Picks / Replicable Ideas: a short explanation on hover, which can be closed for good ----------
  {
    let tipFor = null, hideT = null;
    const tip = document.createElement("div");
    tip.className = "lf-sp-pop"; tip.hidden = true; tip.setAttribute("role", "tooltip");
    document.body.append(tip);
    const closedKey = (id) => `scp-sp-tip2-${id}`;   // v2: the new explainer shows again even if the old one was closed
    const isClosed = (id) => { try { return localStorage.getItem(closedKey(id)) === "1"; } catch { return false; } };
    const hide = () => { tip.hidden = true; tipFor = null; };
    const show = (b) => {
        clearTimeout(hideT);
        if (tipFor === b && !tip.hidden) return;
        tipFor = b;
        if (b.dataset.id === "favs") return showFavs(b);
        const v = catalog.byId.get(Number(b.dataset.id)), sp = v ? special(v) : {};
        const n = v ? countOf(v) : 0;
        tip.className = `lf-sp-pop ${sp.cls || ""}`;
        tip.innerHTML = `
          <div class="sp-h"><span class="sp-ic">${svg(sp.ico || "star")}</span><b>${esc(pretty(v?.name || ""))}</b>
            <button class="sp-x" type="button" aria-label="${esc(tx("Close"))}" data-sp-close="${esc(b.dataset.id)}">${icon("x")}</button></div>
          <p class="sp-lead">${esc(tx(sp.lead || b.dataset.spTip))}</p>
          ${(sp.points || []).length ? `<ul>${sp.points.map((t) => `<li>${svg("check")}<span>${esc(tx(t))}</span></li>`).join("")}</ul>` : ""}
          <div class="sp-f"><span>${n ? tx("{n} posts", { n: kfmt(n) }) : ""}</span>
            <button class="sp-go" type="button" data-sp-go="${esc(b.dataset.id)}">${tx("Show them")} →</button></div>`;
        place(b);
    };
    const place = (b) => {
        const r = b.getBoundingClientRect();
        tip.hidden = false;
        // beside the button (the sidebar is narrow), or under it when there's no room on the right
        const roomRight = innerWidth - r.right > 300;
        tip.style.left = `${(roomRight ? r.right + 12 : r.left) + scrollX}px`;
        tip.style.top = `${(roomRight ? r.top - 6 : r.bottom + 8) + scrollY}px`;
        tip.classList.toggle("is-side", roomRight);
    };
    // Favs: what it does, what the profile already has (favourite profiles, network, sports / competitions) and a
    // direct link to complete the profile when something is missing
    const showFavs = (b) => {
        tipFor = b;
        const profiles = favVals().length, pf = favNetwork(), sports = (me.likeMine.sports || []).length + (me.likeMine.competitions || []).length;
        const rows = [
          [profiles > 0, tx("Favourite profiles"), profiles ? tx(profiles === 1 ? "{n} profile" : "{n} profiles", { n: profiles }) : tx("Not chosen yet")],
          [!!pf, tx("Favourite network"), pf ? pf.name : tx("Not chosen yet")],
          [sports > 0, tx("Sports and competitions"), sports ? tx(sports === 1 ? "1 chosen" : "{n} chosen", { n: sports }) : tx("Not chosen yet")],
        ];
        const full = rows.every(([ok]) => ok);
        tip.className = "lf-sp-pop lf-sp-top";
        tip.innerHTML = `
          <div class="sp-h"><span class="sp-ic">${svg("star")}</span><b>Favs</b>
            <button class="sp-x" type="button" aria-label="${esc(tx("Close"))}" data-sp-close="favs">${icon("x")}</button></div>
          <p class="sp-lead">${esc(tx("The posts of the profiles you follow, on your favourite network. You choose them in your profile."))}</p>
          <ul class="sp-status">${rows.map(([ok, k, v]) => `<li class="${ok ? "is-ok" : "is-miss"}">${svg(ok ? "check" : "alert")}<span><b>${esc(k)}</b> · ${esc(v)}</span></li>`).join("")}</ul>
          <div class="sp-f"><span>${esc(tx(full ? "Your profile is complete" : "Complete your profile to get better Favs"))}</span>
            ${full && profiles ? `<button class="sp-go" type="button" data-sp-go="favs">${tx("Show them")} →</button>` : `<a class="sp-go" href="profile.html#favourites">${esc(tx(profiles ? "Complete profile" : "Choose favourites"))} →</a>`}</div>`;
        place(b);
    };
    document.addEventListener("mouseover", (e) => {
      const b = e.target.closest(".lf-sp[data-sp-tip]");
      if (b && !isClosed(b.dataset.id)) show(b);
      else if (b && tipFor === b) clearTimeout(hideT);
      else if (tipFor && !e.target.closest(".lf-sp-pop")) { clearTimeout(hideT); hideT = setTimeout(hide, 250); }
    });
    // the ⓘ in the button opens it any time, also after it was closed
    document.addEventListener("click", (e) => {
      const i = e.target.closest("[data-sp-info]");
      if (!i) return;
      e.preventDefault(); e.stopPropagation();
      show(i.closest(".lf-sp"));
    }, true);
    tip.addEventListener("mouseenter", () => clearTimeout(hideT));
    tip.addEventListener("click", (e) => {
      const x = e.target.closest("[data-sp-close]");
      const go = e.target.closest("[data-sp-go]");
      if (go) { if (tipFor && !tipFor.classList.contains("is-on")) tipFor.click(); return hide(); }
      if (!x) return;
      try { localStorage.setItem(closedKey(x.dataset.spClose), "1"); } catch {}
      hide();
    });
    addEventListener("scroll", hide, { passive: true, capture: true });
  }

  // ---------- Interaction ----------
  function toggleValue(cat, id, force) {
    const set = selected[cat];
    const on = force ?? !set.has(id);
    on ? set.add(id) : set.delete(id);
    renderFacets();
    load(true);
  }
  function openRow(key, force) {
    ui.open = force || ui.open !== key ? key : null;
    const c = CAT[key];
    if (c?.more) ui.more.add(c.sec);
    renderFacets();
    if (ui.open) $(`[data-lf-rowbox="${CSS.escape(ui.open)}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  // ---------- Content Creators on: one row per creator (supabase/creator-rows.sql) ----------
  // photo, name, followers, recent collabs (the brands most tagged on their posts), their 4 most viewed posts;
  // the creators' filters (type, language, gender, country, followers, the search box) narrow the rows
  const crBox = $("[data-creators]");
  const cr = { rows: null, shown: 10, layout: (() => { try { return localStorage.getItem("scp-cr-layout") || "grid"; } catch { return "grid"; } })() };
  const LIST_ICO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/></svg>`;
  const crSwitch = () => `<div class="cr-switch" role="tablist">${[["creators", "Creators"], ["posts", "Posts"]].map(([k, l]) => `<button type="button" role="tab" aria-selected="${(ui.cview || "creators") === k}" class="${(ui.cview || "creators") === k ? "is-on" : ""}" data-cview-set="${k}">${esc(tx(l))}</button>`).join("")}</div>
    ${`<div class="cr-layout${(ui.cview || "creators") === "posts" ? " is-off" : ""}" role="group" aria-label="${esc(tx("Layout"))}">${[["grid", icon("layout-grid"), "Boxes"], ["list", LIST_ICO, "List"]].map(([k, ico, l]) => `<button type="button" class="${cr.layout === k ? "is-on" : ""}" aria-pressed="${cr.layout === k}"${(ui.cview || "creators") === "posts" ? " disabled" : ""} data-cr-layout="${k}" title="${esc(tx(l))}" aria-label="${esc(tx(l))}">${ico}</button>`).join("")}</div>`}`;
  function crMatch(r, q) {
    const low = (x) => String(x || "").trim().toLowerCase();
    const sel = (k) => [...selected[k]].map((id) => low(catalog.byId.get(id)?.name)).filter(Boolean);
    for (const [k, f] of [["creator_type", "type"], ["creator_language", "language"], ["creator_gender", "gender"], ["creator_country", "country"]]) { const s = sel(k); if (s.length && !s.includes(low(r[f]))) return false; }
    if (ui.fol && (r.followers == null || (ui.fol.min && r.followers < ui.fol.min) || (ui.fol.max && r.followers > ui.fol.max))) return false;
    return !q || low(r.handle).includes(low(q).replace(/^@/, "")) || low(r.name).includes(low(q));
  }
  const crTop = (r) => ((r.top || []).length ? r.top : r.latest || []).slice(0, 3);
  function crRow(r) {
    const k = `${r.platform}|${r.handle}`, name = r.name || r.handle;
    const ini = name.replace(/[^\p{L}\p{N} ]/gu, "").split(/[\s._]+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
    const brands = (r.collabs || []).map((id) => catalog.byId.get(Number(id))).filter(Boolean);
    const posts = crTop(r).map((id) => cache.get(String(id))).filter(Boolean);
    const star = starKeys().includes(k);
    return `<article class="cr-card">
      <header class="cr-top">
        <span class="cr-ava">${r.avatar ? `<img src="${esc(r.avatar)}" alt="" loading="lazy">` : `<b>${esc(ini)}</b>`}</span>
        <span class="cr-name"><b>${esc(name)}</b><small><i class="lf-pfi is-brand lf-pf-${esc(r.platform)}" style="-webkit-mask-image:url(assets/pf-${esc(r.platform)}.svg);mask-image:url(assets/pf-${esc(r.platform)}.svg)"></i>@${esc(r.handle)}</small></span>
        <span class="cr-stat"><b>${r.followers ? kfmt(r.followers) : "—"}</b><small>${esc(tx("Followers"))}</small></span>
        <span class="cr-collabs">${brands.length ? `<span class="cr-logos">${brands.map((v) => `<i title="${esc(pretty(v.name))}">${v.logo ? `<img src="${esc(v.logo)}" alt="" loading="lazy">` : esc(initials(v.name))}</i>`).join("")}</span>` : ""}<small>${esc(tx(brands.length ? "Recent collabs" : "No brand collabs yet"))}</small></span>
        <span class="cr-acts">
          <button type="button" class="lf-star${star ? " is-on" : ""}" data-acct-star="${esc(k)}" aria-pressed="${star}" aria-label="${esc(tx(star ? "Remove from favourites" : "Add to favourites"))}" title="${esc(tx(star ? "Remove from favourites" : "Add to favourites"))}">${svg("star")}</button>
          ${saveBtn(`cr-${k}`)}
          <button type="button" class="pill pill-gold cr-see" data-cr-posts="${esc(k)}">${esc(tx("See their posts"))}</button>
        </span>
      </header>
      <div class="cr-posts">${posts.map((p) => `<button type="button" class="cr-post${p.cover_url ? "" : " is-empty"}" data-open="${esc(p.id)}"${p.cover_url ? ` style="background-image:url('${esc(p.cover_url)}')"` : ""} aria-label="${esc(tx("Details"))}">${isVideo(p) ? `<span class="cr-vid">${icon("video")}</span>` : ""}</button>`).join("")}</div>
    </article>`;
  }
  async function renderCreators(my) {
    if (!cr.rows) {
      crBox.innerHTML = `<p class="cr-loading">${esc(tx("Loading creators…"))}</p>`;
      const { data } = await db.rpc("creator_rows").then((r) => r, () => ({}));
      if (my !== token) return;
      if (!Array.isArray(data)) { crBox.innerHTML = `<p class="posts-empty">${esc(tx("Creators can't be loaded right now."))}</p>`; return; }
      cr.rows = data;
    }
    const list = cr.rows.filter((r) => crMatch(r, state().q));
    const shown = list.slice(0, cr.shown);
    // their posts, as the grid has them (tags, cover), so a click opens the post's detail
    // creators whose posts have no stored cover yet (Instagram): their 3 latest posts
    await Promise.all(shown.filter((r) => !crTop(r).length && !r.latest).map(async (r) => {
      const { data } = await db.rpc("account_post_ids", { p_platform: r.platform, p_handle: r.handle }).then((x) => x, () => ({}));
      r.latest = (data || []).slice(0, 3);
    }));
    if (my !== token) return;
    const need = shown.flatMap(crTop).map(String).filter((id) => !cache.has(id));
    if (need.length) {
      const { data } = await fetchIdeas({ p_filters: {}, p_q: null, p_from: null, p_to: null, p_order: "latest", p_seed: "", p_ids: need.map(Number), p_limit: need.length, p_offset: 0 }).catch(() => ({}));
      (data?.data || []).forEach((p) => cache.set(String(p.id), p));
      if (my !== token) return;
    }
    crBox.innerHTML = list.length
      ? `<div class="cr-grid${cr.layout === "list" ? " is-list" : ""}">${shown.map(crRow).join("")}</div>`
      : `<p class="posts-empty">${esc(tx("No creators match these filters."))}</p>`;
    cr.more = list.length > shown.length;
  }
  // endless scroll (as the posts): 10 more creators a little before the end of the page
  async function moreCreators() {
    if (cr.busy || !cr.more || crBox.hidden) return;
    cr.busy = true;
    cr.shown += 10;
    await renderCreators(token);
    cr.busy = false;
    if (nearEnd) moreCreators();
  }
  crBox.addEventListener("click", async (e) => {
    const st = e.target.closest("[data-acct-star]");
    if (st) { await toggleStar(st.dataset.acctStar); return renderCreators(token); }
    const see = e.target.closest("[data-cr-posts]");
    if (see) { ui.cview = "posts"; window.scrollTo({ top: 0, behavior: "smooth" }); return toggleAccount(see.dataset.crPosts); }
  });

  // one creator account at a time: only its posts (their ids, then the other filters still apply)
  async function toggleAccount(k) {
    if (ui.acct?.key === k) ui.acct = null;
    else {
      const [platform, handle] = k.split("|");
      const { data } = await db.rpc("account_post_ids", { p_platform: platform, p_handle: handle });   // the query builder has no .catch
      ui.acct = { key: k, ids: (data || []).map(Number) };
    }
    renderFacets();
    load(true);
  }
  const column = $("[data-filters]");
  const filterBar = $("[data-lf-bar]");
  const onFilterClick = (e) => {
    // Content Creators: Creators / Posts, boxes / list (at the top of its box in the filters column)
    const lay = e.target.closest("[data-cr-layout]");
    if (lay) {
      cr.layout = lay.dataset.crLayout;
      try { localStorage.setItem("scp-cr-layout", cr.layout); } catch {}
      $(".cr-grid", crBox)?.classList.toggle("is-list", cr.layout === "list");
      return renderFacets();
    }
    const cv = e.target.closest("[data-cview-set]");
    if (cv) {
      if ((ui.cview || "creators") === cv.dataset.cviewSet) return;
      ui.cview = cv.dataset.cviewSet;
      if (ui.cview === "creators") ui.acct = null;
      renderFacets(); return load(true);
    }
    if (e.target.closest("[data-fol-clear]")) return setFollowers(0, FB);
    if (e.target.closest("[data-favs]")) {   // all the favourite profiles on / off
      const pf = favNetwork(), f = [...favVals(), ...(pf ? [pf] : [])], on = favsOn();
      f.forEach((v) => (on ? selected[v.category].delete(v.id) : selected[v.category].add(v.id)));
      renderFacets();
      return load(true);
    }
    const lfb = e.target.closest("[data-lfb]");
    if (lfb) { ui.bar = ui.bar === lfb.dataset.lfb ? null : lfb.dataset.lfb; ui.barQ = ""; return renderFacets(); }
    const grp = e.target.closest("[data-lfb-g]");
    if (grp) {
      ui.barG = { ...ui.barG, [ui.bar]: grp.dataset.lfbG }; ui.barQ = "";
      // a group with one option (Memes, Media): choosing it applies that filter straight away
      const g1 = groupsOf(ui.bar).find((x) => x.key === grp.dataset.lfbG), only = g1?.vals?.length === 1 && groupVals(g1).length === 1 ? groupVals(g1)[0] : null;
      if (only && !isOn(only)) { $(".lfp-main")?.scrollTo(0, 0); return toggleValue(only.category, only.id, true); }
      renderFacets(); $(".lfp-main")?.scrollTo(0, 0); return;
    }
    const clr = e.target.closest("[data-lfb-clear]");
    if (clr) { valsOn(clr.dataset.lfbClear).forEach((v) => selected[v.category].delete(v.id)); CATEGORIES.filter((c) => secOf(c) === clr.dataset.lfbClear).forEach((c) => selected[c.key].clear()); renderFacets(); return load(true); }
    if (e.target.closest("[data-lfb-close]")) { ui.bar = null; return renderFacets(); }
    const f = e.target.closest("[data-facet]");
    if (f) { if (f.getAttribute("aria-disabled") === "true") return; return toggleValue(f.dataset.facet, Number(f.dataset.id)); }
    const star = e.target.closest("[data-acct-star]");
    if (star) return toggleStar(star.dataset.acctStar);
    const ac = e.target.closest("[data-acct]");
    if (ac) return toggleAccount(ac.dataset.acct);
    const row = e.target.closest("[data-lf-row]");
    if (row) return openRow(row.dataset.lfRow);
    const all = e.target.closest("[data-lf-all]");
    if (all) { ui.all.add(all.dataset.lfAll); return renderFacets(); }
    const more = e.target.closest("[data-lf-more]");
    if (more) { const s = more.dataset.lfMore; ui.more.has(s) ? ui.more.delete(s) : ui.more.add(s); return renderFacets(); }
    if (e.target.closest("[data-like-mine]")) return toggleLikeMine();
    const ph = e.target.closest("[data-md-phase]");
    if (ph) { ui.phase = ph.dataset.mdPhase; return renderFacets(); }
    const vq = e.target.closest("[data-vq]");
    if (vq) { views.a = Number(vq.dataset.vq); views.b = VB; views.exact = null; renderFacets(); return load(true); }
    const jump = e.target.closest("[data-lf-jump-to]");
    if (jump) { const t = $(`[data-lf-sec="${jump.dataset.lfJumpTo}"]`); const b = $("[data-lf-body]"); b.scrollTo({ top: t.offsetTop - b.offsetTop, behavior: "smooth" }); $$("[data-lf-jump-to]").forEach((x) => x.classList.toggle("is-on", x === jump)); }
  };
  column.addEventListener("click", onFilterClick);
  filterBar.addEventListener("click", onFilterClick);
  // the panel closes with Esc or a click outside the bar (pointerdown: before a click re-renders the panel)
  document.addEventListener("pointerdown", (e) => { if (ui.bar && !e.target.closest("[data-lf-bar], .lf-sp-pop")) { ui.bar = null; renderFacets(); } });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && ui.bar) { const k = ui.bar; ui.bar = null; renderFacets(); $(`[data-lfb="${k}"]`)?.focus(); } });
  { let wasBar = barMode(); addEventListener("resize", () => { if (barMode() !== wasBar) { wasBar = barMode(); ui.bar = null; renderFacets(); } }); }
  // platform tiles: the glow follows the cursor
  const tileGlow = (e) => {
    const t = e.target.closest(".lf-pf .lf-tile");
    if (!t) return;
    const r = t.getBoundingClientRect();
    t.style.setProperty("--mx", `${e.clientX - r.left}px`);
    t.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  column.addEventListener("pointermove", tileGlow);
  filterBar.addEventListener("pointermove", tileGlow);
  $("[data-lf-quick]").addEventListener("click", (e) => { const f = e.target.closest("[data-facet]"); if (f && !f.classList.contains("is-zero")) toggleValue(f.dataset.facet, Number(f.dataset.id)); });
  // list searches re-render only their own list (keeps the focus while typing)
  const onFilterInput = (e) => {
    const aq = e.target.closest("[data-acct-q]");
    if (aq) { ui.acctQ = aq.value; const l = $("[data-acct-list]"); if (l) l.innerHTML = acctListHtml(); return; }
    const bq = e.target.closest("[data-lfb-q]");
    if (bq) { ui.barQ = bq.value.trim(); $("[data-lfp-main]").innerHTML = lfpMain(ui.bar); $(".lfp-rail").innerHTML = lfpRail(ui.bar); loadCovers(); return; }
    const s = e.target.closest("[data-facet-search]");
    if (s) {
      const k = s.dataset.facetSearch, pos = s.selectionStart;
      ui.q[k] = s.value;
      const box = $(`[data-lf-body-of="${k}"]`);
      box.innerHTML = listHtml(CAT[k]);
      const again = $(`[data-facet-search="${k}"]`, box);
      again.focus(); again.setSelectionRange(pos, pos);
      return;
    }
    const fo = e.target.closest("[data-fol-lo], [data-fol-hi]");
    if (fo) {
      const lo = $("[data-fol-lo]"), hi = $("[data-fol-hi]");
      let a = Number(lo.value), b = Number(hi.value);
      if (a > b - 1) { if (fo.matches("[data-fol-lo]")) a = b - 1; else b = a + 1; }
      lo.value = a = Math.max(0, a); hi.value = b = Math.min(FB, b);
      const box = fo.closest(".lf-fol-box");
      $$(".lf-hist i", box).forEach((x, i) => x.classList.toggle("is-in", i >= a && i < b));
      const fl = $(".lf-fl", box); fl.style.left = `${(a / FB) * 100}%`; fl.style.right = `${100 - (b / FB) * 100}%`;
      $("[data-fol-lo-l]").textContent = folLbl(a); $("[data-fol-hi-l]").textContent = folLbl(b);
      return;
    }
    const lo = e.target.closest("[data-views-lo], [data-views-hi]");
    if (lo) {
      let a = Number($("[data-views-lo]").value), b = Number($("[data-views-hi]").value);
      if (a > b - 1) { if (e.target.matches("[data-views-lo]")) a = b - 1; else b = a + 1; }
      views.a = Math.max(0, a); views.b = Math.min(VB, b); views.exact = null;
      $("[data-views-lo]").value = views.a; $("[data-views-hi]").value = views.b;
      $$('[data-lf-rowbox="views"] .lf-hist i').forEach((x, i) => x.classList.toggle("is-in", i >= views.a && i < views.b));
      const fl = $('[data-lf-rowbox="views"] .lf-fl'); fl.style.left = `${(views.a / VB) * 100}%`; fl.style.right = `${100 - (views.b / VB) * 100}%`;
      $("[data-views-lo-l]").textContent = kfmt(Math.round(vEdge(views.a)));
      $("[data-views-hi-l]").textContent = views.b === VB ? `${kfmt(Math.round(vEdge(VB)))}+` : kfmt(Math.round(vEdge(views.b)));
      const v = $("[data-views-v]"); v.textContent = viewsLabel(); v.classList.toggle("is-set", viewsSet());
      $$(".lf-vq button").forEach((x) => x.classList.toggle("is-on", views.b === VB && Number(x.dataset.vq) === views.a));
    }
    const dr = e.target.closest("[data-dur-lo], [data-dur-hi]");
    if (dr) {
      const box = dr.closest(".lf-dur"), bands = durBands(), n = bands.length;
      const lo = $("[data-dur-lo]", box), hi = $("[data-dur-hi]", box);
      let a = Number(lo.value), b = Number(hi.value);
      if (a > b - 1) { if (dr === lo) a = b - 1; else b = a + 1; }
      a = Math.max(0, a); b = Math.min(n, b); lo.value = a; hi.value = b;
      // the bands inside the range become the selected Length values (all of them = no filter); the change event reloads
      selected.duration = new Set(a === 0 && b === n ? [] : bands.slice(a, b).map((v) => v.id));
      $$(".lf-hist i", box).forEach((x, i) => x.classList.toggle("is-in", i >= a && i < b));
      const fl = $(".lf-fl", box); fl.style.left = `${(a / n) * 100}%`; fl.style.right = `${100 - (b / n) * 100}%`;
      const v = $("[data-dur-v]", box); v.textContent = durLabel([a, b], n); v.classList.toggle("is-set", !(a === 0 && b === n));
    }
  };
  column.addEventListener("input", onFilterInput);
  // Followers' slider: moves live (input), filters when let go (change)
  column.addEventListener("change", (e) => {
    if (!e.target.closest("[data-fol-lo], [data-fol-hi]")) return;
    setFollowers(Number($("[data-fol-lo]").value), Number($("[data-fol-hi]").value));
  });
  filterBar.addEventListener("input", onFilterInput);

  // ---------- Search a sentence: "reels de fitxatges amb sponsor que hagin funcionat" → filters ----------
  // Free: it only reads the tags the AI already put on every post. A dictionary (CA / ES / EN) maps words to filter
  // values; club, competition, sponsor, city and opponent names are matched against the catalog itself.
  // Values of one filter are combined with "or", different filters with "and" (like clicking them).
  const SYN = [
    ["format", "Reel", "reels?"], ["format", "Carousel", "carrusel(s|es)?|carousels?"], ["format", "Shorts", "shorts?"], ["format", "Image", "fotos?|imatges?|imagen(es)?|images?|photos?"], ["format", "Video", "videos?"],
    ["platform", "Instagram", "instagram|insta"], ["platform", "TikTok", "tiktok"], ["platform", "YouTube", "youtube"], ["platform", "X", "twitter"], ["platform", "Facebook", "facebook"],
    ["trend", "Overperforming", "(hagin |han |que )?funciona(t|n|do|ron)?|worked|work well|virals?|virales|exit(o|os)?|overperform\\w*|took off"],
    ["trend", "Top Picks", "millors|mejores|best|top picks?"],
    ["trend", "Replicable ideas", "facils?|faciles|easy|pocs recursos|pocos recursos|low budget|sense produccio|sin produccion|replicables?"],
    ["transfer", "Signing", "fitxatges?|fichajes?|signings?|presentacio de jugador|nou jugador|nuevo jugador"], ["transfer", "Renewal", "renovaci(o|on)(ns|nes)?|renewals?"],
    ["transfer", "Loan", "cessi(o|ons)|cesi(on|ones)|loans?"], ["transfer", "Departure", "comiat|despedidas?|farewells?"],
    ["kit", "*", "samarretes?|camisetas?|equipaci(o|on)(ns|nes)?|kits?|jerseys?"],
    ["season_moment", "Derby", "derbi|derby|derbis|clasico"], ["season_moment", "Cup final", "final de copa|cup final"], ["season_moment", "Title celebration", "titols?|titulos?|campio|campeon(es)?|title|lliga guanyada"],
    ["season_moment", "Pre-season", "pretemporada|pre-?season"], ["season_moment", "Promotion", "ascens|ascenso|promotion"], ["season_moment", "Relegation", "descens|descenso|relegation"],
    ["matchday_graphic", "Starting XI", "alineaci(o|on)(ns|es)?|onze inicial|once inicial|line-?ups?|starting xi"], ["matchday_graphic", "Squad list", "convocatori(a|es|as)|convocats|convocados|squad list"],
    ["matchday_graphic", "Matchday poster", "cartells?|carteles?|posters?"], ["matchday_graphic", "Countdown", "compte enrere|cuenta atras|countdown"], ["matchday_graphic", "Half-time", "mitja part|descanso|half-?time"],
    ["matchday_graphic", "Goal", "gols|goles|goals"], ["matchday_graphic", "Full-time", "resultat final|resultado final|full-?time|final del partit|final del partido"],
    ["matchday_graphic", "MOTM vote", "mvp|motm|millor jugador|mejor jugador"], ["matchday_graphic", "Standings", "classificaci(o|ons)|clasificaci(on|ones)|standings"],
    ["matchday_graphic", "Stats card", "estadistiques|estadisticas|stats"], ["matchday_graphic", "Fixture / schedule", "calendari|calendario|fixtures?|horaris?|horarios?"],
    ["outcome", "Win", "victori(a|es|as)|wins?|guanyar|ganar|triomf"], ["outcome", "Draw", "empats?|empates?|draws?"], ["outcome", "Loss", "derrot(a|es|as)|loss|losses|perdre|perder"],
    ["moment", "Matchday preview", "previ(a|es|as)|preview|matchday|dia de partit|dia de partido"], ["moment", "Birthday", "aniversaris?|cumpleanos|birthdays?"], ["moment", "Tribute", "homenatges?|homenajes?|tributes?"],
    ["moment", "Christmas", "nadal|navidad|christmas"], ["moment", "Halloween", "halloween"], ["moment", "Black Friday", "black friday"], ["moment", "Valentine's Day", "sant valenti|san valentin|valentine"],
    ["moment", "International Women's Day", "dia de la dona|dia de la mujer|womens day|8m"], ["moment", "Training", "entrenaments?|entrenamientos?|training"],
    ["moment", "Milestone / record", "records?|fites?|hitos?|milestones?"], ["moment", "Award", "premis?|premios?|awards?"], ["moment", "Throwback", "throwback|tbt|nostalgi(a|c)"],
    ["team", "Women's team", "femeni|femenino|women|womens|dones|mujeres|equip femeni"], ["team", "Academy / youth", "academia|academy|cantera|planter|futbol base|youth"], ["team", "Legends", "llegendes|leyendas|legends"],
    ["goal", "Ticket sales", "entrades|entradas|tickets?|taquilla"], ["goal", "Merchandise sales", "botiga|tienda|merch\\w*|shop"], ["goal", "Memberships", "socis|socios|members(hip)?|abonaments?|abonos?"],
    ["sponsor_integration", "*", "sponsors?|patrocinadors?|patrocinadores|patrocini|patrocinio|partners?"],
    ["angle", "Humour / meme", "humor|memes?|divertits?|graciosos?|funny"], ["angle", "Emotional", "emotius?|emotivos?|emotional|emocionants?"], ["angle", "Behind the scenes", "behind the scenes|backstage|darrere les cameres|detras de camaras|bts"],
    ["angle", "Celebration", "celebraci(o|on)(ns|es)?|celebrations?"], ["angle", "Data & stats", "dades|datos|data"],
    ["collab", "Influencer / creator", "influencers?|creadors?|creadores|creators?"], ["collab", "Fan content (UGC)", "ugc|contingut de fans|contenido de fans|fan content"],
    ["aspect_ratio", "9:16", "verticals?|verticales"], ["aspect_ratio", "1:1", "quadrats?|cuadrados?|square"],
    ["cta", "Giveaway / contest", "sortei(g|gs)|sorteos?|giveaways?|concursos?"], ["cta", "Vote / poll", "enquest(a|es)|encuestas?|polls?|votaci(o|on)"],
    ["sport", "Football", "futbol|football|soccer"], ["sport", "Basketball", "basquet|baloncesto|basketball|basket"], ["sport", "Handball", "handbol|balonmano|handball"], ["sport", "Tennis", "tennis|tenis"],
  ].map(([cat, name, re]) => ({ cat, name, re: new RegExp(`(^|[^a-z0-9])(${re})(?=$|[^a-z0-9])`) }));
  const STOP = /^(fc|cf|club|de|del|la|el|the|ac|as|sc|afc|cd|ud|rc|sd|real|sporting|united|city)$/;
  // nicknames → the name in the catalog
  const ALIAS = [[/\bbarca\b/g, "barcelona"], [/\batleti\b/g, "atletico de madrid"], [/\bman utd\b|\bman united\b/g, "manchester united"], [/\bman city\b/g, "manchester city"],
    [/\bpsg\b/g, "paris saint-germain"], [/\bjuve\b/g, "juventus"], [/\bbayern\b/g, "bayern munich"], [/\bspurs\b/g, "tottenham"], [/\bla liga\b/g, "laliga"], [/\bucl\b|\bchampions\b(?! league)/g, "champions league"]];
  const VERSUS = /(contra|vs\.?|versus|against|frente a|davant|ante)\s+(el |la |l |the )?$/;
  function parseSentence(text) {
    let t = ` ${fold(text).replace(/['’]/g, " ")} `;
    for (const [re, to] of ALIAS) t = t.replace(re, to);
    const out = new Map();   // value id → value
    const add = (v) => v && out.set(v.id, v);
    for (const s of SYN) if (s.re.test(t)) {
      if (s.name === "*") (catalog.byCat[s.cat] || []).forEach(add); else add(valByName(s.cat, s.name));
    }
    // names from the catalog itself (clubs, competitions, sponsors, cities, opponents…): the whole name, or its main word
    for (const v of catalog.byId.values()) {
      if (["trend", "format", "platform", "aspect_ratio", "duration", "language"].includes(v.category) || out.has(v.id)) continue;
      const n = fold(v.name).replace(/[^a-z0-9 ]+/g, " ").trim();
      if (n.length < 4) continue;
      const core = n.split(/\s+/).filter((w) => !STOP.test(w)).join(" ");
      const hit = (w) => w.length >= 4 && new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^a-z0-9])`).test(t);
      if (hit(n) || (["club", "competition", "sponsor", "opponent", "city"].includes(v.category) && core.length >= 5 && hit(core))) add(v);
    }
    // the same name as club and as opponent: "contra / vs / against X" → opponent, otherwise → club
    const before = (name) => { const n = fold(name), i = t.indexOf(n); return i > 0 ? t.slice(Math.max(0, i - 20), i) : ""; };
    for (const v of [...out.values()]) {
      if (v.category !== "opponent") continue;
      const club = [...out.values()].find((c) => c.category === "club" && fold(c.name).includes(fold(v.name)));
      if (VERSUS.test(before(v.name))) { if (club) out.delete(club.id); } else if (club) out.delete(v.id);
    }
    // a club named in the sentence: the club, not a city with the same name
    const clubs = [...out.values()].filter((v) => v.category === "club").map((v) => fold(v.name));
    for (const v of [...out.values()]) if (v.category === "city" && clubs.some((c) => c.includes(fold(v.name)))) out.delete(v.id);
    return [...out.values()];
  }
  // Views in a sentence: "2 milions de visualitzacions", "més de 500k views", "entre 1M i 5M", "menys de 100.000 reproduccions"
  const VIEWS_WORD = /(visualitzacions|visualizaciones|views|reproduccions|reproducciones|plays|vistes|visites|visitas|visionados)/;
  const NUM = "(\\d+(?:[.,]\\d+)*)\\s*(milions?|millones?|millions?|mill?|m|mil|k|thousand|miles)?(?![a-z])";
  function toNumber(n, unit) {
    let x;
    if (/^\d{1,3}([.,]\d{3})+$/.test(n)) x = Number(n.replace(/[.,]/g, ""));   // 2.000.000 / 500,000
    else x = Number(n.replace(",", "."));
    const u = (unit || "").toLowerCase();
    if (/^(milions?|millones?|millions?|m)$/.test(u) || u === "mill") x *= 1e6;
    else if (/^(mil|k|thousand|miles)$/.test(u)) x *= 1e3;
    return Number.isFinite(x) && x > 0 ? Math.round(x) : null;
  }
  function parseViews(text) {
    const t = ` ${fold(text)} `;
    if (!VIEWS_WORD.test(t) && !/\d\s*(m|k)\b/.test(t)) return null;
    const nums = [...t.matchAll(new RegExp(NUM, "g"))].map((m) => ({ n: toNumber(m[1], m[2]), at: m.index })).filter((m) => m.n && m.n >= 100);
    if (!nums.length) return null;
    const near = (re, m) => re.test(t.slice(Math.max(0, m.at - 22), m.at));
    if (nums.length >= 2 && /(entre|between|de .* a |from .* to )/.test(t)) return [Math.min(nums[0].n, nums[1].n), Math.max(nums[0].n, nums[1].n)];
    const m = nums[0];
    if (near(/(menys de|menos de|less than|under|fins a|hasta|up to|maxim|maximo|<)\s*$/, m)) return [null, m.n];
    return [m.n, null];   // "2 milions de visualitzacions", "més de 2M", "+2M": at least
  }
  let sentence = [], sentenceViews = null;
  function applySentence() {
    if (!sentence.length && !sentenceViews) return;
    const facets = {};
    for (const v of sentence) (facets[v.category] ||= []).push(v.id);
    fsearch.value = ""; fresults.hidden = true;
    const ex = sentenceViews;
    // the slider shows the closest buckets; the query uses the exact numbers
    const bucket = (n) => Math.max(0, Math.min(VB, Math.round((Math.log(n / 1000) / Math.log(50000)) * VB)));
    applyState({ order: state().order, period: state().period, facets,
      ...(ex ? { views: [ex[0] ? bucket(ex[0]) : 0, ex[1] ? bucket(ex[1]) : VB], viewsExact: ex } : {}) });
    load(true);
  }

  // ---------- Under the filters' search: four real filters to try in one click, a different set on every visit and
  // every few seconds (not while the pointer is on them or the search is in use) ----------
  const suggBox = $("[data-lf-sugg]");
  const SUGG = ["sport", "competition", "club", "moment", "transfer", "goal", "matchday_graphic"];
  function drawSugg() {
    if (!suggBox || !catalog.byId.size) return;
    const pool = SUGG.flatMap((k) => (catalog.byCat[k] || []).slice(0, 30)).filter((v) => countOf(v) >= 20 && !isOn(v));
    const pick = [];
    while (pick.length < 4 && pool.length) pick.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    suggBox.classList.remove("is-in"); void suggBox.offsetWidth;   // replay the fade-in
    suggBox.innerHTML = pick.map((v) => `<button type="button" class="lf-sugg-b" data-facet="${v.category}" data-id="${v.id}">${esc(tx(pretty(v.name)))}</button>`).join("");
    suggBox.classList.add("is-in");
  }
  setInterval(() => { if (suggBox && !suggBox.matches(":hover") && document.activeElement !== $("[data-lf-search]") && !document.hidden) drawSugg(); }, 9000);

  // ---------- Search inside the filters: any value of any filter ----------
  const fsearch = $("[data-lf-search]"), fresults = $("[data-lf-results]");
  let hits = [], hitAlt = new Map();
  function searchFilters() {
    const q = fsearch.value.trim().toLowerCase();
    if (q.length < 2) { fresults.hidden = true; return; }
    hits = [];
    for (const v of catalog.byId.values()) if (v.name.toLowerCase().includes(q)) hits.push(v);
    // the same team as club and as opponent: one row (the club), with "as opponent" beside it
    const norm = (n) => fold(n).replace(/[^a-z0-9]+/g, " ").trim();
    const clubs = new Map(hits.filter((v) => v.category === "club").map((v) => [norm(v.name), v]));
    hitAlt = new Map();
    hits = hits.filter((v) => { const c = v.category === "opponent" && clubs.get(norm(v.name)); if (c) hitAlt.set(c.id, v); return !c; });
    hits.sort((a, b) => (b.name.toLowerCase().startsWith(q) - a.name.toLowerCase().startsWith(q)) || countOf(b) - countOf(a));
    hits = hits.slice(0, 8);
    const hl = (n) => { const i = n.toLowerCase().indexOf(q); return `${esc(n.slice(0, i))}<mark>${esc(n.slice(i, i + q.length))}</mark>${esc(n.slice(i + q.length))}`; };
    // a sentence (2+ words) that names several filters: offer to apply them all at once
    sentence = !LAYOUT_BEFORE && /\S\s+\S/.test(q) ? parseSentence(q) : [];
    sentenceViews = !LAYOUT_BEFORE ? parseViews(q) : null;
    const viewsTag = sentenceViews ? `<i class="is-views">${esc(sentenceViews[0] && sentenceViews[1] ? `${kfmt(sentenceViews[0])} – ${kfmt(sentenceViews[1])}` : sentenceViews[0] ? `${kfmt(sentenceViews[0])}+` : `≤ ${kfmt(sentenceViews[1])}`)} ${esc(tx("views"))}</i>` : "";
    const nFilters = sentence.length + (sentenceViews ? 1 : 0);
    const sentenceHtml = sentence.length >= 2 || sentenceViews ? `<button type="button" class="lf-hit lf-hit-all is-kb" data-hit-all>${svg("search")}<span class="lf-hv"><b>${esc(tx(nFilters === 1 ? "Search with 1 filter" : "Search with {n} filters", { n: nFilters }))}</b><span class="lf-hit-tags">${viewsTag}${sentence.slice(0, 6).map((v) => `<i>${esc(pretty(v.name))}</i>`).join("")}${sentence.length > 6 ? `<i>+${sentence.length - 6}</i>` : ""}</span></span></button>` : "";
    fresults.hidden = false;
    fresults.innerHTML = sentenceHtml + (hits.length ? hits.map((v, i) => {
      const c = CAT[v.category];
      const lead = c.crest || v.logo ? crestImg(v, "lf-mini") : v.category === "platform" && PLATFORM[v.name.toLowerCase()] ? pfLogo(v.name.toLowerCase(), "lf-pfi is-brand") : "";
      const alt = hitAlt.get(v.id);
      return `<div class="lf-hit-wrap"><button type="button" class="lf-hit${isOn(v) ? " is-on" : ""}${i === 0 && !sentenceHtml ? " is-kb" : ""}" role="option" data-hit="${i}">${lead}<span class="lf-hv">${hl(pretty(v.name))}</span><span class="lf-hc">${esc(c.sec === "discover" ? "Discover" : c.label)}</span><span class="lf-cnt">${kfmt(countOf(v))}</span></button>${alt ? `<button type="button" class="lf-hit-alt${isOn(alt) ? " is-on" : ""}" data-hit-alt="${i}" title="${esc(tx("Posts against {name}", { name: pretty(alt.name) }))}">${esc(tx("as opponent"))} <em>${kfmt(countOf(alt))}</em></button>` : ""}</div>`;
    }).join("") : sentenceHtml ? "" : `<p class="lf-none">No filter called “${esc(fsearch.value.trim())}”.</p>`);
  }
  function pickHit(i, asOpponent = false) {
    const v = asOpponent ? hitAlt.get(hits[i]?.id) : hits[i];
    if (!v) return;
    fsearch.value = ""; fresults.hidden = true;
    const c = CAT[v.category];
    if (!isOn(v)) selected[v.category].add(v.id);
    if (c.sec === "discover" || c.key === "format" || c.key === "platform") ui.open = null;
    else if (c.key === "duration" || c.key === "language") ui.open = c.key;
    else if (c.extra) ui.open = null;
    else { ui.open = c.key; if (c.more) ui.more.add(c.sec); }
    renderFacets();
    ($(`[data-lf-rowbox="${CSS.escape(ui.open || "")}"]`) || $(`[data-facet="${v.category}"][data-id="${v.id}"]`))?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    load(true);
  }
  fsearch.addEventListener("input", searchFilters);
  fsearch.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); sentence.length >= 2 || sentenceViews ? applySentence() : pickHit(0); }
    if (e.key === "Escape") { fsearch.value = ""; fresults.hidden = true; }
  });
  fresults.addEventListener("click", (e) => { if (e.target.closest("[data-hit-all]")) return applySentence(); const a = e.target.closest("[data-hit-alt]"); if (a) return pickHit(Number(a.dataset.hitAlt), true); const b = e.target.closest("[data-hit]"); if (b) pickHit(Number(b.dataset.hit)); });

  // ---------- Column scroll: thin gold bar while scrolling, edge fades when there's more ----------
  const lfBody = $("[data-lf-body]");
  let scrollTimer;
  function fadeEdges() {
    const t = lfBody.scrollTop, m = lfBody.scrollHeight - lfBody.clientHeight;
    lfBody.style.setProperty("--fade-top", t > 4 ? "28px" : "0px");
    lfBody.style.setProperty("--fade-bottom", t < m - 4 ? "36px" : "0px");
  }
  lfBody.addEventListener("scroll", () => {
    lfBody.classList.add("is-scrolling");
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => lfBody.classList.remove("is-scrolling"), 900);
    fadeEdges();
  }, { passive: true });
  if (window.ResizeObserver) new ResizeObserver(fadeEdges).observe(lfBody);

  // ---------- Mobile: the column becomes a bottom sheet ----------
  const mobile = () => matchMedia("(max-width: 960px)").matches;
  const setSheet = (open) => { root.classList.toggle("sheet-open", open); document.body.style.overflow = open ? "hidden" : ""; };
  $$("[data-sheet-close]").forEach((b) => b.addEventListener("click", () => setSheet(false)));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && root.classList.contains("sheet-open")) setSheet(false); });

  // ---------- Show / hide the filters column (remembered) ----------
  const collapse = $("[data-collapse]");
  const setCollapsed = (collapsed) => {
    root.classList.toggle("filters-collapsed", collapsed);
    collapse.setAttribute("aria-expanded", String(!collapsed));
    $("[data-collapse-label]").textContent = collapsed ? "Show filters" : "Hide filters";
    store.set("scp-filters-collapsed", collapsed ? "1" : "0");
  };
  collapse.addEventListener("click", () => (mobile() ? setSheet(true) : setCollapsed(!root.classList.contains("filters-collapsed"))));
  // on phones the button opens the filters sheet
  const syncCollapseLabel = () => { if (mobile()) $("[data-collapse-label]").textContent = "Filters"; else $("[data-collapse-label]").textContent = root.classList.contains("filters-collapsed") ? "Show filters" : "Hide filters"; };
  matchMedia("(max-width: 960px)").addEventListener("change", () => { syncCollapseLabel(); if (!mobile()) setSheet(false); });
  $("[data-hide-filters]").addEventListener("click", () => setCollapsed(true));
  // Floating "show filters" button: sits where the column's own hide button was, following the column's top as the page scrolls
  const showBtn = $("[data-show-filters]");
  if (showBtn) {
    showBtn.addEventListener("click", () => setCollapsed(false));
    // centred on the head's row (period, Algorithm, the filter bar)
    const placeShow = () => { const h = $("[data-lib-head]").getBoundingClientRect(); showBtn.style.top = `${Math.max(h.top, 0) + (h.height - (showBtn.offsetHeight || 34)) / 2}px`; };
    window.addEventListener("scroll", placeShow, { passive: true });
    window.addEventListener("resize", placeShow);
    if (window.ResizeObserver) new ResizeObserver(placeShow).observe(document.body);   // content above the head can grow later (My Club)
    placeShow();
  }
  if (store.get("scp-filters-collapsed") === "1") setCollapsed(true);
  syncCollapseLabel();

  // ---------- Period / sort dropdowns in the feed bar ----------
  $$("[data-dd]").forEach((dd) => {
    const btn = $("[data-dd-btn]", dd), menu = $("[data-dd-menu]", dd);
    const set = (open) => { menu.hidden = !open; btn.setAttribute("aria-expanded", String(open)); };
    btn.addEventListener("click", (e) => { e.stopPropagation(); const open = menu.hidden; $$("[data-dd-menu]").forEach((m) => (m.hidden = true)); set(open); });
    // a choice closes the menu, except "Custom dates" (the date pickers live inside it)
    menu.addEventListener("click", (e) => { const b = e.target.closest("[data-value]"); if (b && b.dataset.value !== "custom") setTimeout(() => set(false), 120); });
  });
  document.addEventListener("click", (e) => { if (!e.target.closest("[data-dd], .dp-pop")) $$("[data-dd-menu]").forEach((m) => { m.hidden = true; m.previousElementSibling.setAttribute("aria-expanded", "false"); }); });
  function paintDropdowns(s) {
    $("[data-period-label]").textContent = s.period === "all" ? "" : s.period === "custom" ? (s.from || s.to ? `${shortDate(s.from) || "…"} → ${shortDate(s.to) || "…"}` : "Custom dates") : PERIODS[s.period];
    $("[data-order-label]").textContent = $(`[data-order] [data-value="${s.order}"]`)?.textContent.trim() || "Latest";
  }

  // Live counts: how many posts each value would show with the other filters applied.
  // Categories with a selection are counted without their own filter (values within a category are OR'ed).
  let countToken = 0;
  async function refreshCounts(args) {
    const my = ++countToken;
    const active = CATEGORIES.filter((c) => selected[c.key].size).map((c) => c.key);
    // one row per filter value: more than the API's 1,000 rows per request, so read page by page
    const pages = async (fn, params) => {
      const out = [];
      for (let from = 0; ; from += 1000) {
        const r = await db.rpc(fn, params).range(from, from + 999);
        if (r.error) return out.length ? { data: out } : r;
        out.push(...(r.data || []));
        if (!r.data || r.data.length < 1000) return { data: out };
      }
    };
    const call = async (filters) => {
      const r = useAdminSearch ? { error: { message: "schema cache" } } : await pages("library_filter_counts", { ...args, p_filters: filters });
      return r.error && /schema cache|does not exist/i.test(r.error.message) ? db.rpc("available_filter_counts", { ...args, p_filters: filters }) : r;
    };
    const safe = (p) => p.then((r) => r, () => ({ error: true }));
    const [base, ...own] = await Promise.all([
      safe(call(args.p_filters)),
      ...active.map((k) => { const f = { ...args.p_filters }; delete f[k]; return safe(call(f)); }),
    ]);
    if (my !== countToken) return;
    // Very big selections with several filters: the server doesn't count them (value_id -1) → show the catalog totals
    const unknown = (r) => r.error || (r.data || []).some((x) => Number(x.value_id) === -1);
    if (unknown(base) || own.some(unknown)) { counts = null; return renderFacets(); }
    const m = new Map((base.data || []).map((r) => [Number(r.value_id), Number(r.ideas)]));
    active.forEach((k, i) => {
      const mk = new Map((own[i].data || []).map((r) => [Number(r.value_id), Number(r.ideas)]));
      for (const v of catalog.byCat[k] || []) m.set(v.id, mk.get(v.id) || 0);
    });
    counts = m;
    renderFacets();
    if (!fresults.hidden) searchFilters();
  }

  // ---------- Key dates: the Content Plan links to content-library.html?topic=halloween → posts that mention it ----------
  { const t = new URLSearchParams(location.search).get("topic"); if (t) $("[data-q]").value = t.slice(0, 60); }

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
    ...(viewsSet() ? { views: [views.a, views.b] } : {}),
    ...(views.exact ? { viewsExact: views.exact } : {}),
  });

  function applyState(f) {
    for (const c of CATEGORIES) selected[c.key] = new Set((f.facets?.[c.key] || []).map(Number).filter((id) => catalog.byId.has(id)));
    [views.a, views.b] = Array.isArray(f.views) ? f.views.map(Number) : [0, VB];
    views.exact = Array.isArray(f.viewsExact) ? f.viewsExact.map((x) => (x == null ? null : Number(x))) : null;
    ui.q = {};
    if (f.order) $$("[data-order] button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === f.order)));
    setPeriod(f.period || "all");
    for (const k of ["from", "to"]) { const el = $(`[data-${k}]`); el.value = f[k] || ""; el.dispatchEvent(new Event("input")); }
    $("[data-q]").value = f.q || "";
    renderFacets();
  }

  // ---------- Shareable link: the filters live in the address (?f=…), so a copied link opens the same view ----------
  const b64e = (t) => btoa(String.fromCharCode(...new TextEncoder().encode(t))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const b64d = (t) => new TextDecoder().decode(Uint8Array.from(atob(t.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));
  function linkOf(s) {
    const o = {};
    if (s.order !== "latest") o.order = s.order;
    if (s.period !== "all") Object.assign(o, { period: s.period }, s.period === "custom" ? { from: s.from, to: s.to } : {});
    if (Object.keys(s.facets).length) o.facets = s.facets;
    if (s.q) o.q = s.q;
    if (s.views) o.views = s.views;
    if (s.viewsExact) o.viewsExact = s.viewsExact;
    return Object.keys(o).length ? b64e(JSON.stringify(o)) : "";
  }
  function syncLink(s) {
    const p = new URLSearchParams(location.search);
    p.delete("f"); p.delete("topic");   // the topic is already in the search box (and so in f)
    const f = linkOf(s);
    if (f) p.set("f", f);
    const qs = p.toString();
    history.replaceState(history.state, "", `${location.pathname}${qs ? `?${qs}` : ""}${location.hash}`);
  }
  const linkState = (() => { try { const f = new URLSearchParams(location.search).get("f"); return f ? JSON.parse(b64d(f)) : null; } catch { return null; } })();

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
    const args = { p_filters: filters, p_q: s.q || null, p_from: from, p_to: to };
    // views range (only sent when used, so the page keeps working before library-filters.sql)
    if (s.viewsExact) { const [lo, hi] = s.viewsExact; if (lo) args.p_min_views = lo; if (hi) args.p_max_views = hi; }
    else if (s.views) { const [a, b] = s.views; if (a > 0) args.p_min_views = Math.round(vEdge(a)); if (b < VB) args.p_max_views = Math.round(vEdge(b)); }
    return args;
  }

  // ---------- Active filter chips ----------
  function chipsFor(s) {
    const c = [];
    for (const cat of CATEGORIES) for (const id of s.facets[cat.key] || []) {
      const v = catalog.byId.get(id);
      if (v) c.push({ label: `${pretty(v.name)}`, title: cat.sec === "discover" ? "Discover" : cat.label, v, clear: () => { selected[cat.key].delete(id); renderFacets(); } });
    }
    if (s.views) c.push({ label: viewsLabel(), title: "Views", ico: "eye", clear: () => { views.a = 0; views.b = VB; views.exact = null; renderFacets(); } });
    if (s.period !== "all") c.push({ label: s.period === "custom" ? `${s.from || "…"} → ${s.to || "…"}` : PERIODS[s.period], title: "Period", ico: "calendar", clear: () => { setPeriod("all"); ["from", "to"].forEach((k) => { const el = $(`[data-${k}]`); el.value = ""; el.dispatchEvent(new Event("input")); }); } });
    if (s.q) c.push({ label: `“${s.q}”`, title: "Text", ico: "search", clear: () => ($("[data-q]").value = "") });
    return c;
  }
  let chipClears = [];
  function renderActive(s) {
    const chips = chipsFor(s);
    chipClears = chips.map((x) => x.clear);
    $("[data-active-bar]").hidden = chips.length === 0 && !savedSearches.length;
    // each chip: its logo / icon, the filter it belongs to (small caption) and the value; × on the right
    const chipLead = (x) => { const v = x.v;
      if (!v) return `<span class="ac-ic">${svg(x.ico || "dots")}</span>`;
      if (v.category === "trend") return `<span class="ac-ic ac-sp ${special(v).cls}">${svg(special(v).ico)}</span>`;
      if (CAT[v.category]?.crest || v.logo) return crestImg(v, "ac-logo");
      if (v.category === "platform" && PLATFORM[v.name.toLowerCase()]) return `<span class="ac-ic">${pfLogo(v.name.toLowerCase(), "lf-pfi is-brand")}</span>`;
      return `<span class="ac-ic">${svg(v.category === "format" ? FORMAT_ICON[v.name.toLowerCase()] || "image" : v.category === "sport" ? sportIco(v.name) : CAT[v.category]?.ico || "dots")}</span>`; };
    $("[data-active-chips]").innerHTML = chips.length ? `<span class="ab-lead"><span class="ab-ic">${svg("check")}</span><span class="ab-tx"><b>${esc(tx("Your search"))}</b><small>${esc(tx(chips.length === 1 ? "{n} filter" : "{n} filters", { n: chips.length }))}${chips.length > 1 ? ` · <button type="button" class="active-clear" data-chip-clear>${esc(tx("Clear all"))}</button>` : ""}</small></span></span>`
      + chips.map((x, i) => `<button type="button" class="active-chip" data-chip="${i}"${x.title ? ` title="${esc(tx(x.title))}"` : ""} aria-label="${esc(tx("Remove {what}", { what: x.label }))}">${chipLead(x)}<span class="ac-tx"><b>${esc(x.label)}</b></span><span class="ac-x" aria-hidden="true">${icon("x")}</span></button>`).join("")
 : "";
    $("[data-save-search]").hidden = chips.length === 0;
    $("[data-share-search]").hidden = chips.length === 0;
    const sidebarCount = chips.length - (s.q ? 1 : 0);
    const badge = $("[data-filter-count]");
    badge.textContent = sidebarCount; badge.hidden = sidebarCount <= 0;
    const fbadge = $("[data-filter-count-float]");
    if (fbadge) { fbadge.textContent = sidebarCount; fbadge.hidden = sidebarCount <= 0; }
    $("[data-lf-active]").textContent = sidebarCount > 0 ? `· ${tx("{n} active", { n: sidebarCount })}` : "";
    paintDropdowns(s);
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
  $("[data-share-search]").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(location.href); toast(tx("Link copied: whoever opens it sees these filters")); }
    catch { window.prompt(tx("Copy this link"), location.href); }
  });
  $("[data-save-search]").addEventListener("click", async () => {
    const name = window.prompt("Name this search (e.g. “Basketball carousels”)");
    if (!name?.trim()) return;
    const { error } = await db.from("saved_searches").upsert({ name: name.trim(), filters: state() }, { onConflict: "user_id,name" });
    if (error) return alert(error.message);
    await loadSavedSearches();
  });

  // ---------- The member's favourites (Favs, the "Following" badge, "Like mine") ----------
  const me = { boost: [], boost2: [], fav: new Set(), isSuper: false, likeMine: [] };
  async function loadMe() {
    const profile = (await auth?.getProfile?.())?.profile;
    me.isSuper = profile?.role === "superadmin";
    const prefs = profile?.preferences || {};
    const favIds = [...(prefs.favouriteProfiles || []), ...(prefs.favouriteCreators || [])].map((f) => f.id).filter(Boolean).map(Number);
    me.boost = favIds;
    me.fav = new Set(favIds);
    me.boost2 = [...(prefs.sports || []), ...(prefs.competitions || [])].map(Number);
    me.favAccts = Array.isArray(prefs.favouriteCreatorAccounts) ? prefs.favouriteCreatorAccounts.slice(0, 5) : [];
    me.favPlatform = (prefs.favouritePlatform || "").toLowerCase();   // Profile → Favourites: its posts come first
    me.likeMine = { competitions: (prefs.competitions || []).map(Number), sports: (prefs.sports || []).map(Number) };
    if (!LAYOUT_BEFORE) renderFacets();
  }

  // ---------- Saved boards (js/boards.js) ----------
  const boards = window.SCP_BOARDS;
  $$("[data-icon]").forEach((el) => (el.outerHTML = icon(el.dataset.icon)));

  // ---------- Query ----------
  let offset = 0;
  let token = 0;
  let seed = String(Math.random()).slice(2, 10);
  const cache = new Map();

  window.addEventListener("scp-lib-scope", () => load(true));   // My Club changed the selection
  async function load(reset) {
    const s = state();
    renderActive(s);
    if (reset) syncLink(s);
    if (reset) {
      offset = 0; resetGrid(); empty.hidden = true; note.hidden = true;
      // skeleton cards while the posts load (different heights, like the real grid)
      const H = [1.25, 1.78, 1, 1.5, 0.9, 1.78, 1.25, 1.1, 1.6];
      cols.forEach((c, i) => { for (let k = 0; k < 2; k++) c.insertAdjacentHTML("beforeend", `<div class="lib-skel" style="aspect-ratio:1/${H[(i * 2 + k) % H.length]}"><i></i><span></span></div>`); });
    }
    if (!db) return showNote("Content isn't connected yet.");
    const my = ++token;
    more.hidden = true;
    grid.setAttribute("aria-busy", "true");

    // My / my team's AI analyses: always every analysed post, whatever filters are on (they could hide them)
    const args = ui.aiMode ? queryArgs({ facets: {}, period: "all" }) : queryArgs(s);
    const cc = (catalog.byCat.entity || []).find((v) => v.name.toLowerCase() === "content creators");
    if (!(cc && isOn(cc))) { ui.acct = null; ui.fol = null; }   // the account and followers filters live under Content Creators
    // Content Creators on: one row per creator (or their posts, with the switch above)
    const crView = cc && isOn(cc) && !ui.aiMode && ui.cview !== "posts" && !ui.acct;
    grid.hidden = crView; crBox.hidden = !crView;
    if (crView) { grid.querySelectorAll(".lib-skel").forEach((x) => x.remove()); grid.removeAttribute("aria-busy"); empty.hidden = true; if (reset) { cr.shown = 10; panelCount(args, my); } return renderCreators(my).then(() => { if (nearEnd) moreCreators(); }); }
    let ids = ui.aiMode ? [...aiList().keys()] : null;
    // My Club (js/my-club.js): only the posts of the selected section / team / players or sponsors
    const scope = window.SCP_LIB_SCOPE;
    if (scope) {
      await scope.ready;
      if (my !== token) return;
      if (scope.ids) { const inScope = new Set(scope.ids); ids = ids ? ids.filter((id) => inScope.has(Number(id))) : scope.ids; }
    }
    if (ui.acct) ids = ids ? ids.filter((id) => ui.acct.ids.includes(Number(id))) : ui.acct.ids;
    if (ui.fol) { const f = new Set(ui.fol.ids); ids = ids ? ids.filter((id) => f.has(Number(id))) : ui.fol.ids; }
    if (ids && !ids.length) {
      grid.querySelectorAll(".lib-skel").forEach((x) => x.remove());
      if (scope && !ui.aiMode && !ui.acct && !ui.fol) return showEmpty(tx(scope.empty || "No posts yet."));
      return showEmpty(tx(!ui.aiMode ? (ui.fol && !ui.acct ? "No creators' posts in this followers range yet." : "No posts from this account yet.") : ui.aiMode === "team" ? "Your team hasn't analysed any post yet." : "You haven't analysed any post yet. Open a post and press “Unlock AI Analysis”."));
    }
    if (reset) refreshCounts(args);
    const boost = s.order === "foryou" ? { p_boost: me.boost, p_boost2: me.boost2 } : {};
    const { data, error } = await fetchIdeas({ ...args, p_order: s.order, p_seed: seed, p_ids: ids, p_limit: PAGE, p_offset: offset, ...boost });
    if (my !== token) return;
    grid.removeAttribute("aria-busy");
    grid.querySelectorAll(".lib-skel").forEach((x) => x.remove());
    if (error) return showNote(/schema cache|does not exist|function/i.test(error.message) ? "The library isn't connected yet (run supabase/library-ideas.sql in Supabase)." : "Couldn't load posts right now.");
    const rows = data?.data || [];
    if (reset) {
      ui.total = data.total;
      goFoot();
      $("[data-lf-go]").textContent = data.total ? `Show ${Number(data.total).toLocaleString(window.SCP_LOC || "en-GB")} results` : "No results — change the filters";
    }
    if (!rows.length && offset === 0) {
      if (!chipsFor(s).length) return showEmpty("The library is empty for now — posts appear here after the first import.");
      return showEmpty("No posts match these filters.");
    }
    addCards(rows);
    rows.forEach((p) => cache.set(String(p.id), p));
    offset += rows.length;
    more.hidden = offset >= data.total;
    if (ytGrid && more.hidden) ytFlush(true);   // the list has ended: the cards still waiting for a full row show too
    saveKeep();
    if (nearEnd && !more.hidden && !grid.hidden) load(false);   // the page is still short of the screen: the next ones
  }

  // the filter panels' count while the creators are shown (the grid isn't loaded then)
  async function panelCount(args, my) {
    const { data } = await fetchIdeas({ ...args, p_order: "views", p_seed: "", p_ids: null, p_limit: 1, p_offset: 0 }).catch(() => ({}));
    if (my !== token || !data) return;
    ui.total = data.total;
    goFoot();
  }

  // ---------- Keep the place on refresh (this tab): filters, sort and its shuffle, posts loaded and scroll ----------
  const KEEP = window.SCP_LIB_SCOPE ? "scp-club-keep" : "scp-lib-keep";   // My Club keeps its own place
  const keep = {
    get() { try { return JSON.parse(sessionStorage.getItem(KEEP) || "null"); } catch { return null; } },
    set(v) { try { sessionStorage.setItem(KEEP, JSON.stringify(v)); } catch {} },
  };
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";   // we put the scroll back ourselves, once the posts are there
  let restoring = false;
  function saveKeep() { if (!restoring) keep.set({ state: state(), seed, n: offset, y: Math.round(window.scrollY), t: Date.now() }); }
  let keepTimer;
  window.addEventListener("scroll", () => { clearTimeout(keepTimer); keepTimer = setTimeout(saveKeep, 250); }, { passive: true });
  window.addEventListener("pagehide", saveKeep);

  function showEmpty(text) {
    if (document.body.classList.contains("lib-locked")) return lockBackdrop();   // no plan: the server gives no posts
    empty.textContent = text; empty.hidden = false;
  }
  // behind the "unlock" card of an account without a plan (supabase/library-gate.sql gives it no posts): a wall of the
  // week's most viewed covers from the public content/top.json, blurred like the real posts would be
  let backdropDone = false;
  async function lockBackdrop() {
    if (backdropDone) return; backdropDone = true;
    const top = await fetch("content/top.json", { cache: "no-cache" }).then((r) => r.json()).catch(() => []);
    const pics = (top || []).map((p) => p.cover_url).filter(Boolean).slice(0, 24);
    if (pics.length) grid.insertAdjacentHTML("beforebegin", `<div class="lib-ghosts" aria-hidden="true">${pics.map((u) => `<span style="background-image:url('${esc(u)}')"></span>`).join("")}</div>`);
  }
  function showNote(text) { note.textContent = text; note.hidden = false; }

  // library_ideas (members). Until supabase/library-ideas.sql has been run, superadmins fall back to the admin search
  // (newest first only; saved posts are filtered from the page).
  let useAdminSearch = false;
  async function fetchIdeas(a) {
    // always name the Views parameters: that picks the right library_ideas() even if an older overload is still there
    a = { p_min_views: null, p_max_views: null, ...a };
    if (!useAdminSearch) {
      let r = await db.rpc("library_ideas", a);
      // a heavy filter combination can hit the database's time limit once (cold cache): try again before giving up
      if (r.error && (r.error.code === "57014" || /timeout|timed out|canceling statement|Failed to fetch|NetworkError/i.test(r.error.message || ""))) {
        await new Promise((res) => setTimeout(res, 600));
        r = await db.rpc("library_ideas", a);
      }
      // "For you" with a filter on top can still be too slow for the database: show the same filters by date instead
      if (r.error && r.error.code === "57014" && a.p_order === "foryou") r = await db.rpc("library_ideas", { ...a, p_order: "latest", p_boost: undefined, p_boost2: undefined });
      if (r.error) console.warn("[library] library_ideas failed", r.error.code, r.error.message, a);
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
  const date = (d) => (d ? new Date(d).toLocaleDateString(window.SCP_LOC || "en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
  const first = (p, cat) => p.tags?.[cat]?.[0]?.name || "";
  const platformOf = (p) => {
    const t = first(p, "platform").toLowerCase();
    if (PLATFORM[t]) return t;
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
    if ((m = u.match(/(?:twitter|x)\.com\/[^/]+\/status\/(\d+)/))) return `https://platform.twitter.com/embed/Tweet.html?id=${m[1]}&theme=dark&dnt=true&hideThread=true`;
    if (/facebook\.com\//.test(u)) return `https://www.facebook.com/plugins/${/\/(reel|videos?)\//.test(u) ? "video" : "post"}.php?href=${encodeURIComponent(u)}&show_text=false&width=500`;
    if ((m = u.match(/linkedin\.com\/(?:feed\/update|embed\/feed\/update)\/(urn:li:[\w:]+)/))) return `https://www.linkedin.com/embed/feed/update/${m[1]}?collapsed=1`;
    return "";
  }

  // X's embed tells the page how tall the tweet is: the card takes exactly that height (no cut text)
  addEventListener("message", (e) => {
    if (!/^https:\/\/platform\.twitter\.com$/.test(e.origin)) return;
    let d = e.data;
    try { if (typeof d === "string") d = JSON.parse(d); } catch { return; }
    const h = d?.["twttr.embed"]?.method === "twttr.private.resize" && Number(d["twttr.embed"].params?.[0]?.height);
    if (!h) return;
    const frame = [...document.querySelectorAll(".lib-card.is-embed iframe")].find((f) => f.contentWindow === e.source);
    const media = frame?.closest(".lib-media");
    if (media) { media.style.aspectRatio = "auto"; media.style.height = `${Math.ceil(h)}px`; media.classList.add("is-sized"); }
  });
  const saveBtn = (id) => boards.button(id);
  const tagChips = (p, cats) => cats.flatMap((c) => (p.tags?.[c] || []).map((v) => `<button type="button" class="lib-tag" data-tag="${c}:${v.id}" title="${esc(CAT_LABEL[c])}">${esc(pretty(v.name))}</button>`)).join("");

  // Media-first card at the post's real shape. Reels play right in the grid; on photos and carousels a click opens
  // the details pop-up, except on the carousel arrows (left / right, middle), which stay live to swipe in the card.
  // a YouTube Short: its /shorts/ link, or the Shorts format (imports bring Shorts with the plain watch?v= link)
  const isShort = (p) => /\/shorts\//.test(p.url || "") || /^shorts?$/i.test(first(p, "format") || "");
  const isReel = (p) => /^(reels?|shorts?|video)$/i.test(first(p, "format")) || /\/(reel|shorts)\//.test(p.url || "");
  // Instagram's embed shows reels (9:16) letterboxed inside its media box (usually 4:5): the card is 9:16 and the box is zoomed to fill it.
  // Default card shapes (height / width) for platforms without a measured media ratio
  const PLATFORM_RATIO = { tiktok: 1.78, x: 1.25, facebook: 1.2, linkedin: 1.2 };
  // Facebook: reels vertical like a reel (9:16), other videos horizontal (16:9), photo posts as before
  const fbRatio = (p) => (/facebook\.com\/reel\//.test(p.url || "") || /^reels?$/i.test(first(p, "format")) ? 16 / 9
    : /facebook\.com\/(?:[^/]+\/videos|watch)\b/.test(p.url || "") || /^video$/i.test(first(p, "format")) ? 9 / 16 : 1.2);
  function shape(p) {
    const pf = platformOf(p);
    if (pf === "facebook") return { ratio: Number(p.media_ratio) || fbRatio(p) };
    if (pf === "youtube") return { ratio: isShort(p) ? 1.78 : 0.5625 };
    if (PLATFORM_RATIO[pf]) return { ratio: PLATFORM_RATIO[pf] };
    const box = Number(p.media_ratio) || 1.25;
    if (!isReel(p) || box >= 16 / 9) return { ratio: box };
    return { ratio: 16 / 9, zoom: 1 / (box * 9 / 16), boxFrac: box / (16 / 9) };
  }
  // Is it a video? (Instagram data first, then the imported format / the link)
  const isVideo = (p) => (p.media_type ? /^(reel|video)$/.test(p.media_type) : /^(reels?|shorts?|video)$/i.test(first(p, "format")) || /\/(reel|shorts)\/|tiktok\.com|youtu/.test(p.url || ""));
  const mmss = (s) => { s = Math.round(Number(s) || 0); return s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : ""; };
  // Card shape from the cover: the post's real proportion, kept between 16:9 and 9:16

  // Real shape of each post (height / width): reels, TikToks and Shorts vertical, YouTube videos horizontal,
  // Instagram photos and carousels as posted (4:5 to 1:1)
  function mediaRatio(p) {
    const pf = platformOf(p), shorts = pf === "youtube" && isShort(p);
    if (pf === "tiktok" || shorts || (pf === "instagram" && isReel(p))) return 16 / 9;
    if (pf === "youtube") return 9 / 16;
    if (pf === "instagram") return Math.min(1.25, Math.max(1, Number(p.media_ratio) || 1.25));
    if (pf === "facebook") return Number(p.media_ratio) || fbRatio(p);
    return Number(p.media_ratio) || 1.25;
  }
  const coverRatio = mediaRatio;
  // views (gold) and likes on the card footer; likes come in a second query (library_ideas doesn't return them)
  const footStats = (p) => [[p.views, "views", "is-views"], [p.likes, "likes", ""]].filter(([n]) => Number(n) > 0)
    .map(([n, l, c]) => `<span class="lib-foot-views ${c}"><b>${compact(n)}</b><small>${tx(l)}</small></span>`).join("");
  async function loadLikes(rows) {
    const ids = rows.filter((r) => r.likes === undefined).map((r) => Number(r.id));
    if (!ids.length || !db) return;
    const { data } = await db.from("content_ideas").select("id,likes,comments,account").in("id", ids);
    for (const d of data || []) {
      const p = cache.get(String(d.id));
      if (!p) continue;
      p.likes = d.likes; p.comments = d.comments; p.account = d.account;
      if (d.likes) { const box = $(`[data-stats="${CSS.escape(String(d.id))}"]`); if (box) box.innerHTML = footStats(p); }
      // a creator's or media outlet's post: its username instead of "Content Creators" / "Media"
      const foot = d.account && $(`.lib-foot[data-cc="${CSS.escape(String(d.id))}"]`);
      if (foot) { foot.querySelector(".lib-foot-who b").textContent = `@${d.account}`; foot.querySelector(".lib-crest").outerHTML = footCrest(null, d.account); }
    }
  }
  const compact = (n) => Number(n).toLocaleString(window.SCP_LOC || "en-GB", { notation: "compact", maximumFractionDigits: 1 });

  // Card = the post (clean cover, or the embed for X / LinkedIn / Facebook) + a footer joined to it (who, when, views).
  // On the cover, always: the network and the format / length, and "Following" (which folds into a star).
  // On hover: a rail on the right with Drag to the Content Plan · Save · AI analysis.
  // Footer avatar: Instagram profile picture (fills the circle) › crest (inside a neutral circle) › initials (gold on dark)
  function footCrest(v, who) {
    const name = v?.name || who || "";
    const tip = v?.ig ? `@${v.ig}` : name;
    const ini = name.replace(/\b(FC|CF|AFC|SC|AC|CD|UD|RC|SL)\b/g, "").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
    if (v?.logo) return `<span class="lib-crest${v.ig ? " is-photo" : ""}" title="${esc(tip)}" data-ini="${esc(ini)}"><img src="${esc(v.logo)}" alt="" loading="lazy" referrerpolicy="no-referrer"></span>`;
    return `<span class="lib-crest is-initials" title="${esc(tip)}"><b>${esc(ini)}</b></span>`;
  }

  function card(p) {
    const pf = platformOf(p);
    let who = first(p, "club") || first(p, "competition") || first(p, "entity");
    const whoTag = (p.tags?.club || p.tags?.competition || p.tags?.entity || [])[0];
    let crest = whoTag ? catalog.byId.get(Number(whoTag.id)) : null;
    // a creator's or a media outlet's post shows its username, not "Content Creators" / "Media" (the account comes with the likes, see loadLikes)
    const isCC = /^(content creators|media)$/i.test(who || "");
    if (isCC && p.account) { who = `@${p.account}`; crest = null; }
    const owner = window.SCP_LIB_SCOPE?.who?.(p.id);   // My Club: the player's / sponsor's name
    if (owner) { who = owner; crest = null; }
    const video = isVideo(p);
    const favClub = (p.tags?.club || []).find((v) => me.fav.has(Number(v.id)));
    const fmt = pretty(first(p, "format"));
    const name = PLATFORM_NAMES[pf] || "the platform";
    const fav = favClub ? `<span class="lib-badge lib-badge-fav" tabindex="0">${icon("star")}<span class="lib-fav-lbl">${tx("Following")}</span><span class="lib-tip" role="tooltip">${tx("{club} is one of your favourite profiles (Favs). Change them in Profile → Favourites.", { club: esc(favClub.name || "") })}</span></span>` : "";
    const corner = `<div class="lib-corner">${pf ? `<span class="lib-pfchip" title="${esc(PLATFORM_NAMES[pf] || pf)}"><i class="lf-pfi is-brand lf-pf-${esc(pf)}" style="-webkit-mask-image:url(assets/pf-${esc(pf)}.svg);mask-image:url(assets/pf-${esc(pf)}.svg)"></i></span>` : ""}${fav}</div>`;
    const rail = `
          <div class="lib-rail">
            <button class="lib-grip" type="button" data-pp-grip="${esc(p.id)}" data-tip="${esc(tx("Drag to your Content Plan"))}" aria-label="${esc(tx("Drag to your Content Plan"))}">${icon("grip-vertical")}</button>
            ${saveBtn(p.id)}
            <button class="lib-ai" type="button" data-open="${esc(p.id)}" data-tip="${esc(tx("AI analysis"))}" aria-label="${esc(tx("AI analysis"))}">${icon("sparkles")}</button>
            <button class="lib-share" type="button" data-share-post="${esc(p.id)}" data-tip="${esc(tx("Public link to this post"))}" aria-label="${esc(tx("Public link to this post"))}">${icon("link")}</button>
            ${me.isSuper ? `<button class="lib-remove" type="button" data-remove="${esc(p.id)}" data-tip="Remove (superadmin)" aria-label="Remove from the library">${icon("trash-2")}</button>` : ""}
          </div>`;
    const foot = `
        <div class="lib-foot" data-open="${esc(p.id)}"${isCC ? ` data-cc="${esc(p.id)}"` : ""} role="button" tabindex="-1">
          ${footCrest(crest, who)}
          <span class="lib-foot-who"><b>${esc(who || name)}</b><small>${date(p.published_at)}</small></span>
          <span class="lib-foot-stats" data-stats="${esc(p.id)}">${footStats(p)}</span>
        </div>`;

    // Instagram reel with licensed music: Instagram only plays it in its app (ig-rights). The card stays as it is, with a
    // strip at the bottom that says why (on hover) and opens the post on Instagram in a new window
    const igNote = pf === "instagram" && p.ig_blocked ? `<a class="lib-ignote" href="${esc(p.url || "")}" target="_blank" rel="noopener">${icon("music")}<span>${tx("Music with copyright · Watch on Instagram")}</span>${icon("external-link")}<span class="lib-igtip" role="tooltip">${tx("This reel uses licensed music, and Instagram only lets it play inside its app. That's why it can't be watched here: it opens on Instagram in a new window.")}</span></a>` : "";

    // X, LinkedIn and Facebook: always the post itself, so the text can be read and videos played in place
    const asPosted = pf === "x" || pf === "linkedin" || pf === "facebook";
    if (p.cover_url && !asPosted) {
      return `
      <article class="lib-card has-cover" data-id="${esc(p.id)}">
        <div class="lib-media" style="aspect-ratio: 1 / ${mediaRatio(p).toFixed(4)}">
          <img class="lib-cover-img" src="${esc(p.cover_url)}" alt="${esc(who || "Post")}" loading="lazy" decoding="async">
          ${video && playerSrc(p)   // a video: a click anywhere on its cover plays it in place (the details open from the footer / ✨)
            ? `<button class="lib-hit" type="button" data-play="${esc(p.id)}" aria-label="${esc(tx("Play video"))}${who ? ` · ${esc(who)}` : ""}"></button>`
            : `<button class="lib-hit" type="button" data-open="${esc(p.id)}" aria-label="Details${who ? ` · ${esc(who)}` : ""}"></button>`}
          ${video ? `<button class="lib-playbtn" type="button" data-play="${esc(p.id)}" aria-label="Play video">${icon("play")}</button>` : ""}
          ${!video && pf === "instagram" && (/carousel/i.test(fmt) || /carousel|sidecar/i.test(p.media_type || "")) ? `<button class="lib-carbtn" type="button" data-play="${esc(p.id)}" aria-label="${esc(tx("See the carousel"))}" title="${esc(tx("See the carousel"))}">${icon("chevron-right")}</button><span class="lib-cardots" aria-hidden="true"><i></i><i></i><i></i></span>` : ""}
          ${fmt || p.duration_s ? `<span class="lib-fmt">${video ? icon("play") : ""}${esc([fmt, p.duration_s ? mmss(p.duration_s) : ""].filter(Boolean).join(" · "))}</span>` : ""}
          ${igNote}${corner}${rail}
        </div>${foot}${aiPeek(p.id)}
      </article>`;
    }

    // No stored cover (and X, LinkedIn, Facebook): the post itself, as the platform shows it (as the library did until
    // 20/10). Not TikTok (its player is throttled when many load at once: "ratelimit triggered") nor YouTube (its own
    // image is free): those keep the poster below, and the player loads on ▶.
    const sh = shape(p);
    // an Instagram post the platform no longer embeds (gone_at, supabase/gone-not-hidden.sql): the drawn card, never a broken embed
    const gone = pf === "instagram" && !!p.gone_at;
    const src = pf !== "tiktok" && pf !== "youtube" && !gone ? previewSrc(p) : "";
    if (src) {
      const zoomStyle = sh.zoom ? ` style="--zoom:${sh.zoom.toFixed(4)};--inset:${((1 - sh.boxFrac) / 2 * 100).toFixed(3)}%"` : "";
      return `
      <article class="lib-card is-embed" data-id="${esc(p.id)}">
        <div class="lib-media${sh.zoom ? " is-reel" : ""}" style="aspect-ratio: 1 / ${sh.ratio.toFixed(4)}">
          <div class="lib-zoom"${zoomStyle}><iframe class="lib-frame${pf === "instagram" ? " is-ig" : ""}" src="${esc(src)}" loading="lazy" title="${esc(who || "Post")}" scrolling="no" allow="encrypted-media; picture-in-picture; fullscreen"></iframe></div>
          ${asPosted
            // the tweet's own video / image stays clickable (plays in place); its header, text and bottom open the detail
            ? `<button class="lib-hit lib-hit-top" type="button" data-open="${esc(p.id)}" aria-label="Details${who ? ` · ${esc(who)}` : ""}"></button><button class="lib-hit lib-hit-bottom" type="button" data-open="${esc(p.id)}" tabindex="-1" aria-hidden="true"></button>`
            : `<button class="lib-hit" type="button" data-open="${esc(p.id)}" aria-label="Details${who ? ` · ${esc(who)}` : ""}"></button>`}
          ${igNote}${rail}
        </div>${asPosted ? "" : foot}${aiPeek(p.id)}
      </article>`;
    }
    return `
      <article class="lib-card is-poster" data-id="${esc(p.id)}">
        <div class="lib-media" style="aspect-ratio: 1 / ${sh.ratio.toFixed(4)}">
          ${posterHtml(p, who)}
          ${video && playerSrc(p) && !gone   // a video: a click anywhere on its cover plays it in place (the details open from the footer / ✨)
            ? `<button class="lib-hit" type="button" data-play="${esc(p.id)}" aria-label="${esc(tx("Play video"))}${who ? ` · ${esc(who)}` : ""}"></button>`
            : `<button class="lib-hit" type="button" data-open="${esc(p.id)}" aria-label="Details${who ? ` · ${esc(who)}` : ""}"></button>`}
          ${gone ? `<a class="lib-ignote is-gone" href="${esc(p.url || "")}" target="_blank" rel="noopener">${icon("external-link")}<span>${tx("Watch on Instagram")}</span></a>`
            : playerSrc(p) ? `<button class="lib-playbtn${video ? "" : " is-view"}" type="button" data-play="${esc(p.id)}" aria-label="${esc(video ? tx("Play video") : tx("Show the post"))}">${icon(video ? "play" : "eye")}</button>` : ""}
          ${fmt || p.duration_s ? `<span class="lib-fmt">${video ? icon("play") : ""}${esc([fmt, p.duration_s ? mmss(p.duration_s) : ""].filter(Boolean).join(" · "))}</span>` : ""}
          ${gone ? "" : igNote}${corner}${rail}
        </div>${foot}${aiPeek(p.id)}
      </article>`;
  }

  // Poster for a post with no stored cover: a cover that costs the platform nothing to give (stored cover, YouTube's
  // image, TikTok's oEmbed thumbnail) or, if there is none, a card drawn here (network, who, first line of the text).
  // Nothing from the post itself is loaded until ▶ (platforms throttle embeds: TikTok answers "ratelimit triggered").
  function posterHtml(p, who) {
    const pf = platformOf(p);
    const u = p.url || ""; let m;
    const text = String(p.title || "").replace(/\s+/g, " ").trim();
    // the drawn card is always underneath: it shows if the image is missing or fails
    const ph = `<div class="lib-ph lib-ph-${esc(pf || "post")}">${who ? `<b>${esc(who)}</b>` : ""}${text ? `<p>${esc(text.length > 160 ? text.slice(0, 157) + "…" : text)}</p>` : ""}</div>`;
    const img = p.cover_url || ((m = u.match(/(?:shorts\/|v=|youtu\.be\/)([\w-]{11})/)) ? `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` : "");
    if (img) return `${ph}<div class="lib-cover" data-cover-box><img class="is-loaded" src="${esc(img)}" alt="" loading="lazy" decoding="async"></div>`;
    if (pf === "tiktok" && u) return `${ph}<div class="lib-cover" data-cover-box><img data-oembed="${esc(u)}" alt=""></div>`;
    return ph;
  }
  // a cover that fails to load leaves the drawn card visible
  document.addEventListener("error", (e) => { const box = e.target?.tagName === "IMG" && e.target.closest("[data-cover-box]"); if (box) box.classList.add("no-cover"); }, true);
  // a footer logo / profile picture that fails to load becomes the initials
  document.addEventListener("error", (e) => { const c = e.target?.tagName === "IMG" && e.target.closest(".lib-crest[data-ini]"); if (c) { c.className = "lib-crest is-initials"; c.innerHTML = `<b>${esc(c.dataset.ini)}</b>`; } }, true);


  // ▶ on a cover: the platform's player inside the card (TikTok asks for its cookie consent the first time)
  function playerSrc(p) {
    const u = p.url || ""; let m;
    if ((m = u.match(/instagram\.com\/(?:[\w.]+\/)?(p|reel|tv)\/([\w-]+)/))) return { src: `https://www.instagram.com/${m[1]}/${m[2]}/embed/`, ig: true };
    if ((m = u.match(/tiktok\.com\/.*video\/(\d+)/))) return { src: `https://www.tiktok.com/player/v1/${m[1]}?autoplay=1&music_info=0&description=0&rel=0&controls=1` };
    if ((m = u.match(/(?:shorts\/|v=|youtu\.be\/)([\w-]{11})/))) return { src: `https://www.youtube-nocookie.com/embed/${m[1]}?autoplay=1&playsinline=1` };
    if ((m = u.match(/(?:twitter|x)\.com\/[^/]+\/status\/(\d+)/))) return { src: `https://platform.twitter.com/embed/Tweet.html?id=${m[1]}&theme=dark&dnt=true&hideThread=true` };
    if (/facebook\.com\//.test(u)) return { src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(u)}&show_text=false&autoplay=true` };
    if ((m = u.match(/linkedin\.com\/feed\/update\/(urn:li:[\w:]+)/))) return { src: `https://www.linkedin.com/embed/feed/update/${m[1]}?collapsed=1` };
    return null;
  }
  // YouTube / TikTok: the views are read again from the platform when the video is played (Edge Function "views",
  // at most every 6 hours per post); the card shows the new number
  const viewsAsked = new Set();   // also likes and comments (Edge Function "views")
  async function refreshViews(id) {
    const p = cache.get(String(id));
    if (!p || !db || viewsAsked.has(String(id)) || !/tiktok\.com|youtu|instagram\.com/.test(p.url || "")) return;
    viewsAsked.add(String(id));
    const cfg = window.SCP_CONFIG || {}, token = (await db.auth.getSession()).data.session?.access_token;
    const r = await fetch(`${cfg.supabaseUrl}/functions/v1/views`, { method: "POST", headers: { "Content-Type": "application/json", apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: Number(id) }) }).catch(() => null);
    const d = r?.ok ? await r.json().catch(() => null) : null;
    if (!d || (Number(d.views || 0) === Number(p.views || 0) && Number(d.likes || 0) === Number(p.likes || 0))) return;
    if (d.views) p.views = Number(d.views);
    if (d.likes) p.likes = Number(d.likes);
    const box = $(`[data-stats="${CSS.escape(String(id))}"]`);
    if (box) box.innerHTML = footStats(p);
  }
  function playInCard(id) {
    refreshViews(id);
    const p = cache.get(String(id));
    const media = $(`.lib-card[data-id="${CSS.escape(String(id))}"] .lib-media`);
    const pl = p && playerSrc(p);
    if (!media || !pl) return openPost(id);
    // Instagram's player is a 4:5 box with its white footer under it: wide enough to fill the card's height, centred
    // (only black bars are cut at the sides), so the footer stays below the card
    let ig = "";
    if (pl.ig) { const W = media.clientWidth, H = media.clientHeight, w = Math.min(540, Math.max(W, Math.ceil(H / 1.25))); ig = ` style="width:${w}px;left:${Math.round((W - w) / 2)}px"`; }
    media.classList.add("is-playing");
    media.insertAdjacentHTML("beforeend", `<div class="lib-player${pl.ig ? " is-ig" : ""}"><iframe${ig} src="${esc(pl.src)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen scrolling="no" title="Video"></iframe>
      <button class="lib-stop" type="button" data-stop="${esc(id)}" aria-label="Close the video">${icon("x")}</button></div>`);
  }
  function stopInCard(id) {
    const media = $(`.lib-card[data-id="${CSS.escape(String(id))}"] .lib-media`);
    media?.querySelector(".lib-player")?.remove();
    media?.classList.remove("is-playing");
  }

  // ---------- AI analyses: credits & unlocks (supabase/billing.sql) ----------
  // Unlocking spends 1 credit (monthly units first, then packs); re-opening an unlocked analysis is free.
  // 1 credit = 1 AI analysis. "credit" is the internal name only: on screen it is always "analyses".
  const ai = { ent: null, unlocked: new Set(), mine: new Map(), team: new Map() };
  async function loadAi() {
    const [{ data: ent }, { data: ids }] = await Promise.all([window.SCP_entitlements(), db.rpc("my_unlocked_posts")]);
    ai.ent = ent || null;
    // the plan's permissions (staff "view as" a plan: the permissions of that plan, auth.js)
    if (ai.ent) { perms = { staff: !!ai.ent.is_staff, list: ai.ent.entitlements || [] }; if (catalog.byId.size) renderFacets(); }
    ai.unlocked = new Set((ids || []).map(Number));
    if (!ai.ent?.has_ai) { renderAiMine(); return; }
    // "My AI analyses": the analyses themselves (readable by whoever unlocked them) and the ones of my team (supabase/ai-team.sql)
    // only MY unlocks: admins may read everyone's (RLS), so the user is always named here
    const uid = (await db.auth.getSession()).data.session?.user?.id;
    if (!uid) { ai.mine = new Map(); ai.team = new Map(); renderAiMine(); return; }
    const [mine, team] = await Promise.all([
      db.from("user_ai_unlocks").select("post_id,completed_at,ai_analyses(result)").eq("user_id", uid).eq("status", "completed").order("completed_at", { ascending: false }).then((r) => r.data || [], () => []),
      db.rpc("team_ai_analyses").then((r) => (r.error ? [] : r.data || []), () => []),
    ]);
    ai.mine = new Map(mine.filter((r) => r.ai_analyses?.result).map((r) => [Number(r.post_id), { at: r.completed_at, result: r.ai_analyses.result }]));
    ai.team = new Map(team.filter((r) => !ai.mine.has(Number(r.post_id))).map((r) => [Number(r.post_id), { at: r.at, by: r.by, result: r.result }]));
    renderAiMine();
    // Menu → Platform → AI analysis opens the library on "My AI analyses"
    if (/[?&]ai=mine\b/.test(location.search) && !ui.aiMode) setAiMode("mine");
  }
  const credits = () => (ai.ent ? (ai.ent.monthly_left || 0) + (ai.ent.pack_left || 0) : 0);

  // ---------- "My AI analyses": only the posts I (or my team) analysed, with the analysis in the card ----------
  const aiList = () => (ui.aiMode === "team" ? ai.team : ai.mine);
  function renderAiMine() {
    const b = $("[data-ai-mine]");
    if (!b) return;
    const locked = !!ai.ent && !ai.ent.has_ai;
    b.hidden = !ai.ent;
    b.classList.toggle("is-locked", locked);
    $("[data-plan-toggle]")?.classList.toggle("is-locked", !!ai.ent && !ai.ent.has_planner);
    b.setAttribute("aria-pressed", String(!!ui.aiMode));
    const n = $("[data-ai-mine-n]", b), rem = credits();
    n.textContent = ai.ent?.is_staff ? "∞" : String(rem);
    n.classList.toggle("is-out", !ai.ent?.is_staff && rem === 0);
    b.title = locked ? tx("Not in your plan") : ai.ent?.is_staff ? tx("AI · team access") : tx(rem === 1 ? "{n} analysis left" : "{n} analyses left", { n: rem });
    root.classList.toggle("ai-mode", !!ui.aiMode);
    const strip = $("[data-ai-strip]");
    if (!ui.aiMode) { strip.hidden = true; return; }
    strip.hidden = false;
    const left = credits();
    strip.innerHTML = `<div class="ai-strip-tabs" role="tablist">
        <button type="button" role="tab" aria-selected="${ui.aiMode === "mine"}" data-ai-tab="mine">${esc(tx("Mine"))} <em>${ai.mine.size}</em></button>
        ${ai.team.size ? `<button type="button" role="tab" aria-selected="${ui.aiMode === "team"}" data-ai-tab="team">${esc(tx("My team's"))} <em>${ai.team.size}</em></button>` : ""}
      </div>
      <p class="ai-strip-tip">${icon("grip-vertical")}${esc(tx("Drag a post to your Content Plan: the AI's adaptation goes into its notes."))}</p>
      <div class="ai-strip-end">
        ${ai.ent.is_staff ? "" : `<span class="ai-strip-left">${esc(tx(left === 1 ? "{n} analysis left" : "{n} analyses left", { n: left }))} · <a href="profile.html#billing">${esc(tx("Get more"))}</a></span>`}
        <button class="pill" type="button" data-ai-pdf ${aiList().size ? "" : "disabled"}>${icon("download")}${esc(tx("Download as PDF"))}</button>
      </div>`;
  }
  function setAiMode(mode) {
    ui.aiMode = mode;
    renderAiMine();
    load(true);
  }
  // the AI's "how to adapt it" for a post I or my team analysed (the Content Plan puts it in the entry's notes)
  // an analysis in the page's language: in Spanish its Spanish version (result.es) once it exists (ai-analyze, lang "es")
  const inLang = (a) => (window.SCP_LANG === "es" && a?.es ? { ...a, ...a.es } : a);
  const esAsked = new Map();
  function toSpanish(id) {
    if (!esAsked.has(id)) esAsked.set(id, (async () => {
      const { data: { session } } = await db.auth.getSession();
      const cfg = window.SCP_CONFIG;
      const r = await fetch(`${cfg.supabaseUrl}/functions/v1/ai-analyze`, { method: "POST",
        headers: { "Content-Type": "application/json", apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ post_id: id, lang: "es" }) }).catch(() => null);
      const d = r?.ok ? await r.json().catch(() => null) : null;
      return d?.es || null;
    })());
    return esAsked.get(id);
  }
  const aiAdapt = (id) => { const r = inLang((ai.mine.get(Number(id)) || ai.team.get(Number(id)))?.result); return r?.replicable?.howToAdapt ? `AI · ${r.replicable.howToAdapt}` : ""; };
  // in the card: the hook and why it works, without opening it
  function aiPeek(id) {
    if (!ui.aiMode) return "";
    const it = aiList().get(Number(id));
    const r = inLang(it?.result);
    if (!r) return "";
    const why = r.hook?.whyItWorks || r.whyItWorks || r.summary || "";
    return `<div class="lib-ai-peek" data-open="${esc(id)}" role="button" tabindex="-1">
      ${r.hook?.text ? `<q>${esc(r.hook.text)}</q>` : ""}
      ${why ? `<p>${esc(why.length > 150 ? `${why.slice(0, 148)}…` : why)}</p>` : ""}
      <small>${icon("sparkles")}${it.by ? esc(tx("Analysed by {name}", { name: it.by })) : esc(tx("Your analysis"))} · ${esc(date(it.at))}</small></div>`;
  }
  // every analysis of the list in one printable page (the browser saves it as PDF)
  async function aiPdf() {
    const list = [...aiList().entries()];
    if (!list.length) return;
    const { data } = await db.from("content_ideas").select("id,url,title").in("id", list.map(([id]) => id));
    const post = new Map((data || []).map((x) => [Number(x.id), x]));
    const w = window.open("", "_blank");
    if (!w) return toast(tx("Allow pop-ups to download the PDF."));
    const sec = (t, v) => (v ? `<h3>${esc(tx(t))}</h3><p>${esc(v)}</p>` : "");
    w.document.write(`<!doctype html><html lang="${document.documentElement.lang}"><head><meta charset="utf-8"><title>${esc(tx("My AI analyses"))} · Sports Content Playbook</title>
      <style>body{font:14px/1.5 -apple-system,Segoe UI,Inter,sans-serif;color:#121b33;margin:40px auto;max-width:760px;padding:0 20px}h1{font-size:24px;margin:0 0 4px}h2{font-size:17px;margin:0 0 6px}
      h3{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#7b5cff;margin:12px 0 2px}p{margin:0}article{padding:18px 0;border-top:1px solid #dde3ee;break-inside:avoid}
      q{display:block;font-size:16px;font-weight:600;margin:4px 0}a{color:#7b5cff;font-size:12px}.m{color:#6b7488;font-size:12px;margin-bottom:22px}</style></head><body>
      <h1>${esc(tx(ui.aiMode === "team" ? "My team's AI analyses" : "My AI analyses"))}</h1><p class="m">Sports Content Playbook · ${esc(new Date().toLocaleDateString(window.SCP_LOC || "en-GB"))} · ${list.length}</p>
      ${list.map(([id, it]) => { const r = inLang(it.result) || {}, p = post.get(id) || {}; return `<article><h2>${esc((p.title || "Post").slice(0, 90))}</h2>
        ${p.url ? `<a href="${esc(p.url)}">${esc(p.url)}</a>` : ""}${r.hook?.text ? `<h3>${esc(tx("Hook"))}</h3><q>${esc(r.hook.text)}</q>` : ""}
        ${sec("Summary", r.summary)}${sec("Why it works", r.whyItWorks)}${sec("How to adapt it to your club", r.replicable?.howToAdapt)}</article>`; }).join("")}
      <script>onload=()=>setTimeout(()=>print(),300)<\/script></body></html>`);
    w.document.close();
  }

  function aiButton(id) {
    const n = Number(id);
    if (ai.ent && !ai.ent.has_ai) return `<button class="lib-analysis is-locked" type="button" data-open="${esc(id)}">${icon("lock")}<span>AI Analysis</span>${icon("arrow-up-right")}</button>`;
    if (ai.unlocked.has(n)) return `<button class="lib-analysis is-ready" type="button" data-open="${esc(id)}">${icon("sparkles")}<span>View AI Analysis</span>${icon("arrow-up-right")}</button>`;
    return `<button class="lib-analysis" type="button" data-open="${esc(id)}">${icon("sparkles")}<span>Unlock AI Analysis</span>${icon("arrow-up-right")}</button>`;
  }
  const refreshAiButtons = (id) => $$(`.lib-card[data-id="${CSS.escape(String(id))}"] .lib-analysis`).forEach((b) => (b.outerHTML = aiButton(id)));

  // The Content Plan panel (js/plan-panel.js) reads the posts shown here
  window.SCP_LIB = { post: (id) => cache.get(String(id)), adapt: (id) => aiAdapt(id) };

  // ---------- Masonry: N columns, each card goes to the shortest one (heights known from the ratios) ----------
  const GAP = 22;
  let cols = [], colH = [], placed = [];
  // YouTube only (or Facebook videos only): a grid like YouTube's own — a Short takes one lane, a horizontal video two,
  // so two Shorts are as wide as one video. Whole rows of one kind (a row of videos, a row of Shorts): every card in a
  // row is as tall as the others, so no gaps. Cards wait in a queue until a row is full; the rest show at the end.
  let ytGrid = 0;   // the number of lanes when this layout is on, 0 otherwise
  let ytQ = { v: [], s: [] }, ytSeq = 0;
  function columnCount() {
    const w = grid.clientWidth - parseFloat(getComputedStyle(grid).paddingLeft) - parseFloat(getComputedStyle(grid).paddingRight);
    // as many ~240px columns as fit (with or without the filters column), up to 6 on very wide screens
    const pfs = [...(selected.platform || [])].map((id) => catalog.byId.get(id)?.name.toLowerCase());
    const fmts = [...(selected.format || [])].map((id) => catalog.byId.get(id)?.name.toLowerCase());
    // horizontal videos (YouTube, Facebook videos) need wide cards: 3 columns at most
    const ytOnly = pfs.length === 1 && (pfs[0] === "youtube" || (pfs[0] === "facebook" && fmts.length === 1 && fmts[0] === "video"));
    if (ytOnly) { const n = Math.min(6, Math.floor((w + GAP) / (150 + GAP))); return -Math.max(2, n - (n % 2)); }   // negative: lanes of the YouTube grid (even)
    return Math.max(1, Math.min(6, Math.floor((w + GAP) / (240 + GAP))));
  }
  function buildColumns(n) {
    grid.innerHTML = "";
    ytGrid = n < 0 ? -n : 0;
    grid.classList.toggle("masonry", !ytGrid);
    grid.classList.toggle("ytgrid", !!ytGrid);
    grid.style.gridTemplateColumns = ytGrid ? `repeat(${ytGrid}, minmax(0, 1fr))` : "";
    ytQ = { v: [], s: [] };
    cols = ytGrid ? [] : Array.from({ length: n }, () => grid.appendChild(Object.assign(document.createElement("div"), { className: "mcol" })));
    colH = cols.map(() => 0);
  }
  // the full rows waiting in the queues, in the order their first card came (all = the rest too: the list has ended)
  function ytFlush(all = false) {
    const per = { v: ytGrid / 2, s: ytGrid };
    for (;;) {
      const ready = ["v", "s"].filter((k) => ytQ[k].length >= per[k] || (all && ytQ[k].length)).sort((a, b) => ytQ[a][0].seq - ytQ[b][0].seq);
      if (!ready.length) break;
      ytQ[ready[0]].splice(0, per[ready[0]]).forEach(({ el }) => grid.appendChild(el));
    }
    window.SCP_COVERS?.observe(grid);
  }
  function place(el, ratio) {
    if (ytGrid) {   // a horizontal video (shorter than wide) takes two lanes, a Short one
      const short = ratio >= 1;
      el.style.gridColumn = short ? "span 1" : "span 2";
      el.classList.toggle("is-lane", short);   // one lane wide (a Short)
      ytQ[short ? "s" : "v"].push({ el, seq: ytSeq++ });
      return;
    }
    const i = colH.indexOf(Math.min(...colH));
    cols[i].appendChild(el);
    colH[i] += ratio + 0.25; // + caption / button area
  }
  // Facebook's embed doesn't tell its height: the Edge Function fb-shape reads the post's image size (12 posts per call)
  // and stores it, so the card takes the embed's real shape (no empty space under a landscape photo, no cut video)
  const fbWait = new Map(); let fbTimer = 0;
  function fbShapeQueue(row, el, pe) {
    fbWait.set(String(row.id), { row, el, pe });
    clearTimeout(fbTimer); fbTimer = setTimeout(fbShapeFlush, 400);
  }
  async function fbShapeFlush() {
    const cfg = window.SCP_CONFIG || {};
    while (fbWait.size) {
      const batch = [...fbWait.keys()].slice(0, 12);
      const r = await fetch(`${cfg.supabaseUrl}/functions/v1/fb-shape`, { method: "POST", headers: { "Content-Type": "application/json", apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}` }, body: JSON.stringify({ ids: batch.map(Number) }) }).then((x) => (x.ok ? x.json() : {})).catch(() => ({}));
      batch.forEach((id) => {
        const w = fbWait.get(id); fbWait.delete(id);
        const ratio = Number(r?.[id]);
        if (!w || !ratio) return;
        if (ratio < 0) return w.el.remove();   // no longer on Facebook: marked unavailable, out of the library
        const k = Math.min(16 / 9, Math.max(9 / 16, ratio));
        w.row.media_ratio = k; w.pe.ratio = k;
        const m = w.el.querySelector(".lib-media");
        if (m) m.style.aspectRatio = `1 / ${k.toFixed(4)}`;
      });
    }
  }
  // Instagram posts never checked: ig-rights reads each one's embed once and stores whether it's blocked (licensed
  // music); a blocked one becomes its "watch on Instagram" card at once
  const igWait = new Map(); let igTimer = 0;
  function igRightsQueue(row, el, pe) {
    igWait.set(String(row.id), { row, el, pe });
    clearTimeout(igTimer); igTimer = setTimeout(igRightsFlush, 600);
  }
  async function igRightsFlush() {
    const cfg = window.SCP_CONFIG || {};
    while (igWait.size) {
      const batch = [...igWait.keys()].slice(0, 12);
      const r = await fetch(`${cfg.supabaseUrl}/functions/v1/ig-rights`, { method: "POST", headers: { "Content-Type": "application/json", apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}` }, body: JSON.stringify({ ids: batch.map(Number) }) }).then((x) => (x.ok ? x.json() : {})).catch(() => ({}));
      batch.forEach((id) => {
        const w = igWait.get(id); igWait.delete(id);
        if (!w || typeof r?.[id] !== "boolean") return;
        w.row.ig_blocked = r[id];
        if (!r[id] || !w.el.isConnected) return;
        const t = document.createElement("template");
        t.innerHTML = card(w.row).trim();
        const nw = t.content.firstElementChild;
        w.el.replaceWith(nw); w.pe.el = nw;
      });
    }
  }
  // Instagram posts without a cover: is any of them flagged as not shown by Instagram (gone_at)? → its drawn card instead
  // of the embed. Quiet when the column doesn't exist yet (gone-not-hidden.sql not run).
  async function loadGone(list) {
    if (!list.length || !db) return;
    const { data } = await db.from("content_ideas").select("id,gone_at").in("id", list.map((w) => Number(w.row.id))).not("gone_at", "is", null).then((x) => x, () => ({ data: null }));
    for (const d of data || []) {
      const w = list.find((x) => String(x.row.id) === String(d.id));
      if (!w) continue;
      w.row.gone_at = d.gone_at;
      if (!w.el.isConnected) continue;
      const t = document.createElement("template");
      t.innerHTML = card(w.row).trim();
      const nw = t.content.firstElementChild;
      w.el.replaceWith(nw); w.pe.el = nw;
    }
  }
  function resetGrid() { placed = []; buildColumns(columnCount()); }
  function addCards(rows) {
    const tpl = document.createElement("template");
    tpl.innerHTML = rows.map(card).join("");
    const goneCheck = [];
    [...tpl.content.children].forEach((el, i) => {
      const pfi = platformOf(rows[i]);
      const asPosted = ["x", "linkedin", "facebook"].includes(pfi);
      const ratio = (rows[i].cover_url && !asPosted ? mediaRatio(rows[i]) : shape(rows[i]).ratio) + (asPosted ? 0 : 0.2);   // + the footer
      const pe = { el, ratio };
      placed.push(pe);
      place(el, ratio);
      if (pfi === "instagram" && rows[i].ig_blocked == null) igRightsQueue(rows[i], el, pe);
      if (pfi === "instagram" && !rows[i].cover_url && rows[i].gone_at === undefined) goneCheck.push({ row: rows[i], el, pe });
      // Facebook without a stored cover or shape: its real shape is looked up once (fb-shape) and saved for everyone
      if (pfi === "facebook" && !rows[i].cover_url && !Number(rows[i].media_ratio)) fbShapeQueue(rows[i], el, pe);
      // Facebook doesn't say a video's shape: its stored cover does (a horizontal video gets a horizontal card)
      if (pfi === "facebook" && rows[i].cover_url && !Number(rows[i].media_ratio)) {
        const img = new Image();
        img.onload = () => {
          if (!img.naturalWidth) return;
          const r = Math.min(16 / 9, Math.max(9 / 16, img.naturalHeight / img.naturalWidth));
          rows[i].media_ratio = r;
          const m = el.querySelector(".lib-media");
          if (m) m.style.aspectRatio = `1 / ${r.toFixed(4)}`;
          pe.ratio = r;
        };
        img.src = rows[i].cover_url;
      }
    });
    if (ytGrid) ytFlush();
    window.SCP_COVERS?.observe(grid);
    loadLikes(rows);
    loadGone(goneCheck);
  }
  // Re-flow only when the number of columns changes (moving iframes reloads them)
  new ResizeObserver(() => {
    if (!cols.length && !ytGrid) return;
    const n = columnCount();
    if (ytGrid && n === -ytGrid) return;   // same lanes: rows keep their shape
    if (n === cols.length) return;
    const keep = placed;
    buildColumns(n);
    keep.forEach(({ el, ratio }) => place(el, ratio));
    if (ytGrid) ytFlush(more.hidden);
  }).observe(grid);

  // ---------- Detail drawer ----------
  const drawer = $("[data-drawer]");
  const body = $("[data-drawer-body]");
  const PLATFORM_NAMES = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", x: "X", facebook: "Facebook", linkedin: "LinkedIn" };
  function embedHtml(p) {
    // the post itself, as the platform shows it, straight away (no cover): its embed code, or the platform's player
    const blockquote = /^\s*<blockquote class="(instagram-media|tiktok-embed|twitter-tweet)/.test(p.embed || "");
    if (blockquote) return `<div class="an-embed">${p.embed}</div>`;
    const pl = playerSrc(p) || (previewSrc(p) ? { src: previewSrc(p) } : null);
    if (!pl) return p.url ? `<a class="btn btn-outline" href="${esc(p.url)}" target="_blank" rel="noopener">Open post</a>` : "";
    const vertical = shape(p).ratio > 1.05;
    return `<div class="an-poster is-live${vertical ? " is-vertical" : ""}" data-embed-id="${esc(p.id)}"><iframe src="${esc(pl.src)}" title="Post" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen scrolling="${pl.ig ? "no" : "auto"}"></iframe></div>`;
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
  const stamp = (t, basis) => (basis === "video" ? `${t}s` : Number(t) > 0 ? `#${t}` : "-");

  function analysisHtml(a) {
    if (!a) return `<div class="an-empty">${icon("sparkles")}<div><b>Analysis not available</b><p>Please try again later.</p></div></div>`;
    const fmt = a.format || {};
    const facts = [["Category", fmt.category], ["Type", fmt.type], ["Layout", fmt.visualLayout], ["Pacing", fmt.pacing], ["Moment", MOMENT_NAMES[a.moment]], ["Style", STYLE_NAMES[a.style]]].filter(([, v]) => v);
    return `
      ${a.summary ? `<p class="an-summary">${esc(a.summary)}</p>` : ""}
      <div class="an-grid">
      ${block("Hook", "zap", a.hook ? `
        <blockquote class="an-hook">${esc(a.hook.text || "")}</blockquote>
        ${a.hook.category ? `<span class="an-chip">${esc(a.hook.category)}</span>` : ""}
        ${a.hook.whyItWorks ? `<p>${esc(a.hook.whyItWorks)}</p>` : ""}
        ${a.hook.template ? `<div class="an-template"><span>Template</span><p>${esc(a.hook.template)}</p><button class="an-copy" type="button" data-copy="${esc(a.hook.template)}">${icon("copy")}Copy</button></div>` : ""}` : "", "an-hook-block an-b-hook")}
      ${block("Why it works", "lightbulb", a.whyItWorks ? `<p>${esc(a.whyItWorks)}</p>` : "", "an-b-why")}
      ${block("Format", "layout-grid", facts.length ? `<dl class="an-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : "", "an-b-format")}
      ${block("Angle", "compass", a.angle?.angle || a.angle?.topic ? `${a.angle.topic ? `<span class="an-chip">${esc(a.angle.topic)}</span>` : ""}<p>${esc(a.angle.angle || "")}</p>` : "", "an-b-angle")}
      ${block(a.basis === "video" ? "Visual breakdown" : "Slide by slide", "clapperboard", a.visualBreakdown?.length ? `<ol class="an-timeline">${a.visualBreakdown.map((v) => `<li><span class="an-t">${stamp(v.t, a.basis)}</span><div><b>${esc(v.shot)}</b>${v.onScreenText ? `<q>${esc(v.onScreenText)}</q>` : ""}${v.why ? `<p>${esc(v.why)}</p>` : ""}</div></li>`).join("")}</ol>` : "", "an-b-slides")}
      ${block("Scroll stoppers", "hand", a.scrollStoppers?.length ? `<ul class="an-stoppers">${a.scrollStoppers.map((v) => `<li><span class="an-t">${stamp(v.t, a.basis)}</span><div><b>${esc(v.moment)}</b>${v.why ? `<p>${esc(v.why)}</p>` : ""}</div></li>`).join("")}</ul>` : "", "an-b-stop")}
      ${block(a.replicable?.is === false ? "Hard to replicate" : "How to adapt it to your club", "repeat", a.replicable?.howToAdapt ? `<p>${esc(a.replicable.howToAdapt)}</p>` : "", "an-adapt an-b-adapt")}
      </div>`;
  }
  // the analysis' topics: in the "Tags and caption" drop-down under the post
  const topicsHtml = (a) => (a?.topics?.length ? `<div class="an-topics">${a.topics.map((t) => `<span class="an-chip">${esc(t)}</span>`).join("")}</div>` : "");

  async function openPost(id) {
    const p = cache.get(String(id));
    if (!p) return;
    const who = first(p, "club") || first(p, "competition") || first(p, "entity");
    const groups = CATEGORIES.filter((c) => p.tags?.[c.key]?.length).map((c) => `<div class="dr-tag-row"><dt>${esc(c.label)}</dt><dd>${tagChips(p, [c.key])}</dd></div>`).join("");
    body.dataset.post = p.id;
    body.innerHTML = `
      <div class="an-media">${embedHtml(p)}
        ${groups || p.title ? `<details class="an-more">
          <summary>${icon("tags")}<span>${esc(tx("Tags and caption"))}</span>${icon("chevron-down")}</summary>
          <div class="an-more-body">
          ${p.title ? `<figure class="an-cap"><figcaption><span>${icon("message-circle")}${esc(tx("Caption"))}</span><button class="an-cap-copy" type="button" data-copy="${esc(p.title)}" aria-label="${esc(tx("Copy"))}" title="${esc(tx("Copy"))}">${icon("copy")}<b>Copy</b></button></figcaption><p>${esc(p.title)}</p></figure>` : ""}
          <div class="an-more-sec" data-topics-sec hidden><p class="an-more-h">${esc(tx("Hashtags"))}</p><div data-topics></div></div>
          ${groups ? `<div class="an-more-sec"><p class="an-more-h">${esc(tx("Tags"))}<small>${esc(tx("Click one to see more posts like it"))}</small></p><dl class="dr-tags an-tags">${groups}</dl></div>` : ""}
          </div>
        </details>` : ""}</div>
      <div class="an-info">
        <header class="an-head">
          <span class="an-ai-badge">${icon("sparkles")}${esc(tx("AI analysis"))}</span>
          <p class="an-eyebrow">${esc(pretty(first(p, "format")) || "Post")}${p.published_at ? ` · ${date(p.published_at)}` : ""}</p>
          <h2>${esc(who || "Post")}</h2>
          <div class="an-actions">
            <button class="pill pill-gold" type="button" data-more-like="${esc(p.id)}">${icon("sparkles")}More like this</button>
            ${saveBtn(p.id)}
            <button class="pill an-pdf" type="button" hidden data-an-pdf>${icon("download")}${esc(tx("Download PDF"))}</button>
            ${me.isSuper ? `<button class="pill pill-danger an-remove" type="button" data-remove="${esc(p.id)}" title="${esc(tx("Remove from library"))}" aria-label="${esc(tx("Remove from library"))}">${icon("trash-2")}</button>` : ""}
          </div>
        </header>
        <div data-analysis><div class="an-loading"></div></div>
      </div>`;
    drawer.hidden = false;
    document.body.style.overflow = "hidden";
    runEmbedScript();
    refreshViews(p.id);
    showAnalysisArea(p.id);
  }

  const area = () => body.querySelector("[data-analysis]");
  // the analysis on the right, its topics in the drop-down under the post
  let shown = null;   // the analysis on screen (for its PDF)
  const showAnalysis = (raw, before = "") => {
    const id = Number(body.dataset.post || 0), a = inLang(raw);
    area().innerHTML = before + analysisHtml(a);
    const t = body.querySelector("[data-topics]"); if (t) { t.innerHTML = topicsHtml(a); t.closest("[data-topics-sec]").hidden = !t.innerHTML; }
    shown = a ? { id, a } : null;
    const b = body.querySelector("[data-an-pdf]"); if (b) b.hidden = !a;
    // read in Spanish for the first time: its Spanish version is made now (once per analysis) and shown when ready
    if (raw && !raw.es && window.SCP_LANG === "es" && id) toSpanish(id).then((es) => {
      if (!es) return;
      raw.es = es;
      const mine = ai.mine.get(id)?.result; if (mine) mine.es = es;
      if (Number(body.dataset.post) === id && area()) showAnalysis(raw, before);
    });
  };
  // one analysis as a printable page, laid out like the panel (the browser saves it as PDF)
  function analysisPdf(p, a) {
    const w = window.open("", "_blank");
    if (!w) return toast(tx("Allow pop-ups to download the PDF."));
    const T = (x) => esc(tx(x));
    const sec = (title, html) => (html ? `<section><h3>${T(title)}</h3>${html}</section>` : "");
    const para = (v) => (v ? `<p>${esc(v)}</p>` : "");
    const fmt = a.format || {};
    const facts = [["Category", fmt.category], ["Type", fmt.type], ["Layout", fmt.visualLayout], ["Pacing", fmt.pacing], ["Moment", MOMENT_NAMES[a.moment]], ["Style", STYLE_NAMES[a.style]]].filter(([, v]) => v);
    const who = first(p, "club") || first(p, "competition") || first(p, "entity") || "Post";
    const list = (items, key) => (items?.length ? `<ol>${items.map((v) => `<li><b>${esc(stamp(v.t, a.basis))} · ${esc(v[key])}</b>${v.onScreenText ? `<q>${esc(v.onScreenText)}</q>` : ""}${para(v.why)}</li>`).join("")}</ol>` : "");
    w.document.write(`<!doctype html><html lang="${document.documentElement.lang}"><head><meta charset="utf-8"><title>${esc(who)} · ${T("AI analysis")} · Sports Content Playbook</title>
      <style>@page{margin:16mm}body{font:13px/1.55 -apple-system,Segoe UI,Inter,sans-serif;color:#121b33;margin:0 auto;max-width:820px;padding:24px}
      header{display:flex;gap:20px;align-items:flex-start;padding-bottom:16px;border-bottom:2px solid #8b5cf6;margin-bottom:16px}
      header img{width:150px;border-radius:10px;object-fit:cover}.tag{display:inline-block;padding:3px 10px;border-radius:99px;background:#8b5cf6;color:#fff;font-size:11px;font-weight:700}
      h1{font-size:24px;margin:8px 0 2px}.m{color:#6b7488;font-size:12px}a{color:#7c3aed;font-size:12px;word-break:break-all}
      .sum{font-size:14px;margin:0 0 14px}.grid{columns:2;column-gap:18px}section{break-inside:avoid;margin:0 0 14px;padding:12px 14px;border:1px solid #e3dcfb;border-radius:10px;background:#faf8ff}
      h3{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#7c3aed;margin:0 0 6px}p{margin:4px 0}q{display:block;font-weight:600;font-size:15px;margin:2px 0 6px}
      .chip{display:inline-block;margin:2px 4px 2px 0;padding:2px 9px;border-radius:99px;background:#efe9ff;color:#5b3fc4;font-size:11px}
      dl{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:0}dt{font-size:10px;text-transform:uppercase;color:#6b7488}dd{margin:0}ol{margin:0;padding-left:16px}li{margin:0 0 6px}
      .tpl{margin-top:6px;padding:8px;border:1px dashed #c9bdf5;border-radius:8px}footer{margin-top:18px;color:#6b7488;font-size:11px}</style></head><body>
      <header>${p.cover_url ? `<img src="${esc(p.cover_url)}" alt="">` : ""}<div><span class="tag">✦ ${T("AI analysis")}</span><h1>${esc(who)}</h1>
        <p class="m">${esc(pretty(first(p, "format")) || "Post")}${p.published_at ? ` · ${esc(date(p.published_at))}` : ""}</p>${p.url ? `<a href="${esc(p.url)}">${esc(p.url)}</a>` : ""}</div></header>
      ${a.summary ? `<p class="sum">${esc(a.summary)}</p>` : ""}
      <div class="grid">
      ${sec("Hook", a.hook ? `${a.hook.text ? `<q>“${esc(a.hook.text)}”</q>` : ""}${a.hook.category ? `<span class="chip">${esc(a.hook.category)}</span>` : ""}${para(a.hook.whyItWorks)}${a.hook.template ? `<div class="tpl"><b>${T("Template")}:</b> ${esc(a.hook.template)}</div>` : ""}` : "")}
      ${sec("Why it works", para(a.whyItWorks))}
      ${sec("Format", facts.length ? `<dl>${facts.map(([k, v]) => `<div><dt>${T(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : "")}
      ${sec("Angle", a.angle?.angle || a.angle?.topic ? `${a.angle.topic ? `<span class="chip">${esc(a.angle.topic)}</span>` : ""}${para(a.angle.angle)}` : "")}
      ${sec(a.basis === "video" ? "Visual breakdown" : "Slide by slide", list(a.visualBreakdown, "shot"))}
      ${sec("Scroll stoppers", list(a.scrollStoppers, "moment"))}
      ${sec(a.replicable?.is === false ? "Hard to replicate" : "How to adapt it to your club", para(a.replicable?.howToAdapt))}
      </div>
      ${a.topics?.length ? `<p>${a.topics.map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</p>` : ""}
      <footer>Sports Content Playbook · ${esc(new Date().toLocaleDateString(window.SCP_LOC || "en-GB"))}</footer>
      <script>onload=()=>setTimeout(()=>print(),400)<\/script></body></html>`);
    w.document.close();
  }
  body.addEventListener("click", (e) => {
    if (!e.target.closest("[data-an-pdf]") || !shown) return;
    const p = cache.get(String(shown.id));
    if (p) analysisPdf(p, shown.a);
  });
  const balanceLine = () => ai.ent?.is_staff ? tx("Team access: unlimited analyses.")
    : ai.ent?.pack_left ? tx(credits() === 1 ? "You have <b>{n} analysis</b> left ({m} monthly + {p} from packs)." : "You have <b>{n} analyses</b> left ({m} monthly + {p} from packs).", { n: credits(), m: ai.ent.monthly_left, p: ai.ent.pack_left })
    : tx(credits() === 1 ? "You have <b>{n} analysis</b> left this month." : "You have <b>{n} analyses</b> left this month.", { n: credits() });
  async function showAnalysisArea(id) {
    const n = Number(id);
    if (!ai.ent) await loadAi().catch(() => {});
    if (!area()) return;
    if (!ai.ent?.has_ai) {
      area().innerHTML = `<div class="ai-gate">${icon("lock")}<div><b>AI analyses are part of every plan</b>
        <p>Hook, why it works, format, angle, visual breakdown and how to adapt it to your club, for any post in the library.</p>
        <button class="btn btn-gold" type="button" data-plans-picker="ai.analyze_posts" aria-expanded="false">${esc(tx("Get AI analyses"))}</button>
        <div class="pp-plans" data-plans-picker-list hidden></div></div></div>`;
      return;
    }
    if (ai.unlocked.has(n)) return loadUnlocked(n);
    if (ai.team.has(n)) {   // a teammate already analysed it: free to read
      const t = ai.team.get(n);
      showAnalysis(t.result, `<p class="ai-team-note">${icon("users")}${esc(tx("Analysed by {name} from your team", { name: t.by }))}</p>`);
      return;
    }
    area().innerHTML = `<div class="ai-unlock">
      <div class="ai-unlock-top">${icon("sparkles")}<div><b>AI analysis of this post</b><p>Hook, why it works, format, angle, visual breakdown and how to adapt it to your club.</p></div></div>
      ${credits() > 0 || ai.ent.is_staff
        ? `<button class="btn btn-gold ai-unlock-btn" type="button" data-unlock="${n}">${icon("sparkles")}Unlock AI Analysis</button>
           <p class="ai-balance">${balanceLine()} ${tx("Once unlocked, you can open it again for free.")}</p>`
        : noCreditsHtml()}
    </div>`;
  }
  const noCreditsHtml = () => `<div class="ai-empty"><b>You've used all your AI analyses</b>
    <p>${tx("Your monthly analyses renew on {date}. Need more now?", { date: ai.ent?.cycle_end ? new Date(ai.ent.cycle_end).toLocaleDateString(window.SCP_LOC || "en-GB", { day: "numeric", month: "long" }) : tx("your next billing date") })}</p>
    <div class="ai-empty-actions"><a class="btn btn-gold" href="pricing.html#packs">Buy an analysis pack</a><a class="btn btn-outline" href="pricing.html">Upgrade your plan</a></div></div>`;
  function generating(text = "Unlocking the analysis…") {
    area().innerHTML = `<div class="ai-working"><span class="ai-spinner"></span><div><b>${text}</b><p>Reading the post, the hook and the format. This can take up to a minute.</p></div></div>`;
  }
  async function loadUnlocked(n) {
    const { data } = await db.rpc("get_unlocked_analysis", { p_post_id: n });
    if (!area()) return;
    if (data?.status === "unlocked") { showAnalysis(data.analysis); return; }
    if (data?.status === "pending") return waitFor(n);
    if (data?.status === "failed") { ai.unlocked.delete(n); refreshAiButtons(n); return showAnalysisArea(n); }
    showAnalysis(null);
  }
  // A pending unlock: ask the server to generate it (only the first request actually runs) and poll until it's ready
  async function waitFor(n) {
    generating();
    const { data: { session } } = await db.auth.getSession();
    const cfg = window.SCP_CONFIG;
    // the function answers when the analysis is stored: show it right then (polling stays as a backup, e.g. when
    // another user's request is the one generating it)
    let done = false;
    fetch(`${cfg.supabaseUrl}/functions/v1/ai-analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ post_id: n }),
    }).then((r) => r.json()).then((d) => { if (d?.status === "unlocked" || d?.status === "failed") done = true; }).catch(() => null);
    const started = Date.now();
    while (Date.now() - started < 150000) {
      for (let t = 0; t < 15 && !done; t++) await new Promise((r) => setTimeout(r, 100));   // up to 1.5 s, or at once when the function answers
      done = false;
      if (!area()) return;
      const { data } = await db.rpc("get_unlocked_analysis", { p_post_id: n });
      if (data?.status === "unlocked") { showAnalysis(data.analysis); return; }
      if (data?.status === "failed") {
        ai.unlocked.delete(n); refreshAiButtons(n); await loadAi();
        area().innerHTML = `<div class="ai-empty"><b>We couldn't generate this analysis</b><p>It hasn't counted towards your analyses. Please try again in a few minutes.</p>
          <div class="ai-empty-actions"><button class="btn btn-gold" type="button" data-unlock="${n}">Try again</button></div></div>`;
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
    if (data.balance) { ai.ent = data.balance; renderAiMine(); }
    if (data.status === "no_access") return showAnalysisArea(n);
    if (data.status === "no_credits") { area().innerHTML = noCreditsHtml(); return; }
    ai.unlocked.add(n); refreshAiButtons(n);
    if (data.status === "unlocked") { showAnalysis(data.analysis); return; }
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
    pop.style.cssText = "position:fixed;z-index:2000;width:300px;max-width:calc(100vw - 24px)"; // works even with a cached stylesheet
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
    t.style.cssText = "position:fixed;z-index:2100;left:50%;bottom:28px;transform:translateX(-50%)";
    t.innerHTML = `<span>${esc(text)}</span>${action ? `<button type="button">${esc(action)}</button>` : ""}`;
    document.body.append(t);
    if (action) t.querySelector("button").addEventListener("click", () => { t.remove(); onAction(); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.remove(), action ? 8000 : 3500);
  }

  document.addEventListener("click", (e) => {
    // public link to one post (post.html?s=…): anyone can open it, even without an account, and sees only that post
    const share = e.target.closest("[data-share-post]");
    if (share) {
      e.preventDefault(); e.stopPropagation();
      (async () => {
        const { data: token, error } = await db.rpc("share_post", { p_id: Number(share.dataset.sharePost) });
        if (error || !token) return toast(error?.message || tx("The link couldn't be made. Try again."));
        const link = new URL(`post.html?s=${token}`, location.href).href;
        try { await navigator.clipboard.writeText(link); toast(tx("Public link copied: whoever opens it sees only this post")); }
        catch { window.prompt(tx("Copy this link"), link); }
      })();
      return;
    }
    const rm = e.target.closest("[data-remove]");
    if (rm && me.isSuper) { e.preventDefault(); e.stopPropagation(); return askRemove(rm, rm.dataset.remove); }
    const tag = e.target.closest("[data-tag]");
    if (tag) return filterByTag(tag.dataset.tag);
    const play = e.target.closest("[data-play]");
    if (play) return playInCard(play.dataset.play);
    const stop = e.target.closest("[data-stop]");
    if (stop) return stopInCard(stop.dataset.stop);
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
    if (e.target.closest("[data-saved-searches], [data-facet-search], [data-lf-search], [data-acct-q], [data-lfb-q], [data-fol-lo], [data-fol-hi]")) return;
    if (e.target.closest("[data-order]")) seed = String(Math.random()).slice(2, 10); // new shuffle each "Surprise me"
    load(true);
  });
  // the Content Plan starts right under the head (search + My space + filter bar), whatever its height
  { const head = $("[data-lib-head]"); new ResizeObserver(() => root.style.setProperty("--lib-head-h", `${head.offsetHeight}px`)).observe(head); }
  // out of analyses: a tab under the button to buy more (and still see the ones you have)
  function outOfAnalyses() {
    let pop = $("[data-ai-out]");
    if (pop) { pop.remove(); return; }
    const b = $("[data-ai-mine]"), r = b.getBoundingClientRect();
    b.insertAdjacentHTML("afterend", `<div class="ai-out" data-ai-out role="dialog" aria-label="${esc(tx("You've used all your AI analyses"))}">
      <b>${esc(tx("You've used all your AI analyses"))}</b>
      <p>${esc(tx("Your monthly analyses renew on {date}. Need more now?", { date: ai.ent?.cycle_end ? new Date(ai.ent.cycle_end).toLocaleDateString(window.SCP_LOC || "en-GB", { day: "numeric", month: "long" }) : tx("your next billing date") }))}</p>
      <a class="btn btn-gold btn-sm" href="pricing.html#packs">${icon("sparkles")}${esc(tx("Buy more analyses"))}</a>
      ${ai.mine.size ? `<button class="btn btn-outline btn-sm" type="button" data-ai-out-see>${esc(tx("See my analyses"))}</button>` : ""}
    </div>`);
    pop = $("[data-ai-out]");
    pop.addEventListener("click", (e) => { if (e.target.closest("[data-ai-out-see]")) { pop.remove(); setAiMode("mine"); } });
    setTimeout(() => document.addEventListener("pointerdown", function off(e) { if (!e.target.closest("[data-ai-out], [data-ai-mine]")) { $("[data-ai-out]")?.remove(); document.removeEventListener("pointerdown", off); } }), 0);
  }
  // a feature not in the plan: a tab under its button saying what it is, with the way to get it
  function lockedPop(b, title, text, feature) {
    let pop = $("[data-ai-out]");
    if (pop) { pop.remove(); return; }
    b.insertAdjacentHTML("afterend", `<div class="ai-out is-locked" data-ai-out role="dialog" aria-label="${esc(title)}">
      <b>${icon("lock")}${esc(title)}</b><p>${esc(text)}</p>
      <button class="btn btn-gold btn-sm" type="button" data-plans-picker="${feature === "ai" ? "ai.analyze_posts" : "planner.access"}" aria-expanded="false">${icon("sparkles")}${esc(tx(feature === "ai" ? "Get AI analyses" : "Get the Content Plan"))}</button>
      <div class="pp-plans" data-plans-picker-list hidden></div>
      <a class="ai-out-plans" href="pricing.html">${esc(tx("Compare all plans"))} →</a></div>`);
    setTimeout(() => document.addEventListener("pointerdown", function off(e) { if (!e.target.closest("[data-ai-out], [data-ai-mine]")) { $("[data-ai-out]")?.remove(); document.removeEventListener("pointerdown", off); } }), 0);
  }
  $("[data-ai-mine]").addEventListener("click", (e) => {
    if (ai.ent && !ai.ent.has_ai) return lockedPop(e.currentTarget, tx("AI analyses aren't in your plan"), tx("Hook, why it works, format, angle and how to adapt it to your club, for any post in the library."), "ai");
    if (!ui.aiMode && ai.ent?.has_ai && !ai.ent.is_staff && credits() === 0) return outOfAnalyses();
    setAiMode(ui.aiMode ? null : "mine");
  });
  $("[data-ai-strip]").addEventListener("click", (e) => {
    const t = e.target.closest("[data-ai-tab]");
    if (t && t.dataset.aiTab !== ui.aiMode) return setAiMode(t.dataset.aiTab);
    if (e.target.closest("[data-ai-pdf]")) aiPdf();
  });
  more.addEventListener("click", () => load(false));
  // endless scroll: the next posts load a little before the end of the page (the button stays as a fallback)
  let nearEnd = false;
  new IntersectionObserver(([en]) => {
    nearEnd = en.isIntersecting;
    if (nearEnd && !more.hidden && !grid.hidden) load(false);
    if (nearEnd) moreCreators();
  }, { rootMargin: "0px 0px 1200px 0px" }).observe(more.parentElement);
  function clearAll() {
    applyState({ order: state().order });
    load(true);
  }
  $("[data-clear]").addEventListener("click", clearAll);

  if (!db) return load(true);
  Promise.all([Promise.all([loadCatalog(), loadViews().catch(() => {})]).then(() => { renderFacets(); drawSugg(); }).catch(() => {}), boards.load(), loadSavedSearches(), loadMe().catch(() => {}), loadAi().catch(() => {})]).then(() => {
    // favourite network (catalog value "platform") goes first in "For you", and its tile first in the filters
    const pv = me.favPlatform && (catalog?.byCat?.platform || []).find((v) => v.name.toLowerCase() === me.favPlatform);
    if (pv && !me.boost.includes(pv.id)) { me.boost = [pv.id, ...me.boost]; renderFacets(); }
    // back where you were after a refresh, unless the link asks for something else (shared filters, a topic, My AI analyses, a post)
    const saved = keep.get();
    const intent = /[?&](topic|ai|f)=/.test(location.search) || location.hash.startsWith("#post=");
    if (linkState) applyState(linkState);   // a shared link: its filters
    else if (saved?.state && !intent && Date.now() - (saved.t || 0) < 12 * 3600e3) {
      restoring = true;
      applyState(saved.state);
      if (saved.seed) seed = saved.seed;
    }
    (async () => {
      await load(true);
      if (restoring) {
        // load as many pages as were showing (at most 10), then go back to the same scroll position
        for (let i = 0; i < 10 && offset < (saved.n || 0) && !more.hidden; i++) await load(false);
        requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, saved.y || 0)));
        setTimeout(() => { restoring = false; saveKeep(); }, 400);
      }
      openFromHash();
    })();
    if (!LAYOUT_BEFORE) loadPlanHints().catch(() => {});
  });

  // "Following" tip: drawn on the page, above the badge (the card cuts off what leaves it), kept inside the screen
  let favTip = null;
  const hideFavTip = () => { favTip?.remove(); favTip = null; };
  const showFavTip = (badge) => {
    const src = badge.querySelector(".lib-tip"); if (!src) return;
    hideFavTip();
    favTip = Object.assign(document.createElement("div"), { className: "lib-tip-float", textContent: src.textContent });
    favTip.setAttribute("role", "tooltip");
    document.body.append(favTip);
    const r = badge.getBoundingClientRect(), w = favTip.offsetWidth, h = favTip.offsetHeight;
    const left = Math.min(Math.max(8, r.left), innerWidth - w - 8);
    const top = r.top - h - 10 >= 8 ? r.top - h - 10 : r.bottom + 10;   // above, or below when there's no room
    favTip.style.left = `${left}px`; favTip.style.top = `${top}px`;
    favTip.classList.toggle("is-below", top > r.top);
  };
  document.addEventListener("mouseover", (e) => { const b = e.target.closest?.(".lib-badge-fav"); if (b) showFavTip(b); });
  document.addEventListener("mouseout", (e) => { const b = e.target.closest?.(".lib-badge-fav"); if (b && !b.contains(e.relatedTarget)) hideFavTip(); });
  document.addEventListener("focusin", (e) => { const b = e.target.closest?.(".lib-badge-fav"); if (b) showFavTip(b); });
  document.addEventListener("focusout", (e) => { if (e.target.closest?.(".lib-badge-fav")) hideFavTip(); });
  addEventListener("scroll", hideFavTip, { passive: true });
})();
