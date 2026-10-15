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

  main.innerHTML = `
    <div class="page-head"><div><h1>Account</h1><p>Manage your admin account settings</p></div></div>
    <div class="stack" style="max-width:640px">
      <section class="panel panel-pad">
        <h2>Profile</h2><p class="panel-sub">Your account details</p>
        <dl class="kv" style="margin-top:16px">
          <dt>Email</dt><dd>${esc(u.email)}</dd>
          <dt>Role</dt><dd><span class="tag">ROLE_${esc((me.profile.role || "user").toUpperCase())}</span></dd>
          <dt>Created</dt><dd>${A.fmtDate(me.profile.created_at || u.created_at, false)}</dd>
          <dt>Last sign in</dt><dd>${A.fmtDateTime(u.last_sign_in_at)}</dd>
        </dl>
      </section>
      <section class="panel panel-pad">
        <h2>Change password</h2><p class="panel-sub">Update your login password</p>
        <form style="display:grid;gap:14px;margin-top:16px" novalidate data-pw>
          ${pw("current", "Current password", "current-password")}
          <p class="hint" style="margin-top:-8px">Leave it empty if you've always logged in with an email link.</p>
          ${pw("next", "New password", "new-password")}
          <p class="hint" style="margin-top:-8px">Minimum 8 characters</p>
          ${pw("confirm", "Confirm new password", "new-password")}
          <p data-msg hidden></p>
          <div><button class="btn btn-primary" type="submit">Update password</button></div>
        </form>
      </section>
    </div>`;

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
