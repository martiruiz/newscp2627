// SCP Admin — My Club: set up each club's space (my-club.html). Club (name, logo, its own accounts), who can open it,
// and its players and sponsors by section and team, uploaded from an Excel (one row per person and team). Players and
// sponsors keep one record however many teams they're in; links can end (a transfer, a finished deal) without losing history.
// Posts aren't copied: a person's posts are the library posts of their accounts. An account with 0 posts hasn't been
// scraped yet: "Accounts for the scraper" downloads them to add to the scraping Excel.
// Data: supabase/my-club.sql.
(async () => {
  const A = window.SCPA;
  const { $, $$, esc, icon, num, info } = A;
  try { await A.boot("myclub"); } catch { return; }
  const main = $("[data-main]");
  const fail = (e) => A.toast(e.message || String(e), "err");
  async function rpc(name, params = {}) {
    const { data, error } = await A.db.rpc(name, params);
    if (error) throw new Error(/does not exist|schema cache|Could not find the function/i.test(error.message) ? "Run supabase/my-club.sql in Supabase first." : error.message);
    return data;
  }
const CAN_SCRAPE = new Set(["instagram", "tiktok"]);   // the networks Bright Data collects here (club-scrape)
  const PF = { instagram: "Instagram", tiktok: "TikTok", x: "X", youtube: "YouTube", facebook: "Facebook", linkedin: "LinkedIn" };
  let clubs = [], cur = null, club = null;
  // what we sell (clubs.kind): the client's menu and page say "My club / My competition / My agency / My federation"
  const TYPES = [["club", "Club"], ["competition", "Competition"], ["agency", "Agency"], ["federation", "Federation"]];
  // who is linked to a space (club_people.kind), in the order the client's page shows them
  const KINDS = [["competitor", "Competitor", "Competitors", "Real Madrid"], ["player", "Player", "Players", "Lamine Yamal"], ["creator", "Creator", "Content creators", "Ibai Llanos"], ["sponsor", "Sponsor", "Sponsors", "Spotify"]];
  const kindOf = (k) => KINDS.find((x) => x[0] === k) || KINDS[1];

  main.innerHTML = `<div class="page-head"><div><h1>My Club</h1><p>Each club's space: who can open it, its sections and teams, its players and sponsors.</p></div>
    <div class="head-actions"><button class="btn" type="button" data-daily title="Every active club's accounts, for the daily scraping run">${icon("download")}Daily accounts (all clubs)</button><button class="btn btn-primary" type="button" data-new>${icon("plus")}New club</button></div></div>
    <div class="mcl-clubs" data-clubs><p class="muted">Loading…</p></div>
    <div data-club></div>`;

  async function loadClubs(pick) {
    try { clubs = await rpc("admin_clubs"); } catch (e) { $("[data-clubs]").innerHTML = `<p class="panel-pad muted">${esc(e.message)}</p>`; return; }
    cur = pick ?? cur ?? clubs[0]?.id ?? null;
    $("[data-clubs]").innerHTML = clubs.length ? clubs.map((c) => `<button type="button" class="mcl-club${c.id === cur ? " is-on" : ""}" data-pick="${c.id}">
        ${c.logo_url ? `<img src="${esc(c.logo_url)}" alt="">` : `<span class="mcl-ini">${esc(c.name.slice(0, 2).toUpperCase())}</span>`}
        <span><b>${esc(c.name)}</b><small>${esc((TYPES.find((x) => x[0] === c.kind) || TYPES[0])[1])} · ${num(c.players)} players · ${num(c.sponsors)} sponsors · ${num(c.members)} members${c.trials ? ` · ${num(c.trials)} trial` : ""}${c.active ? "" : " · off"}</small></span></button>`).join("")
      : `<p class="muted">No clubs yet. Press “New club”.</p>`;
    if (cur) loadClub(); else $("[data-club]").innerHTML = "";
  }

  // one row per club profile: network + account
  const accRow = (a) => `<div class="mcl-acc-row"><select class="select select-sm" name="acc_platform">${Object.entries(PF).map(([k, v]) => `<option value="${k}"${a.platform === k ? " selected" : ""}>${v}</option>`).join("")}</select>
    <div class="mcl-acc-q"><input class="input input-sm" name="acc_handle" value="${esc(a.handle || "")}" placeholder="@account" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false"><div class="mcl-acc-dd" role="listbox" hidden></div></div>
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
    let dismissed = new Set(); try { dismissed = new Set(JSON.parse(localStorage.getItem(`scp-mcl-dismissed:${cur}`) || "[]")); } catch {}
    const pendingAcc = people.flatMap((p) => p.accounts.filter((a) => !a.posts && !dismissed.has(`${a.platform}|${a.handle}`)).map((a) => ({ ...a, person: p.name })));
    const pending = pendingAcc.length, pendingIg = pendingAcc.filter((a) => CAN_SCRAPE.has(a.platform)).length;
    const linkLabel = (l) => l.team_id ? teamName.get(l.team_id) : l.section_id ? `${secName.get(l.section_id)} · all teams` : "Whole club (global)";
    const table = (kind) => {
      const list = people.filter((p) => p.kind === kind);
      if (!list.length) return `<p class="panel-pad muted">None yet. Search it in the library or add it by hand (buttons on the right).</p>`;
      return `<div class="table-wrap"><table class="data mcl-table"><thead><tr><th>${kindOf(kind)[1]}</th><th>Where</th><th>Accounts</th><th>Active</th><th></th></tr></thead><tbody>
        ${list.map((p) => `<tr${p.active ? "" : ' class="is-off"'}>
          <td><div class="ld-person">${p.photo_url ? `<img class="mcl-ph" src="${esc(p.photo_url)}" alt="">` : `<span class="ld-av">${esc(p.name.charAt(0).toUpperCase())}</span>`}<span><b>${esc(p.name)}</b></span></div></td>
          <td>${p.links.map((l) => `<span class="mcl-link${l.live ? "" : " is-ended"}" title="${esc([l.starts_on && `from ${l.starts_on}`, l.ends_on && `until ${l.ends_on}`].filter(Boolean).join(" ") || "no dates")}">${esc(linkLabel(l))}${l.live ? `<button type="button" title="End this link today (keeps the history)" data-end="${l.id}">✕</button>` : ` <small>ended</small><button type="button" title="Active again" data-relink="${l.id}">↺</button>`}</span>`).join("")}</td>
          <td>${p.accounts.length ? p.accounts.map((a) => `<span class="mcl-acc${a.posts ? "" : " is-zero"}">${esc(PF[a.platform] || a.platform)} @${esc(a.handle)} · <b title="${esc(last.get(`${a.platform}|${a.handle}`) ? `Last post imported ${age(last.get(`${a.platform}|${a.handle}`))}` : "")}">${a.posts ? num(a.posts) + " posts" : "not scraped yet"}</b>${CAN_SCRAPE.has(a.platform) ? scrapeBtn(a) : ""}</span>`).join("") : `<span class="muted">—</span>`}</td>
          <td><input class="check" type="checkbox" aria-label="Active" data-active="${p.id}"${p.active ? " checked" : ""}></td>
          <td class="td-actions">${p.accounts.some((a) => CAN_SCRAPE.has(a.platform)) ? `<button class="btn btn-sm mcl-row-scrape" type="button" data-scrape-person="${p.id}" title="Scrape the last 10 posts of each of its Instagram / TikTok accounts">${icon("download")}Scrape</button>` : ""}<button class="icon-btn" type="button" title="Delete" aria-label="Delete" data-del="${p.id}">${icon("trash")}</button></td></tr>`).join("")}
        </tbody></table></div>`;
    };
    const nPlayers = people.filter((p) => p.kind === "player").length, nSponsors = people.filter((p) => p.kind === "sponsor").length;
    const nPosts = people.reduce((n, p) => n + p.accounts.reduce((m, a) => m + (a.posts || 0), 0), 0);
    let tab = "people"; try { tab = localStorage.getItem("scp-mcl-tab") || "people"; } catch {}
    const tabs = [["people", "Linked accounts", people.length], ["members", "Members", club.members.length], ["settings", "Club settings", null]];
    $("[data-club]").innerHTML = `
      <section class="mcl-hero"${c.colors?.primary ? ` style="--c1:${esc(c.colors.primary)};--c2:${esc(c.colors.secondary || c.colors.primary)}"` : ""}>
        <span class="mcl-hero-logo">${c.logo_url ? `<img src="${esc(c.logo_url)}" alt="">` : `<span>${esc(c.name.slice(0, 2).toUpperCase())}</span>`}</span>
        <div class="mcl-hero-t"><h2>${esc(c.name)}</h2><span class="mcl-hero-st${c.active ? "" : " is-off"}">${c.active ? "Active" : "Inactive"}</span></div>
        <div class="mcl-stats">
          <span><b>${num(nPlayers)}</b>players</span><span><b>${num(nSponsors)}</b>sponsors</span><span><b>${num(club.members.length)}</b>members</span><span><b>${num(nPosts)}</b>posts</span>
        </div>
      </section>
      <nav class="mcl-tabs" role="tablist">${tabs.map(([k, t, n]) => `<button type="button" role="tab" class="mcl-tab${k === tab ? " is-on" : ""}" data-tab="${k}" aria-selected="${k === tab}">${esc(t)}${n != null ? ` <em>${num(n)}</em>` : ""}</button>`).join("")}</nav>

      <div class="mcl-pane" data-pane="people"${tab === "people" ? "" : " hidden"}>
        <div class="mcl-toolbar">
          ${KINDS.map(([k, one]) => `<button class="btn${k === "player" ? " btn-primary" : ""}" type="button" data-add-person="${k}">${icon("plus")}Add ${one.toLowerCase()}</button>`).join("")}
          <button class="btn" type="button" data-add-library="player">${icon("library")}From the library</button>
          <button class="btn" type="button" data-add-sponsor>${icon("library")}Sponsor from the library</button>
          <span class="spacer"></span>
          <details class="mcl-more"><summary class="btn btn-ghost">More${icon("chevron")}</summary>
            <div class="mcl-more-menu">
              <label class="mcl-more-it">${icon("import")}<span><b>Upload Excel</b><small>Many players and sponsors at once</small></span><input type="file" accept=".xlsx,.xls,.csv" hidden data-file></label>
              <button class="mcl-more-it" type="button" data-template>${icon("download")}<span><b>Excel template</b><small>The columns the Excel needs</small></span></button>
              <a class="mcl-more-it" href="import.html?club=${cur}">${icon("import")}<span><b>Import posts (CSV)</b><small>The daily scraping file, for this club</small></span></a>
              <button class="mcl-more-it" type="button" data-scraper>${icon("download")}<span><b>Accounts for the scraper</b><small>This club's accounts with no posts yet</small></span></button>
            </div></details>
        </div>
        ${pending ? `<div class="mcl-pending">${icon("alert")}<div class="mcl-pend-b"><p><b>${num(pending)} account${pending === 1 ? "" : "s"} without posts yet</b></p>
          <ul class="mcl-pend-list">${pendingAcc.map((a) => `<li><span>${esc(PF[a.platform] || a.platform)} <b>@${esc(a.handle)}</b> <small>${esc(a.person)}</small></span>
            ${CAN_SCRAPE.has(a.platform) ? scrapeBtn(a) : `<small class="muted">not collected here yet: use the scraping Excel</small>`}
            <button class="mcl-pend-x" type="button" data-dismiss="${esc(`${a.platform}|${a.handle}`)}" title="Discard: don't ask for it again">✕</button></li>`).join("")}</ul></div>
          ${pendingIg > 1 ? `<button class="btn btn-primary btn-sm" type="button" data-scrape-all>${icon("download")}Scrape all ${num(pendingIg)}</button>` : ""}</div>` : ""}
        <div class="mcl-live" data-live hidden></div>
        ${club.sections.length ? `<p class="mcl-sum">${club.sections.map((x) => `<b>${esc(x.name)}</b> ${x.teams.map((t) => esc(t.name)).join(", ") || "—"}`).join(" · ")}</p>` : ""}
        <section class="panel mcl-panel"><header class="aud-h aud-h-lg"><h2>${esc((TYPES.find((x) => x[0] === c.kind) || TYPES[0])[1])} account</h2><span class="aud-count">${num((c.accounts || []).length + (c.library_tags || []).length)}</span>${info("The space's own profiles (Club settings) and its library tags. Their posts show in the client's first tab.")}<span class="spacer"></span><button class="btn btn-sm" type="button" data-add-library="account">${icon("library")}From the library</button></header>
          ${(c.accounts || []).length || (c.library_tags || []).length ? `<div class="mcl-clubaccs">${(c.library_tags || []).map((t) => `<span class="mcl-acc">Library tag · <b>${esc(t.name)}</b> · ${num(t.posts)} posts<button type="button" title="Remove" aria-label="Remove" data-tag-del="${t.id}">✕</button></span>`).join("")}${(c.accounts || []).map((a) => `<span class="mcl-acc">${esc(PF[a.platform] || a.platform)} @${esc(a.handle)}${CAN_SCRAPE.has(a.platform) ? scrapeBtn(a, true) : ""}</span>`).join("")}</div>`
            : `<p class="panel-pad muted">None yet. Add it from the library, or its profiles in Club settings.</p>`}</section>
        ${KINDS.map(([k, , many]) => `<section class="panel mcl-panel"><header class="aud-h aud-h-lg"><h2>${many}</h2><span class="aud-count">${num(people.filter((p) => p.kind === k).length)}</span>
          <span class="spacer"></span><button class="btn btn-sm" type="button" ${k === "sponsor" ? "data-add-sponsor" : `data-add-library="${k}"`}>${icon("library")}From the library</button><button class="btn btn-sm btn-ghost" type="button" data-add-person="${k}">${icon("plus")}By hand</button></header>${table(k)}</section>`).join("")}
      </div>

      <div class="mcl-pane" data-pane="members"${tab === "members" ? "" : " hidden"}>
        <section class="panel mcl-panel"><header class="aud-h aud-h-lg"><h2>Members</h2>${info("Who can open this club's space, by the e-mail of their SCP account (a free account is enough). A member gets every feature while they're a member; a trial lasts 7 days. Each account only sees its own club.")}</header>
        <p class="mcl-help">Members see ${esc(c.name)}'s My Club: its players' and sponsors' posts, only for them.</p>
        ${club.members.length ? `<div class="table-wrap"><table class="data mcl-table"><thead><tr><th>E-mail</th><th>Access</th><th>Until</th><th></th></tr></thead><tbody>
          ${club.members.map((m) => `<tr${m.live ? "" : ' class="is-off"'}><td><b>${esc(m.email)}</b></td>
            <td>${!m.live ? `<span class="status status-analyzed">${m.trial ? "Trial ended" : "Ended"}</span>` : m.trial ? `<span class="status status-importing">7-day trial</span>` : `<span class="status status-completed">Member</span>`}${m.live && !m.access ? ` <span class="status status-failed" title="This account has no library access, so it can't open the club. Remove it and add it again.">No access</span>` : ""}</td>
            <td>${m.ends_at ? `${esc(new Date(m.ends_at).toLocaleDateString())} <small class="muted">${m.live ? `(${Math.max(1, Math.ceil((new Date(m.ends_at) - Date.now()) / 864e5))} d)` : ""}</small>` : `<span class="muted">—</span>`}</td>
            <td class="td-actions">${m.trial ? `<button class="btn btn-sm" type="button" data-access="extend" data-email="${esc(m.email)}" title="7 more days">+7 days</button><button class="btn btn-sm" type="button" data-access="member" data-email="${esc(m.email)}" title="Full member, no end">Make member</button>` : ""}<button class="icon-btn" type="button" title="Remove" aria-label="Remove" data-access="remove" data-email="${esc(m.email)}">${icon("trash")}</button></td></tr>`).join("")}
          </tbody></table></div>` : `<p class="muted">Nobody yet.</p>`}
        <form class="mcl-add" data-member><input class="input" type="email" name="email" placeholder="name@club.com" required>
          <select class="select" name="kind"><option value="member">Member</option><option value="trial">7-day trial</option></select>
          <button class="btn" type="submit">${icon("plus")}Add</button></form></section>
      </div>

      <div class="mcl-pane" data-pane="settings"${tab === "settings" ? "" : " hidden"}>
        <section class="panel mcl-panel"><header class="aud-h aud-h-lg"><h2>Club settings</h2>${info("Name, logo and profiles shown on the club's page. The club's profiles (as many per network as it has) also tell which sponsor posts are “linked to the club”: the ones that mention one of them.")}</header>
        <form class="mcl-form mcl-set" data-form>
          <div class="mcl-set-card">
            <div class="mcl-set-h"><b>Identity</b><small>The crest and the name the club's members see.</small></div>
            <div class="mcl-ident">
              <label class="mcl-crest-up" title="Upload logo"><span class="mcl-logo-prev" data-logo-prev>${c.logo_url ? `<img src="${esc(c.logo_url)}" alt="">` : `<span>${esc(c.name.slice(0, 2).toUpperCase())}</span>`}</span>
                <span class="mcl-crest-ov">${icon("import")}Change</span><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden data-logo-file></label>
              <div class="mcl-ident-f">
                <label>Name<input class="input mcl-name-in" name="name" value="${esc(c.name)}" required></label>
                <label>Type<select class="select" name="kind" title="The client's menu and page say My club, My competition, My agency or My federation">${TYPES.map(([k, l]) => `<option value="${k}"${(c.kind || "club") === k ? " selected" : ""}>${l}</option>`).join("")}</select></label>
                <div class="mcl-logo-act">
                  ${c.library_logo && c.library_logo !== c.logo_url ? `<button class="btn btn-sm" type="button" data-logo-lib="${esc(c.library_logo)}">Use the SCP logo</button>` : ""}
                  ${c.logo_url ? `<button class="btn btn-ghost btn-sm" type="button" data-logo-clear>Remove logo</button>` : ""}
                  <details class="mcl-logo-link"><summary>Paste an image link</summary><input class="input input-sm" name="logo_url" value="${esc(c.logo_url || "")}" placeholder="https://…/crest.png"></details>
                </div>
              </div>
            </div>
          </div>
          <div class="mcl-set-card">
            <div class="mcl-set-h"><b>Colours</b><small>The club's page takes them: buttons, tabs, its header. Empty: taken from the crest.</small></div>
            <div class="mcl-colors">
              <label class="mcl-swatch"><input type="color" name="color1" value="${esc(c.colors?.primary || "#f0b84a")}" data-color-set="${c.colors?.primary ? 1 : ""}"><span><b>Primary</b><small class="mono" data-hex="color1">${esc(c.colors?.primary || "from the crest")}</small></span></label>
              <label class="mcl-swatch"><input type="color" name="color2" value="${esc(c.colors?.secondary || "#121b33")}" data-color-set="${c.colors?.secondary ? 1 : ""}"><span><b>Secondary</b><small class="mono" data-hex="color2">${esc(c.colors?.secondary || "from the crest")}</small></span></label>
              <button class="btn btn-ghost btn-sm" type="button" data-colors-clear>${c.colors ? "Use the crest's colours" : "From the crest (no colours set)"}</button>
            </div>
            <div class="mcl-cprev" data-cprev style="--c1:${esc(c.colors?.primary || "#f0b84a")};--c2:${esc(c.colors?.secondary || "#121b33")}"><span>${esc(c.name)}</span></div>
          </div>
          <div class="mcl-set-card">
            <div class="mcl-set-h"><b>Club profiles</b> <em class="mcl-count">${num((c.accounts || []).length)}</em><small>The club's own accounts. They also tell which sponsor posts are linked to the club (the ones that mention them).</small></div>
            <div class="mcl-accs"><div data-accs>${(c.accounts?.length ? c.accounts : [{ platform: "instagram", handle: "" }]).map(accRow).join("")}</div>
              <button class="btn btn-ghost btn-sm mcl-acc-add" type="button" data-acc-add>${icon("plus")}Add profile</button></div>
          </div>
          <div class="mcl-set-bar">
            <label class="mcl-switch"><input type="checkbox" name="active"${c.active ? " checked" : ""}><i></i><span>Active<small>Members can open the club's space</small></span></label>
            <span class="spacer"></span>
            <button class="btn btn-ghost mcl-del" type="button" data-club-del>${icon("trash")}Delete club</button>
            <button class="btn btn-primary" type="submit">Save changes</button>
          </div>
        </form></section>
      </div>`;
    renderLive();
    for (const j of jobs.values()) if (!j.done && !j.error) { const b = $(`[data-scrape="${CSS.escape(j.id)}"]`, main); if (b) { b.disabled = true; b.classList.add("is-hacking"); b.innerHTML = `<span class="hk">&gt; scraping<i class="hk-cur"></i></span>`; } }
    resumeScrapes();
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
      if (!r.type && /compet|rival/i.test(name)) r.type = "competitor";
      if (!r.type && /creat|influ/i.test(name)) r.type = "creator";
      if (r.name) rows.push(r);
    }
    return rows;
  }
  function template() {
    const rows = [["Type", "Name", "Photo", "Section", "Team", "Instagram", "TikTok", "X", "YouTube", "Facebook", "LinkedIn", "Active", "From", "To"],
      ["Player", "Player name", "https://…/photo.jpg", "Football", "First team (men)", "handle", "handle", "", "", "", "", "yes", "2026-07-01", ""],
      ["Player", "Player name", "", "Basketball", "First team (women)", "handle", "", "", "", "", "", "yes", "", ""],
      ["Sponsor", "Brand", "https://…/logo.png", "", "", "brandhandle", "", "", "", "", "", "yes", "2025-07-01", "2028-06-30"],
      ["Sponsor", "Brand 2", "", "Handball", "", "brand2", "", "", "", "", "", "yes", "", ""],
      ["Competitor", "Rival club", "", "", "", "rivalhandle", "", "", "", "", "", "yes", "", ""],
      ["Creator", "Creator name", "", "", "", "creatorhandle", "creatorhandle", "", "", "", "", "yes", "", ""]];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Club");
    XLSX.writeFile(wb, "scp-my-club-template.xlsx");
  }
  // collections started before a reload: pick them up (scrapeNow finds them in this browser)
  // (one tab only: another tab polling it — a beat in the last 25 s — keeps it, so it's never imported twice)
  const TAB = Math.random().toString(36).slice(2);
  function resumeScrapes() {
    for (const b of $$("[data-scrape]", main)) {
      let sv = null; try { sv = JSON.parse(localStorage.getItem(`scp-scrape:${cur}:${b.dataset.scrape}`) || "null"); } catch {}
      if (!sv || b.disabled) continue;
      if (sv.tab && sv.tab !== TAB && Date.now() - (sv.beat || 0) < 25000) { b.disabled = true; b.classList.add("is-hacking"); b.innerHTML = `<span class="hk">&gt; running in another tab<i class="hk-cur"></i></span>`; continue; }
      scrapeNow(b.dataset.scrape, b);
    }
  }

  // every Instagram account of the club with no posts yet, 3 at a time (each takes 1–2 minutes at Bright Data)
  async function scrapeAll(btn) {
    const list = [...new Map([...$$(".mcl-pend-list [data-scrape]", main)].filter((x) => !x.disabled).map((x) => [x.dataset.scrape, x])).values()];
    if (!list.length) return;
    btn.disabled = true;
    let i = 0;
    const next = async () => { while (i < list.length) { const b = list[i++]; await scrapeNow(b.dataset.scrape, b, true); } };
    await Promise.all([next(), next(), next()]);
    btn.disabled = false;
    loadClub();
  }

  // one player or sponsor by hand: name, where, Instagram / TikTok, and its Instagram scraped right away
  async function personDialog(kind) {
    // Section: the platform's sports (the Sport filter) and the club's own sections; Team: the club's teams and the usual
    // ones. Both searchable, and a name that isn't there can be created (it's created with the person)
    const catalog = await A.loadCatalog();
    const uniq = (names) => [...new Map(names.filter(Boolean).map((n) => [n.toLowerCase(), n])).values()];
    const secNames = uniq([...club.sections.map((x) => x.name), ...catalog.byCat.sport.slice().sort((a, b) => (b.ideas || 0) - (a.ideas || 0)).map((v) => v.name)]);
    const teamNames = uniq([...club.sections.flatMap((x) => x.teams.map((t) => t.name)), "First team (men)", "First team (women)", "B team", "Academy"]);
    const opts = (names) => names.map((name, i) => ({ id: i + 1, name }));
    const m = A.modal({ title: `Add ${kindOf(kind)[1].toLowerCase()}`, size: "sm",
      body: `<form class="mcl-new mcl-person" data-person-form>
        <label>Name<input class="input" name="name" required maxlength="120" placeholder="${kindOf(kind)[3]}" autofocus></label>
        <div class="mcl-person-2"><div class="field"><span class="label">Section${kind !== "player" ? " <small>(empty: the whole space)</small>" : ""}</span><div data-ms-sec></div></div>
          <div class="field"><span class="label">Team</span><div data-ms-team></div></div></div>
        <div class="mcl-person-2"><label>Instagram<input class="input" name="instagram" placeholder="@lamineyamal" autocomplete="off"></label>
          <label>TikTok<input class="input" name="tiktok" placeholder="@handle (optional)" autocomplete="off"></label></div>
        <label class="check-inline mcl-person-scrape"><input type="checkbox" name="scrape" checked> Scrape its last 10 Instagram posts now (only in this club's My Club)</label>
      </form>`,
      foot: `<button class="btn btn-ghost" type="button" data-x>Cancel</button><button class="btn btn-primary" type="button" data-ok>${icon("plus")}Add</button>` });
    const f = $("[data-person-form]", m.el);
    const pick = (box, names) => {
      const ms = new A.MultiSelect($(box, m.el), { single: true, options: opts(names), onCreate: async (name) => ({ id: -Date.now(), name }) });
      return () => (ms.value()[0] != null ? ms.nameOf(ms.value()[0]) : "");
    };
    const secOf = pick("[data-ms-sec]", secNames), teamOf = pick("[data-ms-team]", teamNames);
    $("[data-x]", m.el).onclick = () => m.close();
    const save = async () => {
      const v = (n) => f[n].value.trim();
      if (!v("name")) return f.name.focus();
      const handle = v("instagram").replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/.*$/, "").toLowerCase();
      try {
        await rpc("admin_club_import", { p_club: cur, p_rows: [{ type: kind, name: v("name"), section: secOf(), team: secOf() ? teamOf() : "", instagram: handle, tiktok: v("tiktok").replace(/^@/, "") }] });
        m.close();
        A.toast(`${v("name")} added`);
        await loadClub();
        const b = handle && f.scrape.checked ? $(`[data-scrape="${CSS.escape(`instagram|${handle}`)}"]`, main) : null;
        if (b) { b.scrollIntoView({ block: "center", behavior: "smooth" }); scrapeNow(`instagram|${handle}`, b); }
      } catch (x) { fail(x); }
    };
    $("[data-ok]", m.el).onclick = save;
    f.addEventListener("submit", (e) => { e.preventDefault(); save(); });
  }

  // "Scrape now": Bright Data collects the account's last 10 posts (supabase/functions/club-scrape) and they're imported like
  // the daily scraping CSV (Admin → Import): club_mark_imported puts them only in this club's My Club, then their covers load.
  // Each collection is a job shown live in the "Scraping" panel ([data-live]): its step, Bright Data's state and a log.
  const STEPS = ["Bright Data", "Collecting posts", "Importing", "My Club", "Covers", "Done"];
  const jobs = new Map();   // handle → { handle, step, t0, log: [[time, kind, text]], records, n, error, done }
  let liveTimer = 0;
  const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  function renderLive() {
    const box = $("[data-live]", main);
    if (!box) return;
    const list = [...jobs.values()];
    box.hidden = !list.length;
    box.innerHTML = list.length ? `<header class="mcl-live-h"><b>${icon("download")}Scraping</b><span class="muted">${num(list.filter((j) => !j.done && !j.error).length)} running</span><span class="spacer"></span>
        ${list.some((j) => j.done || j.error) ? `<button class="btn btn-ghost btn-sm" type="button" data-live-clear>Clear finished</button>` : ""}</header>
      ${list.map((j) => `<article class="mcl-job${j.error ? " is-err" : j.done ? " is-done" : ""}">
        <div class="mcl-job-h"><b>${esc(PF[j.platform] || "")} @${esc(j.handle)}</b><span class="mono">${mmss((j.end || Date.now()) - j.t0)}</span>
          ${!j.done && !j.error && j.snap ? `<button class="mcl-job-x" type="button" data-cancel-job="${esc(j.id)}" title="Stop this collection at Bright Data">✕ Cancel</button>` : ""}${j.done || j.error ? `<button class="mcl-job-close" type="button" data-close-job="${esc(j.id)}" title="Close" aria-label="Close">✕</button>` : ""}<span class="mcl-job-st">${j.error ? `${icon("alert")}${esc(j.error)}` : j.done ? `${icon("check")}${num(j.n)} posts in My Club` : `<i class="hk-dot"></i>${esc(STEPS[j.step])}${j.step === 1 && j.records ? ` · ${num(j.records)} posts so far` : ""}`}</span></div>
        <ol class="mcl-steps">${STEPS.map((t, k) => `<li class="${k < j.step || j.done ? "is-ok" : k === j.step && !j.error ? "is-on" : k === j.step && j.error ? "is-err" : ""}">${esc(t)}</li>`).join("")}</ol>
        <div class="mcl-job-log${j.done || j.error ? "" : " is-live"}"><p class="is-cmd">scp@myclub:~$ scrape --${esc(j.platform)} @${esc(j.handle)} --posts 10</p>${j.log.slice(-7).map(([t, k, x]) => `<p class="is-${k}${Date.now() - t < 900 ? " is-new" : ""}"><span>[${mmss(t - j.t0)}]</span>${esc(x)}</p>`).join("")}${j.done || j.error ? "" : `<p class="is-prompt">&gt; <i class="hk-cur"></i></p>`}</div>
      </article>`).join("")}` : "";
    clearInterval(liveTimer);
    if (list.some((j) => !j.done && !j.error)) liveTimer = setInterval(renderLive, 1000);
  }

  async function scrapeNow(id, btn, quiet = false) {
    const [platform, handle] = id.includes("|") ? id.split("|") : ["instagram", id];
    const clubAcc = btn?.hasAttribute("data-club-acc");
    if (jobs.get(id) && !jobs.get(id).done && !jobs.get(id).error) return;   // already running
    const label = btn.innerHTML;
    const job = { id, handle, platform, step: 0, t0: Date.now(), log: [], records: 0, n: 0 };
    jobs.set(id, job);
    const log = (kind, text) => { job.log.push([Date.now(), kind, text]); renderLive(); };
    const step = (k, text) => { job.step = k; log("step", text); };
    const btns = () => { const l = $$(`[data-scrape="${CSS.escape(id)}"]`, main); return l.length ? l : [btn]; };   // the table's and the pending list's
    // while it runs the button is a tiny terminal: green monospace, a blinking cursor, a scanline (no spinner)
    const say = (t) => btns().forEach((b) => { b.disabled = true; b.classList.add("is-hacking"); b.innerHTML = `<span class="hk">&gt; ${esc(String(t).toLowerCase().replace(/…$/, ""))}<i class="hk-cur"></i></span>`; });
    say("Starting…");
    try {
      // Bright Data → the import (core.js), remembered in this browser so a reload picks it up
      const { rows, out, res } = await A.scrapeAndImport({ platform, handle, num: 10, job, log, step, say, tab: TAB,
        key: `scp-scrape:${cur}:${id}`, filename: `Bright Data · @${handle} · ${club.club.name}`,
        // a club's own account: its posts carry the club's tag (they go to the library, like the daily scraping)
        mapRows: (r) => (clubAcc ? { ...r, club: club.club.name } : r) });
      // the first time: the account's profile picture becomes the player's / sponsor's photo (kept in Storage by club-scrape)
      const owner = club.people.find((x) => x.accounts.some((acc) => acc.platform === platform && acc.handle === handle));
      if (res.avatar && owner && !owner.photo_url) {
        await rpc("admin_club_edit", { p_what: "person", p_id: owner.id, p: { photo_url: res.avatar } }).then(() => { owner.photo_url = res.avatar; log("ok", `Profile picture saved as ${owner.name}'s photo`); }, () => {});
      } else if (owner?.photo_url) log("info", `${owner.name} already has a photo: kept`);
      step(3, `Putting them in ${club.club.name}'s My Club`);
      const mark = await rpc("club_mark_imported", { p_external_ids: rows.map((r) => r.external_id) });
      log("ok", `${num(mark?.club_only || 0)} only in My Club · ${num(mark?.tags_added || 0)} tags added (club, sport, ${people_kind(handle)})`);
      // their covers, shape and length, as after an import (12 per call)
      const { data: ids } = await A.db.from("content_ideas").select("id").in("external_id", rows.map((r) => r.external_id));
      step(4, `Loading ${num((ids || []).length)} covers`); say("Loading covers…");
      await A.loadCovers((ids || []).map((x) => x.id));
      const { count: withCover } = await A.db.from("content_ideas").select("id", { count: "exact", head: true }).in("external_id", rows.map((r) => r.external_id)).not("cover_url", "is", null);
      log("ok", `${num(withCover || 0)} of ${num(rows.length)} with cover`);
      job.n = out.created + out.replaced; job.step = 5; job.done = true; job.end = Date.now();
      log("ok", `Done: ${num(job.n)} posts in ${club.club.name}'s My Club`);
      A.toast(`@${handle}: ${num(job.n)} posts in ${club.club.name}'s My Club.`);
      if (quiet) btns().forEach((b) => { b.classList.remove("is-hacking"); b.innerHTML = `${icon("check")}${num(job.n)} posts`; b.classList.add("is-done"); }); else loadClub();
    } catch (x) {
      job.error = x.message || String(x); job.end = Date.now(); log("err", job.error);
      btns().forEach((b) => { b.disabled = false; b.classList.remove("is-hacking"); b.innerHTML = label; });
      fail(x);
    }
  }
  // the Scrape button of one account: "Scrape" when it has no posts, ↻ "Update" when it has (new posts are added)
  function scrapeBtn(a, clubAcc = false) {
    const k = `${a.platform}|${a.handle}`;
    return `<button class="mcl-scrape${a.posts ? " is-again" : ""}" type="button" data-scrape="${esc(k)}"${clubAcc ? " data-club-acc" : ""} title="${a.posts ? "Collect its last 10 posts again (new ones are added)" : "Bright Data collects its last 10 posts"}">${icon(a.posts ? "undo" : "download")}${a.posts ? "Update" : "Scrape"}</button>`;
  }
  // the library's entity of each kind (a competitor can be a club, a competition…: none)
  const ENTITY = { player: "Player", sponsor: "Brand", creator: "Content Creators", competitor: "" };
  const people_kind = (handle) => ENTITY[club.people.find((p) => p.accounts.some((a) => a.handle === handle))?.kind] ?? "Player";

  function scraperFile() {
    const sec = new Map(club.sections.map((s) => [s.id, s.name])), teamSec = new Map(club.sections.flatMap((s) => s.teams.map((t) => [t.id, s.name])));
    const rows = [["account", "platform", "url", "name", "sport", "club", "entity"]];
    for (const p of club.people) for (const a of p.accounts.filter((x) => !x.posts)) {
      const l = p.links.find((x) => x.live) || p.links[0];
      const sport = l ? (l.team_id ? teamSec.get(l.team_id) : sec.get(l.section_id)) || "" : "";
      const url = { instagram: `https://www.instagram.com/${a.handle}/`, tiktok: `https://www.tiktok.com/@${a.handle}`, x: `https://x.com/${a.handle}`, youtube: `https://www.youtube.com/@${a.handle}`, facebook: `https://www.facebook.com/${a.handle}`, linkedin: `https://www.linkedin.com/company/${a.handle}` }[a.platform] || "";
      rows.push([a.handle, PF[a.platform] || a.platform, url, p.name, sport, club.club.name, ENTITY[p.kind] ?? "Player"]);
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
      ...list.map((a) => [a.handle, PF[a.platform] || a.platform, url[a.platform]?.(a.handle) || "", a.person, a.section || "", a.club, ENTITY[a.kind] ?? "Player", a.posts, a.last_post ? a.last_post.slice(0, 10) : ""])];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Club accounts");
    XLSX.writeFile(wb, `scp-clubs-accounts-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // a club, competition, player or creator already in the Content Library, in one go: its accounts (every network) and
  // its library tag (most library posts have no account: the tag brings them). As the space's own accounts or as a
  // competitor, player or creator (supabase/my-club-library-add.sql)
  function addFromLibrary(kind = "account") {
    const sel = { tag: null, accounts: new Map(), name: "", avatar: "" };
    const typeName = (TYPES.find((x) => x[0] === club.club.kind) || TYPES[0])[1];
    const asOpts = [["account", `${typeName} account`], ...KINDS.filter(([k]) => k !== "sponsor").map(([k, one]) => [k, one])];
    const scopes = [["", `Whole ${typeName.toLowerCase()}`], ...club.sections.flatMap((s) => [[`s${s.id}`, `${s.name} · all teams`], ...s.teams.map((t) => [`t${t.id}`, `${s.name} · ${t.name}`])])];
    const m = A.modal({ title: "Add from the library", sub: "Search a club, competition, player or creator that's already in the Content Library: its posts show in this space.", size: "lg",
      body: `<div class="mcl-sp">
        <label class="mcl-sp-q">${icon("filters")}<input class="input" type="search" placeholder="FC Barcelona, @lamineyamal, LaLiga…" data-lb-q autofocus></label>
        <div class="mcl-sp-res" data-lb-res><p class="muted">Type at least 2 letters.</p></div>
        <div class="mcl-sp-form">
          <label>Add as<select class="select" data-lb-kind>${asOpts.map(([v, l]) => `<option value="${v}"${v === kind ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
          <label data-lb-person>Name<input class="input" data-lb-name></label>
          <label data-lb-person>Where<select class="select" data-lb-scope>${scopes.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("")}</select></label>
        </div>
        <p class="mcl-sp-sum" data-lb-sum></p></div>`,
      foot: `<button class="btn btn-primary" type="button" data-lb-save>${icon("plus")}Add</button>` });
    const el = m.el, res = el.querySelector("[data-lb-res]"), kindSel = el.querySelector("[data-lb-kind]");
    const person = () => kindSel.value !== "account";
    const showPerson = () => el.querySelectorAll("[data-lb-person]").forEach((x) => { x.hidden = !person(); });
    kindSel.addEventListener("change", showPerson); showPerson();
    let data = [];
    const sum = () => { el.querySelector("[data-lb-sum]").textContent = [sel.tag ? `Library tag “${sel.tag.name}” · ${num(sel.tag.posts)} posts` : "", sel.accounts.size ? `${sel.accounts.size} account${sel.accounts.size === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ") || "Pick a result."; };
    const draw = () => {
      res.innerHTML = data.length ? data.map((g, i) => `<div class="mcl-lb-g">
          <p class="mcl-sp-h">${g.avatar ? `<img src="${esc(g.avatar)}" alt="">` : ""}${esc(g.name)}</p>
          ${g.tag ? `<button type="button" class="mcl-sp-item${sel.tag?.id === g.tag.id ? " is-on" : ""}" data-lb-tag="${i}"><b>Library tag · ${esc(g.tag.name)}</b><small>${esc(g.tag.category)}</small><span>${num(g.tag.posts)} posts</span></button>` : ""}
          ${g.accounts.map((a) => { const k = `${a.platform}|${a.handle}`; return `<button type="button" class="mcl-sp-item${sel.accounts.has(k) ? " is-on" : ""}" data-lb-acc="${esc(k)}" data-lb-g="${i}"><b>${esc(PF[a.platform] || a.platform)} @${esc(a.handle)}</b><span>${num(a.posts)} posts</span></button>`; }).join("")}
        </div>`).join("") : `<p class="muted">Nothing in the library with that name.</p>`;
      sum();
    };
    // picking a result takes its tag and the accounts with posts (each can be switched off)
    const take = (g) => {
      sel.tag = g.tag || null; sel.accounts = new Map(g.accounts.filter((a) => a.posts > 0).map((a) => [`${a.platform}|${a.handle}`, { platform: a.platform, handle: a.handle }]));
      sel.avatar = g.avatar || ""; el.querySelector("[data-lb-name]").value = (g.tag?.name || g.name).replace(/^@/, "");
    };
    let timer;
    el.querySelector("[data-lb-q]").addEventListener("input", (e) => {
      clearTimeout(timer);
      const q = e.target.value.trim();
      if (q.length < 2) { res.innerHTML = `<p class="muted">Type at least 2 letters.</p>`; return; }
      res.innerHTML = `<p class="muted">Searching…</p>`;
      timer = setTimeout(async () => { try { data = await rpc("admin_library_profiles", { p_q: q }); draw(); } catch (x) { fail(/admin_library_profiles/.test(x.message) ? new Error("Run supabase/my-club-library-add.sql in Supabase first.") : x); } }, 350);
    });
    res.addEventListener("click", (e) => {
      const t = e.target.closest("[data-lb-tag]"), a = e.target.closest("[data-lb-acc]");
      if (t) { const g = data[Number(t.dataset.lbTag)]; if (sel.tag?.id === g.tag.id) sel.tag = null; else if (sel.tag || sel.accounts.size) sel.tag = g.tag; else take(g); }
      if (a) { const k = a.dataset.lbAcc, g = data[Number(a.dataset.lbG)];
        if (!sel.tag && !sel.accounts.size) take(g); else if (sel.accounts.has(k)) sel.accounts.delete(k); else sel.accounts.set(k, { platform: k.split("|")[0], handle: k.split("|")[1] }); }
      draw();
    });
    sum();
    el.querySelector("[data-lb-save]").addEventListener("click", async () => {
      const name = el.querySelector("[data-lb-name]").value.trim(), scope = el.querySelector("[data-lb-scope]").value;
      if (!sel.tag && !sel.accounts.size) return fail(new Error("Pick a result."));
      if (person() && !name) return fail(new Error("It needs a name."));
      try {
        const r = await rpc("admin_club_add_from_library", { p_club: cur, p: { kind: kindSel.value, name, photo_url: sel.avatar, tag_id: sel.tag?.id || null, accounts: [...sel.accounts.values()],
          section_id: scope.startsWith("s") ? scope.slice(1) : null, team_id: scope.startsWith("t") ? scope.slice(1) : null } });
        if (!r.ok) return fail(new Error(r.error));
        m.close(); A.toast(`${name || sel.tag?.name || "Accounts"} added`); loadClubs(cur);
      } catch (x) { fail(x); }
    });
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

  // the "More" menu closes on a click outside it or after a file is chosen
  document.addEventListener("click", (e) => { $$(".mcl-more[open]", main).forEach((d) => { if (!d.contains(e.target)) d.removeAttribute("open"); }); });
  main.addEventListener("change", (e) => { if (e.target.matches("[data-file]")) e.target.closest(".mcl-more")?.removeAttribute("open"); });
  main.addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b) return;
    try {
      if (b.matches("[data-new]")) {   // a small form (the app's browser has no prompt())
        const m = A.modal({ title: "New club", size: "sm", body: `<form class="mcl-new" data-new-form><label>Name<input class="input" name="name" required maxlength="120" placeholder="FC Barcelona"></label><label>Type<select class="select" name="kind">${TYPES.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></label></form>`,
          foot: `<button class="btn btn-primary" type="button" data-new-save>Create club</button>` });
        const input = m.el.querySelector("[name=name]"); input.focus();
        const create = async () => {
          if (!input.value.trim()) return input.focus();
          try { const id = await rpc("admin_club_save", { p: { name: input.value.trim(), accounts: [], kind: m.el.querySelector("[name=kind]").value } }); m.close(); A.toast("Club created"); loadClubs(id); } catch (x) { fail(x); }
        };
        m.el.querySelector("[data-new-save]").addEventListener("click", create);
        m.el.querySelector("[data-new-form]").addEventListener("submit", (ev) => { ev.preventDefault(); create(); });
        return;
      }
      if (b.dataset.pick) { cur = Number(b.dataset.pick); return loadClubs(cur); }
      if (b.matches("[data-template]")) return template();
      if (b.matches("[data-daily]")) return dailyFile();
      if (b.matches("[data-add-sponsor]")) return addSponsor();
      if (b.dataset.addLibrary) return addFromLibrary(b.dataset.addLibrary);
      if (b.dataset.tagDel) { await rpc("admin_club_tag_remove", { p_club: cur, p_tag: Number(b.dataset.tagDel) }); A.toast("Library tag removed"); return loadClub(); }
      if (b.matches("[data-acc-add]")) { $("[data-accs]").insertAdjacentHTML("beforeend", accRow({ platform: "instagram", handle: "" })); return $("[data-accs] .mcl-acc-row:last-child [name=acc_handle]").focus(); }
      if (b.matches("[data-acc-del]")) return b.closest(".mcl-acc-row").remove();
      if (b.dataset.logoLib) return setLogo(b.dataset.logoLib);
      if (b.matches("[data-logo-clear]")) return setLogo("");
      if (b.matches("[data-scraper]")) return scraperFile();
      if (b.dataset.scrape) return scrapeNow(b.dataset.scrape, b);
      if (b.matches("[data-scrape-all]")) return scrapeAll(b);
      if (b.dataset.scrapePerson) {
        const p = club.people.find((x) => x.id === Number(b.dataset.scrapePerson));
        for (const a of p?.accounts || []) if (CAN_SCRAPE.has(a.platform)) { const k = `${a.platform}|${a.handle}`; scrapeNow(k, $(`tr [data-scrape="${CSS.escape(k)}"]`, main) || b, true); }
        return;
      }
      if (b.dataset.dismiss) {
        let d = []; try { d = JSON.parse(localStorage.getItem(`scp-mcl-dismissed:${cur}`) || "[]"); } catch {}
        try { localStorage.setItem(`scp-mcl-dismissed:${cur}`, JSON.stringify([...new Set([...d, b.dataset.dismiss])])); } catch {}
        return loadClub();
      }
      b.closest(".mcl-more")?.removeAttribute("open");
      if (b.dataset.tab) {
        try { localStorage.setItem("scp-mcl-tab", b.dataset.tab); } catch {}
        $$("[data-tab]", main).forEach((t) => { t.classList.toggle("is-on", t === b); t.setAttribute("aria-selected", t === b); });
        $$("[data-pane]", main).forEach((p) => { p.hidden = p.dataset.pane !== b.dataset.tab; });
        return;
      }
      if (b.dataset.closeJob) { jobs.delete(b.dataset.closeJob); return renderLive(); }
      if (b.dataset.cancelJob) {
        const j = jobs.get(b.dataset.cancelJob); if (!j?.snap) return;
        b.disabled = true; b.textContent = "Cancelling…";
        const { data, error } = await A.db.functions.invoke("club-scrape", { body: { action: "cancel", snapshot_id: j.snap } });
        if (error || data?.error) { b.disabled = false; b.textContent = "✕ Cancel"; return fail(new Error(data?.error || "Bright Data didn't answer.")); }
        try { localStorage.removeItem(`scp-scrape:${cur}:${j.id}`); } catch {}
        j.cancelled = true; j.log.push([Date.now(), "warn", `Cancelled at Bright Data (${j.snap})`]); renderLive();
        return A.toast(`@${j.handle}: collection cancelled`);
      }
      if (b.matches("[data-live-clear]")) { for (const [h, j] of jobs) if (j.done || j.error) jobs.delete(h); return renderLive(); }
      if (b.dataset.addPerson) return personDialog(b.dataset.addPerson);
      if (b.matches("[data-club-del]")) {
        if (!(await A.confirmDialog({ title: `Delete ${club.club.name}?`, text: "Deletes the club's space, sections, teams, players, sponsors and members. The posts stay in the library.", confirm: "Delete", danger: true }))) return;
        await rpc("admin_club_edit", { p_what: "club_delete", p_id: cur }); cur = null; A.toast("Club deleted"); return loadClubs();
      }
      if (b.dataset.access) {
        if (b.dataset.access === "remove" && !(await A.confirmDialog({ title: `Remove ${b.dataset.email}?`, text: "They lose access to this club's space (and the features it gave them).", confirm: "Remove", danger: true }))) return;
        const r = await rpc("admin_club_access", { p_club: cur, p_email: b.dataset.email, p_action: b.dataset.access });
        if (!r.ok) return fail(new Error(r.error));
        A.toast({ extend: "Trial extended by 7 days", member: "Now a full member", remove: "Member removed" }[b.dataset.access]); return loadClubs(cur);
      }
      if (b.dataset.end) { await rpc("admin_club_edit", { p_what: "link", p_id: Number(b.dataset.end), p: { ends_on: new Date().toISOString().slice(0, 10) } }); A.toast("Link ended today (kept in the history)"); return loadClub(); }
      if (b.dataset.relink) { await rpc("admin_club_edit", { p_what: "link", p_id: Number(b.dataset.relink), p: { active: true, ends_on: "" } }); return loadClub(); }
      if (b.dataset.del) {
        const p = club.people.find((x) => x.id === Number(b.dataset.del));
        if (!(await A.confirmDialog({ title: `Delete ${p?.name}?`, text: "Removes them from the club with their links and accounts. To keep the history, switch them off instead.", confirm: "Delete", danger: true }))) return;
        await rpc("admin_club_edit", { p_what: "person_delete", p_id: Number(b.dataset.del) }); return loadClubs(cur);
      }
    } catch (x) { fail(x); }
  });
  // Club profiles: typing in @account searches that network's accounts on the platform (library + scraped profiles);
  // pick one from the drop-down (click, or arrows + Enter). Any other handle can still be typed by hand.
  // Data: admin_account_search (supabase/club-account-search.sql); before it runs, admin_brand_search filtered by network.
  const accSearch = async (platform, q) => {
    try { return await rpc("admin_account_search", { p_platform: platform, p_q: q }); }
    catch (x) {
      if (!/Run supabase|admin_account_search/.test(x.message)) throw x;
      return ((await rpc("admin_brand_search", { p_q: q })).accounts || []).filter((a) => a.platform === platform);
    }
  };
  let accTimer, accSeq = 0;
  const ddOf = (input) => input.closest(".mcl-acc-q").querySelector(".mcl-acc-dd");
  const ddClose = (input) => { const dd = ddOf(input); dd.hidden = true; dd.innerHTML = ""; input.setAttribute("aria-expanded", "false"); };
  const ddPick = (input, opt) => { input.value = opt.dataset.handle; ddClose(input); input.focus(); };
  function accLookup(input) {
    clearTimeout(accTimer);
    const q = input.value.trim().replace(/^@/, ""), dd = ddOf(input);
    const platform = input.closest(".mcl-acc-row").querySelector("[name=acc_platform]").value;
    if (q.length < 2) return ddClose(input);
    accTimer = setTimeout(async () => {
      const seq = ++accSeq;
      dd.hidden = false; input.setAttribute("aria-expanded", "true");
      dd.innerHTML = `<p class="mcl-acc-dd-msg">Searching…</p>`;
      let list;
      try { list = await accSearch(platform, q); } catch (x) { ddClose(input); return fail(x); }
      if (seq !== accSeq || document.activeElement !== input) return;
      dd.innerHTML = list.length ? list.map((a, i) => `<button type="button" class="mcl-acc-opt${i === 0 ? " is-act" : ""}" role="option" data-handle="${esc(a.handle)}" tabindex="-1">
          <span class="mcl-acc-av">${esc((a.name || a.handle).replace(/^[^a-z0-9]+/i, "").charAt(0).toUpperCase() || "@")}</span>
          <span class="mcl-acc-tx"><b>@${esc(a.handle)}</b>${a.name ? `<small>${esc(a.name)}</small>` : ""}</span>
          <span class="mcl-acc-n">${a.posts ? `${num(a.posts)} posts` : "not scraped yet"}</span></button>`).join("")
        : `<p class="mcl-acc-dd-msg">No ${esc(PF[platform] || platform)} accounts with that name. You can still type it by hand.</p>`;
    }, 220);
  }
  main.addEventListener("input", (e) => {
    if (e.target.matches("[name=acc_handle]")) accLookup(e.target);
    if (e.target.matches("[name=color1], [name=color2]")) {   // chosen by hand: saved; the hex and the preview follow
      const f = e.target.form; f.color1.dataset.colorSet = f.color2.dataset.colorSet = "1";
      $$("[data-hex]", f).forEach((h) => { h.textContent = f[h.dataset.hex].value; });
      const pv = $("[data-cprev]", f); if (pv) { pv.style.setProperty("--c1", f.color1.value); pv.style.setProperty("--c2", f.color2.value); }
    }
  });
  // back to the crest's colours: nothing is saved, the page works them out
  main.addEventListener("click", (e) => {
    const b = e.target.closest("[data-colors-clear]"); if (!b) return;
    const f = b.form; f.color1.dataset.colorSet = f.color2.dataset.colorSet = ""; f.color1.value = "#f0b84a"; f.color2.value = "#121b33";
    b.textContent = "From the crest (save to apply)";
    $$("[data-hex]", f).forEach((h) => { h.textContent = "from the crest"; });
  });
  main.addEventListener("focusin", (e) => { if (e.target.matches("[name=acc_handle]") && e.target.value.trim().length >= 2 && ddOf(e.target).hidden) accLookup(e.target); });
  main.addEventListener("focusout", (e) => { if (e.target.matches("[name=acc_handle]")) setTimeout(() => { if (document.activeElement !== e.target) ddClose(e.target); }, 150); });
  // mousedown so the pick happens before the input loses focus
  main.addEventListener("mousedown", (e) => { const o = e.target.closest(".mcl-acc-opt"); if (!o) return; e.preventDefault(); ddPick(o.closest(".mcl-acc-q").querySelector("input"), o); });
  main.addEventListener("keydown", (e) => {
    if (!e.target.matches("[name=acc_handle]")) return;
    const dd = ddOf(e.target); if (dd.hidden) return;
    const opts = [...dd.querySelectorAll(".mcl-acc-opt")], i = opts.findIndex((o) => o.classList.contains("is-act"));
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault(); if (!opts.length) return;
      const n = (i + (e.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length;
      opts.forEach((o, k) => o.classList.toggle("is-act", k === n)); opts[n].scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && opts[i]) { e.preventDefault(); ddPick(e.target, opts[i]); }
    else if (e.key === "Escape") { e.preventDefault(); ddClose(e.target); }
  });
  main.addEventListener("change", async (e) => {
    // another network: search the same text again on it
    if (e.target.matches("[name=acc_platform]")) { const h = e.target.closest(".mcl-acc-row").querySelector("[name=acc_handle]"); if (h.value.trim().length >= 2) { h.focus(); accLookup(h); } return; }
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
        const colors = f.color1.dataset.colorSet || f.color2.dataset.colorSet ? { primary: f.color1.value, secondary: f.color2.value } : {};
        await rpc("admin_club_save", { p: { id: cur, name: f.name.value, logo_url: f.logo_url.value, accounts, active: f.active.checked, colors, kind: f.kind.value } });
        A.toast("Saved"); return loadClubs(cur);
      }
      if (f.matches("[data-member]")) {
        const r = await rpc("admin_club_access", { p_club: cur, p_email: f.email.value, p_action: f.kind.value });
        if (!r.ok) return fail(new Error(r.error));
        A.toast(f.kind.value === "trial" ? "7-day trial given" : "Member added"); return loadClubs(cur);
      }
    } catch (x) { fail(x); }
  });

  loadClubs();
})();
