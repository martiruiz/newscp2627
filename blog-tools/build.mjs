#!/usr/bin/env node
// Builds the blog from content/blog/*.json:
//   - blog/<slug>.html   one SEO-ready page per post
//   - blog.html          post grid (between POSTS:START / POSTS:END markers)
//   - news.html          3 latest posts (between BLOG:START / BLOG:END markers)
//   - news/<slug>.html   one page per published Social News item (content/news.json, from the admin) + the latest ones
//                        written into news.html (NEWS:START / NEWS:END) so Google and AI crawlers read them without JS
//   - the main pages' title / description (Admin → SEO) and missing canonical, social preview and schema
//   - sitemap.xml, robots.txt (AI crawlers allowed / blocked in Admin → SEO), llms.txt, Organization schema on the home
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
const fmtDate = (d, lang = "en") => new Date(d + "T12:00:00Z").toLocaleDateString(lang === "es" ? "es-ES" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
// ---------- Spanish versions (translated by AI into "es", blog-tools/sync-db.mjs): same page, the Spanish text, under /es/ ----------
const listOr = (a, b) => (Array.isArray(a) && a.length ? a : b);
const inEs = (p) => (p.es ? { ...p, title: p.es.title || p.title, excerpt: p.es.excerpt || p.excerpt, body_html: p.es.body_html || p.body_html, meta_title: p.es.meta_title || p.meta_title,
  meta_description: p.es.meta_description || p.meta_description, cta_title: p.es.cta_title || p.cta_title, cta_text: p.es.cta_text || p.cta_text,
  image: p.image ? { ...p.image, alt: p.es.image_alt || p.image.alt, title: p.es.image_title || p.image.title } : p.image,
  takeaways: listOr(p.es.takeaways, p.takeaways), faq: listOr(p.es.faq, p.faq), paragraphs: listOr(p.es.paragraphs, p.paragraphs) } : p);
// both addresses of a page, for <link rel="alternate" hreflang> (and the language switch, js/i18n.js)
const alternates = (path) => `
  <link rel="alternate" hreflang="en" href="${SITE}/${path}">
  <link rel="alternate" hreflang="es" href="${SITE}/es/${path}">
  <link rel="alternate" hreflang="x-default" href="${SITE}/${path}">`;

// ---------- Cache versions: the posts load the same css/js versions as the home (index.html), so a new build never
// brings back an old "?v=" (and the browser's old copy with it) ----------
const SITE_V = new Map([...read("index.html").matchAll(/(?:href|src)="((?:css|js)\/[\w.-]+\.(?:css|js))\?v=([\w-]+)"/g)].map((m) => [m[1], m[2]]));
const withSiteVersions = (html) => html.replace(/(href|src)="((?:css|js)\/[\w.-]+\.(?:css|js))(?:\?v=[\w-]+)?"/g, (all, attr, file) => (SITE_V.has(file) ? `${attr}="${file}?v=${SITE_V.get(file)}"` : all));

// ---------- Load posts ----------
const dir = path.join(ROOT, "content/blog");
const posts = fs.readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => ({ file: f, ...JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) }))
  .filter((p) => !p.draft)
  .sort((a, b) => b.date.localeCompare(a.date));
// a post sent back to draft (Admin → Blog) leaves the website: its page is removed too
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  const page = path.join(ROOT, "blog", `${d.slug}.html`);
  if (d.draft && fs.existsSync(page) && !CHECK_ONLY) { fs.unlinkSync(page); console.log(`  − blog/${d.slug}.html (draft)`); }
}

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
// SEO for AI answers (Admin → Blog → SEO & AI): key takeaways at the top and questions & answers at the end
const takeaways = (p) => (Array.isArray(p.takeaways) ? p.takeaways : String(p.takeaways || "").split("\n")).map((t) => String(t).trim()).filter(Boolean);
const faq = (p) => (Array.isArray(p.faq) ? p.faq : []).filter((f) => f && String(f.q || "").trim() && String(f.a || "").trim()).map((f) => ({ q: String(f.q).trim(), a: String(f.a).trim() }));

