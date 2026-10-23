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
  const words = (html) => String(html || "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").split(/\s+/).filter(Boolean).length;
  const day = (v) => (v ? new Date(v).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
  const status = (p) => p.draft ? ["Draft", ""] : p.publish_error ? ["Publish failed", "is-err"] : !p.published_at || new Date(p.updated_at) > new Date(p.published_at) ? ["Changes waiting to publish", "is-wait"] : ["Live on the website", "is-pub"];

  async function list() {
    const { data, error } = await A.db.from("blog_posts").select("slug,data,draft,updated_at,published_at,publish_error").order("updated_at", { ascending: false });
    if (error) { main.innerHTML = `<div class="page-head"><div><h1>Blog</h1></div></div><p class="panel panel-pad muted">${esc(/blog_posts|does not exist|schema cache/i.test(error.message) ? "Run supabase/admin-content.sql in Supabase first." : error.message)}</p>`; return; }
    posts = data || [];
    main.innerHTML = `<div class="page-head"><div><h1>Blog</h1><p>Write and edit the blog posts. Changes are published on the website within the hour.</p></div>
      <div class="head-actions"><a class="btn" href="${ACTIONS}" target="_blank" rel="noopener">${icon("external")}Publish now (GitHub)</a><button class="btn btn-primary" type="button" data-new>${icon("plus")}New post</button></div></div>
      <section class="panel ld-list"><header class="aud-h aud-h-lg"><h2>Posts</h2>${info("“Changes waiting to publish”: saved here, on the website within the hour (GitHub → Actions → Publish blog → Run workflow publishes now). “Publish failed”: a post didn't pass the blog's checks (words, keywords, cover…) and nothing was published — open it to see why.")}<span class="spacer"></span><b class="aud-count">${num(posts.length)}</b></header>
      ${posts.length ? `<div class="table-wrap"><table class="data bl-table"><thead><tr><th>Post</th><th>Type</th><th>Date</th><th>Status</th><th>Saved</th></tr></thead><tbody>
        ${posts.map((p) => { const [s, c] = status(p); return `<tr class="row-click" data-slug="${esc(p.slug)}">
          <td><div class="bl-post">${p.data.image?.file ? `<img src="${esc(p.data.image.url || `../assets/blog/${p.data.image.file}`)}" alt="" loading="lazy">` : `<span class="bl-noimg">${icon("file-text")}</span>`}<span><b>${esc(p.data.title || p.slug)}</b><small class="muted">/blog/${esc(p.slug)}.html</small></span></div></td>
          <td>${esc((TYPES[p.data.type] || p.data.type || "—").split(" · ")[0])}</td><td class="td-date">${esc(p.data.date || "—")}</td>
          <td><span class="bl-st ${c}">${s}</span></td><td class="td-date">${day(p.updated_at)}</td></tr>`; }).join("")}
        </tbody></table></div>` : `<p class="panel-pad muted">No posts yet.</p>`}</section>`;
  }

  // one post: every field of content/blog/<slug>.json
  function editor(p) {
    const isNew = !p, d = p?.data || { type: "ideas", date: new Date().toISOString().slice(0, 10), author: "Martí Ruiz", keywords: [], sources: [], references: [], image: { credit: {} } };
    const img = d.image || {}, cred = img.credit || {};
    const lines = (arr) => (arr || []).map((x) => `${x.name} | ${x.url}`).join("\n");
    const [s, c] = p ? status(p) : ["New", ""];
    main.innerHTML = `<div class="page-head"><div><a class="link" href="#" data-back>← Blog</a><h1>${esc(isNew ? "New post" : d.title)}</h1><p><span class="bl-st ${c}">${s}</span>${p?.published_at ? ` · published ${day(p.published_at)}` : ""}</p></div>
      <div class="head-actions">${!isNew && !p.draft ? `<a class="btn" href="../blog/${esc(p.slug)}.html" target="_blank" rel="noopener">${icon("external")}See it</a>` : ""}<button class="btn btn-primary" type="button" data-save>Save</button></div></div>
      ${p?.publish_error ? `<div class="bl-err">${icon("alert")}<div><b>The last publish failed</b><pre>${esc(p.publish_error)}</pre></div></div>` : ""}
      <form class="bl-form" data-form>
        <section class="panel panel-pad bl-sec"><h3>Post</h3>
          <label>Title<input class="input" name="title" value="${esc(d.title || "")}" required></label>
          <div class="bl-row"><label>URL (slug)<input class="input" name="slug" value="${esc(p?.slug || "")}" ${isNew ? "" : "readonly"} placeholder="from the title"></label>
            <label>Type<select class="select" name="type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}"${d.type === k ? " selected" : ""}>${esc(v)}</option>`).join("")}</select></label>
            <label>Date<input class="input" type="date" name="date" value="${esc(d.date || "")}"></label>
            <label>Author<input class="input" name="author" value="${esc(d.author || "")}"></label></div>
          <label>Excerpt <small class="muted">Shown on the blog grid.</small><textarea class="input" name="excerpt" rows="3">${esc(d.excerpt || "")}</textarea></label>
          <label class="check-inline"><input type="checkbox" name="draft"${p?.draft || isNew ? " checked" : ""}> Draft (not on the website)</label>
        </section>
        <section class="panel panel-pad bl-sec"><h3>Text <small class="muted" data-words></small></h3>
          <div class="bl-body"><label>HTML<textarea class="input mono" name="body_html" rows="24">${esc(d.body_html || "")}</textarea></label>
            <div class="bl-prev"><span class="muted">Preview</span><article class="bl-prev-in" data-prev></article></div></div>
        </section>
        <section class="panel panel-pad bl-sec"><h3>Cover</h3>
          <div class="bl-cover"><div class="bl-cover-img" data-cover>${img.file ? `<img src="${esc(img.url || `../assets/blog/${img.file}`)}" alt="">` : icon("file-text")}</div>
            <div class="bl-cover-f"><label class="btn btn-sm">${icon("import")}Upload cover (1200×630)<input type="file" accept="image/png,image/jpeg,image/webp" hidden data-cover-file></label>
              <input type="hidden" name="img_file" value="${esc(img.file || "")}"><input type="hidden" name="img_url" value="${esc(img.url || "")}">
              <label>Alt text<input class="input" name="img_alt" value="${esc(img.alt || "")}"></label>
              <label>Image title<input class="input" name="img_title" value="${esc(img.title || "")}"></label>
              <div class="bl-row"><label>Credit<input class="input" name="img_author" value="${esc(cred.author || "")}" placeholder="Photographer / AI-generated…"></label><label>Credit link<input class="input" name="img_source" value="${esc(cred.source_url || "")}"></label></div></div></div>
        </section>
        <section class="panel panel-pad bl-sec"><h3>SEO</h3>
          <label>Meta title<input class="input" name="meta_title" value="${esc(d.meta_title || "")}" maxlength="70"></label>
          <label>Meta description<textarea class="input" name="meta_description" rows="2" maxlength="170">${esc(d.meta_description || "")}</textarea></label>
          <label>Main keyword<input class="input" name="primary_keyword" value="${esc(d.primary_keyword || "")}"></label>
          <label>Keywords <small class="muted">One per line (the blog checks all 15 appear in the text).</small><textarea class="input" name="keywords" rows="8">${esc((d.keywords || []).join("\n"))}</textarea></label>
        </section>
        <section class="panel panel-pad bl-sec"><h3>Call to action and sources</h3>
          <label>CTA title<input class="input" name="cta_title" value="${esc(d.cta_title || "")}"></label>
          <label>CTA text<textarea class="input" name="cta_text" rows="2">${esc(d.cta_text || "")}</textarea></label>
          <label>Sources <small class="muted">One per line: name | link</small><textarea class="input" name="sources" rows="4">${esc(lines(d.sources))}</textarea></label>
          <label>References (posts shown) <small class="muted">One per line: name | link</small><textarea class="input" name="references" rows="4">${esc(lines(d.references))}</textarea></label>
        </section>
      </form>`;
    const fm = $("[data-form]");
    const prev = () => { $("[data-prev]").innerHTML = fm.body_html.value; const n = words(fm.body_html.value); $("[data-words]").textContent = `· ${num(n)} words`; };
    prev();
    fm.body_html.addEventListener("input", prev);
    if (isNew) fm.title.addEventListener("input", () => { fm.slug.value = slugify(fm.title.value); });
    fm.querySelector("[data-cover-file]").addEventListener("change", async (e) => {
      const file = e.target.files[0]; e.target.value = ""; if (!file) return;
      const slug = fm.slug.value || slugify(fm.title.value) || "post";
      const name = `${slug}-${Date.now()}.${(file.name.split(".").pop() || "jpg").toLowerCase()}`;
      const { error } = await A.db.storage.from("blog").upload(name, file, { contentType: file.type, upsert: true });
      if (error) return fail(/policy|row-level|not found/i.test(error.message) ? new Error("Run supabase/admin-content.sql in Supabase first.") : error);
      fm.img_file.value = name; fm.img_url.value = A.db.storage.from("blog").getPublicUrl(name).data.publicUrl;
      $("[data-cover]").innerHTML = `<img src="${esc(fm.img_url.value)}" alt="">`;
      A.toast("Cover uploaded. Save to keep it.");
    });
    const parseLines = (v) => v.split("\n").map((l) => l.split("|").map((x) => x.trim())).filter(([n, u]) => n && u).map(([name, url]) => ({ name, url }));
    $("[data-save]").addEventListener("click", async () => {
      const slug = isNew ? slugify(fm.slug.value || fm.title.value) : p.slug;
      if (!fm.title.value.trim() || !slug) return fail(new Error("The post needs a title."));
      if (isNew && posts.some((x) => x.slug === slug)) return fail(new Error("There's already a post with that URL."));
      const data = { ...d, slug, type: fm.type.value, date: fm.date.value, author: fm.author.value.trim(), title: fm.title.value.trim(),
        meta_title: fm.meta_title.value.trim(), meta_description: fm.meta_description.value.trim(), primary_keyword: fm.primary_keyword.value.trim(),
        keywords: fm.keywords.value.split("\n").map((k) => k.trim()).filter(Boolean), excerpt: fm.excerpt.value.trim(), cta_title: fm.cta_title.value.trim(), cta_text: fm.cta_text.value.trim(),
        image: { ...img, file: fm.img_file.value, alt: fm.img_alt.value.trim(), title: fm.img_title.value.trim(), credit: { ...cred, author: fm.img_author.value.trim(), source_url: fm.img_source.value.trim() },
          ...(fm.img_url.value ? { url: fm.img_url.value } : {}) },
        sources: parseLines(fm.sources.value), references: parseLines(fm.references.value), body_html: fm.body_html.value };
      if (!data.image.url) delete data.image.url;
      const row = { slug, data, draft: fm.draft.checked, updated_at: new Date().toISOString(), publish_error: null };
      const { error } = await A.db.from("blog_posts").upsert(row, { onConflict: "slug" });
      if (error) return fail(error);
      A.toast(fm.draft.checked ? "Saved as a draft" : "Saved — on the website within the hour");
      await list(); editor(posts.find((x) => x.slug === slug));
    });
    $("[data-back]").addEventListener("click", (e) => { e.preventDefault(); list(); });
  }

  main.addEventListener("click", (e) => {
    if (e.target.closest("[data-new]")) return editor(null);
    const row = e.target.closest("tr[data-slug]"); if (row) editor(posts.find((x) => x.slug === row.dataset.slug));
  });
  list();
})();
