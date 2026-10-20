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
  ];
  // New layout (default): the filters follow the questions a club's social team asks —
  //   What works · Occasion (matchday timeline, transfers, kit…) · Goal & sponsors · Where & how · Inspiration from.
  // ?filters=before shows the previous layout (Discover · Format · Platform · Explore by · Content · Brands) to compare.
  const LAYOUT_BEFORE = /[?&]filters=before\b/.test(location.search);
  // Wide screens: Occasion, Goal and Inspiration open as wide panels from a bar above the posts; the
  // column keeps the one-click shortcuts. ?filters=column shows everything in the column (the previous layout).
  const BAR_OK = !LAYOUT_BEFORE && !/[?&]filters=column\b/.test(location.search);
  const barMode = () => BAR_OK && innerWidth > 900;
  const BAR_SECS = ["occasion", "goal", "benchmark"];   // Where & how stays in the column, under Views
  if (!LAYOUT_BEFORE) {
    const NEW = [
      ["trend", "discover"], ["format", "format"], ["aspect_ratio", "format"], ["duration", "format"], ["language", "format"], ["platform", "platform"],
      ["matchday_graphic", "occasion"], ["outcome", "occasion"], ["opponent", "occasion"],
      ["transfer", "occasion"], ["kit", "occasion"], ["season_moment", "occasion"], ["moment", "occasion"], ["angle", "occasion"],
      ["comms", "occasion", true], ["crisis", "occasion", true],
      ["goal", "goal"], ["sponsor", "goal"], ["sponsor_integration", "goal"], ["sponsor_sector", "goal"], ["cta", "goal", true], ["collab", "goal", true],
      ["sport", "benchmark"], ["competition", "benchmark"], ["club", "benchmark"], ["entity", "benchmark"], ["team", "benchmark"], ["city", "benchmark", true],
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
    { key: "discover", label: "What works", jump: "Works" }, { key: "occasion", label: "Occasion", ai: true, q: "What are you posting about?" },
    { key: "goal", label: "Goal & sponsors", ai: true, jump: "Goal", q: "What should it achieve?" }, { key: "where", label: "Where & how", jump: "Where", q: "Platform and format" },
    { key: "benchmark", label: "Inspiration from", jump: "Inspiration", q: "Sports, competitions and clubs" },
  ];
  const PERIODS = { 7: "This week", 31: "This month", season: "This season", custom: "Custom dates" };
  // Some catalog values were saved with a mis-encoded dash ("15‚Äì30s"): show the real characters
  const fixText = (t) => (typeof t === "string" && t.includes("\u201aÄ") ? t.replace(/\u201aÄì/g, "\u2013").replace(/\u201aÄî/g, "\u2014").replace(/\u201aÄô/g, "\u2019").replace(/\u201aÄú/g, "\u201c").replace(/\u201aÄù/g, "\u201d") : t);
  const pretty = (raw) => { const name = fixText(raw); return name && name[0] === name[0].toLowerCase() ? name[0].toUpperCase() + name.slice(1) : name; };
  const shortDate = (v) => v ? new Date(`${v}T12:00:00`).toLocaleDateString(window.SCP_LOC || "en-GB", { day: "numeric", month: "short" }) : "";
  const kfmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(n < 1e7 ? 1 : 0).replace(".0", "")}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(".0", "")}k` : String(n));

  let catalog = { byCat: {}, byId: new Map() };
  const selected = Object.fromEntries(CATEGORIES.map((c) => [c.key, new Set()])); // category -> Set(value ids)
  let counts = null; // value id -> posts with the other filters applied (null = not counted: show catalog totals)

  // ---------- Icons (outline, currentColor) ----------
  const P = {
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
  const SPORT_ICON = { football: "ball", soccer: "ball", basketball: "basket", tennis: "tennis", padel: "racket", "american football": "oval", rugby: "oval", baseball: "ball", motor: "wheel", f1: "wheel", motorsport: "wheel", cycling: "bike", "ice hockey": "puck", hockey: "puck", handball: "run", "martial arts": "glove", running: "run", golf: "golf", waterpolo: "ball", volleyball: "ball" };
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
      db.from("idea_catalog").select("id,logo_url,logo_source").not("logo_url", "is", null).then((r) => r.data || [], () => []),
    ]);
    if (error) throw error;
    const logo = new Map(logos.map((l) => [Number(l.id), l.logo_url]));
    // Instagram profile pictures (pipeline/library/ig-avatars.mjs) fill their circle; Wikimedia crests sit inside one
    const igHandle = new Map(logos.map((l) => [Number(l.id), (/instagram\.com\/([\w.]+)/.exec(l.logo_source || "") || [])[1] || null]));
    const byCat = {};
    const byId = new Map();
    for (const r of data || []) {
      if (!CAT[r.category]) continue;
      const v = { id: Number(r.id), category: r.category, name: fixText(r.name), total: Number(r.ideas), logo: logo.get(Number(r.id)) || (r.category === "language" ? flagOf(r.name) : null), ig: igHandle.get(Number(r.id)) || null };
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

  const REPEATED = { entity: ["clubs", "competitions", "content creators"] };
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
      body = `<div class="lf-tiles lf-tiles-3">${shown.map((v) => `<button type="button" class="lf-tile${isOn(v) ? " is-on" : ""}${countOf(v) === 0 && !isOn(v) ? " is-zero" : ""}" aria-pressed="${isOn(v)}" data-facet="${c.key}" data-id="${v.id}">${svg(SPORT_ICON[v.name.toLowerCase()] || "dots")}<span>${esc(pretty(v.name))}</span></button>`).join("")}</div>`;
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
  function favsHtml() {
    const f = favVals();
    if (!f.length) return `<a class="lf-sp lf-sp-top lf-sp-favs" href="profile.html#favourites" title="${esc(tx("Choose your favourite profiles"))}"><span class="lf-sp-ic">${svg("star")}</span><span class="lf-sp-tx"><b>Favs</b><small>${esc(tx("Choose your favourite profiles"))}</small></span></a>`;
    const on = favsOn();
    const pf = favNetwork();
    return `<button type="button" class="lf-sp lf-sp-top lf-sp-favs${on ? " is-on" : ""}" aria-pressed="${on}" data-favs title="${esc(tx("Posts from your favourite profiles"))}">
      <span class="lf-sp-ic">${svg("star")}</span><span class="lf-sp-tx"><b>Favs</b><small>${esc(tx(f.length === 1 ? "{n} profile" : "{n} profiles", { n: f.length }))}${pf ? ` · ${esc(pf.name)}` : ""}</small></span>
      ${svg("check", "lf-sp-ck")}</button>`;
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
    // "Content Creators" (Publisher type): its own gold button right under Replicable ideas
    const cc = (catalog.byCat.entity || []).find((v) => v.name.toLowerCase() === "content creators");
    if (cc) {
      const n = countOf(cc), on = isOn(cc), zero = n === 0 && !on;
      const s = special(cc);
      const btn = `<button type="button" class="lf-sp ${s.cls}${on ? " is-on" : ""}${zero ? " is-zero" : ""}" aria-pressed="${on}" ${zero ? 'aria-disabled="true" ' : ""}data-facet="entity" data-id="${cc.id}" data-sp-tip="${esc(tx(s.desc))}">
        <span class="lf-sp-ic">${svg(s.ico)}</span><span class="lf-sp-tx"><b>${esc(tx("Content Creators"))}</b></span><span class="lf-sp-info" data-sp-info role="button" tabindex="0" aria-label="${esc(tx("What is this?"))}" title="${esc(tx("What is this?"))}">i</span>
        <span class="lf-sp-n">${zero ? "No matches" : kfmt(n)}</span>${svg("check", "lf-sp-ck")}</button>`;
      const at = sp.findIndex((v) => v.name.toLowerCase() === "replicable ideas");
      rows.splice(at >= 0 ? at + 2 : rows.length, 0, btn + (on ? creatorsHtml() : ""));   // +1: Favs is the first row
    }
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
  // Content Creators on: the filters that describe creators' posts, right under the button (counts are already
  // limited to creators' posts, because the button is one of the active filters)
  function creatorsHtml() {
    const chips = (cat, max = 8) => {
      const list = byCount((catalog.byCat[cat] || []).filter((v) => countOf(v) > 0 || isOn(v))).slice(0, max);
      return list.map((v) => `<button type="button" class="lf-chip${isOn(v) ? " is-on" : ""}" aria-pressed="${isOn(v)}" data-facet="${cat}" data-id="${v.id}">${esc(pretty(v.name))}<em>${kfmt(countOf(v))}</em></button>`).join("");
    };
    // the creators' own accounts (from the post URL or the import; supabase/scraped-profiles.sql)
    if (!ui.accts) { ui.accts = []; db?.rpc("creator_accounts").then((r) => { ui.accts = r.data || []; if (ui.accts.length) renderFacets(); }, () => {}); }
    const accts = ui.accts.slice(0, 12).map((a) => { const k = `${a.platform}|${a.handle}`, on = ui.acct?.key === k;
      return `<button type="button" class="lf-chip${on ? " is-on" : ""}" aria-pressed="${on}" data-acct="${esc(k)}" title="${esc(a.platform)}">@${esc(a.handle)}<em>${kfmt(Number(a.posts))}</em></button>`; }).join("");
    const groups = [["Accounts", null, 0, accts], ["Content type", "angle"], ["Collaboration", "collab"], ["Brands", "sponsor", 10], ["Network", "platform"], ["Format", "format"], ["Sport", "sport"]]
      .map(([label, cat, max, h]) => [label, h ?? chips(cat, max)]).filter(([, h]) => h);
    if (!groups.length) return "";
    return `<div class="lf-cc-sub"><p class="lf-cc-h">${esc(tx("Refine creators' posts"))}</p>
      ${groups.map(([label, h]) => `<div class="lf-sub">${esc(tx(label))}</div><div class="lf-chips">${h}</div>`).join("")}</div>`;
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
    const shapeBtn = (v) => `<button type="button" class="lf-shp${isOn(v) ? " is-on" : ""}${countOf(v) === 0 && !isOn(v) ? " is-zero" : ""}" aria-pressed="${isOn(v)}" data-facet="aspect_ratio" data-id="${v.id}">${shapeBox(v.name)}<span>${esc(v.name)}</span></button>`;
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
    const top = rowsOf(["goal", "cta"]);
    const sp = rowsOf(["sponsor", "sponsor_integration", "sponsor_sector", "collab"]);
    return (top ? `<div class="lf-grp"><div class="lf-stack">${top}</div></div>` : "")
      + (sp ? `<div class="lf-md lf-spons"><div class="lf-md-h">${svg("tag")}<b>${esc(tx("Sponsors"))}</b><small>${esc(tx("How other clubs activate their partners"))}</small></div><div class="lf-stack">${sp}</div></div>` : "");
  }

  function renderFacets() {
    const parts = {
      discover: (has("trend") || views.hist) && discoverHtml(),
      occasion: !LAYOUT_BEFORE && (CATEGORIES.some((c) => c.sec === "occasion" && has(c.key))) && occasionHtml(),
      goal: !LAYOUT_BEFORE && CATEGORIES.some((c) => c.sec === "goal" && has(c.key)) && goalHtml(),
      where: !LAYOUT_BEFORE && (has("platform") || has("format")) && `${has("platform") ? `<div class="lf-grp"><div class="lf-sub lf-sub-top">Platform</div>${platformHtml()}</div>` : ""}${has("format") || has("aspect_ratio") || has("duration") || has("language") ? `<div class="lf-grp"><div class="lf-sub">Format</div>${formatHtml()}</div>` : ""}`,
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
    const inBar = barMode() ? secs.filter((s) => BAR_SECS.includes(s.key)) : [];
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

  // ---------- Bar above the posts (wide screens): one button per section, its filters in a wide panel ----------
  const BAR_ICO = { occasion: "calendar", goal: "target", benchmark: "trophy" };
  const secOf = (c) => (c.key === "angle" || c.key === "campaign" ? "occasion" : ["format", "platform"].includes(c.sec) ? "where" : c.sec);
  function renderBar(list, parts) {
    const bar = $("[data-lf-bar]");
    if (!list.length) { bar.hidden = true; bar.innerHTML = ""; ui.bar = null; return; }
    const items = list.map((s) => ({ key: s.key, label: tx(s.label), q: s.q ? tx(s.q) : "", n: CATEGORIES.filter((c) => secOf(c) === s.key).reduce((t, c) => t + selected[c.key].size, 0), html: parts[s.key] }));
    if (!items.some((it) => it.key === ui.bar)) ui.bar = null;
    const open = items.find((it) => it.key === ui.bar);
    const keep = $(".lfb-body", bar)?.scrollTop || 0;
    bar.hidden = false;
    bar.innerHTML = `<div class="lfb-row" role="toolbar" aria-label="${esc(tx("Filters"))}">${items.map((it) => `<button type="button" class="lfb-btn${it.n ? " is-set" : ""}${open === it ? " is-open" : ""}" aria-expanded="${open === it}" data-lfb="${it.key}">${svg(BAR_ICO[it.key])}<span class="lfb-tx"><b>${esc(it.label)}</b><small>${esc(it.q)}</small></span>${it.n ? `<em>${it.n}</em>` : ""}${svg("chev", "lfb-chev")}</button>`).join("")}</div>
      ${open ? `<div class="lfb-panel" role="dialog" aria-label="${esc(open.label)}"><div class="lfb-body lfb-${open.key}">${open.html}</div><div class="lfb-foot"><button type="button" class="btn btn-gold btn-sm" data-lfb-close>${esc(tx("Done"))}</button></div></div>` : ""}`;
    if (open) $(".lfb-body", bar).scrollTop = keep;
  }

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
        const r = b.getBoundingClientRect();
        tip.hidden = false;
        // beside the button (the sidebar is narrow), or under it when there's no room on the right
        const roomRight = innerWidth - r.right > 300;
        tip.style.left = `${(roomRight ? r.right + 12 : r.left) + scrollX}px`;
        tip.style.top = `${(roomRight ? r.top - 6 : r.bottom + 8) + scrollY}px`;
        tip.classList.toggle("is-side", roomRight);
        tip.hidden = false;
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
    if (e.target.closest("[data-favs]")) {   // all the favourite profiles on / off
      const pf = favNetwork(), f = [...favVals(), ...(pf ? [pf] : [])], on = favsOn();
      f.forEach((v) => (on ? selected[v.category].delete(v.id) : selected[v.category].add(v.id)));
      renderFacets();
      return load(true);
    }
    const lfb = e.target.closest("[data-lfb]");
    if (lfb) { ui.bar = ui.bar === lfb.dataset.lfb ? null : lfb.dataset.lfb; return renderFacets(); }
    if (e.target.closest("[data-lfb-close]")) { ui.bar = null; return renderFacets(); }
    const f = e.target.closest("[data-facet]");
    if (f) { if (f.getAttribute("aria-disabled") === "true") return; return toggleValue(f.dataset.facet, Number(f.dataset.id)); }
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
  filterBar.addEventListener("input", onFilterInput);

  // ---------- Search a sentence: "reels de fitxatges amb sponsor que hagin funcionat" → filters ----------
  // Free: it only reads the tags the AI already put on every post. A dictionary (CA / ES / EN) maps words to filter
  // values; club, competition, sponsor, city and opponent names are matched against the catalog itself.
  // Values of one filter are combined with "or", different filters with "and" (like clicking them).
  const SYN = [
    ["format", "Reel", "reels?"], ["format", "Carousel", "carrusel(s|es)?|carousels?"], ["format", "Shorts", "shorts?"], ["format", "Image", "fotos?|imatges?|imagen(es)?|images?|photos?"], ["format", "Video", "videos?"],
    ["platform", "Instagram", "instagram|insta"], ["platform", "TikTok", "tiktok"], ["platform", "YouTube", "youtube"], ["platform", "X", "twitter"], ["platform", "LinkedIn", "linkedin"], ["platform", "Facebook", "facebook"],
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
    const placeShow = () => { showBtn.style.top = `${Math.max(root.getBoundingClientRect().top, 0) + 18}px`; };
    window.addEventListener("scroll", placeShow, { passive: true });
    window.addEventListener("resize", placeShow);
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
    $("[data-period-label]").textContent = s.period === "all" ? "All time" : s.period === "custom" ? (s.from || s.to ? `${shortDate(s.from) || "…"} → ${shortDate(s.to) || "…"}` : "Custom dates") : PERIODS[s.period];
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
    if (s.views) c.push({ label: `${viewsLabel()} views`, title: "Views", clear: () => { views.a = 0; views.b = VB; views.exact = null; renderFacets(); } });
    if (s.period !== "all") c.push({ label: s.period === "custom" ? `${s.from || "…"} → ${s.to || "…"}` : PERIODS[s.period], clear: () => { setPeriod("all"); ["from", "to"].forEach((k) => { const el = $(`[data-${k}]`); el.value = ""; el.dispatchEvent(new Event("input")); }); } });
    if (s.q) c.push({ label: `“${s.q}”`, clear: () => ($("[data-q]").value = "") });
    return c;
  }
  let chipClears = [];
  function renderActive(s) {
    const chips = chipsFor(s);
    chipClears = chips.map((x) => x.clear);
    $("[data-active-bar]").hidden = chips.length === 0 && !savedSearches.length;
    const chipLead = (v) => !v ? "" : v.category === "trend" ? `<span class="lf-chip-sp ${special(v).cls}"></span>`
      : CAT[v.category]?.crest || v.logo ? crestImg(v, "lf-mini") : v.category === "platform" && PLATFORM[v.name.toLowerCase()] ? pfLogo(v.name.toLowerCase(), "lf-pfi is-brand") : "";
    $("[data-active-chips]").innerHTML = chips.map((x, i) => `<button type="button" class="active-chip" data-chip="${i}"${x.title ? ` title="${esc(x.title)}"` : ""}>${chipLead(x.v)}${esc(x.label)} <span aria-hidden="true">×</span><span class="sr-only">Remove</span></button>`).join("")
      + (chips.length > 1 ? `<button type="button" class="link-muted active-clear" data-chip-clear>Clear all</button>` : "");
    $("[data-save-search]").hidden = chips.length === 0;
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

  async function load(reset) {
    const s = state();
    renderActive(s);
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

    const args = queryArgs(s);
    const cc = (catalog.byCat.entity || []).find((v) => v.name.toLowerCase() === "content creators");
    if (ui.acct && !(cc && isOn(cc))) ui.acct = null;   // the account filter lives under Content Creators
    let ids = ui.aiMode ? [...aiList().keys()] : null;
    if (ui.acct) ids = ids ? ids.filter((id) => ui.acct.ids.includes(Number(id))) : ui.acct.ids;
    if (ids && !ids.length) {
      grid.querySelectorAll(".lib-skel").forEach((x) => x.remove());
      return showEmpty(tx(!ui.aiMode ? "No posts from this account yet." : ui.aiMode === "team" ? "Your team hasn't analysed any post yet." : "You haven't analysed any post yet. Open a post and press “Unlock AI Analysis”."));
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
  }

  function showEmpty(text) { empty.textContent = text; empty.hidden = false; }
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
  const isReel = (p) => /^(reels?|shorts?|video)$/i.test(first(p, "format")) || /\/(reel|shorts)\//.test(p.url || "");
  // Instagram's embed shows reels (9:16) letterboxed inside its media box (usually 4:5): the card is 9:16 and the box is zoomed to fill it.
  // Default card shapes (height / width) for platforms without a measured media ratio
  const PLATFORM_RATIO = { tiktok: 1.78, x: 1.25, facebook: 1.2, linkedin: 1.2 };
  function shape(p) {
    const pf = platformOf(p);
    if (pf === "youtube") return { ratio: /\/shorts\//.test(p.url || "") ? 1.78 : 0.5625 };
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
    const pf = platformOf(p), shorts = /\/shorts\//.test(p.url || "");
    if (pf === "tiktok" || shorts || (pf === "instagram" && isReel(p))) return 16 / 9;
    if (pf === "youtube") return 9 / 16;
    if (pf === "instagram") return Math.min(1.25, Math.max(1, Number(p.media_ratio) || 1.25));
    return Number(p.media_ratio) || 1.25;
  }
  const coverRatio = mediaRatio;
  const compact = (n) => Number(n).toLocaleString(window.SCP_LOC || "en-GB", { notation: "compact", maximumFractionDigits: 1 });

  // Card = the post (clean cover, or the embed for X / LinkedIn / Facebook) + a footer joined to it (who, when, views).
  // On the cover, always: the network and the format / length, and "Following" (which folds into a star).
  // On hover: a rail on the right with Drag to the Content Plan · Save · AI analysis.
  // Footer avatar: Instagram profile picture (fills the circle) › crest (inside a neutral circle) › initials (gold on dark)
  function footCrest(v, who) {
    const name = v?.name || who || "";
    const tip = v?.ig ? `@${v.ig}` : name;
    const ini = name.replace(/\b(FC|CF|AFC|SC|AC|CD|UD|RC|SL)\b/g, "").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
    if (v?.logo) return `<span class="lib-crest${v.ig ? " is-photo" : ""}" title="${esc(tip)}"><img src="${esc(v.logo)}" alt="" loading="lazy"></span>`;
    return `<span class="lib-crest is-initials" title="${esc(tip)}"><b>${esc(ini)}</b></span>`;
  }

  function card(p) {
    const pf = platformOf(p);
    const who = first(p, "club") || first(p, "competition") || first(p, "entity");
    const whoTag = (p.tags?.club || p.tags?.competition || p.tags?.entity || [])[0];
    const crest = whoTag ? catalog.byId.get(Number(whoTag.id)) : null;
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
            ${me.isSuper ? `<button class="lib-remove" type="button" data-remove="${esc(p.id)}" data-tip="Remove (superadmin)" aria-label="Remove from the library">${icon("trash-2")}</button>` : ""}
          </div>`;
    const foot = `
        <div class="lib-foot" data-open="${esc(p.id)}" role="button" tabindex="-1">
          ${footCrest(crest, who)}
          <span class="lib-foot-who"><b>${esc(who || name)}</b><small>${date(p.published_at)}</small></span>
          ${p.views ? `<span class="lib-foot-views"><b>${compact(p.views)}</b><small>${tx("views")}</small></span>` : ""}
        </div>`;

    // X, LinkedIn and Facebook: always the post itself, so the text can be read and videos played in place
    const asPosted = pf === "x" || pf === "linkedin" || pf === "facebook";
    if (p.cover_url && !asPosted) {
      return `
      <article class="lib-card has-cover" data-id="${esc(p.id)}">
        <div class="lib-media" style="aspect-ratio: 1 / ${mediaRatio(p).toFixed(4)}">
          <img class="lib-cover-img" src="${esc(p.cover_url)}" alt="${esc(who || "Post")}" loading="lazy" decoding="async">
          <button class="lib-hit" type="button" data-open="${esc(p.id)}" aria-label="Details${who ? ` · ${esc(who)}` : ""}"></button>
          ${video ? `<button class="lib-playbtn" type="button" data-play="${esc(p.id)}" aria-label="Play video">${icon("play")}</button>` : ""}
          ${!video && pf === "instagram" && (/carousel/i.test(fmt) || /carousel|sidecar/i.test(p.media_type || "")) ? `<button class="lib-carbtn" type="button" data-play="${esc(p.id)}" aria-label="${esc(tx("See the carousel"))}" title="${esc(tx("See the carousel"))}">${icon("chevron-right")}</button><span class="lib-cardots" aria-hidden="true"><i></i><i></i><i></i></span>` : ""}
          ${fmt || p.duration_s ? `<span class="lib-fmt">${video ? icon("play") : ""}${esc([fmt, p.duration_s ? mmss(p.duration_s) : ""].filter(Boolean).join(" · "))}</span>` : ""}
          ${corner}${rail}
        </div>${foot}${aiPeek(p.id)}
      </article>`;
    }

    // No cover (X, LinkedIn, Facebook…): the post itself, as the platform shows it
    const src = previewSrc(p);
    const sh = shape(p);
    const zoomStyle = sh.zoom ? ` style="--zoom:${sh.zoom.toFixed(4)};--inset:${((1 - sh.boxFrac) / 2 * 100).toFixed(3)}%"` : "";
    return `
      <article class="lib-card is-embed" data-id="${esc(p.id)}">
        <div class="lib-media${sh.zoom ? " is-reel" : ""}" style="aspect-ratio: 1 / ${sh.ratio.toFixed(4)}">
          ${pf === "tiktok" && p.url
            ? `<div class="lib-cover" data-cover-box><img data-oembed="${esc(p.url)}" alt="${esc(who || "TikTok video")}"><span class="lib-play" aria-hidden="true"></span></div>`
            : src ? `<div class="lib-zoom"${zoomStyle}><iframe class="lib-frame${pf === "instagram" ? " is-ig" : ""}" src="${esc(src)}" loading="lazy" title="${esc(who || "Post")}" scrolling="no" allow="encrypted-media; picture-in-picture; fullscreen"></iframe></div>` : `<span class="lib-noimg"></span>`}
          ${asPosted
            // the tweet's own video / image stays clickable (plays in place); its header, text and bottom open the detail
            ? `<button class="lib-hit lib-hit-top" type="button" data-open="${esc(p.id)}" aria-label="Details${who ? ` · ${esc(who)}` : ""}"></button><button class="lib-hit lib-hit-bottom" type="button" data-open="${esc(p.id)}" tabindex="-1" aria-hidden="true"></button>`
            : `<button class="lib-hit" type="button" data-open="${esc(p.id)}" aria-label="Details${who ? ` · ${esc(who)}` : ""}"></button>`}
          ${rail}
        </div>${asPosted ? "" : foot}${aiPeek(p.id)}
      </article>`;
  }

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
  function playInCard(id) {
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
    const [{ data: ent }, { data: ids }] = await Promise.all([db.rpc("my_entitlements"), db.rpc("my_unlocked_posts")]);
    ai.ent = ent || null;
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
    b.hidden = !ai.ent?.has_ai;
    b.setAttribute("aria-pressed", String(!!ui.aiMode));
    const n = $("[data-ai-mine-n]", b), rem = credits();
    n.textContent = ai.ent?.is_staff ? "∞" : String(rem);
    n.classList.toggle("is-out", !ai.ent?.is_staff && rem === 0);
    b.title = ai.ent?.is_staff ? tx("AI · team access") : tx(rem === 1 ? "{n} analysis left" : "{n} analyses left", { n: rem });
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
  const aiAdapt = (id) => { const r = (ai.mine.get(Number(id)) || ai.team.get(Number(id)))?.result; return r?.replicable?.howToAdapt ? `AI · ${r.replicable.howToAdapt}` : ""; };
  // in the card: the hook and why it works, without opening it
  function aiPeek(id) {
    if (!ui.aiMode) return "";
    const it = aiList().get(Number(id));
    const r = it?.result;
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
      ${list.map(([id, it]) => { const r = it.result || {}, p = post.get(id) || {}; return `<article><h2>${esc((p.title || "Post").slice(0, 90))}</h2>
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
  function columnCount() {
    const w = grid.clientWidth - parseFloat(getComputedStyle(grid).paddingLeft) - parseFloat(getComputedStyle(grid).paddingRight);
    // as many ~240px columns as fit (with or without the filters column), up to 6 on very wide screens
    const pfs = [...(selected.platform || [])].map((id) => catalog.byId.get(id)?.name.toLowerCase());
    const ytOnly = pfs.length === 1 && pfs[0] === "youtube";
    const MAX = ytOnly ? 3 : 6, MIN = ytOnly ? 260 : 240;
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
      const pfi = platformOf(rows[i]);
      const asPosted = ["x", "linkedin", "facebook"].includes(pfi);
      const ratio = (rows[i].cover_url && !asPosted ? mediaRatio(rows[i]) : shape(rows[i]).ratio) + (asPosted ? 0 : 0.2);   // + the footer
      placed.push({ el, ratio });
      place(el, ratio);
    });
    window.SCP_COVERS?.observe(grid);
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
  const balanceLine = () => ai.ent?.is_staff ? tx("Team access: unlimited analyses.")
    : ai.ent?.pack_left ? tx(credits() === 1 ? "You have <b>{n} analysis</b> left ({m} monthly + {p} from packs)." : "You have <b>{n} analyses</b> left ({m} monthly + {p} from packs).", { n: credits(), m: ai.ent.monthly_left, p: ai.ent.pack_left })
    : tx(credits() === 1 ? "You have <b>{n} analysis</b> left this month." : "You have <b>{n} analyses</b> left this month.", { n: credits() });
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
    if (ai.team.has(n)) {   // a teammate already analysed it: free to read
      const t = ai.team.get(n);
      area().innerHTML = `<p class="ai-team-note">${icon("users")}${esc(tx("Analysed by {name} from your team", { name: t.by }))}</p>${analysisHtml(t.result)}`;
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
      if (data?.status === "unlocked") { area().innerHTML = analysisHtml(data.analysis); return; }
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
    if (e.target.closest("[data-saved-searches], [data-facet-search], [data-lf-search]")) return;
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
  $("[data-ai-mine]").addEventListener("click", () => {
    if (!ui.aiMode && ai.ent?.has_ai && !ai.ent.is_staff && credits() === 0) return outOfAnalyses();
    setAiMode(ui.aiMode ? null : "mine");
  });
  $("[data-ai-strip]").addEventListener("click", (e) => {
    const t = e.target.closest("[data-ai-tab]");
    if (t && t.dataset.aiTab !== ui.aiMode) return setAiMode(t.dataset.aiTab);
    if (e.target.closest("[data-ai-pdf]")) aiPdf();
  });
  more.addEventListener("click", () => load(false));
  function clearAll() {
    applyState({ order: state().order });
    load(true);
  }
  $("[data-clear]").addEventListener("click", clearAll);

  if (!db) return load(true);
  Promise.all([Promise.all([loadCatalog(), loadViews().catch(() => {})]).then(renderFacets).catch(() => {}), boards.load(), loadSavedSearches(), loadMe().catch(() => {}), loadAi().catch(() => {})]).then(() => {
    // favourite network (catalog value "platform") goes first in "For you", and its tile first in the filters
    const pv = me.favPlatform && (catalog?.byCat?.platform || []).find((v) => v.name.toLowerCase() === me.favPlatform);
    if (pv && !me.boost.includes(pv.id)) { me.boost = [pv.id, ...me.boost]; renderFacets(); }
    load(true); openFromHash();
    if (!LAYOUT_BEFORE) loadPlanHints().catch(() => {});
  });
})();
