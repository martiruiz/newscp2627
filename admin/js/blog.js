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
    // the post open in the URL (#post=slug) stays open after a refresh
    const open = decodeURIComponent((location.hash.match(/^#post=(.+)$/) || [])[1] || "");
    if (open === "new") return editor(null);
    if (open && posts.some((x) => x.slug === open)) return editor(posts.find((x) => x.slug === open));
    history.replaceState(null, "", location.pathname + location.search);
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
    history.replaceState(null, "", `#post=${p ? encodeURIComponent(p.slug) : "new"}`);
    let isNew = !p; const d = p?.data || { type: "ideas", date: new Date().toISOString().slice(0, 10), author: "Martí Ruiz", keywords: [], sources: [], references: [], image: { credit: {} }, faq: [], takeaways: [] };
    const img = d.image || {}, cred = img.credit || {};
    const lines = (arr) => (arr || []).map((x) => `${x.name} | ${x.url}`).join("\n");
    const takeawaysOf = (v) => (Array.isArray(v) ? v : String(v || "").split("\n")).filter(Boolean).join("\n");
    const [s, c] = p ? status(p) : ["New", ""];
    const faqRow = (f = {}) => `<div class="bl-faq-row"><input class="input" name="faq_q" value="${esc(f.q || "")}" placeholder="Question people ask (e.g. How often should a club post on TikTok?)"><textarea class="input" name="faq_a" rows="2" placeholder="Short, direct answer (2–3 sentences)">${esc(f.a || "")}</textarea><button type="button" class="icon-btn" data-faq-del title="Remove" aria-label="Remove">${icon("trash")}</button></div>`;
    main.innerHTML = `<div class="page-head bl-ed-head"><div class="bl-eh">
        <nav class="bl-eh-crumb"><a href="#" data-back class="bl-eh-back" aria-label="Back to the blog">${icon("chevron")}</a><a href="#" data-back>Blog</a><span>/</span><span>${esc((TYPES[d.type] || "").split(" · ")[0] || "Post")}</span></nav>
        <h1>${esc(isNew ? "New post" : d.title)}</h1>
        <div class="bl-eh-meta"><span class="bl-st ${c}" data-st>${esc(s)}</span>${d.date ? `<span>${icon("edit")}${esc(new Date(`${d.date}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }))}</span>` : ""}${d.author ? `<span>${icon("account")}${esc(d.author)}</span>` : ""}${!isNew ? `<span class="mono">/blog/${esc(p.slug)}</span>` : ""}</div>
      </div>
      <div class="head-actions">${!isNew && !p.draft && p.published_at ? `<a class="btn" href="../blog/${esc(p.slug)}.html" target="_blank" rel="noopener">${icon("eye")}See it on the website</a>` : ""}<span class="seo-saved muted" data-saved>${isNew ? "Saved automatically once it has a title" : ""}</span></div></div>
      ${p?.publish_error ? `<div class="bl-err">${icon("alert")}<div><b>The last publish failed — fix this and save again</b><pre>${esc(p.publish_error)}</pre></div></div>` : ""}
      <div class="bl-ed">
        <form class="bl-form" data-form>
          <div class="bl-ed-tabs" role="tablist">
            <button type="button" role="tab" data-etab="content" aria-selected="true">${icon("edit")}Content</button>
            <button type="button" role="tab" data-etab="cover" aria-selected="false">${icon("eye")}Cover</button>
            <button type="button" role="tab" data-etab="seo" aria-selected="false">${icon("sparkles")}SEO &amp; AI</button>
            <button type="button" role="tab" data-etab="sources" aria-selected="false">${icon("external")}Sources</button>
          </div>
          <div class="bl-sec bl-panes" data-epane="content">
          <section class="panel panel-pad bl-ecard">
            <h3 class="bl-card-h"><span class="bl-n">1</span>The basics <small class="muted">What readers and Google see first</small></h3>
            <label class="bl-big">Title<input class="input" name="title" value="${esc(d.title || "")}" required placeholder="A clear title with your main keyword"></label>
            <div class="bl-row"><label>Type<select class="select" name="type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}"${d.type === k ? " selected" : ""}>${esc(v)}</option>`).join("")}</select></label>
              <label>Date<input class="input" type="date" name="date" value="${esc(d.date || "")}"></label>
              <label>URL<input class="input" name="slug" value="${esc(p?.slug || "")}" ${isNew ? "" : "readonly"} placeholder="made from the title"></label></div>
            <label>Excerpt <small class="muted">2 lines shown on the blog list.</small><textarea class="input" name="excerpt" rows="2">${esc(d.excerpt || "")}</textarea></label>
          </section>
          <section class="panel bl-ecard bl-card-art">
            <h3 class="bl-card-h"><span class="bl-n">2</span>The article <small class="muted" data-wc></small></h3>
            <div class="bl-text">
              <div class="bl-tb" role="toolbar" aria-label="Text">
                <span class="bl-tb-g"><button type="button" data-cmd="undo" title="Undo">${icon("undo")}</button><button type="button" data-cmd="redo" title="Redo" class="bl-redo">${icon("undo")}</button></span>
                <span class="bl-tb-g"><button type="button" data-block="p" title="Normal text">Text</button><button type="button" data-block="h2" title="Subtitle">H2</button><button type="button" data-block="h3" title="Small subtitle">H3</button><button type="button" data-block="blockquote" title="Quote">“ ”</button></span>
                <span class="bl-tb-g"><button type="button" data-cmd="bold" title="Bold"><b>B</b></button><button type="button" data-cmd="italic" title="Italic"><i>I</i></button><button type="button" data-cmd="removeFormat" title="Clear formatting">T<sub>×</sub></button></span>
                <span class="bl-tb-g"><button type="button" data-cmd="insertUnorderedList" title="Bullet list">• List</button><button type="button" data-cmd="insertOrderedList" title="Numbered list">1. List</button></span>
                <span class="bl-tb-g"><button type="button" data-link title="Add a link">${icon("external")}Link</button><button type="button" data-cmd="unlink" title="Remove the link">Unlink</button><button type="button" data-embed-add title="Show a social post (Instagram, TikTok, YouTube, X)">${icon("plus")}Social post</button></span>
                <span class="bl-tb-sp"></span><span class="bl-tb-g"><button type="button" data-view="edit" aria-pressed="true">Visual</button><button type="button" data-view="html" aria-pressed="false">HTML</button></span>
              </div>
              <div class="bl-rte" contenteditable="true" data-rte spellcheck="true"></div>
              <textarea class="input mono" name="body_html" rows="24" data-body hidden>${esc(d.body_html || "")}</textarea>
            </div>
          </section>
            <label class="check-inline bl-draft"><input type="checkbox" name="draft"${p?.draft || isNew ? " checked" : ""}> Draft — not on the website yet</label>
          </div>
          <div class="bl-sec bl-panes" data-epane="cover" hidden>
          <section class="panel panel-pad bl-ecard">
            <h3 class="bl-card-h"><span class="bl-n">1</span>The cover <small class="muted">Shown at the top of the article, on Google and when the link is shared</small></h3>
            <div class="bl-cv">
              <label class="bl-cv-img" data-cover title="Change the cover">${img.file ? `<img src="${esc(img.url || `../assets/blog/${img.file}`)}" alt="" data-cv-pic>` : ""}
                <span class="bl-cv-drop">${icon("import")}<b>${img.file ? "Change the cover" : "Upload the cover"}</b><small>JPG, PNG or WebP · it's cropped to 1200×630 and made light for you</small></span>
                <input type="file" accept="image/png,image/jpeg,image/webp" hidden data-cover-file></label>
              <div class="bl-cv-side">
                <div class="bl-cv-prev"><small class="bl-cv-k">${icon("search")}Google Images</small><div class="bl-gimg"><span class="bl-gimg-pic" data-cv-thumb></span><div><b data-cv-gt></b><small>sportscontentplaybook.com</small></div></div></div>
                <div class="bl-cv-prev"><small class="bl-cv-k">${icon("external")}When shared (WhatsApp, LinkedIn, X…)</small><div class="bl-share"><span class="bl-share-pic" data-cv-thumb></span><div><small>sportscontentplaybook.com</small><b data-cv-st></b><p data-cv-sd></p></div></div></div>
              </div>
            </div>
            <input type="hidden" name="img_file" value="${esc(img.file || "")}"><input type="hidden" name="img_url" value="${esc(img.url || "")}">
          </section>
          <section class="panel panel-pad bl-ecard">
            <h3 class="bl-card-h"><span class="bl-n">2</span>Image SEO <small class="muted">How Google Images and AI assistants understand the picture</small></h3>
            <ul class="bl-checks bl-cv-checks" data-cv-checks></ul>
            <label>Describe the image (alt text) <span class="bl-len" data-len="img_alt"></span><small class="muted bl-sub">What's in the picture, for Google Images and screen readers. 50–125 characters, with your main keyword if it fits.</small><textarea class="input" name="img_alt" rows="2" maxlength="200">${esc(img.alt || "")}</textarea></label>
            <label>Image title <small class="muted bl-sub">A short name for the picture (shown when hovering it).</small><input class="input" name="img_title" value="${esc(img.title || "")}"></label>
          </section>
          <section class="panel panel-pad bl-ecard">
            <h3 class="bl-card-h"><span class="bl-n">3</span>Credit <small class="muted">Always cite who made the photo</small></h3>
            <div class="bl-row"><label>Credit<input class="input" name="img_author" value="${esc(cred.author || "")}" placeholder="Photographer / AI-generated…"></label><label>Credit link<input class="input" name="img_source" value="${esc(cred.source_url || "")}"></label></div>
          </section>
          </div>
          <div class="bl-sec bl-panes" data-epane="seo" hidden>
          <section class="panel panel-pad bl-ecard">
            <h3 class="bl-card-h"><span class="bl-n">1</span>Google <small class="muted">The blue link and the grey text people see when they search</small></h3>
            <label><span class="bl-lh"><span>Meta title</span><span class="bl-len" data-len="meta_title"></span></span><input class="input" name="meta_title" value="${esc(d.meta_title || "")}" maxlength="80" placeholder="What shows as the blue link on Google (30–60 characters)"></label>
            <label><span class="bl-lh"><span>Meta description</span><span class="bl-len" data-len="meta_description"></span></span><textarea class="input" name="meta_description" rows="3" maxlength="200" placeholder="The grey text under the link (120–160 characters): what the reader gets">${esc(d.meta_description || "")}</textarea></label>
          </section>
          <section class="panel panel-pad bl-ecard">
            <h3 class="bl-card-h"><span class="bl-n">2</span>Keywords <small class="muted">The searches this article should appear for</small></h3>
            <label>Main keyword <small class="muted bl-sub">The search you want to rank for. It should be in the title, the first paragraph and a subtitle.</small><input class="input bl-kw-main" name="primary_keyword" value="${esc(d.primary_keyword || "")}"></label>
            <div class="bl-kws-h"><span>Site keywords <small class="muted" data-kw-count></small></span><button type="button" class="btn btn-ghost btn-sm" data-kw-edit>${icon("edit")}Edit the list</button></div>
            <div class="bl-kws" data-kw-chips></div>
            <textarea class="input" name="keywords" rows="8" hidden placeholder="One per line">${esc((d.keywords || []).join("\n"))}</textarea>
          </section>
          <section class="panel panel-pad bl-ecard">
            <h3 class="bl-card-h"><span class="bl-n">3</span>AI assistants <small class="muted">ChatGPT, Perplexity, Gemini, Claude… quote short, clear, well-sourced text</small></h3>
            <label>Key takeaways <small class="muted bl-sub">3–5 short sentences, one per line. Shown at the top of the article.</small><textarea class="input" name="takeaways" rows="5" placeholder="Clubs that post episodic series get more returning viewers.">${esc(takeawaysOf(d.takeaways))}</textarea></label>
            <div class="bl-faq"><span class="bl-faq-h">Frequently asked questions <small class="muted bl-sub">3 or more. The questions people type into Google or ask an AI.</small></span>
              <div data-faq>${(d.faq || []).map(faqRow).join("") || faqRow()}</div>
              <button type="button" class="btn btn-ghost btn-sm" data-faq-add>${icon("plus")}Add a question</button></div>
          </section>
          <section class="panel panel-pad bl-ecard">
            <h3 class="bl-card-h"><span class="bl-n">4</span>Author <small class="muted">Who writes it and when it was updated — trust for Google and AI (E-E-A-T)</small></h3>
            <div class="bl-row"><label>Author<input class="input" name="author" value="${esc(d.author || "")}"></label><label>Last updated<input class="input" type="date" name="updated" value="${esc(d.updated || "")}"></label></div>
            <label>About the author <small class="muted bl-sub">One line of experience.</small><input class="input" name="author_bio" value="${esc(d.author_bio || "")}" placeholder="Founder of Sports Content Playbook. 10 years running social media for sports clubs."></label>
          </section>
          </div>
          <div class="bl-sec bl-panes" data-epane="sources" hidden>
          <section class="panel panel-pad bl-ecard">
            <h3 class="bl-card-h"><span class="bl-n">1</span>Sources <small class="muted">Where the facts come from — cited sources build trust with Google and AI</small><span class="bl-cnt" data-cnt="sources"></span></h3>
            <div class="bl-links" data-links="sources"></div>
            <button type="button" class="btn btn-ghost btn-sm bl-add" data-link-add="sources">${icon("plus")}Add a source</button>
            <textarea name="sources" hidden>${esc(lines(d.sources))}</textarea>
          </section>
          <section class="panel panel-pad bl-ecard">
            <h3 class="bl-card-h"><span class="bl-n">2</span>Posts shown in the article <small class="muted">Every post the article talks about must be shown in it (Content → Social post)</small><span class="bl-cnt" data-cnt="references"></span></h3>
            <div class="bl-links" data-links="references"></div>
            <button type="button" class="btn btn-ghost btn-sm bl-add" data-link-add="references">${icon("plus")}Add a post</button>
            <textarea name="references" hidden>${esc(lines(d.references))}</textarea>
          </section>
          <section class="panel panel-pad bl-ecard">
            <h3 class="bl-card-h"><span class="bl-n">3</span>Call to action <small class="muted">The box in the middle of the article</small></h3>
            <div class="bl-cta-ed">
              <div class="bl-cta-f">
                <label>CTA title<input class="input" name="cta_title" value="${esc(d.cta_title || "")}" placeholder="Find your next winning post in seconds"></label>
                <label>CTA text<textarea class="input" name="cta_text" rows="4" placeholder="Browse thousands of proven sports posts filtered by sport, format, platform and performance — updated every day.">${esc(d.cta_text || "")}</textarea></label>
              </div>
              <aside class="bl-cta-prev" aria-label="Preview"><small class="bl-cv-k">${icon("eye")}How it looks in the article</small>
                <div class="bl-cta-box"><p class="k">Sports Content Playbook</p><b data-cta-t></b><p data-cta-x></p><span class="bl-cta-btns"><i>Try It For Free</i><i>Book a 30-min demo</i></span></div></aside>
            </div>
          </section>
          </div>
        </form>
        <aside class="bl-side">
          <div class="panel bl-side-card"><span class="bl-st ${c}" data-st>${esc(s)}</span>${p?.published_at ? `<small class="muted">Published ${day(p.published_at)}</small>` : ""}<small class="muted">${isNew ? "Not saved yet" : `Saved ${day(p.updated_at)}`}</small></div>
          <div class="panel bl-side-card"><div class="bl-score"><div class="bl-ring" data-ring><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.9" class="bg"/><circle cx="18" cy="18" r="15.9" class="fg" data-ring-fg/></svg><b data-score>0</b></div><div><b>SEO score</b><small class="muted">Google + AI assistants</small></div></div>
            <button type="button" class="btn btn-primary btn-sm bl-improve" data-improve hidden>${icon("sparkles")}Improve with AI</button>
            <ul class="bl-checks" data-checks></ul></div>
          <div class="panel bl-side-card"><b class="bl-side-h">${icon("search")}How it looks on Google</b><div class="bl-serp" data-serp></div></div>
        </aside>
      </div>`;
    const fm = $("[data-form]");
    let lastChecks = [], missingKw = [];
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
      // [text, passes, what the AI can fix ("" = needs you)]
      const checks = [
        ["Main keyword chosen", !!kw, "primary_keyword"],
        ["Keyword in the title", kw && fm.title.value.toLowerCase().includes(kw), "title"],
        ["Keyword in the first paragraph", kw && first.includes(kw), "first_paragraph_html"],
        ["Keyword in a subtitle (H2/H3)", kw && subs.some((t) => t.includes(kw)), "subtitle"],
        [`Meta title 30–60 characters (${mt.length})`, mt.length >= 30 && mt.length <= 60, "meta_title"],
        [`Meta description 120–160 characters (${md.length})`, md.length >= 120 && md.length <= 160, "meta_description"],
        [`Length ${n.toLocaleString("es-ES")} words · ${lo}–${hi}`, n >= lo && n <= hi, ""],
        [`Keywords in the text ${kwIn}/${kws.length || 15}`, kws.length >= 15 && kwIn === kws.length, kws.length ? "extra_paragraph_html" : ""],
        ["Cover with alt text", !!(fm.img_file.value && fm.img_alt.value.trim()), fm.img_file.value ? "image_alt" : ""],
        ["2 or more sources", fm.sources.value.split("\n").filter((l) => l.includes("|")).length >= 2, ""],
        [`Key takeaways for AI (${tk})`, tk >= 3, "takeaways"],
        [`FAQ for AI (${faqN})`, faqN >= 3, "faq"],
      ];
      lastChecks = checks; missingKw = kws.filter((k) => !text.includes(k));
      const kwRaw = fm.keywords.value.split("\n").map((k) => k.trim()).filter(Boolean);
      $("[data-kw-chips]").innerHTML = kwRaw.map((k) => `<span class="bl-kwc${text.includes(k.toLowerCase()) ? " ok" : ""}${k.toLowerCase() === kw ? " main" : ""}">${icon(text.includes(k.toLowerCase()) ? "check" : "alert")}${esc(k)}</span>`).join("") || `<span class="muted">No keywords yet.</span>`;
      $("[data-kw-count]").textContent = `${kwIn} / ${kwRaw.length} in the text`;
      $("[data-improve]").hidden = !checks.some(([, v, f]) => !v && f);
      const ok = checks.filter(([, v]) => v).length, score = Math.round((ok / checks.length) * 100);
      $("[data-score]").textContent = score;
      const fg = $("[data-ring-fg]"); fg.style.strokeDasharray = `${score} 100`; fg.style.stroke = score >= 80 ? "var(--green)" : score >= 50 ? "var(--accent)" : "var(--red)";
      $("[data-checks]").innerHTML = checks.map(([t, v]) => `<li class="${v ? "ok" : ""}">${icon(v ? "check" : "alert")}<span>${esc(t)}</span></li>`).join("");
      const slug = isNew ? slugify(fm.slug.value || fm.title.value) : p.slug;
      $("[data-serp]").innerHTML = `<small>sportscontentplaybook.com › blog › ${esc(slug || "…")}</small><b>${esc(mt || "Your title")}</b><p>${esc(md || "Write a meta description: it's the text under the link on Google.")}</p>`;
      for (const k of ["meta_title", "meta_description"]) { const v = fm[k].value.trim().length, [a, b] = k === "meta_title" ? [30, 60] : [120, 160]; const el = $(`[data-len="${k}"]`); el.textContent = `${v} / ${b}`; el.className = `bl-len ${v >= a && v <= b ? "ok" : v ? "warn" : ""}`; }
      if (autosave) later();
    }
    // saved on its own 1.5 s after the last change (a new post once it has a title)
    let autosave = false, timer = null;
    const later = () => { if (!fm.title.value.trim()) return; clearTimeout(timer); timer = setTimeout(() => { timer = null; save(true); }, 1500); };
    audit();
    fm.addEventListener("input", (e) => { if (isNew && e.target.name === "title") fm.slug.value = slugify(fm.title.value); audit(); });
    // tabs
    main.querySelectorAll("[data-etab]").forEach((b) => b.addEventListener("click", () => {
      main.querySelectorAll("[data-etab]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      main.querySelectorAll("[data-epane]").forEach((x) => { x.hidden = x.dataset.epane !== b.dataset.etab; });
    }));
    // the article: a visual editor (what you see is the article) synced with the HTML the blog is built from.
    // Social posts (<div class="embed">) and screenshots (<div class="shot">) show as blocks you can move or delete.
    const ta = fm.body_html, rte = $("[data-rte]");
    const NET = (u) => (/instagram/.test(u) ? "Instagram" : /tiktok/.test(u) ? "TikTok" : /youtu/.test(u) ? "YouTube" : /twitter|x\.com/.test(u) ? "X" : "Post");
    const chip = (el) => { el.setAttribute("contenteditable", "false"); el.classList.add("bl-chip"); const u = el.dataset.embed || el.dataset.sourceUrl || "";
      el.innerHTML = `<b>${el.classList.contains("shot") ? "Screenshot" : `${NET(u)} post`}</b><span>${esc(el.dataset.caption || u)}</span><button type="button" data-chip-del title="Remove">×</button>`; };
    const toRte = () => { rte.innerHTML = ta.value; rte.querySelectorAll("div.embed, div.shot").forEach(chip); wc(); };
    const attr = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    const fromRte = () => {
      const c = rte.cloneNode(true);
      c.querySelectorAll("div.embed").forEach((el) => { el.outerHTML = `<div class="embed" data-embed="${attr(el.dataset.embed)}"${el.dataset.caption ? ` data-caption="${attr(el.dataset.caption)}"` : ""}></div>`; });
      c.querySelectorAll("div.shot").forEach((el) => { el.outerHTML = `<div class="shot" data-src="${attr(el.dataset.src)}" data-alt="${attr(el.dataset.alt)}" data-source-url="${attr(el.dataset.sourceUrl)}"${el.dataset.caption ? ` data-caption="${attr(el.dataset.caption)}"` : ""}></div>`; });
      c.querySelectorAll("b").forEach((el) => { const x = document.createElement("strong"); x.innerHTML = el.innerHTML; el.replaceWith(x); });
      c.querySelectorAll("i").forEach((el) => { const x = document.createElement("em"); x.innerHTML = el.innerHTML; el.replaceWith(x); });
      c.querySelectorAll("[style]").forEach((el) => el.removeAttribute("style"));
      c.querySelectorAll("div:not(.embed):not(.shot)").forEach((el) => { const x = document.createElement("p"); x.innerHTML = el.innerHTML; el.replaceWith(x); });
      ta.value = c.innerHTML.replace(/<p><br><\/p>/g, "").replace(/(<\/(?:p|h2|h3|ul|ol|blockquote|div)>)(?!\n)/g, "$1\n").trim();
    };
    const wc = () => { const n = plain(ta.value).split(" ").filter(Boolean).length; $("[data-wc]").textContent = `${n.toLocaleString("es-ES")} words · ${Math.max(1, Math.round(n / 220))} min read`; };
    toRte();
    try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch {}
    rte.addEventListener("input", () => { fromRte(); wc(); audit(); });
    rte.addEventListener("click", (e) => { if (e.target.closest("[data-chip-del]")) { e.target.closest(".bl-chip").remove(); fromRte(); audit(); } });
    rte.addEventListener("paste", (e) => { e.preventDefault(); document.execCommand("insertText", false, e.clipboardData.getData("text/plain")); });   // no outside styles
    ta.addEventListener("input", () => { wc(); });
    const tb = main.querySelector(".bl-tb");
    tb.addEventListener("mousedown", (e) => { if (e.target.closest("button")) e.preventDefault(); });   // keep the text selection
    tb.addEventListener("click", async (e) => {
      const v = e.target.closest("[data-view]");
      if (v) { const html = v.dataset.view === "html"; if (!html) toRte(); tb.querySelectorAll("[data-view]").forEach((x) => x.setAttribute("aria-pressed", String(x === v))); ta.hidden = !html; rte.hidden = html; tb.classList.toggle("is-html", html); return; }
      if (!ta.hidden) return;
      const c = e.target.closest("[data-cmd]"), bl = e.target.closest("[data-block]");
      if (c) document.execCommand(c.dataset.cmd);
      else if (bl) document.execCommand("formatBlock", false, `<${bl.dataset.block}>`);
      else if (e.target.closest("[data-link]")) {
        const sel = window.getSelection(), range = sel.rangeCount ? sel.getRangeAt(0) : null;
        if (!range || range.collapsed || !rte.contains(range.commonAncestorContainer)) return A.toast("Select the words for the link first.", "err");
        const m = A.modal({ title: "Add a link", body: `<label>Link<input class="input" data-url type="url" placeholder="https://"></label>`, foot: `<button class="btn btn-primary" type="button" data-ok>Add</button>` });
        const inp = m.el.querySelector("[data-url]"); inp.focus();
        const ok = () => { const u = inp.value.trim(); if (!/^https?:\/\/|^[\w-]+\.html/.test(u)) return A.toast("Write a full link (https://…).", "err"); m.close(); sel.removeAllRanges(); sel.addRange(range); document.execCommand("createLink", false, u); fromRte(); audit(); };
        m.el.querySelector("[data-ok]").addEventListener("click", ok); inp.addEventListener("keydown", (k) => { if (k.key === "Enter") ok(); });
        return;
      } else if (e.target.closest("[data-embed-add]")) {
        const sel = window.getSelection(), range = sel.rangeCount && rte.contains(sel.getRangeAt(0).commonAncestorContainer) ? sel.getRangeAt(0) : null;
        const m = A.modal({ title: "Show a social post", sub: "Instagram, TikTok, YouTube or X. It appears where the cursor is.", body: `<label>Post link<input class="input" data-url type="url" placeholder="https://www.instagram.com/p/…"></label><label>Caption <small class="muted">Optional: club · what it is · results</small><input class="input" data-cap></label>`, foot: `<button class="btn btn-primary" type="button" data-ok>Add</button>` });
        m.el.querySelector("[data-ok]").addEventListener("click", () => {
          const u = m.el.querySelector("[data-url]").value.trim(), cap = m.el.querySelector("[data-cap]").value.trim();
          if (!/instagram\.com|tiktok\.com|youtube\.com|youtu\.be|twitter\.com|x\.com/.test(u)) return A.toast("Paste an Instagram, TikTok, YouTube or X link.", "err");
          m.close();
          const el = document.createElement("div"); el.className = "embed"; el.dataset.embed = u; if (cap) el.dataset.caption = cap; chip(el);
          const block = range && [...rte.children].find((x) => x.contains(range.startContainer));
          if (block) block.after(el); else rte.append(el);
          fromRte(); audit();
        });
        return;
      }
      fromRte(); audit();
    });
    // "Improve with AI": the AI fixes what it can of the failing checks; the admin reviews and saves
    $("[data-improve]").addEventListener("click", async (e) => {
      const btn = e.currentTarget, fix = [...new Set(lastChecks.filter(([, v, f]) => !v && f).map(([, , f]) => f))];
      if (!fix.length) return;
      btn.disabled = true; const label = btn.innerHTML; btn.innerHTML = `${icon("sparkles")}Improving…`;
      try {
        const subtitles = [...fm.body_html.value.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)].map((m) => plain(m[1]));
        const { data: r, error } = await A.db.functions.invoke("seo-improve", { body: { fix, site_keywords: fm.keywords.value.split("\n").map((k) => k.trim()).filter(Boolean),
          primary_keyword: fm.primary_keyword.value.trim(), missing_keywords: missingKw, title: fm.title.value, image_title: fm.img_title.value, meta_title: fm.meta_title.value, meta_description: fm.meta_description.value, body_html: fm.body_html.value, subtitles } });
        if (error || r?.error) throw new Error(r?.error || error.message);
        const done = [];
        const set = (k, v) => { if (fix.includes(k) && v) { fm[k].value = v; done.push(k); } };
        set("primary_keyword", r.primary_keyword); set("title", r.title); set("meta_title", r.meta_title); set("meta_description", r.meta_description);
        if (fix.includes("image_alt") && r.image_alt) { fm.img_alt.value = r.image_alt; done.push("image_alt"); }
        let body = fm.body_html.value;
        if (fix.includes("first_paragraph_html") && /^<p[\s>]/i.test(r.first_paragraph_html.trim())) body = body.replace(/<p[^>]*>[\s\S]*?<\/p>/i, r.first_paragraph_html.trim());
        if (fix.includes("subtitle") && r.subtitle_old && r.subtitle_new) body = body.replace(/(<h[23][^>]*>)([\s\S]*?)(<\/h[23]>)/gi, (all, a, inner, b) => (plain(inner) === r.subtitle_old.trim() ? `${a}${esc(r.subtitle_new)}${b}` : all));
        if (fix.includes("extra_paragraph_html") && /^<p[\s>]/i.test(r.extra_paragraph_html.trim())) { const at = body.lastIndexOf("<h2"); body = at > 0 ? `${body.slice(0, at)}${r.extra_paragraph_html.trim()}\n${body.slice(at)}` : `${body}\n${r.extra_paragraph_html.trim()}`; }
        fm.body_html.value = body; toRte();
        if (fix.includes("takeaways") && r.takeaways?.length) fm.takeaways.value = r.takeaways.join("\n");
        if (fix.includes("faq") && r.faq?.length) { const have = [...fm.querySelectorAll(".bl-faq-row")].filter((x) => x.querySelector("[name=faq_q]").value.trim()); $("[data-faq]").innerHTML = have.map((x) => x.outerHTML).join("") + r.faq.map(faqRow).join(""); }
        audit();
        const left = lastChecks.filter(([, v]) => !v).map(([t]) => t);
        if (!(await save())) return;   // applied and saved straight away
        A.toast(left.length ? `Improved and saved. Still for you: ${left.join(" · ")}` : "Improved to 100 and saved");
      } catch (x) { fail(x); }
      btn.disabled = false; btn.innerHTML = label;
    });
    $("[data-kw-edit]").addEventListener("click", (e) => { fm.keywords.hidden = !fm.keywords.hidden; e.currentTarget.lastChild.textContent = fm.keywords.hidden ? "Edit the list" : "Done"; if (!fm.keywords.hidden) fm.keywords.focus(); });
    const parseLines = (v) => v.split("\n").map((l) => l.split("|").map((x) => x.trim())).filter(([nm, u]) => nm && u).map(([name, url]) => ({ name, url }));
    // sources and posts: one row each (name + link), kept in the hidden "name | link" fields the blog is built from
    const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
    const PFN = (u) => (/instagram/.test(u) ? "instagram" : /tiktok/.test(u) ? "tiktok" : /youtu/.test(u) ? "youtube" : /twitter\.com|x\.com/.test(u) ? "x" : /facebook/.test(u) ? "facebook" : /linkedin/.test(u) ? "linkedin" : "");
    const linkRow = (kind, it = {}) => { const pf = kind === "references" ? PFN(it.url || "") : "";
      return `<div class="bl-link" data-row="${kind}"><span class="bl-link-av">${pf ? `<img src="../assets/pf-${pf}.svg" alt="">` : esc((host(it.url || "") || "?").slice(0, 1).toUpperCase())}</span>
        <div class="bl-link-f"><input class="input" data-k="name" value="${esc(it.name || "")}" placeholder="${kind === "sources" ? "Front Office Sports – the article's title" : "Chicago Cubs – Nine Innings to Love, Episode 1 (TikTok)"}"><input class="input mono" data-k="url" value="${esc(it.url || "")}" placeholder="https://…"></div>
        <span class="bl-link-st" data-st></span>
        <a class="icon-btn" href="${esc(it.url || "#")}" target="_blank" rel="noopener" title="Open" aria-label="Open" data-open>${icon("external")}</a>
        <button type="button" class="icon-btn" data-row-del title="Remove" aria-label="Remove">${icon("trash")}</button></div>`; };
    const drawLinks = (kind) => { const list = parseLines(fm[kind].value); $(`[data-links="${kind}"]`).innerHTML = list.map((it) => linkRow(kind, it)).join("") || `<p class="bl-empty muted">${kind === "sources" ? "No sources yet." : "No posts yet."}</p>`; linkState(); };
    const syncLinks = (kind) => { fm[kind].value = [...main.querySelectorAll(`[data-row="${kind}"]`)].map((r) => [r.querySelector('[data-k="name"]').value.trim(), r.querySelector('[data-k="url"]').value.trim()]).filter(([n, u]) => n || u).map(([n, u]) => `${n} | ${u}`).join("\n"); linkState(); audit(); };
    function linkState() {
      const body = fm.body_html.value.toLowerCase(), norm = (u) => u.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/twitter\.com/, "x.com").replace(/[?#].*$/, "").replace(/\/$/, "");
      for (const r of main.querySelectorAll("[data-row]")) {
        const u = r.querySelector('[data-k="url"]').value.trim(), ok = /^https?:\/\/\S+\.\S+/.test(u), st = r.querySelector("[data-st]");
        r.querySelector("[data-open]").href = ok ? u : "#";
        if (r.dataset.row === "references") { const shown = ok && body.replace(/twitter\.com/g, "x.com").includes(norm(u)); st.className = `bl-link-st ${shown ? "ok" : "warn"}`; st.innerHTML = shown ? `${icon("check")}In the article` : `${icon("alert")}Not in the article`; }
        else { st.className = `bl-link-st ${ok ? "ok" : u ? "warn" : ""}`; st.innerHTML = ok ? `${icon("check")}${esc(host(u))}` : u ? `${icon("alert")}Check the link` : ""; }
        const av = r.querySelector(".bl-link-av"); if (r.dataset.row === "sources") av.textContent = (host(u) || "?").slice(0, 1).toUpperCase();
      }
      for (const k of ["sources", "references"]) { const n = parseLines(fm[k].value).length; $(`[data-cnt="${k}"]`).textContent = n; $(`[data-cnt="${k}"]`).className = `bl-cnt ${k === "sources" ? (n >= 2 ? "ok" : "warn") : ""}`; }
      $("[data-cta-t]").textContent = fm.cta_title.value.trim() || fm.cta_title.placeholder;
      $("[data-cta-x]").textContent = fm.cta_text.value.trim() || fm.cta_text.placeholder;
    }
    drawLinks("sources"); drawLinks("references");
    main.querySelectorAll("[data-link-add]").forEach((b) => b.addEventListener("click", () => { const k = b.dataset.linkAdd, box = $(`[data-links="${k}"]`); box.querySelector(".bl-empty")?.remove(); box.insertAdjacentHTML("beforeend", linkRow(k)); box.lastElementChild.querySelector("input").focus(); }));
    main.querySelectorAll("[data-links]").forEach((box) => {
      box.addEventListener("input", () => syncLinks(box.dataset.links));
      box.addEventListener("click", (e) => { if (e.target.closest("[data-row-del]")) { e.target.closest("[data-row]").remove(); syncLinks(box.dataset.links); } });
    });
    fm.cta_title.addEventListener("input", linkState); fm.cta_text.addEventListener("input", linkState);
    // FAQ rows
    main.querySelector("[data-faq-add]").addEventListener("click", () => { $("[data-faq]").insertAdjacentHTML("beforeend", faqRow()); audit(); });
    $("[data-faq]").addEventListener("click", (e) => { if (e.target.closest("[data-faq-del]")) { e.target.closest(".bl-faq-row").remove(); audit(); } });
    // cover: cropped to 1200×630 and saved as a light JPEG with a descriptive file name (both count for image SEO)
    const cv = { w: 0, h: 0, kb: 0 };
    const crop = (file) => new Promise((ok, ko) => {
      const im = new Image(); im.onerror = () => ko(new Error("That image can't be read."));
      im.onload = () => { const c = document.createElement("canvas"); c.width = 1200; c.height = 630; const r = Math.max(1200 / im.width, 630 / im.height), w = im.width * r, h = im.height * r;
        c.getContext("2d").drawImage(im, (1200 - w) / 2, (630 - h) / 2, w, h); c.toBlob((b) => (b ? ok(b) : ko(new Error("That image can't be read."))), "image/jpeg", 0.84); URL.revokeObjectURL(im.src); };
      im.src = URL.createObjectURL(file);
    });
    const measure = async () => {
      const pic = $("[data-cv-pic]"); if (!pic) return;
      if (!pic.complete) await new Promise((r) => { pic.onload = r; pic.onerror = r; });
      cv.w = pic.naturalWidth; cv.h = pic.naturalHeight;
      try { const r = await fetch(pic.src, { method: "HEAD" }); cv.kb = Math.round(Number(r.headers.get("content-length") || 0) / 1024); } catch { cv.kb = 0; }
      coverAudit();
    };
    function coverAudit() {
      const kw = fm.primary_keyword.value.trim().toLowerCase(), alt = fm.img_alt.value.trim(), file = fm.img_file.value, src = fm.img_url.value || (file ? `../assets/blog/${file}` : "");
      const fileWords = file.replace(/\.\w+$/, "").replace(/-[a-z0-9]{6,}$/, "").replace(/^\d+$/, "");
      const checks = [
        ["A cover", !!file],
        [`Size 1200×630${cv.w ? ` (${cv.w}×${cv.h})` : ""}`, cv.w >= 1200 && Math.abs(cv.w / cv.h - 1200 / 630) < 0.03],
        [`Light file, under 300 KB${cv.kb ? ` (${cv.kb} KB)` : ""}`, cv.kb > 0 && cv.kb <= 300],
        ["File name in words (not IMG_1234)", /[a-z]{3,}-[a-z]{3,}/.test(fileWords)],
        [`Alt text 50–125 characters (${alt.length})`, alt.length >= 50 && alt.length <= 125],
        ["Main keyword in the alt text", !!kw && alt.toLowerCase().includes(kw)],
        ["Image title", !!fm.img_title.value.trim()],
        ["Credit with link", !!(fm.img_author.value.trim() && fm.img_source.value.trim())],
      ];
      $("[data-cv-checks]").innerHTML = checks.map(([t, v]) => `<li class="${v ? "ok" : ""}">${icon(v ? "check" : "alert")}<span>${esc(t)}</span></li>`).join("");
      main.querySelectorAll("[data-cv-thumb]").forEach((el) => { el.style.backgroundImage = src ? `url("${src}")` : ""; });
      $("[data-cv-gt]").textContent = fm.img_title.value.trim() || fm.title.value || "Image title";
      $("[data-cv-st]").textContent = (fm.meta_title.value || fm.title.value).trim() || "Your title";
      $("[data-cv-sd]").textContent = fm.meta_description.value.trim();
      const el = $('[data-len="img_alt"]'); el.textContent = alt.length ? `${alt.length} / 125` : ""; el.className = `bl-len ${alt.length >= 50 && alt.length <= 125 ? "ok" : alt.length ? "warn" : ""}`;
    }
    fm.addEventListener("input", coverAudit); measure(); coverAudit();
    fm.querySelector("[data-cover-file]").addEventListener("change", async (e) => {
      const file = e.target.files[0]; e.target.value = ""; if (!file) return;
      try {
        const blob = await crop(file);
        const base = slugify(fm.primary_keyword.value ? `${fm.slug.value || fm.title.value} ${fm.primary_keyword.value}` : fm.slug.value || fm.title.value).slice(0, 70).replace(/-+$/, "") || "sports-content";
        const name = `${base}-${Date.now().toString(36)}.jpg`;
        const { error } = await A.db.storage.from("blog").upload(name, blob, { contentType: "image/jpeg", upsert: true });
        if (error) throw /policy|row-level|not found/i.test(error.message) ? new Error("Run supabase/admin-content.sql in Supabase first.") : error;
        fm.img_file.value = name; fm.img_url.value = A.db.storage.from("blog").getPublicUrl(name).data.publicUrl;
        const box = $("[data-cover]"); box.querySelector("[data-cv-pic]")?.remove(); box.insertAdjacentHTML("afterbegin", `<img src="${esc(fm.img_url.value)}" alt="" data-cv-pic>`);
        box.querySelector(".bl-cv-drop b").textContent = "Change the cover";
        audit(); measure(); A.toast("Cover uploaded. Save to keep it.");
      } catch (x) { fail(x); }
    });
    async function save(quiet = false) {
      clearTimeout(timer); timer = null;
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
      if (error) { if (quiet) $("[data-saved]").textContent = ""; return fail(error); }
      if (quiet) {   // stay in the editor: just remember it's saved
        const old = posts.find((x) => x.slug === slug);
        p = { ...(old || {}), ...row }; posts = [p, ...posts.filter((x) => x.slug !== slug)];
        if (isNew) { isNew = false; fm.slug.value = slug; fm.slug.readOnly = true; history.replaceState(null, "", `#post=${encodeURIComponent(slug)}`); }
        const [st, cl] = status(p); main.querySelectorAll("[data-st]").forEach((x) => { x.textContent = st; x.className = `bl-st ${cl}`; });
        $("[data-saved]").innerHTML = `${icon("check")}Saved automatically · ${new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
        return true;
      }
      A.toast(fm.draft.checked ? "Saved as a draft" : "Saved — on the website within the hour");
      const { data: fresh } = await A.db.from("blog_posts").select("slug,data,draft,updated_at,published_at,publish_error").order("updated_at", { ascending: false });
      posts = fresh || posts; editor(posts.find((x) => x.slug === slug));
      return true;
    }
    main.querySelectorAll("[data-back]").forEach((b) => b.addEventListener("click", async (e) => { e.preventDefault(); if (timer) await save(true); history.replaceState(null, "", location.pathname + location.search); list(); }));
    autosave = true;
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
