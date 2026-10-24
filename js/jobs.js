// Jobs (jobs.html) — job offers in sports digital marketing, added from the admin (admin/jobs.html, table "jobs":
// supabase/jobs.sql). Anyone sees the published ones that haven't expired; filters by area, work mode and a search.
(() => {
  const t = (s, v) => (window.tx ? window.tx(s, v) : s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const AREA = { social: "Social media", content: "Content", design: "Design", video: "Video", marketing: "Marketing", partnerships: "Partnerships", other: "Other" };
  const MODE = { onsite: "On site", hybrid: "Hybrid", remote: "Remote" };
  const TYPE = { "full-time": "Full time", "part-time": "Part time", internship: "Internship", freelance: "Freelance" };
  const f = { area: "", mode: "", q: "" };
  let jobs = [];

  const list = document.querySelector("[data-jobs-list]"), empty = document.querySelector("[data-jobs-empty]");
  if (!list) return;

  const ago = (d) => {
    const days = Math.floor((Date.now() - new Date(d)) / 864e5);
    return days < 1 ? t("Today") : days === 1 ? t("Yesterday") : days < 7 ? t("{n} days ago", { n: days }) : new Date(d).toLocaleDateString(window.SCP_LOC || "en-GB", { day: "numeric", month: "short" });
  };
  const initials = (n) => String(n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  function draw() {
    const q = f.q.trim().toLowerCase();
    const shown = jobs.filter((j) => (!f.area || j.area === f.area) && (!f.mode || j.work_mode === f.mode)
      && (!q || [j.title, j.company, j.location, j.summary].some((v) => String(v || "").toLowerCase().includes(q))));
    list.innerHTML = shown.map((j) => `<article class="job">
        <span class="job-logo">${j.logo_url ? `<img src="${esc(j.logo_url)}" alt="" loading="lazy">` : esc(initials(j.company))}</span>
        <div class="job-body">
          <p class="job-co">${esc(j.company)}<span>${esc(ago(j.created_at))}</span></p>
          <h2>${esc(j.title)}</h2>
          ${j.summary ? `<p class="job-sum">${esc(j.summary)}</p>` : ""}
          <p class="job-tags"><span class="is-area">${esc(t(AREA[j.area] || j.area))}</span>${j.location ? `<span>${esc(j.location)}</span>` : ""}<span>${esc(t(MODE[j.work_mode] || j.work_mode))}</span><span>${esc(t(TYPE[j.job_type] || j.job_type))}</span></p>
        </div>
        <a class="btn btn-gold job-go" href="${esc(j.apply_url)}" target="_blank" rel="noopener nofollow">${esc(t("Apply"))} →</a>
      </article>`).join("");
    empty.hidden = !!shown.length;
  }

  // the filters: one choice per row (area, work mode) and the search
  document.querySelectorAll("[data-jobs-area], [data-jobs-mode]").forEach((row) => row.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    row.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    if (b.dataset.area !== undefined) f.area = b.dataset.area; else f.mode = b.dataset.mode;
    draw();
  }));
  document.querySelector("[data-jobs-search]")?.addEventListener("input", (e) => { f.q = e.target.value; draw(); });

  (async () => {
    const db = window.SCP_AUTH?.client;
    if (!db) { list.innerHTML = ""; empty.hidden = false; return; }
    try {
      const { data, error } = await db.from("jobs").select("id,title,company,logo_url,location,work_mode,job_type,area,summary,apply_url,created_at").eq("published", true).order("created_at", { ascending: false });
      jobs = error ? [] : data || [];
    } catch { jobs = []; }
    draw();
  })();
})();
