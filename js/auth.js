// Shared Supabase client. Requires supabase-js (UMD) and js/config.js loaded first.
// A feature the member's plan doesn't include ("ai" or "planner"): the plan that adds it — from Library, the plan with that
// feature: always Pro (all_access; the old Library + AI / Library + Content Plan are archived) — on the pricing page, marked and scrolled to.
// Superadmin → "View as" a plan (js/guard.js): the pages that depend on the plan (library AI, Content Plan) read the
// member's entitlements through SCP_entitlements(), which then answers as that plan would. Only for staff; the data the
// database lets them read doesn't change, only what the pages show and lock.
const VIEW_AS_PLANS = {
  // the plans on sale now (pricing): Starter, Plus and Pro (AI in all three: 5, 10, 30 a month); Library + AI is gone
  none: { name: "No plan (not a client)", ai: false, planner: false, units: 0, library: false },   // signed up, never paid / trial over
  library: { name: "Starter", ai: true, planner: false, units: 5, perms: ["library.matchday"] },
  library_planner: { name: "Plus", ai: true, planner: true, units: 10, perms: ["library.creators", "library.matchday"] },
  all_access: { name: "Pro", ai: true, planner: true, units: 30, perms: ["library.creators", "library.matchday", "library.brands"] },
  // a My Club client: everything in Pro plus their club (my-club.js and the menu keep the clubs; with the other plans they hide them)
  enterprise: { name: "Enterprise (My Club)", ai: true, planner: true, units: 30, perms: ["library.creators", "library.matchday", "library.brands"], club: true },
};
window.SCP_VIEW_AS_PLANS = VIEW_AS_PLANS;
window.SCP_viewAs = () => { try { const v = localStorage.getItem("scp-view-as"); return VIEW_AS_PLANS[v] ? v : null; } catch { return null; } };
window.SCP_entitlements = async () => {
  const res = await window.SCP_AUTH.client.rpc("my_entitlements");
  const v = window.SCP_viewAs(), p = VIEW_AS_PLANS[v];
  if (!p || !res.data?.is_staff) return res;
  return { ...res, data: { ...res.data, is_staff: false, plan: p.library === false ? null : v, plan_name: p.library === false ? null : p.name, has_library: p.library !== false, has_ai: p.ai, has_planner: p.planner, entitlements: p.perms || [],
    monthly_limit: p.units, monthly_used: 0, monthly_left: p.units, pack_left: 0, viewing_as: v } };
};
window.SCP_upgradeHref = () => "pricing.html?plan=all_access";
window.SCP_AUTH = (() => {
  const config = window.SCP_CONFIG || {};
  const ready = Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase);
  const client = ready ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;

  const pageUrl = (path) => new URL(path, location.href).href;

  // Website language (js/i18n.js): kept in the profile so it follows the member to other devices and sets the
  // language of the e-mails we send. Merges into the saved preferences without touching the rest.
  window.SCP_saveLang = async (lang) => {
    if (!client) return;
    const { data: { session } } = await client.auth.getSession();
    if (!session) return;
    if (session.user.user_metadata?.lang !== lang) client.auth.updateUser({ data: { lang } }).catch(() => {});   // the sign-in emails follow it (supabase/auth-emails)
    const { data: p } = await client.from("profiles").select("preferences,newsletter,newsletter_frequency").eq("id", session.user.id).single();
    if (!p) return;
    await client.rpc("update_my_preferences", { p_preferences: { ...(p.preferences || {}), ui_language: lang }, p_newsletter: p.newsletter, p_frequency: p.newsletter_frequency || "weekly" });
  };

  // one "visit" a day for the lifecycle e-mails (did they come back?): supabase/automations-lifecycle.sql
  if (client) setTimeout(async () => {
    const today = new Date().toISOString().slice(0, 10);
    try { if (localStorage.getItem("scp-visit") === today) return; } catch {}
    const { data: { session } } = await client.auth.getSession();
    if (!session) return;
    const { error } = await client.rpc("track_visit");
    if (!error) try { localStorage.setItem("scp-visit", today); } catch {}
  }, 1500);

  // One account: one phone (or tablet) and one computer at a time (supabase/device-limit.sql). A third device sees a
  // screen saying where the account is open, and can take that place ("disconnect the other one"). Checked on every page
  // and whenever the tab comes back to the front, so the device that lost its place is stopped too.
  const deviceId = (() => { try { let v = localStorage.getItem("scp-device"); if (!v) { v = crypto.randomUUID(); localStorage.setItem("scp-device", v); } return v; } catch { return ""; } })();
  const mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const label = (() => { const u = navigator.userAgent;
    const os = /iPhone/.test(u) ? "iPhone" : /iPad/.test(u) || (mobile && /Macintosh/.test(u)) ? "iPad" : /Android/.test(u) ? "Android" : /Windows/.test(u) ? "Windows" : /Mac/.test(u) ? "Mac" : /Linux/.test(u) ? "Linux" : "";
    const br = /Edg\//.test(u) ? "Edge" : /OPR\//.test(u) ? "Opera" : /Firefox\//.test(u) ? "Firefox" : /Chrome\//.test(u) ? "Chrome" : /Safari\//.test(u) ? "Safari" : "";
    return [os, br].filter(Boolean).join(" · "); })();
  async function deviceCheck(take = false) {
    if (!client || !deviceId) return;
    const { data: { session } } = await client.auth.getSession();
    if (!session) return;
    const { data, error } = await client.rpc("device_check", { p_device: deviceId, p_kind: mobile ? "mobile" : "desktop", p_label: label, p_take: take });
    if (error || !data) return;   // never lock anyone out because of a network or database hiccup
    if (data.ok) { document.getElementById("scp-device-wall")?.remove(); document.documentElement.style.overflow = ""; return; }
    deviceWall(data);
  }
  function deviceWall(d) {
    if (document.getElementById("scp-device-wall")) return;
    const es = window.SCP_LANG !== "en", phone = d.kind === "mobile";
    d.label = String(d.label || "").replace(/[<>&"]/g, "");
    const T = es ? { h: phone ? "Tu cuenta ya está abierta en otro móvil" : "Tu cuenta ya está abierta en otro ordenador",
        p: `Cada cuenta de SCP se puede usar en un móvil y en un ordenador a la vez.${d.label ? ` Ahora está abierta en: <b>${d.label}</b>.` : ""}`,
        take: "Desconectar el otro y entrar aquí", note: "El otro dispositivo se cerrará la próxima vez que se use.", out: "Cerrar sesión" }
      : { h: phone ? "Your account is already open on another phone" : "Your account is already open on another computer",
        p: `Each SCP account can be used on one phone and one computer at a time.${d.label ? ` It's open now on: <b>${d.label}</b>.` : ""}`,
        take: "Disconnect the other one and sign in here", note: "The other device will be signed out the next time it's used.", out: "Sign out" };
    const w = document.createElement("div");
    w.id = "scp-device-wall";
    w.innerHTML = `<style>#scp-device-wall{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:16px;background:rgba(10,15,30,.92);backdrop-filter:blur(8px);font-family:var(--font-body,Inter,system-ui,sans-serif)}
      #scp-device-wall .dw{max-width:440px;width:100%;padding:28px 24px;border-radius:20px;background:#17213b;border:1px solid rgba(240,184,74,.35);color:#fff;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.5)}
      #scp-device-wall .dw-ic{width:52px;height:52px;margin:0 auto 14px;border-radius:14px;display:grid;place-items:center;background:rgba(240,184,74,.15);color:#f0b84a;font-size:26px}
      #scp-device-wall h2{margin:0 0 10px;font:600 20px/1.3 var(--font-display,"Host Grotesk",system-ui,sans-serif)}
      #scp-device-wall p{margin:0 0 18px;color:#b4c0d3;font-size:14.5px;line-height:1.5} #scp-device-wall p b{color:#fff}
      #scp-device-wall button{display:block;width:100%;min-height:48px;border:0;border-radius:999px;font:600 15px var(--font-body,Inter,system-ui,sans-serif);cursor:pointer}
      #scp-device-wall .dw-take{background:linear-gradient(135deg,#ffe0a0,#f0b84a);color:#121b33}
      #scp-device-wall .dw-out{margin-top:10px;background:transparent;color:#b4c0d3;text-decoration:underline}
      #scp-device-wall small{display:block;margin-top:10px;color:#b4c0d3;font-size:12.5px}</style>
      <div class="dw" role="dialog" aria-modal="true" aria-labelledby="scp-dw-h"><div class="dw-ic">${phone ? "📱" : "💻"}</div><h2 id="scp-dw-h">${T.h}</h2><p>${T.p}</p>
      <button type="button" class="dw-take">${T.take}</button><small>${T.note}</small><button type="button" class="dw-out">${T.out}</button></div>`;
    document.documentElement.style.overflow = "hidden";
    document.body.appendChild(w);
    w.querySelector(".dw-take").onclick = (e) => { e.target.disabled = true; deviceCheck(true); };
    w.querySelector(".dw-out").onclick = async () => { await client.auth.signOut(); location.href = "index.html"; };
  }
  if (client) {
    if (document.body) deviceCheck(); else document.addEventListener("DOMContentLoaded", () => deviceCheck());
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") deviceCheck(); });
  }

  return {
    ready,
    client,
    afterLoginUrl: pageUrl(config.afterLoginPath || "content-library.html"),
    pageUrl,
    async getProfile() {
      if (!client) return null;
      const { data: { session } } = await client.auth.getSession();
      if (!session) return null;
      const { data } = await client.from("profiles").select("*").eq("id", session.user.id).single();
      return { session, profile: data };
    },
  };
})();
