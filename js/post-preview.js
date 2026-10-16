// Hover preview for planned posts: keep the pointer on an entry for a moment and a card opens next to it with the
// post itself (live embed: carousels can be swiped, reels played) and the entry's details. Moving into the card keeps it
// open; leaving, clicking, scrolling or dragging closes it.
// SCP_PREVIEW.attach(root, selector, getData, delay) — getData(el) → { post, title, lines: [], status, statusLabel, copy, href } | null
// post: { id, url, media_ratio, reel } (as for SCP_THUMB).
window.SCP_PREVIEW = (() => {
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const icon = (n) => (window.SCP_ICONS ? window.SCP_ICONS(n) : "");
  let pop = null, showTimer = null, hideTimer = null, anchor = null;

  function hide() {
    clearTimeout(showTimer); clearTimeout(hideTimer);
    showTimer = hideTimer = null;
    pop?.remove(); pop = null; anchor = null;
  }
  const hideSoon = () => { clearTimeout(hideTimer); hideTimer = setTimeout(hide, 220); };

  function mediaSize(post) {
    const box = Number(post?.media_ratio) || 1.25;
    const ratio = post?.reel && box < 16 / 9 ? 16 / 9 : box;   // height / width
    const maxH = Math.min(440, innerHeight - 220);
    let w = 300, h = w * ratio;
    if (h > maxH) { h = maxH; w = h / ratio; }
    return { w: Math.round(w), h: Math.round(h) };
  }

  function show(el, d) {
    hide();
    anchor = el;
    const T = window.SCP_THUMB;
    const size = d.post ? mediaSize(d.post) : null;
    pop = document.createElement("div");
    pop.className = "pv";
    pop.innerHTML = `
      ${d.post && T ? `<div class="pv-media" style="width:${size.w}px;height:${size.h}px">${T.html(d.post, "pv-thumb")}</div>` : ""}
      <div class="pv-body">
        ${d.statusLabel ? `<span class="pv-status org-s-${esc(d.status)}"><i></i>${esc(d.statusLabel)}</span>` : ""}
        <b class="pv-title">${esc(d.title || "Untitled")}</b>
        ${(d.lines || []).filter(Boolean).map((l) => `<span class="pv-line">${l}</span>`).join("")}
        ${d.copy ? `<p class="pv-copy">${esc(d.copy)}</p>` : ""}
        ${d.href ? `<a class="pv-link" href="${esc(d.href)}" target="_blank" rel="noopener">${icon("arrow-up-right")}View the original post</a>` : ""}
      </div>`;
    document.body.append(pop);
    pop.addEventListener("mouseenter", () => clearTimeout(hideTimer));
    pop.addEventListener("mouseleave", hideSoon);
    place();
    if (T) requestAnimationFrame(() => T.fit(pop));
  }
  function place() {
    if (!pop || !anchor) return;
    const r = anchor.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight, gap = 12;
    const left = r.right + gap + w <= innerWidth - 8 ? r.right + gap : Math.max(8, r.left - gap - w);
    const top = Math.max(8, Math.min(innerHeight - h - 8, r.top + r.height / 2 - h / 2));
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }

  function attach(root, selector, getData, delay = 2000) {
    if (!root) return;
    root.addEventListener("mouseover", (e) => {
      const el = e.target.closest(selector);
      if (!el || !root.contains(el)) return;
      if (el === anchor) { clearTimeout(hideTimer); return; }
      if (el.contains(e.relatedTarget)) return;
      clearTimeout(showTimer);
      showTimer = setTimeout(() => {
        if (!el.isConnected || !el.matches(":hover")) return;
        const d = getData(el);
        if (d) show(el, d);
      }, delay);
    });
    root.addEventListener("mouseout", (e) => {
      const el = e.target.closest(selector);
      if (!el || el.contains(e.relatedTarget)) return;
      clearTimeout(showTimer);
      if (el === anchor && !(pop && pop.contains(e.relatedTarget))) hideSoon();
    });
    root.addEventListener("mousedown", (e) => { if (e.target.closest(selector) && !pop?.contains(e.target)) hide(); });
    root.addEventListener("dragstart", hide);
  }
  addEventListener("scroll", (e) => { if (pop && !pop.contains(e.target)) hide(); }, { capture: true, passive: true });
  addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
  return { attach, hide };
})();
