// Free resources from the admin (table "resources", supabase/resources.sql). Resolves to the published rows, or [] if the
// table isn't there yet / the request fails — the pages keep their built-in content in that case.
window.SCP_RESOURCES = (async () => {
  const cfg = window.SCP_CONFIG || {};
  try {
    const r = await fetch(`${cfg.supabaseUrl}/rest/v1/resources?select=slug,title,description,bullets,status,cover_url,file_url,landing_url,sort&published=eq.true&order=sort.asc,created_at.asc`,
      { headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}` } });
    return r.ok ? await r.json() : [];
  } catch { return []; }
})();
window.SCP_RES_ESC = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
window.SCP_RES_LANDING = (r) => r.landing_url || `resource.html?r=${encodeURIComponent(r.slug)}`;
