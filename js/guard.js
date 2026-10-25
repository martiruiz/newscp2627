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
    // a superadmin last time: Admin and "View as" straight away, so the menu doesn't jump when the profile arrives
    const wasSuper = (() => { try { return localStorage.getItem("scp-superadmin") === "1"; } catch { return false; } })();
    if (wasSuper) { document.querySelectorAll("[data-admin-link]").forEach((a) => (a.hidden = false)); viewAsSwitch(); }
    auth.getProfile().then((r) => {
      setUser(r?.profile, session.user.email);
      setAvatar(r?.profile?.avatar_url || session.user.user_metadata?.avatar_url);
      window.SCP_applyProfileLang?.(r?.profile?.preferences?.ui_language);   // website language saved in the profile (js/i18n.js)
      const role = r?.profile?.role;
      if (role === "superadmin") {
        document.querySelectorAll("[data-admin-link]").forEach((a) => (a.hidden = false));
        viewAsSwitch();
        try { localStorage.setItem("scp-superadmin", "1"); } catch {}
      } else {
        try { localStorage.removeItem("scp-view-as"); localStorage.removeItem("scp-superadmin"); } catch {}
        if (wasSuper) { document.querySelectorAll("[data-admin-link]").forEach((a) => (a.hidden = true)); document.querySelector(".view-as")?.remove(); document.querySelector("[data-view-as-bar]")?.remove(); }
      }
    });
  };
  // Superadmin: "View as" a plan — the platform as a member of that plan sees it (locks and notices included).
  // Saved in this browser (js/auth.js SCP_entitlements); a bar at the bottom says it's on and turns it off.
  function viewAsSwitch() {
    const T = (t) => (window.tx ? window.tx(t) : t);
    const plans = window.SCP_VIEW_AS_PLANS || {}, cur = window.SCP_viewAs?.() || "";
    const link = document.querySelector("[data-admin-link]");
    if (link && !document.querySelector("[data-view-as]")) {
      link.insertAdjacentHTML("beforebegin", `<label class="view-as" title="${T("See the platform as each plan sees it")}"><span>${T("View as")}</span>
        <select data-view-as><option value="">${T("Superadmin")}</option>${Object.entries(plans).map(([k, p]) => `<option value="${k}"${k === cur ? " selected" : ""}>${T(p.name)}</option>`).join("")}</select></label>`);
      document.querySelector("[data-view-as]").addEventListener("change", (e) => {
        try { e.target.value ? localStorage.setItem("scp-view-as", e.target.value) : localStorage.removeItem("scp-view-as"); } catch {}
        location.reload();
      });
    }
    if (cur && !document.querySelector("[data-view-as-bar]")) {
      document.body.insertAdjacentHTML("beforeend", `<div class="view-as-bar" data-view-as-bar>${T("Viewing as")} <b>${T(plans[cur].name)}</b><button type="button" data-view-as-off>${T("Back to superadmin")}</button></div>`);
      document.querySelector("[data-view-as-off]").addEventListener("click", () => { try { localStorage.removeItem("scp-view-as"); } catch {} location.reload(); });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
  else ready();

  // Logged out in another tab → leave
  auth.client.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") toLogin();
  });
})();