// ---------- Post pages ----------
fs.mkdirSync(path.join(ROOT, "blog"), { recursive: true });
fs.mkdirSync(path.join(ROOT, "es/blog"), { recursive: true });
function postPage(src, lang) {
  const p = lang === "es" ? inEs(src) : src, es = lang === "es", both = !!src.es, t = (en, sp) => (es ? sp : en);
  const url = `${SITE}/${es ? "es/" : ""}blog/${p.slug}.html`;
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
    // the cover as an ImageObject: Google Images reads its caption, size and credit
    image: [{ "@type": "ImageObject", url: img, width: 1200, height: 630, caption: p.image.alt, ...(p.image.credit?.author ? { creditText: p.image.credit.author } : {}) }],
    datePublished: p.date,
    dateModified: p.updated || p.date,
    author: { "@type": "Person", name: p.author || "Martí Ruiz" },
    publisher: { "@type": "Organization", name: "Sports Content Playbook", logo: { "@type": "ImageObject", url: `${SITE}/assets/icon-logo-lg.png` } },
    mainEntityOfPage: url,
    keywords: (p.keywords || []).join(", "),
    articleSection: typeLabel(p.type),
    wordCount: words(p.body_html),
    inLanguage: lang,
    ...(takeaways(p).length ? { abstract: takeaways(p).join(" ") } : {}),
    ...(p.author_bio ? { author: { "@type": "Person", name: p.author || "Martí Ruiz", description: p.author_bio } } : {}),
  };
  // for Google and AI answers: the FAQ as structured data (only when there are questions)
  const faqLd = faq(p).length ? { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq(p).map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) } : null;
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE}/${es ? "es/" : ""}blog.html` },
      { "@type": "ListItem", position: 3, name: p.title, item: url },
    ],
  };

  const page = `<!doctype html>
<html lang="${lang}"${both ? ` data-page-lang="${lang}"` : ""}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="${es ? "../../" : "../"}">
  <title>${esc(p.meta_title)}</title>
  <meta name="description" content="${esc(p.meta_description)}">
  <meta name="keywords" content="${esc((p.keywords || []).join(", "))}">
  <meta name="author" content="${esc(p.author || "Martí Ruiz")}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${url}">${both ? alternates(`blog/${p.slug}.html`) : ""}
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
  <script type="application/ld+json">${JSON.stringify(breadcrumbs)}</script>${faqLd ? `\n  <script type="application/ld+json">${JSON.stringify(faqLd)}</script>` : ""}
  <link rel="icon" type="image/png" sizes="32x32" href="assets/favicon-s-32.png">
  <link rel="icon" type="image/png" sizes="64x64" href="assets/favicon-s-64.png">
  <link rel="icon" type="image/png" sizes="192x192" href="assets/favicon-s-192.png">
  <link rel="apple-touch-icon" href="assets/apple-touch-icon-s.png">
  <link rel="stylesheet" href="css/fonts.css?v=1">
  <link rel="stylesheet" href="css/styles.css">
  <script src="js/theme.js?v=20261026c"></script>
  <script src="js/i18n.js?v=20261024zt"></script>
</head>
<body>

  ${header}

  <main>
    <article class="post container">
      <nav class="post-crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a> / <a href="${es ? "es/" : ""}blog.html">Blog</a> / <span>${esc(typeLabel(p.type))}</span></nav>
      <header class="article-head">
        <span class="eyebrow">${esc(typeLabel(p.type))}</span>
        <h1 class="section-title section-title-md">${esc(p.title)}</h1>
        <p class="post-meta">${t("By", "Por")} ${esc(p.author || "Martí Ruiz")} · <time datetime="${p.date}">${fmtDate(p.date, lang)}</time> · ${minutes} ${t("min read", "min de lectura")}</p>${both ? "" : `
        <p class="post-lang-note" data-lang-block="es" hidden>This article is only available in English.</p>`}
      </header>
      <figure class="post-cover">
        <img src="assets/blog/${esc(p.image.file)}" alt="${esc(p.image.alt)}" title="${esc(p.image.title || p.title)}" width="1200" height="630" fetchpriority="high">
