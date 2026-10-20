// Home: "Play Now" opens the SCP video in a full-screen player (sound, subtitles in the page language).
// Phones / portrait screens get the vertical cut. Files: assets/video/ (made with video/render.mjs).
(() => {
  const btn = document.querySelector("[data-hero-video]");
  if (!btn) return;
  const V = "20261020b";
  const lang = window.SCP_LANG === "es" ? "es" : "en";
  let dlg = null;

  function open(e) {
    e.preventDefault();
    const vertical = matchMedia("(max-width: 700px), (orientation: portrait) and (max-width: 1000px)").matches;
    const file = vertical ? "scp-video-9x16" : "scp-video-16x9";
    dlg = document.createElement("div");
    dlg.className = `hv-modal${vertical ? " is-vertical" : ""}`;
    dlg.setAttribute("role", "dialog");
    dlg.setAttribute("aria-modal", "true");
    dlg.setAttribute("aria-label", "Sports Content Playbook video");
    dlg.innerHTML = `<div class="hv-box">
      <video controls autoplay playsinline preload="auto" poster="assets/video/${file}.jpg?v=${V}">
        <source src="assets/video/${file}.mp4?v=${V}" type="video/mp4">
        <track kind="subtitles" srclang="es" label="Español" src="assets/video/scp-video.es.vtt?v=${V}"${lang === "es" ? " default" : ""}>
        <track kind="subtitles" srclang="en" label="English" src="assets/video/scp-video.en.vtt?v=${V}">
      </video>
      <button type="button" class="hv-x" aria-label="Close video">✕</button></div>`;
    document.body.append(dlg);
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => dlg.classList.add("is-open"));
    dlg.querySelector(".hv-x").focus();
    dlg.addEventListener("click", (ev) => { if (ev.target === dlg || ev.target.closest(".hv-x")) close(); });
  }
  function close() {
    if (!dlg) return;
    dlg.querySelector("video")?.pause();
    dlg.remove(); dlg = null;
    document.body.style.overflow = "";
    btn.focus();
  }
  btn.addEventListener("click", open);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
})();
