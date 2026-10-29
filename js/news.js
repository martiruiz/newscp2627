// Social News — reads curated stories from Supabase (table "news")
(() => {
  const auth = window.SCP_AUTH;
  const root = document.querySelector("[data-news-filters]");
  if (!root) return;

  const list = document.querySelector("[data-news-list]");
  const empty = document.querySelector("[data-news-empty]");
  const more = document.querySelector("[data-news-more]");
  const search = root.querySelector("[data-news-search]");
  const PAGE = 10;

  const LABELS = {
    instagram: "Instagram", tiktok: "TikTok", x: "X", youtube: "YouTube", facebook: "Facebook",
    linkedin: "LinkedIn", snapchat: "Snapchat", whatsapp: "WhatsApp", pinterest: "Pinterest",
    threads: "Threads", ai: "IA", other: "Sports marketing",
  };

  const state = { platform: "all", days: 31, q: "", offset: 0, token: 0 };

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const fmtDate = (iso) =>
    new Date(iso).toLocaleDateString(window.SCP_LOC || "en-GB", { day: "numeric", month: "short", year: "numeric" });

  // one news item: the source's picture, network, date, title, at most 2 paragraphs, link to its page and to the source
  // (same markup as blog-tools/build.mjs → newsRow, which writes the first ones into the page for Google)
  // in Spanish, the AI translation ("es", supabase/translations.sql) and its /es/ page when there is one
  const row = (src) => {
    const es = window.SCP_LANG === "es" && src.es;
    const n = es ? { ...src, title: src.es.title || src.title, paragraphs: src.es.paragraphs?.length ? src.es.paragraphs : src.paragraphs } : src;
    const icon = n.platform === "other" ? "all" : n.platform, page = n.slug ? `${es ? "es/" : ""}news/${esc(n.slug)}.html` : esc(n.url);
    return `
      <article class="news-row nwc" id="news-${esc(n.id)}" data-platform="${esc(n.platform)}">
        <a class="nwc-img${n.image_url ? "" : " is-empty"}" href="${page}" tabindex="-1" aria-hidden="true">${n.image_url ? `<img src="${esc(n.image_url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.add('is-empty');this.remove()">` : ""}<span class="nwc-pf"><img src="assets/pf-${esc(icon)}.svg" alt=""></span></a>
        <div class="nwc-body">
          <span class="news-meta"><b>${esc((LABELS[n.platform] || n.platform).toUpperCase())}</b> <time>${esc(fmtDate(n.published_at))}</time> <span>${esc(n.source_name)}</span></span>
          <h2><a href="${page}">${esc(n.title)}</a></h2>
          ${(n.paragraphs || []).slice(0, 2).map((p) => `<p>${esc(p)}</p>`).join("")}
          <div class="nwc-foot">${n.slug ? `<a class="nwc-more" href="${page}">Read the news →</a>` : ""}<a class="news-source" href="${esc(n.url)}" target="_blank" rel="noopener">Source: ${esc(n.source_name)} ↗</a></div>
        </div>
      </article>`;
  };

  const showMessage = (text) => {
    empty.textContent = text;
    empty.hidden = false;
  };

  async function load(reset) {
    if (!auth?.ready) return showMessage("News aren't connected yet.");
    if (reset) {
      state.offset = 0;
      list.innerHTML = "";
      empty.hidden = true;
    }
    const token = ++state.token;
    more.hidden = true;
    list.setAttribute("aria-busy", "true");

    let query = auth.client
      .from("news")
      .select("*")   // with slug once supabase/seo.sql is run: the title links to the news page
      .eq("relevant", true)   // the ones the pipeline set aside stay stored (so they aren't screened again) but never show; admins can read them
      .order("published_at", { ascending: false })
      .range(state.offset, state.offset + PAGE - 1);
    if (state.platform !== "all") query = query.eq("platform", state.platform);
    if (state.days > 0) query = query.gte("published_at", new Date(Date.now() - state.days * 86400000).toISOString());
    if (state.q) query = query.ilike("title", `%${state.q.replace(/[%_,()]/g, " ")}%`);

    const { data, error } = await query;
    if (token !== state.token) return; // a newer request replaced this one
    list.removeAttribute("aria-busy");

    if (error) return showMessage("Couldn't load the news. Please try again later.");
    list.insertAdjacentHTML("beforeend", data.map(row).join(""));
    state.offset += data.length;
    more.hidden = data.length < PAGE;
    if (!list.children.length) showMessage("No news match these filters yet.");
    // Links from the newsletter: news.html#news-<id> → scroll to that story and highlight it
    const target = /^#news-\d+$/.test(location.hash) && document.querySelector(location.hash);
    if (target && !target.dataset.seen) { target.dataset.seen = "1"; target.classList.add("is-target"); target.scrollIntoView({ block: "center", behavior: "smooth" }); }
  }

  // Platform tiles (single choice)
  root.querySelectorAll("[data-platforms] .ptile").forEach((tile) => {
    tile.addEventListener("click", () => {
      root.querySelectorAll("[data-platforms] .ptile").forEach((t) => t.setAttribute("aria-pressed", String(t === tile)));
      state.platform = tile.dataset.platform;
      load(true);
    });
  });

  // Date range
  root.querySelectorAll("[data-dates] [data-days]").forEach((btn) => {
    btn.addEventListener("click", () => {
      root.querySelectorAll("[data-dates] [data-days]").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      state.days = Number(btn.dataset.days);
      load(true);
    });
  });

  // Search (debounced)
  let timer;
  search.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.q = search.value.trim();
      load(true);
    }, 300);
  });

  more.addEventListener("click", () => load(false));

  load(true);
})();
