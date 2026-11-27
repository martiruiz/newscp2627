// Support, bottom left of the platform (loaded by js/guard.js for members with access: library, trial, My Club, staff).
// One button opens a panel with three tabs (supabase/support-feedback.sql):
//   What's new   the improvements of the last 5 days (Admin → Support writes them)
//   Report       a bug or a suggestion, up to 6 screenshots (button, paste with ⌘V or drag), and the page, browser,
//                screen, language and plan sent along by itself
//   My reports   their reports with our state and reply; a dot on the button when one is solved and not seen yet
// The first time after this launch, members who already had an account see a short notice presenting it (once per
// account: profiles.preferences.support_intro_seen). It never shows over the library tour or the device notice.
(async () => {
  const auth = window.SCP_AUTH, db = auth?.client;
  if (!db || document.querySelector(".sp-btn")) return;
  const { data: ent } = (await window.SCP_entitlements?.().catch(() => ({}))) || {};
  if (!ent || !(ent.is_staff || ent.has_library)) return;
  const { data: { session } } = await db.auth.getSession();
  if (!session) return;
  const uid = session.user.id;
  const tx = (t, v) => (window.tx ? window.tx(t, v) : t.replace(/\{(\w+)\}/g, (m, k) => (v && k in v ? v[k] : m)));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const es = window.SCP_LANG !== "en";
  const day = (d) => new Date(d).toLocaleDateString(window.SCP_LOC || "es-ES", { day: "numeric", month: "short" });
  const RELEASE = "2026-11-28";   // accounts created before this see the notice presenting the tool
  const SEEN_UPD = "scp-updates-seen";
  const ic = {
    life: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><path d="m4.93 4.93 4.24 4.24M14.83 14.83l4.24 4.24M14.83 9.17l4.24-4.24M4.93 19.07l4.24-4.24"/>',
    bug: '<path d="m8 2 1.88 1.88M14.12 3.88 16 2M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4"/>',
    idea: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4"/>',
    img: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    news: '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    plus: '<circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    spark: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
  };
  const svg = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;

  document.head.insertAdjacentHTML("beforeend", `<style>
  .sp-btn{position:fixed;left:18px;bottom:16px;z-index:140;display:flex;align-items:center;gap:10px;width:273px;height:46px;padding:0 14px;box-sizing:border-box;border-radius:13px;border:1px solid rgba(var(--fg,255,255,255),.16);background:var(--surface,#17213b);color:var(--text,#fff);font:600 14px var(--font-body,Inter,system-ui,sans-serif);cursor:pointer;text-align:left;box-shadow:0 10px 28px rgba(0,0,0,.35);transition:border-color .2s,background .2s}
  .sp-btn:hover{border-color:rgba(240,184,74,.45)}.sp-btn > svg{flex:none;width:18px;height:18px;color:var(--muted,#b4c0d3)}.sp-btn:hover > svg{color:var(--gold,#f0b84a)}
  .sp-btn .sp-lbl{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sp-btn .sp-chev{flex:none;width:16px;height:16px;color:var(--muted,#b4c0d3)}
  .sp-tile{flex:none;display:grid;place-items:center;width:34px;height:34px;border-radius:11px;background:linear-gradient(135deg,var(--gold-light,#ffe0a0),var(--gold,#f0b84a));color:var(--on-gold,#121b33);box-shadow:0 4px 14px rgba(240,184,74,.3)}.sp-tile svg{width:18px;height:18px}
  .sp-dot{flex:none;min-width:20px;height:20px;padding:0 6px;box-sizing:border-box;border-radius:10px;background:var(--gold,#f0b84a);color:var(--on-gold,#121b33);font:700 11.5px/20px var(--font-body,Inter,sans-serif);text-align:center}
  .sp-overlay{position:fixed;inset:0;z-index:2147481000;display:grid;place-items:center;padding:16px;background:rgba(8,12,26,.6);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);animation:sp-fade .2s ease}
  .sp-panel{position:relative;width:480px;max-width:100%;max-height:min(680px,calc(100vh - 32px));display:flex;flex-direction:column;border-radius:22px;border:1px solid transparent;background:linear-gradient(var(--surface,#17213b),var(--surface,#17213b)) padding-box,linear-gradient(160deg,rgba(255,224,160,.5),rgba(240,184,74,.1) 40%,rgba(255,255,255,.06)) border-box;color:var(--text,#fff);box-shadow:0 30px 80px rgba(0,0,0,.55);font-family:var(--font-body,Inter,system-ui,sans-serif);overflow:hidden;animation:sp-in .22s cubic-bezier(.2,.8,.2,1)}
  @keyframes sp-in{from{opacity:0;transform:translateY(10px) scale(.98)}}
  .sp-head{position:relative;display:flex;align-items:center;gap:12px;padding:18px 18px 14px;background:radial-gradient(120% 140% at 0% 0%,rgba(240,184,74,.16),transparent 60%)}
  .sp-head h2{margin:0;flex:1;font:600 17px/1.2 var(--font-display,"Host Grotesk",system-ui,sans-serif)}.sp-head h2 small{display:block;margin-top:3px;color:var(--muted,#b4c0d3);font:500 12.5px var(--font-body,Inter,sans-serif)}
  .sp-x{width:34px;height:34px;border:0;border-radius:50%;background:rgba(var(--fg,255,255,255),.05);color:var(--muted,#b4c0d3);cursor:pointer;display:grid;place-items:center}.sp-x:hover{background:rgba(var(--fg,255,255,255),.1);color:var(--text,#fff)}.sp-x svg{width:16px;height:16px}
  .sp-tabs{display:flex;gap:4px;margin:0 18px;padding:4px;border-radius:14px;background:rgba(var(--fg,255,255,255),.04);border:1px solid var(--line-soft,rgba(255,255,255,.05))}
  .sp-tabs button{flex:1;height:36px;border:0;border-radius:10px;background:none;color:var(--muted,#b4c0d3);font:600 13px var(--font-body,Inter,sans-serif);cursor:pointer;transition:background .2s,color .2s}
  .sp-tabs button:hover{color:var(--text,#fff)}.sp-tabs button[aria-selected="true"]{background:linear-gradient(135deg,rgba(255,224,160,.2),rgba(240,184,74,.14));color:var(--gold,#f0b84a);box-shadow:inset 0 0 0 1px rgba(240,184,74,.25)}
  .sp-tabs i{display:inline-block;width:7px;height:7px;margin-left:6px;border-radius:50%;background:#ff6b5b;vertical-align:1px}
  .sp-body{padding:16px 18px 18px;overflow-y:auto;font-size:14px;line-height:1.5}
  .sp-lead{margin:0 0 14px;color:var(--muted,#b4c0d3);font-size:13.5px;line-height:1.55}
  .sp-kinds{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}
  .sp-subs{display:flex;flex-wrap:wrap;gap:6px;margin:-2px 0 12px}.sp-subs button{height:30px;padding:0 12px;border-radius:999px;border:1px solid var(--line,rgba(255,255,255,.1));background:none;color:var(--muted,#b4c0d3);font:600 12.5px var(--font-body,Inter,sans-serif);cursor:pointer}
  .sp-subs button[aria-pressed="true"]{border-color:rgba(240,184,74,.55);background:var(--gold-tint,rgba(240,184,74,.2));color:var(--gold,#f0b84a)}
  .sp-kinds button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:12px 6px;border-radius:14px;border:1px solid var(--line,rgba(255,255,255,.1));background:rgba(var(--fg,255,255,255),.02);color:var(--text,#fff);font:600 13px var(--font-body,Inter,sans-serif);white-space:nowrap;cursor:pointer;text-align:center;transition:border-color .2s,background .2s}
  .sp-kinds button span{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:rgba(var(--fg,255,255,255),.06);color:var(--muted,#b4c0d3)}.sp-kinds button svg{width:16px;height:16px}
  .sp-kinds button[aria-pressed="true"]{border-color:rgba(240,184,74,.55);background:linear-gradient(135deg,rgba(255,224,160,.1),rgba(240,184,74,.06))}.sp-kinds button[aria-pressed="true"] span{background:linear-gradient(135deg,var(--gold-light,#ffe0a0),var(--gold,#f0b84a));color:var(--on-gold,#121b33)}
  .sp-ta{width:100%;min-height:132px;resize:vertical;box-sizing:border-box;padding:13px 14px;border-radius:14px;border:1px solid var(--line,rgba(255,255,255,.1));background:rgba(var(--fg,255,255,255),.03);color:var(--text,#fff);font:14px/1.55 var(--font-body,Inter,sans-serif);transition:border-color .2s,box-shadow .2s}
  .sp-ta:focus{outline:none;border-color:rgba(240,184,74,.55);box-shadow:0 0 0 4px rgba(240,184,74,.1)}.sp-drop .sp-ta{border-color:var(--gold,#f0b84a);border-style:dashed}
  .sp-count{text-align:right;color:var(--muted,#b4c0d3);font-size:11.5px;margin:5px 2px 10px;font-variant-numeric:tabular-nums}
  .sp-thumbs{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}.sp-thumbs:empty{display:none}
  .sp-thumbs span{position:relative;width:66px;height:66px;border-radius:12px;overflow:hidden;border:1px solid var(--line,rgba(255,255,255,.1))}.sp-thumbs img{width:100%;height:100%;object-fit:cover}
  .sp-thumbs button{position:absolute;top:4px;right:4px;width:20px;height:20px;border:0;border-radius:50%;background:rgba(0,0,0,.72);color:#fff;cursor:pointer;display:grid;place-items:center;padding:0}.sp-thumbs button svg{width:12px;height:12px}
  .sp-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.sp-attach{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 14px;border-radius:999px;border:1px solid var(--line,rgba(255,255,255,.1));background:rgba(var(--fg,255,255,255),.03);color:var(--text,#fff);font:600 12.5px var(--font-body,Inter,sans-serif);cursor:pointer}.sp-attach:hover{border-color:rgba(240,184,74,.45)}.sp-attach svg{width:15px;height:15px;color:var(--gold,#f0b84a)}
  .sp-hint{color:var(--muted,#b4c0d3);font-size:12px}
  .sp-note{display:flex;gap:12px;align-items:flex-start;margin:14px 0 0;padding:12px 14px;border-radius:14px;border:1px solid rgba(240,184,74,.4);background:linear-gradient(135deg,rgba(255,224,160,.12),rgba(240,184,74,.06));color:var(--text,#fff);font-size:13px;line-height:1.45}
  .sp-note > span:first-child{flex:none;display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:linear-gradient(135deg,var(--gold-light,#ffe0a0),var(--gold,#f0b84a));color:var(--on-gold,#121b33)}.sp-note svg{width:16px;height:16px}.sp-note b{display:block;color:var(--gold,#f0b84a);font-size:13px;margin-bottom:2px}.sp-note small{color:var(--muted,#b4c0d3);font-size:12.5px}
  .sp-send{margin-top:14px;width:100%;min-height:46px;border:0;border-radius:999px;background:linear-gradient(135deg,var(--gold-light,#ffe0a0),var(--gold,#f0b84a));color:var(--on-gold,#121b33);font:700 14.5px var(--font-body,Inter,sans-serif);cursor:pointer;box-shadow:0 10px 26px rgba(240,184,74,.28);transition:transform .2s,box-shadow .2s}.sp-send:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 14px 32px rgba(240,184,74,.36)}.sp-send:disabled{background:rgba(var(--fg,255,255,255),.06);color:var(--muted,#b4c0d3);box-shadow:inset 0 0 0 1px rgba(var(--fg,255,255,255),.08);cursor:default}
  .sp-err{color:#ff8a8a;font-size:13px;margin:8px 0 0}
  .sp-upd{position:relative;margin-bottom:10px;padding:14px 14px 14px 16px;border-radius:14px;border:1px solid var(--line-soft,rgba(255,255,255,.05));background:linear-gradient(135deg,rgba(255,224,160,.05),transparent 60%)}
  .sp-upd::before{content:"";position:absolute;left:0;top:14px;bottom:14px;width:3px;border-radius:0 3px 3px 0;background:linear-gradient(var(--gold-light,#ffe0a0),var(--gold,#f0b84a))}
  .sp-upd b,.sp-rep b{display:block;font-size:14.5px;line-height:1.35}.sp-upd p,.sp-rep p{margin:5px 0 0;color:var(--muted,#b4c0d3);font-size:13.5px;white-space:pre-line}
  .sp-upd small,.sp-rep small{display:block;margin-bottom:4px;color:var(--gold,#f0b84a);font-size:11.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase}.sp-rep small{color:var(--muted,#b4c0d3)}
  .sp-upd a{display:inline-block;margin-top:8px;color:var(--gold,#f0b84a);font-weight:600;font-size:13px;text-decoration:none}
  .sp-rep{margin-bottom:10px;padding:14px;border-radius:14px;border:1px solid var(--line-soft,rgba(255,255,255,.05));background:rgba(var(--fg,255,255,255),.02)}
  .sp-st{display:inline-block;margin-left:8px;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:700;vertical-align:1px;background:rgba(var(--fg,255,255,255),.08);color:var(--muted,#b4c0d3)}
  .sp-st.is-done{background:rgba(74,222,128,.14);color:#4ade80}.sp-st.is-in_progress{background:var(--gold-tint,rgba(240,184,74,.2));color:var(--gold,#f0b84a)}
  .sp-reply{margin-top:10px;padding:10px 12px;border-radius:12px;background:var(--gold-tint,rgba(240,184,74,.2));color:var(--text,#fff);font-size:13.5px}.sp-reply em{display:block;font-style:normal;color:var(--gold,#f0b84a);font-size:11.5px;font-weight:700;margin-bottom:2px}
  .sp-empty{display:grid;justify-items:center;gap:10px;color:var(--muted,#b4c0d3);text-align:center;padding:26px 12px;font-size:13.5px}.sp-empty span{display:grid;place-items:center;width:46px;height:46px;border-radius:14px;background:rgba(var(--fg,255,255,255),.05);color:var(--gold,#f0b84a)}.sp-empty svg{width:22px;height:22px}
  .sp-done{display:grid;justify-items:center;gap:8px;text-align:center;padding:24px 8px}.sp-done b{font:600 17px var(--font-display,"Host Grotesk",sans-serif)}.sp-done span{display:grid;place-items:center;width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,var(--gold-light,#ffe0a0),var(--gold,#f0b84a));color:var(--on-gold,#121b33)}.sp-done svg{width:24px;height:24px}
  .sp-intro{position:fixed;inset:0;z-index:2147482000;display:grid;place-items:center;padding:16px;background:rgba(8,12,26,.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);animation:sp-fade .25s ease}
  @keyframes sp-fade{from{opacity:0}}
  .sp-card{position:relative;max-width:480px;width:100%;border-radius:26px;border:1px solid transparent;background:linear-gradient(var(--surface,#17213b),var(--surface,#17213b)) padding-box,linear-gradient(160deg,rgba(255,224,160,.6),rgba(240,184,74,.12) 40%,rgba(255,255,255,.06)) border-box;color:var(--text,#fff);font-family:var(--font-body,Inter,sans-serif);box-shadow:0 40px 100px rgba(0,0,0,.6);overflow:hidden;animation:sp-in .3s cubic-bezier(.2,.8,.2,1)}
  .sp-hero{position:relative;height:150px;display:grid;place-items:center;background:radial-gradient(80% 120% at 50% 0%,rgba(240,184,74,.28),transparent 70%),radial-gradient(60% 80% at 15% 100%,rgba(122,162,255,.12),transparent 70%);border-bottom:1px solid var(--line-soft,rgba(255,255,255,.05))}
  .sp-hero::before{content:"";position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.08) 1px,transparent 1px);background-size:16px 16px;mask-image:radial-gradient(70% 90% at 50% 40%,#000,transparent)}
  .sp-mini{position:relative;display:inline-flex;align-items:center;gap:10px;height:50px;padding:0 20px 0 7px;border-radius:999px;border:1px solid rgba(255,224,160,.45);background:rgba(var(--surface-rgb,23,33,59),.9);font:600 14px var(--font-body,Inter,sans-serif);box-shadow:0 16px 40px rgba(0,0,0,.45);animation:sp-float 3s ease-in-out infinite}
  .sp-mini::after{content:"";position:absolute;inset:-7px;border-radius:999px;border:1px solid rgba(240,184,74,.35);animation:sp-ring 2.2s ease-out infinite}
  .sp-mini .sp-tile{width:36px;height:36px}
  @keyframes sp-float{50%{transform:translateY(-4px)}}@keyframes sp-ring{from{opacity:.9;transform:scale(.96)}to{opacity:0;transform:scale(1.12)}}
  .sp-cbody{padding:22px 24px 22px}
  .sp-eyebrow{display:inline-block;margin-bottom:10px;padding:4px 10px;border-radius:999px;background:var(--gold-tint,rgba(240,184,74,.2));color:var(--gold,#f0b84a);font:700 11px var(--font-body,Inter,sans-serif);letter-spacing:.12em;text-transform:uppercase}
  .sp-card h2{margin:0 0 8px;font:600 24px/1.2 var(--font-display,"Host Grotesk",system-ui,sans-serif);letter-spacing:-.01em}.sp-card h2 em{font-style:normal;background:linear-gradient(135deg,var(--gold-light,#ffe0a0),var(--gold,#f0b84a));-webkit-background-clip:text;background-clip:text;color:transparent}
  .sp-card .sp-sub{margin:0 0 18px;color:var(--muted,#b4c0d3);font-size:14.5px;line-height:1.55}
  .sp-feats{display:grid;gap:8px;margin-bottom:20px}
  .sp-feat{display:flex;gap:12px;align-items:flex-start;padding:12px;border-radius:14px;border:1px solid var(--line-soft,rgba(255,255,255,.05));background:rgba(var(--fg,255,255,255),.025)}
  .sp-feat > span{flex:none;display:grid;place-items:center;width:36px;height:36px;border-radius:11px;background:linear-gradient(135deg,rgba(255,224,160,.18),rgba(240,184,74,.1));color:var(--gold,#f0b84a);box-shadow:inset 0 0 0 1px rgba(240,184,74,.25)}.sp-feat svg{width:18px;height:18px}
  .sp-feat b{display:block;font-size:14px;margin-bottom:2px}.sp-feat p{margin:0;color:var(--muted,#b4c0d3);font-size:13px;line-height:1.45}
  .sp-card .sp-later{display:block;width:100%;margin-top:6px;min-height:42px;border:0;background:none;color:var(--muted,#b4c0d3);font:600 14px var(--font-body,Inter,sans-serif);cursor:pointer}.sp-card .sp-later:hover{color:var(--text,#fff)}
  html.sp-in-col [data-filters]{padding-bottom:72px}
  .sp-btn.sp-compact{width:auto;max-width:46px;padding:0 0 0 13px;overflow:hidden;transition:max-width .28s cubic-bezier(.2,.8,.2,1),border-color .2s}.sp-btn.sp-compact .sp-lbl{flex:none;opacity:0;transition:opacity .2s}.sp-btn.sp-compact .sp-chev{display:none}.sp-btn.sp-compact .sp-dot{position:absolute;top:3px;left:30px;min-width:16px;height:16px;line-height:16px;font-size:10px;padding:0 4px}
  .sp-btn.sp-compact:hover,.sp-btn.sp-compact:focus-visible{max-width:300px;padding-right:16px}.sp-btn.sp-compact:hover .sp-lbl,.sp-btn.sp-compact:focus-visible .sp-lbl{opacity:1}
  @media (max-width:600px){.sp-btn{left:12px;bottom:12px;width:46px;padding:0;justify-content:center}.sp-btn .sp-lbl,.sp-btn .sp-chev{display:none}.sp-btn .sp-dot{position:absolute;top:-6px;right:-6px}.sp-overlay{padding:10px}.sp-panel{width:100%;max-height:calc(100vh - 20px)}.sp-hero{height:120px}.sp-cbody{padding:18px}.sp-card h2{font-size:21px}}
  </style>`);

  // ---- data -----------------------------------------------------------------------------------------------
  let updates = [], reports = [];
  const since = new Date(Date.now() - 5 * 864e5).toISOString();
  const seenUpd = () => { try { return Number(localStorage.getItem(SEEN_UPD) || 0); } catch { return 0; } };
  async function load() {
    const [u, r] = await Promise.all([
      db.from("product_updates").select("id,title_es,body_es,title_en,body_en,link,published_at").gte("published_at", since).order("published_at", { ascending: false }).limit(20),
      db.from("feedback").select("id,kind,message,status,admin_reply,created_at,resolved_at,user_seen_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(30),
    ]);
    updates = u.data || []; reports = r.data || [];
  }
  const newUpdates = () => updates.filter((u) => u.id > seenUpd()).length;
  const solvedUnseen = () => reports.filter((r) => ["done", "wontfix"].includes(r.status) && !r.user_seen_at).length;

  // ---- button -----------------------------------------------------------------------------------------------
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "sp-btn"; btn.setAttribute("aria-haspopup", "dialog");
  btn.innerHTML = `${svg(ic.life)}<span class="sp-lbl">${esc(tx("Support & what's new"))}</span>${svg('<path d="m9 18 6-6-6-6"/>').replace("<svg", '<svg class="sp-chev"')}`;
  btn.title = tx("Support & what's new");
  if (/(content-plan|saved)\.html$/.test(location.pathname)) btn.classList.add("sp-compact");   // pages with no left menu: just the icon
  document.body.appendChild(btn);
  const paintDot = () => { btn.querySelector(".sp-dot")?.remove(); const n = newUpdates() + solvedUnseen(); if (n) btn.querySelector(".sp-chev").insertAdjacentHTML("beforebegin", `<span class="sp-dot">${n}</span>`); };
  // in the library, lined up with the filters column (same left edge and width as its rows); elsewhere the same size
  const fit = () => {
    const row = document.querySelector("[data-filters] .lf-row"), col = document.querySelector("[data-filters]");
    const r = row?.getBoundingClientRect(), on = r && r.width > 0 && col.getBoundingClientRect().left >= 0 && innerWidth > 960;
    btn.style.left = on ? `${Math.round(r.left)}px` : ""; btn.style.width = on ? `${Math.round(r.width)}px` : "";
    document.documentElement.classList.toggle("sp-in-col", Boolean(on));
    // phones: above the bottom tab bar, never on top of it
    const tb = [...document.querySelectorAll(".tabbar, .a-tabbar")].find((x) => x.getBoundingClientRect().height > 0 && getComputedStyle(x).position === "fixed");
    btn.style.bottom = tb ? `${Math.round(innerHeight - tb.getBoundingClientRect().top + 10)}px` : "";
  };
  fit(); addEventListener("resize", fit);
  const colEl = document.querySelector("[data-filters]"); if (colEl && window.ResizeObserver) new ResizeObserver(fit).observe(colEl);   // filters shown / hidden
  setTimeout(fit, 1500);
  await load().catch(() => {}); paintDot();

  // ---- panel ------------------------------------------------------------------------------------------------
  let panel = null, tab = "news", kind = "bug", sub = "profile", files = [];
  const SUBS = [["profile", "Profile or club"], ["creator", "Creator"], ["sport", "Sport"], ["competition", "Competition"], ["brand", "Brand"]];
  const KIND_NAME = { bug: "Bug", idea: "Suggestion", content: "Content request" };
  const TAB_NAMES = { news: "What's new", report: "Report", mine: "My reports" };
  let overlay = null;
  function close() { overlay?.remove(); overlay = panel = null; document.documentElement.style.overflow = ""; btn.setAttribute("aria-expanded", "false"); btn.focus(); }
  function open(t) {
    tab = t || (newUpdates() ? "news" : solvedUnseen() ? "mine" : "report");
    if (!panel) {   // centred, with the page blurred behind it
      overlay = document.createElement("div"); overlay.className = "sp-overlay";
      panel = document.createElement("div");
      panel.className = "sp-panel"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true"); panel.setAttribute("aria-label", tx("Support & what's new"));
      overlay.appendChild(panel); document.body.appendChild(overlay);
      document.documentElement.style.overflow = "hidden";
    }
    btn.setAttribute("aria-expanded", "true");
    draw();
  }
  function draw() {
    const dots = { news: newUpdates(), mine: solvedUnseen() };
    panel.innerHTML = `<div class="sp-head"><span class="sp-tile">${svg(ic.life)}</span><h2>${esc(tx("Support & what's new"))}<small>${esc(tx("We read every message"))}</small></h2><button class="sp-x" type="button" data-sp-close aria-label="${esc(tx("Close"))}">${svg(ic.x)}</button></div>
      <div class="sp-tabs" role="tablist">${Object.entries(TAB_NAMES).map(([k, n]) => `<button type="button" role="tab" data-sp-tab="${k}" aria-selected="${k === tab}">${esc(tx(n))}${dots[k] ? "<i></i>" : ""}</button>`).join("")}</div>
      <div class="sp-body" data-sp-body></div>`;
    const body = panel.querySelector("[data-sp-body]");
    if (tab === "news") {
      body.innerHTML = updates.length ? updates.map((u) => {
        const t = (!es && u.title_en) || u.title_es, b = (!es && u.body_en) || u.body_es;
        return `<div class="sp-upd"><small>${esc(day(u.published_at))}</small><b>${esc(t)}</b>${b ? `<p>${esc(b)}</p>` : ""}${u.link ? `<a href="${esc(u.link)}">${esc(tx("Take a look"))} →</a>` : ""}</div>`;
      }).join("") : `<div class="sp-empty"><span>${svg(ic.news)}</span>${esc(tx("No new improvements in the last 5 days. We'll post them here."))}</div>`;
      if (updates.length) try { localStorage.setItem(SEEN_UPD, String(Math.max(...updates.map((u) => u.id)))); } catch {}
      paintDot();
    } else if (tab === "mine") {
      body.innerHTML = reports.length ? reports.map((r) => `<div class="sp-rep"><small>${esc(day(r.created_at))} · ${esc(tx(KIND_NAME[r.kind] || r.kind))}</small>
          <b>${esc(r.message.length > 140 ? r.message.slice(0, 140) + "…" : r.message)}<span class="sp-st is-${esc(r.status)}">${esc(tx({ new: "Received", in_progress: "In progress", done: "Solved", wontfix: "Closed" }[r.status]))}</span></b>
          ${r.admin_reply ? `<div class="sp-reply"><em>${esc(tx("SCP team"))}</em>${esc(r.admin_reply)}</div>` : ""}</div>`).join("")
        : `<div class="sp-empty"><span>${svg(ic.list)}</span>${esc(tx("You haven't sent any report yet."))}</div>`;
      if (solvedUnseen()) db.rpc("feedback_mark_seen").then(() => { reports.forEach((r) => { if (["done", "wontfix"].includes(r.status)) r.user_seen_at = r.user_seen_at || new Date().toISOString(); }); paintDot(); });
    } else drawReport(body);
  }
  function drawReport(body) {
    body.innerHTML = `<p class="sp-lead">${esc(tx(kind === "content" ? "Tell us what's missing in the library: we add the profiles, sports and creators our members ask for." : "Tell us as much as you can: what you were doing, what you expected and what happened. Screenshots help a lot."))}</p>
      <div class="sp-kinds" role="group">${[["bug", "Bug", ic.bug], ["idea", "Suggestion", ic.idea], ["content", "Request content", ic.plus]].map(([k, n, i]) => `<button type="button" data-sp-kind="${k}" aria-pressed="${k === kind}"><span>${svg(i)}</span>${esc(tx(n))}</button>`).join("")}</div>
      ${kind === "content" ? `<div class="sp-subs" role="group" aria-label="${esc(tx("What do you want to see?"))}">${SUBS.map(([k, n]) => `<button type="button" data-sp-sub="${k}" aria-pressed="${k === sub}">${esc(tx(n))}</button>`).join("")}</div>` : ""}
      <textarea class="sp-ta" maxlength="1500" data-sp-text placeholder="${esc(tx(kind === "bug" ? "Describe the bug step by step: what you were doing, what happened, on which screen…" : kind === "idea" ? "What would you improve or add? Tell us what it would help you with." : "Which profiles, sports, creators or competitions would you like to see? Paste their @ or links and tell us why they interest you."))}"></textarea>
      <div class="sp-count"><span data-sp-n>0</span>/1500</div>
      <div class="sp-thumbs" data-sp-thumbs></div>
      <div class="sp-row"><button type="button" class="sp-attach" data-sp-attach>${svg(ic.img)}${esc(tx("Attach images"))}</button><span class="sp-hint">${esc(tx("Or paste them with ⌘V · up to 6"))}</span></div>
      <input type="file" accept="image/*" multiple hidden data-sp-file>
      ${kind === "content" ? "" : `<div class="sp-note"><span>${svg('<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>')}</span><span><b>${esc(tx("Sent along automatically"))}</b><small>${esc(tx("The page you're on, your browser and your plan go with your message, so we can find the problem sooner."))}</small></span></div>`}
      <p class="sp-err" hidden data-sp-err></p>
      <button type="button" class="sp-send" data-sp-send disabled>${esc(tx("Send"))}</button>`;
    const ta = body.querySelector("[data-sp-text]");
    ta.value = draft;
    const refresh = () => { body.querySelector("[data-sp-n]").textContent = ta.value.length; body.querySelector("[data-sp-send]").disabled = ta.value.trim().length < 3; };
    ta.addEventListener("input", () => { draft = ta.value; refresh(); });
    refresh(); thumbs(); setTimeout(() => ta.focus(), 50);
  }
  let draft = "";
  function thumbs() {
    const box = panel?.querySelector("[data-sp-thumbs]"); if (!box) return;
    box.innerHTML = files.map((f, i) => `<span><img src="${f.url}" alt=""><button type="button" data-sp-rm="${i}" aria-label="${esc(tx("Remove"))}">${svg(ic.x)}</button></span>`).join("");
  }
  function addFiles(list) {
    const err = panel?.querySelector("[data-sp-err]");
    for (const f of list) {
      if (!/^image\//.test(f.type)) { if (err) { err.textContent = tx("Only images (no videos)."); err.hidden = false; } continue; }
      if (f.size > 5 * 1024 * 1024) { if (err) { err.textContent = tx("Each image can be up to 5 MB."); err.hidden = false; } continue; }
      if (files.length >= 6) break;
      files.push({ file: f, url: URL.createObjectURL(f) });
    }
    thumbs();
  }
  function context() {
    const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    return { page: location.pathname + location.search, ua: navigator.userAgent, screen: `${screen.width}×${screen.height}`, viewport: `${innerWidth}×${innerHeight}`,
      lang: window.SCP_LANG, region: window.SCP_REGION, theme: document.documentElement.dataset.theme || "", plan: ent.plan_name || (ent.is_staff ? "staff" : ""),
      app: standalone ? "dock app" : "browser", at: new Date().toISOString() };
  }
  async function send(b) {
    const text = panel.querySelector("[data-sp-text]").value.trim(), err = panel.querySelector("[data-sp-err]");
    b.disabled = true; err.hidden = true; b.textContent = tx("Sending…");
    try {
      const paths = [];
      for (const [i, f] of files.entries()) {
        const ext = (f.file.type.split("/")[1] || "png").replace("jpeg", "jpg").replace(/[^a-z0-9]/g, "");
        const path = `${uid}/${Date.now()}-${i}.${ext}`;
        const { error } = await db.storage.from("feedback").upload(path, f.file, { contentType: f.file.type });
        if (error) throw error;
        paths.push(path);
      }
      const { error } = await db.rpc("feedback_submit", { p_kind: kind, p_message: text, p_images: paths, p_context: { ...context(), ...(kind === "content" ? { wants: sub } : {}) } });
      if (error) throw error;
      files.forEach((f) => URL.revokeObjectURL(f.url)); files = []; draft = "";
      await load().catch(() => {});
      panel.querySelector("[data-sp-body]").innerHTML = `<div class="sp-done"><span>${svg(ic.check)}</span><b>${esc(tx("Thank you! We've got it."))}</b><p class="sp-lead">${esc(tx("You'll see what we do with it in My reports."))}</p></div>`;
    } catch (x) {
      err.textContent = tx(x.message || "Couldn't send it. Try again."); err.hidden = false; b.disabled = false; b.textContent = tx("Send");
    }
  }

  btn.addEventListener("click", () => (panel ? close() : open()));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && panel) close(); });
  document.addEventListener("click", (e) => {
    if (!panel) return;
    if (!panel.contains(e.target) && !btn.contains(e.target)) return close();
    const t = e.target.closest("[data-sp-tab],[data-sp-close],[data-sp-kind],[data-sp-sub],[data-sp-attach],[data-sp-rm],[data-sp-send]");
    if (!t) return;
    if (t.dataset.spTab) { tab = t.dataset.spTab; draw(); }
    else if (t.matches("[data-sp-close]")) close();
    else if (t.dataset.spKind) { kind = t.dataset.spKind; drawReport(panel.querySelector("[data-sp-body]")); }
    else if (t.dataset.spSub) { sub = t.dataset.spSub; panel.querySelectorAll("[data-sp-sub]").forEach((b) => b.setAttribute("aria-pressed", String(b === t))); }
    else if (t.matches("[data-sp-attach]")) panel.querySelector("[data-sp-file]").click();
    else if (t.dataset.spRm) { const [f] = files.splice(Number(t.dataset.spRm), 1); URL.revokeObjectURL(f.url); thumbs(); }
    else if (t.matches("[data-sp-send]")) send(t);
  });
  document.addEventListener("change", (e) => { if (e.target.matches?.("[data-sp-file]")) { addFiles([...e.target.files]); e.target.value = ""; } });
  // paste (⌘V) and drag & drop while the Report tab is open
  document.addEventListener("paste", (e) => {
    if (!panel || tab !== "report") return;
    const imgs = [...(e.clipboardData?.files || [])].filter((f) => /^image\//.test(f.type));
    if (imgs.length) { e.preventDefault(); addFiles(imgs); }
  });
  ["dragover", "dragleave", "drop"].forEach((ev) => document.addEventListener(ev, (e) => {
    if (!panel || tab !== "report" || !panel.contains(e.target) || !e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    panel.classList.toggle("sp-drop", ev === "dragover");
    if (ev === "drop") addFiles([...e.dataTransfer.files]);
  }));

  // ---- the notice presenting it (once per account, accounts from before the launch) --------------------------
  const { data: prof } = await db.from("profiles").select("created_at,preferences,newsletter,newsletter_frequency").eq("id", uid).single();
  const tourPending = /content-library\.html$/.test(location.pathname) && (() => { try { return !localStorage.getItem("scp-library-tour"); } catch { return false; } })();
  const force = new URLSearchParams(location.search).has("support-intro");   // to check how it looks: ?support-intro
  if (force || (prof && !prof.preferences?.support_intro_seen && prof.created_at < RELEASE && !tourPending)) setTimeout(() => {
    if (document.getElementById("scp-device-wall") || document.querySelector(".sp-intro")) return;
    const w = document.createElement("div");
    w.className = "sp-intro";
    const feat = (i, t, d) => `<div class="sp-feat"><span>${svg(i)}</span><div><b>${esc(tx(t))}</b><p>${esc(tx(d))}</p></div></div>`;
    w.innerHTML = `<div class="sp-card" role="dialog" aria-modal="true" aria-labelledby="sp-intro-h">
      <div class="sp-hero" aria-hidden="true"><span class="sp-mini"><span class="sp-tile">${svg(ic.life)}</span>${esc(tx("Support & what's new"))}</span></div>
      <div class="sp-cbody"><span class="sp-eyebrow">${esc(tx("New"))}</span>
      <h2 id="sp-intro-h">${esc(tx("Talk to us without leaving"))} <em>SCP</em></h2>
      <p class="sp-sub">${esc(tx("Bottom left you now have a button to talk to us without leaving SCP:"))}</p>
      <div class="sp-feats">${feat(ic.news, "What's new", "the improvements we've made in the last few days.")}${feat(ic.bug, "Report", "tell us about a bug or suggest an improvement, with screenshots.")}${feat(ic.list, "My reports", "see how each one is going and our reply.")}</div>
      <button type="button" class="sp-send" data-intro-go>${esc(tx("Take a look"))}</button><button type="button" class="sp-later" data-intro-ok>${esc(tx("Got it"))}</button></div></div>`;
    document.body.appendChild(w);
    const done = (go) => {
      w.remove();
      if (!force && prof) db.rpc("update_my_preferences", { p_preferences: { ...(prof.preferences || {}), support_intro_seen: new Date().toISOString() }, p_newsletter: prof.newsletter, p_frequency: prof.newsletter_frequency || "weekly" }).then(() => {}, () => {});
      if (go) open();
    };
    w.querySelector("[data-intro-go]").onclick = () => done(true);
    w.querySelector("[data-intro-ok]").onclick = () => done(false);
    w.addEventListener("click", (e) => { if (e.target === w) done(false); });
    document.addEventListener("keydown", function k(e) { if (e.key === "Escape" && document.body.contains(w)) { done(false); document.removeEventListener("keydown", k); } });
  }, 1500);
})();
