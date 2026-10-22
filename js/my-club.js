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

  const st = { clubs: [], club: null, space: null, section: null, team: null, tab: "players", people: new Set(), q: "", linked: false };
  let box, db, token = 0;

  document.addEventListener("DOMContentLoaded", async () => {
    box = document.querySelector("[data-mc]");
    db = window.SCP_AUTH?.client;
    if (!box) return;
    if (!db) return fail("The club space isn't connected yet.");
    const saved = store.get();
    st.tab = saved.tab === "sponsors" ? "sponsors" : "players";
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
    return st.space.people.filter((p) => p.kind === kind() && (p.global || (!st.section && !st.team)
      || (st.team ? p.teams.includes(st.team) || p.sections.includes(st.section) : p.sections.includes(st.section) || p.teams.some((id) => teamIds.includes(id)))));
  }

  function draw() {
    const club = st.space.club, sec = section(), list = inSelection();
    const pill = (attr, id, label, on) => `<button type="button" class="mc-pill" ${attr}="${id ?? ""}" aria-pressed="${on}">${esc(label)}</button>`;
    const shown = list.filter((p) => !st.q || p.name.toLowerCase().includes(st.q.toLowerCase()));
    box.innerHTML = `
      <div class="mc-top">
        ${club.logo_url ? `<img class="mc-logo" src="${esc(club.logo_url)}" alt="">` : `<span class="mc-logo mc-logo-i">${esc(initials(club.name))}</span>`}
        <div class="mc-title"><span class="mc-eyebrow">${esc(t("My Club"))}</span><h1>${esc(club.name)}</h1></div>
        ${st.clubs.length > 1 ? `<label class="mc-clubpick"><span>${esc(t("Club"))}</span><select data-mc-club>${st.clubs.map((c) => `<option value="${c.id}"${c.id === club.id ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>` : ""}
      </div>
      <div class="mc-filters">
        <div class="mc-row" role="group" aria-label="${esc(t("Section"))}"><span class="mc-k">${esc(t("Section"))}</span>
          ${pill("data-mc-section", "", t("All sections"), !st.section)}${st.space.sections.map((s) => pill("data-mc-section", s.id, s.name, st.section === s.id)).join("")}</div>
        <div class="mc-row" role="group" aria-label="${esc(t("Team"))}"><span class="mc-k">${esc(t("Team"))}</span>
          ${pill("data-mc-team", "", t("All teams"), !st.team)}${(sec?.teams || []).map((x) => pill("data-mc-team", x.id, x.name, st.team === x.id)).join("")}
          ${!sec ? `<small class="mc-hint">${esc(t("Choose a section to see its teams"))}</small>` : ""}</div>
      </div>
      <div class="mc-tabs" role="tablist">
        <button type="button" role="tab" aria-selected="${st.tab === "players"}" data-mc-tab="players">${esc(t("Content Library"))}</button>
        <button type="button" role="tab" aria-selected="${st.tab === "sponsors"}" data-mc-tab="sponsors">${esc(t("Sponsors"))}</button>
      </div>
      <div class="mc-people">
        <div class="mc-people-h">
          <b>${esc(t(st.tab === "sponsors" ? "Sponsors" : "Players"))}</b><span class="mc-n">${list.length}</span>
          ${list.length > 6 ? `<label class="mc-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" value="${esc(st.q)}" placeholder="${esc(t(st.tab === "sponsors" ? "Search a sponsor" : "Search a player"))}" data-mc-q></label>` : ""}
          ${st.people.size ? `<button type="button" class="mc-clear" data-mc-clear>${esc(t("Clear"))} (${st.people.size})</button>` : ""}
        </div>
        ${list.length ? `<div class="mc-chips">${shown.map((p) => `<button type="button" class="mc-person${p.posts ? "" : " is-empty"}" aria-pressed="${st.people.has(p.id)}" data-mc-person="${p.id}" title="${esc(p.posts ? t("{n} posts", { n: p.posts }) : t("Account linked, no posts imported yet"))}">
            ${p.photo_url ? `<img src="${esc(p.photo_url)}" alt="" loading="lazy">` : `<span class="mc-av">${esc(initials(p.name))}</span>`}
            <span class="mc-person-tx"><b>${esc(p.name)}</b><small>${p.global && st.tab === "sponsors" ? `<em>${esc(t("Global sponsor"))}</em>` : esc(p.posts ? t("{n} posts", { n: p.posts }) : t("No posts yet"))}</small></span></button>`).join("")}</div>`
          : `<p class="mc-none">${esc(t(st.tab === "sponsors" ? "No sponsors linked to this selection yet." : "No players linked to this selection yet."))}</p>`}
        ${st.tab === "sponsors" && list.length ? `<div class="mc-mode" role="group" aria-label="${esc(t("Which posts"))}">
          <button type="button" aria-pressed="${!st.linked}" data-mc-linked="0">${esc(t("All the brand's posts"))}</button>
          <button type="button" aria-pressed="${st.linked}" data-mc-linked="1">${esc(t("Posts linked to the club"))}</button>
          <small>${esc(t(st.linked ? "Only posts that mention the club's accounts." : "Everything the brand posts, about the club or not."))}</small></div>` : ""}
      </div>`;
  }

  async function scope() {
    const my = ++token, list = inSelection();
    const people = st.people.size ? [...st.people].filter((id) => list.some((p) => p.id === id)) : null;
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
    else if (b.matches("[data-mc-person]")) { const id = Number(b.dataset.mcPerson); st.people.has(id) ? st.people.delete(id) : st.people.add(id); }
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
  document.addEventListener("change", (e) => {
    if (!e.target.matches?.("[data-mc-club]")) return;
    st.club = st.clubs.find((c) => String(c.id) === e.target.value) || st.club;
    store.set({ club: st.club.id, tab: st.tab });
    openClub({});
  });
})();
