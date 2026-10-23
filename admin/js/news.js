// SCP Admin — Social News: every news item the pipeline brought in (published = relevant, hidden = not), to edit its title,
// source, link, network and paragraphs, publish / hide it or delete it. Data: table news (supabase/news.sql, admin rights
// in supabase/admin-content.sql). The public page (news.html) shows the published ones; each one also gets its own page
// news/<slug>.html with the SEO & AI fields (supabase/seo.sql), built by the "Publish blog" Action.
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
    <div class="nw-how">${icon("sparkles")}<span><b>They come in on their own</b> every 30 hours (sports marketing, social media and AI news, rewritten for sports teams). You only decide which ones are shown and fix anything you want.</span></div>
    <div class="bl-bar">
      <div class="bl-tabs" data-tabs></div>
      <div class="nw-filters"><label class="bl-search">${icon("filters")}<input type="search" placeholder="Search title or source…" data-f="q"></label></div>
    </div>
    <div class="nw-pfs" role="group" aria-label="Network" data-pfs></div>
    <div class="nw-list" data-list><p class="panel panel-pad muted">Loading…</p></div>`;

  const day = (v) => (v ? new Date(v).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "—");
  async function load() {
    let q = A.db.from("news").select("*").order("published_at", { ascending: false, nullsFirst: false }).limit(500);
    if (f.q) q = q.or(`title.ilike.%${f.q.replace(/[,()%]/g, " ")}%,source_name.ilike.%${f.q.replace(/[,()%]/g, " ")}%`);
    const { data, error } = await q;
    if (error) { $("[data-list]").innerHTML = `<p class="panel-pad muted">${esc(error.message)}</p>`; return; }
    rows = data || [];
    draw();
  }
  // brand colours of the networks (the dot on each card)
  const PF_C = { instagram: "#e1306c", tiktok: "#25f4ee", x: "#9aa4b5", youtube: "#ff0033", facebook: "#1877f2", linkedin: "#0a66c2", snapchat: "#fffc00", whatsapp: "#25d366", pinterest: "#e60023", threads: "#9aa4b5", ai: "#a78bfa", other: "#f0b84a" };
  function draw() {
    const pub = rows.filter((r) => r.relevant).length;
    $("[data-kpis]").innerHTML = `<div class="aud-kpi is-green"><span>Published</span><b>${num(pub)}</b></div><div class="aud-kpi"><span>Hidden</span><b>${num(rows.length - pub)}</b></div><div class="aud-kpi is-gold"><span>Newest</span><b class="nw-kpi-d">${rows[0] ? day(rows[0].published_at || rows[0].created_at) : "—"}</b></div>`;
    const tab = (k, label, n) => `<button type="button" class="bl-tab" data-tab="${k}" aria-pressed="${f.status === k}">${label}<b>${n}</b></button>`;
    $("[data-tabs]").innerHTML = tab("", "All", rows.length) + tab("pub", "Published", pub) + tab("hid", "Hidden", rows.length - pub);
    // the networks as buttons with their logo and how many news each has (only the ones there are)
    const ICON = { instagram: "instagram", tiktok: "tiktok", x: "x", youtube: "youtube", facebook: "facebook", linkedin: "linkedin", snapchat: "snapchat", whatsapp: "whatsapp", pinterest: "pinterest", threads: "threads", ai: "ai" };
    const have = PLATFORMS.filter((p) => rows.some((r) => r.platform === p));
    const pfBtn = (k, label, n, img) => `<button type="button" class="nw-pfb" data-pf="${k}" aria-pressed="${f.platform === k}">${img}<span>${esc(label)}</span><b>${n}</b></button>`;
    $("[data-pfs]").innerHTML = pfBtn("", "All networks", rows.length, `<span class="nw-pfb-all">${icon("filters")}</span>`)
      + have.map((p) => pfBtn(p, PF[p], rows.filter((r) => r.platform === p).length, ICON[p] ? `<img src="../assets/pf-${ICON[p]}.svg" alt="">` : `<span class="nw-pfb-all">${icon("sparkles")}</span>`)).join("");
    const list = rows.filter((r) => (!f.status || r.relevant === (f.status === "pub")) && (!f.platform || r.platform === f.platform));
    $("[data-list]").innerHTML = list.length ? list.map((r) => `<article class="nw-card${r.relevant ? "" : " is-hidden"}" data-id="${r.id}">
        <span class="nw-pf" style="--c:${PF_C[r.platform] || "#f0b84a"}">${esc((PF[r.platform] || r.platform).slice(0, 2))}</span>
        <div class="nw-body">
          <small class="nw-meta"><b>${esc(PF[r.platform] || r.platform)}</b> · ${esc(r.source_name)} · ${day(r.published_at || r.created_at)}${r.edited_at ? ` · <i>edited</i>` : ""}</small>
          <b class="nw-title">${esc(r.title)}</b>
          <p class="nw-ex">${esc((r.paragraphs || [])[0] || "")}</p>
        </div>
        <div class="nw-side">
          <label class="nw-sw" title="${r.relevant ? "Shown on the website" : "Hidden from the website"}"><input type="checkbox" data-toggle="${r.id}"${r.relevant ? " checked" : ""}><span class="nw-sw-t"></span><span>${r.relevant ? "Published" : "Hidden"}</span></label>
          <div class="nw-acts"><button class="btn btn-sm btn-primary" type="button" data-edit="${r.id}">${icon("edit")}Edit</button>
            <a class="icon-btn" href="${esc(r.url)}" target="_blank" rel="noopener" title="Original article" aria-label="Original article">${icon("external")}</a>
            <button class="icon-btn" type="button" title="Delete" aria-label="Delete" data-del="${r.id}">${icon("trash")}</button></div>
        </div>
      </article>`).join("") : `<p class="panel panel-pad muted">No news with these filters.</p>`;
  }

  const faqRow = (f = {}) => `<div class="bl-faq-row"><input class="input" name="faq_q" value="${esc(f.q || "")}" placeholder="Question"><textarea class="input" name="faq_a" rows="2" placeholder="Short, direct answer (2–3 sentences)">${esc(f.a || "")}</textarea><button type="button" class="icon-btn" data-faq-del title="Remove" aria-label="Remove">${icon("trash")}</button></div>`;
  function edit(id) {
    const r = rows.find((x) => x.id === id); if (!r) return;
    const hasSeo = "meta_title" in r;   // the SEO columns exist (supabase/seo.sql)
    const m = A.modal({ title: "Edit news", sub: `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url)}</a>`, size: "lg",
      body: `<form class="nw-form" data-form>
        <label>Title<input class="input" name="title" value="${esc(r.title)}" required maxlength="300"></label>
        <div class="nw-row"><label>Source<input class="input" name="source_name" value="${esc(r.source_name)}" required></label>
          <label>Network<select class="select" name="platform">${PLATFORMS.map((p) => `<option value="${p}"${r.platform === p ? " selected" : ""}>${PF[p]}</option>`).join("")}</select></label>
          <label>Date<input class="input" type="date" name="published_at" value="${esc((r.published_at || "").slice(0, 10))}"></label></div>
        <label>Original article<input class="input" name="url" type="url" value="${esc(r.url)}" required></label>
        <label>Text <small class="muted">One paragraph per block; leave an empty line between paragraphs.</small><textarea class="input" name="paragraphs" rows="12">${esc((r.paragraphs || []).join("\n\n"))}</textarea></label>
        <label class="check-inline"><input type="checkbox" name="relevant"${r.relevant ? " checked" : ""}> Published on the website</label>
        <div class="nw-seo">
          <b class="nw-seo-h">${icon("sparkles")}SEO &amp; AI <small class="muted">Each published news item has its own page for Google and AI assistants${r.slug ? ` · <a href="../news/${esc(r.slug)}.html" target="_blank" rel="noopener">see it</a>` : ""}.</small></b>
          ${hasSeo ? `<label>Meta title <span class="bl-len" data-len="meta_title"></span><input class="input" name="meta_title" value="${esc(r.meta_title || "")}" maxlength="80" placeholder="Empty = the title. 30–60 characters"></label>
          <label>Meta description <span class="bl-len" data-len="meta_description"></span><textarea class="input" name="meta_description" rows="2" maxlength="200" placeholder="Empty = the first lines. 120–160 characters">${esc(r.meta_description || "")}</textarea></label>
          <label>Key takeaways <small class="muted">2–4 short sentences, one per line. AI assistants quote them.</small><textarea class="input" name="takeaways" rows="3">${esc((r.takeaways || []).join("\n"))}</textarea></label>
          <div class="bl-faq"><span class="bl-faq-h">Frequently asked questions <small class="muted">Optional. What a sports team would ask about this news.</small></span>
            <div data-faq>${(r.faq || []).map(faqRow).join("")}</div>
            <button type="button" class="btn btn-ghost btn-sm" data-faq-add>${icon("plus")}Add a question</button></div>`
          : `<p class="muted">Run supabase/seo.sql in Supabase to add the SEO fields.</p>`}
        </div>
      </form>`,
      foot: `<button class="btn btn-primary" type="button" data-save>Save</button>` });
    const fm0 = m.el.querySelector("[data-form]");
    const lens = () => { if (!hasSeo) return; for (const [k, a, b] of [["meta_title", 30, 60], ["meta_description", 120, 160]]) { const v = fm0[k].value.trim().length, el = fm0.querySelector(`[data-len="${k}"]`); el.textContent = v ? `${v} / ${b}` : ""; el.className = `bl-len ${v >= a && v <= b ? "ok" : v ? "warn" : ""}`; } };
    lens(); fm0.addEventListener("input", lens);
    fm0.addEventListener("click", (e) => {
      if (e.target.closest("[data-faq-add]")) fm0.querySelector("[data-faq]").insertAdjacentHTML("beforeend", faqRow());
      if (e.target.closest("[data-faq-del]")) e.target.closest(".bl-faq-row").remove();
    });
    m.el.querySelector("[data-save]").addEventListener("click", async () => {
      const fm = fm0;
      if (!fm.title.value.trim() || !fm.url.value.trim()) return fail(new Error("The news needs a title and the original article."));
      const body = { title: fm.title.value.trim(), source_name: fm.source_name.value.trim(), platform: fm.platform.value, url: fm.url.value.trim(),
        paragraphs: fm.paragraphs.value.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean), relevant: fm.relevant.checked, edited_at: new Date().toISOString(),
        ...(fm.published_at.value ? { published_at: new Date(`${fm.published_at.value}T12:00:00Z`).toISOString() } : {}),
        ...(hasSeo ? { meta_title: fm.meta_title.value.trim() || null, meta_description: fm.meta_description.value.trim() || null,
          takeaways: fm.takeaways.value.split("\n").map((t) => t.trim()).filter(Boolean),
          faq: [...fm.querySelectorAll(".bl-faq-row")].map((x) => ({ q: x.querySelector("[name=faq_q]").value.trim(), a: x.querySelector("[name=faq_a]").value.trim() })).filter((f) => f.q && f.a) } : {}) };
      const { error } = await A.db.from("news").update(body).eq("id", id);
      if (error) return fail(/policy|permission|row-level/i.test(error.message) ? new Error("Run supabase/admin-content.sql in Supabase first.") : error);
      m.close(); A.toast("Saved"); load();
    });
  }

  main.addEventListener("click", async (e) => {
    const tb = e.target.closest("[data-tab]"); if (tb) { f.status = tb.dataset.tab; return draw(); }
    const pf = e.target.closest("[data-pf]"); if (pf) { f.platform = pf.dataset.pf; return draw(); }
    if (e.target.closest("a, label, input")) return;
    const d = e.target.closest("[data-del]"), ed = e.target.closest("[data-edit]");
    try {
      if (d) {
        const r = rows.find((x) => x.id === Number(d.dataset.del));
        if (!(await A.confirmDialog({ title: "Delete this news?", text: r.title, confirm: "Delete", danger: true }))) return;
        const { error } = await A.db.from("news").delete().eq("id", r.id);
        if (error) throw error;
        A.toast("Deleted"); return load();
      }
      if (ed) return edit(Number(ed.dataset.edit));
      const card = e.target.closest(".nw-card[data-id]"); if (card) edit(Number(card.dataset.id));
    } catch (x) { fail(x); }
  });
  let timer;
  main.addEventListener("input", (e) => { if (e.target.dataset.f === "q") { clearTimeout(timer); timer = setTimeout(() => { f.q = e.target.value.trim(); load(); }, 300); } });
  main.addEventListener("change", async (e) => {
    const tg = e.target.closest("[data-toggle]");
    if (tg) {   // publish / hide straight from the card
      const r = rows.find((x) => x.id === Number(tg.dataset.toggle));
      const { error } = await A.db.from("news").update({ relevant: tg.checked, edited_at: new Date().toISOString() }).eq("id", r.id);
      if (error) { tg.checked = !tg.checked; return fail(error); }
      r.relevant = tg.checked; A.toast(tg.checked ? "Published on the website" : "Hidden from the website"); return draw();
    }
    const k = e.target.dataset.f; if (k && k !== "q") { f[k] = e.target.value; load(); }
  });

  load();
})();
