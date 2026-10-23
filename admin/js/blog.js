// SCP Admin — Blog: the blog posts (table blog_posts, supabase/admin-content.sql), to edit or write them. The GitHub Action
// "Publish blog" (every hour, or Run workflow on GitHub) turns them into the static pages with blog-tools/build.mjs and
// publishes them; each post says whether it's published, has changes waiting, or the last publish failed (and why).
(async () => {
  const A = window.SCPA;
  const { $, esc, icon, num, info } = A;
  try { await A.boot("blog"); } catch { return; }
  const main = $("[data-main]");
  const fail = (e) => A.toast(e.message || String(e), "err");
  const TYPES = { news: "News & updates · 500–800 words", trends: "Social media trends · 800–1,200 words", ideas: "Sports content ideas · 1,200–1,800 words" };
  const ACTIONS = "https://github.com/martiruiz/newscp2627/actions/workflows/publish-blog.yml";
  let posts = [];
  const slugify = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  const day = (v) => (v ? new Date(v).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
  const status = (p) => p.draft ? ["Draft", ""] : p.publish_error ? ["Publish failed", "is-err"] : !p.published_at || new Date(p.updated_at) > new Date(p.published_at) ? ["Changes waiting to publish", "is-wait"] : ["Live on the website", "is-pub"];

  // ---------- the posts: summary, how publishing works, filters and a card per post ----------
  const view = { tab: "all", q: "" };
  const KIND = (p) => p.draft ? "draft" : p.publish_error ? "error" : status(p)[1] === "is-wait" ? "wait" : "live";
  const TYPE_SHORT = { news: "News & updates", trends: "Social media trends", ideas: "Sports content ideas" };
  async function list() {
    const { data, error } = await A.db.from("blog_posts").select("slug,data,draft,updated_at,published_at,publish_error").order("updated_at", { ascending: false });
    if (error) { main.innerHTML = `<div class="page-head"><div><h1>Blog</h1></div></div><p class="panel panel-pad muted">${esc(/blog_posts|does not exist|schema cache/i.test(error.message) ? "Run supabase/admin-content.sql in Supabase first." : error.message)}</p>`; return; }
    posts = data || [];
    drawList();
  }
  function drawList() {
    const n = (k) => posts.filter((p) => KIND(p) === k).length;
    const shown = posts.filter((p) => (view.tab === "all" || KIND(p) === view.tab) && (!view.q || `${p.data.title} ${p.slug}`.toLowerCase().includes(view.q.toLowerCase())));
    const tab = (k, label, count) => `<button type="button" class="bl-tab" data-tab="${k}" aria-pressed="${view.tab === k}">${label}<b>${count}</b></button>`;
    main.innerHTML = `<div class="page-head"><div><h1>Blog</h1><p>Write and edit the blog posts. Changes are published on the website within the hour.</p></div>
      <div class="head-actions"><a class="btn" href="${ACTIONS}" target="_blank" rel="noopener">${icon("external")}Publish now (GitHub)</a><button class="btn btn-primary" type="button" data-new>${icon("plus")}New post</button></div></div>
      <div class="aud-kpis bl-kpis">
        <div class="aud-kpi is-green"><span>Live on the website</span><b>${num(n("live"))}</b></div>
        <div class="aud-kpi is-gold"><span>Waiting to publish</span><b>${num(n("wait"))}</b></div>
        <div class="aud-kpi"><span>Drafts</span><b>${num(n("draft"))}</b></div>
        <div class="aud-kpi${n("error") ? " is-red" : ""}"><span>Publish failed</span><b>${num(n("error"))}</b></div>
      </div>
      <ol class="bl-steps">
        <li><span>1</span><div><b>Write or edit</b><small>Open a post or create a new one.</small></div></li>
        <li><span>2</span><div><b>Save</b><small>Untick “Draft” when it's ready.</small></div></li>
        <li><span>3</span><div><b>On the website within the hour</b><small>Or “Publish now” on GitHub → Run workflow.</small></div></li>
      </ol>
      <div class="bl-bar">
        <div class="bl-tabs">${tab("all", "All", posts.length)}${tab("live", "Live", n("live"))}${tab("wait", "Waiting", n("wait"))}${tab("draft", "Drafts", n("draft"))}${n("error") ? tab("error", "Failed", n("error")) : ""}</div>
        <label class="bl-search">${icon("filters")}<input type="search" placeholder="Search a post…" value="${esc(view.q)}" data-q></label>
      </div>
      <div class="bl-grid">
        <button type="button" class="bl-card bl-new" data-new><span class="bl-new-ic">${icon("plus")}</span><b>New post</b><small>Write one from scratch</small></button>
        ${shown.map((p) => { const [s, c] = status(p), d = p.data, cover = d.image?.file ? (d.image.url || `../assets/blog/${d.image.file}`) : "";
          return `<article class="bl-card" data-slug="${esc(p.slug)}">
            <div class="bl-cv">${cover ? `<img src="${esc(cover)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'bl-cv-none',textContent:'No cover'}))">` : `<span class="bl-cv-none">No cover</span>`}
              <span class="bl-st ${c}">${esc(s)}</span></div>
            <div class="bl-cd">
              <small class="bl-meta">${esc(TYPE_SHORT[d.type] || d.type || "—")} · ${esc(d.date || "—")}</small>
              <b class="bl-tt">${esc(d.title || p.slug)}</b>
              ${p.publish_error ? `<p class="bl-why">${icon("alert")}Didn't pass the checks — open it to see why.</p>` : `<p class="bl-ex">${esc(d.excerpt || "")}</p>`}
              <div class="bl-acts">
                <button type="button" class="btn btn-sm btn-primary" data-open="${esc(p.slug)}">${icon("edit")}Edit</button>
                ${!p.draft && p.published_at ? `<a class="btn btn-sm" href="../blog/${esc(p.slug)}.html" target="_blank" rel="noopener">${icon("eye")}See it</a>` : ""}
                <button type="button" class="btn btn-sm btn-ghost" data-draft="${esc(p.slug)}">${p.draft ? "Publish" : "Back to draft"}</button>
                <small class="bl-saved">Saved ${esc(day(p.updated_at))}</small>
              </div>
            </div>
          </article>`; }).join("")}
      </div>
      ${!shown.length ? `<p class="panel panel-pad muted">No posts here.</p>` : ""}`;
  }

  // ---------- one post: tabs on the left (Content · Cover · SEO & AI · Sources), live SEO score, Google preview and state on the right ----------
  const RANGE = { news: [500, 800], trends: [800, 1200], ideas: [1200, 1800] };
  const plain = (html) => String(html || "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
  function editor(p) {
    const isNew = !p, d = p?.data || { type: "ideas", date: new Date().toISOString().slice(0, 10), author: "Martí Ruiz", keywords: [], sources: [], references: [], image: { credit: {} }, faq: [], takeaways: [] };
    const img = d.image || {}, cred = img.credit || {};
    const lines = (arr) => (arr || []).map((x) => `${x.name} | ${x.url}`).join("\n");
    const takeawaysOf = (v) => (Array.isArray(v) ? v : String(v || "").split("\n")).filter(Boolean).join("\n");
    const [s, c] = p ? status(p) : ["New", ""];
    const faqRow = (f = {}) => `<div class="bl-faq-row"><input class="input" name="faq_q" value="${esc(f.q || "")}" placeholder="Question people ask (e.g. How often should a club post on TikTok?)"><textarea class="input" name="faq_a" rows="2" placeholder="Short, direct answer (2–3 sentences)">${esc(f.a || "")}</textarea><button type="button" class="icon-btn" data-faq-del title="Remove" aria-label="Remove">${icon("trash")}</button></div>`;
    main.innerHTML = `<div class="page-head bl-ed-head"><div><a class="link" href="#" data-back>← Blog</a><h1>${esc(isNew ? "New post" : d.title)}</h1></div>
      <div class="head-actions">${!isNew && !p.draft && p.published_at ? `<a class="btn" href="../blog/${esc(p.slug)}.html" target="_blank" rel="noopener">${icon("eye")}See it on the website</a>` : ""}<button class="btn btn-primary" type="button" data-save>${icon("check")}Save</button></div></div>
      ${p?.publish_error ? `<div class="bl-err">${icon("alert")}<div><b>The last publish failed — fix this and save again</b><pre>${esc(p.publish_error)}</pre></div></div>` : ""}
      <div class="bl-ed">
        <form class="bl-form" data-form>
          <div class="bl-ed-tabs" role="tablist">
            <button type="button" role="tab" data-etab="content" aria-selected="true">${icon("edit")}Content</button>
            <button type="button" role="tab" data-etab="cover" aria-selected="false">${icon("eye")}Cover</button>
            <button type="button" role="tab" data-etab="seo" aria-selected="false">${icon("sparkles")}SEO &amp; AI</button>
            <button type="button" role="tab" data-etab="sources" aria-selected="false">${icon("external")}Sources</button>
          </div>
          <section class="panel panel-pad bl-sec" data-epane="content">
            <label class="bl-big">Title<input class="input" name="title" value="${esc(d.title || "")}" required placeholder="A clear title with your main keyword"></label>
            <div class="bl-row"><label>Type<select class="select" name="type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}"${d.type === k ? " selected" : ""}>${esc(v)}</option>`).join("")}</select></label>
              <label>Date<input class="input" type="date" name="date" value="${esc(d.date || "")}"></label>
              <label>URL<input class="input" name="slug" value="${esc(p?.slug || "")}" ${isNew ? "" : "readonly"} placeholder="made from the title"></label></div>
            <label>Excerpt <small class="muted">2 lines shown on the blog list.</small><textarea class="input" name="excerpt" rows="2">${esc(d.excerpt || "")}</textarea></label>
            <div class="bl-text">
              <div class="bl-tb" role="toolbar" aria-label="Text">
                <button type="button" data-wrap="h2" title="Subtitle">H2</button><button type="button" data-wrap="h3" title="Small subtitle">H3</button>
                <button type="button" data-wrap="p" title="Paragraph">¶</button><button type="button" data-wrap="strong" title="Bold"><b>B</b></button><button type="button" data-wrap="em" title="Italic"><i>I</i></button>
                <button type="button" data-wrap="a" title="Link">${icon("external")}</button><button type="button" data-wrap="ul" title="List">• List</button><button type="button" data-wrap="blockquote" title="Quote">“ ”</button>
                <span class="bl-tb-sp"></span><button type="button" data-view="edit" aria-pressed="true">Write</button><button type="button" data-view="prev" aria-pressed="false">Preview</button>
              </div>
              <textarea class="input mono" name="body_html" rows="24" data-body>${esc(d.body_html || "")}</textarea>
              <article class="bl-prev-in" data-prev hidden></article>
            </div>
            <label class="check-inline bl-draft"><input type="checkbox" name="draft"${p?.draft || isNew ? " checked" : ""}> Draft — not on the website yet</label>
          </section>
          <section class="panel panel-pad bl-sec" data-epane="cover" hidden>
            <div class="bl-cover"><div class="bl-cover-img" data-cover>${img.file ? `<img src="${esc(img.url || `../assets/blog/${img.file}`)}" alt="" onerror="this.remove()">` : `<span class="bl-cv-none">No cover yet</span>`}</div>
              <div class="bl-cover-f"><label class="btn btn-primary btn-sm">${icon("import")}Upload cover · 1200×630<input type="file" accept="image/png,image/jpeg,image/webp" hidden data-cover-file></label>
                <input type="hidden" name="img_file" value="${esc(img.file || "")}"><input type="hidden" name="img_url" value="${esc(img.url || "")}">
                <label>Describe the image (alt text) <small class="muted">For Google Images and screen readers. Include your keyword naturally.</small><input class="input" name="img_alt" value="${esc(img.alt || "")}"></label>
                <label>Image title<input class="input" name="img_title" value="${esc(img.title || "")}"></label>
                <div class="bl-row"><label>Credit<input class="input" name="img_author" value="${esc(cred.author || "")}" placeholder="Photographer / AI-generated…"></label><label>Credit link<input class="input" name="img_source" value="${esc(cred.source_url || "")}"></label></div></div></div>
          </section>
          <section class="panel panel-pad bl-sec" data-epane="seo" hidden>
            <h3>${icon("search")}Google</h3>
            <label>Meta title <span class="bl-len" data-len="meta_title"></span><input class="input" name="meta_title" value="${esc(d.meta_title || "")}" maxlength="80" placeholder="What shows as the blue link on Google (30–60 characters)"></label>
            <label>Meta description <span class="bl-len" data-len="meta_description"></span><textarea class="input" name="meta_description" rows="2" maxlength="200" placeholder="The grey text under the link (120–160 characters): what the reader gets">${esc(d.meta_description || "")}</textarea></label>
            <label>Main keyword <small class="muted">The search you want to rank for.</small><input class="input" name="primary_keyword" value="${esc(d.primary_keyword || "")}"></label>
            <label>Keywords <small class="muted">One per line — the blog checks all 15 appear in the text.</small><textarea class="input" name="keywords" rows="7">${esc((d.keywords || []).join("\n"))}</textarea></label>
            <h3>${icon("sparkles")}AI assistants (ChatGPT, Perplexity, Gemini, Claude…)</h3>
            <p class="bl-help">AI answers quote short, clear, well-sourced text. These show on the article and as structured data.</p>
            <label>Key takeaways <small class="muted">3–5 short sentences, one per line. Shown at the top of the article.</small><textarea class="input" name="takeaways" rows="4" placeholder="Clubs that post episodic series get more returning viewers.">${esc(takeawaysOf(d.takeaways))}</textarea></label>
            <div class="bl-faq"><span class="bl-faq-h">Frequently asked questions <small class="muted">3 or more. The questions people type into Google or ask an AI.</small></span>
              <div data-faq>${(d.faq || []).map(faqRow).join("") || faqRow()}</div>
              <button type="button" class="btn btn-ghost btn-sm" data-faq-add>${icon("plus")}Add a question</button></div>
            <div class="bl-row"><label>Author<input class="input" name="author" value="${esc(d.author || "")}"></label><label>Last updated<input class="input" type="date" name="updated" value="${esc(d.updated || "")}"></label></div>
            <label>About the author <small class="muted">One line of experience — trust for Google and AI (E-E-A-T).</small><input class="input" name="author_bio" value="${esc(d.author_bio || "")}" placeholder="Founder of Sports Content Playbook. 10 years running social media for sports clubs."></label>
          </section>
          <section class="panel panel-pad bl-sec" data-epane="sources" hidden>
            <label>CTA title<input class="input" name="cta_title" value="${esc(d.cta_title || "")}"></label>
            <label>CTA text<textarea class="input" name="cta_text" rows="2">${esc(d.cta_text || "")}</textarea></label>
            <label>Sources <small class="muted">One per line: name | link — cited sources build trust with Google and AI.</small><textarea class="input" name="sources" rows="5">${esc(lines(d.sources))}</textarea></label>
            <label>Posts shown in the article <small class="muted">One per line: name | link</small><textarea class="input" name="references" rows="5">${esc(lines(d.references))}</textarea></label>
          </section>
        </form>
        <aside class="bl-side">
          <div class="panel bl-side-card"><span class="bl-st ${c}">${esc(s)}</span>${p?.published_at ? `<small class="muted">Published ${day(p.published_at)}</small>` : ""}<small class="muted">${isNew ? "Not saved yet" : `Saved ${day(p.updated_at)}`}</small></div>
          <div class="panel bl-side-card"><div class="bl-score"><div class="bl-ring" data-ring><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.9" class="bg"/><circle cx="18" cy="18" r="15.9" class="fg" data-ring-fg/></svg><b data-score>0</b></div><div><b>SEO score</b><small class="muted">Google + AI assistants</small></div></div>
            <ul class="bl-checks" data-checks></ul></div>
          <div class="panel bl-side-card"><b class="bl-side-h">${icon("search")}How it looks on Google</b><div class="bl-serp" data-serp></div></div>
        </aside>
      </div>`;
    const fm = $("[data-form]");
    const plainBody = () => plain(fm.body_html.value);
    function audit() {
      const kw = fm.primary_keyword.value.trim().toLowerCase(), body = fm.body_html.value, text = plainBody().toLowerCase();
      const n = text ? text.split(" ").length : 0, [lo, hi] = RANGE[fm.type.value] || [0, 1e9];
      const mt = (fm.meta_title.value || fm.title.value).trim(), md = fm.meta_description.value.trim();
      const first = plain((body.match(/<p[^>]*>([\s\S]*?)<\/p>/i) || [, body.slice(0, 600)])[1]).toLowerCase();
      const subs = [...body.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)].map((m) => plain(m[1]).toLowerCase());
      const kws = fm.keywords.value.split("\n").map((k) => k.trim().toLowerCase()).filter(Boolean), kwIn = kws.filter((k) => text.includes(k)).length;
      const faqN = [...fm.querySelectorAll(".bl-faq-row")].filter((r) => r.querySelector("[name=faq_q]").value.trim() && r.querySelector("[name=faq_a]").value.trim()).length;
      const tk = fm.takeaways.value.split("\n").filter((t) => t.trim()).length;
      const checks = [
        ["Main keyword chosen", !!kw],
        ["Keyword in the title", kw && fm.title.value.toLowerCase().includes(kw)],
        ["Keyword in the first paragraph", kw && first.includes(kw)],
        ["Keyword in a subtitle (H2/H3)", kw && subs.some((t) => t.includes(kw))],
        [`Meta title 30–60 characters (${mt.length})`, mt.length >= 30 && mt.length <= 60],
        [`Meta description 120–160 characters (${md.length})`, md.length >= 120 && md.length <= 160],
        [`Length ${n.toLocaleString("es-ES")} words · ${lo}–${hi}`, n >= lo && n <= hi],
        [`Keywords in the text ${kwIn}/${kws.length || 15}`, kws.length >= 15 && kwIn === kws.length],
        ["Cover with alt text", !!(fm.img_file.value && fm.img_alt.value.trim())],
        ["2 or more sources", fm.sources.value.split("\n").filter((l) => l.includes("|")).length >= 2],
        [`Key takeaways for AI (${tk})`, tk >= 3],
        [`FAQ for AI (${faqN})`, faqN >= 3],
      ];
      const ok = checks.filter(([, v]) => v).length, score = Math.round((ok / checks.length) * 100);
      $("[data-score]").textContent = score;
      const fg = $("[data-ring-fg]"); fg.style.strokeDasharray = `${score} 100`; fg.style.stroke = score >= 80 ? "var(--green)" : score >= 50 ? "var(--accent)" : "var(--red)";
      $("[data-checks]").innerHTML = checks.map(([t, v]) => `<li class="${v ? "ok" : ""}">${icon(v ? "check" : "alert")}<span>${esc(t)}</span></li>`).join("");
      const slug = isNew ? slugify(fm.slug.value || fm.title.value) : p.slug;
      $("[data-serp]").innerHTML = `<small>sportscontentplaybook.com › blog › ${esc(slug || "…")}</small><b>${esc(mt || "Your title")}</b><p>${esc(md || "Write a meta description: it's the text under the link on Google.")}</p>`;
      for (const k of ["meta_title", "meta_description"]) { const v = fm[k].value.trim().length, [a, b] = k === "meta_title" ? [30, 60] : [120, 160]; const el = $(`[data-len="${k}"]`); el.textContent = `${v} / ${b}`; el.className = `bl-len ${v >= a && v <= b ? "ok" : v ? "warn" : ""}`; }
    }
    audit();
    fm.addEventListener("input", (e) => { if (isNew && e.target.name === "title") fm.slug.value = slugify(fm.title.value); audit(); });
    // tabs
    main.querySelectorAll("[data-etab]").forEach((b) => b.addEventListener("click", () => {
      main.querySelectorAll("[data-etab]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      main.querySelectorAll("[data-epane]").forEach((x) => { x.hidden = x.dataset.epane !== b.dataset.etab; });
    }));
    // text toolbar: wrap the selection in the tag (no HTML needed)
    const ta = fm.body_html;
    main.querySelector(".bl-tb").addEventListener("click", (e) => {
      const v = e.target.closest("[data-view]");
      if (v) { const prev = v.dataset.view === "prev"; main.querySelectorAll("[data-view]").forEach((x) => x.setAttribute("aria-pressed", String(x === v))); ta.hidden = prev; const pv = $("[data-prev]"); pv.hidden = !prev; if (prev) pv.innerHTML = ta.value; return; }
      const w = e.target.closest("[data-wrap]"); if (!w) return;
      const tag = w.dataset.wrap, [a, b] = [ta.selectionStart, ta.selectionEnd], sel = ta.value.slice(a, b) || "text";
      let out;
      if (tag === "a") out = `<a href="https://">${sel}</a>`;   // then replace https:// with the link
      else if (tag === "ul") out = `<ul>\n${sel.split("\n").map((l) => `  <li>${l}</li>`).join("\n")}\n</ul>`;
      else out = `<${tag}>${sel}</${tag}>`;
      ta.setRangeText(out, a, b, "end"); ta.focus(); audit();
    });
    // FAQ rows
    main.querySelector("[data-faq-add]").addEventListener("click", () => { $("[data-faq]").insertAdjacentHTML("beforeend", faqRow()); audit(); });
    $("[data-faq]").addEventListener("click", (e) => { if (e.target.closest("[data-faq-del]")) { e.target.closest(".bl-faq-row").remove(); audit(); } });
    fm.querySelector("[data-cover-file]").addEventListener("change", async (e) => {
      const file = e.target.files[0]; e.target.value = ""; if (!file) return;
      const slug = fm.slug.value || slugify(fm.title.value) || "post";
      const name = `${slug}-${Date.now()}.${(file.name.split(".").pop() || "jpg").toLowerCase()}`;
      const { error } = await A.db.storage.from("blog").upload(name, file, { contentType: file.type, upsert: true });
      if (error) return fail(/policy|row-level|not found/i.test(error.message) ? new Error("Run supabase/admin-content.sql in Supabase first.") : error);
      fm.img_file.value = name; fm.img_url.value = A.db.storage.from("blog").getPublicUrl(name).data.publicUrl;
      $("[data-cover]").innerHTML = `<img src="${esc(fm.img_url.value)}" alt="">`;
      audit(); A.toast("Cover uploaded. Save to keep it.");
    });
    const parseLines = (v) => v.split("\n").map((l) => l.split("|").map((x) => x.trim())).filter(([nm, u]) => nm && u).map(([name, url]) => ({ name, url }));
    $("[data-save]").addEventListener("click", async () => {
      const slug = isNew ? slugify(fm.slug.value || fm.title.value) : p.slug;
      if (!fm.title.value.trim() || !slug) return fail(new Error("The post needs a title."));
      if (isNew && posts.some((x) => x.slug === slug)) return fail(new Error("There's already a post with that URL."));
      const faqList = [...fm.querySelectorAll(".bl-faq-row")].map((r) => ({ q: r.querySelector("[name=faq_q]").value.trim(), a: r.querySelector("[name=faq_a]").value.trim() })).filter((f) => f.q && f.a);
      const data = { ...d, slug, type: fm.type.value, date: fm.date.value, author: fm.author.value.trim(), title: fm.title.value.trim(),
        meta_title: fm.meta_title.value.trim(), meta_description: fm.meta_description.value.trim(), primary_keyword: fm.primary_keyword.value.trim(),
        keywords: fm.keywords.value.split("\n").map((k) => k.trim()).filter(Boolean), excerpt: fm.excerpt.value.trim(), cta_title: fm.cta_title.value.trim(), cta_text: fm.cta_text.value.trim(),
        takeaways: fm.takeaways.value.split("\n").map((t) => t.trim()).filter(Boolean), faq: faqList, author_bio: fm.author_bio.value.trim(), ...(fm.updated.value ? { updated: fm.updated.value } : {}),
        image: { ...img, file: fm.img_file.value, alt: fm.img_alt.value.trim(), title: fm.img_title.value.trim(), credit: { ...cred, author: fm.img_author.value.trim(), source_url: fm.img_source.value.trim() },
          ...(fm.img_url.value ? { url: fm.img_url.value } : {}) },
        sources: parseLines(fm.sources.value), references: parseLines(fm.references.value), body_html: fm.body_html.value };
      if (!data.image.url) delete data.image.url;
      if (!fm.updated.value) delete data.updated;
      const row = { slug, data, draft: fm.draft.checked, updated_at: new Date().toISOString(), publish_error: null };
      const { error } = await A.db.from("blog_posts").upsert(row, { onConflict: "slug" });
      if (error) return fail(error);
      A.toast(fm.draft.checked ? "Saved as a draft" : "Saved — on the website within the hour");
      const { data: fresh } = await A.db.from("blog_posts").select("slug,data,draft,updated_at,published_at,publish_error").order("updated_at", { ascending: false });
      posts = fresh || posts; editor(posts.find((x) => x.slug === slug));
    });
    $("[data-back]").addEventListener("click", (e) => { e.preventDefault(); list(); });
  }

  main.addEventListener("click", async (e) => {
    if (e.target.closest("[data-new]")) return editor(null);
    const t = e.target.closest("[data-tab]"); if (t) { view.tab = t.dataset.tab; return drawList(); }
    const dr = e.target.closest("[data-draft]");
    if (dr) {   // publish / back to draft right from the card
      const p = posts.find((x) => x.slug === dr.dataset.draft);
      const { error } = await A.db.from("blog_posts").update({ draft: !p.draft, updated_at: new Date().toISOString(), publish_error: null }).eq("slug", p.slug);
      if (error) return fail(error);
      A.toast(p.draft ? "On the website within the hour" : "Back to draft — it leaves the website within the hour");
      return list();
    }
    if (e.target.closest("a")) return;
    const card = e.target.closest("[data-open], .bl-card[data-slug]");
    if (card) editor(posts.find((x) => x.slug === (card.dataset.open || card.dataset.slug)));
  });
  main.addEventListener("input", (e) => {
    if (!e.target.matches("[data-q]")) return;
    view.q = e.target.value; const pos = e.target.selectionStart; drawList();
    const q = main.querySelector("[data-q]"); q.focus(); q.setSelectionRange(pos, pos);
  });
  list();
})();
