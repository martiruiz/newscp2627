// SCP Admin — Scraped profiles: the accounts we scrape with Bright Data, uploaded from the accounts Excel (columns
// account, sport, competition, club, platform, url; the tabs named "premium" mark the premium profiles). Shows how active
// each profile is on SCP, warns when one goes quiet, and reports the premium Instagram / TikTok profiles' posts of the
// last 24 h. Data: supabase/scraped-profiles.sql (posts know their account from the URL or the import's account column).
(async () => {
  const A = window.SCPA;
  const { $, esc, icon, num } = A;
  try { await A.boot("profiles"); } catch { return; }
  const main = $("[data-main]");
  const fail = (e) => A.toast(e.message || String(e), "err");
  async function rpc(name, params = {}) {
    const { data, error } = await A.db.rpc(name, params);
    if (error) throw new Error(/does not exist|schema cache|Could not find the function/i.test(error.message) ? "Run supabase/scraped-profiles.sql in Supabase first." : error.message);
    return data;
  }
  const PF = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", x: "X", facebook: "Facebook", linkedin: "LinkedIn" };
  const DAY = 864e5;
  const daysAgo = (d) => (d ? Math.floor((Date.now() - new Date(d)) / DAY) : null);
  const ago = (d) => { const n = daysAgo(d); return n == null ? "never" : n === 0 ? "today" : n === 1 ? "1 day ago" : `${n} days ago`; };

  // ---------- the Excel: same rules as supabase/scraped-profiles.sql (platform_from_url, clean_handle) ----------
  const platformOf = (v) => {
    const s = String(v || "").toLowerCase();
    return /instagram/.test(s) ? "instagram" : /tiktok/.test(s) ? "tiktok" : /youtu/.test(s) ? "youtube" : /(^|[^a-z])(x|twitter)(\.com|$)/.test(s) ? "x"
      : /facebook/.test(s) ? "facebook" : /linkedin/.test(s) ? "linkedin" : "";
  };
  const cleanHandle = (v) => {
    const s = String(v || "").trim();
    const m = s.match(/tiktok\.com\/@([\w.]+)/i) || s.match(/(?:x|twitter)\.com\/(\w+)\/status/i) || s.match(/instagram\.com\/([\w.]+)\/(?:p|reel|reels|tv)\//i)
      || s.match(/youtube\.com\/@([\w.-]+)/i) || s.match(/(?:instagram|tiktok|x|twitter|youtube)\.com\/@?([\w.-]+)/i);
    return (m ? m[1] : s.replace(/^@/, "")).replace(/^\/+|\/+$/g, "").toLowerCase();
  };
  async function readExcel(file) {
    const wb = XLSX.read(await file.arrayBuffer());
    const out = new Map(), sheets = [];
    for (const name of wb.SheetNames) {
      const premium = /premium/i.test(name);
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: "" });
      let n = 0;
      for (const raw of rows) {
        const r = Object.fromEntries(Object.entries(raw).map(([k, v]) => [String(k).trim().toLowerCase().replace(/[\s-]+/g, "_"), String(v ?? "").trim()]));
        const url = r.url || r.profile_url || r.link || "";
        const platform = platformOf(r.platform) || platformOf(url) || platformOf(name);
        const handle = cleanHandle(r.account || r.handle || r.username || url);
        if (!platform || !handle) continue;
        n++;
        const k = `${platform}|${handle}`, prev = out.get(k);
        out.set(k, { platform, handle, name: r.name || prev?.name || "", sport: r.sport || prev?.sport || "", competition: r.competition || prev?.competition || "",
          club: r.club || prev?.club || "", url: url || prev?.url || "", premium: premium || !!prev?.premium });
      }
      sheets.push({ name, premium, rows: n });
    }
    return { profiles: [...out.values()], sheets };
  }

  // ---------- page ----------
  main.innerHTML = `<div class="page-head"><div><h1>Scraped profiles</h1><p>The accounts we scrape with Bright Data: how active they are on SCP, warnings, and the premium daily report.</p></div>
    <div class="head-actions"><label class="btn btn-primary">${icon("import")}Upload accounts Excel<input type="file" accept=".xlsx,.xls,.csv" hidden data-file></label></div></div>
    <section data-preview></section>
    <section class="stats" data-stats></section>
    <p class="muted ms-small" style="margin-top:10px" data-views-status></p>
    <section class="panel panel-pad" style="margin-top:16px" data-report></section>
    <section class="panel panel-pad" style="margin-top:16px" data-alerts></section>
    <section class="panel" style="margin-top:16px">
      <div class="panel-pad ms-row pf-bar" style="margin:0">
        <input class="input input-sm" type="search" placeholder="Search handle, club, competition…" data-q>
        <select class="select input-sm" data-pf><option value="">All networks</option></select>
        <label class="pf-check"><input type="checkbox" data-prem> Premium only</label>
        <label class="pf-check"><input type="checkbox" data-warn> With warnings</label>
        <label class="pf-check"><input type="checkbox" data-gone> Show removed</label>
        <span class="muted ms-small" data-count></span>
      </div>
      <div class="table-wrap"><table class="data"><thead><tr><th>Profile</th><th>Network</th><th>Sport · competition</th><th>Last post on SCP</th><th>7 days</th><th>30 days</th><th>Total</th><th>Status</th></tr></thead>
        <tbody data-rows><tr><td colspan="8">Loading…</td></tr></tbody></table></div>
    </section>
    <p class="muted ms-small" style="margin-top:12px">A post is linked to its profile through its URL (TikTok, X and YouTube links carry the account; Instagram <code>/p/</code> links don't) or through an <code>account</code> column in the posts import (Admin → Import). Without it, Instagram profiles show no posts.</p>`;

  let D = { profiles: [], settings: { low_posts_7d: 2, stale_days: 7 }, uploads: [] };
  const warnOf = (p) => {
    if (!p.active) return null;
    const d = daysAgo(p.last_post);
    if (d == null) return { cls: "bad", text: "No posts on SCP" };
    if (d > D.settings.stale_days) return { cls: "bad", text: `Nothing for ${d} days` };
    if (Number(p.posts_7d) < D.settings.low_posts_7d) return { cls: "warn", text: "Low activity" };
    return null;
  };

  async function draw() {
    try {
      const [d, rep] = await Promise.all([rpc("admin_scraped_profiles"), rpc("admin_premium_report", { p_hours: 24 })]);
      D = d; drawStats(); drawReport(rep); drawAlerts(); drawTable();
    } catch (e) { $("[data-rows]").innerHTML = `<tr><td colspan="8" class="muted">${esc(e.message)}</td></tr>`; }
  }
  function drawStats() {
    const act = D.profiles.filter((p) => p.active);
    const w = act.map(warnOf).filter(Boolean);
    const last = D.uploads[0];
    $("[data-stats]").innerHTML = [
      ["Profiles", num(act.length), last ? `Excel ${esc(last.filename || "")} · ${A.fmtDateTime(last.created_at)}` : "No Excel uploaded yet"],
      ["Premium", num(act.filter((p) => p.premium).length), ["instagram", "tiktok"].map((pf) => `${PF[pf]} ${num(act.filter((p) => p.premium && p.platform === pf).length)}`).join(" · ")],
      ["Low activity", num(w.filter((x) => x.cls === "warn").length), `fewer than ${D.settings.low_posts_7d} posts in 7 days`],
      ["No recent content", num(w.filter((x) => x.cls === "bad").length), `nothing for more than ${D.settings.stale_days} days`],
    ].map(([l, n, s]) => `<div class="stat"><p>${l}</p><b>${n}</b><p>${s}</p></div>`).join("");
    const pf = [...new Set(D.profiles.map((p) => p.platform))];
    const sel = $("[data-pf]"), cur = sel.value;
    sel.innerHTML = `<option value="">All networks</option>${pf.map((p) => `<option value="${esc(p)}">${esc(PF[p] || p)}</option>`).join("")}`;
    sel.value = cur;
  }

  // the premium profiles' posts of the last 24 h, after each daily import
  function drawReport(rep) {
    const rows = rep.rows || [], imp = rep.last_import;
    const col = (pf) => {
      const list = rows.filter((r) => r.platform === pf);
      const prem = D.profiles.filter((p) => p.active && p.premium && p.platform === pf);
      const by = new Map(list.map((r) => [r.handle, r]));
      const all = prem.map((p) => ({ ...p, added: Number(by.get(p.handle)?.added || 0), published: Number(by.get(p.handle)?.published || 0) })).sort((a, b) => b.added - a.added || a.handle.localeCompare(b.handle));
      const zero = all.filter((p) => !p.added).length;
      return `<div class="pf-rep"><h3>${PF[pf]} <span class="muted">· ${num(all.reduce((s, p) => s + p.added, 0))} posts${zero ? ` · <span class="pf-bad">${zero} with none</span>` : ""}</span></h3>
        ${all.length ? `<ul>${all.map((p) => `<li class="${p.added ? "" : "is-zero"}"><span>@${esc(p.handle)}${p.club ? ` <small class="muted">${esc(p.club)}</small>` : ""}</span><b title="${p.published} published in the last 24 h">${p.added}</b></li>`).join("")}</ul>`
          : `<p class="muted ms-small">No premium ${PF[pf]} profiles. Add them in the Excel's premium tab.</p>`}</div>`;
    };
    $("[data-report]").innerHTML = `<div class="pf-head"><h2>Premium · last 24 hours</h2><p class="muted ms-small">${imp ? `Last import: ${esc(imp.filename)} · ${A.fmtDateTime(imp.at)} · ${num(imp.rows || 0)} new posts` : "No completed import yet"} · posts added to SCP in the last 24 h for each premium profile</p></div>
      <div class="pf-cols">${col("instagram")}${col("tiktok")}</div>`;
  }

  function drawAlerts() {
    const list = D.profiles.map((p) => ({ p, w: warnOf(p) })).filter((x) => x.w)
      .sort((a, b) => (b.p.premium - a.p.premium) || ((daysAgo(b.p.last_post) ?? 1e9) - (daysAgo(a.p.last_post) ?? 1e9)));
    $("[data-alerts]").innerHTML = `<div class="pf-head"><h2>Warnings <span class="muted">· ${num(list.length)}</span></h2>
      <form class="pf-th" data-th>Low activity under <input class="input input-sm" type="number" min="0" name="low" value="${D.settings.low_posts_7d}"> posts in 7 days · no content after <input class="input input-sm" type="number" min="1" name="stale" value="${D.settings.stale_days}"> days <button class="btn btn-sm btn-ghost" type="submit">Save</button></form></div>
      ${list.length ? `<ul class="pf-alerts">${list.slice(0, 40).map(({ p, w }) => `<li><span class="ms-badge is-${w.cls === "bad" ? "bad" : "warn"}">${esc(w.text)}</span> <b>@${esc(p.handle)}</b> <span class="muted">${esc(PF[p.platform] || p.platform)}${p.premium ? " · premium" : ""}${p.club ? ` · ${esc(p.club)}` : ""} · ${num(p.posts_7d)} posts in 7 days · last ${ago(p.last_post)}</span></li>`).join("")}</ul>${list.length > 40 ? `<p class="muted ms-small">+${num(list.length - 40)} more: tick “With warnings” below.</p>` : ""}`
        : `<p class="muted">Every profile is active.</p>`}`;
  }

  function drawTable() {
    const q = $("[data-q]").value.trim().toLowerCase(), pf = $("[data-pf]").value;
    const prem = $("[data-prem]").checked, warn = $("[data-warn]").checked, gone = $("[data-gone]").checked;
    const list = D.profiles.filter((p) => (gone || p.active) && (!pf || p.platform === pf) && (!prem || p.premium) && (!warn || warnOf(p))
      && (!q || [p.handle, p.name, p.club, p.competition, p.sport].some((v) => String(v || "").toLowerCase().includes(q))));
    $("[data-count]").textContent = `${num(list.length)} profiles`;
    $("[data-rows]").innerHTML = list.slice(0, 500).map((p) => {
      const w = warnOf(p);
      return `<tr${p.active ? "" : ' class="pf-gone"'}>
        <td><b>${p.url ? `<a class="link" href="${esc(p.url)}" target="_blank" rel="noopener">@${esc(p.handle)}</a>` : `@${esc(p.handle)}`}</b>${p.premium ? ' <span class="ms-badge is-info">premium</span>' : ""}<br><small class="muted">${esc(p.club || p.name || "")}</small></td>
        <td>${esc(PF[p.platform] || p.platform)}</td>
        <td>${esc([p.sport, p.competition].filter(Boolean).join(" · ") || "—")}</td>
        <td title="${p.last_post ? esc(A.fmtDateTime(p.last_post)) : ""}">${ago(p.last_post)}</td>
        <td>${num(p.posts_7d)}</td><td>${num(p.posts_30d)}</td><td>${num(p.posts)}</td>
        <td>${!p.active ? '<span class="ms-badge is-off">removed</span>' : w ? `<span class="ms-badge is-${w.cls === "bad" ? "bad" : "warn"}">${esc(w.text)}</span>` : '<span class="ms-badge is-ok">active</span>'}</td></tr>`;
    }).join("") || `<tr><td colspan="8" class="muted">${D.profiles.length ? "No profiles match." : "No profiles yet. Upload the accounts Excel."}</td></tr>`;
  }

  // ---------- upload: preview what changes, then save ----------
  async function preview(file) {
    let x;
    try { x = await readExcel(file); } catch (e) { return fail(new Error(`Couldn't read the Excel: ${e.message}`)); }
    if (!x.profiles.length) return fail(new Error("No profiles found. The Excel needs the columns platform and account or url."));
    const cur = new Map(D.profiles.filter((p) => p.active).map((p) => [`${p.platform}|${p.handle}`, p]));
    const file_ = new Set(x.profiles.map((p) => `${p.platform}|${p.handle}`));
    const added = x.profiles.filter((p) => !cur.has(`${p.platform}|${p.handle}`));
    const prem = x.profiles.filter((p) => cur.has(`${p.platform}|${p.handle}`) && cur.get(`${p.platform}|${p.handle}`).premium !== p.premium);
    const removed = [...cur.entries()].filter(([k]) => !file_.has(k)).map(([, p]) => p);
    const names = (l) => l.slice(0, 30).map((p) => `@${esc(p.handle)} <small class="muted">${esc(PF[p.platform] || p.platform)}</small>`).join(", ") + (l.length > 30 ? ` +${l.length - 30}` : "");
    $("[data-preview]").innerHTML = `<div class="panel panel-pad pf-prev">
      <h2>${esc(file.name)}</h2>
      <p class="muted ms-small">${x.sheets.map((s) => `${esc(s.name)}: ${num(s.rows)} profiles${s.premium ? " (premium)" : ""}`).join(" · ")}</p>
      <div class="stats" style="margin-top:12px">${[["In the file", x.profiles.length], ["Premium", x.profiles.filter((p) => p.premium).length], ["New", added.length], ["No longer in the file", removed.length]].map(([l, n]) => `<div class="stat"><p>${l}</p><b>${num(n)}</b></div>`).join("")}</div>
      ${added.length ? `<p style="margin-top:12px"><b>New:</b> ${names(added)}</p>` : ""}
      ${prem.length ? `<p style="margin-top:8px"><b>Premium changes:</b> ${prem.slice(0, 30).map((p) => `@${esc(p.handle)} → ${p.premium ? "premium" : "not premium"}`).join(", ")}</p>` : ""}
      ${removed.length ? `<p style="margin-top:8px"><b>Removed</b> (kept with their history, marked as removed): ${names(removed)}</p>` : ""}
      ${x.sheets.some((s) => s.premium) ? "" : `<p class="pf-bad" style="margin-top:8px">No tab named “premium” in this file: every profile will be saved as not premium.</p>`}
      <div class="head-actions" style="margin-top:14px"><button class="btn btn-ghost" type="button" data-cancel>Cancel</button><button class="btn btn-primary" type="button" data-save>Save ${num(x.profiles.length)} profiles</button></div></div>`;
    $("[data-cancel]").onclick = () => { $("[data-preview]").innerHTML = ""; };
    $("[data-save]").onclick = async (e) => {
      e.target.disabled = true;
      try {
        const r = await rpc("admin_scraped_profiles_save", { p_rows: x.profiles, p_filename: file.name });
        $("[data-preview]").innerHTML = "";
        A.toast(`Saved: ${num(r.total)} profiles · ${num(r.added)} new · ${num(r.removed)} removed.`);
        draw();
      } catch (err) { e.target.disabled = false; fail(err); }
    };
  }

  $("[data-file]").addEventListener("change", (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) preview(f); });
  ["[data-q]", "[data-pf]", "[data-prem]", "[data-warn]", "[data-gone]"].forEach((s) => $(s).addEventListener("input", drawTable));
  main.addEventListener("submit", async (e) => {
    if (!e.target.matches("[data-th]")) return;
    e.preventDefault();
    const f = new FormData(e.target);
    try { await rpc("admin_scraped_profile_settings_save", { p_low_posts_7d: Number(f.get("low")), p_stale_days: Number(f.get("stale")) }); A.toast("Thresholds saved."); draw(); } catch (err) { fail(err); }
  });
  draw();
  // views kept up to date in the cloud (supabase/views-cron.sql): readings of the last 24 h and posts still due
  rpc("admin_views_status").then((v) => {
    const by = Object.entries(v.by_platform || {}).map(([k, n]) => `${PF[k] || k} ${num(n)}`).join(" · ");
    $("[data-views-status]").innerHTML = `Views updated in the last 24 h: <b>${num(v.last_24h)}</b>${by ? ` (${by})` : ""} · due now: <b>${num(v.due)}</b>`;
  }, () => {});
})();
