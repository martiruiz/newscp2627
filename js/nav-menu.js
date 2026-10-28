// Main menu: wide pill tabs with drop-down panels, built here for every page (one place to edit the content).
// Panel types (like the reference design):
//   "grid"     eyebrow + title (with a highlighted part) + items in two columns (icon, title, description)
//   "about"    greeting + title + subtitle + links in two columns + a featured box at the bottom
//   "contact"  a short list of links (icon, title, description) + "Follow us" cards (Instagram, LinkedIn, TikTok)
//   no panel   a plain link tab
// Items with member: true only show when signed in (any page, a session saved in this browser).
// Items with noPlan: true (and every "featured" box) only show without a plan: visitors, or members with no plan contracted;
// items with plan: true only show to members with a plan.
// The texts below are placeholders until the final content is decided.
(() => {
  const MENU = [
    {
      // the three pillars of the product; each card opens its tool (members) or its explanation (visitors)
      label: "Platform", type: "pillars",
      // same colours and little visuals as the home (index.html .tools): Library gold, Content Plan blue (centre), AI purple
      pillars: [
        { icon: "layout-grid", title: "Content Library", href: "content-library.html", acc: "240, 184, 74", vis: "lib" },
        { icon: "calendar-days", title: "Content Plan", href: "content-plan.html", acc: "122, 162, 255", vis: "cp" },
        { icon: "sparkles", title: "AI analysis", href: "index.html#ai-analysis", memberHref: "content-library.html?ai=mine", acc: "167, 139, 250", vis: "ai" },
      ],
      more: [
        { icon: "arrow-up-right", title: "Try it free for 7 days", href: "signup.html", noPlan: true },
      ],
    },
    {
      // the newest news item / article big on the left (content/latest.json, written by blog-tools/build.mjs; tabs switch between
      // them) and a list on the right, each section with its own colour (gold, pink, red, green) and one line on what's there
      label: "Resources", type: "resources",
      cards: [
        { icon: "bookmark", title: "Saved boards", href: "saved.html", acc: "240, 184, 74", member: true },
        { icon: "file-text", title: "Blog", href: "blog.html", acc: "244, 114, 182" },
        { icon: "newspaper", title: "Social News", href: "news.html", acc: "255, 92, 92" },
        { icon: "briefcase", title: "Jobs", href: "jobs.html", acc: "52, 211, 153" },
      ],
      featured: { eyebrow: "What is SCP?", title: "Sports Content Playbook in 2 minutes", href: "index.html#what-is-scp" },
    },
    // My Club for everyone (where Solutions was): a club's own space for its members, the premium offer for everyone else
    { label: "My Club", type: "club", premium: true },
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
        { name: "TikTok", handle: "@sportscontentplaybook", desc: "Sports content ideas in short videos", href: "https://www.tiktok.com/@sportscontentplaybook" },
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
    newspaper: '<path d="M15 18h-5M18 14h-8"/><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2"/><rect x="10" y="6" width="8" height="4" rx="1"/>',
    briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  };
  const icon = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ""}</svg>`;
  const CHEV = `<svg class="mm-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;
  const SOCIAL = {
    Instagram: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" stroke="none" d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077"/></svg>`,
    LinkedIn: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" stroke="none" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
    TikTok: `<svg viewBox="-2 -2 28 28" aria-hidden="true"><path fill="#25f4ee" stroke="none" transform="translate(-1 -.9)" d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/><path fill="#fe2c55" stroke="none" transform="translate(1 .9)" d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/><path fill="#fff" stroke="none" d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>`,
  };
  // the home's little tool visuals (index.html), animated by the same styles
  const VIS = {
    lib: `<span class="tool-vis tv-lib" aria-hidden="true"><span class="tv-grid">${["10229", "18490", "21156", "3655", "4146", "4219"].map((n) => `<i style="background-image:url(assets/lib/${n}.jpg)"></i>`).join("")}</span></span>`,
    ai: `<span class="tool-vis tv-ai" aria-hidden="true"><span class="tv-ai-img" style="background-image:url(assets/ai-example-messi.jpg)"><i class="tv-scan"></i></span><span class="tv-ai-rows"><span><b>Hook</b><i></i></span><span><b>Why it works</b><i></i></span><span><b>Your version</b><i></i></span></span></span>`,
    cp: `<span class="tool-vis tv-cp" aria-hidden="true"><span class="tv-week">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => `<span><small>${d}</small>${Array.from({ length: [2, 3, 2, 1, 2, 3, 1][i] }, (_, k) => `<i style="--k:${i + k}"></i>`).join("")}</span>`).join("")}</span><span class="tv-bar"><i></i></span></span>`,
  };
  // Resources: what shows before the newest article / news / your boards arrive (filled in by fillResources)
  // signed in (also on the public pages, whose nav doesn't show the account: a Supabase session saved in this browser)
  const signedIn = member || (() => { try { return Object.keys(localStorage).some((k) => /^sb-.+-auth-token$/.test(k)); } catch { return false; } })();
  const show = (it) => !it.member || signedIn;
  // hidden for members until their entitlements say they have no plan (staff counts as having one) — shown straight away
  // when the last visit already knew, so the menu doesn't jump when the answer arrives
  const known = (() => { try { return localStorage.getItem("scp-navplan"); } catch { return null; } })();
  const np = member ? ` data-noplan${known === "0" ? "" : " hidden"}` : "";
  const attrs = (it) => it.plan ? ` data-plan${member && known === "1" ? "" : " hidden"}` : it.noPlan ? np : "";

  function panel(m, id) {
    if (m.type === "pillars") return `<div class="mm-panel mm-pillars" id="${id}" role="region" aria-label="${esc(m.label)}">
      <div class="mm-pcols">${m.pillars.map((p) => `<a class="mm-pillar" href="${esc(member && p.memberHref ? p.memberHref : p.href)}" style="--acc:${p.acc}">
        ${VIS[p.vis] || ""}<span class="mm-pillar-h"><span class="mm-ic">${icon(p.icon)}</span><b>${esc(p.title)}</b></span></a>`).join("")}</div>
      ${m.more?.filter(show).length ? `<div class="mm-ptab"${m.more.some((l) => l.noPlan) ? np : ""}>${m.more.filter(show).map((l) => `<a href="${esc(l.href)}">${icon(l.icon)}${esc(l.title)}</a>`).join("")}</div>` : ""}</div>`;
    if (m.type === "resources") {
      return `<div class="mm-panel mm-res" id="${id}" role="region" aria-label="${esc(m.label)}">
      <div class="mm-res-grid">
        <div class="mm-rfeat" data-rfeat>
          <div class="mm-rfeat-tabs" role="tablist"><button type="button" role="tab" aria-selected="true" data-rfeat-tab="news">Social News</button><button type="button" role="tab" aria-selected="false" data-rfeat-tab="blog">Blog</button></div>
          <a class="mm-rfeat-link" href="news.html" data-rfeat-link><em data-rfeat-when></em><b data-rfeat-title>Social News</b><span data-rfeat-go>Read the news →</span></a>
        </div>
        <div class="mm-rlist">${m.cards.filter(show).map((c) => `<a class="mm-rrow${c.member ? " mm-rrow-gold" : ""}" href="${esc(c.href)}" style="--acc:${c.acc}"><span class="mm-ic">${icon(c.icon)}</span>
          <span class="mm-rrow-t"><b>${esc(c.title)}</b></span>${c.member ? `<span class="mm-rcount" data-rv-n hidden></span>` : `<span class="mm-rarrow" aria-hidden="true">→</span>`}</a>`).join("")}
          <a class="mm-rfaq" href="index.html#faq"><b>Is it made for clubs like mine?</b><small>Yes: real posts from 770+ clubs and 110+ competitions.</small></a>
        </div>
      </div>
      ${m.featured ? `<a class="mm-featured mm-featured-sm"${np} href="${esc(m.featured.href)}"><span><i>${esc(m.featured.eyebrow)}</i><b>${esc(m.featured.title)}</b></span>${icon("arrow-up-right")}</a>` : ""}</div>`;
    }
    // My Club: the premium plan for clubs — what it is and an invitation to try it 7 days
    if (m.type === "club") return `<div class="mm-panel mm-clubp" id="${id}" role="region" aria-label="${esc(m.label)}">
      <div class="mm-clubp-vis"><span class="mm-clubp-crown" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M2 7l5 4 5-7 5 7 5-4-2 12H4z"/></svg></span>
        <p class="mm-clubp-t">Your club, with its own library</p><p class="mm-clubp-s">The most complete plan, tailored to your club.</p></div>
      <div class="mm-clubp-body"><ul>${["First team, sections and academy", "Your players' and sponsors' posts, in one place", "We upload your club's posts every day", "Private: only your marketing and communications team can see it"].map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        <a class="lock-go is-best mm-clubp-go" href="book-a-call.html?for=clubs" data-cta="menu-my-club"><span>Try it 7 days</span><i aria-hidden="true">→</i></a></div></div>`;
    if (m.type === "grid") return `<div class="mm-panel mm-grid" id="${id}" role="region" aria-label="${esc(m.label)}">
      <p class="mm-eyebrow">${esc(m.eyebrow)}</p><p class="mm-title">${esc(m.title)} <em>${esc(m.highlight)}</em></p>
      <div class="mm-cols">${m.items.filter(show).map((i) => `<a class="mm-item" href="${esc(i.href)}"><span class="mm-ic">${icon(i.icon)}</span><span><b>${esc(i.title)}</b><small>${esc(i.desc)}</small></span></a>`).join("")}</div></div>`;
    if (m.type === "about") return `<div class="mm-panel mm-about" id="${id}" role="region" aria-label="${esc(m.label)}">
      ${m.title ? `<p class="mm-hello">${esc(m.hello)}</p><p class="mm-title">${esc(m.title)} <em>${esc(m.highlight)}</em></p><p class="mm-sub">${esc(m.sub)}</p>` : ""}
      <div class="mm-cols${!m.title && m.links.filter(show).length === 3 ? " mm-cols-3" : ""}">${m.links.filter(show).map((l) => `<a class="mm-link" href="${esc(l.href)}"><b>${esc(l.title)}</b><small>${esc(l.desc)}</small></a>`).join("")}</div>
      ${m.featured ? `<a class="mm-featured${m.featured.desc ? "" : " mm-featured-sm"}"${np} href="${esc(m.featured.href)}"><span><i>${esc(m.featured.eyebrow)}</i><b>${esc(m.featured.title)}</b>${m.featured.desc ? `<small>${esc(m.featured.desc)}</small>` : ""}</span>${icon("arrow-up-right")}</a>` : ""}</div>`;
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
    if (!m.type) return `<div class="mm-tab${m.premium ? " mm-club" : ""}"${attrs(m)}><a class="mm-btn-tab${m.badge ? " mm-flip" : ""}" href="${esc(m.href)}"><span>${esc(m.label)}</span>${m.badge ? `<span class="mm-badge">${esc(m.badge)}</span>` : ""}</a></div>`;
    const id = `mm-p${i}`;
    return `<div class="mm-tab mm-has${m.premium ? " mm-club" : ""}" data-mm${attrs(m)}><button class="mm-btn-tab" type="button" aria-expanded="false" aria-controls="${id}">${m.premium ? `<svg class="mm-crown" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 7l5 4 5-7 5 7 5-4-2 12H4z"/></svg>` : ""}${esc(m.label)}${CHEV}</button>${panel(m, id)}</div>`;
  }).join("");

  if (member) window.SCP_entitlements?.().then(({ data }) => {
    if (!data) return;
    const hasPlan = !!(data.plan || data.is_staff);
    links.querySelectorAll("[data-plan]").forEach((el) => { el.hidden = !hasPlan; });
    links.querySelectorAll("[data-noplan]").forEach((el) => { el.hidden = hasPlan; });
    try { localStorage.setItem("scp-navplan", hasPlan ? "1" : "0"); } catch {}
  }).catch(() => {});

  // Resources: the newest article and news item (content/latest.json) and, for members, their saved boards — asked once,
  // the first time the menu is opened
  let resDone = false;
  async function fillResources() {
    if (resDone) return; resDone = true;
    const feat = links.querySelector("[data-rfeat]");
    const when = (d) => { const days = Math.floor((Date.now() - new Date(`${d}T12:00:00`)) / 864e5); return days < 1 ? "Today" : days === 1 ? "Yesterday" : days <= 7 && d ? "New" : new Date(`${d}T12:00:00`).toLocaleDateString(window.SCP_LOC || "en-GB", { day: "numeric", month: "short" }); };
    const T = (t, v = {}) => (window.tx ? window.tx(t, v) : t.replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m));
    try {
      const j = await (await fetch("content/latest.json", { cache: "no-cache" })).json();
      const show = (k) => {
        const it = j[k] && { ...j[k], ...(window.SCP_LANG === "es" && j.es?.[k]) }; if (!it || !feat) return;   // in Spanish: the translated title and page
        feat.querySelectorAll("[data-rfeat-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.rfeatTab === k)));
        feat.style.backgroundImage = it.image ? `linear-gradient(180deg, rgba(0,0,0,0) 25%, rgba(0,0,0,.85)), url("${it.image.replace(/"/g, "%22")}")` : "";
        feat.querySelector("[data-rfeat-link]").href = it.href;
        feat.querySelector("[data-rfeat-title]").textContent = it.title;
        feat.querySelector("[data-rfeat-when]").textContent = T(when(it.date));
        feat.querySelector("[data-rfeat-go]").textContent = `${T(k === "news" ? "Read the news" : "Read the article")} →`;
      };
      feat?.querySelectorAll("[data-rfeat-tab]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); show(b.dataset.rfeatTab); }));
      show(j.news ? "news" : "blog");
    } catch {}
    const db = window.SCP_AUTH?.client, sv = links.querySelector(".mm-res [data-rv-n]");
    if (!db || !sv) return;
    const { data: items } = await db.from("folder_items").select("post_id").limit(1000).then((r) => r, () => ({}));
    const ids = [...new Set((items || []).map((it) => Number(String(it.post_id).replace(/^ci-/, ""))).filter(Boolean))];
    // the same count as the Saved page: each post once, only the ones still available
    const { count } = ids.length ? await db.from("content_ideas").select("id", { count: "exact", head: true }).in("id", ids).is("unavailable_at", null) : { count: 0 };
    if (count) { sv.textContent = T("{n} posts", { n: count }); sv.hidden = false; }
  }
  links.querySelector(".mm-res")?.closest("[data-mm]")?.addEventListener("mouseenter", fillResources);
  links.querySelector(".mm-res")?.closest("[data-mm]")?.addEventListener("click", fillResources);

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
    b.addEventListener("click", () => {
      // My Club with a mouse: the panel already opened on hover, so a click goes to the page (a tap still opens the panel)
      if (t.querySelector(".mm-clubp") && hoverable.matches && !nav.classList.contains("is-tight")) return void (location.href = "my-club.html");
      set(t, !t.classList.contains("is-open"));
    });
    t.addEventListener("mouseenter", () => { if (!hoverable.matches || nav.classList.contains("is-tight")) return; clearTimeout(timer); set(t, true); });
    t.addEventListener("mouseleave", () => { if (!hoverable.matches || nav.classList.contains("is-tight")) return; timer = setTimeout(() => set(t, false), 180); });
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".mm-tab")) set(null, false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && nav.classList.contains("mm-open")) { const open = tabs.find((t) => t.classList.contains("is-open")); set(null, false); open?.querySelector(".mm-btn-tab").focus(); } });
  links.addEventListener("click", (e) => { if (e.target.closest(".mm-panel a, a.mm-btn-tab")) set(null, false); });

  // Phones: a tab bar at the bottom — Library · Plan · My Club (raised, gold, crown) · Boards · Menu (opens the full menu)
  const here = location.pathname.split("/").pop() || "index.html";
  const TABS = [
    { label: "Library", href: "content-library.html", ic: "layout-grid" },
    { label: "Plan", href: "content-plan.html", ic: "calendar-days" },
    { label: "My Club", href: "my-club.html", club: true },
    { label: "Boards", href: "saved.html", ic: "bookmark" },
  ];
  const bar = document.createElement("nav");
  bar.className = "tabbar";
  bar.setAttribute("aria-label", "Shortcuts");
  bar.innerHTML = TABS.map((t) => `<a class="tb-item${t.club ? " tb-club" : ""}" href="${t.href}"${here === t.href ? ' aria-current="page"' : ""}>
      ${t.club ? `<span class="tb-crown"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 7l5 4 5-7 5 7 5-4-2 12H4z"/></svg></span>` : icon(t.ic)}<span>${esc(t.label)}</span></a>`).join("")
    + `<button class="tb-item" type="button" aria-expanded="false" data-tb-menu><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg><span>Menu</span></button>`;
  document.body.append(bar);
  document.body.classList.add("has-tabbar");
  const mb = bar.querySelector("[data-tb-menu]");
  mb.addEventListener("click", () => { nav.querySelector("[data-nav-toggle]")?.click(); if (nav.classList.contains("is-open")) scrollTo({ top: 0 }); });
  new MutationObserver(() => mb.setAttribute("aria-expanded", String(nav.classList.contains("is-open")))).observe(nav, { attributes: true, attributeFilter: ["class"] });
})();
