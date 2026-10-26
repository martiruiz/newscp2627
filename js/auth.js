// Shared Supabase client. Requires supabase-js (UMD) and js/config.js loaded first.
// A feature the member's plan doesn't include ("ai" or "planner"): the plan that adds it — from Library, the plan with that
// feature: always Pro (all_access; the old Library + AI / Library + Content Plan are archived) — on the pricing page, marked and scrolled to.
// Superadmin → "View as" a plan (js/guard.js): the pages that depend on the plan (library AI, Content Plan) read the
// member's entitlements through SCP_entitlements(), which then answers as that plan would. Only for staff; the data the
// database lets them read doesn't change, only what the pages show and lock.
const VIEW_AS_PLANS = {
  // the plans on sale now (pricing): Starter, Content Creator and Pro; Library + AI is gone
  none: { name: "No plan (not a client)", ai: false, planner: false, units: 0, library: false },   // signed up, never paid / trial over
  library: { name: "Starter", ai: false, planner: false, units: 0, perms: [] },
  library_planner: { name: "Content Creator", ai: false, planner: true, units: 0, perms: ["library.creators"] },
  all_access: { name: "Pro", ai: true, planner: true, units: 30, perms: ["library.creators", "library.matchday", "library.brands"] },
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
