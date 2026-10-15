// Site configuration.
// Supabase: Dashboard → Project Settings → API.
// The anon/publishable key is meant to be public — never put the service_role key here.
window.SCP_CONFIG = {
  supabaseUrl: "https://wppdbomtiliutpxsimtp.supabase.co",
  supabaseAnonKey: "sb_publishable_oq57pA0ZaavEQPDBYeWH-w_TRybCb05",

  // Where users land after signing up or logging in
  afterLoginPath: "content-library.html",

  // Home dock: company LinkedIn page (the LinkedIn button is hidden while this is empty)
  linkedinUrl: "https://www.linkedin.com/company/sportscontentplaybook",
  // Newsletter lead magnet: if a file / page URL is set, the pop-up offers it to download right after signing up
  newsletterResourceUrl: "",
};
