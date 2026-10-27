// SCP Admin — Newsletter → Automations: e-mail flows that run on their own (supabase/automations.sql + Edge Function
// automation-send). Flows are drafts until published: a published version is immutable and every contact keeps the version
// it entered with. Superadmins only (the tables' RLS and every RPC check public.is_admin()).
(async () => {
  const A = window.SCPA;
  const { $, $$, esc, icon, num } = A;
  let me;
  try { me = await A.boot("automations"); } catch { return; }
  const cfg = window.SCP_CONFIG || {};
  const main = $("[data-main]");
  const rpc = async (fn, args = {}) => { const { data, error } = await A.db.rpc(fn, args); if (error) throw new Error(error.message); return data; };
  const send = async (body) => {
    const s = (await A.db.auth.getSession()).data.session;
    const r = await fetch(`${cfg.supabaseUrl}/functions/v1/automation-send`, { method: "POST", headers: { "Content-Type": "application/json", apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${s?.access_token}` }, body: JSON.stringify(body) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (!r || (r.status === 404 && !d.error)) throw new Error("The automation-send function isn't deployed yet.");
    if (!r.ok) throw new Error(d.error || `automation-send: ${r.status}`);
    return d;
  };
  const busy = async (b, work) => { const t = b.innerHTML; b.disabled = true; b.textContent = "Working…"; try { await work(); } catch (e) { A.toast(e.message, "err"); } finally { b.disabled = false; b.innerHTML = t; } };
  const dt = (iso) => (iso ? A.fmtDateTime(iso) : "—");
  const uid = () => `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

  // ---------- vocabulary (only events and data SCP can really detect) ----------
  const TRIGGERS = {
    signup: "Signed up", trial_started: "Free trial started", trial_ends_in: "Trial ends in X hours", trial_ended_unpaid: "Trial ended without subscribing",
    inactive: "No sign-in for X days", first_saved_idea: "First idea saved", first_feature: "First use of a feature", tag_added: "Tag added to the contact",
    paid_started: "First paid subscription", cancel_scheduled: "Cancellation scheduled (still has access)", access_ended: "Access ended (subscription finished)",
  };
  const FEATURES = { search: "Saved search", ai: "AI analysis", planner: "Content Plan" };
  const FIELDS = [
    ["has_paid", "Has an active paid subscription", "bool"], ["in_trial", "Is in the free trial", "bool"], ["trial_ended_unpaid", "Trial ended without subscribing", "bool"],
    ["cancel_scheduled", "Has scheduled a cancellation", "bool"], ["logged_in_since_entry", "Signed in since entering the flow", "bool"],
    ["saved_idea", "Has saved an idea", "bool"], ["saved_search", "Has saved a search", "bool"], ["used_ai", "Has used AI analysis", "bool"],
    ["used_planner", "Has used the Content Plan", "bool"], ["consent", "Accepts commercial e-mails", "bool"], ["has_tag", "Has the tag", "text"],
    ["plan_is", "Plan", "plan"], ["locale_is", "Language", "locale"], ["org_type_is", "Organisation type", "text"],
    ["days_since_signup", "Days since sign-up", "num"], ["days_since_login", "Days since last sign-in", "num"], ["trial_days_left", "Trial days left", "num"],
  ];
  const FIELD = Object.fromEntries(FIELDS.map((f) => [f[0], f]));
  const STEP_LABEL = { wait: "Wait", condition: "Condition", email: "Send e-mail", tag: "Update contact", end: "End flow" };
  const END_REASONS = ["sequence finished", "goal met", "converted", "unsubscribed"];
  const VARS = ["first_name", "org_name", "trial_end_date", "trial_days_left", "plan_name", "platform_url", "pricing_url", "account_url", "unsubscribe_url"];
  const LOCALES = { en: "English", es: "Spanish", ca: "Catalan" };
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // small line icons of this page (the shared set lives in core.js)
  const SVG = {
    flow: '<circle cx="6" cy="5" r="2.2"/><circle cx="18" cy="12" r="2.2"/><circle cx="6" cy="19" r="2.2"/><path d="M8.2 5H12a3 3 0 0 1 3 3v1.8M15 14.2V16a3 3 0 0 1-3 3H8.2"/>',
    send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2a5 5 0 0 1 6 4.8"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    split: '<path d="M6 3v6a6 6 0 0 0 6 6h0a6 6 0 0 1 6 6"/><path d="M18 3v6a6 6 0 0 1-6 6"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
    pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
    play: '<path d="M7 4v16l13-8z"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  };
  const ic = (k) => (SVG[k] ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SVG[k]}</svg>` : icon(k));

  let flows = [], emails = [], plans = [], stats = null, settings = null, tests = 0, tab = A.store.get("au-tab", "overview");
  const range = { days: A.store.get("au-days", 30), flow: "" };

  main.innerHTML = `<div class="page-head"><div><h1>Automations</h1><p>E-mails that go out on their own at the right moment: during the trial, after sign-up, after the trial and for new customers.</p></div>
    <div class="head-actions"><a class="btn" href="audience.html">${icon("mail")}Newsletter</a><button class="btn btn-primary" type="button" data-new-flow>${icon("plus")}New flow</button></div></div>
    <section class="au-hero" data-hero></section>
    <nav class="au-tabs" data-tabs></nav>
    <div data-view></div>`;
  const view = $("[data-view]");
  const TABS = [["overview", "Overview", "audience"], ["flows", "Flows", "flow"], ["emails", "E-mails", "mail"], ["segments", "Segments", "filters"], ["contacts", "Contacts", "history"], ["settings", "Settings", "gear"]];

  async function load() {
    const [f, e, p, st, t] = await Promise.all([
      A.db.from("automation_flows").select("*").order("priority").order("id"),
      A.db.from("automation_emails").select("*").order("id"),
      A.db.from("plans").select("key,name").order("sort"),
      rpc("automation_settings"),
      A.db.from("automation_sends").select("id", { count: "exact", head: true }).eq("is_test", true).eq("status", "sent"),
    ]);
    if (f.error) { view.innerHTML = `<p class="aud-empty panel-pad">${esc(/does not exist|schema cache/i.test(f.error.message) ? "Run supabase/automations.sql in Supabase first." : f.error.message)}</p>`; throw f.error; }
    flows = f.data || []; emails = e.data || []; plans = p.data || []; settings = st; tests = t.count || 0;
    const to = new Date(), from = new Date(Date.now() - range.days * 864e5);
    stats = await rpc("automation_stats", { p_from: from.toISOString(), p_to: to.toISOString(), p_flow: range.flow ? Number(range.flow) : null });
    hero();
  }
  // the one thing to know first: are e-mails going out?
  function hero() {
    const on = settings?.automations?.sending_enabled, active = flows.filter((f) => f.status === "active").length;
    $("[data-hero]").className = `au-hero ${on ? "is-on" : "is-off"}`;
    $("[data-hero]").innerHTML = `<span class="au-hero-ic">${ic(on ? "send" : "pause")}</span>
      <div class="au-hero-t"><b>${on ? "Sending is on" : "Sending is off"}</b>
        <span>${on ? `${num(active)} active flow${active === 1 ? "" : "s"} e-mail contacts automatically. The engine checks every 5 minutes.` : "Build, simulate and test safely: no e-mail reaches a contact until you switch sending on."}</span></div>
      <button class="btn${on ? "" : " btn-primary"}" type="button" data-go-settings>${on ? "Sending settings" : "Review & switch on"}</button>`;
    $("[data-go-settings]").onclick = () => go("settings");
  }
  function tabs() {
    const count = { flows: flows.filter((f) => f.status !== "archived").length, emails: emails.length };
    $("[data-tabs]").innerHTML = TABS.map(([k, l, i]) => `<button type="button" data-tab="${k}" class="${k === tab ? "is-on" : ""}">${ic(i)}<span>${l}</span>${count[k] != null ? `<em>${count[k]}</em>` : ""}</button>`).join("");
  }
  const go = (t) => { tab = t; A.store.set("au-tab", tab); draw(); window.scrollTo({ top: 0, behavior: "smooth" }); };
  function draw() {
    view.onclick = null; view.onchange = null;
    tabs();
    ({ overview, flows: flowsView, emails: emailsView, segments: segmentsView, contacts: contactsView, settings: settingsView })[tab]();
  }
  $("[data-tabs]").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) go(b.dataset.tab); });
  $("[data-new-flow]").onclick = () => newFlow();
  async function newFlow() {
    const { data, error } = await A.db.from("automation_flows").insert({ name: "New flow", definition: { trigger: { type: "signup" }, entry: { mode: "once" }, exit: { on_paid: true }, start: null, steps: {} } }).select().single();
    if (error) return A.toast(error.message, "err");
    flows.push(data); editor(data);
  }

  // ---------- helpers: human summaries ----------
  const ruleText = (r) => {
    const f = FIELD[r.field]; if (!f) return "?";
    if (f[2] === "bool") return `${f[1]}: ${r.value === false || r.value === "false" ? "no" : "yes"}`;
    if (f[2] === "num") return `${f[1]} ${r.op === "lte" ? "≤" : "≥"} ${r.value}`;
    return `${f[1]} ${r.op === "is_not" ? "is not" : "is"} ${r.value || "—"}`;
  };
  const condText = (c) => (c?.rules?.length ? c.rules.map(ruleText).join(c.logic === "or" ? " OR " : " AND ") : "No rules");
  const triggerText = (t = {}) => {
    let s = TRIGGERS[t.type] || "No trigger";
    if (t.type === "trial_ends_in") s = `Trial ends in ${t.hours || 0} h`;
    if (t.type === "trial_ended_unpaid" && Number(t.hours)) s += ` (+${t.hours} h)`;
    if (t.type === "inactive") s = `No sign-in for ${t.days || "?"} days`;
    if (t.type === "first_feature") s = `First use: ${FEATURES[t.feature || "search"]}`;
    if (t.type === "tag_added") s = `Tag added: ${t.tag || "?"}`;
    return s;
  };
  const stepText = (s) => {
    if (s.type === "wait") {
      if ((s.mode || "duration") === "duration") return `${s.amount || 0} ${s.unit || "days"}`;
      if (s.mode === "until_event") { const h = Number(s.offset_hours || 0); return `Until ${Math.abs(h)} h ${h < 0 ? "before" : "after"} ${{ trial_end: "trial end", signup: "sign-up", entered: "entering the flow" }[s.anchor] || "?"}${s.if_past === "continue" ? " · if past: continue" : " · if past: skip next e-mail"}`; }
      return `Until ${(s.days || []).map((d) => DAYS[d - 1]).join(", ")} ${s.from_hour ?? 9}:00–${s.to_hour ?? 18}:00`;
    }
    if (s.type === "condition") return condText(s);
    if (s.type === "email") return emails.find((x) => x.id === Number(s.email_id))?.name || "No e-mail chosen";
    if (s.type === "tag") return [(s.add || []).length ? `+ ${(s.add || []).join(", ")}` : "", (s.remove || []).length ? `− ${(s.remove || []).join(", ")}` : ""].filter(Boolean).join(" · ") || "No tags";
    if (s.type === "end") return s.reason || "sequence finished";
    return "";
  };
  const STATUS_NAME = { draft: "Draft", active: "Active", paused: "Paused", archived: "Archived" };
  const pill = (status) => `<span class="au-pill s-${status}"><i></i>${STATUS_NAME[status] || status}</span>`;
  const flowStats = (f) => { const steps = Object.values(f.definition?.steps || {}); return { steps: steps.length, mails: steps.filter((s) => s.type === "email").length, branches: steps.filter((s) => s.type === "condition").length }; };

  // ---------- Overview ----------
  function overview() {
    const s = stats || {};
    const active = flows.filter((f) => f.status === "active").length, on = settings?.automations?.sending_enabled;
    const edited = emails.some((x) => new Date(x.updated_at) - new Date(x.created_at) > 60e3);
    const steps = [
      ["Review the e-mails", "Read the sample texts and adapt them to your voice.", edited, "Open e-mails", "emails"],
      ["Send yourself a test", "Check how they look in your inbox, on mobile and desktop.", tests > 0, "Open e-mails", "emails"],
      ["Simulate and activate a flow", "Run it with a real contact (nothing is sent), then activate it.", active > 0, "Open flows", "flows"],
      ["Switch sending on", "From then on, active flows e-mail contacts automatically.", !!on, "Open settings", "settings"],
    ];
    const doneN = steps.filter((x) => x[2]).length;
    const group = (title, icn, items) => `<div class="au-group"><p class="au-group-h">${ic(icn)}${title}</p><div class="au-group-g">${items.map(([l, v, tip, tone]) => `<div class="au-stat${tone ? ` t-${tone}` : ""}"><b>${v}</b><span>${l}${tip ? A.info(tip) : ""}</span></div>`).join("")}</div></div>`;
    view.innerHTML = `
      ${doneN < 4 ? `<section class="panel au-start"><div class="au-start-h"><div><h2>Get your automations running</h2><p>${doneN} of 4 steps done</p></div><div class="au-prog"><i style="width:${doneN * 25}%"></i></div></div>
        <ol class="au-steps">${steps.map(([t, d, done, cta, to], i) => `<li class="${done ? "is-done" : ""}"><span class="au-step-n">${done ? icon("check") : i + 1}</span><div><b>${t}</b><span>${d}</span></div>${done ? "" : `<button class="btn btn-sm" type="button" data-to="${to}">${cta}</button>`}</li>`).join("")}</ol></section>` : ""}
      <section class="panel au-board">
        <header class="au-board-h"><h2>Performance</h2><span class="spacer"></span>
          <span class="au-seg">${[7, 30, 90].map((d) => `<button type="button" data-days="${d}" class="${range.days === d ? "is-on" : ""}">${d} days</button>`).join("")}</span>
          <select class="select input-sm au-flowsel" data-r="flow"><option value="">All flows</option>${flows.map((f) => `<option value="${f.id}"${String(f.id) === range.flow ? " selected" : ""}>${esc(f.name)}</option>`).join("")}</select></header>
        <div class="au-groups">
          ${group("Journeys", "users", [["Active flows", num(s.active_flows || 0)], ["Contacts in a flow now", num(s.in_progress || 0)], ["Entries", num(s.entries || 0), "Contacts who entered a flow in this period."]])}
          ${group("Delivery", "send", [["Sent", num(s.sent || 0)], ["Queued", num(s.queued || 0), "Waiting for their moment, for the frequency cap, or for sending to be switched on."], ["Skipped", num(s.skipped || 0), "Not sent on purpose: converted, no consent, unsubscribed, too late to be relevant… The contact's history says why."], ["Errors", num(s.failed || 0), "Failed after 3 attempts. Retry them from Contacts.", (s.failed || 0) > 0 ? "bad" : ""]])}
          ${group("Results", "target", [["Conversions to paid", num(s.conversions || 0), "Last touch, 7-day window: a contact who started paying within 7 days after a commercial e-mail counts once, for the flow of the last e-mail. It's a correlation, not proof the e-mail caused the purchase.", (s.conversions || 0) > 0 ? "good" : ""], ["Unsubscribes", num(s.unsubscribed || 0)], ["Bounces & complaints", num(s.bounced || 0)]])}
        </div>
        <p class="au-note">${icon("alert")}Delivered, opens and clicks will appear once Resend's webhook is connected (phase 2). No flow decides anything based on them.</p>
      </section>
      <section class="panel au-mini"><header class="au-board-h"><h2>Your flows</h2><span class="spacer"></span><button class="btn btn-sm" type="button" data-to="flows">See all</button></header>
        ${flows.filter((f) => f.status !== "archived").map((f) => { const p = stats?.per_flow?.[f.id] || {}; return `<button type="button" class="au-mini-row" data-open="${f.id}">${pill(f.status)}<b>${esc(f.name)}</b><span class="au-chip">${ic("bolt")}${esc(triggerText(f.definition?.trigger))}</span><span class="spacer"></span><span class="au-mini-n"><b>${num(p.in_progress || 0)}</b> in flow</span><span class="au-mini-n"><b>${num(p.sent || 0)}</b> sent</span></button>`; }).join("") || `<p class="aud-empty">No flows yet.</p>`}
      </section>`;
    view.onclick = async (e) => {
      const t = e.target.closest("[data-to]"); if (t) return go(t.dataset.to);
      const o = e.target.closest("[data-open]"); if (o) return editor(flows.find((f) => f.id === Number(o.dataset.open)));
      const d = e.target.closest("[data-days]"); if (d) { range.days = Number(d.dataset.days); A.store.set("au-days", range.days); try { await load(); } catch {} draw(); }
    };
    view.onchange = async (e) => { if (e.target.dataset?.r === "flow") { range.flow = e.target.value; try { await load(); } catch {} draw(); } };
  }

  // ---------- Flows: one card each, the next sensible action first ----------
  function flowsView() {
    const per = stats?.per_flow || {};
    const live = flows.filter((f) => f.status !== "archived"), old = flows.filter((f) => f.status === "archived");
    const card = (f) => {
      const p = per[f.id] || {}, k = flowStats(f);
      const primary = f.status === "draft" ? `<button class="btn btn-primary btn-sm" type="button" data-act="activate">${ic("play")}Activate…</button>`
        : f.status === "active" ? `<button class="btn btn-sm" type="button" data-act="pause">${ic("pause")}Pause</button>`
        : f.status === "paused" ? `<button class="btn btn-primary btn-sm" type="button" data-act="resume">${ic("play")}Resume</button>` : "";
      return `<article class="au-card s-${f.status}" data-id="${f.id}">
        <div class="au-card-top">${pill(f.status)}<span class="au-prio" title="Priority">P${f.priority}</span><span class="spacer"></span>
          <div class="au-more"><button class="icon-btn" type="button" data-more aria-label="More actions">${ic("more")}</button>
            <div class="au-more-m" hidden><button type="button" data-act="sim">${icon("eye")}Simulate with a contact</button><button type="button" data-act="dup">${icon("copy")}Duplicate</button>
              ${f.status === "active" ? `<button type="button" data-act="backfill">${ic("users")}Include existing contacts…</button>` : ""}
              ${f.status !== "archived" ? `<button type="button" data-act="archive" class="is-danger">${icon("trash")}Archive</button>` : ""}</div></div></div>
        <h3>${esc(f.name)}</h3><p class="au-card-goal">${esc(f.goal || "No goal written yet.")}</p>
        <div class="au-chips"><span class="au-chip">${ic("bolt")}${esc(triggerText(f.definition?.trigger))}</span><span class="au-chip">${icon("mail")}${k.mails} e-mail${k.mails === 1 ? "" : "s"}</span>${k.branches ? `<span class="au-chip">${ic("split")}${k.branches} branch${k.branches === 1 ? "" : "es"}</span>` : ""}${f.definition?.exit?.on_paid ? `<span class="au-chip">${ic("target")}Stops when they pay</span>` : ""}</div>
        <div class="au-card-stats"><div><b>${num(p.in_progress || 0)}</b><span>In flow now</span></div><div><b>${num(p.sent || 0)}</b><span>E-mails sent</span></div><div><b>${num(p.conversions || 0)}</b><span>Conversions</span></div></div>
        <footer><span class="au-card-date">Edited ${A.fmtDate(f.updated_at, false)}</span><span class="spacer"></span><button class="btn btn-sm" type="button" data-act="edit">${icon("edit")}Edit flow</button>${primary}</footer>
      </article>`;
    };
    view.innerHTML = `<div class="au-cards">${live.map(card).join("")}<button type="button" class="au-card au-card-new" data-new>${icon("plus")}<b>New flow</b><span>Start from scratch with a trigger and add steps.</span></button></div>
      ${old.length ? `<details class="au-archived"><summary>Archived (${old.length})</summary><div class="au-cards">${old.map(card).join("")}</div></details>` : ""}`;
    view.onclick = async (e) => {
      if (e.target.closest("[data-new]")) return newFlow();
      const more = e.target.closest("[data-more]");
      $$(".au-more-m", view).forEach((m) => { if (!more || m !== more.nextElementSibling) m.hidden = true; });
      if (more) { more.nextElementSibling.hidden = !more.nextElementSibling.hidden; return; }
      const b = e.target.closest("[data-act]"); if (!b) return;
      const f = flows.find((x) => x.id === Number(b.closest("[data-id]").dataset.id));
      const act = b.dataset.act;
      if (act === "edit") return editor(f);
      if (act === "sim") return simulateDialog(f.definition, f.name);
      if (act === "activate") return activateDialog(f);
      if (act === "backfill") return backfillDialog(f);
      if (act === "dup") return busy(b, async () => {
        const { error } = await A.db.from("automation_flows").insert({ name: `${f.name} (copy)`, goal: f.goal, priority: f.priority, definition: f.definition, replaces: [] });
        if (error) throw error; A.toast("Flow duplicated as a draft."); await load(); draw();
      });
      const conf = { pause: ["Pause this flow?", "No new contacts enter and nothing more is sent. Contacts keep their place; when you resume, e-mails that waited too long are skipped instead of sent all at once.", "Pause", false],
        resume: ["Resume this flow?", "Only events from now on make new entries. E-mails that waited longer than the limit in Settings are skipped; the rest respect the frequency cap.", "Resume", false],
        archive: ["Archive this flow?", "Every contact in it leaves now and its queued e-mails are cancelled. The history stays.", "Archive", true] }[act];
      if (!conf || !(await A.confirmDialog({ title: conf[0], text: conf[1], confirm: conf[2], danger: conf[3] }))) return;
      busy(b, async () => { await rpc("automation_set_status", { p_flow: f.id, p_status: { pause: "paused", resume: "active", archive: "archived" }[act] }); A.toast("Done."); await load(); draw(); });
    };
  }

  // ---------- activation: validation + summary; only new events by default ----------
  async function activateDialog(f, afterSave) {
    const errs = await rpc("automation_validate", { p_def: f.definition }).catch((e) => [e.message]);
    const def = f.definition || {};
    const steps = Object.values(def.steps || {});
    const mails = steps.filter((s) => s.type === "email").map((s) => emails.find((x) => x.id === Number(s.email_id))).filter(Boolean);
    const live = f.status === "active";
    const m = A.modal({ title: live ? "Publish the changes" : "Publish and activate", body: errs.length
      ? `<p class="au-err-h">${icon("alert")}Fix these before publishing:</p><ul class="au-errs">${errs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`
      : `<dl class="au-sum"><dt>Entry</dt><dd>${esc(triggerText(def.trigger))}${def.trigger?.conditions?.rules?.length ? ` · only if ${esc(condText(def.trigger.conditions))}` : ""}</dd>
          <dt>Re-entry</dt><dd>${def.entry?.mode === "again" ? `Again after ${def.entry.cooldown_days || 30} days` : "Once per contact"}</dd>
          <dt>Exit</dt><dd>${def.exit?.on_paid ? "Leaves as soon as the contact pays" : "Stays after paying"}</dd>
          <dt>Steps</dt><dd>${steps.length} · ${mails.length} e-mail${mails.length === 1 ? "" : "s"} (${mails.filter((x) => x.category === "commercial").length} commercial)</dd>
          <dt>Who</dt><dd>${live ? "Contacts already in the flow keep their current version; new entries use the new one." : "Only contacts whose event happens <b>from now on</b>. Existing contacts can be added later, separately, with a preview."}</dd>
          <dt>Sending</dt><dd>${settings?.automations?.sending_enabled ? "On: e-mails go out." : "<b>Off</b>: journeys advance but e-mails wait in the queue (and are skipped if they wait too long)."}</dd>
          ${f.replaces?.length ? `<dt>Replaces</dt><dd>While active, the built-in e-mails ${f.replaces.map((k) => `<code>${esc(k)}</code>`).join(", ")} are switched off (the trial welcome becomes the plain subscription confirmation).</dd>` : ""}</dl>`,
      foot: `<button class="btn btn-ghost" type="button" data-no>Cancel</button>${errs.length ? "" : `<button class="btn btn-primary" type="button" data-yes>${live ? "Publish new version" : "Publish & activate"}</button>`}` });
    $("[data-no]", m.el).onclick = () => m.close();
    const y = $("[data-yes]", m.el);
    if (y) y.onclick = () => busy(y, async () => {
      const r = await rpc("automation_publish", { p_flow: f.id, p_activate: !live });
      if (r?.errors?.length) throw new Error(r.errors.join(" "));
      m.close(); A.toast(`Version ${r.version} published${live ? "" : " and active"}.`); await load(); afterSave?.(); draw();
    });
  }
  function backfillDialog(f) {
    const m = A.modal({ title: "Include existing contacts", size: "sm", body: `<p class="muted">Contacts whose event already happened in the last days enter now, as if it had just happened. Waits relative to a date (e.g. trial end) still use the real date; moments already past follow each wait's policy.</p>
      <label class="au-f"><span>Events in the last (days)</span><input class="input" type="number" min="1" max="90" value="7" data-days></label><p class="au-prev" data-prev></p>`,
      foot: `<button class="btn btn-ghost" type="button" data-no>Cancel</button><button class="btn" type="button" data-p>Preview</button><button class="btn btn-primary" type="button" data-yes disabled>Include them</button>` });
    const days = () => Number($("[data-days]", m.el).value) || 7;
    $("[data-no]", m.el).onclick = () => m.close();
    $("[data-p]", m.el).onclick = (e) => busy(e.currentTarget, async () => { const r = await rpc("automation_backfill", { p_flow: f.id, p_days: days(), p_apply: false }); $("[data-prev]", m.el).textContent = `${num(r.candidates)} contact${r.candidates === 1 ? "" : "s"} had this event. Those who already went through the flow, paid (if it exits on payment) or don't meet the entry conditions are left out.`; $("[data-yes]", m.el).disabled = !r.candidates; });
    $("[data-yes]", m.el).onclick = (e) => busy(e.currentTarget, async () => { const r = await rpc("automation_backfill", { p_flow: f.id, p_days: days(), p_apply: true }); m.close(); A.toast(`${num(r.enrolled)} contact${r.enrolled === 1 ? "" : "s"} entered the flow.`); await load(); draw(); });
  }

  // ---------- dry run with a real contact (no writes, no e-mails) ----------
  function simulateDialog(def, name) {
    const m = A.modal({ title: `Simulate · ${name}`, body: `<p class="muted">The path one contact would take if they entered now, with today's data. Nothing is saved or sent. Conditions later in the flow are evaluated with today's data too; in the real run they're checked when the contact reaches them.</p>
      <div class="au-row"><input class="input" type="email" placeholder="Contact's e-mail" data-em><button class="btn btn-primary" type="button" data-go>Simulate</button></div><ol class="au-sim" data-out></ol>` });
    $("[data-go]", m.el).onclick = (e) => busy(e.currentTarget, async () => {
      const em = $("[data-em]", m.el).value.trim().toLowerCase();
      const { data: p } = await A.db.from("profiles").select("id").ilike("email", em).maybeSingle();
      if (!p) throw new Error("No account with that e-mail.");
      const out = await rpc("automation_simulate", { p_def: def, p_user: p.id });
      $("[data-out]", m.el).innerHTML = out.map((x) => `<li class="k-${x.kind}"><time>${x.at ? dt(x.at) : ""}</time><b>${esc({ entered: "Enters", wait: "Wait until", condition: "Condition", email: "E-mail", skipped: "Skipped", tag: "Tags", exit: "Ends", error: "Error" }[x.kind] || x.kind)}</b>
        <span>${esc(x.kind === "tag" ? stepText({ type: "tag", add: x.add, remove: x.remove }) : x.text || "")}${x.note ? ` <em>· ${esc(x.note)}</em>` : ""}</span></li>`).join("");
    });
  }

  // ---------- Flow editor: blocks top to bottom, Yes/No branches side by side, settings on the right ----------
  function editor(flow) {
    const f = structuredClone(flow);
    f.definition = Object.assign({ trigger: { type: "signup" }, entry: { mode: "once" }, exit: { on_paid: true }, start: null, steps: {} }, f.definition || {});
    const def = f.definition;
    let sel = "trigger", dirty = false;
    const m = A.modal({ title: "Flow editor", sub: esc(f.name), body: `<div class="au-ed"><div class="au-canvas" data-canvas></div><aside class="au-side" data-side></aside></div>`,
      foot: `<span class="au-dirty" data-dirty hidden>Unsaved changes</span><span class="spacer"></span>
        <button class="btn" type="button" data-sim>${icon("eye")}Simulate</button><button class="btn" type="button" data-val>Validate</button>
        <button class="btn" type="button" data-save>Save draft</button><button class="btn btn-primary" type="button" data-pub>${f.status === "active" ? "Publish changes…" : "Activate…"}</button>`,
      onClose: () => { if (dirty) A.toast("Unsaved changes were discarded.", "err"); } });
    m.el.querySelector(".modal").classList.add("au-modal");
    const canvas = $("[data-canvas]", m.el), side = $("[data-side]", m.el);
    const touch = () => { dirty = true; $("[data-dirty]", m.el).hidden = false; };
    // every pointer to a step: [owner, key] where owner is a step or def ("start")
    const pointers = () => { const out = [[def, "start"]]; for (const s of Object.values(def.steps)) for (const k of ["next", "yes", "no"]) out.push([s, k]); return out; };
    const insert = async (owner, key, type) => {
      const id = uid(), old = owner[key] ?? null;
      if (type === "end" && old && !(await A.confirmDialog({ title: "End the flow here?", text: "The steps after this point will be removed.", confirm: "End here", danger: true }))) return;
      const s = { type };
      if (type === "wait") Object.assign(s, { mode: "duration", amount: 1, unit: "days" });
      if (type === "condition") Object.assign(s, { logic: "and", rules: [{ field: "saved_idea", op: "is", value: true }], yes: null, no: null });
      if (type === "tag") Object.assign(s, { add: [], remove: [] });
      if (type === "end") Object.assign(s, { reason: "sequence finished" });
      if (type !== "end") s.next = old; // an End step finishes the journey: what followed is dropped
      def.steps[id] = s; owner[key] = id;
      if (type === "end" && old) dropChain(old);
      sel = id; touch(); render();
    };
    const dropChain = (id) => { let cur = id; const seen = new Set(); while (cur && def.steps[cur] && !seen.has(cur)) { seen.add(cur); const s = def.steps[cur]; if (s.type === "condition") { dropChain(s.yes); dropChain(s.no); } delete def.steps[cur]; cur = s.next; } };
    const remove = (id) => {
      const s = def.steps[id]; if (!s) return;
      if (s.type === "condition") { dropChain(s.yes); dropChain(s.no); }
      for (const [o, k] of pointers()) if (o[k] === id) o[k] = s.next ?? null;
      delete def.steps[id]; sel = "trigger"; touch(); render();
    };
    const move = (id, dir) => {
      // swap with the neighbour in the same chain (simple, predictable)
      const ptr = pointers().find(([o, k]) => o[k] === id); if (!ptr) return;
      const s = def.steps[id];
      if (dir > 0) { const n = s.next && def.steps[s.next]; if (!n) return; ptr[0][ptr[1]] = s.next; s.next = n.next ?? null; n.next = id; }
      else { const prev = Object.entries(def.steps).find(([, x]) => x.next === id); if (!prev) return; const pp = pointers().find(([o, k]) => o[k] === prev[0]); pp[0][pp[1]] = id; prev[1].next = s.next ?? null; s.next = prev[0]; }
      touch(); render();
    };
    const slot = (owner, key) => `<div class="au-slot"><button type="button" class="au-add" data-add="${owner === def ? "start" : Object.keys(def.steps).find((k) => def.steps[k] === owner)}" data-key="${key}" aria-label="Add a step">+</button></div>`;
    const chain = (startId, owner, key) => {
      let html = slot(owner, key), id = startId; const seen = new Set();
      while (id && def.steps[id] && !seen.has(id)) {
        seen.add(id); const s = def.steps[id];
        html += `<div class="au-node t-${s.type}${sel === id ? " is-sel" : ""}" data-sel="${id}"><span class="au-node-k">${STEP_LABEL[s.type]}</span><span class="au-node-t">${esc(stepText(s))}</span></div>`;
        if (s.type === "condition") html += `<div class="au-branches"><div class="au-br"><span class="au-br-l yes">Yes</span>${chain(s.yes, s, "yes")}</div><div class="au-br"><span class="au-br-l no">No</span>${chain(s.no, s, "no")}</div></div><p class="au-join">then continue</p>`;
        if (s.type === "end") return html;
        html += slot(s, "next"); id = s.next;
      }
      return html;
    };
    function render() {
      canvas.innerHTML = `<div class="au-node t-trigger${sel === "trigger" ? " is-sel" : ""}" data-sel="trigger"><span class="au-node-k">Entry trigger</span><span class="au-node-t">${esc(triggerText(def.trigger))}</span>
          <span class="au-node-m">${def.entry?.mode === "again" ? `re-entry after ${def.entry.cooldown_days || 30} d` : "once per contact"}${def.exit?.on_paid ? " · exits when the contact pays" : ""}</span></div>
        ${chain(def.start, def, "start")}<div class="au-node t-endcap">End of the flow</div>`;
      sideRender();
    }
    canvas.onclick = (e) => {
      const add = e.target.closest("[data-add]");
      if (add) {
        const owner = add.dataset.add === "start" ? def : def.steps[add.dataset.add], key = add.dataset.key;
        const menu = document.createElement("div"); menu.className = "au-menu";
        menu.innerHTML = Object.entries(STEP_LABEL).map(([k, l]) => `<button type="button" data-t="${k}">${l}</button>`).join("");
        add.parentElement.append(menu);
        menu.onclick = (ev) => { const t = ev.target.closest("[data-t]"); if (t) insert(owner, key, t.dataset.t); };
        setTimeout(() => document.addEventListener("click", () => menu.remove(), { once: true }), 0);
        return;
      }
      const n = e.target.closest("[data-sel]"); if (n) { sel = n.dataset.sel; render(); }
    };
    // ---- side panel ----
    const rulesHtml = (c, path) => `<div class="au-rules" data-rules="${path}">
      <label class="au-f"><span>Combine</span><select class="select input-sm" data-logic><option value="and"${c.logic !== "or" ? " selected" : ""}>All rules (AND)</option><option value="or"${c.logic === "or" ? " selected" : ""}>Any rule (OR)</option></select></label>
      ${(c.rules || []).map((r, i) => { const t = FIELD[r.field]?.[2] || "bool"; return `<div class="au-rule" data-i="${i}">
        <select class="select input-sm" data-rf>${FIELDS.map(([k, l]) => `<option value="${k}"${k === r.field ? " selected" : ""}>${l}</option>`).join("")}</select>
        ${t === "bool" ? `<select class="select input-sm" data-rv><option value="true"${r.value !== false ? " selected" : ""}>Yes</option><option value="false"${r.value === false ? " selected" : ""}>No</option></select>`
          : t === "num" ? `<select class="select input-sm" data-ro><option value="gte"${r.op !== "lte" ? " selected" : ""}>≥</option><option value="lte"${r.op === "lte" ? " selected" : ""}>≤</option></select><input class="input input-sm" type="number" data-rv value="${esc(r.value ?? 0)}">`
          : `<select class="select input-sm" data-ro><option value="is"${r.op !== "is_not" ? " selected" : ""}>is</option><option value="is_not"${r.op === "is_not" ? " selected" : ""}>is not</option></select>${t === "plan" ? `<select class="select input-sm" data-rv>${plans.map((p) => `<option value="${p.key}"${p.key === r.value ? " selected" : ""}>${esc(p.name)}</option>`).join("")}</select>` : t === "locale" ? `<select class="select input-sm" data-rv>${Object.entries(LOCALES).map(([k, l]) => `<option value="${k}"${k === r.value ? " selected" : ""}>${l}</option>`).join("")}</select>` : `<input class="input input-sm" data-rv value="${esc(r.value || "")}">`}`}
        <button class="icon-btn" type="button" data-rx aria-label="Remove rule">×</button></div>`; }).join("")}
      <button class="btn btn-sm" type="button" data-radd>${icon("plus")}Add rule</button></div>`;
    const readRules = (box, c) => {
      c.logic = $("[data-logic]", box).value;
      c.rules = $$(".au-rule", box).map((row) => {
        const field = $("[data-rf]", row).value, t = FIELD[field][2], v = $("[data-rv]", row)?.value, o = $("[data-ro]", row)?.value;
        const prev = c.rules[Number(row.dataset.i)] || {};
        if (prev.field !== field) return { field, op: FIELD[field][2] === "num" ? "gte" : "is", value: t === "bool" ? true : t === "num" ? 1 : t === "plan" ? plans[0]?.key : t === "locale" ? "en" : "" };
        return { field, op: o || "is", value: t === "bool" ? v === "true" : t === "num" ? Number(v) : v };
      });
    };
    function sideRender() {
      if (sel === "trigger") {
        const t = def.trigger || (def.trigger = { type: "signup" });
        def.trigger.conditions = def.trigger.conditions || { logic: "and", rules: [] };
        side.innerHTML = `<p class="au-side-h">Flow</p>
          <label class="au-f"><span>Name</span><input class="input" data-k="name" value="${esc(f.name)}"></label>
          <label class="au-f"><span>Goal</span><input class="input" data-k="goal" value="${esc(f.goal || "")}"></label>
          <label class="au-f"><span>Priority ${A.info("When two flows want to send a commercial e-mail to the same contact within the frequency cap, the lower number goes first; the other waits or is skipped (Settings).")}</span><input class="input" type="number" data-k="priority" value="${f.priority}"></label>
          <p class="au-side-h">Entry trigger</p>
          <label class="au-f"><span>When</span><select class="select" data-t="type">${Object.entries(TRIGGERS).map(([k, l]) => `<option value="${k}"${k === t.type ? " selected" : ""}>${l}</option>`).join("")}</select></label>
          ${["trial_ends_in", "trial_ended_unpaid"].includes(t.type) ? `<label class="au-f"><span>${t.type === "trial_ends_in" ? "Hours before the end" : "Hours after the end"}</span><input class="input" type="number" min="0" data-t="hours" value="${t.hours || 0}"></label>` : ""}
          ${t.type === "inactive" ? `<label class="au-f"><span>Days without signing in</span><input class="input" type="number" min="1" data-t="days" value="${t.days || 14}"></label>` : ""}
          ${t.type === "first_feature" ? `<label class="au-f"><span>Feature</span><select class="select" data-t="feature">${Object.entries(FEATURES).map(([k, l]) => `<option value="${k}"${k === (t.feature || "search") ? " selected" : ""}>${l}</option>`).join("")}</select></label>` : ""}
          ${t.type === "tag_added" ? `<label class="au-f"><span>Tag</span><input class="input" data-t="tag" value="${esc(t.tag || "")}"></label>` : ""}
          <p class="au-help">${t.type === "cancel_scheduled" ? "The member cancelled but keeps access until the end of the period." : t.type === "access_ended" ? "The subscription has finished: no more access." : "Only events after activation enter (existing contacts: “Include existing…”)."}</p>
          <p class="au-side-h">Only if (entry conditions)</p>${rulesHtml(def.trigger.conditions, "trigger")}
          <p class="au-side-h">Re-entry and exit</p>
          <label class="au-f"><span>Can a contact enter again?</span><select class="select" data-e="mode"><option value="once"${def.entry?.mode !== "again" ? " selected" : ""}>Only once</option><option value="again"${def.entry?.mode === "again" ? " selected" : ""}>Again, after a waiting period</option></select></label>
          ${def.entry?.mode === "again" ? `<label class="au-f"><span>Waiting period (days)</span><input class="input" type="number" min="1" data-e="cooldown_days" value="${def.entry.cooldown_days || 30}"></label>` : ""}
          <label class="au-check"><input type="checkbox" data-x="on_paid"${def.exit?.on_paid ? " checked" : ""}> Leave the flow as soon as the contact pays (stops e-mails that sell the first subscription)</label>
          <p class="au-side-h">Built-in e-mails it replaces</p>
          ${["trial_welcome", "trial_tips"].map((k) => `<label class="au-check"><input type="checkbox" data-rep="${k}"${(f.replaces || []).includes(k) ? " checked" : ""}> <code>${k}</code></label>`).join("")}`;
      } else {
        const s = def.steps[sel]; if (!s) { sel = "trigger"; return sideRender(); }
        let body = "";
        if (s.type === "wait") {
          const mode = s.mode || "duration";
          body = `<label class="au-f"><span>Wait</span><select class="select" data-s="mode"><option value="duration"${mode === "duration" ? " selected" : ""}>A fixed time</option><option value="until_event"${mode === "until_event" ? " selected" : ""}>Until a moment relative to a date</option><option value="window"${mode === "window" ? " selected" : ""}>Until a day / time window</option></select></label>
            ${mode === "duration" ? `<div class="au-row"><input class="input" type="number" min="1" data-s="amount" value="${s.amount || 1}"><select class="select" data-s="unit">${["minutes", "hours", "days"].map((u) => `<option${u === (s.unit || "days") ? " selected" : ""}>${u}</option>`).join("")}</select></div>` : ""}
            ${mode === "until_event" ? `<label class="au-f"><span>Date</span><select class="select" data-s="anchor">${[["trial_end", "Trial end (real date)"], ["signup", "Sign-up"], ["entered", "Entering the flow"]].map(([k, l]) => `<option value="${k}"${k === s.anchor ? " selected" : ""}>${l}</option>`).join("")}</select></label>
              <label class="au-f"><span>Hours (negative = before)</span><input class="input" type="number" data-s="offset_hours" value="${s.offset_hours ?? -24}"></label>
              <label class="au-f"><span>If that moment has already passed</span><select class="select" data-s="if_past"><option value="skip_next_email"${s.if_past !== "continue" ? " selected" : ""}>Skip the next e-mail</option><option value="continue"${s.if_past === "continue" ? " selected" : ""}>Continue now</option></select></label>` : ""}
            ${mode === "window" ? `<div class="au-days">${DAYS.map((d, i) => `<label><input type="checkbox" data-day="${i + 1}"${(s.days || [1, 2, 3, 4, 5]).includes(i + 1) ? " checked" : ""}>${d}</label>`).join("")}</div>
              <div class="au-row"><label class="au-f"><span>From (h)</span><input class="input" type="number" min="0" max="23" data-s="from_hour" value="${s.from_hour ?? 9}"></label><label class="au-f"><span>To (h)</span><input class="input" type="number" min="1" max="24" data-s="to_hour" value="${s.to_hour ?? 18}"></label></div>
              <p class="au-help">Time zone: the one in Memberships → Settings.</p>` : ""}`;
        } else if (s.type === "condition") {
          body = `<p class="au-help">Checked with up-to-date data when the contact reaches this step. Yes and No continue after the condition.</p>${rulesHtml(s, sel)}`;
        } else if (s.type === "email") {
          body = `<label class="au-f"><span>E-mail</span><select class="select" data-s="email_id"><option value="">Choose…</option>${emails.map((x) => `<option value="${x.id}"${x.id === Number(s.email_id) ? " selected" : ""}>${esc(x.name)} · ${x.category}</option>`).join("")}</select></label>
            <div class="au-row"><button class="btn btn-sm" type="button" data-edit-mail${s.email_id ? "" : " disabled"}>${icon("edit")}Edit e-mail</button><button class="btn btn-sm" type="button" data-new-mail>${icon("plus")}New e-mail</button></div>
            <p class="au-help">Just before sending, SCP checks again: still in the flow, not paid (if the flow exits on payment), not unsubscribed or bounced, consent for commercial e-mails, and the frequency cap.</p>`;
        } else if (s.type === "tag") {
          body = `<label class="au-f"><span>Add tags (comma-separated)</span><input class="input" data-s="add" value="${esc((s.add || []).join(", "))}"></label>
            <label class="au-f"><span>Remove tags</span><input class="input" data-s="remove" value="${esc((s.remove || []).join(", "))}"></label>
            <p class="au-help">Internal tags only: they never change the contact's subscription or consent.</p>`;
        } else if (s.type === "end") {
          body = `<label class="au-f"><span>Reason</span><select class="select" data-s="reason">${END_REASONS.map((r) => `<option${r === s.reason ? " selected" : ""}>${r}</option>`).join("")}</select></label>`;
        }
        side.innerHTML = `<p class="au-side-h">${STEP_LABEL[s.type]}</p>${body}
          <div class="au-row au-side-foot"><button class="btn btn-sm" type="button" data-mv="-1">↑</button><button class="btn btn-sm" type="button" data-mv="1">↓</button><span class="spacer"></span><button class="btn btn-sm btn-danger" type="button" data-rm>${icon("trash")}Remove</button></div>`;
      }
    }
    side.addEventListener("change", (e) => {
      const el = e.target;
      if (sel === "trigger") {
        if (el.dataset.k) f[el.dataset.k] = el.dataset.k === "priority" ? Number(el.value) : el.value;
        if (el.dataset.t) def.trigger[el.dataset.t] = ["hours", "days"].includes(el.dataset.t) ? Number(el.value) : el.value;
        if (el.dataset.e) { def.entry = def.entry || {}; def.entry[el.dataset.e] = el.dataset.e === "cooldown_days" ? Number(el.value) : el.value; }
        if (el.dataset.x) { def.exit = def.exit || {}; def.exit.on_paid = el.checked; }
        if (el.dataset.rep) f.replaces = $$("[data-rep]", side).filter((x) => x.checked).map((x) => x.dataset.rep);
        if (el.closest("[data-rules]")) readRules(el.closest("[data-rules]"), def.trigger.conditions);
      } else {
        const s = def.steps[sel];
        if (el.closest("[data-rules]")) readRules(el.closest("[data-rules]"), s);
        else if (el.dataset.day) s.days = $$("[data-day]", side).filter((x) => x.checked).map((x) => Number(x.dataset.day));
        else if (el.dataset.s) {
          const k = el.dataset.s;
          s[k] = ["amount", "offset_hours", "from_hour", "to_hour"].includes(k) ? Number(el.value) : k === "email_id" ? (el.value ? Number(el.value) : null)
            : ["add", "remove"].includes(k) ? el.value.split(",").map((x) => x.trim()).filter(Boolean) : el.value;
        }
      }
      touch(); render();
    });
    side.addEventListener("click", (e) => {
      const rules = e.target.closest("[data-rules]");
      const c = rules ? (sel === "trigger" ? def.trigger.conditions : def.steps[sel]) : null;
      if (e.target.closest("[data-radd]")) { c.rules = [...(c.rules || []), { field: "has_paid", op: "is", value: false }]; touch(); return render(); }
      const x = e.target.closest("[data-rx]"); if (x) { c.rules.splice(Number(x.closest(".au-rule").dataset.i), 1); touch(); return render(); }
      const mv = e.target.closest("[data-mv]"); if (mv) return move(sel, Number(mv.dataset.mv));
      if (e.target.closest("[data-rm]")) return remove(sel);
      if (e.target.closest("[data-edit-mail]")) return emailEditor(emails.find((x) => x.id === Number(def.steps[sel].email_id)), () => render());
      if (e.target.closest("[data-new-mail]")) return emailEditor(null, (created) => { def.steps[sel].email_id = created.id; touch(); render(); });
    });
    const save = async () => {
      const { error } = await A.db.from("automation_flows").update({ name: f.name, goal: f.goal, priority: f.priority, definition: def, replaces: f.replaces || [], updated_at: new Date().toISOString() }).eq("id", f.id);
      if (error) throw new Error(error.message);
      dirty = false; $("[data-dirty]", m.el).hidden = true;
      Object.assign(flows.find((x) => x.id === f.id), { name: f.name, goal: f.goal, priority: f.priority, definition: structuredClone(def), replaces: f.replaces || [] });
    };
    $("[data-save]", m.el).onclick = (e) => busy(e.currentTarget, async () => { await save(); A.toast(f.status === "active" ? "Draft saved. The active version doesn't change until you publish." : "Draft saved."); });
    $("[data-val]", m.el).onclick = (e) => busy(e.currentTarget, async () => { const errs = await rpc("automation_validate", { p_def: def }); errs.length ? A.toast(errs.join(" · "), "err") : A.toast("Everything checks out."); });
    $("[data-sim]", m.el).onclick = () => simulateDialog(def, f.name);
    $("[data-pub]", m.el).onclick = (e) => busy(e.currentTarget, async () => { await save(); await activateDialog(flows.find((x) => x.id === f.id), () => m.close()); });
    render();
  }

  // ---------- E-mails ----------
  function emailsView() {
    const per = stats?.per_email || {};
    const card = (x) => { const p = per[x.id] || {}, c = x.content?.[window.SCPA_LANG]?.subject ? x.content[window.SCPA_LANG] : x.content?.[x.fallback_locale] || {}; return `<article class="au-mcard" data-id="${x.id}">
        <div class="au-card-top"><span class="au-type t-${x.category}">${x.category === "commercial" ? "Commercial" : "Service"}</span><span class="au-langs">${Object.keys(x.content || {}).map((l) => `<i class="${l === x.fallback_locale ? "is-fb" : ""}">${l.toUpperCase()}</i>`).join("")}</span></div>
        <p class="au-mcard-name">${esc(x.name)}</p><h3>${esc(c.subject || "No subject")}</h3><p class="au-card-goal">${esc(c.preheader || "")}</p>
        <footer><span class="au-card-date">${num(p.sent || 0)} sent${p.failed ? ` · <span class="bad">${num(p.failed)} errors</span>` : ""}</span><span class="spacer"></span>
          <button class="icon-btn" type="button" data-act="dup" title="Duplicate">${icon("copy")}</button><button class="btn btn-sm" type="button" data-act="edit">${icon("edit")}Edit</button></footer></article>`; };
    const order = (f) => [...new Set(Object.values(f.definition?.steps || {}).filter((s) => s.type === "email").map((s) => Number(s.email_id)))].map((id) => emails.find((x) => x.id === id)).filter(Boolean);
    const inFlows = new Set(flows.flatMap((f) => order(f).map((x) => x.id)));
    const loose = emails.filter((x) => !inFlows.has(x.id));
    view.innerHTML = `<div class="au-mhead"><p>${icon("mail")}<span><b>Commercial</b> e-mails only reach contacts who accepted marketing e-mails and count towards the frequency cap. <b>Service</b> e-mails (onboarding, product help) don't, but respect unsubscribes. Billing and trial-ending e-mails live in Memberships.</span></p><button class="btn btn-primary btn-sm" type="button" data-new>${icon("plus")}New e-mail</button></div>
      ${flows.filter((f) => f.status !== "archived" && order(f).length).map((f) => `<section class="au-mgroup"><h2>${pill(f.status)}${esc(f.name)}<em>${order(f).length} e-mail${order(f).length === 1 ? "" : "s"}</em></h2><div class="au-mcards">${order(f).map(card).join("")}</div></section>`).join("")}
      ${loose.length ? `<section class="au-mgroup"><h2>Not used in any flow<em>${loose.length}</em></h2><div class="au-mcards">${loose.map(card).join("")}</div></section>` : ""}`;
    $("[data-new]", view).onclick = () => emailEditor(null, () => draw());
    view.onclick = async (e) => {
      const b = e.target.closest("[data-act]"); if (!b) return;
      const x = emails.find((y) => y.id === Number(b.closest("[data-id]").dataset.id));
      if (b.dataset.act === "edit") return emailEditor(x, () => draw());
      busy(b, async () => { const { data, error } = await A.db.from("automation_emails").insert({ name: `${x.name} (copy)`, category: x.category, content: x.content, fallback_locale: x.fallback_locale }).select().single(); if (error) throw error; emails.push(data); draw(); });
    };
  }

  function emailEditor(orig, done) {
    const em = orig ? structuredClone(orig) : { name: "New e-mail", category: "commercial", fallback_locale: "en", content: { en: { subject: "", preheader: "", blocks: [{ type: "text", text: "Hi {{first_name|there}},\n\n" }, { type: "button", label: "Open SCP", url: "{{platform_url}}" }] } } };
    let loc = em.content[window.SCPA_LANG] ? window.SCPA_LANG : em.fallback_locale, mobile = false, lastField = null, timer = 0;
    const live = flows.some((f) => f.status === "active" && Object.values(f.definition?.steps || {}).some((s) => s.type === "email" && Number(s.email_id) === em.id));
    const sender = settings?.emails || {};
    const m = A.modal({ title: orig ? "Edit e-mail" : "New e-mail", body: `<div class="au-mail"><div class="au-mail-form" data-form></div>
        <div class="au-mail-prev"><div class="au-row"><span class="nl-seg"><button class="btn btn-sm is-on" type="button" data-w="d">Desktop</button><button class="btn btn-sm" type="button" data-w="m">Mobile</button></span>
          <input class="input input-sm" type="email" placeholder="Preview as (contact e-mail, optional)" data-as></div>
          <p class="au-prev-subj" data-subj></p><iframe class="au-frame" title="Preview" sandbox=""></iframe>
          <div class="au-row"><input class="input input-sm" type="email" value="${esc(me.session.user.email)}" data-to><button class="btn btn-sm" type="button" data-test>Send a test</button></div></div></div>`,
      foot: `${live ? `<span class="au-warn">${icon("alert")}This e-mail is used by an active flow: changes apply to the next sends.</span>` : ""}<span class="spacer"></span><button class="btn btn-ghost" type="button" data-no>Cancel</button><button class="btn btn-primary" type="button" data-save>Save e-mail</button>` });
    m.el.querySelector(".modal").classList.add("au-modal");
    const form = $("[data-form]", m.el), frame = $(".au-frame", m.el);
    const v = () => (em.content[loc] = em.content[loc] || { subject: "", preheader: "", blocks: [] });
    const blockHtml = (b, i) => {
      const head = `<div class="au-blk-h"><b>${{ text: "Text", heading: "Heading", image: "Image", button: "Button", divider: "Divider", footer: "Footer" }[b.type]}</b><span class="spacer"></span><button class="icon-btn" type="button" data-bmv="-1">↑</button><button class="icon-btn" type="button" data-bmv="1">↓</button><button class="icon-btn" type="button" data-brm>×</button></div>`;
      const body = b.type === "text" || b.type === "footer" ? `<textarea class="input" rows="${b.type === "text" ? 6 : 2}" data-b="text">${esc(b.text || "")}</textarea>`
        : b.type === "heading" ? `<input class="input" data-b="text" value="${esc(b.text || "")}">`
        : b.type === "image" ? `<input class="input" data-b="src" placeholder="Image URL (https://…)" value="${esc(b.src || "")}"><input class="input" data-b="alt" placeholder="Alt text" value="${esc(b.alt || "")}"><input class="input" data-b="href" placeholder="Link (optional)" value="${esc(b.href || "")}">`
        : b.type === "button" ? `<div class="au-row"><input class="input" data-b="label" placeholder="Button text" value="${esc(b.label || "")}"><input class="input" data-b="url" placeholder="https://… or {{pricing_url}}" value="${esc(b.url || "")}"></div>` : "";
      return `<div class="au-blk" data-bi="${i}">${head}${body}</div>`;
    };
    function renderForm() {
      const c = v();
      form.innerHTML = `<div class="au-row"><label class="au-f"><span>Internal name</span><input class="input" data-m="name" value="${esc(em.name)}"></label>
          <label class="au-f"><span>Type</span><select class="select" data-m="category"><option value="commercial"${em.category === "commercial" ? " selected" : ""}>Commercial (needs consent, counts for the cap)</option><option value="service"${em.category === "service" ? " selected" : ""}>Service (onboarding / product help)</option></select></label></div>
        <p class="au-help">From <b>${esc(sender.from_name || "Sports Content Playbook")} &lt;${esc(sender.from_email || "—")}&gt;</b> · replies to <b>${esc(sender.reply_to || sender.from_email || "—")}</b> (Memberships → Settings → E-mails). Unsubscribe link added to every e-mail.</p>
        <div class="au-locs">${Object.keys(LOCALES).map((l) => `<button type="button" class="${l === loc ? "is-on" : ""}${em.content[l] ? "" : " is-empty"}" data-loc="${l}">${LOCALES[l]}${l === em.fallback_locale ? " · fallback" : ""}</button>`).join("")}
          <label class="au-fb">Fallback <select class="select input-sm" data-m="fallback_locale">${Object.keys(em.content).map((l) => `<option value="${l}"${l === em.fallback_locale ? " selected" : ""}>${LOCALES[l] || l}</option>`).join("")}</select></label></div>
        ${em.content[loc] ? `<label class="au-f"><span>Subject</span><input class="input" data-c="subject" value="${esc(c.subject || "")}"></label>
        <label class="au-f"><span>Preheader</span><input class="input" data-c="preheader" value="${esc(c.preheader || "")}"></label>
        <div class="au-vars"><span>Insert:</span>${VARS.map((x) => `<button type="button" data-var="${x}">{{${x}}}</button>`).join("")}<em>Fallback: {{first_name|there}}</em></div>
        <label class="au-check"><input type="checkbox" data-html-mode${c.html ? " checked" : ""}> HTML mode (replaces the blocks)</label>
        ${c.html ? `<textarea class="input au-code" rows="14" data-c="html">${esc(c.html)}</textarea>`
          : `<div class="au-blks">${(c.blocks || []).map(blockHtml).join("")}</div>
             <div class="au-row au-addb">${["text", "heading", "image", "button", "divider", "footer"].map((t) => `<button class="btn btn-sm" type="button" data-addb="${t}">+ ${t}</button>`).join("")}</div>`}
        <label class="au-f"><span>Plain-text version ${A.info("Leave empty to generate it from the blocks.")}</span><textarea class="input" rows="4" data-c="text" placeholder="Generated automatically">${esc(c.text || "")}</textarea></label>
        ${loc !== em.fallback_locale ? `<button class="btn btn-sm btn-danger" type="button" data-dropl>Remove this language</button>` : ""}`
        : `<p class="muted">No ${LOCALES[loc]} version: contacts in this language get the fallback (${LOCALES[em.fallback_locale]}).</p><button class="btn btn-sm" type="button" data-addl>${icon("plus")}Add a ${LOCALES[loc]} version (copy of the fallback)</button>`}`;
      preview();
    }
    function preview() {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          let uidAs = null; const as = $("[data-as]", m.el).value.trim().toLowerCase();
          if (as) { const { data: p } = await A.db.from("profiles").select("id").ilike("email", as).maybeSingle(); uidAs = p?.id || null; }
          const r = await send({ action: "preview", email: em, locale: loc, user_id: uidAs });
          $("[data-subj]", m.el).innerHTML = `<b>${esc(r.subject || "(no subject)")}</b>${r.locale !== loc ? ` <em>(shown in ${LOCALES[r.locale] || r.locale}: fallback)</em>` : ""}`;
          frame.srcdoc = r.html;
        } catch (e) { frame.srcdoc = `<body style="font:14px sans-serif;padding:24px;color:#b4c0d3;background:#0b1122">${esc(e.message)}</body>`; }
      }, 350);
    }
    form.addEventListener("focusin", (e) => { if (e.target.matches("input,textarea")) lastField = e.target; });
    form.addEventListener("input", (e) => {
      const el = e.target, c = v();
      if (el.dataset.c) c[el.dataset.c] = el.value;
      if (el.dataset.m) em[el.dataset.m] = el.value;
      if (el.dataset.b) c.blocks[Number(el.closest("[data-bi]").dataset.bi)][el.dataset.b] = el.value;
      preview();
    });
    form.addEventListener("change", (e) => {
      if (e.target.dataset.m === "category" || e.target.dataset.m === "fallback_locale") { em[e.target.dataset.m] = e.target.value; renderForm(); }
      if (e.target.matches("[data-html-mode]")) { const c = v(); if (e.target.checked) c.html = `<!doctype html><html><body>\n<p>Hi {{first_name|there}},</p>\n<p><a href="{{platform_url}}">Open SCP</a></p>\n</body></html>`; else delete c.html; renderForm(); }
    });
    form.addEventListener("click", (e) => {
      const c = em.content[loc];
      const vb = e.target.closest("[data-var]");
      if (vb && lastField) { const t = `{{${vb.dataset.var}}}`, s = lastField.selectionStart ?? lastField.value.length; lastField.value = lastField.value.slice(0, s) + t + lastField.value.slice(lastField.selectionEnd ?? s); lastField.dispatchEvent(new Event("input", { bubbles: true })); lastField.focus(); return; }
      const lb = e.target.closest("[data-loc]"); if (lb) { loc = lb.dataset.loc; return renderForm(); }
      if (e.target.closest("[data-addl]")) { em.content[loc] = structuredClone(em.content[em.fallback_locale]); return renderForm(); }
      if (e.target.closest("[data-dropl]")) { delete em.content[loc]; loc = em.fallback_locale; return renderForm(); }
      const ab = e.target.closest("[data-addb]"); if (ab) { c.blocks = c.blocks || []; c.blocks.push({ type: ab.dataset.addb, ...(ab.dataset.addb === "button" ? { label: "Open SCP", url: "{{platform_url}}" } : {}) }); return renderForm(); }
      const bi = e.target.closest("[data-bi]"); if (!bi) return; const i = Number(bi.dataset.bi);
      const mv = e.target.closest("[data-bmv]"); if (mv) { const j = i + Number(mv.dataset.bmv); if (j < 0 || j >= c.blocks.length) return; [c.blocks[i], c.blocks[j]] = [c.blocks[j], c.blocks[i]]; return renderForm(); }
      if (e.target.closest("[data-brm]")) { c.blocks.splice(i, 1); renderForm(); }
    });
    $("[data-as]", m.el).addEventListener("change", preview);
    m.el.addEventListener("click", (e) => { const w = e.target.closest("[data-w]"); if (!w) return; mobile = w.dataset.w === "m"; frame.classList.toggle("is-m", mobile); $$("[data-w]", m.el).forEach((x) => x.classList.toggle("is-on", x === w)); });
    $("[data-test]", m.el).onclick = (e) => busy(e.currentTarget, async () => { const r = await send({ action: "test", email: em, locale: loc, to: $("[data-to]", m.el).value.trim() }); A.toast(`Test sent to ${r.to}.`); });
    $("[data-no]", m.el).onclick = () => m.close();
    $("[data-save]", m.el).onclick = (e) => busy(e.currentTarget, async () => {
      if (!em.content[em.fallback_locale]?.subject) throw new Error("Write a subject in the fallback language.");
      const row = { name: em.name, category: em.category, fallback_locale: em.fallback_locale, content: em.content, updated_at: new Date().toISOString() };
      const q = orig ? A.db.from("automation_emails").update(row).eq("id", orig.id).select().single() : A.db.from("automation_emails").insert(row).select().single();
      const { data, error } = await q; if (error) throw new Error(error.message);
      const i = emails.findIndex((x) => x.id === data.id); if (i >= 0) emails[i] = data; else emails.push(data);
      m.close(); A.toast("E-mail saved."); done?.(data);
    });
    renderForm();
  }

  // ---------- Segments ----------
  function segmentsView() {
    const c = A.store.get("au-seg", { logic: "and", rules: [{ field: "in_trial", op: "is", value: true }] });
    view.innerHTML = `<section class="panel panel-pad"><header class="au-h"><h2>Segments</h2>${A.info("Count who matches a set of rules, with SCP's live data, and see why each contact does or doesn't. The same rules are used in conditions and entry filters.")}</header>
      <div class="au-seg" data-segbox></div><div data-segout></div></section>`;
    const box = $("[data-segbox]", view);
    const paint = () => {
      box.innerHTML = `<div class="au-rules" data-rules="seg"><label class="au-f"><span>Combine</span><select class="select input-sm" data-logic><option value="and"${c.logic !== "or" ? " selected" : ""}>All rules (AND)</option><option value="or"${c.logic === "or" ? " selected" : ""}>Any rule (OR)</option></select></label>
        ${c.rules.map((r, i) => { const t = FIELD[r.field]?.[2]; return `<div class="au-rule" data-i="${i}"><select class="select input-sm" data-rf>${FIELDS.map(([k, l]) => `<option value="${k}"${k === r.field ? " selected" : ""}>${l}</option>`).join("")}</select>
          ${t === "bool" ? `<select class="select input-sm" data-rv><option value="true"${r.value !== false ? " selected" : ""}>Yes</option><option value="false"${r.value === false ? " selected" : ""}>No</option></select>`
            : t === "num" ? `<select class="select input-sm" data-ro><option value="gte"${r.op !== "lte" ? " selected" : ""}>≥</option><option value="lte"${r.op === "lte" ? " selected" : ""}>≤</option></select><input class="input input-sm" type="number" data-rv value="${esc(r.value ?? 0)}">`
            : `<select class="select input-sm" data-ro><option value="is"${r.op !== "is_not" ? " selected" : ""}>is</option><option value="is_not"${r.op === "is_not" ? " selected" : ""}>is not</option></select>${t === "plan" ? `<select class="select input-sm" data-rv>${plans.map((p) => `<option value="${p.key}"${p.key === r.value ? " selected" : ""}>${esc(p.name)}</option>`).join("")}</select>` : t === "locale" ? `<select class="select input-sm" data-rv>${Object.entries(LOCALES).map(([k, l]) => `<option value="${k}"${k === r.value ? " selected" : ""}>${l}</option>`).join("")}</select>` : `<input class="input input-sm" data-rv value="${esc(r.value || "")}">`}`}
          <button class="icon-btn" type="button" data-rx>×</button></div>`; }).join("")}
        <div class="au-row"><button class="btn btn-sm" type="button" data-radd>${icon("plus")}Add rule</button><span class="spacer"></span><button class="btn btn-primary btn-sm" type="button" data-count>Count contacts</button></div></div>`;
    };
    const read = () => {
      c.logic = $("[data-logic]", box).value;
      c.rules = $$(".au-rule", box).map((row) => { const field = $("[data-rf]", row).value, t = FIELD[field][2], prev = c.rules[Number(row.dataset.i)] || {}, val = $("[data-rv]", row)?.value, op = $("[data-ro]", row)?.value;
        if (prev.field !== field) return { field, op: t === "num" ? "gte" : "is", value: t === "bool" ? true : t === "num" ? 1 : t === "plan" ? plans[0]?.key : t === "locale" ? "en" : "" };
        return { field, op: op || "is", value: t === "bool" ? val === "true" : t === "num" ? Number(val) : val }; });
      A.store.set("au-seg", c);
    };
    box.addEventListener("change", () => { read(); paint(); });
    box.addEventListener("click", async (e) => {
      if (e.target.closest("[data-radd]")) { c.rules.push({ field: "has_paid", op: "is", value: false }); A.store.set("au-seg", c); return paint(); }
      const x = e.target.closest("[data-rx]"); if (x) { c.rules.splice(Number(x.closest(".au-rule").dataset.i), 1); A.store.set("au-seg", c); return paint(); }
      const b = e.target.closest("[data-count]"); if (!b) return;
      busy(b, async () => {
        const r = await rpc("automation_segment", { p_cond: c, p_limit: 30 });
        $("[data-segout]", view).innerHTML = `<p class="au-count"><b>${num(r.matching)}</b> of ${num(r.total)} contacts match.</p>
          <div class="table-wrap"><table class="au-table"><thead><tr><th>Contact</th><th>Matches</th><th>Why</th><th>Consent</th><th>Plan · status</th></tr></thead><tbody>
          ${r.sample.map((s) => `<tr><td>${esc(s.email)}${s.name ? `<small>${esc(s.name)}</small>` : ""}</td><td>${s.match ? "✓" : "✗"}</td>
            <td class="au-why">${s.why.map((w) => `<span class="${w.ok ? "ok" : "no"}">${w.ok ? "✓" : "✗"} ${esc(ruleText(w.rule))}</span>`).join("")}</td>
            <td>${s.consent ? "Yes" : "No"}</td><td>${esc([s.plan, s.status].filter(Boolean).join(" · ") || "—")}</td></tr>`).join("")}</tbody></table></div>
          <p class="au-help">The sample shows the newest ${r.sample.length} accounts (matching or not), to check the rules.</p>`;
      });
    });
    paint();
  }

  // ---------- Contacts: history per contact ----------
  function contactsView() {
    view.innerHTML = `<section class="panel panel-pad"><header class="au-h"><h2>Contact history</h2></header>
      <div class="au-row"><input class="input" type="email" placeholder="Contact's e-mail" data-q value="${esc(A.store.get("au-q", ""))}"><button class="btn btn-primary" type="button" data-go>Show</button></div><div data-out></div></section>`;
    const go = (b) => busy(b, async () => {
      const q = $("[data-q]", view).value.trim(); A.store.set("au-q", q);
      const r = await rpc("automation_contact", { p_email: q });
      const out = $("[data-out]", view);
      if (!r) { out.innerHTML = `<p class="aud-empty">No account with that e-mail.</p>`; return; }
      const f = r.facts;
      out.innerHTML = `<div class="au-facts"><span>Plan <b>${esc(f.plan_name || "—")}</b></span><span>Status <b>${esc(f.sub_status || "—")}</b></span><span>Trial end <b>${dt(f.trial_end)}</b></span>
          <span>Commercial consent <b>${f.consent ? "Yes" : "No"}</b></span><span>Suppressed <b>${f.suppressed ? "Yes" : "No"}</b></span><span>Language <b>${esc(f.locale)}</b></span><span>Last sign-in <b>${dt(f.last_sign_in_at)}</b></span><span>Tags <b>${esc((f.tags || []).join(", ") || "—")}</b></span></div>
        <h3 class="au-h3">Flows</h3>${r.journeys.length ? `<table class="au-table"><thead><tr><th>Flow</th><th>Version</th><th>Status</th><th>Entered</th><th>Next step</th><th>Exit</th></tr></thead><tbody>${r.journeys.map((j) => `<tr><td>${esc(j.flow)}</td><td>v${j.version}</td><td>${esc(j.status)}</td><td>${dt(j.entered_at)}</td><td>${j.status === "active" ? dt(j.next_run_at) : "—"}</td><td>${esc(j.exit_reason || "")}</td></tr>`).join("")}</tbody></table>` : `<p class="aud-empty">Not in any flow.</p>`}
        <h3 class="au-h3">E-mails</h3>${r.sends.length ? `<table class="au-table"><thead><tr><th>Flow</th><th>Subject</th><th>Status</th><th>Scheduled</th><th>Sent</th><th></th></tr></thead><tbody>${r.sends.map((s) => `<tr><td>${esc(s.flow || "")}</td><td>${esc(s.subject || "—")}</td><td>${esc(s.status)}${s.error ? `<small>${esc(s.error)}</small>` : ""}</td><td>${dt(s.scheduled_at)}</td><td>${dt(s.sent_at)}</td><td>${s.status === "failed" ? `<button class="btn btn-sm" type="button" data-retry="${s.id}">Retry</button>` : ""}</td></tr>`).join("")}</tbody></table>` : `<p class="aud-empty">No e-mails.</p>`}
        <h3 class="au-h3">Timeline</h3><ol class="au-sim">${r.log.map((l) => `<li class="k-${esc(l.kind)}"><time>${dt(l.at)}</time><b>${esc(l.kind)}</b><span>${esc(l.flow || "")}${l.step ? ` · ${esc(l.step)}` : ""}${l.detail?.reason ? ` · ${esc(l.detail.reason)}` : ""}${l.detail?.until ? ` · until ${dt(l.detail.until)}` : ""}${l.detail?.email ? ` · ${esc(l.detail.email)}` : ""}${l.detail?.error ? ` · ${esc(l.detail.error)}` : ""}${l.detail?.result != null ? ` · ${l.detail.result ? "Yes" : "No"}` : ""}</span></li>`).join("") || "<li>No activity.</li>"}</ol>`;
    });
    $("[data-go]", view).onclick = (e) => go(e.currentTarget);
    view.onclick = (e) => { const r = e.target.closest("[data-retry]"); if (r) busy(r, async () => { await rpc("automation_retry_send", { p_id: Number(r.dataset.retry) }); A.toast("Back in the queue: it goes through every check again."); go($("[data-go]", view)); }); };
    if ($("[data-q]", view).value) go($("[data-go]", view));
  }

  // ---------- Settings ----------
  function settingsView() {
    const a = settings?.automations || {}, e = settings?.emails || {};
    view.innerHTML = `<section class="panel panel-pad au-settings">
      <label class="au-switch"><input type="checkbox" data-k="sending_enabled"${a.sending_enabled ? " checked" : ""}><span><b>Send e-mails to contacts</b><small>Master switch. Off: flows advance and queue e-mails, but nothing is sent (tests still are).</small></span></label>
      <div class="au-row"><label class="au-f"><span>Max. one commercial e-mail every (hours) ${A.info("Shared with the newsletter: a contact who got the newsletter counts as having received a commercial e-mail that day.")}</span><input class="input" type="number" min="1" data-k="commercial_gap_hours" value="${a.commercial_gap_hours ?? 24}"></label>
        <label class="au-f"><span>When an e-mail hits the cap</span><select class="select" data-k="on_cap"><option value="defer"${a.on_cap !== "skip" ? " selected" : ""}>Postpone it (checked again before sending)</option><option value="skip"${a.on_cap === "skip" ? " selected" : ""}>Skip it</option></select></label>
        <label class="au-f"><span>Skip e-mails delayed more than (hours) ${A.info("After a pause, a long frequency-cap wait or sending switched off, an e-mail older than this is skipped instead of sent late.")}</span><input class="input" type="number" min="1" data-k="max_delay_hours" value="${a.max_delay_hours ?? 72}"></label></div>
      <button class="btn btn-primary" type="button" data-save>Save settings</button>
      <h3 class="au-h3">Sender</h3><p class="au-help">${esc(e.from_name || "—")} &lt;${esc(e.from_email || "—")}&gt; · reply-to ${esc(e.reply_to || "—")} — change it in Memberships → Settings → E-mails. The domain must be verified in Resend.</p>
      <h3 class="au-h3">Integrations</h3><ul class="au-int">
        <li class="ok">${icon("check")}Engine: runs every 5 minutes on the server (pg_cron), whether the admin is open or not.</li>
        <li class="ok">${icon("check")}Payment status: from Stripe's webhook (verified, idempotent) into subscriptions — contacts leave sales flows the moment they pay.</li>
        <li class="ok">${icon("check")}Unsubscribe: link and one-click header in every e-mail; unsubscribed addresses are never e-mailed by automations again.</li>
        <li class="todo">${icon("alert")}Resend webhook (delivered, clicks, bounces, spam complaints): pending (phase 2). Bounces and complaints can't be suppressed automatically until then.</li></ul>
    </section>`;
    $("[data-save]", view).onclick = (ev) => busy(ev.currentTarget, async () => {
      const val = (k) => $(`[data-k="${k}"]`, view);
      const next = { sending_enabled: val("sending_enabled").checked, commercial_gap_hours: Number(val("commercial_gap_hours").value), on_cap: val("on_cap").value, max_delay_hours: Number(val("max_delay_hours").value) };
      if (next.sending_enabled && !a.sending_enabled && !(await A.confirmDialog({ title: "Switch sending on?", text: "Active flows will start sending real e-mails to contacts within 5 minutes.", confirm: "Switch on", danger: true }))) return;
      settings = await rpc("automation_settings", { p_save: next }); A.toast("Settings saved."); await load(); draw();
    });
  }

  try { await load(); } catch { return; }
  draw();
})();
