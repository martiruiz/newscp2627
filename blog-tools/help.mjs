// SCP Knowledge Base: the help centre, built by blog-tools/build.mjs from content/help/*.json (one file per article,
// English and Spanish inside it):
//   - help/index.html / es/help/index.html      the portal at /help/: search, start here, categories, recommended, every article
//   - help/<slug>.html / es/help/<slug>.html     one page per article: banner, body, "On this page", still stuck, more in the category
// Each article carries Article + BreadcrumbList (+ FAQPage when it has questions) schema for Google and AI assistants.
import fs from "node:fs";
import path from "node:path";

export const CATS = {
  "getting-started": { en: "Getting Started", es: "Primeros pasos", den: "First steps and onboarding", des: "Primeros pasos y puesta en marcha", icon: "rocket", c: "37, 99, 235" },
  "content-library": { en: "Content Library", es: "Biblioteca de contenido", den: "Discovering and analysing content", des: "Descubrir y analizar contenido", icon: "library", c: "139, 92, 246" },
  "ai-tools": { en: "AI Tools", es: "Herramientas de IA", den: "Artificial intelligence for your content", des: "Inteligencia artificial para tu contenido", icon: "sparkles", c: "217, 119, 6" },
  "my-club": { en: "My Club", es: "My Club", den: "Your club's own space", des: "El espacio de tu club", icon: "shield", c: "5, 150, 105" },
  "content-planner": { en: "Content Planner", es: "Planificador de contenido", den: "Organising and planning", des: "Organizar y planificar", icon: "calendar", c: "234, 88, 12" },
  "account-billing": { en: "Account & Billing", es: "Cuenta y facturación", den: "Account, plans and billing", des: "Cuenta, planes y facturación", icon: "card", c: "100, 116, 139" },
  "tips": { en: "Tips & Best Practices", es: "Consejos y buenas prácticas", den: "Getting more out of SCP", des: "Sacar más partido a SCP", icon: "lightbulb", c: "219, 39, 119" },
};

