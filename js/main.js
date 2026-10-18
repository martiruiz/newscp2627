// Sports Content Playbook — shared interactions

// Prices (based on Calcul_Descomptes_Usuaris.xlsx, rounded to commercial whole-euro prices):
// - base: €39 per user per month; volume discount 2 users −10%, 3 users −15%, 5 users −20%
// - yearly billing: about −20% on the monthly price (shown per month, billed once a year)
// Excel → commercial: monthly 39 / 70.20 / 99.45 / 156 → 39 / 69 / 99 / 155
//                     yearly  31.20 / 56.16 / 79.56 / 124.80 → 32 / 55 / 79 / 125
// Totals and savings are derived from these two prices. "Team" (6+ users) has no price: custom proposal.
window.SCP_PRICING = {
  base: 39,
  yearlyDiscount: 20,
  volumeDiscount: { 1: 0, 2: 10, 3: 15, 5: 20 },
  prices: { 1: { monthly: 39, yearly: 32 }, 2: { monthly: 69, yearly: 55 }, 3: { monthly: 99, yearly: 79 }, 5: { monthly: 155, yearly: 125 } },
};
window.SCP_PRICE = (users) => {
  const P = window.SCP_PRICING;
  const tiers = Object.keys(P.prices).map(Number);
  const tier = P.prices[users] ? users : tiers.filter((t) => t <= users).pop() || 1;
  const k = users / tier; // only used if an untabulated number of users is ever asked for
  const monthly = Math.round(P.prices[tier].monthly * k);
  const yearly = Math.round(P.prices[tier].yearly * k);
  const list = P.base * users; // price without any discount
  return {
    users, list, volume: P.volumeDiscount[tier], yearlyDiscount: P.yearlyDiscount,
    monthly, volumeSaving: list - monthly,
    yearly, savingMonth: monthly - yearly, savingYear: (monthly - yearly) * 12, yearlyTotal: yearly * 12,
  };
};
// €39 · €1,500
window.SCP_EUR = (v) => `€${Math.round(Number(v)).toLocaleString(window.SCP_LOC || "en-GB")}`;

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // Home sections fade up as they come into view; cards follow the cursor with a soft light
  const reveal = $$("[data-reveal]");
  if (reveal.length) {
    if (!("IntersectionObserver" in window)) reveal.forEach((el) => el.classList.add("is-in"));
    else {
      const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }), { threshold: 0.15 });
      reveal.forEach((el) => io.observe(el));
    }
    document.addEventListener("pointermove", (e) => {
      const card = e.target.closest?.(".tool, .quote-grid .quote-card");
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  }

  // Click feedback on clickable things: a gold ripple from the pointer + a small press (not with reduced motion)
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const CLICKABLE = ".btn, .tool, .quote-grid .quote-card, .hx-list li, .team-tiles article, .acc-trigger";   // not the plan / pack cards: their badges sit outside the card
    document.addEventListener("pointerdown", (e) => {
      const el = e.target.closest?.(CLICKABLE);
      if (!el || el.disabled) return;
      const r = el.getBoundingClientRect(), size = Math.max(r.width, r.height) * 2.2;
      const dot = document.createElement("span");
      dot.className = "click-ripple";
      dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left}px;top:${e.clientY - r.top}px`;
      el.appendChild(dot);
      setTimeout(() => dot.remove(), 650);
      el.classList.add("is-pressed");
      const up = () => { el.classList.remove("is-pressed"); removeEventListener("pointerup", up); removeEventListener("pointercancel", up); };
      addEventListener("pointerup", up); addEventListener("pointercancel", up);
    });
  }

  // Home FAQ: "Contact us" / "Book a demo" open the form in place of the questions (no page change)
  $$("[data-faq-stage]").forEach((stage) => {
    const panes = $$("[data-faq-pane]", stage);
    const section = stage.closest("section");
    // while a form is open: the button that opened it is marked, clicking it again goes back, and a
    // "Back to questions" button appears next to the others
    const actions = section && $(".faq-intro .actions", section);
    if (actions && !$("[data-faq-back]", actions)) actions.insertAdjacentHTML("beforeend", `<button class="btn btn-outline faq-back-intro" type="button" data-faq-back hidden>${window.tx ? window.tx("← Back to questions") : "← Back to questions"}</button>`);
    let current = "faq";
    const show = (name) => {
      current = name;
      panes.forEach((p) => { const on = p.dataset.faqPane === name; p.hidden = !on; p.classList.toggle("is-on", on); });
      section && $$("[data-faq-open]", section).forEach((b) => { const on = b.dataset.faqOpen === name; b.classList.toggle("is-active", on); b.setAttribute("aria-pressed", String(on)); });
      const back = actions && $("[data-faq-back]", actions);
      if (back) back.hidden = name === "faq";
      if (name !== "faq") $("[data-faq-pane=\"" + name + "\"] input", stage)?.focus({ preventScroll: true });
      stage.closest("section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    document.addEventListener("click", (e) => {
      const open = e.target.closest("[data-faq-open]");
      if (open && section?.contains(open)) { e.preventDefault(); show(current === open.dataset.faqOpen ? "faq" : open.dataset.faqOpen); return; }
      if (open) { e.preventDefault(); show(open.dataset.faqOpen); return; }
      if (e.target.closest("[data-faq-back]") && section?.contains(e.target)) {
        show("faq");
        $$("[data-form-done]", stage).forEach((d) => { d.hidden = true; d.previousElementSibling.hidden = false; });
      }
    });
  });

  // Footer newsletter (same list as the home dock: newsletter_signups, source "footer")
  $$("[data-footer-news]").forEach((form) => {
    const msg = $("[data-footer-news-msg]", form);
    const t = (x) => (window.tx ? window.tx(x) : x);
    const say = (text, ok) => { msg.textContent = t(text); msg.classList.toggle("is-ok", !!ok); msg.hidden = false; };
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const cfg = window.SCP_CONFIG || {};
      const email = form.email.value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { say("Please enter a valid email."); return form.email.focus(); }
      if (!form.consent.checked) return say("Please tick the box so we can send you the newsletter.");
      const btn = $("button[type=submit]", form);
      btn.disabled = true;
      try {
        const res = await fetch(`${cfg.supabaseUrl}/rest/v1/newsletter_signups`, {
          method: "POST",
          headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ email, source: "footer", consent: true, consent_text: "I want the SCP newsletter. I can unsubscribe at any time." }),
        });
        if (!res.ok && res.status !== 409) throw new Error(String(res.status));   // 409 = already subscribed
        form.reset();
        say("You're in! See you on Monday.", true);
      } catch { say("Something went wrong. Please try again in a moment."); }
      finally { btn.disabled = false; }
    });
  });

  // Mobile nav
  $$("[data-nav]").forEach((nav) => {
    const toggle = $("[data-nav-toggle]", nav);
    toggle?.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    $$(".nav-links a", nav).forEach((a) =>
      a.addEventListener("click", () => {
        nav.classList.remove("is-open");
        toggle?.setAttribute("aria-expanded", "false");
      })
    );
    // Use the menu button whenever the links and buttons don't fit on one line (longer Spanish labels, the signed-in
    // nav with avatar + admin, narrower windows), not only below a fixed width.
    const fit = () => {
      if (nav.classList.contains("is-open")) return;
      nav.classList.remove("is-tight");
      const box = (sel) => nav.querySelector(sel)?.getBoundingClientRect();
      const n = nav.getBoundingClientRect(), brand = box(".brand"), links = box(".nav-links"), acts = box(".nav-actions");
      if (!links || !acts || !links.width) return;
      const brandEnd = brand ? brand.left + nav.querySelector(".brand").scrollWidth : 0;
      if (nav.scrollWidth > nav.clientWidth + 1 || acts.right > n.right - 4 || links.right > acts.left || brandEnd > links.left - 8) nav.classList.add("is-tight");
    };
    fit();
    addEventListener("resize", fit);
    document.fonts?.ready.then(fit);
    new MutationObserver(() => requestAnimationFrame(fit)).observe(nav, { childList: true, subtree: true, characterData: true });
  });

  // Mark the current page in the nav
  const page = location.pathname.split("/").pop() || "index.html";
  $$(".nav-links a").forEach((a) => {
    if (a.getAttribute("href") === page) a.setAttribute("aria-current", "page");
  });

  // Horizontal carousels (features)
  $$("[data-carousel]").forEach((root) => {
    const track = $("[data-track]", root);
    const prev = $("[data-prev]", root);
    const next = $("[data-next]", root);
    const step = () => {
      const card = track.firstElementChild;
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return card ? card.getBoundingClientRect().width + gap : 300;
    };
    const update = () => {
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    };
    // Auto-drift: while the carousel is on screen the cards glide slowly to the left, in an endless loop
    // (the cards are cloned once). Pauses while hovered / touched and for a few seconds after the arrows are used.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const SPEED = 18; // px per second
    let loopWidth = 0;
    let pos = 0;
    let visible = false;
    let hovered = false;
    let pausedUntil = 0;
    let last = 0;
    let frame = 0;
    if (!reduced && track.children.length > 1) {
      const originals = [...track.children];
      originals.forEach((card) => {
        const clone = card.cloneNode(true);
        clone.setAttribute("aria-hidden", "true");
        clone.inert = true;
        clone.dataset.clone = "";
        track.appendChild(clone);
      });
      const measure = () => { loopWidth = track.children[originals.length].offsetLeft - track.children[0].offsetLeft; };
      measure();
      window.addEventListener("resize", measure);

      const tick = (now) => {
        frame = 0;
        if (!visible) return;
        const dt = last ? Math.min(now - last, 100) / 1000 : 0;
        last = now;
        if (!hovered && now > pausedUntil) {
          if (Math.abs(track.scrollLeft - pos) > 2) pos = track.scrollLeft; // the user moved it: carry on from there
          pos += SPEED * dt;
          if (loopWidth && pos >= loopWidth) pos -= loopWidth;
          track.scrollLeft = pos;
        } else {
          pos = track.scrollLeft;
        }
        frame = requestAnimationFrame(tick);
      };
      const start = () => { if (!frame) { last = 0; pos = track.scrollLeft; frame = requestAnimationFrame(tick); } };
      new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        track.classList.toggle("is-drifting", visible);
        if (visible) start();
      }, { threshold: 0.35 }).observe(track);

      const pause = (ms) => { pausedUntil = performance.now() + ms; };
      track.addEventListener("pointerenter", () => (hovered = true));
      track.addEventListener("pointerleave", () => { hovered = false; pause(800); });
      track.addEventListener("touchstart", () => pause(4000), { passive: true });
      track.addEventListener("wheel", () => pause(3000), { passive: true });
      [prev, next].forEach((b) => b.addEventListener("click", () => pause(5000)));
    }

    prev.addEventListener("click", () => {
      if (loopWidth && track.scrollLeft < step()) track.scrollLeft += loopWidth; // wrap around backwards
      track.scrollBy({ left: -step(), behavior: "smooth" });
    });
    next.addEventListener("click", () => {
      if (loopWidth && track.scrollLeft + step() > loopWidth) track.scrollLeft -= loopWidth;
      track.scrollBy({ left: step(), behavior: "smooth" });
    });
    const updateArrows = () => (loopWidth ? (prev.disabled = next.disabled = false) : update());
    track.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    updateArrows();
  });

  // Testimonials: arrows move the highlighted card
  $$("[data-quotes]").forEach((root) => {
    const track = $("[data-track]", root);
    const cards = $$(".quote-card", track);
    let active = 0;
    const setActive = (i) => {
      active = (i + cards.length) % cards.length;
      cards.forEach((c, idx) => c.classList.toggle("is-active", idx === active));
      const card = cards[active];
      const left = card.offsetLeft - parseFloat(getComputedStyle(track).scrollPaddingLeft || 0);
      track.scrollTo({ left, behavior: "smooth" });
    };
    $("[data-prev]", root).addEventListener("click", () => setActive(active - 1));
    $("[data-next]", root).addEventListener("click", () => setActive(active + 1));
    cards.forEach((c, i) => c.addEventListener("click", () => setActive(i)));
  });

  // "Magic behind SCP" steps — click to select, auto-advance. The progress can be paused (button on the active step,
  // or by hovering the step text) and resumes where it stopped.
  $$("[data-steps]").forEach((root) => {
    const buttons = $$("[data-step-btn]", root);
    const visuals = $$("[data-step]", root);
    const DURATION = 8000;
    root.style.setProperty("--step-ms", `${DURATION}ms`);
    let current = 1;
    let timer;
    let startedAt = 0, remaining = DURATION;
    let pinned = false, hovering = false, inView = false;
    const PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
    const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>';
    // one pause / play control per step (next to "STEP 0X"); only the active step shows it
    const controls = buttons.map((b) => {
      const c = document.createElement("button");
      c.type = "button";
      c.className = "step-pause";
      c.dataset.stepPause = b.dataset.stepBtn;
      b.parentElement.style.position = "relative";
      b.parentElement.appendChild(c);
      return c;
    });
    const paused = () => pinned || hovering;
    const renderControls = () => controls.forEach((c) => {
      c.innerHTML = pinned ? PLAY : PAUSE;
      c.setAttribute("aria-label", pinned ? "Resume the steps" : "Pause the steps");
      c.title = pinned ? "Resume" : "Pause";
      c.classList.toggle("is-paused", pinned);
    });
    // Fit the visual area to the step being shown (avoids empty space below shorter visuals)
    const fit = () => {
      const active = visuals.find((v) => Number(v.dataset.step) === current);
      const h = active?.firstElementChild?.getBoundingClientRect().height;
      if (h) active.parentElement.style.height = `${Math.ceil(h)}px`;
    };
    root.querySelectorAll("[data-step] img").forEach((img) => img.addEventListener("load", fit));
    window.addEventListener("resize", fit);
    const schedule = () => {
      clearTimeout(timer);
      if (paused() || !inView) return;
      startedAt = performance.now();
      timer = setTimeout(() => show((current % buttons.length) + 1), remaining);
    };
    const freeze = () => {
      if (timer && startedAt) remaining = Math.max(0, remaining - (performance.now() - startedAt));
      clearTimeout(timer); timer = null; startedAt = 0;
    };
    const applyPause = () => {
      root.classList.toggle("steps-paused", paused());
      if (paused()) freeze(); else schedule();
    };
    const show = (n) => {
      current = n;
      remaining = DURATION;
      buttons.forEach((b) => {
        const on = Number(b.dataset.stepBtn) === n;
        b.classList.remove("is-active");
        if (on) {
          void b.offsetWidth; // restart progress animation
          b.classList.add("is-active");
        }
        b.setAttribute("aria-pressed", String(on));
      });
      controls.forEach((c) => c.classList.toggle("is-current", Number(c.dataset.stepPause) === n));
      visuals.forEach((v) => v.classList.toggle("is-active", Number(v.dataset.step) === n));
      fit();
      startedAt = 0;
      schedule();
    };
    buttons.forEach((b) => b.addEventListener("click", () => show(Number(b.dataset.stepBtn))));
    controls.forEach((c) => c.addEventListener("click", () => { pinned = !pinned; renderControls(); applyPause(); }));
    // hovering the active step's text also holds it
    buttons.forEach((b) => {
      b.addEventListener("pointerenter", () => { if (b.classList.contains("is-active")) { hovering = true; applyPause(); } });
      b.addEventListener("pointerleave", () => { if (hovering) { hovering = false; applyPause(); } });
    });
    renderControls();
    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) { if (!startedAt && remaining === DURATION) show(current); else schedule(); }
      else freeze();
    }, { threshold: 0.3 });
    io.observe(root);
  });

  // Accordions (one open at a time)
  $$("[data-accordion]").forEach((acc) => {
    const items = $$(".acc-item", acc);
    items.forEach((item) => {
      const trigger = $(".acc-trigger", item);
      trigger.addEventListener("click", () => {
        const willOpen = !item.classList.contains("is-open");
        items.forEach((other) => {
          other.classList.remove("is-open");
          $(".acc-trigger", other).setAttribute("aria-expanded", "false");
        });
        if (willOpen) {
          item.classList.add("is-open");
          trigger.setAttribute("aria-expanded", "true");
        }
      });
    });
  });

  // Pricing seat picker
  $$("[data-seats]").forEach((picker) => {
    const buttons = $$("button", picker);
    const update = (choice) => {
      buttons.forEach((b) => b.setAttribute("aria-checked", String(b.dataset.n === String(choice))));
      // "Team": no price, a custom proposal instead
      const team = choice === "team";
      $$("[data-price-card]").forEach((card) => card.classList.toggle("is-team", team));
      if (team) {
        $$("[data-seat-label]").forEach((el) => (el.textContent = "Team access for your whole organization"));
        return;
      }
      const n = Number(choice);
      const pr = window.SCP_PRICE(n);
      const values = {
        monthly: pr.monthly, yearly: pr.yearly, "yearly-total": pr.yearlyTotal,
        "saving-month": pr.savingMonth, "saving-year": pr.savingYear, "volume-saving": pr.volumeSaving, list: pr.list,
      };
      $$("[data-amount]").forEach((el) => (el.textContent = window.SCP_EUR(values[el.dataset.amount])));
      $$("[data-discount]").forEach((el) => (el.textContent = `−${pr.yearlyDiscount}%`));
      $$("[data-discount-plain]").forEach((el) => (el.textContent = `${pr.yearlyDiscount}%`));
      $$("[data-volume-pct]").forEach((el) => (el.textContent = `${pr.volume}%`));
      $$("[data-volume-only]").forEach((el) => (el.hidden = !pr.volume));
      $$("[data-plan-link]").forEach((a) => {
        const url = new URL(a.getAttribute("href"), location.href);
        url.searchParams.set("users", String(n));
        a.setAttribute("href", `signup.html${url.search}`);
      });
      $$("[data-seat-label]").forEach((el) => {
        el.textContent = `${n} user${n > 1 ? "s" : ""} access to Sports Content Playbook`;
      });
    };
    buttons.forEach((b) => b.addEventListener("click", () => update(b.dataset.n === "team" ? "team" : Number(b.dataset.n))));
  });

  // Pricing card: Monthly / Yearly switch (the big price, the struck-through monthly price and the plan in the link)
  $$("[data-price-card]").forEach((card) => {
    const toggle = $("[data-billing-toggle]", card);
    const set = (billing) => {
      card.dataset.billing = billing;
      $$("[data-billing]", toggle).forEach((b) => b.setAttribute("aria-checked", String(b.dataset.billing === billing)));
      $$("[data-plan-link]", card).forEach((a) => {
        const url = new URL(a.getAttribute("href"), location.href);
        url.searchParams.set("plan", billing);
        a.setAttribute("href", `signup.html${url.search}`);
      });
    };
    $$("[data-billing]", toggle).forEach((b) => b.addEventListener("click", () => set(b.dataset.billing)));
    $$("[data-billing-switch]", card).forEach((b) => b.addEventListener("click", () => set(b.dataset.billingSwitch)));
  });

  // Blog category tabs
  $$("[data-blog-tabs]").forEach((tabs) => {
    const cards = $$("[data-blog-grid] .blog-card");
    const empty = $("[data-blog-empty]");
    $$("button", tabs).forEach((tab) => {
      tab.addEventListener("click", () => {
        $$("button", tabs).forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
        const cat = tab.dataset.cat;
        let shown = 0;
        cards.forEach((card) => {
          card.hidden = cat !== "all" && card.dataset.cat !== cat;
          if (!card.hidden) shown++;
        });
        if (empty) empty.hidden = shown > 0;
      });
    });
  });

  // Contact, demo and custom-plan forms → Supabase (submit_contact_request, supabase/contact-requests.sql).
  // contact.html?topic=custom-plan&users=6 comes from "Request a custom plan" (pricing / account).
  // Demo booking: the next five working days with their dates (value = ISO date)
  $$("[data-book-days]").forEach((box) => {
    const d = new Date(); d.setHours(12, 0, 0, 0);
    const days = [];
    while (days.length < 5) { d.setDate(d.getDate() + 1); if (d.getDay() % 6) days.push(new Date(d)); }
    const loc = window.SCP_LOC || "en-GB";
    box.innerHTML = days.map((x) => { const iso = x.toISOString().slice(0, 10);
      return `<label><input type="radio" name="day" value="${iso}"><small>${x.toLocaleDateString(loc, { weekday: "short" })}</small><b>${x.getDate()}</b><small>${x.toLocaleDateString(loc, { month: "short" })}</small></label>`; }).join("");
  });

  // Which button brought the visitor to a form: data-cta, or the section / nav / footer it sits in. Kept for the
  // session and sent with the request (column "page"), so Admin → Requests shows which CTAs work.
  document.addEventListener("click", (e) => {
    const el = e.target.closest('[data-cta], a[href*="book-a-call"], a[href*="contact.html"], [data-faq-open]');
    if (!el) return;
    const where = el.dataset.cta || el.closest("section[id]")?.id || (el.closest("footer") ? "footer" : el.closest(".site-nav") ? "nav" : el.closest("section")?.className.split(" ")[0]) || "page";
    try { sessionStorage.setItem("scp-cta", `${(location.pathname.split("/").pop() || "index.html").replace(".html", "")}:${where}`); } catch {}
  }, true);
  // Signed-in members don't type their name and email again (the Supabase session kept in localStorage, no extra library)
  try {
    const ref = (window.SCP_CONFIG?.supabaseUrl || "").match(/https:\/\/([^.]+)\./)?.[1];
    const u = ref && JSON.parse(localStorage.getItem(`sb-${ref}-auth-token`) || "null")?.user;
    if (u?.email) $$("[data-contact-form]").forEach((f) => {
      if (f.email && !f.email.value) f.email.value = u.email;
      if (f.name && !f.name.value) f.name.value = u.user_metadata?.full_name || u.user_metadata?.name || "";
    });
  } catch {}

  // Book a demo with a real calendar: Google Calendar appointment schedule (config.demoBookingUrl). The request form
  // folds under "Prefer that we contact you?" so nobody is left without a way in.
  const bookingUrl = (window.SCP_CONFIG || {}).demoBookingUrl;
  // Cal.com (cal.com/<user>/<event>): inline embed in SCP's dark theme and gold; Google Calendar: its own page in an iframe
  const calLink = (bookingUrl || "").match(/^https:\/\/(?:app\.)?cal\.com\/(.+?)\/?$/)?.[1];
  const loadCal = () => {
    if (window.Cal) return;
    (function (C, A, L) { const p = (a, ar) => a.q.push(ar); const d = C.document; C.Cal = C.Cal || function () { const cal = C.Cal; const ar = arguments;
      if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement("script")).src = A; cal.loaded = true; }
      if (ar[0] === L) { const api = function () { p(api, arguments); }; const ns = ar[1]; api.q = api.q || [];
        if (typeof ns === "string") { cal.ns[ns] = cal.ns[ns] || api; p(cal.ns[ns], ar); p(cal, ["initNamespace", ns]); } else p(cal, ar); return; }
      p(cal, ar); }; })(window, "https://app.cal.com/embed/embed.js", "init");
  };
  let calN = 0;
  if (bookingUrl) $$("form.book-form").forEach((form) => {
    const id = `scp-cal-${++calN}`;
    const src = /calendar\.google\.com/.test(bookingUrl) && !/[?&]gv=true/.test(bookingUrl) ? `${bookingUrl}${bookingUrl.includes("?") ? "&" : "?"}gv=true` : bookingUrl;
    form.insertAdjacentHTML("beforebegin", `<div class="book-cal${calLink ? " is-cal" : ""}"><p class="book-cal-head"><b>${tx("Pick a time that suits you")}</b><span>${tx("30 min · video call · you get the invite straight away")}</span></p>
      ${calLink ? `<div class="book-cal-box" id="${id}"></div>` : `<iframe src="${src}" title="${tx("Book a demo")}" loading="lazy"></iframe>`}
      <button class="book-cal-alt" type="button" aria-expanded="false">${tx("No time fits? Ask us to contact you →")}</button></div>`);
    if (calLink) {
      loadCal();
      const ns = `scp${calN}`;
      window.Cal("init", ns, { origin: "https://cal.com" });
      window.Cal.ns[ns]("inline", { elementOrSelector: `#${id}`, calLink, config: { layout: "month_view", theme: "dark" } });
      window.Cal.ns[ns]("ui", { theme: "dark", layout: "month_view", hideEventTypeDetails: false,
        cssVarsPerTheme: { dark: { "cal-brand": "#f0b84a", "cal-brand-emphasis": "#f8cc75", "cal-brand-text": "#0b0f1c", "cal-bg": "#121a2e", "cal-bg-muted": "#17213b", "cal-bg-emphasis": "#1f2b48", "cal-border": "rgba(180,192,211,0.18)", "cal-border-subtle": "rgba(180,192,211,0.12)", "cal-text": "#ffffff", "cal-text-subtle": "#b4c0d3", "cal-text-muted": "#8b98ae" } } });
      // a booking made in the calendar also lands in Admin → Requests, with the CTA it came from
      window.Cal.ns[ns]("on", { action: "bookingSuccessful", callback: (e) => {
        const b = e?.detail?.data?.booking || {}, att = (b.attendees || b.responses ? [b.responses || {}] : [])[0] || {};
        const cfg = window.SCP_CONFIG || {}; let src = ""; try { src = sessionStorage.getItem("scp-cta") || ""; } catch {}
        const email = att.email || e?.detail?.data?.eventType?.email || "", name = att.name?.firstName ? `${att.name.firstName} ${att.name.lastName || ""}`.trim() : att.name || "";
        if (!email || !name || !cfg.supabaseUrl) return;
        fetch(`${cfg.supabaseUrl}/rest/v1/rpc/submit_contact_request`, { method: "POST",
          headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ p: { kind: "demo", name, email, day: String(b.startTime || "").slice(0, 10), time: String(b.startTime || "").slice(11, 16), message: "Booked in Cal.com", lang: window.SCP_LANG || "en",
            page: `${location.pathname.split("/").pop() || "index.html"}${src ? ` ← ${src}` : ""} (Cal.com)`.slice(0, 200) } }) }).catch(() => {});
      } });
    }
    form.hidden = true;
    form.previousElementSibling.querySelector(".book-cal-alt").addEventListener("click", (e) => {
      form.hidden = !form.hidden; e.currentTarget.setAttribute("aria-expanded", String(!form.hidden));
    });
  });

  $$("[data-contact-form]").forEach((form) => {
    const status = $("[data-form-status]", form);
    const q = new URLSearchParams(location.search);
    const custom = q.get("topic") === "custom-plan";
    const users = Number(q.get("users")) || null;
    if (custom && form.message && !form.message.value) {
      form.message.value = tx("We'd like a custom plan for {n} or more users.", { n: users || 6 });
    }
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      let ok = true;
      $$("input[required]", form).forEach((input) => {
        const valid = input.type === "checkbox" ? input.checked : input.checkValidity() && input.value.trim();
        const target = input.type === "checkbox" ? input.closest(".check") : input;
        target.classList.toggle("is-invalid", !valid);
        if (!valid) ok = false;
      });
      const say = (good, text) => { status.className = `form-status ${good ? "ok" : "err"}`; status.textContent = tx(text); };
      if (!ok) return say(false, "Please fill in your name, a valid email and accept the privacy policy.");
      const cfg = window.SCP_CONFIG || {};
      const fd = new FormData(form);
      const body = { kind: form.classList.contains("book-form") ? "demo" : custom ? "custom_plan" : "contact", users,
        lang: window.SCP_LANG || "en", page: (() => { const pg = location.pathname.split("/").pop() || "index.html"; let src = ""; try { src = sessionStorage.getItem("scp-cta") || ""; } catch {} return `${pg}${src ? ` ← ${src}` : ""}${form.closest("[data-faq-pane]") ? " (FAQ form)" : ""}`.slice(0, 200); })() };
      for (const k of ["name", "email", "company", "country", "role", "team_size", "day", "time", "message"]) if (fd.get(k)) body[k] = String(fd.get(k)).trim();
      const btn = form.querySelector('[type="submit"]'); if (btn) btn.disabled = true;
      try {
        if (!cfg.supabaseUrl) throw new Error("Not connected.");
        const r = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/submit_contact_request`, { method: "POST",
          headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ p: body }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.ok) throw new Error(d.error || d.message || "Something went wrong. Please try again in a moment.");
        say(true, "Thanks! We’ll get back to you as soon as possible.");
        form.reset();
        const done = form.parentElement?.querySelector("[data-form-done]");
        if (done) { form.hidden = true; done.hidden = false; done.scrollIntoView({ behavior: "smooth", block: "center" }); }
      } catch (err) {
        say(false, /schema cache|does not exist|Could not find/i.test(err.message) ? "Something went wrong. Please try again in a moment." : err.message);
      } finally { if (btn) btn.disabled = false; }
    });
    form.addEventListener("input", (e) => e.target.classList.remove("is-invalid"));
    form.addEventListener("change", (e) => e.target.closest(".check")?.classList.remove("is-invalid"));
  });

  // Walkthrough video modal (set data-video to a YouTube/Vimeo embed URL)
  const modal = $("[data-video-modal]");
  $$("[data-video]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = btn.dataset.video.trim();
      if (!url || !modal) {
        if (btn.dataset.videoFallback) location.href = btn.dataset.videoFallback;
        return;
      }
      const frame = $(".video-frame", modal);
      $("iframe", frame)?.remove();
      const iframe = document.createElement("iframe");
      iframe.src = url;
      iframe.allow = "autoplay; fullscreen; picture-in-picture";
      iframe.allowFullscreen = true;
      iframe.title = "Sports Content Playbook walkthrough";
      frame.append(iframe);
      modal.hidden = false;
    });
  });
  const closeModal = () => {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    $("iframe", modal)?.remove();
  };
  $("[data-video-close]")?.addEventListener("click", closeModal);
  modal?.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  // Toggle groups (aria-pressed)
  $$("[data-toggle-group]").forEach((group) => {
    const single = group.dataset.toggleGroup === "single";
    $$("button", group).forEach((b) => {
      b.addEventListener("click", () => {
        if (single) {
          $$("button", group).forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
        } else {
          b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true"));
        }
        group.dispatchEvent(new CustomEvent("change", { bubbles: true }));
      });
    });
  });
})();
