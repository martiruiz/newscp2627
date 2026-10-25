// SCP Admin — Resources: the free resources (lead magnets) shown on the website's Free resources page and their landing pages.
// Each one has a title, a short description, what's inside, a cover and the PDF people get after leaving name + email.
// Data: table "resources" (supabase/resources.sql). Sign-ups per resource come from "newsletter_signups" (column resource).
(async () => {
  const A = window.SCPA;
  const { $, esc, icon } = A;
  try { await A.boot("resources"); } catch { return; }
  const main = $("[data-main]");
  const SITE = "https://sportscontentplaybook.com/";
  const STATUS = { live: "Available (asks name + email)", soon: "Coming soon" };
  const fail = (e) => A.toast(/relation .*resources|does not exist|schema cache|bucket|policy|row-level/i.test(e.message || "") ? "Run supabase/resources.sql in Supabase first." : e.message || String(e), "err");
  const slugify = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  const url = (r) => SITE + (r.landing_url || `resource.html?r=${r.slug}`);
  const state = (r) => (!r.published ? ["Hidden", "off"] : r.status === "live" ? (r.file_url ? ["Live", "ok"] : ["Live, no file", "off"]) : ["Coming soon", "off"]);

  main.innerHTML = `<div class="page-head"><div><h1>Resources</h1><p>Free resources for the website's Free resources page. “Available” ones ask for name + email before the download; the people who sign up join the newsletter.</p></div>
    <div class="head-actions"><a class="btn btn-ghost" href="../free-resources.html" target="_blank" rel="noopener">${icon("external")}See the page</a><button class="btn btn-primary" type="button" data-new>${icon("plus")}New resource</button></div></div>
    <section class="panel"><div class="table-wrap"><table class="data"><thead><tr><th>Resource</th><th>Landing page</th><th>Sign-ups</th><th>State</th><th></th></tr></thead>
      <tbody data-rows><tr><td colspan="5">Loading…</td></tr></tbody></table></div></section>`;

  let list = [], counts = {};
  async function draw() {
    const [{ data, error }, { data: su }] = await Promise.all([
      A.db.from("resources").select("*").order("sort").order("created_at"),
      A.db.from("newsletter_signups").select("resource").not("resource", "is", null),
    ]);
    if (error) { $("[data-rows]").innerHTML = `<tr><td colspan="5" class="muted">${esc(/relation .*resources|does not exist|schema cache/i.test(error.message) ? "Run supabase/resources.sql in Supabase first." : error.message)}</td></tr>`; return; }
    list = data || []; counts = {};
    (su || []).forEach((s) => (counts[s.resource] = (counts[s.resource] || 0) + 1));
    $("[data-rows]").innerHTML = list.length ? list.map((r) => {
      const [st, cls] = state(r);
      return `<tr>
        <td><b>${esc(r.title)}</b><br><small class="muted">${esc(r.slug)} · ${esc(STATUS[r.status])}</small></td>
        <td>${r.status === "live" ? `<a class="link" href="${esc(url(r))}" target="_blank" rel="noopener">${esc(r.landing_url || `resource.html?r=${r.slug}`)}</a>` : "—"}</td>
        <td>${counts[r.slug] || 0}</td>
        <td><span class="ms-badge is-${cls}">${st}</span></td>
        <td class="td-actions"><button class="btn btn-ghost btn-sm" type="button" data-pub="${r.id}">${r.published ? "Hide" : "Publish"}</button>
          <button class="btn btn-ghost btn-sm" type="button" data-edit="${r.id}">Edit</button>
          <button class="btn btn-ghost btn-sm" type="button" data-del="${r.id}" aria-label="Delete">${icon("trash")}</button></td></tr>`;
    }).join("") : `<tr><td colspan="5" class="muted">No resources yet. Press “New resource” to add the first one.</td></tr>`;
  }

  function editor(r = {}) {
    const m = A.modal({ title: r.id ? "Edit resource" : "New resource", size: "lg", body: `<form class="ms-form" data-f>
      <div class="ms-grid2" style="margin-top:0"><label>Title<input class="input" name="title" required maxlength="120" value="${esc(r.title || "")}" placeholder="Sports Content Calendar 2026–27"></label>
        <label>Short name for the link and for the sign-ups<input class="input" name="slug" required maxlength="60" pattern="[a-z0-9\\-]{2,60}" value="${esc(r.slug || "")}" ${r.id ? "readonly" : ""} placeholder="calendar-2026-27"></label></div>
      <label>Description (one or two sentences)<textarea class="input" name="description" rows="2" maxlength="300">${esc(r.description || "")}</textarea></label>
      <label>What’s inside (one point per line, on the landing page)<textarea class="input" name="bullets" rows="4" maxlength="600" placeholder="28 dates, 8 months, 9 sports&#10;A content angle for every date">${esc(r.bullets || "")}</textarea></label>
      <div class="ms-grid2"><label>State<select class="select" name="status"><option value="live"${r.status === "live" ? " selected" : ""}>${STATUS.live}</option><option value="soon"${r.status !== "live" ? " selected" : ""}>${STATUS.soon}</option></select></label>
        <label>Order (smaller shows first)<input class="input" name="sort" type="number" min="0" max="9999" value="${esc(r.sort ?? 100)}"></label></div>
      <div class="ms-grid2"><label>Cover (image link)<input class="input" name="cover_url" value="${esc(r.cover_url || "")}" placeholder="Upload below or paste a link"><input type="file" accept="image/png,image/jpeg,image/webp" data-up="cover_url" style="margin-top:6px"></label>
        <label>File to download (PDF link)<input class="input" name="file_url" value="${esc(r.file_url || "")}" placeholder="Upload below or paste a link"><input type="file" accept="application/pdf" data-up="file_url" style="margin-top:6px"></label></div>
      <label>Own landing page (optional; leave empty to use the standard one)<input class="input" name="landing_url" value="${esc(r.landing_url || "")}" placeholder="sports-content-calendar.html"></label>
      <label class="ms-check"><input type="checkbox" name="published"${r.id ? (r.published ? " checked" : "") : " checked"}> Shown on the website</label>
    </form>`, foot: `<button class="btn btn-ghost" type="button" data-x>Cancel</button><button class="btn btn-primary" type="button" data-save>Save</button>` });
    const f = $("[data-f]", m.el);
    if (!r.id) f.title.addEventListener("input", () => { if (!f.slug.dataset.touched) f.slug.value = slugify(f.title.value); });
    f.slug.addEventListener("input", () => (f.slug.dataset.touched = "1"));
    m.el.querySelectorAll("[data-up]").forEach((inp) => inp.addEventListener("change", async () => {
      const file = inp.files[0]; if (!file) return;
      const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      const name = `${slugify(f.slug.value || f.title.value || "resource")}-${inp.dataset.up === "file_url" ? "file" : "cover"}-${Date.now().toString(36)}.${ext}`;
      const { error } = await A.db.storage.from("resources").upload(name, file, { contentType: file.type, upsert: true });
      if (error) return fail(error);
      f[inp.dataset.up].value = A.db.storage.from("resources").getPublicUrl(name).data.publicUrl;
      A.toast("Uploaded. Save to keep it.");
    }));
    $("[data-x]", m.el).onclick = () => m.close();
    $("[data-save]", m.el).onclick = async () => {
      if (!f.reportValidity()) return;
      const v = Object.fromEntries(new FormData(f));
      const row = { title: v.title.trim(), slug: v.slug.trim(), description: v.description.trim() || null, bullets: v.bullets.trim() || null, status: v.status,
        cover_url: v.cover_url.trim() || null, file_url: v.file_url.trim() || null, landing_url: v.landing_url.trim() || null, sort: Number(v.sort) || 100, published: f.published.checked };
      if (row.status === "live" && !row.file_url && !(await A.confirmDialog({ title: "No file yet", text: "This resource is “Available” but has no file to download. People who sign up would get nothing. Save anyway?", confirm: "Save anyway" }))) return;
      const { error } = r.id ? await A.db.from("resources").update(row).eq("id", r.id) : await A.db.from("resources").insert(row);
      if (error) return fail(/duplicate key/i.test(error.message) ? new Error("That short name is already used.") : error);
      A.toast(r.id ? "Saved." : "Resource added."); m.close(); draw();
    };
  }

  main.addEventListener("click", async (e) => {
    if (e.target.closest("[data-new]")) return editor();
    const ed = e.target.closest("[data-edit]"); if (ed) return editor(list.find((r) => String(r.id) === ed.dataset.edit));
    const pub = e.target.closest("[data-pub]");
    if (pub) {
      const r = list.find((x) => String(x.id) === pub.dataset.pub);
      const { error } = await A.db.from("resources").update({ published: !r.published }).eq("id", r.id);
      if (error) return fail(error);
      A.toast(r.published ? "Hidden from the website." : "Shown on the website."); return draw();
    }
    const del = e.target.closest("[data-del]");
    if (del) {
      const r = list.find((x) => String(x.id) === del.dataset.del);
      if (!(await A.confirmDialog({ title: "Delete this resource?", text: `“${esc(r.title)}” will be deleted for good. The sign-ups it collected are kept. To take it off the website for now, hide it instead.`, confirm: "Delete", danger: true }))) return;
      const { error } = await A.db.from("resources").delete().eq("id", r.id);
      if (error) return fail(error);
      A.toast("Deleted."); draw();
    }
  });

  draw();
})();
