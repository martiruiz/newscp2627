// Sports Content Playbook — shared interactions

// Prices (from Calcul_Descomptes_Usuaris.xlsx):
// - base: €39 per user per month
// - volume discount on the monthly price: 2 users −10%, 3 users −15%, 5 users −20%
// - yearly billing: −20% on that monthly price (shown per month, billed once a year)
// Amounts are rounded to cents. "Team" (6+ users) has no price: custom proposal.
window.SCP_PRICING = { base: 39, yearlyDiscount: 20, volumeDiscount: { 1: 0, 2: 10, 3: 15, 5: 20 } };
window.SCP_PRICE = (users) => {
  const P = window.SCP_PRICING;
  const cents = (v) => Math.round(v * 100) / 100;
  const tiers = Object.keys(P.volumeDiscount).map(Number);
  const volume = P.volumeDiscount[users] ?? P.volumeDiscount[tiers.filter((t) => t <= users).pop() || 1];
  const list = P.base * users;                                   // price without any discount
  const monthly = cents(list * (1 - volume / 100));              // preu mensual
  const yearly = cents(monthly * (1 - P.yearlyDiscount / 100));  // preu mensual si contractes l'opció anual
  return {
    users, list, volume, yearlyDiscount: P.yearlyDiscount,
    monthly, volumeSaving: cents(list - monthly),               // estalvi en € (per volum)
    yearly, savingMonth: cents(monthly - yearly),                // estalvi en €/mes
    savingYear: cents((monthly - yearly) * 12),                  // estalvi en €/any
    yearlyTotal: cents(yearly * 12),                             // cost total anual
  };
};
// €39 · €70.20 · €1,497.60
window.SCP_EUR = (v) => `€${Number(v).toLocaleString("en-GB", { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 })}`;

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
    prev.addEventListener("click", () => track.scrollBy({ left: -step(), behavior: "smooth" }));
    next.addEventListener("click", () => track.scrollBy({ left: step(), behavior: "smooth" }));
    track.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
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

  // "Magic behind SCP" steps — click to select, auto-advance
  $$("[data-steps]").forEach((root) => {
    const buttons = $$("[data-step-btn]", root);
    const visuals = $$("[data-step]", root);
    const DURATION = 6000;
    root.style.setProperty("--step-ms", `${DURATION}ms`);
    let current = 1;
    let timer;
    // Fit the visual area to the step being shown (avoids empty space below shorter visuals)
    const fit = () => {
      const active = visuals.find((v) => Number(v.dataset.step) === current);
      const h = active?.firstElementChild?.getBoundingClientRect().height;
      if (h) active.parentElement.style.height = `${Math.ceil(h)}px`;
    };
    root.querySelectorAll("[data-step] img").forEach((img) => img.addEventListener("load", fit));
    window.addEventListener("resize", fit);
    const show = (n) => {
      current = n;
      buttons.forEach((b) => {
        const on = Number(b.dataset.stepBtn) === n;
        b.classList.remove("is-active");
        if (on) {
          void b.offsetWidth; // restart progress animation
          b.classList.add("is-active");
        }
        b.setAttribute("aria-pressed", String(on));
      });
      visuals.forEach((v) => v.classList.toggle("is-active", Number(v.dataset.step) === n));
      fit();
      clearTimeout(timer);
      timer = setTimeout(() => show((current % buttons.length) + 1), DURATION);
    };
    buttons.forEach((b) => b.addEventListener("click", () => show(Number(b.dataset.stepBtn))));
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) show(current);
      else clearTimeout(timer);
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

  // Contact form: client-side validation (no backend connected yet)
  $$("[data-contact-form]").forEach((form) => {
    const status = $("[data-form-status]", form);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      let ok = true;
      $$("input[required]", form).forEach((input) => {
        const valid = input.type === "checkbox" ? input.checked : input.checkValidity() && input.value.trim();
        const target = input.type === "checkbox" ? input.closest(".check") : input;
        target.classList.toggle("is-invalid", !valid);
        if (!valid) ok = false;
      });
      status.className = `form-status ${ok ? "ok" : "err"}`;
      status.textContent = ok
        ? "Thanks! We’ll get back to you as soon as possible."
        : "Please fill in your name, a valid email and accept the privacy policy.";
      if (ok) form.reset();
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
