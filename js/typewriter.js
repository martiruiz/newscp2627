// Typewriter headline (home CTA): types a sentence, holds it, erases it and types the next one. The gold part of
// each sentence is written as <b> in the <template data-phrases>. Runs only while on screen; static for reduced motion.
(() => {
  document.querySelectorAll("[data-typewriter]").forEach((h) => {
    const out = h.querySelector(".tw-text");
    const tpl = h.querySelector("template[data-phrases]");
    if (!out || !tpl || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Each phrase → list of { ch, gold }, already in the page's language (the template isn't translated by js/i18n.js, and
    // typing English letters that get translated afterwards makes the text jump), so the typed text is left alone by it
    const tr = (t) => { const k = t.trim(); return k && window.tx ? t.replace(k, window.tx(k)) : t; };
    const phrases = [...tpl.content.querySelectorAll("p")].map((p) =>
      [...p.childNodes].flatMap((n) => [...tr(n.textContent)].map((ch) => ({ ch, gold: n.nodeName === "B" }))));
    out.setAttribute("data-i18n-skip", "");
    if (phrases.length < 2) return;
    const esc = (c) => (c === "<" ? "&lt;" : c === "&" ? "&amp;" : c);
    const render = (chars, n) => {
      let html = "", gold = false;
      for (const { ch, gold: g } of chars.slice(0, n)) {
        if (g !== gold) { html += g ? `<span class="gold">` : "</span>"; gold = g; }
        html += esc(ch);
      }
      out.innerHTML = html + (gold ? "</span>" : "");
    };
    // Keep the box as tall as the longest phrase so nothing jumps
    const measure = () => {
      let max = 0;
      phrases.forEach((p) => { render(p, p.length); max = Math.max(max, h.offsetHeight); });
      h.style.minHeight = `${max}px`;
      render(phrases[i], shown);
    };
    let i = 0, shown = phrases[0].length, mode = "hold", timer = null, visible = false;
    const TYPE = 42, ERASE = 18, HOLD = 2600, GAP = 350;
    const step = () => {
      timer = null;
      if (!visible) return;
      const p = phrases[i];
      if (mode === "type") {
        shown++;
        render(p, shown);
        h.classList.add("is-typing");
        if (shown >= p.length) { mode = "hold"; h.classList.remove("is-typing"); return (timer = setTimeout(step, HOLD)); }
        return (timer = setTimeout(step, TYPE + (p[shown - 1].ch === " " ? 30 : Math.random() * 35)));
      }
      if (mode === "hold") { mode = "erase"; return (timer = setTimeout(step, 0)); }
      if (mode === "erase") {
        shown = Math.max(0, shown - 2);
        render(p, shown);
        h.classList.add("is-typing");
        if (shown === 0) { i = (i + 1) % phrases.length; mode = "type"; h.setAttribute("aria-label", phrases[i].map((c) => c.ch).join("")); return (timer = setTimeout(step, GAP)); }
        return (timer = setTimeout(step, ERASE));
      }
    };
    measure();
    addEventListener("resize", () => { h.style.minHeight = ""; measure(); });
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !timer) timer = setTimeout(step, mode === "hold" ? HOLD : 0);
    }, { threshold: 0.4 }).observe(h);
  });
})();
