// SCP Admin — Jobs: the job offers in sports digital marketing shown on the website's Jobs page (jobs.html).
// Added here by hand: title, company, where, how, the area, a short summary and the link to apply; published or hidden,
// and an optional last day. Data: table "jobs" (supabase/jobs.sql).
(async () => {
  const A = window.SCPA;
  const { $, esc, icon } = A;
  try { await A.boot("jobs"); } catch { return; }
  const main = $("[data-main]");
  const AREA = { social: "Social media", content: "Content", design: "Design", video: "Video", marketing: "Marketing", partnerships: "Partnerships", other: "Other" };
  const MODE = { onsite: "On site", hybrid: "Hybrid", remote: "Remote" };
  const TYPE = { "full-time": "Full time", "part-time": "Part time", internship: "Internship", freelance: "Freelance" };
  const opts = (map, cur) => Object.entries(map).map(([k, l]) => `<option value="${k}"${k === cur ? " selected" : ""}>${l}</option>`).join("");
  const day = (v) => (v ? new Date(v).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
  const fail = (e) => A.toast(/relation .*jobs|does not exist|schema cache/i.test(e.message || "") ? "Run supabase/jobs.sql in Supabase first." : e.message || String(e), "err");
  const today = new Date().toISOString().slice(0, 10);
  const state = (j) => (!j.published ? ["Hidden", "off"] : j.expires_at && j.expires_at < today ? ["Expired", "off"] : ["On the website", "ok"]);

  main.innerHTML = `<div class="page-head"><div><h1>Jobs</h1><p>Job offers in sports digital marketing for the website's Jobs page. Only the published ones that haven't expired show there.</p></div>
    <div class="head-actions"><a class="btn btn-ghost" href="../jobs.html" target="_blank" rel="noopener">${icon("external")}See the page</a><button class="btn btn-primary" type="button" data-new>${icon("plus")}New job</button></div></div>
    <section class="panel"><div class="table-wrap"><table class="data"><thead><tr><th>Job</th><th>Area</th><th>Where</th><th>Added</th><th>Until</th><th>State</th><th></th></tr></thead>
      <tbody data-rows><tr><td colspan="7">Loading…</td></tr></tbody></table></div></section>`;

  let list = [];
  async function draw() {
    const { data, error } = await A.db.from("jobs").select("*").order("created_at", { ascending: false });
    if (error) { $("[data-rows]").innerHTML = `<tr><td colspan="7" class="muted">${esc(/relation .*jobs|does not exist|schema cache/i.test(error.message) ? "Run supabase/jobs.sql in Supabase first." : error.message)}</td></tr>`; return; }
    list = data || [];
    $("[data-rows]").innerHTML = list.length ? list.map((j) => {
      const [st, cls] = state(j);
      return `<tr>
        <td><b>${esc(j.title)}</b><br><small class="muted">${esc(j.company)}</small></td>
        <td>${esc(AREA[j.area] || j.area)}</td>
        <td>${esc(j.location || "—")}<br><small class="muted">${esc(MODE[j.work_mode])} · ${esc(TYPE[j.job_type])}</small></td>
        <td>${esc(day(j.created_at))}</td>
        <td>${esc(day(j.expires_at) || "—")}</td>
        <td><span class="ms-badge is-${cls}">${st}</span></td>
        <td class="td-actions"><button class="btn btn-ghost btn-sm" type="button" data-pub="${j.id}">${j.published ? "Hide" : "Publish"}</button>
          <button class="btn btn-ghost btn-sm" type="button" data-edit="${j.id}">Edit</button>
          <button class="btn btn-ghost btn-sm" type="button" data-del="${j.id}" aria-label="Delete">${icon("trash")}</button></td></tr>`;
    }).join("") : `<tr><td colspan="7" class="muted">No jobs yet. Press “New job” to add the first one.</td></tr>`;
  }

  function editor(j = {}) {
    const m = A.modal({ title: j.id ? "Edit job" : "New job", size: "lg", body: `<form class="ms-form" data-f>
      <div class="ms-grid2" style="margin-top:0"><label>Job title<input class="input" name="title" required maxlength="140" value="${esc(j.title || "")}" placeholder="Social Media Manager"></label>
        <label>Company<input class="input" name="company" required maxlength="100" value="${esc(j.company || "")}" placeholder="FC Barcelona"></label></div>
      <div class="ms-grid2"><label>Where<input class="input" name="location" maxlength="100" value="${esc(j.location || "")}" placeholder="Barcelona, Spain"></label>
        <label>Company logo (image link, optional)<input class="input" name="logo_url" type="url" value="${esc(j.logo_url || "")}" placeholder="https://…"></label></div>
      <div class="ms-grid3"><label>Area<select class="select" name="area">${opts(AREA, j.area || "social")}</select></label>
        <label>Work mode<select class="select" name="work_mode">${opts(MODE, j.work_mode || "onsite")}</select></label>
        <label>Type<select class="select" name="job_type">${opts(TYPE, j.job_type || "full-time")}</select></label></div>
      <label>Summary (two or three lines)<textarea class="input" name="summary" rows="3" maxlength="400" placeholder="What the job is and what they look for.">${esc(j.summary || "")}</textarea></label>
      <div class="ms-grid2"><label>Link to apply<input class="input" name="apply_url" type="url" required value="${esc(j.apply_url || "")}" placeholder="https://…"></label>
        <label>Last day on the website (optional)<input class="input" name="expires_at" type="date" value="${esc(j.expires_at || "")}"></label></div>
      <label class="ms-check"><input type="checkbox" name="published"${j.id ? (j.published ? " checked" : "") : " checked"}> Published on the website</label>
    </form>`, foot: `<button class="btn btn-ghost" type="button" data-x>Cancel</button><button class="btn btn-primary" type="button" data-save>Save</button>` });
    const f = $("[data-f]", m.el);
    $("[data-x]", m.el).onclick = () => m.close();
    $("[data-save]", m.el).onclick = async () => {
      if (!f.reportValidity()) return;
      const v = Object.fromEntries(new FormData(f));
      const row = { title: v.title.trim(), company: v.company.trim(), location: v.location.trim() || null, logo_url: v.logo_url.trim() || null, area: v.area, work_mode: v.work_mode,
        job_type: v.job_type, summary: v.summary.trim() || null, apply_url: v.apply_url.trim(), expires_at: v.expires_at || null, published: f.published.checked };
      const { error } = j.id ? await A.db.from("jobs").update(row).eq("id", j.id) : await A.db.from("jobs").insert(row);
      if (error) return fail(error);
      A.toast(j.id ? "Saved." : "Job added."); m.close(); draw();
    };
  }

  main.addEventListener("click", async (e) => {
    if (e.target.closest("[data-new]")) return editor();
    const ed = e.target.closest("[data-edit]"); if (ed) return editor(list.find((j) => String(j.id) === ed.dataset.edit));
    const pub = e.target.closest("[data-pub]");
    if (pub) {
      const j = list.find((x) => String(x.id) === pub.dataset.pub);
      const { error } = await A.db.from("jobs").update({ published: !j.published }).eq("id", j.id);
      if (error) return fail(error);
      A.toast(j.published ? "Hidden from the website." : "Published."); return draw();
    }
    const del = e.target.closest("[data-del]");
    if (del) {
      const j = list.find((x) => String(x.id) === del.dataset.del);
      if (!(await A.confirmDialog({ title: "Delete this job?", text: `“${esc(j.title)}” at ${esc(j.company)} will be deleted for good. To take it off the website for now, hide it instead.`, confirm: "Delete", danger: true }))) return;
      const { error } = await A.db.from("jobs").delete().eq("id", j.id);
      if (error) return fail(error);
      A.toast("Deleted."); draw();
    }
  });

  draw();
})();
