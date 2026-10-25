// Feature cards (home "The smarter way…" carousel): a light that follows the cursor on each card, and the card
// animations (CSS, .fx-* in styles.css) run only while the carousel is on screen.
(() => {
  const root = document.querySelector("[data-carousel]");
  if (!root) return;
  new IntersectionObserver(([e]) => root.classList.toggle("fx-live", e.isIntersecting), { threshold: 0.15 }).observe(root);
  root.addEventListener("pointermove", (e) => {
    const card = e.target.closest(".feature-card");
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - r.left}px`);
    card.style.setProperty("--my", `${e.clientY - r.top}px`);
  });
})();
