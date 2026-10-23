// Member profile: who the client is, their sport, channels, favourite profiles / creators, goals and newsletter.
// Saved with update_my_profile (name) + update_my_preferences (everything else). Used by the library ("For you")
// and by Admin → Audience to segment newsletters.
(async () => {
  const auth = window.SCP_AUTH;
  const root = document.querySelector("[data-pf]");
  if (!auth?.ready || !root) return;
  const db = auth.client;
  const r = await auth.getProfile();
  if (!r) return;
  const { session } = r;
  let profile = r.profile || {};
  const $ = (s, el = root) => el.querySelector(s);
  const $$ = (s, el = root) => [...el.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const icon = (n) => (window.SCP_ICONS ? window.SCP_ICONS(n) : "");
  $$("[data-icon]").forEach((el) => (el.outerHTML = icon(el.dataset.icon)));

  // ---------- Options ----------
  const OPTIONS = {
    role: ["Social media manager", "Content creator", "Marketing / comms lead", "Head of digital", "Designer / video editor", "Agency", "Athlete", "Student", "Other"],
    language: ["English", "Español", "Català", "Italiano", "Português", "Français", "Deutsch"],
    orgType: ["Club", "League / federation", "Brand / sponsor", "Agency", "Media", "Athlete / creator", "Other"],
    teamSize: ["Just me", "2–5", "6–15", "16+"],
    platforms: ["Instagram", "TikTok", "YouTube", "X", "Facebook", "LinkedIn"],
    favouritePlatform: ["Instagram", "TikTok", "YouTube", "X", "Facebook", "LinkedIn"],
    audience: ["Under 10K", "10K–100K", "100K–1M", "1M–10M", "10M+"],
    goals: ["Grow followers", "More engagement", "Sponsorship revenue", "Ticket sales", "Merchandise sales", "Fan community", "Brand awareness", "Save production time"],
    formats: ["Reels / short video", "Carousels", "Images", "Stories", "Long video", "Live"],
    topics: ["Matchday", "Signings", "Kit launches", "Sponsor activations", "Behind the scenes", "Fans", "Milestones", "Community", "Ticketing", "Training", "Humour", "Women's sport"],
    frequency: ["Weekly", "Every two weeks", "Monthly"],
    newsletterTopics: ["New posts from my favourites", "Trends of the week", "Platform updates", "Content ideas for my sport", "Case studies", "AI tools", "Sponsorship & monetisation"],
  };
  const FREQ = { Weekly: "weekly", "Every two weeks": "biweekly", Monthly: "monthly" };
  const FREQ_BACK = Object.fromEntries(Object.entries(FREQ).map(([k, v]) => [v, k]));
  const PF_ICON = { Instagram: "instagram", TikTok: "tiktok", YouTube: "youtube", X: "x", Facebook: "facebook", LinkedIn: "linkedin" };

  // ---------- State ----------
  const blank = () => ({ sports: [], competitions: [], platforms: [], favouriteProfiles: [], favouriteCreators: [], favouriteCreatorAccounts: [], goals: [], formats: [], topics: [], newsletterTopics: [] });
  let saved, state;
  const form = $("[data-pf-form]");
  function fromProfile(p) {
    return {
      ...blank(), ...(p.preferences || {}),
      first_name: p.first_name || "", last_name: p.last_name || "",
      newsletter: Boolean(p.newsletter), frequency: FREQ_BACK[p.newsletter_frequency] || "Weekly",
    };
  }
  saved = fromProfile(profile);
  state = structuredClone(saved);

  // ---------- Catalog (sports, competitions, accounts from the library) ----------
  let catalog = {};
  const logos = new Map();   // catalog id → logo url
  const logoOf = (v) => v.id != null && logos.get(Number(v.id));
  async function loadCatalog() {
    try {
      const data = [];   // more than 1,000 values: read page by page
      for (let from = 0; ; from += 1000) { const r = await db.rpc("catalog_with_counts").range(from, from + 999); data.push(...(r.data || [])); if (r.error || !r.data || r.data.length < 1000) break; }
      for (const v of data || []) if (Number(v.ideas)) (catalog[v.category] ||= []).push({ id: Number(v.id), name: v.name, n: Number(v.ideas) });
      for (const k in catalog) catalog[k].sort((a, b) => b.n - a.n);
      // logos of clubs, competitions and brands (the library's), for the favourites and competitions
      const lg = await db.from("idea_catalog").select("id,logo_url").not("logo_url", "is", null).limit(5000);
      for (const v of lg.data || []) logos.set(Number(v.id), v.logo_url);
      // the creators' accounts (Content Library → Content Creators → Accounts): id "platform|handle"
      const acc = await db.rpc("creator_accounts");
      catalog.accounts = (acc.data || []).map((a) => ({ id: `${a.platform}|${a.handle}`, name: `@${a.handle}`, n: Number(a.posts) }));
    } catch {}
  }
  const pretty = (n) => (n && n[0] === n[0].toLowerCase() ? n[0].toUpperCase() + n.slice(1) : n);

  // ---------- Chips ----------
  // the roles as small cards with a line icon
  const ROLE_ICON = { "Social media manager": "megaphone", "Content creator": "clapperboard", "Marketing / comms lead": "target", "Head of digital": "layers",
    "Designer / video editor": "pen-line", Agency: "handshake", Athlete: "dumbbell", Student: "lightbulb", Other: "sparkles" };
  // cards with an icon (organisation type, platforms, goals, formats, topics); platforms use their logo
  const TILE_ICON = {
    role: ROLE_ICON,
    orgType: { Club: "shirt", "League / federation": "trophy", "Brand / sponsor": "handshake", Agency: "layers", Media: "square-play", "Athlete / creator": "dumbbell", Other: "sparkles" },
    goals: { "Grow followers": "users", "More engagement": "heart", "Sponsorship revenue": "handshake", "Ticket sales": "ticket", "Merchandise sales": "shopping-bag", "Fan community": "message-circle", "Brand awareness": "megaphone", "Save production time": "clock" },
    formats: { "Reels / short video": "square-play", Carousels: "layers", Images: "image", Stories: "film", "Long video": "clapperboard", Live: "zap" },
    topics: { Matchday: "calendar-days", Signings: "pen-line", "Kit launches": "shirt", "Sponsor activations": "handshake", "Behind the scenes": "camera", Fans: "users", Milestones: "trophy", Community: "heart-handshake", Ticketing: "ticket", Training: "dumbbell", Humour: "laugh", "Women's sport": "star" },
  };
  const tile = (k, o, on) => `<button type="button" class="pf-chip pf-role" aria-pressed="${on}" data-val="${esc(o)}"><span class="pf-role-ic">${PF_ICON[o] && k === "platforms" ? `<img src="assets/pf-${PF_ICON[o]}.svg" alt="">` : icon(TILE_ICON[k]?.[o] || "sparkles")}</span><span>${esc(o)}</span><span class="pf-role-ck">${icon("check")}</span></button>`;
  // the sport of each value, by its name (same drawings as My Club)
  const SPORT_SVG = [[/football|soccer|f[uú]tbol/i, '<circle cx="12" cy="12" r="9"/><path d="m12 7.5 3.8 2.8-1.5 4.4H9.7l-1.5-4.4z"/>'], [/basket/i, '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5.6 5.6a9 9 0 0 1 0 12.8M18.4 5.6a9 9 0 0 0 0 12.8"/>'],
    [/handball|balonmano/i, '<circle cx="12" cy="12" r="9"/><path d="M4.5 8.5c5 1.6 10 1.6 15 0M4.5 15.5c5-1.6 10-1.6 15 0M12 3c-2.4 5-2.4 13 0 18"/>'], [/hockey/i, '<path d="M5 3l6 13a3 3 0 0 1-2.7 4.3H4"/><path d="M19 3l-6 13a3 3 0 0 0 2.7 4.3H20"/>'],
    [/volley/i, '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 9 9 9 0 0 1 7.8 4.5M12 12a9 9 0 0 1-7.8 4.5M12 12h9"/>'], [/tennis|padel|pádel/i, '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6a9 9 0 0 1 0 12.8M18.4 5.6a9 9 0 0 0 0 12.8"/>']];
  const sportIc = (n) => { const m = SPORT_SVG.find(([re]) => re.test(n)); return m ? `<svg class="pf-sport-ic" viewBox="0 0 24 24" aria-hidden="true">${m[1]}</svg>` : ""; };
  function renderChips() {
    $$("[data-single]").forEach((el) => {
      const k = el.dataset.single;
      if (el.classList.contains("pf-roles")) { el.innerHTML = OPTIONS[k].map((o) => tile(k, o, state[k] === o)).join(""); return; }
      if (el.classList.contains("pf-seg")) { el.innerHTML = OPTIONS[k].map((o) => `<button type="button" class="pf-chip pf-seg-b" aria-pressed="${state[k] === o}" data-val="${esc(o)}">${esc(o)}</button>`).join(""); return; }
      el.innerHTML = OPTIONS[k].map((o) => `<button type="button" class="pf-chip" aria-pressed="${state[k] === o}" data-val="${esc(o)}">${k === "favouritePlatform" && PF_ICON[o] ? `<img src="assets/pf-${PF_ICON[o]}.svg" alt="">` : ""}${esc(o)}</button>`).join("");
    });
    $$("[data-multi]").forEach((el) => {
      const k = el.dataset.multi;
      if (el.classList.contains("pf-roles")) { el.innerHTML = OPTIONS[k].map((o) => tile(k, o, state[k].includes(o))).join(""); return; }
      el.innerHTML = OPTIONS[k].map((o) => `<button type="button" class="pf-chip" aria-pressed="${state[k].includes(o)}" data-val="${esc(o)}">${PF_ICON[o] ? `<img src="assets/pf-${PF_ICON[o]}.svg" alt="">` : ""}${esc(o)}</button>`).join("");
    });
    $$("[data-catalog-chips]").forEach((el) => {
      const list = catalog[el.dataset.catalogChips] || [];
      el.innerHTML = list.length
        ? [...list].sort((a, b) => state.sports.includes(b.id) - state.sports.includes(a.id)).map((v) => `<button type="button" class="pf-chip" aria-pressed="${state.sports.includes(v.id)}" data-id="${v.id}">${sportIc(v.name)}${esc(pretty(v.name))}</button>`).join("")
        : `<p class="pf-muted">Sports appear here once the library is connected.</p>`;
    });
  }
  root.addEventListener("click", (e) => {
    const chip = e.target.closest(".pf-chip");
    if (!chip) return;
    const single = chip.closest("[data-single]")?.dataset.single;
    const multi = chip.closest("[data-multi]")?.dataset.multi;
    if (single) state[single] = state[single] === chip.dataset.val ? "" : chip.dataset.val;
    else if (multi) state[multi] = state[multi].includes(chip.dataset.val) ? state[multi].filter((x) => x !== chip.dataset.val) : [...state[multi], chip.dataset.val];
    else if (chip.closest("[data-catalog-chips]")) { const id = Number(chip.dataset.id); state.sports = state.sports.includes(id) ? state.sports.filter((x) => x !== id) : [...state.sports, id]; }
    renderChips(); changed();
  });

  // ---------- Pickers (favourites, competitions): search the library's values, chips with initials, max N ----------
  const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const hue = (name) => { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  const pickerValues = (el) => {
    const k = el.dataset.picker;
    return k === "competitions" ? state.competitions.map((id) => ({ id, name: (catalog.competition || []).find((v) => v.id === id)?.name || "?" })) : state[k];
  };
  function renderPicker(el, q = "") {
    const max = Number(el.dataset.max), free = "free" in el.dataset;
    const vals = pickerValues(el);
    const full = vals.length >= max;
    const query = q.trim().toLowerCase();
    const taken = new Set(vals.map((v) => v.id ?? v.name.toLowerCase()));
    const matches = query ? (catalog[el.dataset.source] || []).filter((v) => v.name.toLowerCase().includes(query) && !taken.has(v.id)).slice(0, 8) : [];
    const exact = (catalog[el.dataset.source] || []).some((v) => v.name.toLowerCase() === query);
    // how many are picked out of the maximum, and each one's posts in SCP
    const postsOf = (v) => (v.id != null ? (catalog[el.dataset.source] || []).find((x) => x.id === v.id)?.n : null);
    el.innerHTML = `
      ${max <= 10 ? `<div class="pf-pick-count"><span class="pf-meter5">${Array.from({ length: max }, (_, i) => `<i${i < vals.length ? ' class="on"' : ""}></i>`).join("")}</span><b>${vals.length}/${max}</b></div>` : ""}
      <div class="pf-picked">
        ${vals.map((v, i) => `<span class="pf-pick">${logoOf(v) ? `<img class="pf-pick-av is-logo" src="${esc(logoOf(v))}" alt="">` : `<span class="pf-pick-av" style="--h:${hue(v.name)}">${esc(initials(v.name))}</span>`}${esc(pretty(v.name))}${v.id == null ? `<small>new</small>` : postsOf(v) ? `<small>${Number(postsOf(v)).toLocaleString(window.SCP_LOC || "en-GB", { notation: "compact" })} posts</small>` : ""}<button type="button" aria-label="Remove ${esc(v.name)}" data-unpick="${i}">${icon("x")}</button></span>`).join("")}
      </div>
      ${full ? `<p class="pf-muted">That's ${max} — remove one to add another.</p>` : `
      <div class="pf-search">${icon("search")}<input type="search" placeholder="${esc(el.dataset.placeholder)}" value="${esc(q)}" data-pick-q aria-label="${esc(el.dataset.placeholder)}"></div>
      ${query ? `<ul class="pf-results">
        ${matches.map((v) => `<li><button type="button" data-pick='${esc(JSON.stringify({ id: v.id, name: v.name }))}'>${logoOf(v) ? `<img class="pf-pick-av is-logo" src="${esc(logoOf(v))}" alt="">` : `<span class="pf-pick-av" style="--h:${hue(v.name)}">${esc(initials(v.name))}</span>`}${esc(pretty(v.name))}<small>${v.n} posts</small></button></li>`).join("")}
        ${free && !exact ? `<li><button type="button" data-pick='${esc(JSON.stringify({ id: null, name: q.trim() }))}'>${icon("plus")}Add “${esc(q.trim())}”<small>not in the library yet</small></button></li>` : ""}
        ${!matches.length && !free ? `<li class="pf-muted">No matches.</li>` : ""}
      </ul>` : ""}`}`;
    if (q) { const i = $("[data-pick-q]", el); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  }
  $$("[data-picker]").forEach((el) => {
    renderPicker(el);
    el.addEventListener("input", (e) => { if (e.target.matches("[data-pick-q]")) renderPicker(el, e.target.value); });
    el.addEventListener("click", (e) => {
      const k = el.dataset.picker;
      const add = e.target.closest("[data-pick]");
      const rm = e.target.closest("[data-unpick]");
      if (add) {
        const v = JSON.parse(add.dataset.pick);
        if (k === "competitions") state.competitions = [...state.competitions, v.id];
        else state[k] = [...state[k], v];
        renderPicker(el); changed();
      }
      if (rm) {
        const i = Number(rm.dataset.unpick);
        if (k === "competitions") state.competitions = state.competitions.filter((_, j) => j !== i);
        else state[k] = state[k].filter((_, j) => j !== i);
        renderPicker(el); changed();
      }
    });
  });

  // ---------- Text fields ----------
  const TEXT = ["first_name", "last_name", "country", "organization", "challenge"];
  function fillText() {
    for (const k of TEXT) form[k].value = state[k] || "";
    form.email.value = session.user.email;
    $("[data-pf-verified]").hidden = !session.user.email_confirmed_at;
    renderCountry();
    form.newsletter.checked = state.newsletter;
  }
  form.addEventListener("input", (e) => {
    if (TEXT.includes(e.target.name)) { state[e.target.name] = e.target.value; changed(); }
    if (e.target.name === "newsletter") { state.newsletter = e.target.checked; changed(); }
  });

  // ---------- Country: a searchable list (no flags). Saved as the English name (as before: "Spain"), shown in the page's language ----------
  const CODES = "AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HK HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI XK KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG KP MK NO OM PK PW PS PA PG PY PE PH PL PT PR QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA KR SS ES LK SD SR SE CH SY TW TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VA VE VN YE ZM ZW AD GI".split(" ").filter((c, i, a) => a.indexOf(c) === i);
  const dn = (lang) => { try { return new Intl.DisplayNames([lang], { type: "region" }); } catch { return null; } };
  const EN = dn("en"), LOCAL = dn(window.SCP_LANG === "es" ? "es" : "en"), ES = dn("es");
  const norm = (v) => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const COUNTRIES = CODES.map((c) => ({ c, en: EN?.of(c) || c, local: LOCAL?.of(c) || c, es: ES?.of(c) || c })).sort((a, b) => a.local.localeCompare(b.local));
  // the saved value (free text before) → a country, by its English, Spanish or local name
  const countryOf = (v) => { const n = norm(v); return n ? COUNTRIES.find((x) => [x.en, x.es, x.local, x.c].some((y) => norm(y) === n)) : null; };
  let cOpen = false, cQ = "";
  function renderCountry() {
    const box = $("[data-pf-country]"); if (!box) return;
    const cur = countryOf(state.country);
    const list = COUNTRIES.filter((x) => !cQ || [x.local, x.en, x.es].some((y) => norm(y).includes(norm(cQ))));
    box.innerHTML = `<button type="button" class="pf-in pf-country-btn" aria-haspopup="listbox" aria-expanded="${cOpen}" data-country-btn>
        <span class="pf-country-v${cur || state.country ? "" : " is-ph"}">${esc(cur ? cur.local : state.country || tx("Choose your country"))}</span>${icon("chevron-down")}</button>
      ${cOpen ? `<div class="pf-country-dd"><div class="pf-search">${icon("search")}<input type="search" value="${esc(cQ)}" placeholder="${esc(tx("Search a country"))}" data-country-q></div>
        <ul role="listbox">${list.slice(0, 80).map((x) => `<li><button type="button" role="option" aria-selected="${cur?.c === x.c}" data-country="${x.c}">${esc(x.local)}${cur?.c === x.c ? icon("check") : ""}</button></li>`).join("") || `<li class="pf-muted">${esc(tx("No matches."))}</li>`}</ul></div>` : ""}`;
    if (cOpen) { const q = $("[data-country-q]", box); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  }
  const tx = (t, v = {}) => (window.tx ? window.tx(t, v) : t.replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m));
  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-country-btn]")) { cOpen = !cOpen; cQ = ""; return renderCountry(); }
    const opt = e.target.closest("[data-country]");
    if (opt) { const x = COUNTRIES.find((y) => y.c === opt.dataset.country); state.country = x.en; form.country.value = x.en; cOpen = false; renderCountry(); return changed(); }
  });
  root.addEventListener("input", (e) => { if (e.target.matches("[data-country-q]")) { cQ = e.target.value; renderCountry(); } });
  // a click outside closes it (the path is taken when the click starts: the button it opened from has been redrawn since)
  document.addEventListener("click", (e) => { if (cOpen && !e.composedPath().some((el) => el.hasAttribute?.("data-pf-country"))) { cOpen = false; renderCountry(); } });
  document.addEventListener("keydown", (e) => { if (cOpen && e.key === "Escape") { cOpen = false; renderCountry(); } });

  // what each section needs (in order); newsletter is on / off
  const SECTIONS = {
    about: (s) => [s.first_name, s.last_name, s.country, s.role, s.language].map((v) => String(v || "").trim()),
    club: (s) => [String(s.organization || "").trim(), s.orgType, s.sports.length, s.competitions.length, s.teamSize],
    channels: (s) => [s.platforms.length, s.audience],
    favourites: (s) => [s.favouritePlatform, s.favouriteProfiles.length >= 5, s.favouriteCreatorAccounts.length >= 5],
    goals: (s) => [s.goals.length, s.formats.length, s.topics.length],
    newsletter: (s) => [s.newsletter],
  };

  // ---------- Completeness, hero, save bar ----------
  const CHECKS = [
    ["your name", (s) => s.first_name], ["your role", (s) => s.role], ["your organisation", (s) => s.organization], ["the type of organisation", (s) => s.orgType],
    ["your sports", (s) => s.sports.length], ["your platforms", (s) => s.platforms.length], ["your audience size", (s) => s.audience],
    ["5 favourite profiles", (s) => s.favouriteProfiles.length >= 5, (s) => s.favouriteProfiles.length / 5], ["5 favourite creator accounts", (s) => s.favouriteCreatorAccounts.length >= 5, (s) => s.favouriteCreatorAccounts.length / 5],
    ["your goals", (s) => s.goals.length], ["the topics you care about", (s) => s.topics.length],
  ];
  function meter() {
    // the same parts as each section's progress (newsletter apart), so the ring and "Next" always agree
    const parts = Object.entries(SECTIONS).filter(([id]) => id !== "newsletter").flatMap(([, f]) => f(state));
    const pct = Math.round((parts.filter(Boolean).length / parts.length) * 100);
    $("[data-pf-pct]").textContent = `${pct}%`;
    const c = 2 * Math.PI * 52;
    const ring = $("[data-pf-ring]");
    ring.style.strokeDasharray = c;
    ring.style.strokeDashoffset = c * (1 - pct / 100);
    $("[data-pf-meter]").classList.toggle("is-full", pct === 100);   // complete: the ring glows and turns
    const missing = CHECKS.find(([, ok]) => !ok(state));
    $("[data-pf-next]").innerHTML = missing ? `Next: add ${esc(missing[0])}.` : `<span class="pf-done-pill">${icon("check")}Your profile is complete.</span>`;
    const full = [state.first_name, state.last_name].filter(Boolean).join(" ");
    $("[data-profile-title]").textContent = full || "My profile";
    $("[data-pf-role]").textContent = state.role || "Your profile";
    $("[data-pf-org]").textContent = [state.organization, state.orgType && tx(state.orgType)].filter(Boolean).join(" · ");
    $$("[data-newsletter-only]").forEach((el) => (el.hidden = !state.newsletter));
    // each section's progress (its head), its dot in the side menu, and the hero's "Next" button to the first one missing
    let firstMissing = null;
    for (const [id, parts] of Object.entries(SECTIONS)) {
      const vals = parts(state), done = vals.filter(Boolean).length, all = done === vals.length;
      const prog = $(`[data-sec-prog="${id}"]`);
      if (prog) {
        prog.innerHTML = id === "newsletter" ? (state.newsletter ? `${icon("check")}${esc(tx("On"))}` : esc(tx("Off"))) : all ? `${icon("check")}${esc(tx("Complete"))}` : `<b>${done}</b>/${vals.length}`;
        prog.classList.toggle("is-done", id === "newsletter" ? state.newsletter : all);
      }
      const link = $(`[data-pf-nav] a[href="#${id}"]`);
      if (link) { let dot = link.querySelector(".pf-dot"); if (!dot) { dot = document.createElement("i"); dot.className = "pf-dot"; link.append(dot); } dot.classList.toggle("is-todo", !all && id !== "newsletter"); dot.classList.toggle("is-off", id === "newsletter" && !state.newsletter); }
      if (!all && id !== "newsletter" && !firstMissing) firstMissing = id;
    }
    const next = $("[data-pf-next]");
    if (firstMissing) next.innerHTML = `<a class="pf-next-btn" href="#${firstMissing}">${esc(tx("Next: {s}", { s: $(`#${firstMissing} h2`)?.textContent || "" }))} →</a>`;
  }
  const dirty = () => JSON.stringify(state) !== JSON.stringify(saved);
  // saved on its own a moment after each change; the bar only says "Saving…" / "Saved ✓" (and shows the buttons again if it fails)
  let saveTimer;
  function changed() {
    meter();
    const bar = $("[data-pf-savebar]");
    clearTimeout(saveTimer);
    if (!dirty()) { bar.hidden = true; return; }
    bar.classList.add("is-auto"); bar.classList.remove("is-error", "is-saved");
    bar.hidden = false;
    $("[data-pf-status]").textContent = tx("Saving…");
    saveTimer = setTimeout(save, 900);
  }
  let leaving = false;
  window.addEventListener("beforeunload", (e) => { if (!leaving && dirty()) { e.preventDefault(); e.returnValue = ""; } });
  // switching the website's language reloads the page: save what's pending first, without the "Leave site?" warning
  window.SCP_beforeLangSwitch = async () => { if (dirty()) await save().catch(() => {}); leaving = true; };

  $("[data-pf-discard]").addEventListener("click", () => { state = structuredClone(saved); fillText(); renderChips(); $$("[data-picker]").forEach((el) => renderPicker(el)); changed(); });
  $("[data-pf-save]").addEventListener("click", () => save());
  async function save() {
    clearTimeout(saveTimer);
    const bar = $("[data-pf-savebar]");
    if (!state.first_name.trim()) { bar.hidden = false; bar.classList.remove("is-auto"); bar.classList.add("is-error"); $("[data-pf-status]").textContent = tx("Please add your first name."); return; }
    const btn = $("[data-pf-save]");
    btn.disabled = true;
    const snap = structuredClone(state);   // what this save sends (changes made meanwhile are saved right after)
    const { first_name, last_name, newsletter, frequency, ...prefs } = snap;
    const [a, b] = await Promise.all([
      db.rpc("update_my_profile", { p_first_name: first_name.trim(), p_last_name: last_name.trim() }),
      db.rpc("update_my_preferences", { p_preferences: prefs, p_newsletter: newsletter, p_frequency: FREQ[frequency] || "weekly" }),
    ]);
    btn.disabled = false;
    const err = a.error || b.error;
    if (err) { bar.classList.remove("is-auto"); bar.classList.add("is-error"); $("[data-pf-status]").textContent = /schema cache|does not exist/i.test(err.message) ? "Profile storage isn't set up yet (run supabase/member-profile.sql)." : `Couldn't save: ${err.message}`; return; }
    saved = snap;
    window.SCP_SET_USER?.({ first_name, last_name }, session.user.email);
    if (dirty()) return changed();   // something changed while saving: save that too
    $("[data-pf-status]").textContent = tx("Saved");
    bar.classList.add("is-saved");
    setTimeout(() => { if (!dirty()) { bar.hidden = true; bar.classList.remove("is-saved"); } }, 1400);
  }

  // ---------- New password: show / hide and how strong it is ----------
  const pw = form.password;
  $("[data-pw-eye]")?.addEventListener("click", () => { pw.type = pw.type === "password" ? "text" : "password"; $("[data-pw-eye]").setAttribute("aria-label", tx(pw.type === "password" ? "Show password" : "Hide password")); pw.focus(); });
  pw?.addEventListener("input", () => {
    const v = pw.value, n = !v ? 0 : [v.length >= 8, /[a-z]/.test(v) && /[A-Z]/.test(v), /\d/.test(v), /[^A-Za-z0-9]/.test(v) || v.length >= 14].filter(Boolean).length;
    const bar = $("[data-pw-str]"), t = $("[data-pw-str-t]");
    bar.hidden = !v; bar.dataset.n = n;
    t.textContent = !v ? "" : v.length < 8 ? tx("At least 8 characters") : tx(["Weak", "Weak", "Fair", "Strong", "Very strong"][n]);
    t.dataset.n = v.length < 8 ? 0 : n;
  });

  // ---------- Profile photo: square-cropped + resized to 400px in the browser, stored in Storage "avatars/<user id>/" ----------
  // The URL is saved on the profile (profiles.avatar_url) and on the account itself (user metadata), so it shows
  // everywhere even before the profile columns exist. Google sign-ups already bring their Google photo there.
  const avatarEl = $("[data-pf-avatar]");
  const fileInput = $("[data-pf-file]");
  const photoMsg = $("[data-pf-photo-status]");
  let avatarUrl = profile.avatar_url || session.user.user_metadata?.avatar_url || null;
  function showAvatar(url) {
    avatarEl.style.backgroundImage = url ? `url("${url}")` : "";
    avatarEl.classList.toggle("has-photo", Boolean(url));
    $("[data-pf-photo-remove]").hidden = !url;
    window.SCP_SET_AVATAR?.(url);
  }
  const say = (text, kind = "") => { photoMsg.textContent = text; photoMsg.className = `pf-photo-status ${kind}`; };
  async function saveAvatarUrl(url) {
    const [meta, prof] = await Promise.all([
      db.auth.updateUser({ data: { avatar_url: url } }),
      db.rpc("update_my_avatar", { p_url: url }),
    ]);
    if (meta.error && prof.error) throw meta.error;
  }
  const ownFile = (url) => (url && url.includes(`/avatars/${session.user.id}/`) ? decodeURIComponent(url.split("/avatars/")[1]) : null);
  showAvatar(avatarUrl);
  $("[data-pf-photo]").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return say("Please choose an image.", "err");
    if (file.size > 15 * 1024 * 1024) return say("That image is too big (max 15 MB).", "err");
    const before = avatarUrl;
    try {
      const img = await createImageBitmap(file);
      const side = Math.min(img.width, img.height), size = Math.min(400, side);
      const canvas = Object.assign(document.createElement("canvas"), { width: size, height: size });
      canvas.getContext("2d").drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      const blob = await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", 0.88));
      showAvatar(URL.createObjectURL(blob)); // instant preview
      avatarEl.classList.add("is-saving");
      say("Saving photo…");
      const path = `${session.user.id}/avatar-${Date.now()}.jpg`;
      const up = await db.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (up.error) throw up.error;
      const url = db.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      await saveAvatarUrl(url);
      const old = ownFile(before);
      if (old) db.storage.from("avatars").remove([old]);
      avatarUrl = url;
      showAvatar(url);
      say("Photo saved ✓", "ok");
      setTimeout(() => photoMsg.textContent === "Photo saved ✓" && say(""), 2500);
    } catch (err) {
      showAvatar(before);
      say(/bucket|not found|row-level|policy/i.test(err.message || "") ? "Photo storage isn't set up yet (run the Supabase SQL)." : `Couldn't save the photo: ${err.message}`, "err");
    } finally { avatarEl.classList.remove("is-saving"); }
  });
  $("[data-pf-photo-remove]").addEventListener("click", async () => {
    try {
      await saveAvatarUrl(null);
      const old = ownFile(avatarUrl);
      if (old) db.storage.from("avatars").remove([old]);
      avatarUrl = null;
      showAvatar(null);
      say("Photo removed", "ok");
    } catch (err) { say(err.message, "err"); }
  });

  // ---------- Password ----------
  $("[data-password-save]").addEventListener("click", async () => {
    const status = $("[data-password-status]");
    const pw = form.password.value;
    const say = (m, ok) => { status.textContent = m; status.className = `form-status ${ok ? "ok" : "err"}`; };
    if (pw.length < 8) return say("Use at least 8 characters.");
    const { error } = await db.auth.updateUser({ password: pw });
    if (error) return say(error.message);
    form.password.value = "";
    say("Password updated. You can now log in with it.", true);
  });

  // ---------- Section nav: highlight the section in view ----------
  const links = $$("[data-pf-nav] a");
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) links.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === `#${en.target.id}`));
  }), { rootMargin: "-35% 0px -60% 0px" });
  $$(".pf-card").forEach((s) => io.observe(s));

  // Show what we have straight away; sports / competitions / accounts arrive with the catalog
  fillText(); renderChips(); meter();
  // the plan in the hero: "Trial · plan · until …" / "plan · Active"
  db.rpc("my_membership").then(({ data }) => {
    const sub = data?.subscription, el = $("[data-pf-plan]"); if (!sub || !el) return;
    const until = (v) => new Date(v).toLocaleDateString(window.SCP_LOC || "en-GB", { day: "numeric", month: "short" });
    const live = ["active", "trialing", "past_due"].includes(sub.status);
    if (!live) return;
    // a small plan card: the plan's name, its state (trial until … · days left / active / payment issue) and a link to Billing
    const left = sub.trial_end ? Math.max(0, Math.ceil((new Date(sub.trial_end) - Date.now()) / 864e5)) : 0;
    const state = sub.status === "trialing" ? `${tx("Free trial")}${sub.trial_end ? ` · ${tx("until {date}", { date: until(sub.trial_end) })} · ${tx(left === 1 ? "{n} day left" : "{n} days left", { n: left })}` : ""}`
      : tx(sub.status === "past_due" ? "Payment issue" : "Active");
    el.innerHTML = `<span class="pf-pc-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9.94 15.5a2 2 0 0 0-1.44-1.44l-6.13-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0l1.58 6.14a2 2 0 0 0 1.44 1.44l6.14 1.58a.5.5 0 0 1 0 .96l-6.14 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z"/></svg></span>
      <span class="pf-pc-tx"><b>${esc(tx(sub.plan_name || ""))}</b><small><i></i>${esc(state)}</small></span>
      <a class="pf-pc-go" href="#billing">${esc(tx("See plan"))} →</a>`;
    el.classList.toggle("is-warn", sub.status === "past_due");
    el.hidden = false;
  }, () => {});
  await loadCatalog();
  renderChips(); $$("[data-picker]").forEach((el) => renderPicker(el));
})();
