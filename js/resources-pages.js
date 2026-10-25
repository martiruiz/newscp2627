// Fills the free-resources pages from the admin's table (js/resources-data.js). Without data the built-in HTML stays.
(async () => {
  const esc = window.SCP_RES_ESC, land = window.SCP_RES_LANDING;
  const rows = await (window.SCP_RESOURCES || []);
  const q = (s, el = document) => el.querySelector(s);

  // library: one card per published resource
  const list = q("[data-res-list]");
  if (list && rows.length) {
    list.innerHTML = rows.map((r) => {
      const live = r.status === "live";
      const media = r.cover_url ? `<img src="${esc(r.cover_url)}" alt="" loading="lazy">` : `<span class="soon-mark">${esc((r.title || "").split(/\s+/)[0].slice(0, 8))}</span>`;
      return `<li class="rs-res${live ? " is-live" : ""}"><div class="rs-res-media">${media}</div><div class="rs-res-body">
        <span class="rs-tag ${live ? "live" : "soon"}">${live ? "Available" : "Coming soon"}</span><h3>${esc(r.title)}</h3><p>${esc(r.description || "")}</p>
        ${live ? `<a class="btn btn-gold" href="${esc(land(r))}">Get it free</a>` : `<a class="btn btn-outline" href="#news">Get notified</a>`}</div></li>`;
    }).join("");
  }

  // a landing with its own page (sports-content-calendar.html): keep its text, take the file from the admin
  const fixed = q("[data-res-slug]");
  if (fixed) {
    const r = rows.find((x) => x.slug === fixed.dataset.resSlug);
    if (r?.file_url) document.querySelectorAll("[data-res-file]").forEach((a) => (a.href = r.file_url));
  }

  // generic landing: resource.html?r=<slug>
  const page = q("[data-res-page]");
  if (page) {
    const slug = new URLSearchParams(location.search).get("r") || "";
    const r = rows.find((x) => x.slug === slug && x.status === "live" && x.file_url);
    if (!r) { page.querySelector(".rs-grid").hidden = true; q("[data-res-missing]").hidden = false; return; }
    document.title = `${r.title} — Sports Content Playbook`;
    q("[data-res-title]").textContent = r.title;
    q("[data-res-desc]").textContent = r.description || "";
    const tick = '<svg viewBox="0 0 24 24" fill="none" stroke="#f0b84a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke-opacity=".35"/><path d="M8 12.5l2.7 2.7L16 9.5"/></svg>';
    q("[data-res-bullets]").innerHTML = (r.bullets || "").split("\n").map((b) => b.trim()).filter(Boolean).map((b) => `<li>${tick}<div><b>${esc(b)}</b></div></li>`).join("");
    if (r.cover_url) { const c = q("[data-res-cover]"); c.hidden = false; q("img", c).src = r.cover_url; q("img", c).alt = r.title; }
    const f = q("[data-lm-form]"); f.dataset.resource = r.slug; f.dataset.source = `lm-${r.slug}`.slice(0, 40);
    q("[data-res-file]").href = r.file_url;
  }
})();
