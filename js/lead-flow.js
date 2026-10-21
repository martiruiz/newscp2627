// Lead flow: the interactive, one-question-per-screen form that replaces "Contact us" and "Book a demo".
//   Contact ("message"): quick, 3 taps — organisation · team size · phone (supabase/leads-quick-contact.sql), floating bubbles.
//   Demo: 1 Organisation · 2 Team size · 3 Challenge · 4 Personalised next step (free trial or demo, rules from Admin)
//   → demo: name, work email, organisation → real availability (Cal.com) → booked (only once Cal.com confirms)
//   → question: name, email, message → sent
// Data: supabase/leads.sql (upsert_lead, lead_booking_reported, track_lead_event, lead_rules_public).
// Opens as a modal from every "Book a demo" / "Contact" button (they keep their links as a fallback), and inline on
// book-a-call.html and contact.html. A/B: config.leadFlow.variant "new" | "classic" | "ab", or ?lf=classic|new.
// Analytics: window.SCP_TRACK(event, props) → dataLayer / gtag if present + our own funnel table. No personal data.
(() => {
  const cfg = window.SCP_CONFIG || {};
  const t = (s, v) => (window.tx ? window.tx(s, v) : s.replace(/\{(\w+)\}/g, (_, k) => v?.[k] ?? ""));
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const store = { get: (k, s = localStorage) => { try { return s.getItem(k); } catch { return null; } }, set: (k, v, s = localStorage) => { try { s.setItem(k, v); } catch {} } };
  const page = (location.pathname.split("/").pop() || "index.html").replace(".html", "");

  // ---------- ids, UTM, variant ----------
  let cid = store.get("scp-lead-cid");
  if (!cid) { cid = crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)); store.set("scp-lead-cid", cid); }
  const q = new URLSearchParams(location.search);
  if ([...q.keys()].some((k) => k.startsWith("utm_"))) {
    const utm = { landing: page, referrer: document.referrer ? new URL(document.referrer).hostname : "" };
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) if (q.get(k)) utm[k] = q.get(k).slice(0, 120);
    store.set("scp-utm", JSON.stringify(utm), sessionStorage);
  } else if (!store.get("scp-utm", sessionStorage) && document.referrer && !document.referrer.includes(location.host)) {
    store.set("scp-utm", JSON.stringify({ landing: page, referrer: new URL(document.referrer).hostname }), sessionStorage);
  }
  const utm = () => { try { return JSON.parse(store.get("scp-utm", sessionStorage) || "{}"); } catch { return {}; } };
  const setting = (cfg.leadFlow || {}).variant || "new";
  if (q.get("lf") === "classic" || q.get("lf") === "new") store.set("scp-lf-variant", q.get("lf"));
  let variant = store.get("scp-lf-variant");
  if (!variant || (setting !== "ab" && !q.get("lf") && variant !== setting)) {
    variant = setting === "ab" ? (Math.random() < 0.5 ? "new" : "classic") : setting;
    store.set("scp-lf-variant", variant);
  }

  // ---------- analytics (no personal data ever leaves through here) ----------
  const rpc = (fn, body) => cfg.supabaseUrl ? fetch(`${cfg.supabaseUrl}/rest/v1/rpc/${fn}`, { method: "POST", keepalive: true,
    headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }) : Promise.reject(new Error("Not connected"));
  window.SCP_TRACK = (event, props = {}) => {
    const safe = { event, step: props.step, variant, source_page: page, org_type: props.org_type, recommendation: props.recommendation };
    try { (window.dataLayer = window.dataLayer || []).push({ ...safe, event: `scp_${event}` }); } catch {}
    try { window.gtag?.("event", event, { step: safe.step, variant, recommendation: safe.recommendation }); } catch {}
    rpc("track_lead_event", { p: { ...safe, client_id: cid } }).catch(() => {});
  };

  // ---------- questions ----------
  const ORG = [
    ["club", "Sports Club / Team", "🏟️"], ["agency", "Sports Agency", "💼"], ["league", "League / Federation", "🏆"],
    ["event", "Sports Event Organizer", "🎟️"], ["creator", "Content Creator", "🎥"], ["other", "Other", "✨"],
  ];
  const SIZE = [["1", "Just me", "👤"], ["2-5", "2–5 people", "👥"], ["6-15", "6–15 people", "🧑‍🤝‍🧑"], ["15+", "More than 15 people", "🏢"]];
  const CHALLENGE = [
    ["ideas", "Finding fresh content ideas", "💡"], ["ai_time", "Saving time with AI", "⚡"], ["calendar", "Planning our content calendar", "🗓️"],
    ["performance", "Improving content performance", "📈"], ["multiple_teams", "Managing content for multiple teams", "🧩"], ["exploring", "Exploring Sports Content Playbook", "🔎"],
  ];
  const label = (list, v) => list.find((x) => x[0] === v)?.[1] || v;
  let rules = { demoOrgTypes: ["club", "agency", "league", "event"], trialOrgTypes: ["creator", "other"], demoTeamSizes: ["6-15", "15+"], trialTeamSizes: ["1"], demoChallenges: ["multiple_teams"], trialChallenges: [], default: "trial" };
  rpc("lead_rules_public", {}).then((r) => r.json()).then((r) => { if (r && typeof r === "object" && !r.code) rules = { ...rules, ...r }; }).catch(() => {});
  const recommend = (a) => {
    const has = (k, v) => v && (rules[k] || []).includes(v);
    if (has("demoChallenges", a.challenge)) return "demo"; if (has("trialChallenges", a.challenge)) return "trial";
    if (has("demoTeamSizes", a.team_size)) return "demo"; if (has("trialTeamSizes", a.team_size)) return "trial";
    if (has("demoOrgTypes", a.org_type)) return "demo"; if (has("trialOrgTypes", a.org_type)) return "trial";
    return rules.default === "demo" ? "demo" : "trial";
  };

  // ---------- Cal.com (already used for demos: real availability, time zone, double-booking prevention, confirmation email) ----------
  const bookingUrl = (window.SCP_LANG === "es" && cfg.demoBookingUrlEs) || cfg.demoBookingUrl || "";
  const calLink = bookingUrl.match(/^https:\/\/(?:app\.)?cal\.com\/(.+?)\/?$/)?.[1];
  function loadCal() {
    if (window.Cal) return;
    (function (C, A, L) { const p = (a, ar) => a.q.push(ar); const d = C.document; C.Cal = C.Cal || function () { const cal = C.Cal; const ar = arguments;
      if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement("script")).src = A; cal.loaded = true; }
      if (ar[0] === L) { const api = function () { p(api, arguments); }; const ns = ar[1]; api.q = api.q || [];
        if (typeof ns === "string") { cal.ns[ns] = cal.ns[ns] || api; p(cal.ns[ns], ar); p(cal, ["initNamespace", ns]); } else p(cal, ar); return; }
      p(cal, ar); }; })(window, "https://app.cal.com/embed/embed.js", "init");
  }

  // ---------- one flow instance ----------
  let calN = 0;
  function createFlow(host, { intent = "demo", cta = "", modal = null, message = "" } = {}) {
    const st = { step: 0, a: {}, rec: null, leadId: null, started: performance.now(), done: false, mode: null, history: [], prefill: message };
    const totalQuestions = 4;
    host.classList.add("lead");
    host.innerHTML = `<div class="lead-top"><div class="lead-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(t("Progress"))}"><i></i></div>
      <div class="lead-meta"><button type="button" class="lead-back" data-lead-back hidden>← ${esc(t("Back"))}</button><span class="lead-count" aria-live="polite"></span></div></div>
      <div class="lead-stage" data-lead-stage></div><p class="lead-sr" aria-live="assertive"></p>`;
    const stage = host.querySelector("[data-lead-stage]"), bar = host.querySelector(".lead-progress"), count = host.querySelector(".lead-count"), back = host.querySelector("[data-lead-back]"), sr = host.querySelector(".lead-sr");
    const signed = (() => { try { const ref = (cfg.supabaseUrl || "").match(/https:\/\/([^.]+)\./)?.[1]; return JSON.parse(localStorage.getItem(`sb-${ref}-auth-token`) || "null")?.user || null; } catch { return null; } })();

    function progress(n, of) {
      bar.querySelector("i").style.width = `${Math.round((n / of) * 100)}%`;
      bar.setAttribute("aria-valuenow", String(Math.round((n / of) * 100)));
      count.textContent = t("Step {x} of {y}", { x: n, y: of });
    }
    function show(html, { n, of, title }) {
      progress(n, of);
      back.hidden = !st.history.length || st.done;
      stage.classList.remove("is-in"); stage.classList.add("is-out");
      setTimeout(() => {
        stage.innerHTML = html;
        stage.classList.remove("is-out"); void stage.offsetWidth; stage.classList.add("is-in");
        sr.textContent = title || "";
        (stage.querySelector("[autofocus], .lead-opt[aria-checked=true], .lead-opt, h2") || stage).focus({ preventScroll: true });
      }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 160);
    }
    const go = (fn) => { st.history.push(st.render); st.render = fn; fn(); };
    back.addEventListener("click", () => { const prev = st.history.pop(); if (prev) { st.render = prev; prev(); } });

    function question(key, title, sub, list, n) {
      const cur = st.a[key];
      show(`<p class="lead-kicker">${esc(t(sub))}</p><h2 class="lead-q" tabindex="-1">${esc(t(title))}</h2>
        <div class="lead-opts${list.length > 4 ? " is-6" : ""}" role="radiogroup" aria-label="${esc(t(title))}">
        ${list.map(([v, l, ic], i) => `<button type="button" class="lead-opt" role="radio" aria-checked="${cur === v}" data-v="${v}"><span class="lead-key" aria-hidden="true">${i + 1}</span><span class="lead-ic" aria-hidden="true">${ic}</span><span>${esc(t(l))}</span></button>`).join("")}</div>
        <p class="lead-hint">${esc(t("Choose an option · keys 1–{n}", { n: list.length }))}</p>`, { n, of: totalQuestions, title: t(title) });
      const pick = (v) => {
        st.a[key] = v;
        stage.querySelectorAll(".lead-opt").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.v === v)));
        window.SCP_TRACK("form_step_completed", { step: key, org_type: st.a.org_type });
        setTimeout(() => next(key), 180);   // auto-advance
      };
      stage.onclick = (e) => { const b = e.target.closest(".lead-opt"); if (b) pick(b.dataset.v); };
      stage.onkeydown = (e) => {
        const i = Number(e.key) - 1;
        if (i >= 0 && i < list.length) { e.preventDefault(); pick(list[i][0]); }
        const opts = [...stage.querySelectorAll(".lead-opt")], at = opts.indexOf(document.activeElement);
        if (at >= 0 && ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(e.key)) { e.preventDefault(); opts[(at + (/(Down|Right)/.test(e.key) ? 1 : opts.length - 1)) % opts.length].focus(); }
      };
    }
    const q1 = () => question("org_type", "What best describes your organization?", "Step 1 · Who are you?", ORG, 1);
    const q2 = () => question("team_size", "How big is your content team?", "Step 2 · Your team", SIZE, 2);
    const q3 = () => question("challenge", "What’s your biggest content challenge?", "Step 3 · Your challenge", CHALLENGE, 3);
    function next(key) {
      if (key === "org_type") go(q2);
      else if (key === "team_size") go(q3);
      else { st.rec = recommend(st.a); window.SCP_TRACK("form_completed", { org_type: st.a.org_type, recommendation: st.rec }); save({}).catch(() => {}); go(recommendation); }
    }

    async function save(extra) {
      const body = { client_id: cid, ...st.a, ...extra, source_page: page, cta: cta || store.get("scp-cta", sessionStorage) || "", utm: utm(), lang: window.SCP_LANG || "en", variant, elapsed_ms: Math.round(performance.now() - st.started) };
      let r;
      try { r = await rpc("upsert_lead", { p: body }); } catch { const e = new Error("Something went wrong. Please try again in a moment."); e.server = true; throw e; }
      const d = await r.json().catch(() => ({}));
      // our own validation message (ok:false) is shown; a server / setup problem is not the visitor's fault
      if (r.ok && d.ok === false) throw new Error(d.error || "Something went wrong. Please try again in a moment.");
      if (!r.ok) { const e = new Error("Something went wrong. Please try again in a moment."); e.server = true; throw e; }
      if (d.id) st.leadId = d.id;
      if (d.recommendation) st.rec = d.recommendation;
      return d;
    }

    function recommendation() {
      const demo = st.rec === "demo", size = label(SIZE, st.a.team_size), org = label(ORG, st.a.org_type);
      const summary = `<ul class="lead-summary"><li>${esc(t(org))}</li><li>${esc(t(size))}</li><li>${esc(t(label(CHALLENGE, st.a.challenge)))}</li></ul>`;
      show(demo
        ? `<p class="lead-kicker">${esc(t("Step 4 · Your next step"))}</p><h2 class="lead-q" tabindex="-1">${esc(t("Let’s explore how Sports Content Playbook can help your organization."))}</h2>${summary}
           <p class="lead-text">${esc(t("In 30 minutes we show you the platform set up for your sport and your team, and answer your questions."))}</p>
           <div class="lead-ctas"><button type="button" class="lead-btn is-primary" data-act="demo" autofocus>${esc(t("Book Your Personalized Demo"))} <span aria-hidden="true">→</span></button>
           <a class="lead-btn" href="signup.html" data-act="trial">${esc(t("Start a free trial instead"))}</a></div>`
        : `<p class="lead-kicker">${esc(t("Step 4 · Your next step"))}</p><h2 class="lead-q" tabindex="-1">${esc(t("The quickest way to see if it fits: try it free."))}</h2>${summary}
           <p class="lead-text">${esc(t("Explore the full Content Library, filters and AI analysis with your own sport. Free for 7 days, cancel anytime."))}</p>
           <div class="lead-ctas"><a class="lead-btn is-primary" href="signup.html" data-act="trial" autofocus>${esc(t("Start Free Trial"))} <span aria-hidden="true">→</span></a>
           <button type="button" class="lead-btn" data-act="demo">${esc(t("Book a Demo"))}</button></div>`
        + (intent === "message" ? `<button type="button" class="lead-btn lead-msg" data-act="message">✉️ ${esc(t("Send us a message"))}</button>` : `<button type="button" class="lead-link" data-act="message">${esc(t("Just have a question? Send us a message"))}</button>`), { n: 4, of: totalQuestions, title: t("Your next step") });
      stage.onkeydown = null;
      stage.onclick = (e) => {
        const a = e.target.closest("[data-act]"); if (!a) return;
        if (a.dataset.act === "trial") {
          window.SCP_TRACK("free_trial_started", { org_type: st.a.org_type, recommendation: st.rec });
          const u = utm(), qs = new URLSearchParams({ from: "lead-flow", ...Object.fromEntries(Object.entries(u).filter(([k]) => k.startsWith("utm_"))) });
          a.setAttribute("href", `signup.html?${qs}`); st.done = true; return;   // the link navigates
        }
        e.preventDefault();
        st.mode = a.dataset.act === "message" ? "message" : "demo";
        go(details);
      };
    }

    function details() {
      const demo = st.mode === "demo", n = demo ? 5 : 5, of = demo ? 6 : 5;
      show(`<p class="lead-kicker">${esc(t(demo ? "Step 5 · Your details" : "Your message"))}</p><h2 class="lead-q" tabindex="-1">${esc(t(demo ? "Who should we prepare the demo for?" : "How can we help?"))}</h2>
        <form class="lead-form" novalidate>
          <label class="lead-field"><span>${esc(t("Name"))}</span><input name="name" autocomplete="name" required maxlength="120" value="${esc(signed?.user_metadata?.full_name || "")}"></label>
          <label class="lead-field"><span>${esc(t(demo ? "Work email" : "Email"))}</span><input name="email" type="email" autocomplete="email" required maxlength="200" inputmode="email" value="${esc(signed?.email || "")}"></label>
          <label class="lead-field"><span>${esc(t("Organization"))}</span><input name="organization" autocomplete="organization" maxlength="160" ${demo ? "required" : ""}></label>
          ${demo ? "" : `<label class="lead-field"><span>${esc(t("Message"))}</span><textarea name="message" rows="3" maxlength="4000" required>${esc(st.prefill)}</textarea></label>`}
          <input class="lead-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
          <p class="lead-privacy">${esc(t(demo ? "We use these details only to arrange and prepare your demo." : "We use these details only to answer your message."))} <a href="privacy.html" target="_blank" rel="noopener">${esc(t("Privacy policy"))}</a></p>
          <label class="lead-check"><input type="checkbox" name="privacy" required><span>${esc(t("I have read and accept the privacy policy"))}</span></label>
          <label class="lead-check"><input type="checkbox" name="marketing"><span>${esc(t("Send me sports content ideas and SCP news (optional)"))}</span></label>
          <p class="lead-error" role="alert" hidden></p>
          <button class="lead-btn is-primary" type="submit">${esc(t(demo ? "See available times" : "Send message"))} <span aria-hidden="true">→</span></button>
        </form>`, { n, of, title: t(demo ? "Your details" : "Your message") });
      stage.onclick = null; stage.onkeydown = null;
      setTimeout(() => {
        const form = stage.querySelector("form"); if (!form) return;
        form.querySelector("input[name=name]").focus();
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const err = form.querySelector(".lead-error"), fail = (m, el) => { err.hidden = false; err.textContent = t(m); el?.setAttribute("aria-invalid", "true"); el?.focus(); };
          form.querySelectorAll("[aria-invalid]").forEach((x) => x.removeAttribute("aria-invalid"));
          const f = Object.fromEntries(new FormData(form));
          if (!f.name.trim()) return fail("Please enter your name.", form.name);
          if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(f.email.trim())) return fail("Please enter a valid email.", form.email);
          if (demo && !f.organization.trim()) return fail("Please enter your organization.", form.organization);
          if (!demo && !String(f.message || "").trim()) return fail("Please write your message.", form.message);
          if (!form.privacy.checked) return fail("Please accept the privacy policy to continue.", form.privacy);
          const btn = form.querySelector("[type=submit]"); btn.disabled = true; btn.classList.add("is-loading");
          try {
            await save({ name: f.name.trim(), email: f.email.trim(), organization: f.organization.trim(), message: f.message, privacy: true, marketing: form.marketing.checked, hp: f.website });
            window.SCP_TRACK("lead_created", { org_type: st.a.org_type, recommendation: st.rec });
            st.contact = { name: f.name.trim(), email: f.email.trim(), organization: f.organization.trim() };
            if (demo) go(calendar);
            else {
              // keep the existing inbox (Admin → Memberships → Requests) receiving messages too
              rpc("submit_contact_request", { p: { kind: q.get("topic") === "custom-plan" ? "custom_plan" : "contact", name: st.contact.name, email: st.contact.email, company: st.contact.organization,
                message: String(f.message).trim(), lang: window.SCP_LANG || "en", page: `${page} ← lead flow${cta ? ` · ${cta}` : ""}`.slice(0, 200) } }).catch(() => {});
              st.done = true; go(sent);
            }
          } catch (x) {
            // if our database is down, don't lose the demo: the booking itself still goes through Cal.com
            if (x.server && demo) { st.contact = { name: f.name.trim(), email: f.email.trim(), organization: f.organization.trim() }; go(calendar); }
            else fail(x.message || "Something went wrong. Please try again in a moment.");
          }
          finally { btn.disabled = false; btn.classList.remove("is-loading"); }
        });
      }, 200);
    }

    function calendar() {
      window.SCP_TRACK("demo_booking_started", { org_type: st.a.org_type, recommendation: st.rec });
      const id = `lead-cal-${++calN}`;
      show(`<p class="lead-kicker">${esc(t("Step 6 · Pick a time"))}</p><h2 class="lead-q" tabindex="-1">${esc(t("Choose a day and time for your demo"))}</h2>
        <p class="lead-text">${esc(t("Times are shown in your time zone. You’ll get the invite by email as soon as it’s booked."))}</p>
        <div class="lead-cal" id="${id}"><div class="lead-loading"><span class="lead-spin"></span>${esc(t("Loading real availability…"))}</div></div>`, { n: 6, of: 6, title: t("Pick a time") });
      stage.onclick = null; stage.onkeydown = null;
      setTimeout(() => {
        const box = document.getElementById(id); if (!box) return;
        if (!calLink) { box.innerHTML = errorBox(); return; }
        const notes = [`Organization type: ${label(ORG, st.a.org_type)}`, `Team size: ${label(SIZE, st.a.team_size)}`, `Main challenge: ${label(CHALLENGE, st.a.challenge)}`,
          `Organization: ${st.contact.organization}`, `Source: ${page}${cta ? ` · ${cta}` : ""}`, utm().utm_campaign ? `Campaign: ${utm().utm_campaign}` : ""].filter(Boolean).join("\n");
        const params = new URLSearchParams({ name: st.contact.name, email: st.contact.email, notes, "metadata[lead_id]": st.leadId || "", "metadata[source]": page });
        loadCal();
        const ns = id.replace(/-/g, "");
        window.Cal("init", ns, { origin: "https://cal.com" });
        window.Cal.ns[ns]("inline", { elementOrSelector: `#${id}`, calLink: `${calLink}?${params}`, config: { layout: "month_view", theme: "dark", locale: window.SCP_LANG === "es" ? "es" : "en", name: st.contact.name, email: st.contact.email, notes } });
        window.Cal.ns[ns]("ui", { theme: "dark", layout: "month_view", hideEventTypeDetails: true,
          cssVarsPerTheme: { dark: { "cal-brand": "#f0b84a", "cal-brand-emphasis": "#f8cc75", "cal-brand-text": "#0b0f1c", "cal-bg": "transparent", "cal-bg-muted": "#17213b", "cal-bg-emphasis": "#1f2b48", "cal-border-booker": "transparent", "cal-border-booker-width": "0px", "cal-border": "rgba(180,192,211,0.18)", "cal-border-subtle": "rgba(180,192,211,0.12)", "cal-text": "#ffffff", "cal-text-subtle": "#b4c0d3", "cal-text-muted": "#8b98ae" } } });
        let ready = false;
        window.Cal.ns[ns]("on", { action: "linkReady", callback: () => { ready = true; box.querySelector(".lead-loading")?.remove(); } });
        window.Cal.ns[ns]("on", { action: "linkFailed", callback: () => { box.innerHTML = errorBox(); } });
        // only Cal.com's confirmation turns this into "booked"
        window.Cal.ns[ns]("on", { action: "bookingSuccessful", callback: (e) => {
          const b = e?.detail?.data?.booking || {}, start = b.startTime || e?.detail?.data?.date || null;
          st.booking = { start, uid: b.uid || null };
          rpc("lead_booking_reported", { p: { lead_id: st.leadId, client_id: cid, start, uid: b.uid } }).catch(() => {});
          window.SCP_TRACK("demo_booked", { org_type: st.a.org_type, recommendation: st.rec });
          st.done = true; go(booked);
        } });
        setTimeout(() => { if (!ready && box.querySelector(".lead-loading")) box.innerHTML = errorBox(); }, 15000);
        box.addEventListener("click", (e) => {
          if (e.target.closest("[data-retry]")) { st.history.pop(); calendar(); }
          if (e.target.closest("[data-fallback]")) {
            save({ message: "Couldn't load the calendar — please contact me to arrange the demo." }).catch(() => {});
            st.done = true; go(sent);
          }
        });
      }, 220);
    }
    const errorBox = () => `<div class="lead-err-box"><p>${esc(t("We couldn’t load the calendar right now."))}</p>
      <div class="lead-ctas"><button type="button" class="lead-btn is-primary" data-retry>${esc(t("Try again"))}</button><button type="button" class="lead-btn" data-fallback>${esc(t("Ask us to contact you"))}</button></div></div>`;

    function booked() {
      const when = st.booking?.start ? new Date(st.booking.start) : null;
      const day = when && !isNaN(when) ? when.toLocaleString(window.SCP_LOC || undefined, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "";
      show(`<div class="lead-done"><span class="lead-done-ic" aria-hidden="true">✓</span><h2 class="lead-q" tabindex="-1">${esc(t("Your demo is booked"))}</h2>
        ${day ? `<p class="lead-when">${esc(day)}</p>` : ""}
        <p class="lead-text">${esc(t("We’ve sent the invite with the video call link to {email}. See you there!", { email: st.contact.email }))}</p>
        <div class="lead-ctas"><a class="lead-btn is-primary" href="content-library.html">${esc(t("Explore the Content Library"))}</a></div></div>`, { n: 6, of: 6, title: t("Your demo is booked") });
      back.hidden = true;
    }
    function sent() {
      show(`<div class="lead-done"><span class="lead-done-ic" aria-hidden="true">✓</span><h2 class="lead-q" tabindex="-1">${esc(t("Thanks! We’ll get back to you soon."))}</h2>
        <p class="lead-text">${esc(t("We usually answer within one working day."))}</p>
        <div class="lead-ctas"><a class="lead-btn is-primary" href="signup.html">${esc(t("Start your free trial meanwhile"))}</a></div></div>`, { n: 1, of: 1, title: t("Message sent") });
      back.hidden = true;
    }

    // ---------- quick contact ("Contact" buttons): 3 taps — organisation, team size, phone — options as floating bubbles ----------
    // line icons (Lucide shapes) instead of emojis
    const QI = {
      shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
      trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
      briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
      video: '<path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
      ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2M13 17v2M13 11v2"/>',
      sparkles: '<path d="M9.94 15.5a2 2 0 0 0-1.44-1.44l-6.13-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0l1.58 6.14a2 2 0 0 0 1.44 1.44l6.14 1.58a.5.5 0 0 1 0 .96l-6.14 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.13a.5.5 0 0 1-.96 0z"/>',
      user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
      users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 21a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.3a5 5 0 0 1 6 4.7"/>',
      team: '<circle cx="12" cy="7" r="3"/><circle cx="5" cy="9" r="2.3"/><circle cx="19" cy="9" r="2.3"/><path d="M7 21a5 5 0 0 1 10 0M1 19a4 4 0 0 1 5.5-3.7M23 19a4 4 0 0 0-5.5-3.7"/>',
      building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
    };
    const qi = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${QI[n]}</svg>`;
    const QORG = [["club", "Club", "shield"], ["league", "League / Federation", "trophy"], ["agency", "Agency", "briefcase"], ["event", "Event organiser", "ticket"], ["creator", "Content creator", "video"], ["other", "Other", "sparkles"]];
    const QSIZE = [["1", "Just me", "user"], ["2-5", "2–5 people", "users"], ["6-15", "6–15 people", "team"], ["15+", "More than 15", "building"]];
    function bubbles(key, title, list, n, breakAfter = 0) {
      show(`<h2 class="lead-q lead-q-big" tabindex="-1">${esc(t(title))}</h2>
        <div class="lead-bubbles" role="radiogroup" aria-label="${esc(t(title))}">
        ${list.map(([v, l, ic], i) => `<button type="button" class="lead-bubble" role="radio" aria-checked="${st.a[key] === v}" data-v="${v}" style="--i:${i}"><span class="lead-bubble-ic">${qi(ic)}</span>${esc(t(l))}</button>${i + 1 === breakAfter ? `<span class="lead-break" aria-hidden="true"></span>` : ""}`).join("")}</div>`,
        { n, of: 3, title: t(title) });
      const pick = (v) => {
        st.a[key] = v;
        stage.querySelectorAll(".lead-bubble").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.v === v)));
        window.SCP_TRACK("form_step_completed", { step: key, org_type: st.a.org_type });
        setTimeout(() => go(key === "org_type" ? qsize : qphone), 120);
      };
      stage.onclick = (e) => { const b = e.target.closest(".lead-bubble"); if (b) pick(b.dataset.v); };
      stage.onkeydown = (e) => { const i = Number(e.key) - 1; if (i >= 0 && i < list.length) { e.preventDefault(); pick(list[i][0]); } };
    }
    const qorg = () => bubbles("org_type", "What best describes your organization?", QORG, 1, 3);   // 2 rows: Club · League · Agency / the rest
    const qsize = () => bubbles("team_size", "How big is your content team?", QSIZE, 2);
    const CODES = ["+34", "+376", "+1", "+44", "+33", "+39", "+49", "+351", "+31", "+32", "+41", "+52", "+54", "+55", "+57", "+56", "+971"];
    function qphone() {
      const def = "+34";
      show(`<h2 class="lead-q lead-q-big" tabindex="-1">${esc(t("What number should we message you on?"))}</h2>
        <form class="lead-form lead-phone" novalidate>
          <div class="lead-tel"><select name="code" aria-label="${esc(t("Country code"))}">${CODES.map((c) => `<option${c === def ? " selected" : ""}>${c}</option>`).join("")}</select>
            <input name="phone" type="tel" inputmode="tel" autocomplete="tel-national" required maxlength="20" placeholder="${esc(t("Your phone number"))}" autofocus></div>
          <input class="lead-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
          <label class="lead-check"><input type="checkbox" name="privacy" required><span>${esc(t("I accept the"))} <a href="privacy.html" target="_blank" rel="noopener">${esc(t("privacy policy"))}</a></span></label>
          <p class="lead-error" role="alert" hidden></p>
          <button class="lead-btn is-primary" type="submit">${esc(t("Send"))} <span aria-hidden="true">→</span></button>
        </form>`, { n: 3, of: 3, title: t("Your phone number") });
      stage.onclick = null; stage.onkeydown = null;
      setTimeout(() => {
        const form = stage.querySelector("form"); if (!form) return;
        form.phone.focus();
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const err = form.querySelector(".lead-error"), fail = (m, el) => { err.hidden = false; err.textContent = t(m); el?.focus(); };
          const num = form.phone.value.replace(/[^0-9]/g, "");
          if (num.length < 6) return fail("Please enter a valid phone number.", form.phone);
          if (!form.privacy.checked) return fail("Please accept the privacy policy to continue.", form.privacy);
          const btn = form.querySelector("[type=submit]"); btn.disabled = true; btn.classList.add("is-loading");
          try {
            const r = await rpc("submit_quick_lead", { p: { client_id: cid, ...st.a, phone: `${form.code.value}${num}`, privacy: true, hp: form.website.value,
              source_page: page, cta: cta || "", utm: utm(), lang: window.SCP_LANG || "en", variant, elapsed_ms: Math.round(performance.now() - st.started) } });
            const d = await r.json().catch(() => ({}));
            if (!r.ok || d.ok === false) throw new Error(d.error || "Something went wrong. Please try again in a moment.");
            window.SCP_TRACK("lead_created", { org_type: st.a.org_type });
            st.done = true; go(qdone);
          } catch (x) { fail(x.message); }
          finally { btn.disabled = false; btn.classList.remove("is-loading"); }
        });
      }, 200);
    }
    function qdone() {
      show(`<div class="lead-done"><span class="lead-done-ic" aria-hidden="true">✓</span><h2 class="lead-q" tabindex="-1">${esc(t("Thanks! We’ll message you very soon."))}</h2>
        <div class="lead-ctas"><a class="lead-btn is-primary" href="signup.html">${esc(t("Start your free trial meanwhile"))}</a></div></div>`, { n: 3, of: 3, title: t("Message sent") });
      back.hidden = true;
    }

    window.SCP_TRACK("form_started", {});
    if (intent === "message") { st.render = qorg; qorg(); }
    else { st.render = q1; q1(); }
    return {
      abandon() { if (!st.done) window.SCP_TRACK("form_abandoned", { step: st.render?.name || "", org_type: st.a.org_type }); },
    };
  }

  // ---------- modal ----------
  let open = null;
  function openModal(opts) {
    if (open) return;
    const last = document.activeElement;
    const wrap = document.createElement("div");
    wrap.className = `lead-modal${opts?.intent === "message" ? " is-quick" : ""}`; wrap.setAttribute("role", "dialog"); wrap.setAttribute("aria-modal", "true"); wrap.setAttribute("aria-label", t("Talk to Sports Content Playbook"));
    wrap.innerHTML = `<div class="lead-box"><button type="button" class="lead-x" aria-label="${esc(t("Close"))}">✕</button><div class="lead-host"></div></div>`;
    document.body.append(wrap);
    document.documentElement.classList.add("lead-lock");
    const flow = createFlow(wrap.querySelector(".lead-host"), opts);
    requestAnimationFrame(() => wrap.classList.add("is-open"));
    const close = () => {
      flow.abandon();
      wrap.classList.remove("is-open"); document.documentElement.classList.remove("lead-lock");
      setTimeout(() => wrap.remove(), 200); open = null; last?.focus?.();
      document.removeEventListener("keydown", onKey, true);
    };
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      if (e.key === "Tab") {   // keep the focus inside the dialog
        const f = [...wrap.querySelectorAll('button, a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener("keydown", onKey, true);
    wrap.addEventListener("click", (e) => { if (e.target === wrap || e.target.closest(".lead-x")) close(); });
    addEventListener("pagehide", () => flow.abandon(), { once: true });
    open = { close };
  }
  window.SCP_LEADFLOW = { open: openModal, mount: (el, opts) => createFlow(el, opts), variant };

  if (variant !== "new") return;   // A/B: the classic forms stay as they are

  // Every existing "Book a demo" / "Contact" entry point opens the flow (their links stay as a fallback without JS)
  const where = (el) => el.dataset.cta || el.closest("section[id]")?.id || (el.closest("footer") ? "footer" : el.closest(".site-nav") ? "nav" : "page");
  document.addEventListener("click", (e) => {
    const el = e.target.closest('a[href*="book-a-call"], a[href*="contact.html"], [data-faq-open="demo"], [data-faq-open="contact"], [data-lead-flow]');
    if (!el || el.closest(".lead") || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    if (el.closest(".lead-inline")) return;
    const href = el.getAttribute("href") || "";
    const intent = el.dataset.leadFlow || (el.dataset.faqOpen === "contact" || /contact\.html/.test(href) ? "message" : "demo");
    e.preventDefault(); e.stopImmediatePropagation();
    const message = /topic=custom-plan/.test(href) ? t("We'd like a custom plan for {n} or more users.", { n: (href.match(/users=(\d+)/) || [])[1] || 6 }) : "";
    openModal({ intent, cta: `${page}:${where(el)}`, message });
  }, true);

  // Inline on the demo and contact pages, in place of the old form
  const mountInline = () => {
    const slot = document.querySelector(page === "book-a-call" ? ".book-card" : page === "contact" ? "[data-contact-form]" : null);
    if (!slot) return;
    const host = document.createElement("div");
    host.className = "lead-inline";
    (page === "contact" ? slot : slot).replaceWith(host);
    createFlow(host, { intent: page === "contact" ? "message" : "demo", cta: `${page}:page`, message: q.get("topic") === "custom-plan" ? t("We'd like a custom plan for {n} or more users.", { n: q.get("users") || 6 }) : "" });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountInline); else mountInline();
})();
