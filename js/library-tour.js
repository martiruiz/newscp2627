// Content Library: a short guided tour the first time a member with the library comes in (remembered in this browser, once
// finished or skipped): the filters on the left · the open Content Creators menu · the bar's three filters · My space · the
// buttons on each post. The first time it waits for the cookie notice and the lead questions, and never starts over an open
// post or the Content Plan. The "?" next to My space shows it again.
(async () => {
  const KEY = "scp-library-tour";
  const { data: ent } = await window.SCP_entitlements?.().catch(() => ({})) || {};
  if (!ent || !(ent.is_staff || ent.has_library)) return;

  const tx = (t, v) => (window.tx ? window.tx(t, v) : t);
  const $ = (s) => document.querySelector(s);
  const narrow = () => matchMedia("(max-width: 960px)").matches;
  const shown = (el) => { const r = el?.getBoundingClientRect(); return !!r && r.width > 0 && r.height > 0; };
  const inView = (el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; };
  const firstRail = () => { const all = [...document.querySelectorAll(".lib-card .lib-rail")].filter(shown), covers = all.filter((r) => r.closest(".has-cover")); return covers.find(inView) || covers[0] || all[0]; };
  const filtersEl = () => (narrow() ? $("[data-collapse]") : $(".library.filters-collapsed") ? $("[data-show-filters]") : $("[data-filters]"));
  const ccBtn = () => $(".lf-sp-creators");
  const ccSub = () => $(".lf-cc-sub");
  let ccOpened = false, ccClosed = false;   // the tour opened or closed Content Creators, so it leaves it as it was
  const RAIL = [
    [".lib-grip", "Drag to your Content Plan", "move the post onto a date in your plan."],
    [".save-btn", "Save", "keep it in one of your boards."],
    [".lib-ai", "AI analysis", "the hook, why it works and how to adapt it to your club."],
    [".lib-share", "Public link", "copy a link that shows only this post, to share it with anyone."],
    [".lib-remove", "Remove", "take it out of the library (superadmins only)."],
  ];
  const STEPS = [
    { el: filtersEl, title: "Filters", text: () => tx(narrow() ? "Tap here to search by word or narrow the posts: favourites, replicable ideas, creators, top performers, views, platform, format, duration and language." : "Search by word or narrow the posts: favourites, replicable ideas, creators, top performers, views, platform, format, duration and language.") },
    { el: () => (narrow() ? $("[data-collapse]") : ccSub()), title: "Content Creators",
      when: () => { const b = ccBtn(); return b && !b.matches(".is-locked, .is-zero") && !$(".library.filters-collapsed"); },
      enter: () => { const b = ccBtn(); if (b && !b.classList.contains("is-on")) { b.click(); ccOpened = true; } },
      leave: () => { if (ccOpened) { ccBtn()?.click(); ccOpened = false; } },
      rect: (r) => { const b = !narrow() && ccBtn()?.getBoundingClientRect(); return b ? { left: b.left, right: Math.max(b.right, r.right), top: b.top, bottom: r.bottom, width: Math.max(b.right, r.right) - b.left, height: r.bottom - b.top } : r; },
      text: () => tx(narrow() ? "Inside Filters, tap Content Creators and this menu opens:" : "Turn it on and this menu opens:"),
      list: () => [["", "Creators / Posts", "see the creators one by one, or just their posts."],
        ["", "Accounts", "find a creator and star your favourites."],
        ["", "Followers", "choose the size you're looking for."],
        ["", "Language and gender", "narrow by the creator's profile."],
        ["", "Each creator", "followers, recent collabs and their best posts."]] },
    { el: () => (narrow() ? $("[data-collapse]") : $("[data-lf-bar] .lfb-row")), title: "The main filters", text: () => tx(narrow() ? "Inside Filters you'll also find these three:" : "Choose what you're looking for:"),
      list: () => [["", "Inspiration from", "sports, competitions, clubs, players and challenges."],
        ["", "Match Day", "before, during and after the match, plus kits and the season's big moments."],
        ["", "Brands & sponsors", "the brands, how they show and what the post should achieve."]] },
    { el: () => $("[data-my-space]"), title: "My space", text: () => tx("Your own work, always at hand:"),
      list: () => [["[data-ai-mine]", "My AI analyses", "the posts you've analysed with AI."],
        ["[data-plan-toggle]", "Content Plan", "your calendar, to plan what you'll post."],
        ["[data-saved-link]", "Saved boards", "the posts you've saved, organised in boards."]] },
    { el: firstRail, title: "On each post",
      enter: () => { const b = ccBtn(); if (b?.classList.contains("is-on")) { b.click(); ccClosed = true; } },   // creators' rows have no post buttons
      leave: () => { if (ccClosed) { ccBtn()?.click(); ccClosed = false; } },
      note: "You can see this tutorial again any time with the ? button.", text: () => tx(matchMedia("(hover: none)").matches ? "Every post has these buttons:" : "Hover over a post and these buttons appear:"),
      list: () => { const rail = firstRail(); return RAIL.filter(([s]) => rail?.querySelector(s)).map(([s, b, t]) => [s, b, t]); } },
  ];

  const ready = () => !$(".ck") && !$(".lead-modal") && $("[data-drawer]")?.hidden && !$(".library.plan-open") && !location.hash.includes("post=")
    && firstRail() && shown($("[data-my-space]")) && (narrow() || shown($("[data-lf-bar] .lfb-row")));
  let open = false;

  function start() {
    if (open) return;
    open = true;
    const steps = STEPS.filter((s) => !s.when || s.when());
    const y0 = scrollY, back = document.activeElement;
    const root = document.createElement("div");
    root.className = "tour";
    root.innerHTML = `<div class="tour-block"></div><div class="tour-spot"></div>
      <div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title">
        <small class="tour-n"></small><h2 id="tour-title"></h2><p class="tour-text"></p><ul class="tour-list"></ul><p class="tour-note"></p>
        <div class="tour-foot"><button class="tour-skip" type="button">${tx("Skip tutorial")}</button><span><button class="pill pill-dark tour-back" type="button">${tx("Back")}</button><button class="btn btn-gold tour-next" type="button"></button></span></div>
      </div>`;
    document.body.append(root);
    const spot = root.querySelector(".tour-spot"), box = root.querySelector(".tour-card"), nextBtn = root.querySelector(".tour-next");
    let at = 0, target = null, raf = 0, turn = 0;

    function place() {
      if (!target?.isConnected) target = steps[at].el();
      if (!shown(target)) return;
      const box0 = target.getBoundingClientRect(), r = steps[at].rect ? steps[at].rect(box0) : box0, pad = 6, gap = 16, m = 12;
      Object.assign(spot.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
      const w = box.offsetWidth, h = box.offsetHeight;
      const midX = r.left + r.width / 2 - w / 2, midY = r.top + r.height / 2 - h / 2;
      const spots = [[r.right + gap + pad, midY, innerWidth - r.right - pad - gap >= w + m], [r.left - gap - pad - w, midY, r.left - pad - gap >= w + m],
        [midX, r.bottom + gap + pad, innerHeight - r.bottom - pad - gap >= h + m], [midX, r.top - gap - pad - h, r.top - pad - gap >= h + m]];
      const wide = r.width > innerWidth / 2;   // a wide target (the bar, My space): under or over it
      const [x, y] = (wide ? [spots[2], spots[3], spots[0], spots[1]] : spots).find((s) => s[2]) || [midX, innerHeight - h - m];
      box.style.left = `${Math.max(m, Math.min(x, innerWidth - w - m))}px`;
      box.style.top = `${Math.max(m, Math.min(y, innerHeight - h - m))}px`;
    }
    const replace = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(place); };

    async function show(i) {
      const my = ++turn;
      steps[at].leave?.();
      at = i;
      document.querySelector(".lib-card.is-tour")?.classList.remove("is-tour");
      const s = steps[i];
      s.enter?.();
      target = s.el();
      // what it points at may still be loading (Content Creators' menu, the posts coming back after it)
      nextBtn.disabled = true;
      for (let k = 0; k < 40 && !shown(target); k++) { await new Promise((r) => setTimeout(r, 100)); if (my !== turn) return; target = s.el(); }
      nextBtn.disabled = false;
      if (!shown(target)) return i < steps.length - 1 ? show(i + 1) : end();
      target?.closest(".lib-card")?.classList.add("is-tour");
      // on a phone the card goes under the target, so the target goes near the top
      if (target && i) {
        if (narrow()) {
          const to = (y) => scrollBy({ top: target.getBoundingClientRect().top - y, behavior: "instant" });
          to(90);
          if (!$("[data-lib-head]").contains(target)) to(Math.max(90, $("[data-lib-head]").getBoundingClientRect().bottom + 16));   // clear of the head when it sticks
        } else target.scrollIntoView({ block: "center", behavior: "instant" });
      }
      root.querySelector(".tour-n").textContent = tx("Step {n} of {total}", { n: i + 1, total: steps.length });
      root.querySelector("#tour-title").textContent = tx(s.title);
      root.querySelector(".tour-text").textContent = s.text();
      const ul = root.querySelector(".tour-list");
      ul.replaceChildren(...(s.list?.() || []).map(([sel, b, t]) => {
        const li = document.createElement("li");
        const ico = sel && target.querySelector(`${sel} svg`);
        if (ico) { const k = document.createElement("span"); k.className = "tour-ic"; k.append(ico.cloneNode(true)); li.append(k); }
        const p = document.createElement("span"), bb = document.createElement("b");
        bb.textContent = tx(b);
        p.append(bb, ` ${tx(t)}`);
        li.append(p);
        return li;
      }));
      const note = root.querySelector(".tour-note");
      note.textContent = s.note ? tx(s.note) : "";
      note.hidden = !s.note;
      root.querySelector(".tour-back").hidden = i === 0;
      nextBtn.textContent = tx(i === steps.length - 1 ? "Done" : "Next");
      place();
      nextBtn.focus({ preventScroll: true });
    }
    function end() {
      turn++; clearInterval(tick); steps[at].leave?.(); open = false;
      try { localStorage.setItem(KEY, "1"); } catch {}
      document.querySelector(".lib-card.is-tour")?.classList.remove("is-tour");
      removeEventListener("resize", replace); removeEventListener("scroll", replace, true); document.removeEventListener("keydown", key, true);
      root.remove();
      scrollTo(0, y0);
      back?.focus?.({ preventScroll: true });
    }
    function key(e) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); end(); }
      else if (e.key === "Tab") {   // the focus stays in the card
        const f = [...box.querySelectorAll("button:not([hidden])")], k = f.indexOf(document.activeElement);
        e.preventDefault(); f[(k + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
      }
    }
    nextBtn.addEventListener("click", () => (at === steps.length - 1 ? end() : show(at + 1)));
    root.querySelector(".tour-back").addEventListener("click", () => show(at - 1));
    root.querySelector(".tour-skip").addEventListener("click", end);
    addEventListener("resize", replace); addEventListener("scroll", replace, true); document.addEventListener("keydown", key, true);
    const tick = setInterval(place, 300);   // the page keeps drawing underneath
    show(0);
  }

  const my = $("[data-my-space]");
  if (my) {
    const help = document.createElement("button");
    help.type = "button"; help.className = "tour-help"; help.textContent = "?";
    help.title = tx("See the tutorial"); help.setAttribute("aria-label", help.title);
    help.addEventListener("click", start);
    my.append(help);
  }
  let seen = true;
  try { seen = !!localStorage.getItem(KEY); } catch {}
  if (seen) return;
  for (let i = 0; i < 150 && !ready() && !open; i++) await new Promise((r) => setTimeout(r, 400));
  if (ready()) start();   // otherwise, next visit
})();
