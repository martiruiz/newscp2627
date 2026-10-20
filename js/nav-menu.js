// Main menu: wide pill tabs with drop-down panels, built here for every page (one place to edit the content).
// Panel types (like the reference design):
//   "grid"     eyebrow + title (with a highlighted part) + items in two columns (icon, title, description)
//   "about"    greeting + title + subtitle + links in two columns + a featured box at the bottom
//   "contact"  greeting + title + subtitle + a visual with floating chips + text + social icons + two buttons
//   no panel   a plain link tab
// Items with member: true only show when signed in (pages with the profile link in the nav).
// The texts below are placeholders until the final content is decided.
(() => {
  const MENU = [
    {
      label: "Platform", type: "grid",
      eyebrow: "The platform", title: "Everything your sports content needs,", highlight: "in one place",
      items: [
        { icon: "layout-grid", title: "Content Library", desc: "500,000+ real posts from clubs, leagues and creators.", href: "content-library.html" },
        { icon: "search", title: "Smart search", desc: "Search by sport, club, format, hook or views.", href: "index.html#library" },
        { icon: "trophy", title: "Top Picks & smart filters", desc: "The posts that work, picked and tagged for you.", href: "content-library.html" },
        { icon: "sparkles", title: "AI analysis", desc: "Why a post worked and how to adapt it.", href: "index.html#ai-analysis" },
        { icon: "calendar-days", title: "Content Plan", desc: "Plan your week by dragging ideas in.", href: "index.html#content-plan" },
        { icon: "file-text", title: "Social News", desc: "What sports accounts post, every day.", href: "news.html" },
      ],
    },
    {
      label: "Solutions", type: "about",
      hello: "Built for", title: "Every team that creates", highlight: "sports content", sub: "From one creator to a whole club department.",
      links: [
        { title: "Clubs", desc: "Matchday, signings, kits and sponsors, all season.", href: "book-a-call.html?for=clubs" },
        { title: "Leagues & federations", desc: "Content for every club and competition you run.", href: "book-a-call.html?for=leagues" },
        { title: "Brands & sponsors", desc: "See how others activate their sports partnerships.", href: "book-a-call.html?for=brands" },
        { title: "Content creators", desc: "Formats and hooks that work in sports.", href: "book-a-call.html?for=creators" },
        { title: "Agencies", desc: "Ideas and benchmarks for every client.", href: "book-a-call.html?for=agencies" },
        { title: "Athletes", desc: "Grow your personal brand with proven formats.", href: "book-a-call.html?for=athletes" },
      ],
      featured: { eyebrow: "Free trial", title: "Try it free for 7 days", desc: "The full library, no commitment.", href: "signup.html" },
    },
    {
      label: "Resources", type: "about",
      hello: "Learn", title: "Ideas and trends in", highlight: "sports social media", sub: "Free, every week.",
      links: [
        { title: "How it works", desc: "From idea to published post.", href: "index.html#how-it-works" },
        { title: "Blog", desc: "Ideas and trends in sports social.", href: "blog.html" },
        { title: "Social News", desc: "What's happening on club accounts.", href: "news.html" },
        { title: "FAQ", desc: "Everything you want to know before starting.", href: "index.html#faq" },
        { title: "Pricing & plans", desc: "Plans for creators, clubs and teams.", href: "pricing.html" },
        { title: "Book a demo", desc: "See the platform with your use case.", href: "book-a-call.html" },
      ],
      featured: { eyebrow: "What is SCP?", title: "Sports Content Playbook in 2 minutes", desc: "The platform, explained.", href: "index.html#what-is-scp" },
    },
    { label: "Pricing", href: "pricing.html" },
    {
      label: "Contact", type: "contact",
      hello: "Hi,", title: "We are", highlight: "SCP", sub: "Sports Content Playbook",
      chips: ["🏆 Top Picks", "📈 +2M views", "🎬 Reel ideas", "🗓️ Content Plan"],
      text: "We help clubs, leagues, athletes and agencies find what works and plan their content faster.",
      social: [{ name: "Instagram", href: "#" }, { name: "LinkedIn", href: "#" }],
      primary: { label: "Book a demo", href: "book-a-call.html" }, secondary: { label: "Contact", href: "contact.html" },
    },
  ];

  const nav = document.querySelector("[data-nav]");
  const links = nav?.querySelector(".nav-links");
  if (!links) return;
  const member = !!nav.querySelector("[data-user-link]");
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  // icons (outline, Lucide shapes) — own copy so every page has them, even without js/icons.js
  const ICONS = {
    "layout-grid": '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    "calendar-days": '<path d="M8 2v4M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>',
    sparkles: '<path d="M9.94 15.5a2 2 0 0 0-1.44-1.44l-6.13-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0l1.58 6.14a2 2 0 0 0 1.44 1.44l6.14 1.58a.5.5 0 0 1 0 .96l-6.14 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.13a.5.5 0 0 1-.96 0z"/>',
    "file-text": '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/>',
    bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    "arrow-up-right": '<path d="M7 7h10v10M7 17 17 7"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  };
  const icon = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ""}</svg>`;
  const CHEV = `<svg class="mm-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;
  const SOCIAL = {
    Instagram: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>`,
    LinkedIn: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7"/></svg>`,
  };
  const show = (it) => !it.member || member;

  function panel(m, id) {
    if (m.type === "grid") return `<div class="mm-panel mm-grid" id="${id}" role="region" aria-label="${esc(m.label)}">
      <p class="mm-eyebrow">${esc(m.eyebrow)}</p><p class="mm-title">${esc(m.title)} <em>${esc(m.highlight)}</em></p>
      <div class="mm-cols">${m.items.filter(show).map((i) => `<a class="mm-item" href="${esc(i.href)}"><span class="mm-ic">${icon(i.icon)}</span><span><b>${esc(i.title)}</b><small>${esc(i.desc)}</small></span></a>`).join("")}</div></div>`;
    if (m.type === "about") return `<div class="mm-panel mm-about" id="${id}" role="region" aria-label="${esc(m.label)}">
      <p class="mm-hello">${esc(m.hello)}</p><p class="mm-title">${esc(m.title)} <em>${esc(m.highlight)}</em></p><p class="mm-sub">${esc(m.sub)}</p>
      <div class="mm-cols">${m.links.filter(show).map((l) => `<a class="mm-link" href="${esc(l.href)}"><b>${esc(l.title)}</b><small>${esc(l.desc)}</small></a>`).join("")}</div>
      ${m.featured ? `<a class="mm-featured" href="${esc(m.featured.href)}"><span><i>${esc(m.featured.eyebrow)}</i><b>${esc(m.featured.title)}</b><small>${esc(m.featured.desc)}</small></span>${icon("arrow-up-right")}</a>` : ""}</div>`;
    if (m.type === "contact") return `<div class="mm-panel mm-contact" id="${id}" role="region" aria-label="${esc(m.label)}">
      <p class="mm-hello">${esc(m.hello)}</p><p class="mm-title">${esc(m.title)} <em>${esc(m.highlight)}</em></p><p class="mm-sub">${esc(m.sub)}</p>
      <div class="mm-visual">${m.chips.map((c, i) => `<span class="mm-float mm-f${i}">${esc(c)}</span>`).join("")}</div>
      <p class="mm-text">${esc(m.text)}</p>
      <div class="mm-social">${m.social.map((s) => `<a href="${esc(s.href)}" aria-label="${esc(s.name)}" target="_blank" rel="noopener">${SOCIAL[s.name] || esc(s.name)}</a>`).join("")}</div>
      <div class="mm-btns"><a class="mm-btn is-primary" href="${esc(m.primary.href)}">${esc(m.primary.label)}</a><a class="mm-btn" href="${esc(m.secondary.href)}">${esc(m.secondary.label)}</a></div></div>`;
    return "";
  }

  // right side: language (js/i18n.js) and day / night (js/theme.js) are added by their scripts; the main button gets
  // the arrow in a circle; "Book a demo" lives in the menu now
  nav.querySelector(".nav-demo")?.remove();
  const cta = nav.querySelector(".nav-actions .btn-gold");
  if (cta && !cta.querySelector(".nav-cta-ic")) { cta.classList.add("nav-cta"); cta.insertAdjacentHTML("beforeend", `<span class="nav-cta-ic">${icon("arrow-up-right")}</span>`); }

  links.classList.add("mm");
  links.innerHTML = MENU.map((m, i) => {
    if (!m.type) return `<div class="mm-tab"><a class="mm-btn-tab" href="${esc(m.href)}">${esc(m.label)}</a></div>`;
    const id = `mm-p${i}`;
    return `<div class="mm-tab mm-has" data-mm><button class="mm-btn-tab" type="button" aria-expanded="false" aria-controls="${id}">${esc(m.label)}${CHEV}</button>${panel(m, id)}</div>`;
  }).join("");

  // open on hover (mouse) or click / tap / keyboard; one at a time; Esc or outside closes
  const tabs = [...links.querySelectorAll("[data-mm]")];
  let timer;
  const set = (tab, open) => {
    tabs.forEach((t) => { const o = t === tab && open; t.classList.toggle("is-open", o); t.querySelector(".mm-btn-tab").setAttribute("aria-expanded", String(o)); });
    nav.classList.toggle("mm-open", tabs.some((t) => t.classList.contains("is-open")));
  };
  const hoverable = matchMedia("(hover: hover) and (pointer: fine)");
  tabs.forEach((t) => {
    const b = t.querySelector(".mm-btn-tab");
    b.addEventListener("click", () => set(t, !t.classList.contains("is-open")));
    t.addEventListener("mouseenter", () => { if (!hoverable.matches || nav.classList.contains("is-tight")) return; clearTimeout(timer); set(t, true); });
    t.addEventListener("mouseleave", () => { if (!hoverable.matches || nav.classList.contains("is-tight")) return; timer = setTimeout(() => set(t, false), 180); });
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".mm-tab")) set(null, false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && nav.classList.contains("mm-open")) { const open = tabs.find((t) => t.classList.contains("is-open")); set(null, false); open?.querySelector(".mm-btn-tab").focus(); } });
  links.addEventListener("click", (e) => { if (e.target.closest(".mm-panel a, a.mm-btn-tab")) set(null, false); });
})();
