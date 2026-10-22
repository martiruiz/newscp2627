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
    <div class="head-actions"><button class="btn" type="button" data-daily title="Every active club's accounts, for the daily scraping run">${icon("download")}Daily accounts (all clubs)</button><button class="btn btn-primary" type="button" data-new>${icon("plus")}New club</button></div></div>
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

  // one row per club profile: network + account
  const accRow = (a) => `<div class="mcl-acc-row"><select class="select select-sm" name="acc_platform">${Object.entries(PF).map(([k, v]) => `<option value="${k}"${a.platform === k ? " selected" : ""}>${v}</option>`).join("")}</select>
    <input class="input input-sm" name="acc_handle" value="${esc(a.handle || "")}" placeholder="@account">
    <select class="select select-sm" name="acc_section" title="Section of this profile (its posts show in that section; none = every section)"><option value="">All sections</option>${(club?.sections || []).map((x) => `<option value="${x.id}"${Number(a.section_id) === x.id ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select><button class="icon-btn" type="button" title="Remove" aria-label="Remove" data-acc-del>${icon("trash")}</button></div>`;
  const setLogo = (url) => {
    const f = $("[data-form]"); f.logo_url.value = url;
    $("[data-logo-prev]").innerHTML = url ? `<img src="${esc(url)}" alt="">` : `<span>${esc(club.club.name.slice(0, 2).toUpperCase())}</span>`;
  };
  async function uploadLogo(file) {
    if (file.size > 1048576) return fail(new Error("The logo must be 1 MB or less."));
    const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z]/g, "");
    const path = `clubs/${cur}-${Date.now()}.${ext}`;
    const { error } = await A.db.storage.from("logos").upload(path, file, { contentType: file.type, upsert: true });
    if (error) return fail(new Error(/policy|row-level|not allowed/i.test(error.message) ? "Run supabase/my-club.sql again (it adds the logo upload)." : error.message));
    setLogo(A.db.storage.from("logos").getPublicUrl(path).data.publicUrl);
    A.toast("Logo uploaded. Press Save to keep it.");
  }

  async function loadClub() {
    try { club = await rpc("admin_club", { p_club: cur }); } catch (e) { return fail(e); }
    // each account's last imported post (supabase/my-club-daily.sql), to see that the daily scraping keeps it fresh
    const last = new Map();
    try { for (const a of await rpc("admin_club_accounts")) last.set(`${a.platform}|${a.handle}`, a.last_post); } catch {}
    const age = (d) => { if (!d) return ""; const n = Math.floor((Date.now() - new Date(d)) / 864e5); return n <= 0 ? "today" : n === 1 ? "1 day ago" : `${n} days ago`; };
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
          <td>${p.accounts.length ? p.accounts.map((a) => `<span class="mcl-acc${a.posts ? "" : " is-zero"}">${esc(PF[a.platform] || a.platform)} @${esc(a.handle)} · <b title="${esc(last.get(`${a.platform}|${a.handle}`) ? `Last post imported ${age(last.get(`${a.platform}|${a.handle}`))}` : "")}">${a.posts ? num(a.posts) + " posts" : "not scraped yet"}</b></span>`).join("") : `<span class="muted">—</span>`}</td>
          <td><input class="check" type="checkbox" aria-label="Active" data-active="${p.id}"${p.active ? " checked" : ""}></td>
          <td class="td-actions"><button class="icon-btn" type="button" title="Delete" aria-label="Delete" data-del="${p.id}">${icon("trash")}</button></td></tr>`).join("")}
        </tbody></table></div>`;
    };
    $("[data-club]").innerHTML = `
      <section class="panel mcl-panel"><header class="aud-h aud-h-lg"><h2>Club</h2>${info("Name, logo and profiles shown on the club's page. The club's profiles (as many per network as it has) also tell which sponsor posts are “linked to the club”: the ones that mention one of them.")}</header>
        <form class="mcl-form" data-form>
          <div class="mcl-logo-edit">
            <span class="mcl-logo-prev" data-logo-prev>${c.logo_url ? `<img src="${esc(c.logo_url)}" alt="">` : `<span>${esc(c.name.slice(0, 2).toUpperCase())}</span>`}</span>
            <div class="mcl-logo-act">
              <label class="btn btn-sm">${icon("import")}Upload logo<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden data-logo-file></label>
              ${c.library_logo && c.library_logo !== c.logo_url ? `<button class="btn btn-sm" type="button" data-logo-lib="${esc(c.library_logo)}">Use the SCP logo</button>` : ""}
              ${c.logo_url ? `<button class="btn btn-ghost btn-sm" type="button" data-logo-clear>Remove</button>` : ""}
              <input class="input input-sm" name="logo_url" value="${esc(c.logo_url || "")}" placeholder="…or paste an image URL">
            </div>
          </div>
          <label>Name<input class="input" name="name" value="${esc(c.name)}" required></label>
          <div class="mcl-accs"><span class="mcl-accs-h">Club profiles</span>
            <div data-accs>${(c.accounts?.length ? c.accounts : [{ platform: "instagram", handle: "" }]).map(accRow).join("")}</div>
            <button class="btn btn-ghost btn-sm" type="button" data-acc-add>${icon("plus")}Add profile</button></div>
          <label class="check-inline"><input type="checkbox" name="active"${c.active ? " checked" : ""}> Active</label>
          <div class="mcl-form-act"><button class="btn btn-primary" type="submit">Save</button><button class="btn btn-danger" type="button" data-club-del>${icon("trash")}Delete club</button></div>
        </form></section>
      <section class="panel mcl-panel"><header class="aud-h aud-h-lg"><h2>Members</h2>${info("Who can open this club's space (they also need an active plan or trial). Add them by the e-mail of their SCP account.")}</header>
        <div class="mcl-members">${club.members.map((m) => `<span class="mcl-member">${esc(m.email)}<button type="button" title="Remove" data-unmember="${esc(m.email)}">✕</button></span>`).join("") || `<span class="muted">Nobody yet.</span>`}</div>
        <form class="mcl-add" data-member><input class="input" type="email" name="email" placeholder="name@club.com" required><button class="btn" type="submit">${icon("plus")}Add member</button></form></section>
      <section class="panel mcl-panel"><header class="aud-h aud-h-lg"><h2>Players &amp; sponsors</h2>${info("Upload an Excel with one row per person and team: Type (player / sponsor), Name, Photo, Section, Team, Instagram, TikTok, X, YouTube, Facebook, LinkedIn, Active, From, To. The same name again adds a link, it never duplicates the person. A sponsor with no section is a global sponsor.")}<span class="spacer"></span>
          <a class="btn" href="import.html?club=${cur}" title="The daily scraping CSV (same as Admin → Import): its players' and sponsors' posts go to this club's My Club">${icon("import")}Import posts (CSV)</a>
          <button class="btn" type="button" data-template>${icon("download")}Excel template</button>
          <label class="btn btn-primary">${icon("import")}Upload Excel<input type="file" accept=".xlsx,.xls,.csv" hidden data-file></label></header>
        <p class="mcl-sum">${club.sections.length ? club.sections.map((s) => `<b>${esc(s.name)}</b> ${s.teams.map((t) => esc(t.name)).join(", ") || "—"}`).join(" · ") : "No sections yet."}</p>
        ${pending ? `<div class="mcl-pending">${icon("alert")}<span><b>${num(pending)} account${pending === 1 ? "" : "s"} not scraped yet.</b> Their posts aren't in SCP: add them to the scraping Excel and import their posts as usual.</span><button class="btn btn-sm" type="button" data-scraper>${icon("download")}Accounts for the scraper</button></div>` : ""}
      </section>
      <section class="panel mcl-panel"><header class="aud-h aud-h-lg"><h2>Players</h2><span class="aud-count">${num(people.filter((p) => p.kind === "player").length)}</span></header>${table("player")}</section>
      <section class="panel mcl-panel"><header class="aud-h aud-h-lg"><h2>Sponsors</h2><span class="aud-count">${num(people.filter((p) => p.kind === "sponsor").length)}</span><span class="spacer"></span><button class="btn btn-primary btn-sm" type="button" data-add-sponsor>${icon("plus")}Add sponsor from the library</button></header>${table("sponsor")}</section>`;
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

  // every active club's accounts for the daily scraping run (same columns as the accounts Excel)
  async function dailyFile() {
    const list = await rpc("admin_club_accounts");
    if (!list.length) return fail(new Error("No club accounts yet."));
    const url = { instagram: (h) => `https://www.instagram.com/${h}/`, tiktok: (h) => `https://www.tiktok.com/@${h}`, x: (h) => `https://x.com/${h}`, youtube: (h) => `https://www.youtube.com/@${h}`, facebook: (h) => `https://www.facebook.com/${h}`, linkedin: (h) => `https://www.linkedin.com/company/${h}` };
    const rows = [["account", "platform", "url", "name", "sport", "club", "entity", "posts in SCP", "last post imported"],
      ...list.map((a) => [a.handle, PF[a.platform] || a.platform, url[a.platform]?.(a.handle) || "", a.person, a.section || "", a.club, a.kind === "player" ? "Player" : "Brand", a.posts, a.last_post ? a.last_post.slice(0, 10) : ""])];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Club accounts");
    XLSX.writeFile(wb, `scp-clubs-accounts-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // a sponsor from the library: its scraped accounts and / or its sponsor tag, and where it belongs
  function addSponsor() {
    const pick = { accounts: new Map(), tag: null };
    const scopes = [["", "Whole club (global sponsor)"], ...club.sections.flatMap((s) => [[`s${s.id}`, `${s.name} · all teams`], ...s.teams.map((t) => [`t${t.id}`, `${s.name} · ${t.name}`])])];
    const m = A.modal({ title: "Add sponsor from the library", sub: "Search a brand: its scraped accounts (their posts) and its sponsor tag (the club's posts where it appears).", size: "lg",
      body: `<div class="mcl-sp">
        <label class="mcl-sp-q">${icon("filters")}<input class="input" type="search" placeholder="Search a brand: nike, spotify, @redbull…" data-sp-q autofocus></label>
        <div class="mcl-sp-res" data-sp-res><p class="muted">Type at least 2 letters.</p></div>
        <div class="mcl-sp-form">
          <label>Name<input class="input" data-sp-name placeholder="Brand name"></label>
          <label>Logo URL<input class="input" data-sp-logo placeholder="https://…"></label>
          <label>Where<select class="select" data-sp-scope>${scopes.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("")}</select></label>
          <label>Since<input class="input" type="date" data-sp-from></label>
        </div>
        <p class="mcl-sp-sum" data-sp-sum></p></div>`,
      foot: `<button class="btn btn-primary" type="button" data-sp-save>Add sponsor</button>` });
    const el = m.el, res = el.querySelector("[data-sp-res]");
    const sum = () => { el.querySelector("[data-sp-sum]").textContent = [pick.accounts.size ? `${pick.accounts.size} account${pick.accounts.size === 1 ? "" : "s"}` : "", pick.tag ? `tag “${pick.tag.name}”` : ""].filter(Boolean).join(" · ") || "Pick at least one account or the sponsor tag."; };
    let data = { accounts: [], sponsors: [] };
    const draw = () => {
      res.innerHTML = (data.accounts.length ? `<p class="mcl-sp-h">Scraped accounts</p>${data.accounts.map((a) => { const k = `${a.platform}|${a.handle}`; return `<button type="button" class="mcl-sp-item${pick.accounts.has(k) ? " is-on" : ""}" data-sp-acc="${esc(k)}"><b>${esc(PF[a.platform] || a.platform)} @${esc(a.handle)}</b>${a.name ? `<small>${esc(a.name)}</small>` : ""}<span>${num(a.posts)} posts</span></button>`; }).join("")}` : "")
        + (data.sponsors.length ? `<p class="mcl-sp-h">Sponsor tags</p>${data.sponsors.map((t) => `<button type="button" class="mcl-sp-item${pick.tag?.id === t.id ? " is-on" : ""}" data-sp-tag="${t.id}">${t.logo_url ? `<img src="${esc(t.logo_url)}" alt="">` : ""}<b>${esc(t.name)}</b><span>${num(t.posts)} posts</span></button>`).join("")}` : "")
        || `<p class="muted">Nothing in the library with that name.</p>`;
      sum();
    };
    let timer;
    el.querySelector("[data-sp-q]").addEventListener("input", (e) => {
      clearTimeout(timer);
      const q = e.target.value.trim();
      if (q.length < 2) { res.innerHTML = `<p class="muted">Type at least 2 letters.</p>`; return; }
      timer = setTimeout(async () => { try { data = await rpc("admin_brand_search", { p_q: q }); draw(); } catch (x) { fail(x); } }, 250);
    });
    res.addEventListener("click", (e) => {
      const a = e.target.closest("[data-sp-acc]"), t = e.target.closest("[data-sp-tag]");
      const name = el.querySelector("[data-sp-name]"), logo = el.querySelector("[data-sp-logo]");
      if (a) { const k = a.dataset.spAcc; pick.accounts.has(k) ? pick.accounts.delete(k) : pick.accounts.set(k, { platform: k.split("|")[0], handle: k.split("|")[1] }); if (!name.value) name.value = data.accounts.find((x) => `${x.platform}|${x.handle}` === k)?.name || k.split("|")[1]; }
      if (t) { const tag = data.sponsors.find((x) => x.id === Number(t.dataset.spTag)); pick.tag = pick.tag?.id === tag.id ? null : tag; if (pick.tag) { name.value = tag.name; if (tag.logo_url && !logo.value) logo.value = tag.logo_url; } }
      draw();
    });
    sum();
    el.querySelector("[data-sp-save]").addEventListener("click", async () => {
      const name = el.querySelector("[data-sp-name]").value.trim(), scope = el.querySelector("[data-sp-scope]").value;
      if (!name) return fail(new Error("The sponsor needs a name."));
      if (!pick.accounts.size && !pick.tag) return fail(new Error("Pick at least one account or the sponsor tag."));
      try {
        const r = await rpc("admin_club_add_sponsor", { p_club: cur, p: { name, photo_url: el.querySelector("[data-sp-logo]").value, catalog_value_id: pick.tag?.id || null,
          accounts: [...pick.accounts.values()], section_id: scope.startsWith("s") ? scope.slice(1) : null, team_id: scope.startsWith("t") ? scope.slice(1) : null, starts_on: el.querySelector("[data-sp-from]").value } });
        if (!r.ok) return fail(new Error(r.error));
        m.close(); A.toast(`${name} added`); loadClubs(cur);
      } catch (x) { fail(/admin_club_add_sponsor|admin_brand_search/.test(x.message) ? new Error("Run supabase/my-club-daily.sql in Supabase first.") : x); }
    });
  }

  main.addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b) return;
    try {
      if (b.matches("[data-new]")) {   // a small form (the app's browser has no prompt())
        const m = A.modal({ title: "New club", size: "sm", body: `<form class="mcl-new" data-new-form><label>Club name<input class="input" name="name" required maxlength="120" placeholder="FC Barcelona"></label></form>`,
          foot: `<button class="btn btn-primary" type="button" data-new-save>Create club</button>` });
        const input = m.el.querySelector("[name=name]"); input.focus();
        const create = async () => {
          if (!input.value.trim()) return input.focus();
          try { const id = await rpc("admin_club_save", { p: { name: input.value.trim(), accounts: [] } }); m.close(); A.toast("Club created"); loadClubs(id); } catch (x) { fail(x); }
        };
        m.el.querySelector("[data-new-save]").addEventListener("click", create);
        m.el.querySelector("[data-new-form]").addEventListener("submit", (ev) => { ev.preventDefault(); create(); });
        return;
      }
      if (b.dataset.pick) { cur = Number(b.dataset.pick); return loadClubs(cur); }
      if (b.matches("[data-template]")) return template();
      if (b.matches("[data-daily]")) return dailyFile();
      if (b.matches("[data-add-sponsor]")) return addSponsor();
      if (b.matches("[data-acc-add]")) { $("[data-accs]").insertAdjacentHTML("beforeend", accRow({ platform: "instagram", handle: "" })); return $("[data-accs] .mcl-acc-row:last-child input").focus(); }
      if (b.matches("[data-acc-del]")) return b.closest(".mcl-acc-row").remove();
      if (b.dataset.logoLib) return setLogo(b.dataset.logoLib);
      if (b.matches("[data-logo-clear]")) return setLogo("");
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
      if (e.target.matches("[data-logo-file]")) { const file = e.target.files[0]; e.target.value = ""; if (file) await uploadLogo(file); return; }
      if (e.target.dataset.active) { await rpc("admin_club_edit", { p_what: "person", p_id: Number(e.target.dataset.active), p: { active: e.target.checked } }); return loadClub(); }
      if (e.target.matches("[data-file]")) {
        const file = e.target.files[0]; e.target.value = ""; if (!file) return;
        const rows = await readExcel(file);
        if (!rows.length) return fail(new Error("No rows with a Name in that file. Use the Excel template."));
        const r = await rpc("admin_club_import", { p_club: cur, p_rows: rows });
        A.toast(`${num(r.people)} rows · ${num(r.accounts)} accounts${r.skipped ? ` · ${r.skipped} without a name skipped` : ""}`);
        A.db.rpc("club_mark_posts", { p_ids: null }).then(() => {}, () => {});   // tags for the club-only posts of these accounts (my-club-daily.sql)
        return loadClubs(cur);
      }
    } catch (x) { fail(x); }
  });
  main.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      if (f.matches("[data-form]")) {
        const accounts = [...f.querySelectorAll(".mcl-acc-row")].map((r) => ({ platform: r.querySelector("[name=acc_platform]").value, handle: r.querySelector("[name=acc_handle]").value.trim(), section_id: r.querySelector("[name=acc_section]").value || null })).filter((a) => a.handle);
        await rpc("admin_club_save", { p: { id: cur, name: f.name.value, logo_url: f.logo_url.value, accounts, active: f.active.checked } });
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
