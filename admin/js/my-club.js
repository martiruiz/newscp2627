// SCP Admin — My Club: set up each club's space (my-club.html). Club (name, logo, its own accounts), who can open it,
// and its players and sponsors by section and team, uploaded from an Excel (one row per person and team). Players and
// sponsors keep one record however many teams they're in; links can end (a transfer, a finished deal) without losing history.
// Posts aren't copied: a person's posts are the library posts of their accounts. An account with 0 posts hasn't been
// scraped yet: "Accounts for the scraper" downloads them to add to the scraping Excel.
// Data: supabase/my-club.sql.
(async () => {
  const A = window.SCPA;
  const { $, esc, icon, num, info } = A;
  try { await A.boot("myclub"); } catch { return; }
  const main = $("[data-main]");
  const fail = (e) => A.toast(e.message || String(e), "err");
  async function rpc(name, params = {}) {
    const { data, error } = await A.db.rpc(name, params);
    if (error) throw new Error(/does not exist|schema cache|Could not find the function/i.test(error.message) ? "Run supabase/my-club.sql in Supabase first." : error.message);
    return data;
  }
  const PF = { instagram: "Instagram", tiktok: "TikTok", x: "X", youtube: "YouTube", facebook: "Facebook", linkedin: "LinkedIn" };
  let clubs = [], cur = null, club = null;

  main.innerHTML = `<div class="page-head"><div><h1>My Club</h1><p>Each club's space: who can open it, its sections and teams, its players and sponsors.</p></div>
    <div class="head-actions"><button class="btn btn-primary" type="button" data-new>${icon("plus")}New club</button></div></div>
    <div class="mcl-clubs" data-clubs><p class="muted">Loading…</p></div>
    <div data-club></div>`;

  async function loadClubs(pick) {
    try { clubs = await rpc("admin_clubs"); } catch (e) { $("[data-clubs]").innerHTML = `<p class="panel-pad muted">${esc(e.message)}</p>`; return; }
    cur = pick ?? cur ?? clubs[0]?.id ?? null;
    $("[data-clubs]").innerHTML = clubs.length ? clubs.map((c) => `<button type="button" class="mcl-club${c.id === cur ? " is-on" : ""}" data-pick="${c.id}">
        ${c.logo_url ? `<img src="${esc(c.logo_url)}" alt="">` : `<span class="mcl-ini">${esc(c.name.slice(0, 2).toUpperCase())}</span>`}
        <span><b>${esc(c.name)}</b><small>${num(c.players)} players · ${num(c.sponsors)} sponsors · ${num(c.members)} members${c.active ? "" : " · off"}</small></span></button>`).join("")
      : `<p class="muted">No clubs yet. Press “New club”.</p>`;
    if (cur) loadClub(); else $("[data-club]").innerHTML = "";
  }

  async function loadClub() {
    try { club = await rpc("admin_club", { p_club: cur }); } catch (e) { return fail(e); }
    const c = club.club, people = club.people;
    const secName = new Map(club.sections.map((s) => [s.id, s.name]));
    const teamName = new Map(club.sections.flatMap((s) => s.teams.map((t) => [t.id, `${s.name} · ${t.name}`])));
    const pending = people.flatMap((p) => p.accounts.filter((a) => !a.posts)).length;
    const linkLabel = (l) => l.team_id ? teamName.get(l.team_id) : l.section_id ? `${secName.get(l.section_id)} · all teams` : "Whole club (global)";
    const table = (kind) => {
      const list = people.filter((p) => p.kind === kind);
      if (!list.length) return `<p class="panel-pad muted">No ${kind === "player" ? "players" : "sponsors"} yet. Upload the Excel above.</p>`;
      return `<div class="table-wrap"><table class="data mcl-table"><thead><tr><th>${kind === "player" ? "Player" : "Sponsor"}</th><th>Where</th><th>Accounts</th><th>Active</th><th></th></tr></thead><tbody>
        ${list.map((p) => `<tr${p.active ? "" : ' class="is-off"'}>
          <td><div class="ld-person">${p.photo_url ? `<img class="mcl-ph" src="${esc(p.photo_url)}" alt="">` : `<span class="ld-av">${esc(p.name.charAt(0).toUpperCase())}</span>`}<span><b>${esc(p.name)}</b></span></div></td>
          <td>${p.links.map((l) => `<span class="mcl-link${l.live ? "" : " is-ended"}" title="${esc([l.starts_on && `from ${l.starts_on}`, l.ends_on && `until ${l.ends_on}`].filter(Boolean).join(" ") || "no dates")}">${esc(linkLabel(l))}${l.live ? `<button type="button" title="End this link today (keeps the history)" data-end="${l.id}">✕</button>` : ` <small>ended</small><button type="button" title="Active again" data-relink="${l.id}">↺</button>`}</span>`).join("")}</td>
          <td>${p.accounts.length ? p.accounts.map((a) => `<span class="mcl-acc${a.posts ? "" : " is-zero"}">${esc(PF[a.platform] || a.platform)} @${esc(a.handle)} · <b>${a.posts ? num(a.posts) + " posts" : "not scraped yet"}</b></span>`).join("") : `<span class="muted">—</span>`}</td>
          <td><input class="check" type="checkbox" aria-label="Active" data-active="${p.id}"${p.active ? " checked" : ""}></td>
          <td class="td-actions"><button class="icon-btn" type="button" title="Delete" aria-label="Delete" data-del="${p.id}">${icon("trash")}</button></td></tr>`).join("")}
        </tbody></table></div>`;
    };
    $("[data-club]").innerHTML = `
      <section class="panel mcl-panel"><header class="aud-h aud-h-lg"><h2>Club</h2>${info("Name and logo shown on the club's page. The club's own accounts (comma separated): a sponsor post that mentions one of them counts as “linked to the club”.")}</header>
        <form class="mcl-form" data-form>
          <label>Name<input class="input" name="name" value="${esc(c.name)}" required></label>
          <label>Logo URL<input class="input" name="logo_url" value="${esc(c.logo_url || "")}" placeholder="https://…"></label>
          <label>Club accounts<input class="input" name="handles" value="${esc((c.handles || []).join(", "))}" placeholder="fcbarcelona, fcbbasket, fcbhandbol"></label>
          <label class="check-inline"><input type="checkbox" name="active"${c.active ? " checked" : ""}> Active</label>
          <div class="mcl-form-act"><button class="btn btn-primary" type="submit">Save</button><button class="btn btn-danger" type="button" data-club-del>${icon("trash")}Delete club</button></div>
        </form></section>
      <section class="panel mcl-panel"><header class="aud-h aud-h-lg"><h2>Members</h2>${info("Who can open this club's space (they also need an active plan or trial). Add them by the e-mail of their SCP account.")}</header>
        <div class="mcl-members">${club.members.map((m) => `<span class="mcl-member">${esc(m.email)}<button type="button" title="Remove" data-unmember="${esc(m.email)}">✕</button></span>`).join("") || `<span class="muted">Nobody yet.</span>`}</div>
        <form class="mcl-add" data-member><input class="input" type="email" name="email" placeholder="name@club.com" required><button class="btn" type="submit">${icon("plus")}Add member</button></form></section>
      <section class="panel mcl-panel"><header class="aud-h aud-h-lg"><h2>Players &amp; sponsors</h2>${info("Upload an Excel with one row per person and team: Type (player / sponsor), Name, Photo, Section, Team, Instagram, TikTok, X, YouTube, Facebook, LinkedIn, Active, From, To. The same name again adds a link, it never duplicates the person. A sponsor with no section is a global sponsor.")}<span class="spacer"></span>
          <button class="btn" type="button" data-template>${icon("download")}Excel template</button>
          <label class="btn btn-primary">${icon("import")}Upload Excel<input type="file" accept=".xlsx,.xls,.csv" hidden data-file></label></header>
        <p class="mcl-sum">${club.sections.length ? club.sections.map((s) => `<b>${esc(s.name)}</b> ${s.teams.map((t) => esc(t.name)).join(", ") || "—"}`).join(" · ") : "No sections yet."}</p>
        ${pending ? `<div class="mcl-pending">${icon("alert")}<span><b>${num(pending)} account${pending === 1 ? "" : "s"} not scraped yet.</b> Their posts aren't in SCP: add them to the scraping Excel and import their posts as usual.</span><button class="btn btn-sm" type="button" data-scraper>${icon("download")}Accounts for the scraper</button></div>` : ""}
      </section>
      <section class="panel mcl-panel"><header class="aud-h aud-h-lg"><h2>Players</h2><span class="aud-count">${num(people.filter((p) => p.kind === "player").length)}</span></header>${table("player")}</section>
      <section class="panel mcl-panel"><header class="aud-h aud-h-lg"><h2>Sponsors</h2><span class="aud-count">${num(people.filter((p) => p.kind === "sponsor").length)}</span></header>${table("sponsor")}</section>`;
  }

  // the Excel: headers in EN / ES / CA, any order
  const COLS = { type: /^(type|tipo|tipus)$/, name: /^(name|nombre|nom)$/, photo: /^(photo|foto|logo|image|imagen|imatge)$/, section: /^(section|sección|seccion|secció|seccio)$/,
    team: /^(team|equipo|equip)$/, instagram: /^instagram$/, tiktok: /^tiktok$/, x: /^(x|twitter)$/, youtube: /^youtube$/, facebook: /^facebook$/, linkedin: /^linkedin$/,
    active: /^(active|activo|actiu)$/, from: /^(from|desde|des de|start|inicio|inici)$/, to: /^(to|hasta|fins a|end|fin|fi)$/ };
  const dateOf = (v) => { if (v instanceof Date) return v.toISOString().slice(0, 10); const s = String(v || "").trim(); const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : s; };
  async function readExcel(file) {
    const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
    const rows = [];
    for (const name of wb.SheetNames) for (const raw of XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: "" })) {
      const r = {};
      for (const [k, v] of Object.entries(raw)) { const key = Object.keys(COLS).find((c) => COLS[c].test(String(k).trim().toLowerCase())); if (key) r[key] = key === "from" || key === "to" ? dateOf(v) : String(v ?? "").trim(); }
      if (!r.type && /spons|patroc/i.test(name)) r.type = "sponsor";
      if (r.name) rows.push(r);
    }
    return rows;
  }
  function template() {
    const rows = [["Type", "Name", "Photo", "Section", "Team", "Instagram", "TikTok", "X", "YouTube", "Facebook", "LinkedIn", "Active", "From", "To"],
      ["Player", "Player name", "https://…/photo.jpg", "Football", "First team (men)", "handle", "handle", "", "", "", "", "yes", "2026-07-01", ""],
      ["Player", "Player name", "", "Basketball", "First team (women)", "handle", "", "", "", "", "", "yes", "", ""],
      ["Sponsor", "Brand", "https://…/logo.png", "", "", "brandhandle", "", "", "", "", "", "yes", "2025-07-01", "2028-06-30"],
      ["Sponsor", "Brand 2", "", "Handball", "", "brand2", "", "", "", "", "", "yes", "", ""]];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Club");
    XLSX.writeFile(wb, "scp-my-club-template.xlsx");
  }
  function scraperFile() {
    const sec = new Map(club.sections.map((s) => [s.id, s.name])), teamSec = new Map(club.sections.flatMap((s) => s.teams.map((t) => [t.id, s.name])));
    const rows = [["account", "platform", "url", "name", "sport", "club", "entity"]];
    for (const p of club.people) for (const a of p.accounts.filter((x) => !x.posts)) {
      const l = p.links.find((x) => x.live) || p.links[0];
      const sport = l ? (l.team_id ? teamSec.get(l.team_id) : sec.get(l.section_id)) || "" : "";
      const url = { instagram: `https://www.instagram.com/${a.handle}/`, tiktok: `https://www.tiktok.com/@${a.handle}`, x: `https://x.com/${a.handle}`, youtube: `https://www.youtube.com/@${a.handle}`, facebook: `https://www.facebook.com/${a.handle}`, linkedin: `https://www.linkedin.com/company/${a.handle}` }[a.platform] || "";
      rows.push([a.handle, PF[a.platform] || a.platform, url, p.name, sport, club.club.name, p.kind === "player" ? "Player" : "Brand"]);
    }
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Accounts");
    XLSX.writeFile(wb, `scp-${club.club.name.toLowerCase().replace(/\W+/g, "-")}-accounts-to-scrape.xlsx`);
  }

  main.addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b) return;
    try {
      if (b.matches("[data-new]")) {
        const name = prompt("Club name"); if (!name?.trim()) return;
        const id = await rpc("admin_club_save", { p: { name: name.trim(), handles: [] } }); A.toast("Club created"); return loadClubs(id);
      }
      if (b.dataset.pick) { cur = Number(b.dataset.pick); return loadClubs(cur); }
      if (b.matches("[data-template]")) return template();
      if (b.matches("[data-scraper]")) return scraperFile();
      if (b.matches("[data-club-del]")) {
        if (!(await A.confirmDialog({ title: `Delete ${club.club.name}?`, text: "Deletes the club's space, sections, teams, players, sponsors and members. The posts stay in the library.", confirm: "Delete", danger: true }))) return;
        await rpc("admin_club_edit", { p_what: "club_delete", p_id: cur }); cur = null; A.toast("Club deleted"); return loadClubs();
      }
      if (b.dataset.unmember) { const r = await rpc("admin_club_member", { p_club: cur, p_email: b.dataset.unmember, p_remove: true }); if (!r.ok) return fail(new Error(r.error)); return loadClubs(cur); }
      if (b.dataset.end) { await rpc("admin_club_edit", { p_what: "link", p_id: Number(b.dataset.end), p: { ends_on: new Date().toISOString().slice(0, 10) } }); A.toast("Link ended today (kept in the history)"); return loadClub(); }
      if (b.dataset.relink) { await rpc("admin_club_edit", { p_what: "link", p_id: Number(b.dataset.relink), p: { active: true, ends_on: "" } }); return loadClub(); }
      if (b.dataset.del) {
        const p = club.people.find((x) => x.id === Number(b.dataset.del));
        if (!(await A.confirmDialog({ title: `Delete ${p?.name}?`, text: "Removes them from the club with their links and accounts. To keep the history, switch them off instead.", confirm: "Delete", danger: true }))) return;
        await rpc("admin_club_edit", { p_what: "person_delete", p_id: Number(b.dataset.del) }); return loadClubs(cur);
      }
    } catch (x) { fail(x); }
  });
  main.addEventListener("change", async (e) => {
    try {
      if (e.target.dataset.active) { await rpc("admin_club_edit", { p_what: "person", p_id: Number(e.target.dataset.active), p: { active: e.target.checked } }); return loadClub(); }
      if (e.target.matches("[data-file]")) {
        const file = e.target.files[0]; e.target.value = ""; if (!file) return;
        const rows = await readExcel(file);
        if (!rows.length) return fail(new Error("No rows with a Name in that file. Use the Excel template."));
        const r = await rpc("admin_club_import", { p_club: cur, p_rows: rows });
        A.toast(`${num(r.people)} rows · ${num(r.accounts)} accounts${r.skipped ? ` · ${r.skipped} without a name skipped` : ""}`);
        return loadClubs(cur);
      }
    } catch (x) { fail(x); }
  });
  main.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      if (f.matches("[data-form]")) {
        await rpc("admin_club_save", { p: { id: cur, name: f.name.value, logo_url: f.logo_url.value, handles: f.handles.value.split(/[,\s]+/), active: f.active.checked } });
        A.toast("Saved"); return loadClubs(cur);
      }
      if (f.matches("[data-member]")) {
        const r = await rpc("admin_club_member", { p_club: cur, p_email: f.email.value });
        if (!r.ok) return fail(new Error(r.error));
        A.toast("Member added"); return loadClubs(cur);
      }
    } catch (x) { fail(x); }
  });

  loadClubs();
})();
