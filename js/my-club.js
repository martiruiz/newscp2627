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

  const st = { clubs: [], club: null, space: null, section: null, team: null, tab: "players", people: new Set(), q: "", linked: false };
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
    st.clubs = data || [];
    if (!st.clubs.length) return fail("Your account isn't linked to a club yet. Write to us and we'll set up your club's space.", true);
    st.club = st.clubs.find((c) => c.id === saved.club) || st.clubs[0];
    await openClub(saved);
  });

  function fail(text, contact) {
    if (box) box.innerHTML = `<div class="mc-empty"><p>${esc(t(text))}</p>${contact ? `<a class="btn btn-gold" href="contact.html">${esc(t("Contact us"))}</a>` : ""}</div>`;
    SCOPE.ids = []; SCOPE.empty = t("No posts to show.");
    resolveReady();
    window.dispatchEvent(new Event("scp-lib-scope"));
  }

  async function openClub(saved = {}) {
    box.innerHTML = `<div class="mc-loading"><span class="lead-spin"></span>${esc(t("Loading your club…"))}</div>`;
    const { data, error } = await db.rpc("club_space", { p_club: st.club.id });
    if (error || !data?.ok) return fail(data?.error || "Couldn't load your club right now. Try again in a moment.");
    st.space = data;
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
  };
  // how many people of the current tab a section / team has (globals not counted: they're everywhere)
  const countIn = (secId, teamId) => st.tab === "club" ? (teamId ? null : (st.profiles || []).filter((p) => p.section_id === secId).length) : st.space.people.filter((p) => p.kind === kind() && !p.global && (teamId ? p.teams.includes(teamId)
    : secId ? p.sections.includes(secId) || p.teams.some((id) => st.space.sections.find((s) => s.id === secId)?.teams.some((t) => t.id === id)) : true)).length;

  function draw() {
    const club = st.space.club, sec = section(), list = inSelection();
    const shown = list.filter((p) => !st.q || p.name.toLowerCase().includes(st.q.toLowerCase()));
    const nPlayers = st.space.people.filter((p) => p.kind === "player").length, nSponsors = st.space.people.filter((p) => p.kind === "sponsor").length;
    const seg = (attr, id, label, on, n, ic = "") => `<button type="button" class="mc-seg-b" ${attr}="${id ?? ""}" aria-pressed="${on}">${ic}<span>${esc(label)}</span>${n != null ? `<i>${n}</i>` : ""}</button>`;
    box.innerHTML = `
      <div class="mc-card">
        <div class="mc-top">
          <div class="mc-logo">${club.logo_url ? `<img src="${esc(club.logo_url)}" alt="">` : `<span>${esc(initials(club.name))}</span>`}</div>
          <div class="mc-title">
            <span class="mc-eyebrow">${esc(t("My Club"))}</span>
            <h1>${esc(club.name)}</h1>
            ${club.accounts?.length ? `<div class="mc-profiles">${club.accounts.map((a) => `<a class="mc-prof" href="${esc((URL_OF[a.platform] || URL_OF.instagram)(a.handle))}" target="_blank" rel="noopener" title="${esc(a.platform)}">${svg(NET[a.platform] || NET.instagram)}<span>@${esc(a.handle)}</span></a>`).join("")}</div>` : ""}
          </div>
          <div class="mc-side">
            ${st.clubs.length > 1 ? `<div class="mc-clubpick" data-mc-pick>
              <button type="button" class="mc-cp-btn" aria-haspopup="listbox" aria-expanded="false" data-mc-pick-btn><small>${esc(t("Club"))}</small>${crest(club)}<b>${esc(club.name)}</b><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
              <ul class="mc-cp-list" role="listbox" hidden>${st.clubs.map((c) => `<li><button type="button" role="option" aria-selected="${c.id === club.id}" data-mc-club-pick="${c.id}">${crest(c)}<span>${esc(c.name)}</span>${c.id === club.id ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>` : ""}</button></li>`).join("")}</ul>
            </div>` : ""}
            <div class="mc-tabs" role="tablist">
              <button type="button" role="tab" aria-selected="${st.tab === "club"}" data-mc-tab="club">${svg(ICON.shield)}<span>${esc(t("Club"))}</span><i>${(st.profiles || []).length}</i></button>
              <button type="button" role="tab" aria-selected="${st.tab === "players"}" data-mc-tab="players">${svg(ICON.grid)}<span class="mc-t-full">${esc(t("Content Library"))}</span><span class="mc-t-short">${esc(t("Players"))}</span><i>${nPlayers}</i></button>
              <button type="button" role="tab" aria-selected="${st.tab === "sponsors"}" data-mc-tab="sponsors">${svg(ICON.deal)}<span class="mc-t-full">${esc(t("Sponsors"))}</span><span class="mc-t-short">${esc(t("Brands"))}</span><i>${nSponsors}</i></button>
            </div>
          </div>
        </div>
        <div class="mc-filters">
          <div class="mc-line"><span class="mc-k">${esc(t("Section"))}</span>
            <div class="mc-seg" role="group" aria-label="${esc(t("Section"))}">${seg("data-mc-section", "", t("All sections"), !st.section, null)}${st.space.sections.map((s) => seg("data-mc-section", s.id, s.name, st.section === s.id, countIn(s.id), sportIcon(s.name))).join("")}</div></div>
          <div class="mc-line"><span class="mc-k">${esc(t("Team"))}</span>
            ${sec ? `<div class="mc-teams" role="group" aria-label="${esc(t("Team"))}">${seg("data-mc-team", "", t("All teams"), !st.team, null)}${sec.teams.map((x) => seg("data-mc-team", x.id, x.name, st.team === x.id, countIn(null, x.id))).join("")}</div>`
              : `<span class="mc-hint">${esc(t("Choose a section to see its teams"))}</span>`}</div>
        </div>
      </div>
      <div class="mc-people">
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

  // the library's top bar says where you are: club · tab · section / team (my-club.html .mc-crumb)
  function crumb() {
    const el = document.querySelector("[data-mc-crumb]"); if (!el || !st.space) return;
    const club = st.space.club, sec = section(), team = sec?.teams.find((x) => x.id === st.team);
    const tab = t(st.tab === "club" ? "Club" : st.tab === "sponsors" ? "Sponsors" : "Players");
    el.innerHTML = `<span class="mc-crumb-pill"><span class="mc-crumb-logo">${club.logo_url ? `<img src="${esc(club.logo_url)}" alt="">` : esc(initials(club.name))}</span>
      <span class="mc-crumb-tx"><small>${esc(t("My Club"))}</small><b>${esc(club.name)}</b></span><i></i><span class="mc-crumb-sel">${esc(tab)}${sec ? ` · ${esc(sec.name)}` : ""}${team ? ` · ${esc(team.name)}` : ""}</span></span>`;
  }

  async function scope() {
    crumb();
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
    if (!box?.contains(e.target) || !st.space) return;
    const b = e.target.closest("[data-mc-section], [data-mc-team], [data-mc-tab], [data-mc-person], [data-mc-clear], [data-mc-linked]");
    if (!b) return;
    if (b.matches("[data-mc-section]")) { st.section = Number(b.dataset.mcSection) || null; st.team = null; st.people.clear(); }   // another section: its own teams
    else if (b.matches("[data-mc-team]")) { st.team = Number(b.dataset.mcTeam) || null; st.people.clear(); }
    else if (b.matches("[data-mc-tab]")) { if (st.tab === b.dataset.mcTab) return; st.tab = b.dataset.mcTab; st.people.clear(); st.q = ""; st.linked = false; }   // section and team stay
    else if (b.matches("[data-mc-person]")) { const id = st.tab === "club" ? b.dataset.mcPerson : Number(b.dataset.mcPerson); st.people.has(id) ? st.people.delete(id) : st.people.add(id); }
    else if (b.matches("[data-mc-clear]")) st.people.clear();
    else if (b.matches("[data-mc-linked]")) st.linked = b.dataset.mcLinked === "1";
    save(); draw(); scope();
  });
  document.addEventListener("input", (e) => {
    if (!e.target.matches?.("[data-mc-q]")) return;
    st.q = e.target.value;
    const pos = e.target.selectionStart;
    draw();
    const q = box.querySelector("[data-mc-q]"); q?.focus(); q?.setSelectionRange(pos, pos);
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
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { const l = document.querySelector(".mc-cp-list"); if (l && !l.hidden) { l.hidden = true; document.querySelector("[data-mc-pick-btn]")?.setAttribute("aria-expanded", "false"); } } });
})();
