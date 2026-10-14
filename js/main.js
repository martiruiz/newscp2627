// Sports Content Playbook — shared interactions
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
    const update = (n) => {
      buttons.forEach((b) => b.setAttribute("aria-checked", String(Number(b.dataset.n) === n)));
      $$("[data-price]").forEach((el) => {
        el.textContent = `€${Number(el.dataset.price) * n}`;
      });
      $$("[data-seat-label]").forEach((el) => {
        el.textContent = `${n} user${n > 1 ? "s" : ""} access to Sports Content Playbook`;
      });
    };
    buttons.forEach((b) => b.addEventListener("click", () => update(Number(b.dataset.n))));
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

  // Social news: platform + text filters
  $$("[data-news-filters]").forEach((filters) => {
    const rows = $$("[data-news-list] .news-row");
    const empty = $("[data-news-empty]");
    const search = $("[data-news-search]", filters);
    const apply = () => {
      const platforms = $$("[data-platforms] [aria-pressed='true']", filters).map((b) => b.dataset.platform);
      const q = search.value.trim().toLowerCase();
      let shown = 0;
      rows.forEach((row) => {
        const okPlatform = !platforms.length || platforms.includes(row.dataset.platform);
        const okText = !q || row.textContent.toLowerCase().includes(q);
        row.hidden = !(okPlatform && okText);
        if (!row.hidden) shown++;
      });
      if (empty) empty.hidden = shown > 0;
    };
    $("[data-platforms]", filters).addEventListener("change", apply);
    search.addEventListener("input", apply);
  });

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
