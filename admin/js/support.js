// SCP Admin — Support: the members' reports (bugs and suggestions from js/support.js, bottom left of the platform) with
// their screenshots and context, each with a state and a reply the member sees in "My reports" (solving it lights a dot
// for them); and "What's new": the improvements members see for 5 days. Data: supabase/support-feedback.sql.
(async () => {
  const A = window.SCPA;
  const { $, esc, icon, info } = A;
  try { await A.boot("support"); } catch { return; }
  const main = $("[data-main]");
  const fail = (e) => A.toast(e.message || String(e), "err");
  const when = (v) => (v ? new Date(v).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }) : "");
  const ST = { new: "New", in_progress: "In progress", done: "Solved", wontfix: "Closed" };
  let reports = [], updates = [], filter = "open";

  main.innerHTML = `<div class="page-head"><div><h1>Support</h1><p>What members report from the platform (bottom left: "Support &amp; what's new") and the improvements they see in "What's new".</p></div></div>
    <section class="panel"><header class="aud-h aud-h-lg"><h2>Reports</h2>${info("Bugs and suggestions sent by members, with their screenshots and the page, browser, plan and language they were on. The state and the reply show in the member's 'My reports'; Solved or Closed lights a dot on their button.")}<span class="spacer"></span>
      <select class="select select-sm" data-filter><option value="open">Open</option><option value="all">All</option><option value="bug">Bugs</option><option value="idea">Suggestions</option><option value="content">Content requests</option><option value="closed">Solved / closed</option></select></header>
      <div data-reports class="panel-pad"><p class="muted">Loading…</p></div></section>
    <section class="panel" style="margin-top:16px"><header class="aud-h aud-h-lg"><h2>What's new</h2>${info("Members see each improvement for 5 days after its date, in Spanish (and in English if you write it). Keep it short: what changed and what it's for.")}<span class="spacer"></span>
      <button class="btn btn-sm btn-primary" type="button" data-new-update>${icon("plus")}New improvement</button></header>
      <div data-updates class="panel-pad"><p class="muted">Loading…</p></div></section>`;

  async function load() {
    const [r, u] = await Promise.all([A.db.rpc("admin_feedback_list"), A.db.from("product_updates").select("*").order("published_at", { ascending: false }).limit(50)]);
    if (r.error) throw new Error(/admin_feedback_list/.test(r.error.message) ? "Run supabase/support-feedback.sql in Supabase first." : r.error.message);
    reports = r.data || []; updates = u.data || [];
    drawReports(); drawUpdates();
  }
  async function signed(paths) {
    if (!paths?.length) return [];
    const { data } = await A.db.storage.from("feedback").createSignedUrls(paths, 3600);
    return (data || []).map((d) => d.signedUrl).filter(Boolean);
  }
  async function drawReports() {
    const box = $("[data-reports]");
    const list = reports.filter((r) => filter === "all" || (filter === "open" ? ["new", "in_progress"].includes(r.status) : filter === "closed" ? ["done", "wontfix"].includes(r.status) : r.kind === filter));
    if (!list.length) { box.innerHTML = `<p class="muted">No reports here.</p>`; return; }
    const urls = await Promise.all(list.map((r) => signed(r.images)));
    box.innerHTML = list.map((r, i) => { const c = r.context || {};
      return `<article class="sup-rep" data-id="${r.id}">
        <header><span class="tag ${r.kind === "bug" ? "tag-req" : "tag-you"}">${{ bug: "Bug", idea: "Suggestion", content: `Content request${c.wants ? ` · ${c.wants}` : ""}` }[r.kind] || r.kind}</span><b>${esc(r.name || r.email)}</b><span class="muted">${esc(r.email)} · ${esc(when(r.created_at))}</span></header>
        <p class="sup-msg">${esc(r.message)}</p>
        ${urls[i].length ? `<div class="sup-imgs">${urls[i].map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Screenshot" loading="lazy"></a>`).join("")}</div>` : ""}
        <p class="sup-ctx muted">${[c.page && `Page ${c.page}`, c.app, c.plan && `Plan ${c.plan}`, c.lang && `${c.lang}${c.region && c.region !== "es" ? `-${c.region}` : ""}`, c.viewport && `Window ${c.viewport}`, c.ua].filter(Boolean).map(esc).join(" · ")}</p>
        <div class="sup-act"><select class="select select-sm" data-status>${Object.entries(ST).map(([k, n]) => `<option value="${k}"${k === r.status ? " selected" : ""}>${n}</option>`).join("")}</select>
          <input class="input" data-reply maxlength="2000" placeholder="Reply the member sees (optional)" value="${esc(r.admin_reply || "")}">
          <button class="btn btn-sm btn-primary" type="button" data-save>Save</button></div>
      </article>`; }).join("");
  }
  function drawUpdates() {
    const box = $("[data-updates]");
    const live = (u) => Date.now() - new Date(u.published_at) < 5 * 864e5 && new Date(u.published_at) <= new Date();
    box.innerHTML = updates.length ? updates.map((u) => `<div class="sup-upd" data-upd="${u.id}"><div><b>${esc(u.title_es)}</b>${u.title_en ? `<span class="muted"> · ${esc(u.title_en)}</span>` : ""}
        <p class="muted">${esc(u.body_es || "")}</p><small class="muted">${esc(when(u.published_at))} · ${live(u) ? "showing to members" : new Date(u.published_at) > new Date() ? "scheduled" : "no longer shown (older than 5 days)"}</small></div>
        <span class="sup-upd-act"><button class="btn btn-sm" type="button" data-edit-update="${u.id}">Edit</button><button class="icon-btn" type="button" title="Delete" aria-label="Delete" data-del-update="${u.id}">${icon("trash")}</button></span></div>`).join("")
      : `<p class="muted">No improvements yet. Add the first one: members see it for 5 days.</p>`;
  }
  function editUpdate(u = {}) {
    const m = A.modal({ title: u.id ? "Edit improvement" : "New improvement", sub: "Members see it in \"What's new\" for 5 days after its date.", size: "md",
      body: `<form class="sup-form" data-form>
        <label>Title (Spanish)<input class="input" name="title_es" required maxlength="120" value="${esc(u.title_es || "")}" placeholder="Ya puedes reportar bugs desde la plataforma"></label>
        <label>Text (Spanish)<textarea class="input" name="body_es" rows="3" maxlength="600" placeholder="Abajo a la izquierda…">${esc(u.body_es || "")}</textarea></label>
        <label>Title (English, optional)<input class="input" name="title_en" maxlength="120" value="${esc(u.title_en || "")}"></label>
        <label>Text (English, optional)<textarea class="input" name="body_en" rows="3" maxlength="600">${esc(u.body_en || "")}</textarea></label>
        <label>Link (optional)<input class="input" name="link" maxlength="300" value="${esc(u.link || "")}" placeholder="content-library.html or https://…"></label>
        <label>Date<input class="input" type="datetime-local" name="published_at" value="${(u.published_at ? new Date(u.published_at) : new Date()).toLocaleString("sv-SE").slice(0, 16).replace(" ", "T")}"></label></form>`,
      foot: `<button class="btn btn-primary" type="button" data-ok>Save</button>` });
    m.el.querySelector("[data-ok]").onclick = async () => {
      const f = m.el.querySelector("[data-form]");
      if (!f.reportValidity()) return;
      const row = Object.fromEntries(["title_es", "body_es", "title_en", "body_en", "link"].map((k) => [k, f[k].value.trim() || null]));
      row.published_at = new Date(f.published_at.value).toISOString();
      const q = u.id ? A.db.from("product_updates").update(row).eq("id", u.id) : A.db.from("product_updates").insert(row);
      const { error } = await q;
      if (error) return fail(new Error(/link/.test(error.message) ? "The link must be a page of the site (content-library.html) or start with https://" : error.message));
      m.close(); A.toast("Saved"); load().catch(fail);
    };
  }

  main.addEventListener("change", (e) => { if (e.target.matches("[data-filter]")) { filter = e.target.value; drawReports(); } });
  main.addEventListener("click", async (e) => {
    const save = e.target.closest("[data-save]"), art = e.target.closest("[data-id]");
    if (save && art) {
      save.disabled = true;
      const { error } = await A.db.rpc("admin_feedback_set", { p_id: Number(art.dataset.id), p_status: art.querySelector("[data-status]").value, p_reply: art.querySelector("[data-reply]").value });
      save.disabled = false;
      if (error) return fail(error);
      A.toast("Saved: the member sees it in My reports"); return load().catch(fail);
    }
    if (e.target.closest("[data-new-update]")) return editUpdate();
    const ed = e.target.closest("[data-edit-update]");
    if (ed) return editUpdate(updates.find((u) => u.id === Number(ed.dataset.editUpdate)));
    const del = e.target.closest("[data-del-update]");
    if (del && (await A.confirmDialog({ title: "Delete this improvement?", text: "Members stop seeing it.", confirm: "Delete", danger: true }))) {
      const { error } = await A.db.from("product_updates").delete().eq("id", Number(del.dataset.delUpdate));
      if (error) return fail(error);
      load().catch(fail);
    }
  });
  load().catch(fail);
})();