// Lucide-style icons, inline so the static pages need no script
const I = {
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  library: '<path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/>',
  sparkles: '<path d="M9.94 14.06 7.5 21l-2.44-6.94L-1.88 11.6 5.06 9.15 7.5 2.2l2.44 6.94 6.94 2.45z" transform="translate(4 0) scale(.85)"/><path d="M20 3v4"/><path d="M22 5h-4"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/>',
  card: '<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>',
  lightbulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  book: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
};
const svg = (n, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || ""}</svg>`;

const T = {
  kb: ["SCP Knowledge Base", "SCP Knowledge Base"],
  tagline: ["Everything you need to create better sports content with Sports Content Playbook.", "Todo lo que necesitas para crear mejor contenido deportivo con Sports Content Playbook."],
  search: ["Search articles, guides and tutorials…", "Busca artículos, guías y tutoriales…"],
  noResults: ["No article matches your search. Try another word or write to us.", "Ningún artículo coincide con tu búsqueda. Prueba otra palabra o escríbenos."],
  startHere: ["Start here", "Empieza aquí"],
  startSub: ["New to SCP? Four steps from your first look to your first content idea.", "¿Nuevo en SCP? Cuatro pasos desde el primer vistazo hasta tu primera idea de contenido."],
  browse: ["Browse by category", "Explora por categoría"],
  recommended: ["Recommended", "Recomendado"],
  articles: ["articles", "artículos"],
  viewAll: ["View all", "Ver todos"],
  home: ["Home", "Inicio"],
  updated: ["Updated", "Actualizado"],
  onPage: ["On this page", "En esta página"],
  stuck: ["Still stuck?", "¿Sigues con dudas?"],
  stuckText: ["Our team is happy to help. Write to us and we'll answer you personally.", "Nuestro equipo te ayuda encantado. Escríbenos y te responderemos personalmente."],
  contact: ["Contact support", "Contactar con soporte"],
  moreIn: ["More in", "Más en"],
  faq: ["Frequently asked questions", "Preguntas frecuentes"],
  minRead: ["min read", "min de lectura"],
  next: ["Next step", "Siguiente paso"],
  tryTitle: ["Try it with real posts", "Pruébalo con posts reales"],
  tryText: ["Start your 7-day free trial and find your next content idea in the Content Library.", "Empieza tu prueba gratis de 7 días y encuentra tu próxima idea de contenido en la Biblioteca."],
  tryBtn: ["Try it for free", "Pruébalo gratis"],
};
// Screenshots of the real product (assets/help/<lang>/<name>.jpg, 800×487, captured from the site in each language):
// which ones each article shows, and after which of its sections (0 = the first)
const SHOT_TXT = {
  library: ["The Content Library: the filters on the left, the posts on the right.", "La Biblioteca de contenido: los filtros a la izquierda y los posts a la derecha."],
  search: ["A sentence search turned into filters: Overperforming, Reel and Signing.", "Una búsqueda escrita como frase, convertida en filtros: Overperforming, Reel y Fichaje."],
  analysis: ["The AI analysis of a post: summary, hook with its template and why it works.", "El análisis con IA de un post: resumen, hook con su plantilla y por qué funciona."],
  ready: ["Ready to use: three hook ideas, a shot list and a caption draft.", "Listo para usar: tres ideas de hook, una lista de planos y un borrador del texto."],
  planner: ["The Content Plan: the week by day and hour, statuses, weekly base and the No date tray.", "El Plan de contenido: la semana por día y hora, estados, base semanal y la bandeja Sin fecha."],
  "plan-panel": ["The Content Plan panel inside the library: drag posts onto a day or use Fill my week.", "El panel del Plan de contenido dentro de la biblioteca: arrastra posts a un día o usa Llenar mi semana."],
  plans: ["The plans on the pricing page (monthly prices, per user).", "Los planes en la página de precios (precios mensuales, por usuario)."],
};
const SHOTS = {
  "what-is-sports-content-playbook": [["library", 0], ["analysis", 1]],
  "how-to-get-started-with-sports-content-playbook": [["library", 1]],
  "main-features-of-sports-content-playbook": [["library", 0], ["analysis", 1], ["planner", 2]],
  "find-your-first-content-idea-in-5-minutes": [["search", 1], ["ready", 3]],
  "how-to-use-the-content-library": [["library", 0], ["analysis", 2]],
  "how-to-search-and-filter-content-ideas": [["search", 0]],
  "top-picks-replicable-ideas-and-overperforming": [["library", 0]],
  "how-to-analyze-a-content-idea": [["analysis", 1], ["ready", 2]],
  "how-to-adapt-a-content-idea-to-your-club": [["ready", 1]],
  "how-to-find-trending-sports-content": [["search", 1]],
  "how-does-ai-work-in-sports-content-playbook": [["analysis", 0], ["ready", 1]],
  "how-to-generate-content-ideas-with-ai": [["search", 1], ["ready", 2]],
  "how-to-create-captions-hooks-and-scripts-with-ai": [["ready", 0]],
  "how-to-get-better-results-from-ai-suggestions": [["analysis", 1]],
  "how-to-use-the-content-planner": [["planner", 0], ["plan-panel", 2]],
  "how-to-build-a-monthly-content-plan-for-your-club": [["planner", 1]],
  "how-to-organize-your-content-workflow-and-team": [["planner", 1]],
  "starter-plus-and-pro-plans-compared": [["plans", 0]],
  "how-does-the-7-day-free-trial-work": [["plans", 0]],
  "how-to-manage-your-subscription-and-billing": [["plans", 0]],
  "how-to-build-a-sports-content-strategy-with-scp": [["planner", 2]],
  "how-to-turn-one-content-idea-into-multiple-posts": [["ready", 1], ["plan-panel", 3]],
};
const shotSrc = (name, l) => `assets/help/${l}/${name}.jpg`;
const shot = (name, l) => `<figure class="kb-shot"><img src="${shotSrc(name, l)}" alt="${SHOT_TXT[name][l === "es" ? 1 : 0]}" width="800" height="487" loading="lazy"><figcaption>${SHOT_TXT[name][l === "es" ? 1 : 0]}</figcaption></figure>`;
// the article's sections with its screenshots placed after the chosen ones (past the last section: after the last)
const withShots = (a, l) => a[l].body.map((sec, i, all) => {
  const here = (SHOTS[a.slug] || []).filter(([, at]) => Math.min(at, all.length - 1) === i);
  return here.length ? { ...sec, html: `${sec.html}\n${here.map(([n]) => shot(n, l)).join("\n")}` } : sec;
});

const START = ["what-is-sports-content-playbook", "how-to-use-the-content-library", "how-does-ai-work-in-sports-content-playbook", "how-to-set-up-your-club-in-my-club"];
const START_LABEL = { en: ["Discover SCP", "Explore the Content Library", "Use the AI tools", "Set up My Club"], es: ["Descubre SCP", "Explora la Biblioteca", "Usa las herramientas de IA", "Configura My Club"] };

export function buildHelp({ ROOT, SITE, header, footer, withSiteVersions, write, esc, CHECK_ONLY }) {
  const dir = path.join(ROOT, "content/help");
  if (!fs.existsSync(dir)) return { urls: [], articles: [] };
  const articles = fs.readdirSync(dir).filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")))
    .sort((a, b) => a.n - b.n);
  const plain = (h) => String(h || "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
  const bodyWords = (a, l) => a[l].body.reduce((n, s) => n + plain(s.html).split(" ").length, 0);
  const fmt = (d, l) => new Date(d + "T12:00:00Z").toLocaleDateString(l === "es" ? "es-ES" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
  const tx = (k, l) => T[k][l === "es" ? 1 : 0];
  const base = (l) => (l === "es" ? "es/" : "");
  const href = (a, l) => `${base(l)}help/${a.slug}.html`;
  const alt = (p) => `
  <link rel="alternate" hreflang="en" href="${SITE}/${p}">
  <link rel="alternate" hreflang="es" href="${SITE}/es/${p}">
  <link rel="alternate" hreflang="x-default" href="${SITE}/${p}">`;
  // the article's banner: the category colour, its icon and a short label (like a thumbnail)
  const banner = (a, l, big = false) => {
    const c = CATS[a.cat];
    return `<div class="kb-ban${big ? " kb-ban-lg" : ""}" style="--c:${c.c}" aria-hidden="true"><span class="kb-ban-ic">${svg(c.icon)}</span><span class="kb-ban-l">${esc(a[l].label)}</span></div>`;
  };
  const card = (a, l) => `<a class="kb-card" href="${href(a, l)}" data-kb-card>${banner(a, l)}<span class="kb-card-b"><b>${esc(a[l].title)}</b>${a.recommended ? `<em class="kb-rec">${tx("recommended", l)}</em>` : ""}</span></a>`;
  const head = (l, { title, desc, canonical, altPath, ld = [], image = null }) => `<!doctype html>
