// Shared Supabase client. Requires supabase-js (UMD) and js/config.js loaded first.
window.SCP_AUTH = (() => {
  const config = window.SCP_CONFIG || {};
  const ready = Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase);
  const client = ready ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;

  const pageUrl = (path) => new URL(path, location.href).href;

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
