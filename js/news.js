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

  const state = { platform: "all", days: 7, q: "", offset: 0, token: 0 };

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const fmtDate = (iso) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  const row = (n) => {
    const icon = n.platform === "other" ? "all" : n.platform;
    return `
      <article class="news-row" data-platform="${esc(n.platform)}">
        <div class="news-row-text">
          <span class="news-meta"><b>${esc((LABELS[n.platform] || n.platform).toUpperCase())}</b> ${esc(fmtDate(n.published_at))}</span>
          <h2>${esc(n.title)}</h2>
          ${(n.paragraphs || []).map((p) => `<p>${esc(p)}</p>`).join("")}
          <a class="news-source" href="${esc(n.url)}" target="_blank" rel="noopener">Source: ${esc(n.source_name)} ↗</a>
        </div>
        <div class="news-row-icon" aria-hidden="true"><img src="assets/pf-${esc(icon)}.svg" alt=""></div>
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
      .select("id,url,source_name,platform,title,paragraphs,published_at")
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
