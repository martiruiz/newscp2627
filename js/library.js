// Content Library interactions
(() => {
  const root = document.querySelector("[data-library]");
  if (!root) return;
  const $ = (sel, el = root) => el.querySelector(sel);
  const $$ = (sel, el = root) => [...el.querySelectorAll(sel)];

  // Collapse / expand the filters sidebar
  const collapse = $("[data-collapse]");
  collapse.addEventListener("click", () => {
    const collapsed = root.classList.toggle("filters-collapsed");
    collapse.setAttribute("aria-expanded", String(!collapsed));
    collapse.lastChild.textContent = collapsed ? "Show filters" : "Collapse filters";
  });

  // ANY / ALL explainer
  const criteria = $("[data-criteria]");
  $("[data-criteria-close]").addEventListener("click", () => (criteria.hidden = true));
  $("[data-criteria-open]").addEventListener("click", () => {
    criteria.hidden = false;
    criteria.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  // Removable chips
  $$("[data-chips] .chip button").forEach((btn) =>
    btn.addEventListener("click", () => btn.closest(".chip").remove())
  );

  // Search inside the competition list
  const search = $("[data-search]");
  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    $$("[data-options] li").forEach((li) => {
      li.hidden = q && !li.textContent.toLowerCase().includes(q);
    });
  });

  // Filter posts by smart filters and saved view
  const posts = $$(".post");
  const empty = $("[data-empty]");
  let view = "all";
  const apply = () => {
    const smart = $$("[data-smart] [aria-pressed='true']").map((b) => b.dataset.label);
    let shown = 0;
    posts.forEach((post) => {
      const labels = post.dataset.labels.split(" ").filter(Boolean);
      const matchSmart = !smart.length || smart.some((l) => labels.includes(l));
      const matchView = view === "all" || post.hasAttribute("data-saved");
      post.hidden = !(matchSmart && matchView);
      if (!post.hidden) shown++;
    });
    empty.hidden = shown > 0;
  };
  $("[data-smart]").addEventListener("change", apply);
  $$("[data-view-btn]").forEach((b) =>
    b.addEventListener("click", () => {
      view = b.dataset.viewBtn;
      apply();
    })
  );

  // Save / unsave a post
  $$("[data-save]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const post = btn.closest(".post");
      const saved = !post.hasAttribute("data-saved");
      post.toggleAttribute("data-saved", saved);
      btn.className = `pill ${saved ? "pill-gold" : "pill-dark"}`;
      btn.innerHTML = saved
        ? 'Saved <img src="assets/folder-gold.svg" width="21" height="21" alt="">'
        : 'Save <img src="assets/plus-grey.svg" width="14" height="14" alt="">';
      apply();
    });
  });

  // Clear all filters
  $("[data-clear]").addEventListener("click", () => {
    $$(".filters [aria-pressed='true']").forEach((b) => {
      if (!b.closest(".toggle")) b.setAttribute("aria-pressed", "false");
    });
    $$(".filters .seg-btn").forEach((b, i) => b.setAttribute("aria-pressed", String(i === 0)));
    search.value = "";
    search.dispatchEvent(new Event("input"));
    apply();
  });
})();

// Welcome offer shown when entering the platform (once per browser session)
(() => {
  const modal = document.querySelector("[data-offer]");
  if (!modal) return;
  const KEY = "scp-offer-seen";
  let seen = false;
  try { seen = sessionStorage.getItem(KEY) === "1"; } catch {}
  const close = () => {
    modal.hidden = true;
    document.body.style.overflow = "";
    try { sessionStorage.setItem(KEY, "1"); } catch {}
  };
  if (!seen) {
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    modal.querySelector(".offer-cta").focus({ preventScroll: true });
  }
  modal.querySelector("[data-offer-close]").addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) close(); });
})();
