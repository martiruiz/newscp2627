// SCP Admin — Content hub: the day-by-day plan (26/10 – 30/11/2026) for every network and the website, with the script and the
// production status of each piece. Four views: Week grid (drag to reschedule), Calendar (by day), Pipeline (by stage, drag to change stage) and Scripts & video.
// Data: table "content_items" (supabase/content-hub.sql). Only admins can read it.
(async () => {
  const A = window.SCPA;
  const { $, esc, icon } = A;
  try { await A.boot("content"); } catch { return; }
  const main = $("[data-main]");
  const STAGES = ["Per generar", "Esborrany fet", "Aprovat", "En producció", "Programat", "Publicat"];
  const BLOCKED = ["Depèn de dades", "Cal confirmar"];
  const ALL = STAGES.concat(BLOCKED);
  const TONE = { "Per generar": "off", "Esborrany fet": "info", Aprovat: "ok", "En producció": "warn", Programat: "warn", Publicat: "ok", "Depèn de dades": "bad", "Cal confirmar": "bad" };
  const today = new Date().toISOString().slice(0, 10);
  const fmt = (d) => (d ? d.slice(8, 10) + "/" + d.slice(5, 7) : "");
  const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true });
  const DAYS = ["Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres", "Dissabte", "Diumenge"];
  const isoPlus = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
  const thumb = (i) => (/^https?:\/\/\S+\.(jpe?g|png|webp)(\?\S*)?$/i.test(i.link || "") ? `<img src="${esc(i.link)}" alt="" loading="lazy">` : "");
  const fail = (e) => A.toast(/relation .*content_items|does not exist|schema cache|row-level/i.test(e.message || "") ? "Run supabase/content-hub.sql in Supabase first." : e.message || String(e), "err");

  const v = A.store?.get?.("ch-state") || {};
  const S = { view: v.view || "grid", week: v.week || "1", net: "", vert: "", stage: "", owner: "", q: "" };
  let items = [];

  main.innerHTML = `<div class="page-head"><div><h1>Content hub</h1><p>The whole content plan in one place: what goes out each day on every network and on the website, its script and where it is in production. 26/10 – 30/11/2026.</p></div>
    <div class="head-actions"><div class="seg" data-views>
      <button type="button" data-v="grid">Week grid</button><button type="button" data-v="week">Calendar</button><button type="button" data-v="board">Pipeline</button><button type="button" data-v="scripts">Scripts &amp; video</button></div>
      <button class="btn btn-ghost" type="button" data-copy>${icon("copy")}Copy status for Claude</button></div></div>
    <div class="ch-stats" data-stats></div>
    <section class="panel ch-filters"><div class="ch-filter-row">
      <label>Week<select class="select" data-f="week"><option value="all">All weeks</option>${[1, 2, 3, 4, 5].map((n) => `<option value="${n}">Week ${n}</option>`).join("")}</select></label>
      <label>Network<select class="select" data-f="net"></select></label>
      <label>Content vertical<select class="select" data-f="vert"></select></label>
      <label>Stage<select class="select" data-f="stage"></select></label>
      <label>Who does it<select class="select" data-f="owner"></select></label>
      <label class="ch-search">Search<input class="input" type="search" data-f="q" placeholder="Search a topic"></label>
    </div></section>
    <div data-body><p class="muted">Loading…</p></div>`;

  const body = $("[data-body]", main);
  const badge = (s) => `<span class="ms-badge is-${TONE[s] || "off"}">${esc(s)}</span>`;

  async function load() {
    const { data, error } = await A.db.from("content_items").select("*").order("pub_date").order("network").order("id").limit(1000);
    if (error) { body.innerHTML = `<div class="panel panel-pad"><h2>Content hub is not set up yet</h2><p class="muted" style="margin-top:6px">Run <code>supabase/content-hub.sql</code> in Supabase (SQL Editor → paste → Run). It creates the table and loads the 215 pieces of the plan.</p></div>`; return fail(error); }
    items = data || []; fillFilters(); draw();
  }
  function opts(sel, all, vals, cur) { sel.innerHTML = `<option value="">${all}</option>` + vals.map((x) => `<option${x === cur ? " selected" : ""}>${esc(x)}</option>`).join(""); }
  function fillFilters() {
    const u = (k) => [...new Set(items.map((i) => i[k]).filter(Boolean))].sort(natural);
    opts($('[data-f="net"]'), "All networks", u("network"), S.net);
    opts($('[data-f="vert"]'), "All verticals", u("vertical"), S.vert);
    opts($('[data-f="stage"]'), "All stages", ALL, S.stage);
    opts($('[data-f="owner"]'), "Anyone", u("owner"), S.owner);
    $('[data-f="week"]').value = S.week;
  }
  const visible = () => items.filter((i) => (S.week === "all" || String(i.week) === S.week) && (!S.net || i.network === S.net) && (!S.vert || i.vertical === S.vert)
    && (!S.stage || i.stage === S.stage) && (!S.owner || i.owner === S.owner) && (!S.q || `${i.topic} ${i.network} ${i.vertical}`.toLowerCase().includes(S.q.toLowerCase())));

  const row = (i, withDate) => `<tr data-open="${esc(i.id)}" tabindex="0">
    <td class="ch-net">${withDate ? `<span class="ch-d">${fmt(i.pub_date)}</span>` : ""}${esc(i.network)}</td>
    <td class="ch-topic"><b>${esc(i.topic)}</b><small class="muted">${esc(i.vertical || "")}${i.vertical && i.production ? " · " : ""}${esc(i.production || "")}${i.script ? " · script" : ""}${i.comment ? " · comment" : ""}</small></td>
    <td>${badge(i.stage)}</td>
    <td class="td-actions"><button class="btn btn-ghost btn-sm" type="button" data-next="${esc(i.id)}"${STAGES.indexOf(i.stage) === STAGES.length - 1 ? " disabled" : ""} title="Move to the next stage">Next stage</button>
      <button class="btn btn-ghost btn-sm" type="button" data-edit="${esc(i.id)}" aria-label="Open">${icon("edit")}</button></td></tr>`;

  function draw() {
    const counts = {}; items.forEach((i) => (counts[i.stage] = (counts[i.stage] || 0) + 1));
    $("[data-stats]", main).innerHTML = `<div class="ch-stat"><b>${items.length}</b><span>pieces</span></div>` + ALL.filter((s) => counts[s]).map((s) => `<div class="ch-stat"><b>${counts[s]}</b><span>${esc(s)}</span></div>`).join("");
    main.querySelectorAll("[data-views] button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === S.view)));
    const list = visible();
    if (!items.length) { body.innerHTML = `<div class="panel panel-pad"><p class="muted">No pieces yet. Run <code>supabase/content-hub.sql</code> in Supabase to load the plan.</p></div>`; return; }
    if (!list.length) { body.innerHTML = `<div class="panel table-empty">No pieces match these filters.</div>`; return; }
    const head = `<thead><tr><th>Network</th><th>Piece</th><th>Stage</th><th></th></tr></thead>`;
    if (S.view === "grid") {
      const wk = S.week === "all" ? (items.find((i) => i.pub_date >= today) || items[0] || {}).week || 1 : Number(S.week);
      const mon = isoPlus("2026-10-26", (wk - 1) * 7);
      body.innerHTML = `<div class="ch-grid">` + DAYS.map((dn, k) => { const d = isoPlus(mon, k), x = list.filter((i) => i.pub_date === d);
        return `<div class="ch-gday${d === today ? " is-today" : ""}" data-drop-date="${d}" data-drop-name="${dn}" data-drop-week="${wk}"><h3>${dn.slice(0, 3)} <span>${fmt(d)}</span><em>${x.length}</em></h3>${x.map((i) => `<button type="button" class="ch-gcard is-${TONE[i.stage] || "off"}" draggable="true" data-edit="${esc(i.id)}">${thumb(i)}<small>${esc(i.network)}</small><b>${esc(i.topic)}</b>${badge(i.stage)}</button>`).join("") || `<p class="muted ch-none">Nothing planned</p>`}</div>`; }).join("") + `</div><p class="muted ch-none">Drag a piece to another day to move it. Click it to edit the script, link and stage. To show a preview, paste the image URL of the carousel in "Audio, video or document".</p>`;
    } else if (S.view === "week") {
      const g = {}; list.forEach((i) => (g[i.pub_date] = g[i.pub_date] || []).push(i));
      body.innerHTML = Object.keys(g).sort().map((d) => `<section class="panel ch-day${d === today ? " is-today" : ""}"><header><h2>${esc(g[d][0].day_name || "")} ${fmt(d)}</h2><span class="muted">${g[d].length} pieces</span></header>
        <div class="table-wrap"><table class="data ch-table">${head}<tbody>${g[d].map((i) => row(i)).join("")}</tbody></table></div></section>`).join("");
    } else if (S.view === "board") {
      body.innerHTML = `<div class="ch-board">` + ALL.map((s) => { const x = list.filter((i) => i.stage === s);
        return `<div class="ch-col" data-drop-stage="${esc(s)}"><h3>${esc(s)}<span>${x.length}</span></h3>${x.slice(0, 80).map((i) => `<button type="button" class="ch-card" draggable="true" data-edit="${esc(i.id)}"><small>${fmt(i.pub_date)} · ${esc(i.network)}</small><b>${esc(i.topic)}</b></button>`).join("") || `<p class="muted ch-none">Nothing here</p>`}${x.length > 80 ? `<p class="muted ch-none">Filter to see the rest</p>` : ""}</div>`; }).join("") + `</div>`;
    } else {
      const x = list.filter((i) => i.script || /càmera|Motion/i.test(i.production || ""));
      body.innerHTML = x.length ? `<section class="panel"><div class="table-wrap"><table class="data ch-table">${head}<tbody>${x.map((i) => row(i, true)).join("")}</tbody></table></div></section>` : `<div class="panel table-empty">No scripts or videos with these filters.</div>`;
    }
  }

  async function save(id, patch, ok) {
    const { error } = await A.db.from("content_items").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return fail(error);
    Object.assign(items.find((i) => i.id === id), patch); if (ok) A.toast(ok); draw();
  }

  function editor(i) {
    const m = A.modal({ title: i.topic, size: "lg", body: `<form class="ms-form" data-f>
      <dl class="ch-kv">${[["Date", `${i.day_name || ""} ${fmt(i.pub_date)}`], ["Network", `${i.network} · ${i.account || ""}`], ["Vertical", i.vertical], ["Format", i.format], ["Production", i.production], ["Source", i.source], ["Call to action", i.cta], ["UTM", i.utm], ["Review before", fmt(i.due)], ["Note", i.note], ["Who does it", i.owner]]
        .filter((r) => r[1] && String(r[1]).trim()).map((r) => `<dt>${r[0]}</dt><dd>${esc(r[1])}</dd>`).join("")}</dl>
      <label>Stage<select class="select" name="stage">${ALL.map((s) => `<option${s === i.stage ? " selected" : ""}>${esc(s)}</option>`).join("")}</select></label>
      <label>Script<textarea class="input ch-script" name="script" rows="12" placeholder="Script or text of the piece">${esc(i.script || "")}</textarea></label>
      <label>Audio, video or document (link, or the path on the SSD)<input class="input" name="link" value="${esc(i.link || "")}" placeholder="MOTION GRAPHICS/tt-20261027-v2.mp3"></label>
      <label>Comment for Claude (what to change)<textarea class="input" name="comment" rows="3">${esc(i.comment || "")}</textarea></label>
    </form>`, foot: `<button class="btn btn-ghost" type="button" data-x>Cancel</button><button class="btn btn-primary" type="button" data-save>Save</button>` });
    $("[data-x]", m.el).onclick = () => m.close();
    $("[data-save]", m.el).onclick = async () => {
      const f = $("[data-f]", m.el);
      await save(i.id, { stage: f.stage.value, script: f.script.value.trim() || null, link: f.link.value.trim() || null, comment: f.comment.value.trim() || null }, "Saved."); m.close();
    };
  }

  let dragId = null;
  main.addEventListener("dragstart", (e) => { const c = e.target.closest("[draggable][data-edit]"); if (!c) return; dragId = c.dataset.edit; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", dragId); });
  main.addEventListener("dragover", (e) => { const z = e.target.closest("[data-drop-date],[data-drop-stage]"); if (!z || !dragId) return; e.preventDefault(); z.classList.add("is-over"); });
  main.addEventListener("dragleave", (e) => { e.target.closest?.("[data-drop-date],[data-drop-stage]")?.classList.remove("is-over"); });
  main.addEventListener("drop", (e) => {
    const z = e.target.closest("[data-drop-date],[data-drop-stage]"); if (!z || !dragId) return; e.preventDefault(); z.classList.remove("is-over");
    const i = items.find((x) => x.id === dragId); dragId = null; if (!i) return;
    if (z.dataset.dropDate) { if (i.pub_date !== z.dataset.dropDate) save(i.id, { pub_date: z.dataset.dropDate, day_name: z.dataset.dropName, week: Number(z.dataset.dropWeek) }, `Moved to ${z.dataset.dropName} ${fmt(z.dataset.dropDate)}.`); }
    else if (i.stage !== z.dataset.dropStage) save(i.id, { stage: z.dataset.dropStage }, `Moved to “${z.dataset.dropStage}”.`);
  });
  main.addEventListener("dragend", () => { dragId = null; main.querySelectorAll(".is-over").forEach((n) => n.classList.remove("is-over")); });

  main.addEventListener("click", (e) => {
    const nx = e.target.closest("[data-next]");
    if (nx) { e.stopPropagation(); const i = items.find((x) => x.id === nx.dataset.next); const k = STAGES.indexOf(i.stage);
      return save(i.id, { stage: STAGES[k < 0 ? 1 : Math.min(k + 1, STAGES.length - 1)] }, `Moved to “${STAGES[k < 0 ? 1 : Math.min(k + 1, STAGES.length - 1)]}”.`); }
    const ed = e.target.closest("[data-edit],[data-open]");
    if (ed) return editor(items.find((x) => x.id === (ed.dataset.edit || ed.dataset.open)));
    const vb = e.target.closest("[data-views] button");
    if (vb) { S.view = vb.dataset.v; A.store?.set?.("ch-state", { view: S.view, week: S.week }); draw(); }
    if (e.target.closest("[data-copy]")) {
      const out = items.filter((i) => i.stage !== "Per generar" || i.comment || i.link).map((i) => ({ id: i.id, date: i.pub_date, network: i.network, topic: i.topic, stage: i.stage, link: i.link || undefined, comment: i.comment || undefined }));
      const text = JSON.stringify(out, null, 1);
      (navigator.clipboard?.writeText(text) || Promise.reject()).then(() => A.toast(`Copied ${out.length} pieces. Paste them in the chat with Claude.`)).catch(() => A.toast("Could not copy. Allow clipboard access and try again.", "err"));
    }
  });
  main.addEventListener("keydown", (e) => { const r = e.target.closest?.("tr[data-open]"); if (r && e.key === "Enter" && e.target === r) editor(items.find((x) => x.id === r.dataset.open)); });
  main.addEventListener("input", (e) => { const f = e.target.dataset.f; if (!f) return; S[f] = e.target.value; if (f === "week") A.store?.set?.("ch-state", { view: S.view, week: S.week }); draw(); });

  load();
})();
