// Content Library → "My space": click the title to fold the three buttons (My AI analyses, Content Plan, Saved boards)
// away to the right, and again to bring them back; the arrow points the way. Remembered in this browser.
(() => {
  const box = document.querySelector("[data-my-space]"), btn = box?.querySelector("[data-my-space-toggle]");
  if (!btn) return;
  const KEY = "scp-my-space-closed";
  const set = (closed, animate) => {
    box.classList.toggle("is-closed", closed);
    btn.setAttribute("aria-expanded", String(!closed));
    if (animate) { btn.classList.remove("is-kick"); void btn.offsetWidth; btn.classList.add("is-kick"); }
  };
  let closed = false;
  try { closed = localStorage.getItem(KEY) === "1"; } catch {}
  set(closed, false);
  btn.addEventListener("click", () => {
    closed = !closed;
    try { localStorage.setItem(KEY, closed ? "1" : "0"); } catch {}
    set(closed, true);
  });
})();
