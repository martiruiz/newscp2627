// Cover images for posts whose embedded player can't be shown in a small card (TikTok asks for cookie consent inside
// every embed). <img data-oembed="<post url>"> gets the platform's public cover (oEmbed thumbnail) when it scrolls
// into view. Covers are cached for the browser session. SCP_COVERS.observe(root) after inserting cards.
window.SCP_COVERS = (() => {
  const ENDPOINTS = { tiktok: (u) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(u)}` };
  const platform = (u) => (/tiktok\.com\//.test(u) ? "tiktok" : null);
  const cache = new Map();
  const store = {
    get: (k) => { try { return sessionStorage.getItem(`cover:${k}`); } catch { return null; } },
    set: (k, v) => { try { sessionStorage.setItem(`cover:${k}`, v); } catch {} },
  };
  let active = 0;
  const waiting = [];
  function cover(url) {
    if (cache.has(url)) return cache.get(url);
    const hit = store.get(url);
    if (hit) { const p = Promise.resolve(hit === "-" ? null : hit); cache.set(url, p); return p; }
    const p = new Promise((resolve) => waiting.push({ url, resolve })).then((src) => { store.set(url, src || "-"); return src; });
    cache.set(url, p);
    pump();
    return p;
  }
  // at most 4 requests at a time
  function pump() {
    while (active < 4 && waiting.length) {
      const { url, resolve } = waiting.shift();
      const ep = ENDPOINTS[platform(url)];
      if (!ep) { resolve(null); continue; }
      active++;
      fetch(ep(url)).then((r) => (r.ok ? r.json() : null)).then((j) => resolve(j?.thumbnail_url || null)).catch(() => resolve(null))
        .finally(() => { active--; pump(); });
    }
  }
  const io = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      load(e.target);
    }
  }, { rootMargin: "400px" }) : null;
  function load(img) {
    cover(img.dataset.oembed).then((src) => {
      if (src) { img.src = src; img.addEventListener("load", () => img.classList.add("is-loaded"), { once: true }); }
      else img.closest("[data-cover-box]")?.classList.add("no-cover");
    });
  }
  function observe(root = document) {
    root.querySelectorAll("img[data-oembed]:not([data-cover-seen])").forEach((img) => {
      img.dataset.coverSeen = "";
      io ? io.observe(img) : load(img);
    });
  }
  return { observe, platform };
})();