${p.image.credit ? `        <figcaption>${t("Photo", "Foto")}: <a href="${esc(p.image.credit.source_url)}" target="_blank" rel="noopener nofollow">${esc(p.image.credit.author)}</a>${p.image.credit.license ? ` · ${p.image.credit.license_url ? `<a href="${esc(p.image.credit.license_url)}" target="_blank" rel="noopener nofollow">${esc(p.image.credit.license)}</a>` : esc(p.image.credit.license)}` : ""}</figcaption>` : ""}
      </figure>
      <div class="post-body">
${takeaways(p).length ? `        <aside class="post-tldr" aria-label="${t("Key takeaways", "Puntos clave")}">
          <p class="post-tldr-k">${t("Key takeaways", "Puntos clave")}</p>
          <ul>${takeaways(p).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
        </aside>
` : ""}${body}
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
${faq(p).length ? `        <section class="post-faq">
          <h2>${t("Frequently asked questions", "Preguntas frecuentes")}</h2>
${faq(p).map((f) => `          <details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("\n")}
        </section>
` : ""}${p.author_bio ? `        <aside class="post-author"><span class="post-author-av">${esc((p.author || "M").slice(0, 1))}</span><p><b>${esc(p.author || "Martí Ruiz")}</b><span>${esc(p.author_bio)}</span></p></aside>
` : ""}${(p.sources || []).length ? `        <section class="post-sources">
          <h2>${t("Sources", "Fuentes")}</h2>
          <ul>${p.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener nofollow">${esc(s.name)}</a></li>`).join("")}</ul>
        </section>` : ""}
      </div>
    </article>
${related.length ? `
    <section class="blog-news container">
      <div class="blog-news-head"><h2 class="section-title section-title-md">Keep reading</h2><a class="news-link" href="${es ? "es/" : ""}blog.html">ALL ARTICLES →</a></div>
      <div class="blog-grid">
${related.map((o) => card(o, lang)).join("\n")}
      </div>
    </section>` : ""}
  </main>

  ${footer}

  <script src="js/config.js?v=20261021a"></script>
  <script src="js/nav-menu.js"></script>
  <script src="js/consent.js?v=20261103i"></script>
  <script src="js/lead-flow.js?v=20261103o"></script>
  <script src="js/promo-bar.js?v=20261020a"></script>
  <script src="js/main.js"></script>
  <script src="js/site-stats.js" defer></script>
  ${embeds.scripts}
</body>
</html>
`;
  return withSiteVersions(page);
}
for (const p of posts) {
  write(`blog/${p.slug}.html`, postPage(p, "en"));
  console.log(`  → blog/${p.slug}.html`);
  if (p.es) { write(`es/blog/${p.slug}.html`, postPage(p, "es")); console.log(`  → es/blog/${p.slug}.html`); }
}

