// My Club (my-club.html): a club's own space — its players' posts (Content Library tab) and its sponsors' posts (Sponsors tab),
// by section (football, basketball…) and team. The posts are the Content Library's: this script only works out which ones
// (supabase/my-club.sql club_post_ids) and hands them to js/library.js through window.SCP_LIB_SCOPE, so the cards, filters,
// saving and AI analysis are the library's own. Loaded before js/library.js.
(() => {
  const t = (s, v) => (window.tx ? window.tx(s, v) : s);
  let resolveReady;
  const SCOPE = window.SCP_LIB_SCOPE = { ids: null, empty: "", who: () => null, ready: new Promise((r) => { resolveReady = r; }) };
  const KEY = "scp-myclub";
  const store = { get() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } }, set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} } };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const initials = (n) => String(n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const crest = (c) => `<span class="mc-cp-crest">${c.logo_url ? `<img src="${esc(c.logo_url)}" alt="">` : esc(initials(c.name))}</span>`;   // a club's crest in the club picker

  const st = { clubs: [], club: null, space: null, section: null, team: null, tab: "players", people: new Set(), q: "", linked: false, open: null };
  let box, db, token = 0;

  document.addEventListener("DOMContentLoaded", async () => {
    box = document.querySelector("[data-mc]");
    db = window.SCP_AUTH?.client;
    if (!box) return;
    if (!db) return fail("The club space isn't connected yet.");
    const saved = store.get();
    st.tab = ["club", "sponsors"].includes(saved.tab) ? saved.tab : "players";
    const { data, error } = await db.rpc("my_clubs");
    if (error) return fail(/my_clubs|does not exist|schema cache/i.test(error.message) ? "My Club isn't set up yet (run supabase/my-club.sql)." : "Couldn't load your club right now. Try again in a moment.");
    // Superadmin → "View as" a plan: the page as a member of that plan without a club sees it
    st.clubs = window.SCP_viewAs?.() ? [] : data || [];
    if (!st.clubs.length) return fail("Your account isn't linked to a club yet. Write to us and we'll set up your club's space.", true);
    st.club = st.clubs.find((c) => c.id === saved.club) || st.clubs[0];
    await openClub(saved);
  });

  function fail(text, contact) {
    if (contact) return offer();
    if (box) box.innerHTML = `<div class="mc-empty"><p>${esc(t(text))}</p></div>`;
    SCOPE.ids = []; SCOPE.empty = t("No posts to show.");
    resolveReady();
    window.dispatchEvent(new Event("scp-lib-scope"));
  }
  // No club yet: the Content Library as usual behind, blurred (filters work), and a card centred on the screen offering
  // My Club — the premium plan, tailored to the club, booked through a demo
  function offer() {
    if (box) box.innerHTML = "";
    document.body.classList.add("lib-locked");
    document.body.classList.remove("my-club-page");   // the same filters as the Content Library (no club bar)
    // each point with its own icon, the key words in bold: easy to read at a glance
    const I = { trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
      users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
      cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/>', lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
      spark: '<path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4z"/>' };
    const tick = ([ic, b, rest]) => `<li><span class="mc-offer-ic"><svg viewBox="0 0 24 24">${I[ic]}</svg></span><span><b>${esc(t(b))}</b> ${esc(t(rest))}</span></li>`;
    document.querySelector("[data-library] .feed")?.insertAdjacentHTML("afterbegin", `<div class="lib-lock mc-offer" role="dialog" aria-label="${esc(t("My Club"))}">
      <div class="lib-lock-vis"><span class="lib-lock-ic mc-offer-crown" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M2 7l5 4 5-7 5 7 5-4-2 12H4z"/></svg></span>
        <div class="mc-box" aria-hidden="true"><div class="mc-box-fl"><div class="mc-box-in"><i class="f"></i><i class="l"></i><i class="r"></i><i class="t"></i><i class="u"></i>
          <i class="b"><img src="assets/logo-scp.png" alt=""><span class="mc-box-st"><span><b>500.000+</b>posts</span><span><b>740+</b>${esc(t("accounts"))}</span><span><b>${esc(t("AI"))}</b>${esc(t("analyses"))}</span></span><span class="mc-box-band">Get inspired. Analyze. Level up</span></i></div></div><span class="mc-box-sh"></span></div>
        <h2>${esc(t("Your club, with its own library"))}</h2>
        <p>${esc(t("The most complete plan, tailored to your club."))}</p></div>
      <div class="lib-lock-plans">
        <p class="mc-offer-tag">${esc(t("Premium plan"))}</p>
        <ul class="mc-offer-list">${[["trophy", "Every team", "first team, sections and academy"], ["users", "Players and sponsors", "all their posts, in one place"], ["cal", "Updated every day", "we upload your club's posts"], ["lock", "Private", "only your marketing and communications team can see it"], ["spark", "Everything included", "library, AI analyses and content plan"]].map(tick).join("")}</ul>
        <a class="lock-go is-best mc-offer-go" href="book-a-call.html?for=clubs" data-cta="my-club-offer"><span>${esc(t("Book a demo"))}</span><i aria-hidden="true">→</i></a>
        <ul class="lib-lock-perks"><li>${esc(t("Custom plan"))}</li><li>${esc(t("30-minute demo"))}</li></ul>
        <a class="lib-lock-club" href="pricing.html"><span><b>${esc(t("Not a club?"))}</b><small>${esc(t("Try the library free for 7 days"))}</small></span><i aria-hidden="true">→</i></a>
      </div></div>`);
    silk(document.querySelector(".mc-offer .lib-lock-vis"));
    SCOPE.ids = null;   // the whole library behind the card
    resolveReady();
    window.dispatchEvent(new Event("scp-lib-scope"));
  }

  // the box's backdrop: waves of navy silk with gold sheens rolling slowly across it (drawn small and scaled up, so it's
  // soft and cheap; still with reduced motion)
  function silk(vis) {
    if (!vis) return;
    const cv = document.createElement("canvas"); cv.className = "mc-stars"; cv.setAttribute("aria-hidden", "true"); vis.prepend(cv);
    const W = 150, H = 180, ctx = cv.getContext("2d"), img = ctx.createImageData(W, H), still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    cv.width = W; cv.height = H;
    const P = Math.PI * 2;
    const draw = (tm) => {
      if (!cv.isConnected) return;
      const t = still ? 0 : tm / 1000, d = img.data;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const u = x / W, v = y / H;
        // folds running down to the right, bent into an S that rolls along
        const ph = (v - 0.42 * u) * P * 1.9 + 1.25 * Math.sin(P * 0.75 * u + t * 0.55) + 0.45 * Math.sin(P * (1.4 * u - 0.6 * v) - t * 0.8);
        const sn = Math.sin(ph), body = Math.pow(0.5 + 0.5 * sn, 2.2);   // the fold's lit side
        const crest = Math.pow(Math.max(0, Math.sin(ph + 0.55)), 40);   // the thin bright line along its edge
        const lamp = 0.55 + 0.45 * Math.sin(P * (0.6 * u + 0.35 * v) - t * 0.35);   // light drifting across the cloth
        const g = body * lamp, c = crest * (0.6 + 0.4 * lamp), k = (y * W + x) * 4;
        d[k] = 6 + 75 * g + 235 * c + 150 * g * g; d[k + 1] = 9 + 70 * g + 200 * c + 105 * g * g; d[k + 2] = 20 + 100 * g + 120 * c + 15 * g * g; d[k + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      if (!still) requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  }

  // ---------- The page in the club's colours: clubs.colors (Admin → My Club) or, when empty, the two main colours of
  // its crest. The primary one takes the place of the gold accent (readable on the dark or light page); both colour the
  // club's header and the top of the page ----------
  const hexRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ""); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null; };
  const rgbHex = (c) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  // brighten (dark page) or darken (light page) a colour until it reads as an accent, keeping its hue and saturation
  const toHsl = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (!d) return [0, 0, l]; const s = d / (1 - Math.abs(2 * l - 1)); const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [(h * 60 + 360) % 360, s, l]; };
  const fromHsl = ([h, s, l]) => { const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]; return [r, g, b].map((v) => (v + m) * 255); };
  const readable = (c, light) => { let [h, s, l] = toHsl(c); s = Math.max(s, 0.55);
    for (let i = 0; i < 20; i++) { const y = lum(fromHsl([h, s, l])); if (light ? y <= 0.3 : y >= 0.26) break; l = Math.max(0, Math.min(1, l + (light ? -0.03 : 0.03))); }
    return fromHsl([h, s, l]); };
  // the two main colours of an image: saturated pixels only (no white, black or greys), grouped by hue
  function crestColours(url) {
    return new Promise((res) => {
      const im = new Image(); im.crossOrigin = "anonymous";
      im.onload = () => {
        try {
          const c = document.createElement("canvas"); c.width = c.height = 48;
          const g = c.getContext("2d"); g.drawImage(im, 0, 0, 48, 48);
          const px = g.getImageData(0, 0, 48, 48).data, bins = new Map();
          for (let i = 0; i < px.length; i += 4) {
            const [r, gg, b, a] = [px[i], px[i + 1], px[i + 2], px[i + 3]];
            const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
            if (a < 200 || mx - mn < 40 || mx < 40) continue;
            const k = `${r >> 5},${gg >> 5},${b >> 5}`, e = bins.get(k) || { n: 0, s: [0, 0, 0] };
            e.n++; e.s[0] += r; e.s[1] += gg; e.s[2] += b; bins.set(k, e);
          }
          const top = [...bins.values()].sort((x, y) => y.n - x.n).map((e) => e.s.map((v) => v / e.n));
          const first = top[0], second = top.find((x) => first && Math.abs(x[0] - first[0]) + Math.abs(x[1] - first[1]) + Math.abs(x[2] - first[2]) > 120);
          res(first ? [rgbHex(first), rgbHex(second || first)] : null);
        } catch { res(null); }   // a crest from a server without CORS: no colours
      };
      im.onerror = () => res(null);
      im.src = url;
    });
  }
  let themeColours = null;
  function paintTheme() {
    const root = document.documentElement;
    if (!themeColours) { ["--club-1", "--club-2", "--gold", "--gold-light", "--gold-mid", "--gold-tint", "--gold-dim", "--on-gold"].forEach((v) => root.style.removeProperty(v)); document.body.classList.remove("club-themed"); return; }
    const light = root.dataset.theme === "light";
    const [c1, c2] = themeColours.map(hexRgb);
    const acc = readable(c1, light), accL = readable(mix(acc, light ? [0, 0, 0] : [255, 255, 255], 0.25), light);
    root.style.setProperty("--club-1", rgbHex(c1));
    root.style.setProperty("--club-2", rgbHex(c2));
    root.style.setProperty("--gold", rgbHex(acc));
    root.style.setProperty("--gold-light", rgbHex(accL));
    root.style.setProperty("--gold-mid", rgbHex(acc));
    root.style.setProperty("--gold-tint", `rgba(${acc.map(Math.round).join(",")},.16)`);
    root.style.setProperty("--gold-dim", `rgba(${acc.map(Math.round).join(",")},.45)`);
    root.style.setProperty("--on-gold", lum(acc) > 0.45 ? "#121b33" : "#ffffff");
    document.body.classList.add("club-themed");
  }
  async function clubTheme(club) {
    const own = club?.colors?.primary ? [club.colors.primary, club.colors.secondary || club.colors.primary] : null;
    themeColours = own || (club?.logo_url ? await crestColours(club.logo_url) : null);
    paintTheme();
  }
  new MutationObserver(paintTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  async function openClub(saved = {}) {
    box.innerHTML = `<div class="mc-loading"><span class="lead-spin"></span>${esc(t("Loading your club…"))}</div>`;
    const { data, error } = await db.rpc("club_space", { p_club: st.club.id });
    if (error || !data?.ok) return fail(data?.error || "Couldn't load your club right now. Try again in a moment.");
    st.space = data;
    clubTheme(data.club);
    // the club's own profiles ("Club" tab), with their posts in SCP (supabase/my-club-daily.sql)
    const pr = await db.rpc("club_profiles", { p_club: st.club.id });
    st.profiles = pr.error ? [] : (pr.data || []).map((a) => ({ id: `${a.platform}:${a.handle}`, name: `@${a.handle}`, platform: a.platform, section_id: a.section_id, posts: a.posts }));
    // the last section / team, only if it still exists (and the team belongs to the section)
    const sec = data.sections.find((s) => s.id === saved.section);
    st.section = sec ? sec.id : null;
    st.team = sec && sec.teams.some((x) => x.id === saved.team) ? saved.team : null;
    st.people.clear();
    draw();
    scope();
  }

  const save = () => store.set({ club: st.club?.id, section: st.section, team: st.team, tab: st.tab });
  const kind = () => (st.tab === "sponsors" ? "sponsor" : "player");
  const section = () => st.space.sections.find((s) => s.id === st.section);
  // the people of the current tab that belong to the selection (a global sponsor belongs everywhere)
  function inSelection() {
    const sec = section(), teamIds = sec ? sec.teams.map((x) => x.id) : [];
    if (st.tab === "club") {   // a profile without a section shows in every section; a team counts as its section
      const secId = st.team ? st.space.sections.find((s) => s.teams.some((x) => x.id === st.team))?.id : st.section;
      return (st.profiles || []).filter((p) => !secId || !p.section_id || p.section_id === secId);
    }
    return st.space.people.filter((p) => p.kind === kind() && (p.global || (!st.section && !st.team)
      || (st.team ? p.teams.includes(st.team) || p.sections.includes(st.section) : p.sections.includes(st.section) || p.teams.some((id) => teamIds.includes(id)))));
  }

  // line icons: the sport of each section (by its name) and the networks of the club's profiles
  const svg = (d, fill) => `<svg viewBox="0 0 24 24" aria-hidden="true"${fill ? ' class="is-fill"' : ""}>${d}</svg>`;
  const SPORT = [
    [/f[uú]tbol|football|soccer|futsal|sala/i, '<circle cx="12" cy="12" r="9"/><path d="m12 7.5 3.8 2.8-1.5 4.4H9.7l-1.5-4.4z"/><path d="M12 3v4.5M20.6 9.5l-4.8.8M3.4 9.5l4.8.8M7 19.6l2.7-4.9M17 19.6l-2.7-4.9"/>'],
    [/b[aà]squet|basket|baloncesto/i, '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5.6 5.6a9 9 0 0 1 0 12.8M18.4 5.6a9 9 0 0 0 0 12.8"/>'],
    [/handbol|handball|balonmano/i, '<circle cx="12" cy="12" r="9"/><path d="M4.5 8.5c5 1.6 10 1.6 15 0M4.5 15.5c5-1.6 10-1.6 15 0M12 3c-2.4 5-2.4 13 0 18"/>'],
    [/hockey/i, '<path d="M5 3l6 13a3 3 0 0 1-2.7 4.3H4"/><path d="M19 3l-6 13a3 3 0 0 0 2.7 4.3H20"/>'],
    [/v[oò]le|volley/i, '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 9 9 9 0 0 1 7.8 4.5M12 12a9 9 0 0 1-7.8 4.5M12 12h9"/>'],
  ];
  const sportIcon = (name) => svg((SPORT.find(([re]) => re.test(name)) || [, '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>'])[1]);
  const NET = {
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.4" cy="6.6" r=".6"/>',
    tiktok: '<path d="M9.5 11.5a4.2 4.2 0 1 0 4.2 4.2V3c.5 2.6 2.4 4.5 5.3 4.7"/>',
    x: '<path d="M4 4h4.5L20 20h-4.5z"/><path d="M4 20l6.6-6.6M20 4l-6.6 6.6"/>',
    youtube: '<path d="M2.5 17a24 24 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.6 49.6 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24 24 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.6 49.6 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/>',
    facebook: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
    linkedin: '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>',
    threads: '<path d="M16.5 11.5c-.6-3-2.6-4.5-5-4.5-3 0-5 2.4-5 5.5s2 5.5 5.5 5.5c3.8 0 6-2.5 6-6.2C18 6.5 15.5 3 11.5 3 6.5 3 3 6.8 3 12s3.5 9 8.5 9"/><path d="M15.5 12c0 2-1.4 3-3 3s-2.6-.8-2.6-2 1.2-2 3-2c1.3 0 2.6.3 2.6 1z"/>',
  };
  const URL_OF = { instagram: (h) => `https://www.instagram.com/${h}/`, tiktok: (h) => `https://www.tiktok.com/@${h}`, x: (h) => `https://x.com/${h}`, youtube: (h) => `https://www.youtube.com/@${h}`,
    facebook: (h) => `https://www.facebook.com/${h}`, linkedin: (h) => `https://www.linkedin.com/company/${h}`, threads: (h) => `https://www.threads.net/@${h}` };
  const ICON = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    deal: '<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.9-3.9a3 3 0 0 0-4.2 0l-.9.9a1 1 0 1 1-3-3l2.8-2.8a5.8 5.8 0 0 1 7.1-.9l.5.3a2 2 0 0 0 1.4.3L21 4"/><path d="m21 3 1 11h-2M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3M3 4h8"/>',
    check: '<path d="M5 12.5 10 17l9-10"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    shirt: '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>',
  };
  // how many people of the current tab a section / team has (globals not counted: they're everywhere)
  const countIn = (secId, teamId) => st.tab === "club" ? (teamId ? null : (st.profiles || []).filter((p) => p.section_id === secId).length) : st.space.people.filter((p) => p.kind === kind() && !p.global && (teamId ? p.teams.includes(teamId)
    : secId ? p.sections.includes(secId) || p.teams.some((id) => st.space.sections.find((s) => s.id === secId)?.teams.some((t) => t.id === id)) : true)).length;

  function draw() {
    const club = st.space.club;
    // the club, as a thin strip: crest, name, its profiles and (with several clubs) the club picker
    box.innerHTML = `
      <div class="mc-card mc-strip">
        <div class="mc-top">
          <div class="mc-logo">${club.logo_url ? `<img src="${esc(club.logo_url)}" alt="">` : `<span>${esc(initials(club.name))}</span>`}</div>
          <div class="mc-title">
            <span class="mc-eyebrow">${esc(t("My Club"))}</span>
            <h1>${esc(club.name)}</h1>
          </div>
          ${st.club.trial_ends ? (() => { const d = Math.max(1, Math.ceil((new Date(st.club.trial_ends) - Date.now()) / 864e5));   // a 7-day trial (Admin → My Club → Members)
            return `<a class="mc-trial" href="book-a-call.html?for=clubs" data-cta="my-club-trial"><b>${esc(t(d === 1 ? "Trial: 1 day left" : "Trial: {n} days left", { n: d }))}</b><span>${esc(t("Book a demo"))} →</span></a>`; })() : ""}
          ${club.accounts?.length ? `<div class="mc-profiles">${club.accounts.map((a) => `<a class="mc-prof" href="${esc((URL_OF[a.platform] || URL_OF.instagram)(a.handle))}" target="_blank" rel="noopener" title="${esc(a.platform)}">${svg(NET[a.platform] || NET.instagram)}<span>@${esc(a.handle)}</span></a>`).join("")}</div>` : ""}
          ${st.clubs.length > 1 ? `<div class="mc-side"><div class="mc-clubpick" data-mc-pick>
              <button type="button" class="mc-cp-btn" aria-haspopup="listbox" aria-expanded="false" data-mc-pick-btn><small>${esc(t("Club"))}</small>${crest(club)}<b>${esc(club.name)}</b><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
              <ul class="mc-cp-list" role="listbox" hidden>${st.clubs.map((c) => `<li><button type="button" role="option" aria-selected="${c.id === club.id}" data-mc-club-pick="${c.id}">${crest(c)}<span>${esc(c.name)}</span>${c.id === club.id ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>` : ""}</button></li>`).join("")}</ul>
            </div></div>` : ""}
        </div>
      </div>`;
    bar();
  }

  // the filters, in the Content Library's glass bar: Club · Players · Sponsors (whose posts) and Section · Team, each
  // opening its panel under the bar (my-club.html .mc-crumb, where the library has its own bar)
  const BAR = [["club", "Club"], ["players", "Players"], ["sponsors", "Sponsors"], ["section", "Section"], ["team", "Team"]];
  const BAR_ICON = { club: "shield", players: "user", sponsors: "deal", section: "grid", team: "shirt" };
  function bar() {
    const el = document.querySelector("[data-mc-crumb]"); if (!el || !st.space) return;
    const sec = section(), team = sec?.teams.find((x) => x.id === st.team);
    const val = { section: sec?.name, team: team?.name };
    const oi = BAR.findIndex(([k]) => k === st.open);
    let row = el.querySelector(".mcb-row");
    if (!row) {
      el.innerHTML = `<div class="mcb"><div class="lfb-row lfb-glass mcb-row" role="toolbar" aria-label="${esc(t("Filters"))}" style="--n:${BAR.length}"><span class="lfb-lens"></span>${BAR.map(([k, l]) => `<button type="button" class="lfb-btn" data-mcb="${k}" aria-expanded="false"><span class="lfb-ic">${svg(ICON[BAR_ICON[k]])}</span><span class="lfb-tx"><b>${esc(t(l))}</b></span><em hidden></em></button>`).join("")}</div></div><div data-mcb-host></div>`;
      row = el.querySelector(".mcb-row");
    }
    BAR.forEach(([k, l], i) => {
      const b = row.querySelectorAll("[data-mcb]")[i], em = b.querySelector("em");
      const n = st.tab === k && st.people.size ? st.people.size : "";   // how many people picked in the current tab
      b.querySelector("b").textContent = val[k] ? t(val[k]) : t(l);   // Section / Team: the one picked, in its place
      b.classList.toggle("is-cur", st.tab === k || !!val[k]); b.classList.toggle("is-open", st.open === k); b.setAttribute("aria-expanded", String(st.open === k));
      em.hidden = !n; em.textContent = n;
    });
    const lens = row.querySelector(".lfb-lens");
    if (oi >= 0) {
      if (!lens.classList.contains("is-on")) { lens.style.transition = "none"; lens.style.setProperty("--x", oi); void lens.offsetWidth; lens.style.transition = ""; }   // appears where it is, then glides
      lens.style.setProperty("--x", oi);
    }
    lens.classList.toggle("is-on", oi >= 0);
    const host = el.querySelector("[data-mcb-host]");
    host.innerHTML = st.open ? `<div class="mcb-pan" role="dialog" aria-label="${esc(t(BAR[oi][1]))}">${panel()}</div>` : "";
  }

  // what each panel holds: the people of the tab (players, sponsors, the club's profiles) or the sections / teams
  function panel() {
    const sec = section();
    const seg = (attr, id, label, on, n, ic = "") => `<button type="button" class="mc-seg-b" ${attr}="${id ?? ""}" aria-pressed="${on}">${ic}<span>${esc(label)}</span>${n != null ? `<i>${n}</i>` : ""}</button>`;
    if (st.open === "section") return `<p class="mcb-k">${esc(t("Section"))}</p><div class="mc-seg" role="group">${seg("data-mc-section", "", t("All sections"), !st.section, null)}${st.space.sections.map((s) => seg("data-mc-section", s.id, s.name, st.section === s.id, countIn(s.id), sportIcon(s.name))).join("")}</div>`;
    if (st.open === "team") return `<p class="mcb-k">${esc(t("Team"))}${sec ? ` · ${esc(t(sec.name))}` : ""}</p>${sec ? `<div class="mc-teams" role="group">${seg("data-mc-team", "", t("All teams"), !st.team, null)}${sec.teams.map((x) => seg("data-mc-team", x.id, x.name, st.team === x.id, countIn(null, x.id))).join("")}</div>`
      : `<p class="mc-hint">${esc(t("Choose a section to see its teams"))}</p><div class="mc-seg" role="group">${st.space.sections.map((s) => seg("data-mc-section", s.id, s.name, false, countIn(s.id), sportIcon(s.name))).join("")}</div>`}`;
    const list = inSelection(), shown = list.filter((p) => !st.q || p.name.toLowerCase().includes(st.q.toLowerCase()));
    return `<div class="mc-people">
        <div class="mc-people-h">
          <b>${esc(t(st.tab === "club" ? "Club profiles" : st.tab === "sponsors" ? "Sponsors" : "Players"))}</b><span class="mc-n">${list.length}</span>
          ${st.people.size ? `<button type="button" class="mc-clear" data-mc-clear>${esc(t("Clear"))} · ${st.people.size}</button>` : `<small class="mc-tip">${esc(t(st.tab === "club" ? "Tap one or more profiles to see only theirs" : st.tab === "sponsors" ? "Tap one or more sponsors to see only theirs" : "Tap one or more players to see only theirs"))}</small>`}
          ${list.length > 6 ? `<label class="mc-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" value="${esc(st.q)}" placeholder="${esc(t(st.tab === "club" ? "Search a profile" : st.tab === "sponsors" ? "Search a sponsor" : "Search a player"))}" data-mc-q></label>` : ""}
        </div>
        ${list.length ? `<div class="mc-chips">${shown.map((p) => `<button type="button" class="mc-person${p.posts ? "" : " is-empty"}${st.tab === "sponsors" ? " is-brand" : ""}" aria-pressed="${st.people.has(p.id)}" data-mc-person="${p.id}" title="${esc(p.posts ? t("{n} posts", { n: p.posts }) : t("Account linked, no posts imported yet"))}">
            <span class="mc-ph">${p.platform ? `<span class="mc-av mc-net">${svg(NET[p.platform] || NET.instagram)}</span>` : p.photo_url ? `<img src="${esc(p.photo_url)}" alt="" loading="lazy">` : `<span class="mc-av">${esc(initials(p.name))}</span>`}<span class="mc-tick">${svg(ICON.check)}</span></span>
            <span class="mc-person-tx"><b>${esc(p.name)}</b><small>${p.global && st.tab === "sponsors" ? `<em>${esc(t("Global sponsor"))}</em>` : esc(p.posts ? t("{n} posts", { n: p.posts }) : t("No posts yet"))}</small></span></button>`).join("")}</div>`
          : `<p class="mc-none">${esc(t(st.tab === "club" ? "No club profiles for this selection yet." : st.tab === "sponsors" ? "No sponsors linked to this selection yet." : "No players linked to this selection yet."))}</p>`}
        ${st.tab === "sponsors" && list.length ? `<div class="mc-mode" role="group" aria-label="${esc(t("Which posts"))}">
          <div class="mc-mode-sw"><button type="button" aria-pressed="${!st.linked}" data-mc-linked="0">${esc(t("All the brand's posts"))}</button>
          <button type="button" aria-pressed="${st.linked}" data-mc-linked="1">${esc(t("Posts linked to the club"))}</button></div>
          <small>${esc(t(st.linked ? "The club's posts where the sponsor is tagged and the brand's posts that mention the club." : "Everything the brand posts, about the club or not."))}</small></div>` : ""}
      </div>`;
  }

  async function scope() {
    const my = ++token, list = inSelection();
    const people = st.people.size ? [...st.people].filter((id) => list.some((p) => p.id === id)) : null;
    if (st.tab === "club") {   // the club's own profiles
      SCOPE.empty = t(!list.length ? "No club profiles for this selection yet." : "The club's profiles have no posts imported yet.");
      let map = {};
      if (list.length) {
        const { data, error } = await db.rpc("club_profile_posts", { p_club: st.club.id, p_section: st.section, p_team: st.team });
        if (my !== token) return;
        if (error) SCOPE.empty = t("Couldn't load the posts right now. Try again in a moment.");
        else map = Object.fromEntries(Object.entries(data || {}).filter(([, k]) => !people || people.includes(k)));
      }
      SCOPE.ids = Object.keys(map).map(Number);
      SCOPE.who = (id) => (map[id] ? `@${map[id].split(":")[1]}` : null);
      resolveReady();
      return window.dispatchEvent(new Event("scp-lib-scope"));
    }
    SCOPE.empty = !list.length ? t(st.tab === "sponsors" ? "No sponsors linked to this selection yet." : "No players linked to this selection yet.")
      : st.linked ? t("No posts from these sponsors mention the club yet.")
      : t(st.tab === "sponsors" ? "These sponsors' accounts have no posts imported yet." : "These players' accounts have no posts imported yet.");
    let map = {};
    if (list.length) {
      const { data, error } = await db.rpc("club_post_ids", { p_club: st.club.id, p_kind: kind(), p_section: st.section, p_team: st.team, p_people: people, p_linked: st.tab === "sponsors" && st.linked });
      if (my !== token) return;
      if (error) { SCOPE.empty = t("Couldn't load the posts right now. Try again in a moment."); }
      else map = data || {};
    }
    const names = new Map(st.space.people.map((p) => [p.id, p.name]));
    SCOPE.ids = Object.keys(map).map(Number);
    SCOPE.who = (id) => names.get(map[id]) || null;
    resolveReady();
    window.dispatchEvent(new Event("scp-lib-scope"));
  }

  document.addEventListener("click", (e) => {
    if (!st.space) return;
    const ui = document.querySelector("[data-mc-crumb]");
    if (!ui?.contains(e.target)) { if (st.open) { st.open = null; bar(); } return; }   // a click outside closes the panel
    const tab = e.target.closest("[data-mcb]");
    if (tab) {
      const k = tab.dataset.mcb;
      // Club / Players / Sponsors: whose posts (section and team stay); the panel to pick some of them
      if (["club", "players", "sponsors"].includes(k) && st.tab !== k) { st.tab = k; st.people.clear(); st.q = ""; st.linked = false; st.open = k; save(); bar(); return scope(); }
      st.open = st.open === k ? null : k; return bar();
    }
    const b = e.target.closest("[data-mc-section], [data-mc-team], [data-mc-person], [data-mc-clear], [data-mc-linked]");
    if (!b) return;
    if (b.matches("[data-mc-section]")) { st.section = Number(b.dataset.mcSection) || null; st.team = null; st.people.clear(); st.open = st.open === "team" && st.section ? "team" : null; }   // another section: its own teams
    else if (b.matches("[data-mc-team]")) { st.team = Number(b.dataset.mcTeam) || null; st.people.clear(); st.open = null; }
    else if (b.matches("[data-mc-person]")) { const id = st.tab === "club" ? b.dataset.mcPerson : Number(b.dataset.mcPerson); st.people.has(id) ? st.people.delete(id) : st.people.add(id); }
    else if (b.matches("[data-mc-clear]")) st.people.clear();
    else if (b.matches("[data-mc-linked]")) st.linked = b.dataset.mcLinked === "1";
    save(); bar(); scope();
  });
  document.addEventListener("input", (e) => {
    if (!e.target.matches?.("[data-mc-q]")) return;
    st.q = e.target.value;
    const pos = e.target.selectionStart;
    bar();
    const q = document.querySelector("[data-mc-q]"); q?.focus(); q?.setSelectionRange(pos, pos);
  });
  // the club picker (only for accounts with several clubs): a list with each club's crest
  document.addEventListener("click", (e) => {
    const pick = document.querySelector("[data-mc-pick]"); if (!pick) return;
    const list = pick.querySelector(".mc-cp-list"), btn = pick.querySelector("[data-mc-pick-btn]");
    const open = (on) => { list.hidden = !on; btn.setAttribute("aria-expanded", String(on)); };
    if (e.target.closest("[data-mc-pick-btn]")) return open(list.hidden);
    const opt = e.target.closest("[data-mc-club-pick]");
    if (opt) {
      open(false);
      const next = st.clubs.find((c) => String(c.id) === opt.dataset.mcClubPick);
      if (!next || next.id === st.club.id) return;
      st.club = next; store.set({ club: st.club.id, tab: st.tab }); openClub({});
      return;
    }
    if (!e.target.closest("[data-mc-pick]")) open(false);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && st.open) { const k = st.open; st.open = null; bar(); document.querySelector(`[data-mcb="${k}"]`)?.focus(); } });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { const l = document.querySelector(".mc-cp-list"); if (l && !l.hidden) { l.hidden = true; document.querySelector("[data-mc-pick-btn]")?.setAttribute("aria-expanded", "false"); } } });
})();
