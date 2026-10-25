// SCP Admin — Audience: who our members are (profile answers) to understand clients and segment newsletters.
// Reads profiles (preferences, newsletter opt-in) — superadmins can read every profile.
(async () => {
  const A = window.SCPA;
  const { $, esc, icon, num } = A;
  try { await A.boot("audience"); } catch { return; }
  const main = $("[data-main]");
  main.innerHTML = `<div class="page-head"><div><h1>Newsletter</h1><p data-sub>Loading…</p></div>
    <div class="head-actions"><button class="btn btn-primary" type="button" data-export disabled>${icon("download")}Export newsletter list</button></div></div>
    <section class="panel nl" data-nl></section>
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
  try { for (let from = 0; ; from += 1000) { const { data: cat } = await A.db.rpc("catalog_with_counts").range(from, from + 999); for (const v of cat || []) names.set(Number(v.id), v.name); if (!cat || cat.length < 1000) break; } } catch {}
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
  const info = A.info;   // the "i" next to each title: where its numbers come from
  const bars = (title, tip, entries, label = (k) => k, limit = 8) => {
    const max = entries[0]?.[1] || 1;
    return `<section class="panel aud-card"><header class="aud-h"><h2>${title}</h2>${info(tip)}<span class="aud-n">${entries.length ? `${num(entries.length)} answer${entries.length === 1 ? "" : "s"}` : ""}</span></header>${entries.length
      ? `<ol class="aud-bars">${entries.slice(0, limit).map(([k, n], i) => `<li><em>${i + 1}</em><span>${esc(label(k))}</span><b>${num(n)}</b><i style="width:${Math.max(4, (n / max) * 100)}%"></i></li>`).join("")}</ol>${entries.length > limit ? `<p class="aud-more">+${num(entries.length - limit)} more</p>` : ""}`
      : `<p class="aud-empty">No answers yet.</p>`}</section>`;
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
      <div class="aud-filters panel">
        <input class="input" type="search" placeholder="Search name, email, organisation, favourite…" value="${esc(seg.q)}" data-seg="q">
        <select class="select" data-seg="orgType"><option value="">All organisation types</option>${orgTypes.map((o) => `<option${seg.orgType === o ? " selected" : ""}>${esc(o)}</option>`).join("")}</select>
        <select class="select" data-seg="sport"><option value="">All sports</option>${sports.map(([id]) => `<option value="${id}"${String(seg.sport) === String(id) ? " selected" : ""}>${esc(nameOf(id))}</option>`).join("")}</select>
        <select class="select" data-seg="newsletter"><option value="">Newsletter: everyone</option><option value="yes"${seg.newsletter === "yes" ? " selected" : ""}>Subscribed</option><option value="no"${seg.newsletter === "no" ? " selected" : ""}>Not subscribed</option></select>
      </div>
      <div class="aud-kpis">
        <div class="aud-kpi"><span>Members in segment ${info("Accounts on the platform (team accounts included) that match the filters above. Source: member profiles.")}</span><b>${num(list.length)}</b></div>
        <div class="aud-kpi is-gold"><span>Profile filled in ${info("Share of these members who answered at least one question of their profile (sports, organisation, goals, favourites…).")}</span><b>${list.length ? Math.round((withProfile.length / list.length) * 100) : 0}%</b></div>
        <div class="aud-kpi is-green"><span>Newsletter subscribers ${info("Members who opted in to the newsletter in their profile (with their chosen frequency). Only these are in the newsletter export.")}</span><b>${num(subs.length)}</b></div>
        <div class="aud-kpi"><span>With 5 favourites ${info("Members who picked the maximum of 5 favourite profiles (the Favs filter of the Content Library).")}</span><b>${num(list.filter((p) => (prefsOf(p).favouriteProfiles || []).length >= 5).length)}</b></div>
      </div>
      <section class="panel aud-signups">
        <header class="aud-h aud-h-lg"><h2>Website sign-ups</h2>${info("Emails left in the newsletter pop-up of the home page by visitors (they may not be members). Not affected by the filters above. The export includes the consent text they accepted.")}
          <span class="aud-n">newsletter pop-up on the home page</span><span class="spacer"></span><b class="aud-count">${num((signups || []).length)}</b><button class="btn btn-sm" type="button" data-export-signups ${(signups || []).length ? "" : "disabled"}>${icon("download")}Export</button></header>
        ${(signups || []).length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Email</th><th>Name</th><th>Resource</th><th>Signed up</th></tr></thead>
          <tbody>${signups.slice(0, 8).map((x) => `<tr><td>${esc(x.email)}</td><td>${esc(x.first_name || "—")}</td><td class="muted">${esc(x.resource || "—")}</td><td class="muted">${new Date(x.created_at).toLocaleString("en-GB")}</td></tr>`).join("")}</tbody></table></div>
          ${signups.length > 8 ? `<p class="muted" style="padding:10px 16px">+${num(signups.length - 8)} more in the export</p>` : ""}` : `<p class="muted" style="padding:14px 16px">No sign-ups yet.</p>`}
      </section>
      <div class="aud-grid">
        ${bars("Favourite profiles", "The accounts members starred as favourites in their profile (the Favs filter). Number = members who chose each one.", count(list, (pr) => (pr.favouriteProfiles || []).map((f) => f.name)))}
        ${bars("Favourite creators", "Content creators members starred in their profile (from the earlier profile form). Number = members who chose each one.", count(list, (pr) => (pr.favouriteCreators || []).map((f) => f.name)))}
        ${bars("Sports", "Sports members follow, chosen in their profile. A member can pick several.", count(list, (pr) => (pr.sports || []).map(Number)), nameOf)}
        ${bars("Organisation type", "The kind of organisation each member works for (club, league, agency, brand, creator…), from their profile.", count(list, (pr) => pr.orgType))}
        ${bars("Goals", "What members want to achieve with SCP, picked in their profile. A member can pick several.", count(list, (pr) => pr.goals))}
        ${bars("Topics", "Content topics members are interested in, from their profile. A member can pick several.", count(list, (pr) => pr.topics))}
        ${bars("Newsletter wants", "What newsletter subscribers asked to receive. Only members subscribed to the newsletter are counted.", count(subs, (pr) => pr.newsletterTopics))}
        ${bars("Role", "Each member's job role, from their profile.", count(list, (pr) => pr.role))}
      </div>
      <section class="panel">
        <header class="aud-h aud-h-lg"><h2>Members</h2>${info("Every account that matches the filters above, newest first: name and email, organisation, sports, favourites, newsletter and sign-up date. \"team\" marks SCP staff accounts.")}<span class="spacer"></span><b class="aud-count">${num(list.length)}</b></header>
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
  newsletter();

  // ---------- Newsletter: edit this week's issue (supabase/newsletter-editor.sql + Edge Function newsletter-draft) ----------
  // The weekly script writes the issue and leaves a Resend draft; here the texts are edited, previewed, saved, pushed to the
  // draft and tested by e-mail. Sending it to the subscribers is still done in Resend → Broadcasts.
  async function newsletter() {
    const host = $("[data-nl]");
    const cfg = window.SCP_CONFIG || {};
    const fn = async (body) => {
      const s = (await A.db.auth.getSession()).data.session;
      const r = await fetch(`${cfg.supabaseUrl}/functions/v1/newsletter-draft`, { method: "POST", headers: { "Content-Type": "application/json", apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${s?.access_token}` }, body: JSON.stringify(body) }).catch(() => null);
      const d = r ? await r.json().catch(() => ({})) : {};
      if (!r || (r.status === 404 && !d.error)) throw new Error("The newsletter-draft function isn't deployed yet.");
      if (!r.ok) throw new Error(d.error || `newsletter-draft: ${r.status}`);
      return d;
    };
    const head = (extra = "") => `<header class="aud-h aud-h-lg"><h2>Newsletter</h2>${A.info("The weekly newsletter. Every week a script writes the issue with AI (intro, top story, news, 4 featured posts, 3 articles) and leaves it as a draft in Resend. Here you edit its texts, preview it, save, update the Resend draft and send yourself a test. It reaches the subscribers only when someone sends it from Resend → Broadcasts.")}${extra}</header>`;
    const busy = async (b, work) => { const t = b.innerHTML; b.disabled = true; b.textContent = "Working…"; try { await work(); } catch (e) { A.toast(e.message, "err"); } finally { b.disabled = false; b.innerHTML = t; } };
    // who receives it: website sign-ups + imported contacts still subscribed + members who opted in (supabase/newsletter-contacts.sql)
    let recipients = null;
    const loadRecipients = async () => { const { data } = await A.db.rpc("admin_newsletter_recipients"); recipients = data || null; };
    const subsHtml = () => {
      const by = (src) => (recipients || []).filter((r) => (src === "website" ? !["old-scp", "member"].includes(r.source) : r.source === src)).length;
      return `<div class="nl-subs">
        <div class="nl-subs-n"><b>${recipients ? num(recipients.length) : "—"}</b><span>subscribers ${A.info("Everyone who gets the newsletter, one per e-mail: people who signed up on the website, contacts imported from the old SCP and members who opted in on their profile. People who unsubscribe (link in every e-mail) are taken out by Resend.")}</span></div>
        ${recipients ? `<span class="nl-subs-by">Website <b>${num(by("website"))}</b></span><span class="nl-subs-by">Old SCP <b>${num(by("old-scp"))}</b></span><span class="nl-subs-by">Members <b>${num(by("member"))}</b></span>` : `<span class="nl-subs-by">Run supabase/newsletter-contacts.sql in Supabase first.</span>`}
        <span class="spacer"></span>
        <label class="btn btn-sm">${icon("import")}Import contacts (CSV)<input type="file" accept=".csv" hidden data-nl-import></label>
      </div>`;
    };
    await loadRecipients().catch(() => {});
    if (!host._nlImport) { host._nlImport = true; host.addEventListener("change", (e) => { const f = e.target.closest("[data-nl-import]")?.files?.[0]; if (f) { e.target.value = ""; importDialog(f); } }); }
    const { data: issues, error } = await A.db.from("newsletter_issues").select("*").order("week_start", { ascending: false }).limit(12);
    if (error) { host.innerHTML = `${head()}${subsHtml()}<p class="aud-empty panel-pad">${esc(/does not exist|schema cache/i.test(error.message) ? "Run supabase/newsletter.sql in Supabase first." : A.errMsg(error))}</p>`; return; }
    const empty = () => { host.innerHTML = `${head()}${subsHtml()}<p class="aud-empty panel-pad">No issue yet. The weekly script (<span class="mono">node newsletter/weekly.mjs</span> in the pipeline) writes it and leaves the draft in Resend; then it shows here to edit.</p>`; };
    const refresh = () => (issues.length ? draw() : empty());
    if (!issues.length) return empty();
    let cur = issues[0];
    const draw = () => {
      const it = cur.items || {};
      const t = it.topStory || null;
      const field = (k, label, v, tip, area) => `<label class="nl-f"><span>${label} ${A.info(tip)}</span>${area ? `<textarea class="input" rows="${area}" data-k="${k}">${esc(v || "")}</textarea>` : `<input class="input" data-k="${k}" value="${esc(v || "")}">`}</label>`;
      host.innerHTML = `${head(`<span class="spacer"></span>
          <select class="select" data-nl-week aria-label="Issue">${issues.map((x) => `<option value="${x.id}"${x.id === cur.id ? " selected" : ""}>Week of ${esc(x.week_start)} · ${esc(x.subject)}</option>`).join("")}</select>`)}
        ${subsHtml()}
        <div class="nl-body">
          <p class="nl-status">${cur.sent_at ? `<span class="imp-st st-ok"><i></i>Sent ${A.fmtDateTime(cur.sent_at)} to ${num(cur.sent_to || 0)}</span>` : cur.broadcast_id ? `<span class="imp-st st-wait"><i></i>Draft in Resend</span>` : `<span class="imp-st st-mute"><i></i>No Resend draft</span>`}
            ${cur.edited_at ? `<span>Edited ${A.fmtDateTime(cur.edited_at)}</span>` : ""}${cur.draft_synced_at ? `<span>Draft updated ${A.fmtDateTime(cur.draft_synced_at)}</span>` : ""}
            ${cur.edited_at && (!cur.draft_synced_at || cur.draft_synced_at < cur.edited_at) ? `<span class="nl-warn">Saved changes aren't in the Resend draft yet</span>` : ""}</p>
          <div class="nl-grid">
            ${field("subject", "Subject", it.subject || cur.subject, "The e-mail's subject line: what subscribers see in their inbox.")}
            ${field("preheader", "Preheader", it.preheader, "The grey line shown after the subject in most inboxes.")}
          </div>
          ${field("intro", "Intro", it.intro, "The opening paragraph under the header. **Words between double asterisks** show in bold.", 4)}
          ${t ? `<div class="nl-block"><p class="nl-h">01 · Social News — top story ${A.info("The main news of the week (from Social News) and SCP's take on it.")}</p>
            ${field("top.title", "Title", t.title, "The headline of the top story.")}${field("top.take", "Our take", t.take, "Why it matters for sports social media teams.", 3)}</div>` : ""}
          ${(it.news || []).length ? `<div class="nl-block"><p class="nl-h">Other headlines ${A.info("The other Social News items listed under the top story. Edit the titles or remove one.")}</p>
            ${it.news.map((n, i) => `<div class="nl-row"><input class="input" data-news="${i}" value="${esc(n.title)}"><span class="nl-tag">${esc(n.platform || "")}</span><button class="icon-btn danger" type="button" data-rm="news:${i}" title="Remove" aria-label="Remove">${icon("trash")}</button></div>`).join("")}</div>` : ""}
          ${(it.posts || []).length ? `<div class="nl-block"><p class="nl-h">02 · Featured content ${A.info("The posts from the Content Library shown with their cover. Edit the short description of each or remove one.")}</p>
            <div class="nl-posts">${it.posts.map((x, i) => `<div class="nl-post">${x.image ? `<span class="nl-img" style="background-image:url('${esc(x.image)}')"></span>` : `<span class="nl-img"></span>`}
              <div><b>${esc(x.who || "Post")}</b><small>${esc([x.format, x.sport].filter(Boolean).join(" · "))}</small><textarea class="input" rows="3" data-post="${i}">${esc(x.description || "")}</textarea></div>
              <button class="icon-btn danger" type="button" data-rm="posts:${i}" title="Remove" aria-label="Remove">${icon("trash")}</button></div>`).join("")}</div></div>` : ""}
          ${(it.blogs || []).length ? `<div class="nl-block"><p class="nl-h">03 · From the blog ${A.info("The blog articles of the week. Edit the teaser (one line per paragraph) or remove one.")}</p>
            ${it.blogs.map((b, i) => `<div class="nl-row nl-blog"><div><b>${esc(b.title)}</b><small>${esc(b.type || "")} · ${esc(b.date || "")}</small><textarea class="input" rows="2" data-blog="${i}">${esc((b.teaser || []).join("\n"))}</textarea></div>
              <button class="icon-btn danger" type="button" data-rm="blogs:${i}" title="Remove" aria-label="Remove">${icon("trash")}</button></div>`).join("")}</div>` : ""}
          <div class="nl-actions">
            <button class="btn" type="button" data-nl-preview>${icon("eye")}Preview</button>
            <span class="spacer"></span>
            <button class="btn" type="button" data-nl-test>Send me a test</button>
            <button class="btn" type="button" data-nl-save>Save</button>
            ${cur.sent_at ? "" : cur.broadcast_id ? `<button class="btn btn-primary" type="button" data-nl-push>${icon("check")}Save &amp; update the Resend draft</button>
              <button class="btn btn-danger nl-send" type="button" data-nl-send>Send to subscribers</button>` : `<button class="btn btn-primary" type="button" data-nl-draft>${icon("plus")}Save &amp; create the Resend draft</button>`}
          </div>
        </div>`;
    };
    // the edited content, from the form
    const read = () => {
      const it = structuredClone(cur.items || {});
      const val = (k) => host.querySelector(`[data-k="${k}"]`)?.value.trim();
      it.subject = val("subject") || cur.subject; it.preheader = val("preheader") || ""; it.intro = val("intro") || "";
      if (it.topStory) { it.topStory.title = val("top.title") || it.topStory.title; it.topStory.take = val("top.take") || ""; }
      host.querySelectorAll("[data-news]").forEach((x) => { it.news[x.dataset.news].title = x.value.trim(); });
      host.querySelectorAll("[data-post]").forEach((x) => { it.posts[x.dataset.post].description = x.value.trim(); });
      host.querySelectorAll("[data-blog]").forEach((x) => { it.blogs[x.dataset.blog].teaser = x.value.split("\n").map((l) => l.trim()).filter(Boolean); });
      return it;
    };
    const save = async () => {
      const items = read();
      const { error: err } = await A.db.rpc("admin_save_newsletter_issue", { p_id: cur.id, p_items: items });
      if (err) throw new Error(/does not exist|schema cache|Could not find/i.test(err.message) ? "Run supabase/newsletter-editor.sql in Supabase first." : err.message);
      Object.assign(cur, { items, subject: items.subject, edited_at: new Date().toISOString() });
    };
    host.addEventListener("change", (e) => { if (e.target.matches("[data-nl-week]")) { cur = issues.find((x) => x.id === Number(e.target.value)); draw(); } });
    host.addEventListener("click", (e) => {
      const rm = e.target.closest("[data-rm]");
      if (rm) { const [k, i] = rm.dataset.rm.split(":"); cur.items = read(); cur.items[k].splice(Number(i), 1); return draw(); }
      const b = e.target.closest("button"); if (!b) return;
      if (b.matches("[data-nl-preview]")) return busy(b, async () => {
        const { html } = await fn({ action: "preview", id: cur.id, items: read() });
        const m = A.modal({ title: "Preview", sub: "As subscribers will see it (unsaved edits included)", body: `<iframe class="nl-frame" title="Newsletter preview"></iframe>` });
        $(".nl-frame", m.el).srcdoc = html;
      });
      if (b.matches("[data-nl-save]")) return busy(b, async () => { await save(); A.toast("Newsletter saved."); draw(); });
      if (b.matches("[data-nl-push]")) return busy(b, async () => { await save(); await fn({ action: "push", id: cur.id }); cur.draft_synced_at = new Date().toISOString(); A.toast("Saved and the Resend draft is updated. Send it from Resend → Broadcasts."); draw(); });
      if (b.matches("[data-nl-test]")) return busy(b, async () => { if (!cur.sent_at) await save(); const r = await fn({ action: "test", id: cur.id }); A.toast(`Test sent to ${r.to}.`); draw(); });
      if (b.matches("[data-nl-draft]")) return busy(b, async () => { await save(); const r = await fn({ action: "create_draft", id: cur.id }); cur.broadcast_id = r.broadcast_id; cur.draft_synced_at = new Date().toISOString(); A.toast("Resend draft created."); draw(); });
      if (b.matches("[data-nl-send]")) return sendDialog();
    });
    // sending: two steps (confirm the count, then type SEND), and the issue is saved and the draft updated first
    function sendDialog() {
      const n = recipients ? recipients.length : 0;
      const m = A.modal({ title: "Send the newsletter?", size: "sm", body: `<p>“${esc(cur.items?.subject || cur.subject)}” goes to <b>${num(n)}</b> subscribers now. It can't be undone.</p>
        <label class="ms-check"><input type="checkbox" data-sd-ok> I've checked the test e-mail</label>
        <label class="nl-f" style="margin-top:12px"><span>Type SEND to confirm</span><input class="input" data-sd-word autocomplete="off"></label>`,
        foot: `<button class="btn btn-ghost" type="button" data-sd-no>Cancel</button><button class="btn btn-danger" type="button" data-sd-yes disabled>Send to ${num(n)}</button>` });
      const yes = $("[data-sd-yes]", m.el);
      const check = () => { yes.disabled = !($("[data-sd-ok]", m.el).checked && $("[data-sd-word]", m.el).value.trim().toUpperCase() === "SEND"); };
      m.el.addEventListener("input", check); m.el.addEventListener("change", check);
      $("[data-sd-no]", m.el).onclick = () => m.close();
      yes.onclick = () => busy(yes, async () => {
        await save();
        const r = await fn({ action: "send", id: cur.id, confirm: "SEND" });
        Object.assign(cur, { sent_at: new Date().toISOString(), sent_to: r.sent_to });
        m.close(); A.toast(`Sent to ${num(r.sent_to)} subscribers.`); draw();
      });
    }

    // import contacts from a CSV (the old SCP's FluentCRM export, or any list with an e-mail column)
    function importDialog(file) {
      window.Papa.parse(file, { header: true, skipEmptyLines: true, complete: ({ data, meta }) => {
        const col = (...names) => meta.fields.find((f) => names.some((n) => f.trim().toLowerCase() === n.toLowerCase()));
        const C = { email: col("Envíe un correo electrónico a", "Email", "E-mail", "Email address", "Correo electrónico"), first: col("Nombre", "First name", "First Name", "Name"),
          last: col("Apellido", "Last name", "Last Name"), status: col("Estatus", "Status"), lists: col("Listas", "Lists"), country: col("País", "Country"),
          org: col("Organization", "Organización", "Company"), created: col("Creado en", "Created at", "Created") };
        if (!C.email) return A.toast("The CSV needs an e-mail column.", "err");
        const valid = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
        const have = new Set((recipients || []).map((r) => r.email.toLowerCase()));
        const rows = data.map((r) => ({ email: String(r[C.email] || "").trim().toLowerCase(), status: String(r[C.status] || "subscribed").trim().toLowerCase(), r }));
        const groups = { ok: rows.filter((x) => valid(x.email) && x.status === "subscribed"), pending: rows.filter((x) => valid(x.email) && x.status === "pending"),
          other: rows.filter((x) => valid(x.email) && !["subscribed", "pending"].includes(x.status)), bad: rows.filter((x) => !valid(x.email)) };
        const m = A.modal({ title: "Import contacts", sub: esc(file.name), body: `
          <p>${num(rows.length)} rows. Contacts already on the list are kept as they are; new ones are added as subscribers and get <b>no welcome e-mail</b>.</p>
          <ul class="nl-imp">
            <li><b>${num(groups.ok.length)}</b> subscribed <small>${num(groups.ok.filter((x) => have.has(x.email)).length)} already on the list</small></li>
            <li><label class="ms-check"><input type="checkbox" data-imp-pending> Also the <b>${num(groups.pending.length)}</b> pending</label> <small>they didn't confirm their subscription in the old SCP</small></li>
            ${groups.other.length ? `<li><b>${num(groups.other.length)}</b> with another status (unsubscribed…) <small>not imported</small></li>` : ""}
            ${groups.bad.length ? `<li><b>${num(groups.bad.length)}</b> without a valid e-mail <small>not imported</small></li>` : ""}
          </ul>`, foot: `<button class="btn btn-ghost" type="button" data-imp-no>Cancel</button><button class="btn btn-primary" type="button" data-imp-yes>Import</button>` });
        const go = $("[data-imp-yes]", m.el);
        const label = () => { go.textContent = `Import ${num(groups.ok.length + ($("[data-imp-pending]", m.el).checked ? groups.pending.length : 0))} contacts`; };
        label(); m.el.addEventListener("change", label);
        $("[data-imp-no]", m.el).onclick = () => m.close();
        go.onclick = () => busy(go, async () => {
          const pick = [...groups.ok, ...($("[data-imp-pending]", m.el).checked ? groups.pending : [])];
          const payload = pick.map(({ email, status, r }) => {
            const d = r[C.created] ? new Date(String(r[C.created]).replace(" ", "T")) : null;
            return { email, first_name: r[C.first] || "", last_name: r[C.last] || "", country: r[C.country] || "", organization: r[C.org] || "", lists: r[C.lists] || "",
              created_at: d && !isNaN(d) ? d.toISOString() : "", consent_text: `Imported from the old SCP (${file.name}): status ${status}${r[C.lists] ? `, lists: ${r[C.lists]}` : ""}.` };
          });
          let added = 0;
          for (let i = 0; i < payload.length; i += 200) {
            const { data: res, error: err } = await A.db.rpc("admin_import_newsletter_contacts", { p_rows: payload.slice(i, i + 200) });
            if (err) throw new Error(/does not exist|schema cache|Could not find/i.test(err.message) ? "Run supabase/newsletter-contacts.sql in Supabase first." : err.message);
            added += res.added;
          }
          m.close(); A.toast(`${num(added)} contacts added (${num(payload.length - added)} were already on the list).`);
          await loadRecipients().catch(() => {}); refresh();
        });
      } });
    }
    draw();
  }
})();
