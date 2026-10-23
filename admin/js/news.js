// SCP Admin — Social News: every news item the pipeline brought in (published = relevant, hidden = not), to edit its title,
// source, link, network and paragraphs, publish / hide it or delete it. Data: table news (supabase/news.sql, admin rights
// in supabase/admin-content.sql). The public page (news.html) shows the published ones.
(async () => {
  const A = window.SCPA;
  const { $, esc, icon, num, info } = A;
  try { await A.boot("news"); } catch { return; }
  const main = $("[data-main]");
  const fail = (e) => A.toast(e.message || String(e), "err");
  const PLATFORMS = ["instagram", "tiktok", "x", "youtube", "facebook", "linkedin", "snapchat", "whatsapp", "pinterest", "threads", "ai", "other"];
  const PF = { instagram: "Instagram", tiktok: "TikTok", x: "X", youtube: "YouTube", facebook: "Facebook", linkedin: "LinkedIn", snapchat: "Snapchat", whatsapp: "WhatsApp", pinterest: "Pinterest", threads: "Threads", ai: "AI", other: "Other" };
  const f = { q: "", status: "", platform: "" };
  let rows = [];

  main.innerHTML = `<div class="page-head"><div><h1>Social News</h1><p>The news on the website's Social News page: edit them, publish or hide them.</p></div>
    <div class="head-actions"><a class="btn" href="../news.html" target="_blank" rel="noopener">${icon("external")}See the page</a></div></div>
    <div class="aud-kpis" data-kpis></div>
    <div class="aud-filters panel">
      <input class="input" type="search" placeholder="Search title or source…" data-f="q">
      <select class="select" data-f="status"><option value="">Published and hidden</option><option value="pub">Published</option><option value="hid">Hidden</option></select>
      <select class="select" data-f="platform"><option value="">All networks</option>${PLATFORMS.map((p) => `<option value="${p}">${PF[p]}</option>`).join("")}</select>
    </div>
    <section class="panel ld-list"><header class="aud-h aud-h-lg"><h2>News</h2>${info("Newest first. “Published” news show on the website; “Hidden” ones were brought in by the pipeline but aren't shown. Click one to edit it.")}<span class="spacer"></span><b class="aud-count" data-count></b></header><div data-list><p class="panel-pad muted">Loading…</p></div></section>`;

  const day = (v) => (v ? new Date(v).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "—");
  async function load() {
    let q = A.db.from("news").select("*").order("published_at", { ascending: false, nullsFirst: false }).limit(500);
    if (f.status) q = q.eq("relevant", f.status === "pub");
    if (f.platform) q = q.eq("platform", f.platform);
    if (f.q) q = q.or(`title.ilike.%${f.q.replace(/[,()%]/g, " ")}%,source_name.ilike.%${f.q.replace(/[,()%]/g, " ")}%`);
    const { data, error } = await q;
    if (error) { $("[data-list]").innerHTML = `<p class="panel-pad muted">${esc(error.message)}</p>`; return; }
    rows = data || [];
    const pub = rows.filter((r) => r.relevant).length;
    $("[data-kpis]").innerHTML = `<div class="aud-kpi"><span>Shown</span><b>${num(rows.length)}</b></div><div class="aud-kpi is-green"><span>Published</span><b>${num(pub)}</b></div><div class="aud-kpi"><span>Hidden</span><b>${num(rows.length - pub)}</b></div>`;
    $("[data-count]").textContent = num(rows.length);
    $("[data-list]").innerHTML = rows.length ? `<div class="table-wrap"><table class="data nw-table"><thead><tr><th>Date</th><th>News</th><th>Network</th><th>Status</th><th></th></tr></thead><tbody>
      ${rows.map((r) => `<tr class="row-click" data-id="${r.id}">
        <td class="td-date">${day(r.published_at || r.created_at)}</td>
        <td><b class="nw-title">${esc(r.title)}</b><small class="muted">${esc(r.source_name)}${r.edited_at ? " · edited" : ""}</small></td>
        <td><span class="ld-pill">${esc(PF[r.platform] || r.platform)}</span></td>
        <td><button type="button" class="nw-st ${r.relevant ? "is-pub" : ""}" data-toggle="${r.id}" title="${r.relevant ? "Hide it from the website" : "Publish it on the website"}">${r.relevant ? "Published" : "Hidden"}</button></td>
        <td class="td-actions"><button class="icon-btn" type="button" title="Edit" aria-label="Edit" data-edit="${r.id}">${icon("edit")}</button><button class="icon-btn" type="button" title="Delete" aria-label="Delete" data-del="${r.id}">${icon("trash")}</button></td></tr>`).join("")}
      </tbody></table></div>` : `<p class="panel-pad muted">No news with these filters.</p>`;
  }

  function edit(id) {
    const r = rows.find((x) => x.id === id); if (!r) return;
    const m = A.modal({ title: "Edit news", sub: `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url)}</a>`, size: "lg",
      body: `<form class="nw-form" data-form>
        <label>Title<input class="input" name="title" value="${esc(r.title)}" required maxlength="300"></label>
        <div class="nw-row"><label>Source<input class="input" name="source_name" value="${esc(r.source_name)}" required></label>
          <label>Network<select class="select" name="platform">${PLATFORMS.map((p) => `<option value="${p}"${r.platform === p ? " selected" : ""}>${PF[p]}</option>`).join("")}</select></label>
          <label>Date<input class="input" type="date" name="published_at" value="${esc((r.published_at || "").slice(0, 10))}"></label></div>
        <label>Original article<input class="input" name="url" type="url" value="${esc(r.url)}" required></label>
        <label>Text <small class="muted">One paragraph per block; leave an empty line between paragraphs.</small><textarea class="input" name="paragraphs" rows="12">${esc((r.paragraphs || []).join("\n\n"))}</textarea></label>
        <label class="check-inline"><input type="checkbox" name="relevant"${r.relevant ? " checked" : ""}> Published on the website</label>
      </form>`,
      foot: `<button class="btn btn-primary" type="button" data-save>Save</button>` });
    m.el.querySelector("[data-save]").addEventListener("click", async () => {
      const fm = m.el.querySelector("[data-form]");
      if (!fm.title.value.trim() || !fm.url.value.trim()) return fail(new Error("The news needs a title and the original article."));
      const body = { title: fm.title.value.trim(), source_name: fm.source_name.value.trim(), platform: fm.platform.value, url: fm.url.value.trim(),
        paragraphs: fm.paragraphs.value.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean), relevant: fm.relevant.checked, edited_at: new Date().toISOString(),
        ...(fm.published_at.value ? { published_at: new Date(`${fm.published_at.value}T12:00:00Z`).toISOString() } : {}) };
      const { error } = await A.db.from("news").update(body).eq("id", id);
      if (error) return fail(/policy|permission|row-level/i.test(error.message) ? new Error("Run supabase/admin-content.sql in Supabase first.") : error);
      m.close(); A.toast("Saved"); load();
    });
  }

  main.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-toggle]"), d = e.target.closest("[data-del]"), ed = e.target.closest("[data-edit]");
    try {
      if (t) {
        const r = rows.find((x) => x.id === Number(t.dataset.toggle));
        const { error } = await A.db.from("news").update({ relevant: !r.relevant, edited_at: new Date().toISOString() }).eq("id", r.id);
        if (error) throw /policy|permission|row-level/i.test(error.message) ? new Error("Run supabase/admin-content.sql in Supabase first.") : error;
        A.toast(r.relevant ? "Hidden from the website" : "Published on the website"); return load();
      }
      if (d) {
        const r = rows.find((x) => x.id === Number(d.dataset.del));
        if (!(await A.confirmDialog({ title: "Delete this news?", text: r.title, confirm: "Delete", danger: true }))) return;
        const { error } = await A.db.from("news").delete().eq("id", r.id);
        if (error) throw error;
        A.toast("Deleted"); return load();
      }
      if (ed) return edit(Number(ed.dataset.edit));
      const row = e.target.closest("tr[data-id]"); if (row) edit(Number(row.dataset.id));
    } catch (x) { fail(x); }
  });
  let timer;
  main.addEventListener("input", (e) => { if (e.target.dataset.f === "q") { clearTimeout(timer); timer = setTimeout(() => { f.q = e.target.value.trim(); load(); }, 300); } });
  main.addEventListener("change", (e) => { const k = e.target.dataset.f; if (k && k !== "q") { f[k] = e.target.value; load(); } });

  load();
})();
