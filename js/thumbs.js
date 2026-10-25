// Small post previews (Content Plan panel, plan entries): the platform's embed page scaled and cropped to "cover" a tile.
// SCP_THUMB.html(post) → markup; SCP_THUMB.fit(scope) after inserting it (and when tiles change size).
// post: { id, url, media_ratio, reel } — reel = 9:16 video letterboxed in Instagram's media box.
window.SCP_THUMB = (() => {
  const W0 = 360, HEADER = 55; // width the embed is rendered at, Instagram embed header height
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const posts = new Map();
  // Instagram embeds are cropped to the photo (fit); other platforms show their own player, scaled to the tile
  function src(p) {
    const u = p?.url || "";
    let m;
    if ((m = /instagram\.com\/(?:[\w.]+\/)?(p|reel|tv)\/([\w-]+)/.exec(u))) return `https://www.instagram.com/${m[1]}/${m[2]}/embed/`;
    if ((m = /tiktok\.com\/.*video\/(\d+)/.exec(u))) return `https://www.tiktok.com/embed/v2/${m[1]}`;
    if ((m = /(?:shorts\/|v=|youtu\.be\/)([\w-]{11})/.exec(u))) return `https://www.youtube-nocookie.com/embed/${m[1]}?controls=0`;
    if ((m = /(?:twitter|x)\.com\/[^/]+\/status\/(\d+)/.exec(u))) return `https://platform.twitter.com/embed/Tweet.html?id=${m[1]}&theme=dark&dnt=true`;
    if (/facebook\.com\//.test(u)) return `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(u)}&show_text=false&width=500`;
    if ((m = /linkedin\.com\/feed\/update\/(urn:li:[\w:]+)/.exec(u))) return `https://www.linkedin.com/embed/feed/update/${m[1]}?collapsed=1`;
    return "";
  }
  const isIg = (p) => /instagram\.com/.test(p?.url || "");
  function html(p, cls = "") {
    if (!p) return `<span class="thumb thumb-empty ${cls}"></span>`;
    posts.set(String(p.id), p);
    const s = src(p);
    return `<span class="thumb ${cls}" data-thumb="${esc(p.id)}">${s ? `<iframe src="${esc(s)}" loading="lazy" tabindex="-1" scrolling="no" title="" aria-hidden="true"></iframe>` : ""}</span>`;
  }
  function fit(scope = document) {
    scope.querySelectorAll("[data-thumb]").forEach((tile) => {
      const f = tile.querySelector("iframe");
      if (!f) return;
      const p = posts.get(tile.dataset.thumb);
      if (!isIg(p)) { // other platforms: render the player at 360px wide and scale it down to cover the tile
        const tw = tile.clientWidth, th = tile.clientHeight;
        if (!tw || !th) return;
        const s0 = tw / 360;
        f.style.width = "360px"; f.style.height = `${Math.ceil(th / s0)}px`; f.style.transform = `scale(${s0})`;
        return;
      }
      const box = Number(p?.media_ratio) || 1.25;
      const h = W0 * box;
      const w = p?.reel && box < 16 / 9 ? h * 9 / 16 : W0;
      const tw = tile.clientWidth, th = tile.clientHeight;
      if (!tw || !th) return;
      const s = Math.max(tw / w, th / h);
      f.style.width = `${W0}px`;
      f.style.height = `${HEADER + h + 320}px`;
      f.style.transform = `translate(${tw / 2 - (W0 / 2) * s}px, ${th / 2 - (HEADER + h / 2) * s}px) scale(${s})`;
    });
  }
  return { html, fit, src };
})();
