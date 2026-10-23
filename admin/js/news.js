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

  const shell = () => { main.innerHTML = `<div class="page-head"><div><h1>Social News</h1><p>The news on the website's Social News page: edit them, publish or hide them.</p></div>
    <div class="head-actions"><a class="btn" href="../news.html" target="_blank" rel="noopener">${icon("external")}See the page</a></div></div>
    <div class="aud-kpis" data-kpis></div>
    <div class="nw-how">${icon("sparkles")}<span><b>They come in on their own</b> every 30 hours (sports marketing, social media and AI news, rewritten for sports teams). You only decide which ones are shown and fix anything you want.</span></div>
    <div class="bl-bar">
      <div class="bl-tabs" data-tabs></div>
      <div class="nw-filters"><label class="bl-search">${icon("filters")}<input type="search" placeholder="Search title or source…" data-f="q"></label></div>
    </div>
    <div class="nw-pfs" role="group" aria-label="Network" data-pfs></div>
    <div class="nw-list" data-list><p class="panel panel-pad muted">Loading…</p></div>`; };
  shell();

  const day = (v) => (v ? new Date(v).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "—");
  async function load() {
    let q = A.db.from("news").select("*").order("published_at", { ascending: false, nullsFirst: false }).limit(500);
    if (f.q) q = q.or(`title.ilike.%${f.q.replace(/[,()%]/g, " ")}%,source_name.ilike.%${f.q.replace(/[,()%]/g, " ")}%`);
    const { data, error } = await q;
    if (error) { $("[data-list]").innerHTML = `<p class="panel-pad muted">${esc(error.message)}</p>`; return; }
    rows = data || [];
    const open = Number((location.hash.match(/^#news=(\d+)$/) || [])[1]);   // the news open before a refresh
    if (open && rows.some((x) => x.id === open)) return edit(open);
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
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
  // ---------- one news item: a full page like Admin → Blog → a post (cards on the left, state + Google on the right) ----------
  function edit(id) {
    const r = rows.find((x) => x.id === id); if (!r) return;
    history.replaceState(null, "", `#news=${id}`);   // stays open after a refresh
    const hasSeo = "meta_title" in r;   // the SEO columns exist (supabase/seo.sql)
    const paraRow = (t = "") => `<div class="nw-para"><span class="nw-para-n"></span><textarea class="input" rows="3" data-para>${esc(t)}</textarea><button type="button" class="icon-btn" data-para-del title="Remove" aria-label="Remove">${icon("trash")}</button></div>`;
    const lh = (t, k) => `<span class="bl-lh"><span>${t}</span><span class="bl-len" data-len="${k}"></span></span>`;
    window.scrollTo(0, 0);
    main.innerHTML = `<div class="page-head bl-ed-head"><div class="bl-eh">
        <nav class="bl-eh-crumb"><a href="#" data-back class="bl-eh-back" aria-label="Back to Social News">${icon("chevron")}</a><a href="#" data-back>Social News</a><span>/</span><span>${esc(PF[r.platform] || r.platform)}</span></nav>
        <h1>${esc(r.title)}</h1>
        <div class="bl-eh-meta"><span class="bl-st ${r.relevant ? "is-pub" : ""}" data-ed-st>${r.relevant ? "Published" : "Hidden"}</span><span>${icon("edit")}${esc(day(r.published_at || r.created_at))}</span><span>${icon("external")}${esc(r.source_name)}</span>${r.slug ? `<span class="mono">/news/${esc(r.slug)}</span>` : ""}</div>
      </div>
      <div class="head-actions">${r.slug && r.relevant ? `<a class="btn" href="../news/${esc(r.slug)}.html" target="_blank" rel="noopener">${icon("eye")}See it on the website</a>` : ""}<span class="seo-saved muted" data-saved></span></div></div>
      <div class="bl-ed">
        <form class="bl-panes" data-form>
          <section class="panel panel-pad bl-ecard">
            <h3 class="bl-card-h"><span class="bl-n">1</span>The news <small class="muted">Title, where it comes from and when</small></h3>
            <label class="bl-big">Title<input class="input" name="title" value="${esc(r.title)}" required maxlength="300"></label>
            <div class="bl-row"><label>Source<input class="input" name="source_name" value="${esc(r.source_name)}" required></label>
              <label>Network<select class="select" name="platform">${PLATFORMS.map((p) => `<option value="${p}"${r.platform === p ? " selected" : ""}>${PF[p]}</option>`).join("")}</select></label>
              <label>Date<input class="input" type="date" name="published_at" value="${esc((r.published_at || "").slice(0, 10))}"></label></div>
            <label>Original article<span class="nw-url"><input class="input mono" name="url" type="url" value="${esc(r.url)}" required><a class="icon-btn" href="${esc(r.url)}" target="_blank" rel="noopener" title="Open" aria-label="Open">${icon("external")}</a></span></label>
          </section>
          <section class="panel panel-pad bl-ecard">
            <h3 class="bl-card-h"><span class="bl-n">2</span>The text <small class="muted" data-wc></small></h3>
            <div class="nw-paras" data-paras>${((r.paragraphs || []).length ? r.paragraphs : [""]).map(paraRow).join("")}</div>
            <button type="button" class="btn btn-ghost btn-sm bl-add" data-para-add>${icon("plus")}Add a paragraph</button>
          </section>
          <section class="panel panel-pad bl-ecard">
            <h3 class="bl-card-h"><span class="bl-n">3</span>SEO &amp; AI <small class="muted">Its own page for Google and AI assistants</small></h3>
            ${hasSeo ? `<label>${lh("Meta title", "meta_title")}<input class="input" name="meta_title" value="${esc(r.meta_title || "")}" maxlength="80" placeholder="Empty = the title. 30–60 characters"></label>
            <label>${lh("Meta description", "meta_description")}<textarea class="input" name="meta_description" rows="3" maxlength="200" placeholder="Empty = the first lines. 120–160 characters">${esc(r.meta_description || "")}</textarea></label>
            <label>Key takeaways <small class="muted bl-sub">2–4 short sentences, one per line. AI assistants quote them.</small><textarea class="input" name="takeaways" rows="4">${esc((r.takeaways || []).join("\n"))}</textarea></label>
            <div class="bl-faq"><span class="bl-faq-h">Frequently asked questions <small class="muted bl-sub">Optional. What a sports team would ask about this news.</small></span>
              <div data-faq>${(r.faq || []).map(faqRow).join("")}</div>
              <button type="button" class="btn btn-ghost btn-sm" data-faq-add>${icon("plus")}Add a question</button></div>`
            : `<p class="muted">Run supabase/seo.sql in Supabase to add the SEO fields.</p>`}
          </section>
        </form>
        <aside class="bl-side">
          <div class="panel bl-side-card"><label class="nw-sw nw-sw-lg"><input type="checkbox" data-ed-pub${r.relevant ? " checked" : ""}><span class="nw-sw-t"></span><span><b>Published on the website</b><small class="muted">Off = hidden from Social News</small></span></label>
            ${r.edited_at ? `<small class="muted">Edited ${esc(day(r.edited_at))}</small>` : ""}</div>
          ${hasSeo ? `<div class="panel bl-side-card"><div class="bl-score"><div class="bl-ring"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.9" class="bg"/><circle cx="18" cy="18" r="15.9" class="fg" data-ring-fg/></svg><b data-score>0</b></div><div><b>SEO score</b><small class="muted">Google + AI assistants</small></div></div>
            <button type="button" class="btn btn-primary btn-sm bl-improve" data-improve hidden>${icon("sparkles")}Improve with AI</button><ul class="bl-checks" data-checks></ul></div>` : ""}
          <div class="panel bl-side-card"><b class="bl-side-h">${icon("search")}How it looks on Google</b><div class="bl-serp" data-serp></div></div>
          <button type="button" class="btn btn-ghost btn-sm nw-del" data-ed-del>${icon("trash")}Delete this news</button>
        </aside>
      </div>`;
    const fm = $("[data-form]");
    const paras = () => [...fm.querySelectorAll("[data-para]")].map((t) => t.value.trim()).filter(Boolean);
    const grow = (t) => { t.style.height = "auto"; t.style.height = `${t.scrollHeight + 2}px`; };
    // saved on its own 1.2 s after the last change
    let autosave = false, timer = null, lastChecks = [];
    const later = () => { clearTimeout(timer); timer = setTimeout(() => { timer = null; save(); }, 1200); };
    function audit() {
      if (autosave) later();
      fm.querySelectorAll(".nw-para-n").forEach((n, i) => { n.textContent = i + 1; });
      const text = paras().join(" "), n = text ? text.split(/\s+/).length : 0;
      $("[data-wc]").textContent = `${paras().length} paragraphs · ${n} words`;
      const mt = (hasSeo && fm.meta_title.value.trim()) || fm.title.value.trim(), md = (hasSeo && fm.meta_description.value.trim()) || (text.length > 155 ? `${text.slice(0, 154).replace(/\s+\S*$/, "")}…` : text);
      $("[data-serp]").innerHTML = `<small>sportscontentplaybook.com › news › ${esc(r.slug || "…")}</small><b>${esc(mt || "Your title")}</b><p>${esc(md)}</p>`;
      if (!hasSeo) return;
      for (const [k, a, b] of [["meta_title", 30, 60], ["meta_description", 120, 160]]) { const v = fm[k].value.trim().length, el = $(`[data-len="${k}"]`); el.textContent = v ? `${v} / ${b}` : ""; el.className = `bl-len ${v >= a && v <= b ? "ok" : v ? "warn" : ""}`; }
      const tk = fm.takeaways.value.split("\n").filter((t) => t.trim()).length;
      const faqN = [...fm.querySelectorAll(".bl-faq-row")].filter((x) => x.querySelector("[name=faq_q]").value.trim() && x.querySelector("[name=faq_a]").value.trim()).length;
      // [text, passes, what the AI can fix ("" = needs you)]
      const checks = [[`Title on Google 30–60 characters (${mt.length})`, mt.length >= 30 && mt.length <= 60, "meta_title"], [`Description on Google 120–160 characters (${md.length})`, md.length >= 120 && md.length <= 160, "meta_description"],
        [`2 or more paragraphs (${paras().length})`, paras().length >= 2, ""], [`Key takeaways for AI (${tk})`, tk >= 2, "takeaways"], [`FAQ for AI (${faqN})`, faqN >= 1, "faq"], ["Original article linked", /^https?:\/\//.test(fm.url.value.trim()), ""]];
      lastChecks = checks; $("[data-improve]").hidden = !checks.some(([, v, f]) => !v && f);
      const score = Math.round((checks.filter((c) => c[1]).length / checks.length) * 100);
      $("[data-score]").textContent = score;
      const fg = $("[data-ring-fg]"); fg.style.strokeDasharray = `${score} 100`; fg.style.stroke = score >= 80 ? "var(--green)" : score >= 50 ? "var(--accent)" : "var(--red)";
      $("[data-checks]").innerHTML = checks.map(([t, v]) => `<li class="${v ? "ok" : ""}">${icon(v ? "check" : "alert")}<span>${esc(t)}</span></li>`).join("");
    }
    fm.querySelectorAll("[data-para]").forEach(grow); audit();
    fm.addEventListener("input", (e) => { if (e.target.matches("[data-para]")) grow(e.target); audit(); });
    fm.addEventListener("click", (e) => {
      if (e.target.closest("[data-para-add]")) { $("[data-paras]").insertAdjacentHTML("beforeend", paraRow()); $("[data-paras]").lastElementChild.querySelector("textarea").focus(); audit(); }
      if (e.target.closest("[data-para-del]")) { e.target.closest(".nw-para").remove(); audit(); }
      if (e.target.closest("[data-faq-add]")) fm.querySelector("[data-faq]").insertAdjacentHTML("beforeend", faqRow());
      if (e.target.closest("[data-faq-del]")) { e.target.closest(".bl-faq-row").remove(); audit(); }
    });
    $("[data-ed-pub]").addEventListener("change", (e) => { const st = $("[data-ed-st]"); st.textContent = e.target.checked ? "Published" : "Hidden"; st.className = `bl-st ${e.target.checked ? "is-pub" : ""}`; save(); });
    async function save() {
      clearTimeout(timer); timer = null;
      if (!fm.title.value.trim() || !fm.url.value.trim()) { $("[data-saved]").innerHTML = `${icon("alert")}Not saved: it needs a title and the original article`; return; }
      const body = { title: fm.title.value.trim(), source_name: fm.source_name.value.trim(), platform: fm.platform.value, url: fm.url.value.trim(),
        paragraphs: paras(), relevant: $("[data-ed-pub]").checked, edited_at: new Date().toISOString(),
        ...(fm.published_at.value ? { published_at: new Date(`${fm.published_at.value}T12:00:00Z`).toISOString() } : {}),
        ...(hasSeo ? { meta_title: fm.meta_title.value.trim() || null, meta_description: fm.meta_description.value.trim() || null,
          takeaways: fm.takeaways.value.split("\n").map((t) => t.trim()).filter(Boolean),
          faq: [...fm.querySelectorAll(".bl-faq-row")].map((x) => ({ q: x.querySelector("[name=faq_q]").value.trim(), a: x.querySelector("[name=faq_a]").value.trim() })).filter((q) => q.q && q.a) } : {}) };
      const { error } = await A.db.from("news").update(body).eq("id", id);
      if (error) return fail(/policy|permission|row-level/i.test(error.message) ? new Error("Run supabase/admin-content.sql in Supabase first.") : error);
      Object.assign(r, body);
      $("[data-saved]").innerHTML = `${icon("check")}Saved automatically · ${new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
    }
    $("[data-ed-del]").addEventListener("click", async () => {
      if (!(await A.confirmDialog({ title: "Delete this news?", text: r.title, confirm: "Delete", danger: true }))) return;
      const { error } = await A.db.from("news").delete().eq("id", id);
      if (error) return fail(error);
      clearTimeout(timer); timer = null; A.toast("Deleted"); back();
    });
    // "Improve with AI" (Edge Function seo-improve, the same as the blog): fills what's missing for 100 and saves
    $("[data-improve]")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget, fix = lastChecks.filter(([, v, f]) => !v && f).map(([, , f]) => f);
      if (!fix.length) return;
      btn.disabled = true; const label = btn.innerHTML; btn.innerHTML = `${icon("sparkles")}Improving…`;
      try {
        const { data: x, error } = await A.db.functions.invoke("seo-improve", { body: { fix, title: fm.title.value, meta_title: fm.meta_title.value, meta_description: fm.meta_description.value,
          body_html: `<p>Social News item from ${fm.source_name.value} (${PF[fm.platform.value] || fm.platform.value}), rewritten for sports teams.</p>${paras().map((t) => `<p>${esc(t)}</p>`).join("")}` } });
        if (error || x?.error) throw new Error(x?.error || error.message);
        if (fix.includes("meta_title") && x.meta_title) fm.meta_title.value = x.meta_title;
        if (fix.includes("meta_description") && x.meta_description) fm.meta_description.value = x.meta_description;
        if (fix.includes("takeaways") && x.takeaways?.length) fm.takeaways.value = x.takeaways.join("\n");
        if (fix.includes("faq") && x.faq?.length) { const box = fm.querySelector("[data-faq]"); box.querySelectorAll(".bl-faq-row").forEach((row) => { if (!row.querySelector("[name=faq_q]").value.trim()) row.remove(); }); box.insertAdjacentHTML("beforeend", x.faq.map(faqRow).join("")); }
        autosave = false; audit(); autosave = true;
        await save();
        const left = lastChecks.filter(([, v]) => !v).map(([t]) => t);
        A.toast(left.length ? `Improved and saved. Still for you: ${left.join(" · ")}` : "Improved to 100 and saved");
      } catch (err) { fail(err); }
      btn.disabled = false; btn.innerHTML = label;
    });
    const back = async () => { if (timer) await save(); history.replaceState(null, "", location.pathname + location.search); shell(); load(); };
    main.querySelectorAll("[data-back]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); back(); }));
    autosave = true;
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
