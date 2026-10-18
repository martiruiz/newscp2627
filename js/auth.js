// Shared Supabase client. Requires supabase-js (UMD) and js/config.js loaded first.
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