// a blog card; in Spanish, the translated article (its /es/ page) when there is one
function card(src, lang = "en") {
  const p = lang === "es" ? inEs(src) : src, href = `${lang === "es" && src.es ? "es/" : ""}blog/${esc(p.slug)}.html`;
  return `        <article class="blog-card" data-cat="${esc(p.type)}">
          <a class="blog-img" href="${href}" style="background-image: url('assets/blog/${esc(p.image.file)}')" aria-label="${esc(p.title)}"></a>
          <div class="blog-body">
            <time datetime="${p.date}">${fmtDate(p.date, lang)}</time>
            <h2><a href="${href}">${esc(p.title)}</a></h2>
            <p>${esc(p.excerpt)}</p>
            <a class="link-gold" href="${href}">Read more</a>
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

// ---------- Social News pages ----------
const readJson = (p, empty) => (fs.existsSync(path.join(ROOT, p)) ? JSON.parse(read(p)) : empty);
const news = readJson("content/news.json", null);
const seo = readJson("content/seo.json", {});
const PF = { instagram: "Instagram", tiktok: "TikTok", x: "X", youtube: "YouTube", facebook: "Facebook", linkedin: "LinkedIn", snapchat: "Snapchat", whatsapp: "WhatsApp", pinterest: "Pinterest", threads: "Threads", ai: "AI", other: "Sports marketing" };
const cut = (t, n) => (t.length > n ? `${t.slice(0, n - 1).replace(/\s+\S*$/, "")}…` : t);
const newsDay = (n) => (n.published_at || n.created_at).slice(0, 10);
const newsDesc = (n) => n.meta_description || cut((n.paragraphs || []).join(" "), 155);
if (news) {
  fs.mkdirSync(path.join(ROOT, "news"), { recursive: true });
  const keep = new Set(news.map((n) => `${n.slug}.html`));
  // a news item hidden or deleted in the admin leaves the website: its page is removed too
  for (const f of fs.readdirSync(path.join(ROOT, "news")).filter((f) => f.endsWith(".html") && !keep.has(f))) { fs.unlinkSync(path.join(ROOT, "news", f)); console.log(`  − news/${f}`); }
  fs.mkdirSync(path.join(ROOT, "es/news"), { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, "es/news")).filter((f) => f.endsWith(".html") && !news.some((n) => n.es && `${n.slug}.html` === f))) { fs.unlinkSync(path.join(ROOT, "es/news", f)); console.log(`  − es/news/${f}`); }
  const newsPage = (src, lang) => {
    const n = lang === "es" ? inEs(src) : src, es = lang === "es", both = !!src.es, t = (en, sp) => (es ? sp : en);
    const url = `${SITE}/${es ? "es/" : ""}news/${n.slug}.html`, title = n.meta_title || n.title, desc = newsDesc(n), day = newsDay(n);
    const tk = takeaways(n), fq = faq(n), pf = PF[n.platform] || n.platform, icon = n.platform === "other" ? "all" : n.platform;
    const more = news.filter((o) => o.id !== n.id && o.platform === n.platform).concat(news.filter((o) => o.id !== n.id && o.platform !== n.platform)).slice(0, 3);
    const ld = { "@context": "https://schema.org", "@type": "NewsArticle", headline: cut(n.title, 110), description: desc, datePublished: n.published_at || n.created_at, dateModified: n.edited_at || n.published_at || n.created_at,
      author: { "@type": "Organization", name: "Sports Content Playbook", url: `${SITE}/` }, publisher: { "@type": "Organization", name: "Sports Content Playbook", logo: { "@type": "ImageObject", url: `${SITE}/assets/icon-logo-lg.png` } },
      mainEntityOfPage: url, image: [n.image_url || `${SITE}/assets/hero-library.png`], articleSection: pf, isBasedOn: n.url, inLanguage: lang, ...(tk.length ? { abstract: tk.join(" ") } : {}) };
    const crumbs = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` }, { "@type": "ListItem", position: 2, name: "Social News", item: `${SITE}/${es ? "es/" : ""}news.html` }, { "@type": "ListItem", position: 3, name: n.title, item: url }] };
    const faqLd = fq.length ? { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: fq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) } : null;
    const page = `<!doctype html>
<html lang="${lang}"${both ? ` data-page-lang="${lang}"` : ""}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="${es ? "../../" : "../"}">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${url}">${both ? alternates(`news/${n.slug}.html`) : ""}
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Sports Content Playbook">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${esc(n.image_url || `${SITE}/assets/hero-library.png`)}">
  <meta property="article:published_time" content="${esc(n.published_at || n.created_at)}">
  <meta property="article:section" content="${esc(pf)}">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
  <script type="application/ld+json">${JSON.stringify(crumbs)}</script>${faqLd ? `\n  <script type="application/ld+json">${JSON.stringify(faqLd)}</script>` : ""}
  <link rel="icon" type="image/png" sizes="32x32" href="assets/favicon-s-32.png">
  <link rel="icon" type="image/png" sizes="192x192" href="assets/favicon-s-192.png">
  <link rel="apple-touch-icon" href="assets/apple-touch-icon-s.png">
  <link rel="stylesheet" href="css/fonts.css?v=1">
  <link rel="stylesheet" href="css/styles.css">
  <script src="js/theme.js"></script>
  <script src="js/i18n.js"></script>
</head>
<body>

  ${header.replace('href="news.html"', 'href="news.html" aria-current="page"')}

  <main>
    <article class="post container news-page">
      <nav class="post-crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a> / <a href="${es ? "es/" : ""}news.html">Social News</a> / <span>${esc(pf)}</span></nav>
      <header class="article-head">
        <span class="news-page-pf"><img src="assets/pf-${esc(icon)}.svg" alt="">${esc(pf)}</span>
        <h1 class="section-title section-title-md">${esc(n.title)}</h1>
        <p class="post-meta">Social News · <time datetime="${day}">${fmtDate(day, lang)}</time> · ${t("Source", "Fuente")}: <a href="${esc(n.url)}" target="_blank" rel="noopener nofollow">${esc(n.source_name)}</a></p>
      </header>
${n.image_url ? `      <figure class="post-cover news-page-cover"><img src="${esc(n.image_url)}" alt="${esc(n.title)}" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"><figcaption>${t("Picture", "Imagen")}: <a href="${esc(n.url)}" target="_blank" rel="noopener nofollow">${esc(n.source_name)}</a></figcaption></figure>
` : ""}      <div class="post-body">
${tk.length ? `        <aside class="post-tldr" aria-label="${t("Key takeaways", "Puntos clave")}">
          <p class="post-tldr-k">${t("Key takeaways", "Puntos clave")}</p>
          <ul>${tk.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
        </aside>
` : ""}${(n.paragraphs || []).map((t) => `        <p>${esc(t)}</p>`).join("\n")}
        <p class="news-page-src"><a class="link-gold" href="${esc(n.url)}" target="_blank" rel="noopener nofollow">${t("Read the original article on", "Lee el artículo original en")} ${esc(n.source_name)} ↗</a></p>
${fq.length ? `        <section class="post-faq">
          <h2>${t("Frequently asked questions", "Preguntas frecuentes")}</h2>
${fq.map((f) => `          <details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("\n")}
        </section>
` : ""}        <aside class="post-cta post-cta-end">
          <p class="post-cta-kicker">Sports Content Playbook</p>
          <p class="post-cta-title">See how sports teams are already using it</p>
          <p>Thousands of real posts from clubs, leagues and brands, filtered by sport, platform and format — updated every day.</p>
          <div class="post-cta-actions">
            <a class="btn btn-gold" href="signup.html" data-cta="news-end">Try It For Free</a>
            <a class="btn btn-outline" href="${es ? "es/" : ""}news.html">All Social News</a>
          </div>
        </aside>
      </div>
    </article>
${more.length ? `
    <section class="container news-more">
      <div class="blog-news-head"><h2 class="section-title section-title-md">More Social News</h2><a class="news-link" href="${es ? "es/" : ""}news.html">ALL NEWS →</a></div>
      <div class="news-list">
${more.map((o) => newsRow(o, lang)).join("\n")}
      </div>
    </section>` : ""}
  </main>

  ${footer}

  <script src="js/config.js"></script>
  <script src="js/nav-menu.js"></script>
  <script src="js/consent.js?v=20261103i"></script>
  <script src="js/lead-flow.js"></script>
  <script src="js/promo-bar.js"></script>
  <script src="js/main.js"></script>
  <script src="js/site-stats.js" defer></script>
</body>
</html>
`;
    return withSiteVersions(page);
  };
  for (const n of news) {
    write(`news/${n.slug}.html`, newsPage(n, "en"));
    if (n.es) write(`es/news/${n.slug}.html`, newsPage(n, "es"));
  }
  // news.html: the latest ones already in the page (js/news.js replaces them with the live, filterable list)
  replaceBetween("news.html", "<!-- NEWS:START -->", "<!-- NEWS:END -->", news.slice(0, 12).map(newsRow).join("\n"));
  console.log(`  → ${news.length} news page(s)`);
}
// one news item in a list (same markup as js/news.js)
function newsRow(src, lang = "en") {
  const n = lang === "es" ? inEs(src) : src, dir = lang === "es" && src.es ? "es/" : "";
  const icon = n.platform === "other" ? "all" : n.platform;
  return `        <article class="news-row nwc" id="news-${n.id}" data-platform="${esc(n.platform)}">
          <a class="nwc-img${n.image_url ? "" : " is-empty"}" href="${dir}news/${esc(n.slug)}.html" tabindex="-1" aria-hidden="true">${n.image_url ? `<img src="${esc(n.image_url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.add('is-empty');this.remove()">` : ""}<span class="nwc-pf"><img src="assets/pf-${esc(icon)}.svg" alt=""></span></a>
          <div class="nwc-body">
            <span class="news-meta"><b>${esc((PF[n.platform] || n.platform).toUpperCase())}</b> <time>${fmtDate(newsDay(n), lang)}</time> <span>${esc(n.source_name)}</span></span>
            <h2><a href="${dir}news/${esc(n.slug)}.html">${esc(n.title)}</a></h2>
${(n.paragraphs || []).slice(0, 2).map((t) => `            <p>${esc(t)}</p>`).join("\n")}
            <div class="nwc-foot"><a class="nwc-more" href="${dir}news/${esc(n.slug)}.html">Read the news →</a><a class="news-source" href="${esc(n.url)}" target="_blank" rel="noopener nofollow">Source: ${esc(n.source_name)} ↗</a></div>
          </div>
        </article>`;
}

// ---------- For Google and AI assistants: Organization + WebSite schema on the home, llms.txt (Admin → SEO) ----------
const ORG = { name: seo.org_name || "Sports Content Playbook", description: seo.description || "The content platform for sports social media teams: thousands of real posts from clubs, leagues and brands, why they worked and a weekly content plan.",
  logo: seo.logo || `${SITE}/assets/icon-logo-lg.png`, sameAs: (seo.same_as || []).filter(Boolean) };
const orgLd = [{ "@context": "https://schema.org", "@type": "Organization", "@id": `${SITE}/#org`, name: ORG.name, url: `${SITE}/`, logo: ORG.logo, description: ORG.description, ...(ORG.sameAs.length ? { sameAs: ORG.sameAs } : {}), ...(seo.email ? { email: seo.email } : {}) },
  { "@context": "https://schema.org", "@type": "WebSite", "@id": `${SITE}/#website`, name: ORG.name, url: `${SITE}/`, publisher: { "@id": `${SITE}/#org` }, inLanguage: ["es", "en"] }];
replaceBetween("index.html", "<!-- SEO-LD:START -->", "<!-- SEO-LD:END -->", `  <script type="application/ld+json">${JSON.stringify(orgLd)}</script>`);
const KEY_PAGES = [["Home", "", "What Sports Content Playbook is and how it works"], ["Content Library", "content-library.html", "Real posts from sports clubs, leagues and brands, filtered by sport, platform, format and performance"],
  ["Pricing", "pricing.html", "Plans and prices"], ["Blog", "blog.html", "Sports social media trends, content ideas and news"], ["Social News", "news.html", "Daily updates from Instagram, TikTok, YouTube, X and AI explained for sports teams"],
  ["Book a demo", "book-a-call.html", "A 30-minute call with the team"], ["Contact", "contact.html", "How to reach us"]];
write("llms.txt", `# ${ORG.name}

> ${ORG.description}

${seo.llms_about ? `${seo.llms_about.trim()}\n\n` : ""}## Main pages

${KEY_PAGES.map(([t, u, d]) => `- [${t}](${SITE}/${u}): ${d}`).join("\n")}

## Blog

${posts.map((p) => `- [${p.title}](${SITE}/blog/${p.slug}.html): ${p.excerpt}`).join("\n")}
${news?.length ? `\n## Latest Social News\n\n${news.slice(0, 30).map((n) => `- [${n.title}](${SITE}/news/${n.slug}.html): ${cut(newsDesc(n), 160)}`).join("\n")}\n` : ""}`);

// ---------- The website's main pages (Admin → SEO → Page check): title and description chosen there (seo.pages), and
// whatever Google needs that a page lacks — canonical, social preview, WebPage schema — written between SEO-META markers ----------
const MAIN_PAGES = { "index.html": "Home", "pricing.html": "Pricing", "blog.html": "Blog", "news.html": "Social News", "book-a-call.html": "Book a demo", "contact.html": "Contact", "signup.html": "Sign up" };
for (const [file, name] of Object.entries(MAIN_PAGES)) {
  let html = read(file);
  if (["blog.html", "news.html"].includes(file)) html = html.replace(/<html lang="en"[^>]*>/, '<html lang="en" data-page-lang="en">');   // also at /es/ (js/i18n.js)
  const o = (seo.pages || {})[file] || {};
  html = html.replace(/\n?\s*<!-- SEO-META:START -->[\s\S]*?<!-- SEO-META:END -->/, "");
  if (o.title) html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(o.title)}</title>`);
  if (o.description) html = /<meta name="description"[^>]*>/.test(html) ? html.replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(o.description)}">`) : html.replace("</title>", `</title>\n  <meta name="description" content="${esc(o.description)}">`);
  const head = html.slice(0, html.indexOf("</head>")), has = (re) => re.test(head);
  const url = `${SITE}/${file === "index.html" ? "" : file}`, title = (head.match(/<title>([\s\S]*?)<\/title>/) || [, ""])[1].trim(), desc = (head.match(/<meta name="description" content="([^"]*)"/) || [, ""])[1];
  const tags = [
    !has(/rel="canonical"/) && `<link rel="canonical" href="${url}">`,
    !has(/property="og:title"/) && `<meta property="og:title" content="${title}">`,
    !has(/property="og:description"/) && desc && `<meta property="og:description" content="${desc}">`,
    !has(/property="og:url"/) && `<meta property="og:url" content="${url}">`,
    !has(/property="og:type"/) && `<meta property="og:type" content="website">`,
    !has(/property="og:site_name"/) && `<meta property="og:site_name" content="Sports Content Playbook">`,
    !has(/property="og:image"/) && `<meta property="og:image" content="${seo.og_image || `${SITE}/assets/hero-library.png`}">`,
    !has(/name="twitter:card"/) && `<meta name="twitter:card" content="summary_large_image">`,
    ["blog.html", "news.html"].includes(file) && alternates(file).trim().replace(/\n\s*/g, "\n  "),
    !has(/application\/ld\+json/) && `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "WebPage", name: title, description: desc, url, isPartOf: { "@type": "WebSite", name: "Sports Content Playbook", url: `${SITE}/` } })}</script>`,
  ].filter(Boolean);
  if (tags.length) html = html.replace("</head>", `  <!-- SEO-META:START -->\n  ${tags.join("\n  ")}\n  <!-- SEO-META:END -->\n</head>`);
  write(file, html);
}