<html lang="${l}" data-page-lang="${l}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="${l === "es" ? "../../" : "../"}">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${canonical}">${alt(altPath)}
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Sports Content Playbook">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${image || `${SITE}/assets/hero-library.png`}">
  <meta name="twitter:card" content="summary_large_image">
${ld.map((x) => `  <script type="application/ld+json">${JSON.stringify(x)}</script>`).join("\n")}
  <link rel="icon" type="image/png" sizes="32x32" href="assets/favicon-s-32.png">
  <link rel="icon" type="image/png" sizes="192x192" href="assets/favicon-s-192.png">
  <link rel="apple-touch-icon" href="assets/apple-touch-icon-s.png">
  <link rel="stylesheet" href="css/fonts.css?v=1">
  <link rel="stylesheet" href="css/styles.css">
  <link rel="stylesheet" href="css/help.css?v=20261112b">
  <script src="js/theme.js"></script>
  <script src="js/i18n.js"></script>
</head>
<body class="kb-page">

  ${header}
`;
  const tail = (extra = "") => `
  ${footer}

  <script src="js/config.js"></script>
  <script src="js/nav-menu.js"></script>
  <script src="js/consent.js"></script>
  <script src="js/lead-flow.js"></script>
  <script src="js/promo-bar.js"></script>
  <script src="js/main.js"></script>
  <script src="js/site-stats.js" defer></script>${extra}
  <script src="js/help.js?v=20261112d"></script>
