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

  const ready = () => {
    const email = document.querySelector("[data-user-email]");
    if (email) email.textContent = session.user.email;
    document.querySelectorAll("[data-logout]").forEach((b) =>
      b.addEventListener("click", async () => {
        await auth.client.auth.signOut();
        location.href = "index.html";
      })
    );
    auth.getProfile().then((r) => {
      const role = r?.profile?.role;
      if (role === "admin" || role === "superadmin") {
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
