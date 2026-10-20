#!/usr/bin/env node
// Builds the blog from content/blog/*.json:
//   - blog/<slug>.html   one SEO-ready page per post
//   - blog.html          post grid (between POSTS:START / POSTS:END markers)
//   - news.html          3 latest posts (between BLOG:START / BLOG:END markers)
//   - sitemap.xml, robots.txt
// Checks each post: word count for its type, all 15 keywords present, CTAs.
//
// Usage: node blog-tools/build.mjs [--check]   (--check validates without writing)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK_ONLY = process.argv.includes("--check");
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "blog-tools/keywords.json"), "utf8"));
const SITE = cfg.site_url.replace(/\/$/, "");

const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const write = (p, s) => { if (!CHECK_ONLY) fs.writeFileSync(path.join(ROOT, p), s); };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const plain = (html) => html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
const words = (html) => plain(html).split(" ").filter(Boolean).length;
const fmtDate = (d) => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

// ---------- Load posts ----------
const dir = path.join(ROOT, "content/blog");
const posts = fs.readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => ({ file: f, ...JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) }))
  .filter((p) => !p.draft)
  .sort((a, b) => b.date.localeCompare(a.date));

// ---------- Keyword casing ----------
// Keywords are written in normal sentence case inside articles: lowercase, except proper
// nouns (Instagram, TikTok, AI…) and when they start a sentence or heading.
const PROPER = new Set(["instagram", "tiktok", "ai", "youtube", "x", "linkedin", "facebook"]);
const PROPER_FORM = { instagram: "Instagram", tiktok: "TikTok", ai: "AI", youtube: "YouTube", x: "X", linkedin: "LinkedIn", facebook: "Facebook" };
const sentenceCase = (kw) => kw.split(" ").map((w) => PROPER.has(w.toLowerCase()) ? PROPER_FORM[w.toLowerCase()] : w.toLowerCase()).join(" ");

function normalizeKeywordCase(html) {
  const parts = html.split(/(<[^>]+>)/);
  let blockStart = true; // true right after a block-level opening tag
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.startsWith("<")) {
      if (/^<(p|h[1-6]|li|blockquote|figcaption)[\s>]/i.test(part)) blockStart = true;
      continue;
    }
    let text = part;
    for (const { keyword } of cfg.keywords) {
      const re = new RegExp(`(?<![\\w-])${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`, "gi");
      text = text.replace(re, (match, offset, whole) => {
        const before = whole.slice(0, offset);
        const startsSentence = (blockStart && before.trim() === "") || /[.!?:]\s+$/.test(before);
        const lower = sentenceCase(keyword);
        return startsSentence ? lower[0].toUpperCase() + lower.slice(1) : lower;
      });
    }
    parts[i] = text;
    if (text.trim()) blockStart = false;
  }
  return parts.join("");
}

// ---------- Keyword auto-linking ----------
// Links the first plain-text occurrence of each keyword (outside links and headings).
function linkKeywords(html) {
  let out = html;
  for (const { keyword, link } of cfg.keywords) {
    const re = new RegExp(`(?<![\\w-])(${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?![\\w-])`, "i");
    // split into tags and text; skip text inside <a>…</a> and <h1-6>…</h…>
    const parts = out.split(/(<[^>]+>)/);
    let depthA = 0, depthH = 0, done = false;
    for (let i = 0; i < parts.length && !done; i++) {
      const part = parts[i];
      if (part.startsWith("<")) {
        if (/^<a[\s>]/i.test(part)) depthA++;
        else if (/^<\/a>/i.test(part)) depthA--;
        else if (/^<h[1-6][\s>]/i.test(part)) depthH++;
        else if (/^<\/h[1-6]>/i.test(part)) depthH--;
        continue;
      }
      if (depthA || depthH || !re.test(part)) continue;
      parts[i] = part.replace(re, `<a class="kw-link" href="${link}">$1</a>`);
      done = true;
    }
    out = parts.join("");
  }
  return out;
}

