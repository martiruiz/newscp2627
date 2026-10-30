// Public page of one shared post (post.html?s=<token>, made with "Share" on a library card — supabase/post-shares.sql).
// Works without an account: shared_post() gives only the post of that link (the post, its metrics, its filters and the
// summary of its AI analysis); the rest of the library stays behind the log-in.
(async () => {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const tx = (s, v) => (window.tx ? window.tx(s, v) : s.replace(/\{(\w+)\}/g, (_, k) => v?.[k] ?? ""));
  const icon = (n) => (window.SCP_ICONS ? window.SCP_ICONS(n) : "");
  document.querySelectorAll("[data-icon]").forEach((el) => { el.outerHTML = icon(el.dataset.icon); });

  const cfg = window.SCP_CONFIG || {};
  const token = new URLSearchParams(location.search).get("s") || "";
  const missing = () => { $("[data-sp-loading]").hidden = true; $("[data-sp-missing]").hidden = false; };
  if (!/^[\w-]{6,40}$/.test(token)) return missing();
  const r = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/shared_post`, { method: "POST",
    headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token }) }).catch(() => null);
  const p = r?.ok ? await r.json().catch(() => null) : null;
  if (!p?.url) return missing();

  // the post: Instagram and X as the network shows them; video networks show the cover and play on ▶
  const u = p.url; let m;
  const pf = /instagram\.com/.test(u) ? "instagram" : /tiktok\.com/.test(u) ? "tiktok" : /youtu/.test(u) ? "youtube" : /(twitter|x)\.com/.test(u) ? "x" : /facebook\.com/.test(u) ? "facebook" : /linkedin\.com/.test(u) ? "linkedin" : "";
  let frame = "", player = "";
  if ((m = u.match(/instagram\.com\/(?:[\w.]+\/)?(p|reel|tv)\/([\w-]+)/))) frame = `https://www.instagram.com/${m[1]}/${m[2]}/embed/`;
  else if ((m = u.match(/(?:twitter|x)\.com\/[^/]+\/status\/(\d+)/))) frame = `https://platform.twitter.com/embed/Tweet.html?id=${m[1]}&theme=dark&dnt=true&hideThread=true`;
  else if ((m = u.match(/linkedin\.com\/feed\/update\/(urn:li:[\w:]+)/))) frame = `https://www.linkedin.com/embed/feed/update/${m[1]}`;
  else if ((m = u.match(/tiktok\.com\/.*video\/(\d+)/))) player = `https://www.tiktok.com/player/v1/${m[1]}?autoplay=1&music_info=0&description=0&rel=0&controls=1`;
  else if ((m = u.match(/(?:shorts\/|v=|youtu\.be\/)([\w-]{11})/))) player = `https://www.youtube-nocookie.com/embed/${m[1]}?autoplay=1&playsinline=1`;
  else if (pf === "facebook") player = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(u)}&show_text=false&autoplay=true`;
  const ytCover = (m = u.match(/(?:shorts\/|v=|youtu\.be\/)([\w-]{11})/)) ? `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` : "";
  const cover = p.cover_url || ytCover;
  const vertical = /tiktok|shorts\//.test(u) || /reel/.test(u);
  // the saved cover first (networks' embeds can be slow or blocked); ▶ / 👁 loads the network's own player or post
  const media = $("[data-sp-media]");
  const embed = (src, isIg) => { media.classList.remove("is-vertical"); media.innerHTML = `<iframe class="sp-frame${isIg ? " is-ig" : ""}" src="${esc(src)}" title="Post" scrolling="${isIg ? "no" : "auto"}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`; };
  if (cover) {
    media.classList.toggle("is-vertical", vertical);
    const open = player || (pf === "instagram" ? "" : frame);   // Instagram's embed no longer shows the image: its cover stays
    media.innerHTML = `<img src="${esc(cover)}" alt="">${open ? `<button class="sp-play" type="button" aria-label="${esc(tx(player ? "Play video" : "See the post"))}">${icon(player ? "play" : "eye")}</button>` : ""}`;
    media.querySelector("img").addEventListener("error", () => (frame ? embed(frame, pf === "instagram") : media.querySelector("img").remove()));
    media.querySelector(".sp-play")?.addEventListener("click", () => embed(open, !player && pf === "instagram"));
  } else if (frame) embed(frame, pf === "instagram");
  else media.innerHTML = `<a class="sp-nomedia" href="${esc(u)}" target="_blank" rel="noopener nofollow">${esc(tx("Open the post"))} ↗</a>`;

  // who, when, numbers
  const tag = (cat) => (p.tags || []).filter((t) => t.category === cat).map((t) => t.name);
  const who = tag("club")[0] || (p.account ? `@${p.account}` : "") || tag("competition")[0] || tag("entity")[0] || "";
  $("[data-sp-who]").textContent = who || tx("Shared post");
  const loc = window.SCP_LOC || "en-GB";
  $("[data-sp-date]").textContent = [p.published_at ? new Date(p.published_at).toLocaleDateString(loc, { day: "numeric", month: "long", year: "numeric" }) : "", { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", x: "X", facebook: "Facebook", linkedin: "LinkedIn" }[pf] || ""].filter(Boolean).join(" · ");
  const num = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K` : String(n));
  $("[data-sp-stats]").innerHTML = [["views", "eye"], ["likes", "heart"], ["comments", "message-circle"], ["shares", "repeat"]]
    .filter(([k]) => Number(p[k]) > 0).map(([k, ico]) => `<li>${icon(ico)}<b>${num(Number(p[k]))}</b><span>${esc(tx(k))}</span></li>`).join("");

  // the summary of its AI analysis (the full analysis is for members)
  if (p.summary) { $("[data-sp-summary]").textContent = p.summary; $("[data-sp-ai]").hidden = false; }

  // its filters, as in the library
  const SHOW = ["trend", "platform", "format", "sport", "competition", "club", "moment", "matchday_graphic", "season_moment", "outcome", "angle", "collab", "sponsor", "language"];
  $("[data-sp-tags]").innerHTML = (p.tags || []).filter((t) => SHOW.includes(t.category))
    .sort((a, b) => SHOW.indexOf(a.category) - SHOW.indexOf(b.category))
    .map((t) => `<span class="sp-tag${t.category === "trend" ? " is-trend" : ""}">${t.logo ? `<img src="${esc(t.logo)}" alt="" loading="lazy" onerror="this.remove()">` : ""}${esc(t.name)}</span>`).join("");

  if (p.title) $("[data-sp-caption]").textContent = p.title; else $("[data-sp-caption-box]").remove();
  $("[data-sp-open]").href = u;
  $("[data-sp-open]").textContent = `${tx("Open on {network}", { network: { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", x: "X", facebook: "Facebook", linkedin: "LinkedIn" }[pf] || tx("the network") })} ↗`;
  if (who) document.title = `${who} — ${document.title}`;
  $("[data-sp-loading]").hidden = true;
  $("[data-sp-post]").hidden = false;
})();
