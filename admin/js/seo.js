// SCP Admin — SEO: how Google and AI assistants see the website. Checks every public page (title, description, H1,
// canonical, social image, structured data), the 15 keywords against the blog, and keeps the settings the "Publish blog"
// Action writes into the site (supabase/seo.sql → content/seo.json → blog-tools/build.mjs): which AI crawlers may read
// it (robots.txt), the business card for Google and AI (Organization schema) and the llms.txt summary.
(async () => {
  const A = window.SCPA;
  const { $, esc, icon } = A;
  try { await A.boot("seo"); } catch { return; }
  const main = $("[data-main]");
  const fail = (e) => A.toast(e.message || String(e), "err");
  const SITE = "https://sportscontentplaybook.com";
  const PAGES = [["Home", "index.html"], ["Pricing", "pricing.html"], ["Blog", "blog.html"], ["Social News", "news.html"], ["Book a demo", "book-a-call.html"], ["Contact", "contact.html"], ["Sign up", "signup.html"]];
  // AI crawlers: the "search" ones decide whether the website is quoted in AI answers; the "training" ones only feed models
  const BOTS = [
    ["OAI-SearchBot", "ChatGPT search", "search"], ["ChatGPT-User", "ChatGPT reading a link", "search"], ["GPTBot", "OpenAI training", "train"],
    ["Claude-SearchBot", "Claude search", "search"], ["ClaudeBot", "Anthropic training", "train"], ["PerplexityBot", "Perplexity", "search"],
    ["Google-Extended", "Gemini training", "train"], ["Applebot-Extended", "Apple Intelligence", "train"], ["meta-externalagent", "Meta AI", "train"], ["CCBot", "Common Crawl (used by many AIs)", "train"],
  ];

  main.innerHTML = `<div class="page-head"><div><h1>SEO</h1><p>How Google and AI assistants (ChatGPT, Perplexity, Gemini, Claude) see the website, and what to improve.</p></div>
      <div class="head-actions"><button class="btn btn-primary" type="button" data-save>${icon("check")}Save settings</button></div></div>
    <div class="aud-kpis seo-kpis" data-kpis></div>
    <div class="nw-how">${icon("sparkles")}<span><b>Changes go live on their own</b> within the hour, with the blog: robots.txt, llms.txt and the home's structured data are rewritten from these settings.</span></div>
    <div class="seo-grid">
      <section class="panel panel-pad seo-card seo-wide"><h2>${icon("search")}Page check <small class="muted">What Google reads on each page</small></h2><div data-audit><p class="muted">Checking the pages…</p></div></section>
      <section class="panel panel-pad seo-card"><h2>${icon("sparkles")}AI assistants <small class="muted">Who can read the website</small></h2>
        <p class="bl-help">Keep the “search” ones on to be quoted in AI answers. Switching off a “training” one only stops that company using the texts to train its models.</p>
        <div class="seo-bots" data-bots></div></section>
      <section class="panel panel-pad seo-card"><h2>${icon("globe")}Your business for Google and AI <small class="muted">Organization schema + llms.txt</small></h2>
        <form class="seo-form" data-form>
          <label>Name<input class="input" name="org_name" placeholder="Sports Content Playbook"></label>
          <label>What SCP is, in one or two sentences <small class="muted">The description AI assistants use when they talk about you.</small><textarea class="input" name="description" rows="3" placeholder="The content platform for sports social media teams: thousands of real posts from clubs, leagues and brands, why they worked and a weekly content plan."></textarea></label>
          <div class="bl-row"><label>Contact email<input class="input" name="email" type="email" placeholder="hello@…"></label><label>Logo (link)<input class="input" name="logo" placeholder="${SITE}/assets/icon-logo-lg.png"></label></div>
          <label>Social profiles <small class="muted">One link per line (Instagram, LinkedIn, X, YouTube…). Google joins them to the brand.</small><textarea class="input" name="same_as" rows="4"></textarea></label>
          <label>More about SCP for AI (llms.txt) <small class="muted">Who it's for, what makes it different, prices… Plain sentences.</small><textarea class="input" name="llms_about" rows="5"></textarea></label>
        </form></section>
      <section class="panel panel-pad seo-card seo-wide"><h2>${icon("tag")}Keywords <small class="muted">The 15 searches the website wants to rank for</small></h2><div data-kw><p class="muted">Loading…</p></div></section>
      <section class="panel panel-pad seo-card seo-wide"><h2>${icon("external")}Files and tools</h2><div class="seo-files" data-files></div></section>
    </div>`;

  // ---------- settings ----------
  const fm = $("[data-form]");
  let settings = {}, ready = true;
  const { data: row, error: sErr } = await A.db.from("seo_settings").select("data").eq("id", 1).maybeSingle();
  if (sErr) { ready = false; main.querySelector(".nw-how").insertAdjacentHTML("afterend", `<div class="bl-err seo-err">${icon("alert")}<div><b>Run supabase/seo.sql in Supabase first</b><span class="muted">The settings can't be saved until then. The checks below already work.</span></div></div>`); }
  settings = row?.data || {};
  for (const k of ["org_name", "description", "email", "logo", "llms_about"]) fm[k].value = settings[k] || "";
  fm.same_as.value = (settings.same_as || []).join("\n");
  const bots = settings.bots || {};
  $("[data-bots]").innerHTML = BOTS.map(([b, who, kind]) => `<label class="seo-bot"><span><b>${esc(who)}</b><small class="muted">${esc(b)} · <i class="seo-kind is-${kind}">${kind === "search" ? "search" : "training"}</i></small></span>
    <span class="nw-sw"><input type="checkbox" data-bot="${esc(b)}"${bots[b] === false ? "" : " checked"}><span class="nw-sw-t"></span></span></label>`).join("");
  $("[data-save]").addEventListener("click", async () => {
    if (!ready) return fail(new Error("Run supabase/seo.sql in Supabase first."));
    const data = { ...settings, org_name: fm.org_name.value.trim(), description: fm.description.value.trim(), email: fm.email.value.trim(), logo: fm.logo.value.trim(), llms_about: fm.llms_about.value.trim(),
      same_as: fm.same_as.value.split("\n").map((l) => l.trim()).filter((l) => /^https?:\/\//.test(l)),
      bots: Object.fromEntries([...main.querySelectorAll("[data-bot]")].map((x) => [x.dataset.bot, x.checked])) };
    const { error } = await A.db.from("seo_settings").upsert({ id: 1, data, updated_at: new Date().toISOString() });
    if (error) return fail(error);
    settings = data; A.toast("Saved — live within the hour");
  });

  // ---------- page check: reads the published pages like a crawler ----------
  const { data: posts } = await A.db.from("blog_posts").select("slug,data,draft").eq("draft", false);
  const pages = PAGES.concat((posts || []).map((p) => [p.data?.title || p.slug, `blog/${p.slug}.html`, p]));
  const audits = await Promise.all(pages.map(async ([name, file, post]) => {
    try {
      const r = await fetch(`../${file}`, { cache: "no-store" }); if (!r.ok) throw new Error(r.status);
      const doc = new DOMParser().parseFromString(await r.text(), "text/html");
      const meta = (sel) => doc.querySelector(sel)?.getAttribute("content")?.trim() || "";
      const title = doc.title.trim(), desc = meta('meta[name="description"]'), h1 = doc.querySelectorAll("h1").length;
      const checks = [
        [`Title ${title.length} characters (30–65)`, title.length >= 30 && title.length <= 65],
        [`Description ${desc.length} characters (120–160)`, desc.length >= 120 && desc.length <= 160],
        [`${h1} main heading (H1)`, h1 === 1],
        ["Canonical link", !!doc.querySelector('link[rel="canonical"]')],
        ["Social preview (og:title + og:image)", !!meta('meta[property="og:title"]') && !!meta('meta[property="og:image"]')],
        ["Structured data (schema)", doc.querySelectorAll('script[type="application/ld+json"]').length > 0],
        ...(post ? [["Key takeaways for AI", (post.data?.takeaways || []).length >= 3], ["FAQ for AI", (post.data?.faq || []).length >= 3]] : []),
      ];
      return { name, file, checks, score: Math.round((checks.filter((c) => c[1]).length / checks.length) * 100) };
    } catch (e) { return { name, file, checks: [[`Couldn't read the page (${e.message})`, false]], score: 0 }; }
  }));
  const tone = (s) => (s >= 80 ? "ok" : s >= 50 ? "mid" : "bad");
  $("[data-audit]").innerHTML = `<div class="seo-pages">${audits.map((a) => `<details class="seo-page">
      <summary><span class="seo-sc is-${tone(a.score)}">${a.score}</span><span class="seo-pn"><b>${esc(a.name)}</b><small class="muted">${esc(a.file)}</small></span>
        <span class="seo-miss">${a.checks.filter((c) => !c[1]).length ? `${a.checks.filter((c) => !c[1]).length} to fix` : "All good"}</span>${icon("chevron")}</summary>
      <ul class="bl-checks">${a.checks.map(([t, v]) => `<li class="${v ? "ok" : ""}">${icon(v ? "check" : "alert")}<span>${esc(t)}</span></li>`).join("")}</ul>
      <a class="link" href="../${esc(a.file)}" target="_blank" rel="noopener">Open the page ↗</a></details>`).join("")}</div>`;

  // ---------- KPIs ----------
  const avg = Math.round(audits.reduce((s, a) => s + a.score, 0) / audits.length);
  const aiReady = (posts || []).filter((p) => (p.data?.takeaways || []).length >= 3 && (p.data?.faq || []).length >= 3).length;
  const { count: newsPages } = await A.db.from("news").select("id", { count: "exact", head: true }).eq("relevant", true).not("slug", "is", null);
  const searchOn = BOTS.filter(([b, , k]) => k === "search" && bots[b] !== false).length;
  $("[data-kpis]").innerHTML = `<div class="aud-kpi ${avg >= 80 ? "is-green" : "is-gold"}"><span>Website score</span><b>${avg}</b></div>
    <div class="aud-kpi"><span>Pages all good</span><b>${audits.filter((a) => a.score === 100).length} / ${audits.length}</b></div>
    <div class="aud-kpi"><span>Articles ready for AI</span><b>${aiReady} / ${(posts || []).length}</b></div>
    <div class="aud-kpi"><span>News pages</span><b>${newsPages ?? "—"}</b></div>
    <div class="aud-kpi is-green"><span>AI search engines allowed</span><b>${searchOn} / ${BOTS.filter((b) => b[2] === "search").length}</b></div>`;

  // ---------- keywords vs the blog ----------
  try {
    const cfg = await (await fetch("../blog-tools/keywords.json", { cache: "no-store" })).json();
    const all = (posts || []).map((p) => ({ title: p.data?.title || p.slug, slug: p.slug, main: String(p.data?.primary_keyword || "").toLowerCase(), text: String(p.data?.body_html || "").replace(/<[^>]+>/g, " ").toLowerCase() }));
    $("[data-kw]").innerHTML = `<div class="seo-kws">${cfg.keywords.map((k) => {
      const kw = k.keyword.toLowerCase(), main = all.filter((p) => p.main === kw), men = all.filter((p) => p.text.includes(kw)).length;
      return `<div class="seo-kw${main.length ? " has" : ""}"><b>${esc(k.keyword)}</b>
        <small class="muted">${k.pillar ? "Pillar · " : ""}${esc(k.priority)} priority · in ${men} article${men === 1 ? "" : "s"}</small>
        ${main.length ? `<span class="seo-kw-ok">${icon("check")}<a href="../blog/${esc(main[0].slug)}.html" target="_blank" rel="noopener">${esc(main[0].title)}</a></span>` : `<span class="seo-kw-no">${icon("alert")}No article for it yet — an idea for the next post</span>`}</div>`;
    }).join("")}</div>`;
  } catch (e) { $("[data-kw]").innerHTML = `<p class="muted">${esc(e.message)}</p>`; }

  // ---------- files and tools ----------
  const home = encodeURIComponent(`${SITE}/`);
  $("[data-files]").innerHTML = [
    ["robots.txt", "../robots.txt", "Which crawlers may read the website"], ["llms.txt", "../llms.txt", "The website explained for AI assistants"], ["sitemap.xml", "../sitemap.xml", "Every page, for Google"],
    ["Google Search Console", "https://search.google.com/search-console", "Searches, clicks and indexing problems"], ["Rich results test", `https://search.google.com/test/rich-results?url=${home}`, "Checks the structured data"],
    ["PageSpeed Insights", `https://pagespeed.web.dev/analysis?url=${home}`, "Speed on mobile and desktop"],
  ].map(([t, u, d]) => `<a class="seo-file" href="${esc(u)}" target="_blank" rel="noopener"><b>${esc(t)} ↗</b><small class="muted">${esc(d)}</small></a>`).join("");
})();