</body>
</html>
`;

  if (!CHECK_ONLY) for (const d of ["help", "es/help"]) fs.mkdirSync(path.join(ROOT, d), { recursive: true });
  const urls = [];
  for (const l of ["en", "es"]) {
    // ---------- Article pages ----------
    for (const a of articles) {
      const A = a[l], c = CATS[a.cat], url = `${SITE}/${href(a, l)}`;
      // what to read next: the article's own "next", else the following one
      const next = articles.find((o) => o.slug === a.next) || articles.find((o) => o.n === a.n + 1);
      const more = articles.filter((o) => o.cat === a.cat && o.slug !== a.slug && o !== next).slice(0, 3);
      const minutes = Math.max(1, Math.round(bodyWords(a, l) / 220));
      const ld = [
        { "@context": "https://schema.org", "@type": "TechArticle", headline: A.title, description: A.meta_description, inLanguage: l, dateModified: a.updated, datePublished: a.published || a.updated,
          articleSection: c[l], keywords: (a.keywords || []).join(", "), ...(SHOTS[a.slug] ? { image: SHOTS[a.slug].map(([n]) => `${SITE}/${shotSrc(n, l)}`) } : {}), author: { "@type": "Organization", name: "Sports Content Playbook" },
          publisher: { "@type": "Organization", name: "Sports Content Playbook", logo: { "@type": "ImageObject", url: `${SITE}/assets/icon-logo-lg.png` } }, mainEntityOfPage: url },
        { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: tx("home", l), item: `${SITE}/${base(l)}` },
          { "@type": "ListItem", position: 2, name: T.kb[0], item: `${SITE}/${base(l)}help/` },
          { "@type": "ListItem", position: 3, name: c[l], item: `${SITE}/${base(l)}help/#${a.cat}` },
          { "@type": "ListItem", position: 4, name: A.title, item: url }] },
        ...(A.faq?.length ? [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: A.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: plain(f.a) } })) }] : []),
      ];
      const page = head(l, { title: A.meta_title, desc: A.meta_description, canonical: url, altPath: `help/${a.slug}.html`, ld, image: SHOTS[a.slug] ? `${SITE}/${shotSrc(SHOTS[a.slug][0][0], l)}` : null }) + `
  <main class="kb">
    <div class="container kb-wrap">
      <nav class="kb-crumbs" aria-label="Breadcrumb"><a href="${base(l)}help/">${T.kb[0]}</a><span>›</span><a href="${base(l)}help/#${a.cat}">${esc(c[l])}</a></nav>
      ${banner(a, l, true)}
      <div class="kb-art">
        <article class="kb-main">
          <h1>${esc(A.title)}</h1>
          <p class="kb-meta"><span class="kb-tag" style="--c:${c.c}">${esc(c[l])}</span>${a.recommended ? `<span class="kb-tag kb-tag-rec">${tx("recommended", l)}</span>` : ""}<span>${tx("updated", l)} <time datetime="${a.updated}">${fmt(a.updated, l)}</time> · ${minutes} ${tx("minRead", l)}</span></p>
          <p class="kb-lead">${esc(A.summary)}</p>
          <div class="kb-body">
${withShots(a, l).map((s) => `            <section id="${s.id}"><h2>${esc(s.h)}</h2>\n${s.html}\n            </section>`).join("\n")}
${A.faq?.length ? `            <section id="faq" class="kb-faq"><h2>${tx("faq", l)}</h2>\n${A.faq.map((f) => `              <details><summary>${esc(f.q)}</summary><p>${f.a}</p></details>`).join("\n")}\n            </section>` : ""}
          </div>
${next ? `          <a class="kb-next" href="${href(next, l)}" style="--c:${CATS[next.cat].c}"><span class="kb-next-ic">${svg(CATS[next.cat].icon)}</span><span><em>${tx("next", l)}</em><b>${esc(next[l].title)}</b></span>${svg("arrow", "kb-next-go")}</a>
` : ""}          <aside class="kb-try"><div><b>${tx("tryTitle", l)}</b><p>${tx("tryText", l)}</p></div><a class="btn btn-gold" href="signup.html" data-cta="kb-${a.slug}">${tx("tryBtn", l)}</a></aside>
          <aside class="kb-stuck"><span class="kb-stuck-ic">${svg("mail")}</span><div><b>${tx("stuck", l)}</b><p>${tx("stuckText", l)}</p></div><a class="btn btn-outline" href="contact.html?topic=support">${tx("contact", l)}</a></aside>
        </article>
        <nav class="kb-toc" aria-label="${tx("onPage", l)}"><p>${tx("onPage", l)}</p><ol>${A.body.map((s) => `<li><a href="${href(a, l)}#${s.id}">${esc(s.h)}</a></li>`).join("")}${A.faq?.length ? `<li><a href="${href(a, l)}#faq">${tx("faq", l)}</a></li>` : ""}</ol></nav>
      </div>
${more.length ? `      <section class="kb-more"><div class="kb-sec-h"><h2>${tx("moreIn", l)} ${esc(c[l])}</h2><a href="${base(l)}help/#${a.cat}">${tx("viewAll", l)} →</a></div>
        <div class="kb-grid">${more.map((o) => card(o, l)).join("")}</div></section>` : ""}
    </div>
  </main>
` + tail();
      write(href(a, l), withSiteVersions(page));
      urls.push({ loc: url, lastmod: a.updated });
    }

    // ---------- The portal ----------
    const url = `${SITE}/${base(l)}help/`;
    // the search reads every word of the article once (title, summary, headings, body, questions), lowercase and without accents
    const words = (a) => [...new Set(plain(`${a[l].title} ${a[l].summary} ${CATS[a.cat][l]} ${(a.keywords || []).join(" ")} ${a[l].body.map((s) => `${s.h} ${s.html}`).join(" ")} ${(a[l].faq || []).map((f) => `${f.q} ${f.a}`).join(" ")}`)
      .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9€]+/).filter((w) => w.length > 2))].join(" ");
    const index = articles.map((a) => ({ t: a[l].title, d: a[l].summary, k: words(a), q: `${a[l].body.map((s) => s.h).join(" ")} ${(a[l].faq || []).map((f) => f.q).join(" ")}`, h: href(a, l), c: CATS[a.cat][l] }));
    const ld = [{ "@context": "https://schema.org", "@type": "CollectionPage", name: `${T.kb[0]} · Sports Content Playbook`, description: tx("tagline", l), url, inLanguage: l,
      hasPart: articles.map((a) => ({ "@type": "TechArticle", headline: a[l].title, url: `${SITE}/${href(a, l)}` })) }];
    const page = head(l, { title: `${T.kb[0]}: guides and answers · Sports Content Playbook`.replace("guides and answers", l === "es" ? "guías y respuestas" : "guides and answers"), desc: tx("tagline", l), canonical: url, altPath: "help/", ld }) + `
  <main class="kb">
    <div class="container kb-wrap">
      <section class="kb-hero">
        <span class="kb-hero-ic">${svg("book")}</span>
        <p class="kb-hero-k">Sports Content Playbook</p>
        <h1>${T.kb[0]}</h1>
        <p class="kb-hero-s">${tx("tagline", l)}</p>
        <label class="kb-search">${svg("search")}<input type="search" placeholder="${tx("search", l)}" autocomplete="off" data-kb-search aria-label="${tx("search", l)}"><kbd>/</kbd></label>
        <div class="kb-results" data-kb-results hidden></div>
        <p class="kb-none" data-kb-none hidden>${tx("noResults", l)} <a href="contact.html?topic=support">${tx("contact", l)} →</a></p>
      </section>

      <section class="kb-start">
        <div class="kb-sec-h"><div><h2>${tx("startHere", l)}</h2><p>${tx("startSub", l)}</p></div></div>
        <ol class="kb-steps">${START.map((s, i) => articles.find((a) => a.slug === s)).filter(Boolean).map((a, i) => `<li><a href="${href(a, l)}"><span class="kb-step-n">${i + 1}</span><b>${START_LABEL[l][i]}</b><small>${esc(a[l].title)}</small>${svg("arrow", "kb-step-go")}</a></li>`).join("")}</ol>
      </section>

      <section class="kb-cats">
        <h2>${tx("browse", l)}</h2>
        <div class="kb-chips">${Object.entries(CATS).map(([k, c]) => `<a class="kb-chip" href="${base(l)}help/#${k}" style="--c:${c.c}">${esc(c[l])}<i>${articles.filter((a) => a.cat === k).length}</i></a>`).join("")}</div>
      </section>

      <section class="kb-recs">
        <div class="kb-sec-h"><h2>${svg("star", "kb-star")}${tx("recommended", l)}</h2></div>
        <div class="kb-grid">${articles.filter((a) => a.recommended).map((a) => card(a, l)).join("")}</div>
      </section>

${Object.entries(CATS).map(([k, c]) => `      <section class="kb-catsec" id="${k}" style="--c:${c.c}">
        <div class="kb-sec-h"><h2><span class="kb-cat-ic">${svg(c.icon)}</span>${esc(c[l])}<i>${articles.filter((a) => a.cat === k).length}</i></h2><p>${esc(l === "es" ? c.des : c.den)}</p></div>
        <div class="kb-grid">${articles.filter((a) => a.cat === k).map((a) => card(a, l)).join("")}</div>
      </section>`).join("\n")}
    </div>
  </main>
` + tail(`\n  <script type="application/json" data-kb-index>${JSON.stringify(index).replace(/</g, "\\u003c")}</script>`);
    write(`${base(l)}help/index.html`, withSiteVersions(page));
    urls.push({ loc: url, lastmod: articles.reduce((m, a) => (a.updated > m ? a.updated : m), "") });
  }
  return { urls, articles };
}