// ---------- /es/blog.html and /es/news.html: the listings with the Spanish articles / news (copies of the English pages) ----------
fs.mkdirSync(path.join(ROOT, "es"), { recursive: true });
for (const file of ["blog.html", "news.html"]) {
  let html = read(file);
  const swap = (block, content) => { const a = html.indexOf(`<!-- ${block}:START -->`), b = html.indexOf(`<!-- ${block}:END -->`); if (a >= 0 && b >= 0) html = `${html.slice(0, a + block.length + 15)}\n${content}\n        ${html.slice(b)}`; };
  if (file === "blog.html") swap("POSTS", posts.map((p) => card(p, "es")).join("\n"));
  else { swap("BLOG", posts.slice(0, 3).map((p) => card(p, "es")).join("\n")); if (news) swap("NEWS", news.slice(0, 12).map((n) => newsRow(n, "es")).join("\n")); }
  html = html.replace(/<html lang="[^"]*"[^>]*>/, '<html lang="es" data-page-lang="es">').replace("<head>", '<head>\n  <base href="../">')
    .replaceAll(`href="${SITE}/${file}"`, `href="${SITE}/es/${file}"`).replaceAll(`content="${SITE}/${file}"`, `content="${SITE}/es/${file}"`)
    .replace(`hreflang="en" href="${SITE}/es/${file}"`, `hreflang="en" href="${SITE}/${file}"`).replace(`hreflang="x-default" href="${SITE}/es/${file}"`, `hreflang="x-default" href="${SITE}/${file}"`);
  write(`es/${file}`, html);
}

