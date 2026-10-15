// SCP Admin — Audience: who our members are (profile answers) to understand clients and segment newsletters.
// Reads profiles (preferences, newsletter opt-in) — superadmins can read every profile.
(async () => {
  const A = window.SCPA;
  const { $, esc, icon, num } = A;
  try { await A.boot("audience"); } catch { return; }
  const main = $("[data-main]");
  main.innerHTML = `<div class="page-head"><div><h1>Audience</h1><p data-sub>Loading…</p></div>
    <div class="head-actions"><button class="btn btn-primary" type="button" data-export disabled>${icon("download")}Export newsletter list</button></div></div>
    <div data-body></div>`;

  const { data, error } = await A.db.from("profiles").select("*").order("created_at", { ascending: false });
  if (error) { $("[data-sub]").textContent = A.errMsg(error); return; }
  const members = data || []; // team accounts included, so you can see how your own profile shows up
  const prefsOf = (p) => p.preferences || {};
  const hasPrefs = (p) => Object.keys(prefsOf(p)).some((k) => { const v = prefsOf(p)[k]; return Array.isArray(v) ? v.length : v; });
  if (members.length && !("preferences" in (data[0] || {}))) {
    $("[data-sub]").textContent = "Profile answers aren't stored yet — run supabase/member-profile.sql in Supabase.";
    return;
  }

  // Website newsletter sign-ups (home pop-up)
  const { data: signups } = await A.db.from("newsletter_signups").select("*").order("created_at", { ascending: false });

  // Catalog names for sport / competition ids
  const names = new Map();
  try { const { data: cat } = await A.db.rpc("catalog_with_counts"); for (const v of cat || []) names.set(Number(v.id), v.name); } catch {}
  const nameOf = (id) => names.get(Number(id)) || `#${id}`;

  // ---------- Filters (segments) ----------
  const seg = { orgType: "", sport: "", newsletter: "", q: "" };
  const matches = (p) => {
    const pr = prefsOf(p);
    if (seg.orgType && pr.orgType !== seg.orgType) return false;
    if (seg.sport && !(pr.sports || []).map(Number).includes(Number(seg.sport))) return false;
    if (seg.newsletter === "yes" && !p.newsletter) return false;
    if (seg.newsletter === "no" && p.newsletter) return false;
    if (seg.q) {
      const hay = [p.email, p.first_name, p.last_name, pr.organization, ...(pr.favouriteProfiles || []).map((f) => f.name), ...(pr.favouriteCreators || []).map((f) => f.name)].join(" ").toLowerCase();
      if (!hay.includes(seg.q.toLowerCase())) return false;
    }
    return true;
  };
  const count = (list, pick) => {
    const m = new Map();
    for (const p of list) for (const v of [].concat(pick(prefsOf(p), p) || [])) if (v != null && v !== "") m.set(v, (m.get(v) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const bars = (title, entries, label = (k) => k, limit = 8) => {
    const max = entries[0]?.[1] || 1;
    return `<section class="panel panel-pad aud-card"><h2>${title}</h2>${entries.length
      ? `<ol class="aud-bars">${entries.slice(0, limit).map(([k, n]) => `<li><span>${esc(label(k))}</span><b>${num(n)}</b><i style="width:${Math.max(6, (n / max) * 100)}%"></i></li>`).join("")}</ol>`
      : `<p class="muted">No answers yet.</p>`}</section>`;
  };

  function render() {
    const list = members.filter(matches);
    const withProfile = list.filter(hasPrefs);
    const subs = list.filter((p) => p.newsletter);
    const orgTypes = [...new Set(members.map((p) => prefsOf(p).orgType).filter(Boolean))].sort();
    const sports = count(members, (pr) => (pr.sports || []).map(Number));
    $("[data-sub]").textContent = `${num(members.length)} member${members.length === 1 ? "" : "s"} · what they told us in their profile`;
    $("[data-export]").disabled = !subs.length;
    $("[data-body]").innerHTML = `
      <div class="aud-filters">
        <input class="input" type="search" placeholder="Search name, email, organisation, favourite…" value="${esc(seg.q)}" data-seg="q">
        <select class="select" data-seg="orgType"><option value="">All organisation types</option>${orgTypes.map((o) => `<option${seg.orgType === o ? " selected" : ""}>${esc(o)}</option>`).join("")}</select>
        <select class="select" data-seg="sport"><option value="">All sports</option>${sports.map(([id]) => `<option value="${id}"${String(seg.sport) === String(id) ? " selected" : ""}>${esc(nameOf(id))}</option>`).join("")}</select>
        <select class="select" data-seg="newsletter"><option value="">Newsletter: everyone</option><option value="yes"${seg.newsletter === "yes" ? " selected" : ""}>Subscribed</option><option value="no"${seg.newsletter === "no" ? " selected" : ""}>Not subscribed</option></select>
      </div>
      <div class="aud-kpis">
        <div class="panel panel-pad"><span>Members in segment</span><b>${num(list.length)}</b></div>
        <div class="panel panel-pad"><span>Profile filled in</span><b>${list.length ? Math.round((withProfile.length / list.length) * 100) : 0}%</b></div>
        <div class="panel panel-pad"><span>Newsletter subscribers</span><b>${num(subs.length)}</b></div>
        <div class="panel panel-pad"><span>With 5 favourites</span><b>${num(list.filter((p) => (prefsOf(p).favouriteProfiles || []).length >= 5).length)}</b></div>
      </div>
      <section class="panel aud-signups">
        <div class="values-head" style="justify-content:space-between"><h2 style="font-size:16px">Website sign-ups <span class="muted">· newsletter pop-up on the home page</span></h2>
          <span><b>${num((signups || []).length)}</b> <button class="btn btn-sm" type="button" data-export-signups ${(signups || []).length ? "" : "disabled"}>${icon("download")}Export</button></span></div>
        ${(signups || []).length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Email</th><th>Name</th><th>Resource</th><th>Signed up</th></tr></thead>
          <tbody>${signups.slice(0, 8).map((x) => `<tr><td>${esc(x.email)}</td><td>${esc(x.first_name || "—")}</td><td class="muted">${esc(x.resource || "—")}</td><td class="muted">${new Date(x.created_at).toLocaleString("en-GB")}</td></tr>`).join("")}</tbody></table></div>
          ${signups.length > 8 ? `<p class="muted" style="padding:10px 16px">+${num(signups.length - 8)} more in the export</p>` : ""}` : `<p class="muted" style="padding:14px 16px">No sign-ups yet.</p>`}
      </section>
      <div class="aud-grid">
        ${bars("Favourite profiles", count(list, (pr) => (pr.favouriteProfiles || []).map((f) => f.name)))}
        ${bars("Favourite creators", count(list, (pr) => (pr.favouriteCreators || []).map((f) => f.name)))}
        ${bars("Sports", count(list, (pr) => (pr.sports || []).map(Number)), nameOf)}
        ${bars("Organisation type", count(list, (pr) => pr.orgType))}
        ${bars("Goals", count(list, (pr) => pr.goals))}
        ${bars("Topics", count(list, (pr) => pr.topics))}
        ${bars("Newsletter wants", count(subs, (pr) => pr.newsletterTopics))}
        ${bars("Role", count(list, (pr) => pr.role))}
      </div>
      <section class="panel">
        <div class="values-head" style="justify-content:space-between"><h2 style="font-size:16px">Members</h2><span class="muted">${num(list.length)}</span></div>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Member</th><th>Organisation</th><th>Sports</th><th>Favourite profiles</th><th>Newsletter</th><th>Joined</th></tr></thead>
          <tbody>${list.map((p) => { const pr = prefsOf(p); return `<tr>
            <td><b>${esc([p.first_name, p.last_name].filter(Boolean).join(" ") || "—")}</b>${p.role !== "user" ? ` <span class="status status-analyzed">team</span>` : ""}<div class="muted">${esc(p.email)}</div></td>
            <td>${esc(pr.organization || "—")}<div class="muted">${esc([pr.orgType, pr.role].filter(Boolean).join(" · "))}</div></td>
            <td>${esc((pr.sports || []).map(nameOf).join(", ") || "—")}</td>
            <td>${esc((pr.favouriteProfiles || []).map((f) => f.name).join(", ") || "—")}</td>
            <td>${p.newsletter ? `<span class="status status-completed">${esc(p.newsletter_frequency || "yes")}</span>` : `<span class="muted">No</span>`}</td>
            <td class="muted">${new Date(p.created_at).toLocaleDateString("en-GB")}</td></tr>`; }).join("") || `<tr><td colspan="6" class="muted">No members in this segment.</td></tr>`}</tbody>
        </table></div>
      </section>`;
  }
  main.addEventListener("input", (e) => { const k = e.target.dataset.seg; if (k) { seg[k] = e.target.value; render(); if (k === "q") { const i = $("[data-seg=q]"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } } });

  main.addEventListener("click", (e) => {
    if (!e.target.closest("[data-export-signups]")) return;
    const cols = ["email", "first_name", "source", "resource", "consent_text", "created_at"];
    A.downloadBlob(new Blob(["\ufeff" + A.toCSV(signups, cols)], { type: "text/csv;charset=utf-8" }), `website-signups-${new Date().toISOString().slice(0, 10)}.csv`);
  });

  // Newsletter list for the current segment (only people who opted in)
  $("[data-export]").addEventListener("click", () => {
    const rows = members.filter(matches).filter((p) => p.newsletter).map((p) => {
      const pr = prefsOf(p);
      return {
        email: p.email, first_name: p.first_name, last_name: p.last_name, frequency: p.newsletter_frequency, consent_at: p.newsletter_consent_at,
        organization: pr.organization, org_type: pr.orgType, role: pr.role, country: pr.country, language: pr.language,
        sports: (pr.sports || []).map(nameOf).join("; "), competitions: (pr.competitions || []).map(nameOf).join("; "),
        favourite_profiles: (pr.favouriteProfiles || []).map((f) => f.name).join("; "), favourite_creators: (pr.favouriteCreators || []).map((f) => f.name).join("; "),
        goals: (pr.goals || []).join("; "), topics: (pr.topics || []).join("; "), newsletter_topics: (pr.newsletterTopics || []).join("; "),
      };
    });
    const cols = Object.keys(rows[0] || { email: "" });
    A.downloadBlob(new Blob(["﻿" + A.toCSV(rows, cols)], { type: "text/csv;charset=utf-8" }), `newsletter-${new Date().toISOString().slice(0, 10)}.csv`);
  });

  render();
})();
