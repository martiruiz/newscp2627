// SCP Admin — Leads & Demos: people who went through the lead flow (js/lead-flow.js), their answers, demos booked,
// commercial status, where they came from, the funnel step by step (A/B too) and the recommendation rules.
// Data: supabase/leads.sql (admin_leads, admin_set_lead, admin_lead_rules, admin_lead_funnel).
(async () => {
  const A = window.SCPA;
  const { $, $$, esc, icon, num, info } = A;
  const main = $("[data-main]");
  const CRM = main.dataset.view === "crm";   // admin/crm.html: the pipeline board on its own page
  try { await A.boot(CRM ? "crm" : "leads"); } catch { return; }
  const ORG = { club: "Sports Club / Team", agency: "Sports Agency", company: "Sports company", league: "League / Federation", event: "Sports Event Organizer", creator: "Content Creator", other: "Other" };
  const SIZE = { "1": "Just me", "2-5": "2–5", "6-15": "6–15", "15+": "15+" };
  const CH = { ideas: "Fresh content ideas", ai_time: "Saving time with AI", calendar: "Content calendar", performance: "Content performance", multiple_teams: "Multiple teams", exploring: "Exploring SCP" };
  const STATUS = { new: "New", qualified: "Qualified", demo_booked: "Demo booked", demo_completed: "Demo completed", trial: "In trial", customer: "Customer", lost: "Lost" };
  const MEET = { none: "—", booked: "Booked", rescheduled: "Rescheduled", cancelled: "Cancelled", completed: "Completed", no_show: "No-show" };
  const f = { q: "", status: "", org_type: "", challenge: "", identified: true };
  let leads = [], tab = "all";
  // tabs: what came in from the website, by kind (a lead can be in more than one: a demo with a message…)
  const TABS = [["all", "All", () => true], ["demos", "Booked demos", (l) => !!l.meeting_at || (l.meeting_status && l.meeting_status !== "none")],
    ["phone", "Phone contacts", (l) => !!l.phone], ["messages", "Messages", (l) => !!(l.message || "").trim()]];

  const filters = `<div class="aud-filters panel ld-filters">
      <input class="input" type="search" placeholder="Search name, email, organisation…" data-f="q">
      <select class="select" data-f="status"><option value="">All statuses</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
      <select class="select" data-f="org_type"><option value="">All organisation types</option>${Object.entries(ORG).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
      <select class="select" data-f="challenge"><option value="">All needs</option>${Object.entries(CH).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
      <label class="check-inline"><input type="checkbox" data-f="identified" checked> With email or phone</label>
    </div>`;
  main.innerHTML = CRM ? `<div class="page-head"><div><h1>CRM</h1><p data-sub>Loading…</p></div>
    <div class="head-actions"><a class="btn" href="leads.html">${icon("external")}Leads &amp; Demos</a><button class="btn btn-primary" type="button" data-add>${icon("plus")}Add client</button></div></div>
    <div class="aud-kpis" data-kpis></div>${filters}
    <section class="panel ld-crm"><header class="aud-h aud-h-lg"><h2>Pipeline</h2>${info("Every lead as a card in its commercial stage. Drag a card to another column to change its status; click a card for every answer, the demo and notes. The filters above apply here too.")}<span class="spacer"></span><b class="aud-count" data-crm-count></b></header><div class="crm-board" data-board></div></section>`
  : `<div class="page-head"><div><h1>Leads &amp; Demos</h1><p data-sub>Loading…</p></div>
    <div class="head-actions"><a class="btn" href="crm.html">${icon("columns")}Open the CRM</a><button class="btn" type="button" data-rules>${icon("edit")}Recommendation rules</button>
    <button class="btn btn-primary" type="button" data-export>${icon("download")}Export authorised contacts</button></div></div>
    <div class="aud-kpis" data-kpis></div>
    <section class="panel ld-funnel" data-funnel><p class="muted panel-pad">Loading the funnel…</p></section>
    ${filters}
    <nav class="ms-tabs ld-tabs" role="tablist" data-tabs></nav>
    <section class="panel ld-list"><header class="aud-h aud-h-lg"><h2>Leads</h2>${info("People who left their details in the lead form (Book a demo / Contact / the home questions), newest activity first. Click a row for every answer, the demo and notes; change the commercial status right in the list. Filters above apply.")}<span class="spacer"></span><b class="aud-count" data-count></b></header><div data-list><p class="muted panel-pad">Loading…</p></div></section>`;

  const fmt = (iso) => (iso ? new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
  const source = (l) => [l.utm?.utm_source, l.utm?.utm_campaign].filter(Boolean).join(" / ") || l.utm?.referrer || l.source_page || "—";

  async function load() {
    const p = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== "" && v !== false));
    const { data, error } = await A.db.rpc("admin_leads", { p });
    if (error) {
      ($("[data-list]") || $("[data-board]")).innerHTML = `<p class="panel-pad muted">${esc(/admin_leads|does not exist|schema cache/i.test(error.message) ? "Leads aren't set up yet — run supabase/leads.sql in Supabase." : A.errMsg(error))}</p>`;
      $("[data-sub]").textContent = ""; return;
    }
    leads = data || [];
    const booked = leads.filter((l) => l.meeting_status === "booked" || l.meeting_status === "rescheduled").length;
    $("[data-sub]").textContent = `${num(leads.length)} lead${leads.length === 1 ? "" : "s"} · ${num(booked)} upcoming demo${booked === 1 ? "" : "s"}`;
    const kpi = (label, tip, n, cls = "") => `<div class="aud-kpi${cls ? ` ${cls}` : ""}"><span>${label} ${info(tip)}</span><b>${n}</b></div>`;
    $("[data-kpis]").innerHTML = kpi("Leads", "Leads that match the filters below (with “With email only” on, just the ones who gave their email).", num(leads.length))
      + kpi("Upcoming demos", "Leads with a demo booked or rescheduled (Cal.com sends it here; ✓ = confirmed by Cal.com).", num(booked), "is-gold")
      + kpi("Customers", "Leads whose commercial status you set to Customer.", num(leads.filter((l) => l.status === "customer").length), "is-green")
      + kpi("Marketing consent", "Leads who accepted receiving marketing emails. Only these go in the “Export authorised contacts” file.", num(leads.filter((l) => l.email && l.marketing_consent).length));
    render();
  }

  // CRM board: one column per commercial status; drag a card to move it
  const COLS = { new: "", qualified: "is-gold", demo_booked: "is-gold", demo_completed: "is-blue", trial: "is-blue", customer: "is-green", lost: "is-red" };
  function board() {
    $("[data-crm-count]").textContent = num(leads.length);
    $("[data-board]").innerHTML = Object.entries(STATUS).map(([k, label]) => {
      const list = leads.filter((l) => (l.status || "new") === k);
      return `<div class="crm-col ${COLS[k]}" data-col="${k}"><header><span class="crm-dot"></span><b>${label}</b><span class="crm-n">${num(list.length)}</span></header>
        <div class="crm-cards">${list.map((l) => `<article class="crm-card" draggable="true" data-card="${l.id}">
          <div class="ld-person"><span class="ld-av">${esc((l.name || l.email || l.phone || "?").trim().charAt(0).toUpperCase())}</span><span><b>${esc(l.name || (l.phone ? "Phone lead" : "Anonymous"))}</b><small>${esc(l.organization || ORG[l.org_type] || l.email || l.phone || "—")}</small></span></div>
          <div class="crm-meta">${l.status === "trial" && !l.seen_at ? `<span class="ld-pill is-gold">● New trial</span>` : ""}${l.status === "trial" && l.trial_end ? `<span class="crm-tag">Trial ends ${fmt(l.trial_end)}</span>` : ""}${l.meeting_at ? `<span class="ld-pill is-gold">Demo · ${fmt(l.meeting_at)}</span>` : ""}${l.phone ? `<span class="crm-tag">Phone</span>` : ""}${(l.message || "").trim() ? `<span class="crm-tag">Message</span>` : ""}<span class="crm-when">${fmt(l.updated_at)}</span></div>
        </article>`).join("") || `<p class="crm-empty">—</p>`}</div></div>`;
    }).join("");
  }
  async function setStatus(id, status) {
    const { error } = await A.db.rpc("admin_set_lead", { p_id: id, p: { status } });
    if (error) { A.toast(A.errMsg(error), "err"); return false; }
    A.toast(`Status: ${STATUS[status]}`);
    const l = leads.find((x) => x.id === id); if (l) l.status = status;
    return true;
  }
  main.addEventListener("dragstart", (e) => { const c = e.target.closest?.("[data-card]"); if (c) { e.dataTransfer.setData("text/plain", c.dataset.card); c.classList.add("is-drag"); } });
  main.addEventListener("dragend", (e) => { e.target.closest?.("[data-card]")?.classList.remove("is-drag"); $$(".crm-col.is-over").forEach((x) => x.classList.remove("is-over")); });
  main.addEventListener("dragover", (e) => { const col = e.target.closest?.("[data-col]"); if (!col) return; e.preventDefault(); $$(".crm-col.is-over").forEach((x) => x !== col && x.classList.remove("is-over")); col.classList.add("is-over"); });
  main.addEventListener("drop", async (e) => {
    const col = e.target.closest?.("[data-col]"); if (!col) return;
    e.preventDefault(); col.classList.remove("is-over");
    const id = e.dataTransfer.getData("text/plain"), l = leads.find((x) => x.id === id);
    if (l && (l.status || "new") !== col.dataset.col && await setStatus(id, col.dataset.col)) render();
  });

  function render() {
    if ($("[data-board]")) board();
    if (!$("[data-list]")) return;
    $("[data-tabs]").innerHTML = TABS.map(([k, label, ok]) => `<a href="#" role="tab" data-tab="${k}" aria-selected="${tab === k}">${label} <b>${num(leads.filter(ok).length)}</b></a>`).join("");
    const list = leads.filter(TABS.find(([k]) => k === tab)[2]);
    $("[data-count]").textContent = num(list.length);
    $("[data-list]").innerHTML = list.length ? `<div class="table-wrap"><table class="data ld-table"><thead><tr>
      <th>Updated</th><th>Person</th><th>Organisation</th><th>Type</th><th>Team</th><th>Need</th><th>Next step</th><th>Status</th><th>Demo</th><th>Source</th></tr></thead><tbody>
      ${list.map((l) => `<tr data-id="${l.id}" class="row-click">
        <td>${fmt(l.updated_at)}</td>
        <td><div class="ld-person"><span class="ld-av">${esc((l.name || l.email || l.phone || "?").trim().charAt(0).toUpperCase())}</span><span><b>${esc(l.name || (l.phone ? "Phone lead" : "Anonymous"))}</b><small>${esc([l.email, l.phone].filter(Boolean).join(" · ") || "no email yet")}</small>${tab === "messages" ? `<small class="ld-msg">“${esc(l.message.trim().slice(0, 90))}${l.message.trim().length > 90 ? "…" : ""}”</small>` : ""}</span></div></td>
        <td>${esc(l.organization || "—")}</td><td>${esc(ORG[l.org_type] || "—")}</td><td>${esc(SIZE[l.team_size] || "—")}</td><td>${esc(CH[l.challenge] || "—")}</td>
        <td>${l.recommendation === "demo" ? `<span class="ld-pill is-gold">Demo</span>` : l.recommendation === "trial" ? `<span class="ld-pill is-blue">Free trial</span>` : "—"}</td>
        <td><select class="select select-sm ld-status st-${l.status}" data-status="${l.id}">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${l.status === k ? " selected" : ""}>${v}</option>`).join("")}</select></td>
        <td>${l.meeting_at ? `${fmt(l.meeting_at)}<br><small class="muted">${esc(MEET[l.meeting_status] || "")}${l.meeting_source === "calcom-webhook" ? " ✓" : ""}</small>` : esc(MEET[l.meeting_status] || "—")}</td>
        <td><small>${esc(source(l))}</small><br><small class="muted">${esc(l.cta || "")}</small></td></tr>`).join("")}
      </tbody></table></div>` : `<p class="panel-pad muted">No leads with these filters yet.</p>`;
  }

  async function funnel() {
    const { data, error } = await A.db.rpc("admin_lead_funnel", { p_days: 30 });
    if (error) { $("[data-funnel]").innerHTML = `<p class="muted panel-pad">The funnel appears once supabase/leads.sql has been run.</p>`; return; }
    const rows = data || [];
    const variants = [...new Set(rows.map((r) => r.variant).filter(Boolean))].sort();
    const get = (event, step, v) => rows.filter((r) => r.event === event && (step == null || r.step === step) && (!v || r.variant === v)).reduce((s, r) => s + Number(r.browsers), 0);
    const STEPS = [["Started", "form_started"], ["Organisation", "form_step_completed", "org_type"], ["Team size", "form_step_completed", "team_size"], ["Challenge", "form_step_completed", "challenge"],
      ["Lead (details)", "lead_created"], ["Calendar opened", "demo_booking_started"], ["Demo booked", "demo_booked"], ["Free trial started", "free_trial_started"], ["Subscription", "subscription_created"], ["Abandoned", "form_abandoned"]];
    const col = (v) => { const start = get("form_started", null, v) || 0;
      return STEPS.map(([lab, ev, step]) => { const n = get(ev, step ?? null, v); const pct = start ? Math.round((n / start) * 100) : 0;
        return `<li${ev === "form_abandoned" ? ` class="is-out"` : ""}><span>${lab}</span><b>${num(n)}</b><small>${start ? `${pct}%` : ""}</small><i style="width:${Math.max(2, pct)}%"></i></li>`; }).join(""); };
    $("[data-funnel]").innerHTML = `<header class="aud-h aud-h-lg"><h2>Funnel · last 30 days</h2>${info("How many visitors reach each step of the lead form, counted as distinct browsers (no personal data). % = of those who started. Abandoned = left the form halfway. If an A/B test is running, each version has its own column.")}
      <span class="aud-n">${variants.length > 1 ? "A/B test running: " + esc(variants.join(" vs ")) : `Variant: ${esc(variants[0] || "new")}`}</span></header>
      <div class="ld-funnel-cols" style="grid-template-columns:repeat(${Math.max(1, variants.length)},minmax(0,1fr))">${(variants.length ? variants : [""]).map((v) => `<div>${variants.length > 1 ? `<h3>${esc(v)}</h3>` : ""}<ol class="ld-steps">${col(v)}</ol></div>`).join("")}</div>`;
  }

  // every field saves on its own as you type or change it
  function openLead(id) {
    const l = leads.find((x) => x.id === id); if (!l) return;
    const kv = (k, v) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`;
    const field = (k, label, type = "text") => `<label class="ld-field"><span>${label}</span><input class="input" type="${type}" data-k="${k}" value="${esc(l[k] || "")}"></label>`;
    const opts = (map, cur, none) => (none ? `<option value="">${none}</option>` : "") + Object.entries(map).map(([k, v]) => `<option value="${k}"${cur === k ? " selected" : ""}>${v}</option>`).join("");
    const m = A.modal({ title: l.name || l.email || (l.phone ? "Phone lead" : "Anonymous lead"), sub: `<span data-saved class="muted">Changes save automatically</span>`, size: "lg",
      body: `<div class="ld-fields">${field("name", "Name")}${field("email", "Email", "email")}${field("phone", "Phone", "tel")}${field("organization", "Organisation")}
          <label class="ld-field"><span>Type</span><select class="select" data-k="org_type">${opts(ORG, l.org_type, "—")}</select></label>
          <label class="ld-field"><span>Status</span><select class="select" data-k="status">${opts(STATUS, l.status)}</select></label>
          <label class="ld-field"><span>Demo status</span><select class="select" data-k="meeting_status">${opts(MEET, l.meeting_status)}</select></label></div>
        <h3>Notes</h3><textarea class="input" rows="4" data-k="admin_notes" style="width:100%">${esc(l.admin_notes || "")}</textarea>
        <div class="kv-grid">${l.phone ? kv("WhatsApp", `<a href="https://wa.me/${esc(l.phone.replace(/[^0-9]/g, ""))}" target="_blank" rel="noopener">${esc(l.phone)}</a>`) : ""}${kv("Team", esc(SIZE[l.team_size] || "—"))}${kv("Need", esc(CH[l.challenge] || "—"))}
        ${kv("Recommended", l.recommendation === "demo" ? "Demo" : l.recommendation === "trial" ? "Free trial" : "—")}${kv("Created", fmt(l.created_at))}${l.trial_end ? kv("Trial ends", fmt(l.trial_end)) : ""}
        ${kv("Demo", l.meeting_at ? `${fmt(l.meeting_at)} · ${esc(MEET[l.meeting_status])}${l.meeting_source ? ` (${esc(l.meeting_source)})` : ""}` : "—")}
        ${kv("Source page", esc(l.source_page || "—"))}${kv("CTA", esc(l.cta || "—"))}${kv("Campaign", esc(Object.entries(l.utm || {}).map(([k, v]) => `${k}: ${v}`).join(" · ") || "—"))}
        ${kv("Language", esc(l.lang || "—"))}${kv("A/B variant", esc(l.variant || "—"))}
        ${kv("Privacy accepted", l.privacy_accepted_at ? fmt(l.privacy_accepted_at) : "—")}${kv("Marketing consent", l.marketing_consent ? `Yes · ${fmt(l.marketing_consent_at)}` : "No")}</div>
        ${l.message ? `<h3>Message</h3><p style="white-space:pre-wrap">${esc(l.message)}</p>` : ""}`,
      onClose: () => render() });
    const saved = $("[data-saved]", m.el), pending = {};
    const flush = A.debounce(async () => {
      const p = { ...pending }; Object.keys(pending).forEach((k) => delete pending[k]);
      saved.textContent = "Saving…";
      const { error } = await A.db.rpc("admin_set_lead", { p_id: id, p });
      if (error) { saved.textContent = A.errMsg(error); return A.toast(A.errMsg(error), "err"); }
      Object.assign(l, p, { updated_at: new Date().toISOString() });
      saved.textContent = "Saved ✓";
    }, 600);
    m.el.addEventListener("input", (e) => { const el = e.target.closest("[data-k]"); if (el) { pending[el.dataset.k] = el.value; flush(); } });
    // opening a new trial marks it as seen (it leaves the menu badge)
    if (l.status === "trial" && !l.seen_at) A.db.rpc("admin_set_lead", { p_id: id, p: { seen: true } }).then(({ error }) => { if (!error) { l.seen_at = new Date().toISOString(); A.crmBadge?.(); } });
  }
  async function addLead() {
    const m = A.modal({ title: "Add client", sub: "A lead or client you met outside the website.", size: "lg",
      body: `<div class="ld-fields">${[["name", "Name"], ["email", "Email", "email"], ["phone", "Phone", "tel"], ["organization", "Organisation"]].map(([k, label, type = "text"]) => `<label class="ld-field"><span>${label}</span><input class="input" type="${type}" data-k="${k}"></label>`).join("")}
          <label class="ld-field"><span>Type</span><select class="select" data-k="org_type"><option value="">—</option>${Object.entries(ORG).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>
          <label class="ld-field"><span>Status</span><select class="select" data-k="status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label></div>
        <h3>Notes</h3><textarea class="input" rows="3" data-k="admin_notes" style="width:100%"></textarea>`,
      foot: `<button class="btn btn-primary" type="button" data-create>Add</button>` });
    $("[data-create]", m.el).addEventListener("click", async () => {
      const p = Object.fromEntries($$("[data-k]", m.el).map((el) => [el.dataset.k, el.value.trim()]));
      if (!p.name && !p.email && !p.phone && !p.organization) return A.toast("Add at least a name, email, phone or organisation.", "err");
      const { data: newId, error } = await A.db.rpc("admin_add_lead", { p });
      if (error) return A.toast(/admin_add_lead|schema cache/i.test(error.message) ? "Run supabase/crm.sql in Supabase first." : A.errMsg(error), "err");
      m.close(); A.toast("Added"); await load(); openLead(newId);
    });
  }
  async function editRules() {
    const { data: r, error } = await A.db.rpc("admin_lead_rules", { p_rules: null });
    if (error) return A.toast(A.errMsg(error), "err");
    const group = (key, title, map) => `<h3>${title}</h3><div class="rules-grid">${Object.entries(map).map(([k, v]) => `<label class="check-inline"><select class="select select-sm" data-rule="${key}" data-v="${k}">
      <option value="">—</option><option value="demo"${(r[`demo${key}`] || []).includes(k) ? " selected" : ""}>Demo</option><option value="trial"${(r[`trial${key}`] || []).includes(k) ? " selected" : ""}>Free trial</option></select> ${esc(v)}</label>`).join("")}</div>`;
    const m = A.modal({ title: "Recommendation rules", sub: "Checked in this order: need → team size → organisation type → default. “—” means no opinion.", size: "lg",
      body: group("Challenges", "Biggest challenge", CH) + group("TeamSizes", "Team size", SIZE) + group("OrgTypes", "Organisation type", ORG)
        + `<h3>Default</h3><select class="select" data-default><option value="trial"${r.default !== "demo" ? " selected" : ""}>Free trial</option><option value="demo"${r.default === "demo" ? " selected" : ""}>Demo</option></select>`,
      foot: `<button class="btn btn-primary" type="button" data-save>Save rules</button>` });
    $("[data-save]", m.el).addEventListener("click", async () => {
      const out = { demoChallenges: [], trialChallenges: [], demoTeamSizes: [], trialTeamSizes: [], demoOrgTypes: [], trialOrgTypes: [], default: $("[data-default]", m.el).value };
      $$("[data-rule]", m.el).forEach((s) => { if (s.value) out[`${s.value}${s.dataset.rule}`].push(s.dataset.v); });
      const { error: e2 } = await A.db.rpc("admin_lead_rules", { p_rules: out });
      if (e2) return A.toast(A.errMsg(e2), "err");
      A.toast("Rules saved — the next visitors get them"); m.close();
    });
  }

  main.addEventListener("input", A.debounce((e) => { const el = e.target.closest("[data-f]"); if (el && el.type === "search") { f.q = el.value.trim(); load(); } }, 300));
  main.addEventListener("change", async (e) => {
    const el = e.target.closest("[data-f]");
    if (el && el.type !== "search") { f[el.dataset.f] = el.type === "checkbox" ? el.checked : el.value; return load(); }
    const s = e.target.closest("[data-status]");
    if (s && await setStatus(s.dataset.status, s.value)) { s.className = `select select-sm ld-status st-${s.value}`; board(); }
  });
  main.addEventListener("click", (e) => {
    const tb = e.target.closest("[data-tab]");
    if (tb) { e.preventDefault(); tab = tb.dataset.tab; return render(); }
    if (e.target.closest("[data-rules]")) return editRules();
    if (e.target.closest("[data-add]")) return addLead();
    if (e.target.closest("[data-export]")) {
      // only people who gave marketing consent
      const ok = leads.filter((l) => l.email && l.marketing_consent);
      if (!ok.length) return A.toast("No authorised contacts with these filters.", "err");
      const cols = ["name", "email", "organization", "org_type", "team_size", "challenge", "status", "marketing_consent_at", "created_at"];
      const csv = [cols.join(","), ...ok.map((l) => cols.map((c) => A.csvCell(l[c] ?? "")).join(","))].join("\n");
      A.downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `scp-leads-authorised-${new Date().toISOString().slice(0, 10)}.csv`);
      return;
    }
    const card = e.target.closest("[data-card]"); if (card) return openLead(card.dataset.card);
    const row = e.target.closest("tr[data-id]");
    if (row && !e.target.closest("select")) openLead(row.dataset.id);
  });

  load(); if (!CRM) funnel();
})();
