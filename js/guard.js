// Protects platform pages: only logged-in users can see them.
// Note: this hides the page in the browser; real data protection comes from Supabase RLS.
(async () => {
  const auth = window.SCP_AUTH;
  const here = location.pathname.split("/").pop() || "index.html";
  const toLogin = () => location.replace(`login.html?next=${encodeURIComponent(here)}`);

  if (!auth?.ready) return toLogin();
  const { data: { session } } = await auth.client.auth.getSession();
  if (!session) return toLogin();

  document.documentElement.classList.remove("auth-checking");

  // Nav: show the member's name (falls back to the email's first part) + initials, linking to profile.html
  function setUser(profile, email) {
    const full = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
    const name = full || email.split("@")[0];
    const initials = (full ? full.split(/\s+/).slice(0, 2).map((w) => w[0]) : [name[0]]).join("").toUpperCase();
    document.querySelectorAll("[data-user-name]").forEach((el) => (el.textContent = name));
    document.querySelectorAll("[data-user-initials]").forEach((el) => (el.textContent = initials));
    document.querySelectorAll("[data-user-link]").forEach((el) => (el.title = `${email} — My profile`));
    if (document.querySelector("[data-profile-title]") && full) document.querySelector("[data-profile-title]").textContent = full;
  }
  window.SCP_SET_USER = setUser;
  // Profile photo replaces the initials wherever they're shown
  function setAvatar(url) {
    document.querySelectorAll(".nav-avatar, .pf-avatar").forEach((el) => {
      el.style.backgroundImage = url ? `url("${url}")` : "";
      el.classList.toggle("has-photo", Boolean(url));
    });
  }
  window.SCP_SET_AVATAR = setAvatar;

  const ready = () => {
    setUser(null, session.user.email);
    document.querySelectorAll("[data-logout]").forEach((b) =>
      b.addEventListener("click", async () => {
        await auth.client.auth.signOut();
        location.href = "index.html";
      })
    );
    auth.getProfile().then((r) => {
      setUser(r?.profile, session.user.email);
      setAvatar(r?.profile?.avatar_url || session.user.user_metadata?.avatar_url);
      const role = r?.profile?.role;
      if (role === "superadmin") {
        document.querySelectorAll("[data-admin-link]").forEach((a) => (a.hidden = false));
      }
    });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
  else ready();

  // Logged out in another tab → leave
  auth.client.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") toLogin();
  });
})();