// ---------- Social embeds ----------
// In body_html, write: <div class="embed" data-embed="POST_URL" data-caption="optional caption"></div>
// Supported: Instagram posts/reels, TikTok videos, YouTube videos/Shorts, X posts.
const EMBED_RE = /<div class="embed" data-embed="([^"]+)"(?: data-caption="([^"]*)")?\s*><\/div>/g;

function parseEmbed(url) {
  let m;
  if ((m = url.match(/instagram\.com\/(?:[\w.]+\/)?(p|reel|tv)\/([\w-]+)/))) return { platform: "instagram", url: `https://www.instagram.com/${m[1] === "tv" ? "p" : m[1]}/${m[2]}/` };
  if ((m = url.match(/tiktok\.com\/@([\w.-]+)\/video\/(\d+)/))) return { platform: "tiktok", url: `https://www.tiktok.com/@${m[1]}/video/${m[2]}`, id: m[2] };
  if ((m = url.match(/youtube\.com\/shorts\/([\w-]{11})/))) return { platform: "youtube", id: m[1], vertical: true, url };
  if ((m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/))) return { platform: "youtube", id: m[1], url };
  if ((m = url.match(/(?:x|twitter)\.com\/(\w+)\/status\/(\d+)/))) return { platform: "x", url: `https://twitter.com/${m[1]}/status/${m[2]}` };
  return null;
}

const EMBED_SCRIPTS = {
  instagram: '<script async src="https://www.instagram.com/embed.js"></script>',
  tiktok: '<script async src="https://www.tiktok.com/embed.js"></script>',
  x: '<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>',
};

// Screenshot of a post/profile when an embed isn't possible:
// <div class="shot" data-src="assets/blog/shots/<file>.png" data-alt="…" data-source-url="POST_OR_PROFILE_URL" data-caption="…"></div>
const SHOT_RE = /<div class="shot" data-src="([^"]+)" data-alt="([^"]*)" data-source-url="([^"]+)"(?: data-caption="([^"]*)")?\s*><\/div>/g;

function renderEmbeds(html) {
  const used = new Set();
  html = html.replace(SHOT_RE, (_, src, alt, url, caption) =>
    `<figure class="post-embed post-shot"><a href="${url}" target="_blank" rel="noopener nofollow"><img src="${src}" alt="${alt}" loading="lazy"></a><figcaption>${caption ? caption + " · " : ""}Source: <a href="${url}" target="_blank" rel="noopener nofollow">${url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</a></figcaption></figure>`);
  const out = html.replace(EMBED_RE, (_, rawUrl, caption) => {
    const e = parseEmbed(rawUrl);
    used.add(e.platform);
    const cap = caption ? `<figcaption>${caption}</figcaption>` : "";
    let inner;
    if (e.platform === "instagram") {
      inner = `<blockquote class="instagram-media" data-instgrm-permalink="${e.url}?utm_source=ig_embed" data-instgrm-version="14"><a href="${e.url}" target="_blank" rel="noopener">View this post on Instagram</a></blockquote>`;
    } else if (e.platform === "tiktok") {
      inner = `<blockquote class="tiktok-embed" cite="${e.url}" data-video-id="${e.id}"><section><a href="${e.url}" target="_blank" rel="noopener">View this video on TikTok</a></section></blockquote>`;
    } else if (e.platform === "youtube") {
      inner = `<div class="yt-frame${e.vertical ? " is-vertical" : ""}"><iframe src="https://www.youtube-nocookie.com/embed/${e.id}" title="YouTube video" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`;
    } else {
      inner = `<blockquote class="twitter-tweet" data-theme="dark"><a href="${e.url}">View this post on X</a></blockquote>`;
    }
    // nothing loads from the platform until the reader asks for it (no third-party cookies by default):
    // js/main.js swaps the gate for the embed and loads the platform's script on click
    const NAME = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", x: "X" }[e.platform];
    const script = (EMBED_SCRIPTS[e.platform] || "").match(/src="([^"]+)"/)?.[1] || "";
    const gate = `<div class="ext-gate" data-ext-html="${inner.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"${script ? ` data-ext-script="${script}"` : ""}>
      <span class="ext-gate-logo"><i class="lf-pfi is-brand lf-pf-${e.platform}" style="-webkit-mask-image:url(assets/pf-${e.platform}.svg);mask-image:url(assets/pf-${e.platform}.svg)"></i></span>
      <b>${NAME} post</b><span>This post is shown by ${NAME}, which may set its own cookies. It loads only when you open it.</span>
      <button class="btn btn-gold" type="button" data-ext-open>Load the post</button>
      <a class="ext-gate-link" href="${e.url}" target="_blank" rel="noopener nofollow">or open it on ${NAME} ↗</a></div>`;
    return `<figure class="post-embed post-embed-${e.platform}">${gate}${cap}</figure>`;
  });
  return { html: out, scripts: "" };
}