// ---------- The menu's Resources panel (js/nav-menu.js): the newest article and news item ----------
const lastPost = posts[0], lastNews = news?.[0];
write("content/latest.json", `${JSON.stringify({
  blog: lastPost ? { title: lastPost.title, href: `blog/${lastPost.slug}.html`, image: `assets/blog/${lastPost.image.file}`, date: lastPost.date } : null,
  news: lastNews ? { title: lastNews.title, href: `news/${lastNews.slug}.html`, image: lastNews.image_url || "", platform: lastNews.platform, date: newsDay(lastNews) } : null,
}, null, 2)}\n`);

// ---------- Sitemap & robots ----------
const pages = ["", "pricing.html", "blog.html", "news.html", "book-a-call.html", "contact.html", "signup.html"];
const today = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${pages.map((p) => `  <url><loc>${SITE}/${p}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
${posts.map((p) => `  <url><loc>${SITE}/blog/${p.slug}.html</loc><lastmod>${p.updated || p.date}</lastmod><image:image><image:loc>${SITE}/assets/blog/${p.image.file}</image:loc><image:title>${esc(p.image.title || p.title)}</image:title><image:caption>${esc(p.image.alt)}</image:caption></image:image></url>`).join("\n")}
${(news || []).map((n) => `  <url><loc>${SITE}/news/${n.slug}.html</loc><lastmod>${(n.edited_at || n.published_at || n.created_at).slice(0, 10)}</lastmod></url>`).join("\n")}
  <url><loc>${SITE}/es/blog.html</loc><lastmod>${today}</lastmod></url>
  <url><loc>${SITE}/es/news.html</loc><lastmod>${today}</lastmod></url>
${posts.filter((p) => p.es).map((p) => `  <url><loc>${SITE}/es/blog/${p.slug}.html</loc><lastmod>${p.updated || p.date}</lastmod></url>`).join("\n")}
${(news || []).filter((n) => n.es).map((n) => `  <url><loc>${SITE}/es/news/${n.slug}.html</loc><lastmod>${(n.edited_at || n.published_at || n.created_at).slice(0, 10)}</lastmod></url>`).join("\n")}
</urlset>
`;
write("sitemap.xml", sitemap);
// AI crawlers: all welcome unless switched off in Admin → SEO (seo.bots = { GPTBot: false, … })
const blocked = Object.entries(seo.bots || {}).filter(([, on]) => on === false).map(([b]) => b);
write("robots.txt", `User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /admin/\nDisallow: /content-library.html\n${blocked.map((b) => `\nUser-agent: ${b}\nDisallow: /\n`).join("")}\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`\nBuilt ${posts.length} post(s), ${news ? `${news.length} news page(s), ` : ""}blog listing, sitemap.xml, robots.txt and llms.txt.`);
