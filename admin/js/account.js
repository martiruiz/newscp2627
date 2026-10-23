// SCP Admin — Account: profile details and password change.
(async () => {
  const A = window.SCPA;
  const { $, $$, esc, icon } = A;
  let me;
  try { me = await A.boot("account"); } catch { return; }
  const main = $("[data-main]");
  const u = me.session.user;
  const pw = (name, label, auto) => `
    <label class="field"><span class="label label-caps">${label}</span>
      <span class="pw-wrap"><input class="input" type="password" name="${name}" autocomplete="${auto}"><button class="icon-btn" type="button" data-show aria-label="Show password">${icon("eye")}</button></span></label>`;

  // a little line icon (Lucide shapes) for the cards and the facts
  const ic = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const I = {
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
  };
  const role = (me.profile.role || "user").toLowerCase();
  const name = [me.profile.first_name, me.profile.last_name].filter(Boolean).join(" ") || u.email.split("@")[0];
  const initials = String(name).trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const photo = me.profile.avatar_url || u.user_metadata?.avatar_url || "";   // the profile photo (site → My profile), else initials
  const fact = (i, k, v) => `<div class="ac-fact"><span class="ac-fact-ic">${ic(I[i])}</span><span><small>${k}</small><b>${v}</b></span></div>`;

  main.innerHTML = `
    <div class="page-head"><div><h1>Account</h1><p>Manage your admin account settings</p></div></div>
    <div class="ac">
      <section class="ac-card ac-hero">
        <span class="ac-avatar">${photo ? `<img src="${esc(photo)}" alt="">` : esc(initials)}</span>
        <div class="ac-who"><b>${esc(name)}</b><span>${esc(u.email)}</span></div>
        <span class="ac-role${role === "superadmin" ? " is-super" : ""}">${ic(I.shield)}${esc(role === "superadmin" ? "Superadmin" : role === "admin" ? "Admin" : role)}</span>
        <div class="ac-facts">
          ${fact("cal", "Created", A.fmtDate(me.profile.created_at || u.created_at, false))}
          ${fact("clock", "Last sign in", A.fmtDateTime(u.last_sign_in_at))}
        </div>
      </section>
      <section class="ac-card">
        <div class="ac-head"><span class="ac-head-ic">${ic(I.key)}</span><div><h2>Change password</h2><p>Update your login password</p></div></div>
        <form class="ac-form" novalidate data-pw>
          ${pw("current", "Current password", "current-password")}
          <p class="hint">Leave it empty if you've always logged in with an email link.</p>
          <div class="ac-two">
            <div>${pw("next", "New password", "new-password")}
              <div class="ac-meter" data-meter><i></i><i></i><i></i><i></i></div><p class="hint" data-meter-txt>Minimum 8 characters</p></div>
            <div>${pw("confirm", "Confirm new password", "new-password")}<p class="hint" data-match></p></div>
          </div>
          <p data-msg hidden></p>
          <div><button class="btn btn-primary" type="submit">Update password</button></div>
        </form>
      </section>
    </div>`;

  // how strong the new password is (length, upper + lower, numbers, symbols) and whether both match
  const f0 = $("[data-pw]");
  const check = () => {
    const v = f0.next.value;
    const score = !v ? 0 : [v.length >= 8, /[a-z]/.test(v) && /[A-Z]/.test(v), /\d/.test(v), /[^A-Za-z0-9]/.test(v) || v.length >= 14].filter(Boolean).length;
    $("[data-meter]").dataset.score = score;
    $("[data-meter-txt]").textContent = !v ? "Minimum 8 characters" : v.length < 8 ? "Too short" : ["Weak", "Weak", "Fair", "Good", "Strong"][score];
    const m = $("[data-match]");
    m.textContent = f0.confirm.value ? (f0.confirm.value === v ? "Passwords match" : "Passwords don't match") : "";
    m.className = `hint${f0.confirm.value ? (f0.confirm.value === v ? " is-ok" : " is-bad") : ""}`;
  };
  f0.next.addEventListener("input", check);
  f0.confirm.addEventListener("input", check);

  $$("[data-show]").forEach((b) => b.addEventListener("click", () => {
    const input = b.previousElementSibling;
    input.type = input.type === "password" ? "text" : "password";
    b.setAttribute("aria-label", input.type === "password" ? "Show password" : "Hide password");
  }));

  $("[data-pw]").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const msg = $("[data-msg]");
    const say = (t, ok) => { msg.textContent = t; msg.className = ok ? "ok-text" : "error-text"; msg.hidden = false; };
    if (f.next.value.length < 8) return say("The new password must have at least 8 characters.");
    if (f.next.value !== f.confirm.value) return say("The new passwords don't match.");
    const btn = $("button[type=submit]", f);
    btn.disabled = true;
    try {
      if (f.current.value) {
        const { error } = await A.db.auth.signInWithPassword({ email: u.email, password: f.current.value });
        if (error) throw new Error("The current password is not correct.");
      }
      const { error } = await A.db.auth.updateUser({ password: f.next.value });
      if (error) throw error;
      f.reset();
      say("Password updated.", true);
    } catch (err) { say(A.errMsg(err)); }
    finally { btn.disabled = false; }
  });
})();