// CTA card inserted after ~40% of the article's paragraphs
const midCta = (post) => `
          <aside class="post-cta">
            <p class="post-cta-kicker">Sports Content Playbook</p>
            <p class="post-cta-title">${esc(post.cta_title || "Find your next winning post in seconds")}</p>
            <p>${esc(post.cta_text || "Browse thousands of proven sports posts filtered by sport, format, platform and performance — updated every day.")}</p>
            <div class="post-cta-actions">
              <a class="btn btn-gold" href="signup.html" data-cta="blog-mid">Try It For Free</a>
              <a class="btn btn-outline" href="book-a-call.html" data-cta="blog-mid">Book a 30-min demo</a>
            </div>
          </aside>`;

function insertMidCta(html, post) {
  const closes = [...html.matchAll(/<\/p>/gi)];
  if (closes.length < 3) return html + midCta(post);
  // first paragraph end from ~40% onwards that isn't followed by an embed/screenshot
  const from = Math.floor(closes.length * 0.4);
  const at = closes.slice(from).find((c) => !/^\s*<figure/.test(html.slice(c.index + c[0].length))) ?? closes[from];
  const idx = at.index + at[0].length;
  return html.slice(0, idx) + midCta(post) + html.slice(idx);
}

const norm = (u) => String(u).toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/twitter\.com/, "x.com").replace(/[?#].*$/, "").replace(/\/$/, "");

// ---------- Validation ----------
let problems = 0;
for (const p of posts) {
  const type = cfg.types[p.type];
  const issues = [];
  if (!type) issues.push(`unknown type "${p.type}"`);
  for (const f of ["slug", "title", "meta_title", "meta_description", "date", "primary_keyword", "excerpt", "body_html"]) {
    if (!p[f]) issues.push(`missing ${f}`);
  }
  if (!p.image?.file || !p.image?.alt) issues.push("missing image.file / image.alt");
  if (!p.image?.credit?.author || !p.image?.credit?.source_url) issues.push("missing image.credit (author + source_url) — the photo source must always be cited");
  if (p.image?.file && !fs.existsSync(path.join(ROOT, "assets/blog", p.image.file))) issues.push(`cover not found: assets/blog/${p.image.file}`);
  const n = words(p.body_html || "");
  if (type && (n < type.min_words || n > type.max_words)) issues.push(`${n} words (needs ${type.min_words}–${type.max_words} for ${type.label})`);
  const text = plain(p.body_html || "").toLowerCase();
  const missing = cfg.keywords.filter((k) => !text.includes(k.keyword.toLowerCase())).map((k) => k.keyword);
  if (missing.length) issues.push(`missing keywords: ${missing.join(", ")}`);
  if (p.body_html) {
    const linked = linkKeywords(p.body_html);
    const unlinked = cfg.keywords.filter((k) => !missing.includes(k.keyword) && !new RegExp(`class="kw-link"[^>]*>${k.keyword}<`, "i").test(linked)).map((k) => k.keyword);
    if (unlinked.length) issues.push(`keywords only in headings or links (need one mention in body text): ${unlinked.join(", ")}`);
  }
  for (const [, url] of (p.body_html || "").matchAll(EMBED_RE)) {
    if (!parseEmbed(url)) issues.push(`unsupported embed URL: ${url}`);
  }
  for (const [, src] of (p.body_html || "").matchAll(SHOT_RE)) {
    if (!fs.existsSync(path.join(ROOT, src))) issues.push(`screenshot not found: ${src}`);
  }
  // Every post, profile or campaign the article talks about must be shown (embed or screenshot)
  if (!Array.isArray(p.references)) issues.push('missing "references" (list every post/profile/campaign mentioned; [] if none)');
  else {
    const shown = new Set([
      ...[...(p.body_html || "").matchAll(EMBED_RE)].map((m) => norm(m[1])),
      ...[...(p.body_html || "").matchAll(SHOT_RE)].map((m) => norm(m[3])),
    ]);
    const notShown = p.references.filter((r) => !shown.has(norm(r.url))).map((r) => r.name || r.url);
    if (notShown.length) issues.push(`references without embed or screenshot: ${notShown.join(", ")}`);
  }
  if ((p.meta_description || "").length > 160) issues.push(`meta_description is ${p.meta_description.length} chars (max 160)`);
  if ((p.meta_title || "").length > 65) issues.push(`meta_title is ${p.meta_title.length} chars (max 65)`);
  if (issues.length) {
    problems++;
    console.error(`✗ ${p.file}\n  - ${issues.join("\n  - ")}`);
  } else {
    console.log(`✓ ${p.file} (${n} words, ${type.label})`);
  }
}
if (problems) {
  console.error(`\n${problems} post(s) need fixing. Nothing was written.`);
  process.exit(1);
}
if (CHECK_ONLY) process.exit(0);

// ---------- Shared chrome from blog.html ----------
const blogHtml = read("blog.html");
const header = blogHtml.slice(blogHtml.indexOf('<header class="site-nav"'), blogHtml.indexOf("</header>") + "</header>".length)
  .replace(' aria-current="page"', "");
const footer = blogHtml.slice(blogHtml.indexOf('<footer class="site-footer'), blogHtml.indexOf("</footer>", blogHtml.indexOf('<footer class="site-footer')) + "</footer>".length);
const typeLabel = (t) => cfg.types[t]?.label ?? t;

// ---------- Post pages ----------
fs.mkdirSync(path.join(ROOT, "blog"), { recursive: true });
for (const p of posts) {
  const url = `${SITE}/blog/${p.slug}.html`;
  const img = `${SITE}/assets/blog/${p.image.file}`;
  const embeds = renderEmbeds(linkKeywords(normalizeKeywordCase(p.body_html)));
  const body = insertMidCta(embeds.html, p);
  const minutes = Math.max(1, Math.round(words(p.body_html) / 220));
  const related = posts.filter((o) => o.slug !== p.slug).slice(0, 3);
  const ld = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: p.title,
    description: p.meta_description,
    image: [img],
    datePublished: p.date,
    dateModified: p.updated || p.date,
    author: { "@type": "Person", name: p.author || "Martí Ruiz" },
    publisher: { "@type": "Organization", name: "Sports Content Playbook", logo: { "@type": "ImageObject", url: `${SITE}/assets/icon-logo-lg.png` } },
    mainEntityOfPage: url,
    keywords: (p.keywords || []).join(", "),
    articleSection: typeLabel(p.type),
    wordCount: words(p.body_html),
  };
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE}/blog.html` },
      { "@type": "ListItem", position: 3, name: p.title, item: url },
    ],
  };

  const page = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="../">
  <title>${esc(p.meta_title)}</title>
  <meta name="description" content="${esc(p.meta_description)}">
  <meta name="keywords" content="${esc((p.keywords || []).join(", "))}">
  <meta name="author" content="${esc(p.author || "Martí Ruiz")}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Sports Content Playbook">
  <meta property="og:title" content="${esc(p.meta_title)}">
  <meta property="og:description" content="${esc(p.meta_description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${img}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(p.image.alt)}">
  <meta property="article:published_time" content="${p.date}">
  <meta property="article:section" content="${esc(typeLabel(p.type))}">
${(p.keywords || []).map((k) => `  <meta property="article:tag" content="${esc(k)}">`).join("\n")}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(p.meta_title)}">
  <meta name="twitter:description" content="${esc(p.meta_description)}">
  <meta name="twitter:image" content="${img}">
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbs)}</script>
  <link rel="icon" type="image/svg+xml" href="assets/icon-logo.svg">
  <link rel="icon" type="image/png" sizes="256x256" href="assets/icon-logo-lg.png">
  <link rel="apple-touch-icon" href="assets/icon-logo-lg.png">
  <link rel="stylesheet" href="css/fonts.css?v=1">
  <link rel="stylesheet" href="css/styles.css">
  <script src="js/theme.js?v=20261026c"></script>
  <script src="js/i18n.js?v=20261027b"></script>
</head>
<body>

  ${header}

  <main>
    <article class="post container">
      <nav class="post-crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a> / <a href="blog.html">Blog</a> / <span>${esc(typeLabel(p.type))}</span></nav>
      <header class="article-head">
        <span class="eyebrow">${esc(typeLabel(p.type))}</span>
        <h1 class="section-title section-title-md">${esc(p.title)}</h1>
        <p class="post-meta">By ${esc(p.author || "Martí Ruiz")} · <time datetime="${p.date}">${fmtDate(p.date)}</time> · ${minutes} min read</p>
        <p class="post-lang-note" data-lang-block="es" hidden>This article is only available in English.</p>
      </header>
      <figure class="post-cover">
        <img src="assets/blog/${esc(p.image.file)}" alt="${esc(p.image.alt)}" title="${esc(p.image.title || p.title)}" width="1200" height="630" fetchpriority="high">
${p.image.credit ? `        <figcaption>Photo: <a href="${esc(p.image.credit.source_url)}" target="_blank" rel="noopener nofollow">${esc(p.image.credit.author)}</a>${p.image.credit.license ? ` · ${p.image.credit.license_url ? `<a href="${esc(p.image.credit.license_url)}" target="_blank" rel="noopener nofollow">${esc(p.image.credit.license)}</a>` : esc(p.image.credit.license)}` : ""}</figcaption>` : ""}
      </figure>
      <div class="post-body">
${body}
        <aside class="post-cta post-cta-end">
          <p class="post-cta-kicker">Ready to plan your next week of content?</p>
          <p class="post-cta-title">Every idea in this article is already in the Content Library</p>
          <p>Filter by sport, platform and format, save the posts that inspire you and build your sports content calendar in minutes.</p>
          <div class="post-cta-actions">
            <a class="btn btn-gold" href="signup.html" data-cta="blog-end">Try It For Free</a>
            <a class="btn btn-outline" href="book-a-call.html" data-cta="blog-end">Book a 30-min demo</a>
          </div>
          <p class="post-cta-more"><a class="link-gold" href="pricing.html">See plans and pricing →</a></p>
        </aside>
${(p.sources || []).length ? `        <section class="post-sources">
          <h2>Sources</h2>
          <ul>${p.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener nofollow">${esc(s.name)}</a></li>`).join("")}</ul>
        </section>` : ""}
      </div>
    </article>
${related.length ? `
    <section class="blog-news container">
      <div class="blog-news-head"><h2 class="section-title section-title-md">Keep reading</h2><a class="news-link" href="blog.html">ALL ARTICLES →</a></div>
      <div class="blog-grid">
${related.map(card).join("\n")}
      </div>
    </section>` : ""}
  </main>

  ${footer}

  <script src="js/config.js?v=20261021a"></script>
  <script src="js/nav-menu.js?v=20261025f"></script>
  <script src="js/lead-flow.js?v=20261020b"></script>
  <script src="js/promo-bar.js?v=20261020a"></script>
  <script src="js/main.js"></script>
  <script src="js/site-stats.js" defer></script>
  ${embeds.scripts}
</body>
</html>
`;
  write(`blog/${p.slug}.html`, page);
  console.log(`  → blog/${p.slug}.html`);
}

function card(p) {
  return `        <article class="blog-card" data-cat="${esc(p.type)}">
          <a class="blog-img" href="blog/${esc(p.slug)}.html" style="background-image: url('assets/blog/${esc(p.image.file)}')" aria-label="${esc(p.title)}"></a>
          <div class="blog-body">
            <time datetime="${p.date}">${fmtDate(p.date)}</time>
            <h2><a href="blog/${esc(p.slug)}.html">${esc(p.title)}</a></h2>
            <p>${esc(p.excerpt)}</p>
            <a class="link-gold" href="blog/${esc(p.slug)}.html">Read more</a>
          </div>
        </article>`;
}

// ---------- Listings ----------
function replaceBetween(file, start, end, content) {
  const s = read(file);
  const a = s.indexOf(start), b = s.indexOf(end);
  if (a < 0 || b < 0) { console.warn(`  ! markers not found in ${file}`); return; }
  write(file, s.slice(0, a + start.length) + "\n" + content + "\n        " + s.slice(b));
}
if (posts.length) {
  replaceBetween("blog.html", "<!-- POSTS:START -->", "<!-- POSTS:END -->", posts.map(card).join("\n"));
  replaceBetween("news.html", "<!-- BLOG:START -->", "<!-- BLOG:END -->", posts.slice(0, 3).map(card).join("\n"));
  replaceBetween("index.html", "<!-- HOME-BLOG:START -->", "<!-- HOME-BLOG:END -->", posts.slice(0, 3).map(card).join("\n"));
}

// ---------- Sitemap & robots ----------
const pages = ["", "pricing.html", "blog.html", "news.html", "contact.html", "signup.html"];
const today = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${pages.map((p) => `  <url><loc>${SITE}/${p}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
${posts.map((p) => `  <url><loc>${SITE}/blog/${p.slug}.html</loc><lastmod>${p.updated || p.date}</lastmod><image:image><image:loc>${SITE}/assets/blog/${p.image.file}</image:loc><image:title>${esc(p.image.title || p.title)}</image:title><image:caption>${esc(p.image.alt)}</image:caption></image:image></url>`).join("\n")}
</urlset>
`;
write("sitemap.xml", sitemap);
write("robots.txt", `User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /content-library.html\n\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`\nBuilt ${posts.length} post(s), blog listing, sitemap.xml and robots.txt.`);
