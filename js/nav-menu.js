// Main menu: wide pill tabs with drop-down panels, built here for every page (one place to edit the content).
// Panel types (like the reference design):
//   "grid"     eyebrow + title (with a highlighted part) + items in two columns (icon, title, description)
//   "about"    greeting + title + subtitle + links in two columns + a featured box at the bottom
//   "contact"  a short list of links (icon, title, description) + "Follow us" cards (Instagram, LinkedIn)
//   no panel   a plain link tab
// Items with member: true only show when signed in (pages with the profile link in the nav).
// Items with noPlan: true (and every "featured" box) only show without a plan: visitors, or members with no plan contracted;
// items with plan: true only show to members with a plan.
// The texts below are placeholders until the final content is decided.
(() => {
  const MENU = [
    {
      // the three pillars of the product; each card opens its tool (members) or its explanation (visitors)
      label: "Platform", type: "pillars",
      // same order, colours and little visuals as the home (index.html .tools): Library gold, AI purple, Content Plan blue
      pillars: [
        { icon: "layout-grid", title: "Content Library", href: "content-library.html", acc: "240, 184, 74", vis: "lib" },
        { icon: "sparkles", title: "AI analysis", href: "index.html#ai-analysis", memberHref: "content-library.html?ai=mine", acc: "167, 139, 250", vis: "ai" },
        { icon: "calendar-days", title: "Content Plan", href: "content-plan.html", acc: "122, 162, 255", vis: "cp" },
      ],
      more: [
        { icon: "arrow-up-right", title: "Try it free for 7 days", href: "signup.html", noPlan: true },
      ],
    },
    {
      // no heading: the links go straight in one row (three columns; two when there are four)
      label: "Resources", type: "about",
      links: [
        { title: "Saved boards", desc: "The posts you saved, by board.", href: "saved.html", member: true },
        { title: "Blog", desc: "Ideas and trends in sports social.", href: "blog.html" },
        { title: "Social News", desc: "What's happening on club accounts.", href: "news.html" },
        { title: "FAQ", desc: "Everything you want to know before starting.", href: "index.html#faq" },
      ],
      featured: { eyebrow: "What is SCP?", title: "Sports Content Playbook in 2 minutes", desc: "The platform, explained.", href: "index.html#what-is-scp" },
    },
    // only for members of a club (Admin → My Club): their players' and sponsors' posts
    { label: "My Club", href: "my-club.html", club: true },
    {
      // only before buying (visitors and members without a plan)
      label: "Solutions", type: "about", noPlan: true,
      hello: "Built for", title: "Every team that creates", highlight: "sports content", sub: "From one creator to a whole club department.",
      links: [
        { title: "Content creators", desc: "Formats and hooks that work in sports.", href: "book-a-call.html?for=creators" },
        { title: "Clubs", desc: "Matchday, signings, kits and sponsors, all season.", href: "book-a-call.html?for=clubs" },
        { title: "Leagues & federations", desc: "Content for every club and competition you run.", href: "book-a-call.html?for=leagues" },
        { title: "Brands & sponsors", desc: "See how others activate their sports partnerships.", href: "book-a-call.html?for=brands" },
      ],
      featured: { eyebrow: "Free trial", title: "Try it free for 7 days", desc: "The full library, no commitment.", href: "signup.html" },
    },
    // only without a plan, with the free-trial badge
    { label: "Pricing", href: "pricing.html", badge: "7 days free", noPlan: true },
    {
      label: "Contact", type: "contact",
      links: [
        { icon: "calendar-days", title: "Book a demo", desc: "See the platform with your use case.", href: "book-a-call.html", noPlan: true },
        { icon: "life-buoy", title: "Support", desc: "Questions about your account or your plan.", href: "contact.html?topic=support", plan: true },
        { icon: "mail", title: "Write to us", desc: "Send us a message.", href: "contact.html" },
      ],
      social: [
        { name: "Instagram", handle: "@sportscontentplaybook", desc: "The best sports posts, every day", href: "https://www.instagram.com/sportscontentplaybook" },
        { name: "LinkedIn", handle: "Sports Content Playbook", desc: "Trends and insights for your team", href: "https://www.linkedin.com/company/sportscontentplaybook" },
      ],
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
    "life-buoy": '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><path d="m4.93 4.93 4.24 4.24M14.83 9.17l4.24-4.24M14.83 14.83l4.24 4.24M9.17 14.83l-4.24 4.24"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  };
  const icon = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ""}</svg>`;
  const CHEV = `<svg class="mm-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;
  const SOCIAL = {
    Instagram: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>`,
    LinkedIn: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7"/></svg>`,
  };
  // the home's little tool visuals (index.html), animated by the same styles
  const VIS = {
    lib: `<span class="tool-vis tv-lib" aria-hidden="true"><span class="tv-grid">${["10229", "18490", "21156", "3655", "4146", "4219"].map((n) => `<i style="background-image:url(assets/lib/${n}.jpg)"></i>`).join("")}</span></span>`,
    ai: `<span class="tool-vis tv-ai" aria-hidden="true"><span class="tv-ai-img" style="background-image:url(assets/ai-example-messi.jpg)"><i class="tv-scan"></i></span><span class="tv-ai-rows"><span><b>Hook</b><i></i></span><span><b>Why it works</b><i></i></span><span><b>Your version</b><i></i></span></span></span>`,
    cp: `<span class="tool-vis tv-cp" aria-hidden="true"><span class="tv-week">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => `<span><small>${d}</small>${Array.from({ length: [2, 3, 2, 1, 2, 3, 1][i] }, (_, k) => `<i style="--k:${i + k}"></i>`).join("")}</span>`).join("")}</span><span class="tv-bar"><i></i></span></span>`,
  };
  const show = (it) => !it.member || member;
  // hidden for members until their entitlements say they have no plan (staff counts as having one)
  const np = member ? " data-noplan hidden" : "";
  const attrs = (it) => it.club ? " data-club hidden" : it.plan ? " data-plan hidden" : it.noPlan ? np : "";

  function panel(m, id) {
    if (m.type === "pillars") return `<div class="mm-panel mm-pillars" id="${id}" role="region" aria-label="${esc(m.label)}">
      <div class="mm-pcols">${m.pillars.map((p) => `<a class="mm-pillar" href="${esc(member && p.memberHref ? p.memberHref : p.href)}" style="--acc:${p.acc}">
        ${VIS[p.vis] || ""}<span class="mm-pillar-h"><span class="mm-ic">${icon(p.icon)}</span><b>${esc(p.title)}</b></span></a>`).join("")}</div>
      ${m.more?.filter(show).length ? `<div class="mm-ptab"${m.more.some((l) => l.noPlan) ? np : ""}>${m.more.filter(show).map((l) => `<a href="${esc(l.href)}">${icon(l.icon)}${esc(l.title)}</a>`).join("")}</div>` : ""}</div>`;
    if (m.type === "grid") return `<div class="mm-panel mm-grid" id="${id}" role="region" aria-label="${esc(m.label)}">
      <p class="mm-eyebrow">${esc(m.eyebrow)}</p><p class="mm-title">${esc(m.title)} <em>${esc(m.highlight)}</em></p>
      <div class="mm-cols">${m.items.filter(show).map((i) => `<a class="mm-item" href="${esc(i.href)}"><span class="mm-ic">${icon(i.icon)}</span><span><b>${esc(i.title)}</b><small>${esc(i.desc)}</small></span></a>`).join("")}</div></div>`;
    if (m.type === "about") return `<div class="mm-panel mm-about" id="${id}" role="region" aria-label="${esc(m.label)}">
      ${m.title ? `<p class="mm-hello">${esc(m.hello)}</p><p class="mm-title">${esc(m.title)} <em>${esc(m.highlight)}</em></p><p class="mm-sub">${esc(m.sub)}</p>` : ""}
      <div class="mm-cols${!m.title && m.links.filter(show).length === 3 ? " mm-cols-3" : ""}">${m.links.filter(show).map((l) => `<a class="mm-link" href="${esc(l.href)}"><b>${esc(l.title)}</b><small>${esc(l.desc)}</small></a>`).join("")}</div>
      ${m.featured ? `<a class="mm-featured"${np} href="${esc(m.featured.href)}"><span><i>${esc(m.featured.eyebrow)}</i><b>${esc(m.featured.title)}</b><small>${esc(m.featured.desc)}</small></span>${icon("arrow-up-right")}</a>` : ""}</div>`;
    if (m.type === "contact") return `<div class="mm-panel mm-contact" id="${id}" role="region" aria-label="${esc(m.label)}">
      ${m.links.map((l) => `<a class="mm-item" href="${esc(l.href)}"${attrs(l)}><span class="mm-ic">${icon(l.icon)}</span><span><b>${esc(l.title)}</b><small>${esc(l.desc)}</small></span></a>`).join("")}
      <p class="mm-follow-h">Follow us</p>
      <div class="mm-follow">${m.social.map((s) => `<a class="mm-fl mm-fl-${s.name.toLowerCase()}" href="${esc(s.href)}" target="_blank" rel="noopener">
        <span class="mm-fl-ic">${SOCIAL[s.name] || ""}</span><span class="mm-fl-tx"><b>${esc(s.name)}</b><small>${esc(s.desc)}</small></span>${icon("arrow-up-right")}</a>`).join("")}</div></div>`;
    return "";
  }

  // right side: language (js/i18n.js) and day / night (js/theme.js) are added by their scripts; the main button gets
  // the arrow in a circle; "Book a demo" lives in the menu now
  nav.querySelector(".nav-demo")?.remove();
  const cta = nav.querySelector(".nav-actions .btn-gold");
  if (cta && !cta.querySelector(".nav-cta-ic")) { cta.classList.add("nav-cta"); cta.insertAdjacentHTML("beforeend", `<span class="nav-cta-ic">${icon("arrow-up-right")}</span>`); }

  links.classList.add("mm");
  links.innerHTML = MENU.map((m, i) => {
    if (!m.type) return `<div class="mm-tab"${attrs(m)}><a class="mm-btn-tab" href="${esc(m.href)}"><span>${esc(m.label)}</span>${m.badge ? `<span class="mm-badge">${esc(m.badge)}</span>` : ""}</a></div>`;
    const id = `mm-p${i}`;
    return `<div class="mm-tab mm-has" data-mm${attrs(m)}><button class="mm-btn-tab" type="button" aria-expanded="false" aria-controls="${id}">${esc(m.label)}${CHEV}</button>${panel(m, id)}</div>`;
  }).join("");

  if (member) window.SCP_entitlements?.().then(({ data }) => {
    if (!data) return;
    const hasPlan = !!(data.plan || data.is_staff);
    links.querySelectorAll(hasPlan ? "[data-plan]" : "[data-noplan]").forEach((el) => { el.hidden = false; });
  }).catch(() => {});
  // My Club: only when this account can open a club (supabase/my-club.sql)
  if (member) window.SCP_AUTH?.client?.rpc("my_clubs").then(({ data }) => {
    if (Array.isArray(data) && data.length) links.querySelectorAll("[data-club]").forEach((el) => { el.hidden = false; });
  }, () => {});

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
