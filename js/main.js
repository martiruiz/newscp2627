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
        lang: window.SCP_LANG || "en", page: location.pathname.split("/").pop() || "index.html" };
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
