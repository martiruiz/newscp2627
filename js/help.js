// SCP Knowledge Base (help.html, help/*.html, built by blog-tools/help.mjs):
// the portal's search over every article (the index is inside the page), the article's "On this page" that follows the scroll,
// and help_track() (supabase/help-events.sql): each article read and each search without results, with the member when signed in.
(() => {
  const track = (kind, slug, query) => {
    const cfg = window.SCP_CONFIG;
    if (!cfg?.supabaseUrl) return;
    let token = null;   // a visitor sends only the public key; a signed-in member also their session, so the read is theirs
    try { const k = Object.keys(localStorage).find((x) => /^sb-.+-auth-token$/.test(x)); const t = k && JSON.parse(localStorage.getItem(k))?.access_token; if (t) token = t; } catch {}
    const send = (t) => fetch(`${cfg.supabaseUrl}/rest/v1/rpc/help_track`, { method: "POST", keepalive: true,
      headers: { apikey: cfg.supabaseAnonKey, ...(t ? { Authorization: `Bearer ${t}` } : {}), "Content-Type": "application/json" },
      body: JSON.stringify({ p_kind: kind, p_slug: slug || null, p_query: query || null, p_lang: document.documentElement.lang }) });
    send(token).then((r) => { if (r.status === 401 && token) send(null); }).catch(() => null);   // an expired session: logged as a visitor
  };
  const slug = location.pathname.match(/\/help\/([^/]+)\.html$/)?.[1];
  if (slug) track("view", slug);
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  // ---------- Search ----------
  const input = document.querySelector("[data-kb-search]");
  const data = document.querySelector("[data-kb-index]");
  if (input && data) {
    const index = JSON.parse(data.textContent).map((a) => ({ ...a, n: norm(a.k), nt: norm(a.t), nq: norm(`${a.q} ${a.d}`) }));
    const out = document.querySelector("[data-kb-results]"), none = document.querySelector("[data-kb-none]");
    const run = () => {
      const words = norm(input.value).split(/\s+/).filter((w) => w.length > 1);
      if (!words.length) { out.hidden = true; none.hidden = true; return; }
      const stem = (w) => (w.length > 5 ? w.slice(0, w.length - 2) : w);   // "cancelar" also finds "cancela", "cancelación"
      const hits = index.map((a) => ({ a, s: words.reduce((s, w) => s + (a.nt.includes(stem(w)) ? 6 : a.nq.includes(stem(w)) ? 3 : a.n.includes(stem(w)) ? 1 : -99), 0) }))   // title, then headings / questions / summary, then the text
        .filter((h) => h.s > 0).sort((x, y) => y.s - x.s).slice(0, 8);
      out.innerHTML = hits.map(({ a }) => `<a href="${esc(a.h)}"><em>${esc(a.c)}</em><b>${esc(a.t)}</b><small>${esc(a.d)}</small></a>`).join("");
      out.hidden = !hits.length; none.hidden = !!hits.length;
      clearTimeout(missT);
      if (!hits.length) missT = setTimeout(() => track("search_miss", null, input.value), 1500);   // a search that found nothing
    };
    let missT = null;
    input.addEventListener("input", run);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") out.querySelector("a")?.click(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement?.tagName || "")) { e.preventDefault(); input.focus(); }
    });
  }

  // ---------- On this page ----------
  const toc = [...document.querySelectorAll(".kb-toc a")];
  if (toc.length) {
    const secs = toc.map((a) => document.getElementById(a.hash.slice(1))).filter(Boolean);
    const mark = () => {
      let on = secs[0];
      for (const s of secs) if (s.getBoundingClientRect().top < 140) on = s;
      toc.forEach((a) => a.classList.toggle("is-on", a.hash === `#${on?.id}`));
    };
    addEventListener("scroll", mark, { passive: true });
    mark();
  }
})();
