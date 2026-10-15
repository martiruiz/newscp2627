// SCP Admin — Users: who can access the admin panel.
// Admin access is the "role" of a website account (profiles table). Superadmins can give or remove it.
// A new person gets an email with a login link; they can set a password later on the Account page.
(async () => {
  const A = window.SCPA;
  const { $, esc, icon, num, rpc } = A;
  let me;
  try { me = await A.boot("users"); } catch { return; }
  const isSuper = me.profile.role === "superadmin";
  const main = $("[data-main]");

  main.innerHTML = `
    <div class="page-head"><div><h1>Users</h1><p>Manage admin users who can access the admin panel</p></div></div>
    <div class="stack">
      <section class="panel panel-pad">
        <h2>Create new admin</h2>
        <p class="panel-sub">New users get the <span class="mono">admin</span> role by default${isSuper ? "" : " — only a superadmin can add or remove admins"}.</p>
        <form style="display:grid;gap:12px;margin-top:16px" novalidate data-create>
          <label class="field"><span class="label label-caps">Email</span><input class="input" type="email" name="email" placeholder="admin@example.com" required ${isSuper ? "" : "disabled"}></label>
          <label class="field"><span class="label label-caps">Role</span>
            <select class="select" name="role" ${isSuper ? "" : "disabled"}><option value="admin">admin</option><option value="superadmin">superadmin</option></select></label>
          <p class="hint">If the person doesn't have an account yet, they'll receive an email with a login link. They can set a password afterwards on the Account page.</p>
          <p data-msg hidden></p>
          <button class="btn btn-primary" type="submit" ${isSuper ? "" : "disabled"}>Create user</button>
        </form>
      </section>
      <section class="panel">
        <div class="values-head" style="justify-content:space-between"><h2 style="font-size:16px">Admin users</h2><span class="muted" data-count></span></div>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Email</th><th>Roles</th><th>Created</th><th class="td-actions">Actions</th></tr></thead>
          <tbody data-rows><tr><td class="table-empty" colspan="4"><span class="spinner sm"></span> Loading...</td></tr></tbody>
        </table></div>
      </section>
    </div>`;

  async function load() {
    const { data, error } = await A.db.from("profiles").select("id,email,role,created_at").in("role", ["admin", "superadmin"]).order("created_at");
    const body = $("[data-rows]");
    if (error) { body.innerHTML = `<tr><td class="table-empty error-text" colspan="4">${esc(A.errMsg(error))}</td></tr>`; return; }
    $("[data-count]").textContent = `${num(data.length)} user${data.length === 1 ? "" : "s"}`;
    body.innerHTML = data.map((u) => {
      const self = u.id === me.session.user.id;
      return `<tr>
        <td><span class="user-cell"><span class="avatar">${esc((u.email || "?")[0].toUpperCase())}</span>${esc(u.email)}${self ? ' <span class="tag tag-you" style="margin-left:6px">YOU</span>' : ""}</span></td>
        <td><span class="tag">ROLE_${esc(u.role.toUpperCase())}</span></td>
        <td class="td-date">${A.fmtDate(u.created_at, false)}</td>
        <td class="td-actions">${self
          ? `<button class="icon-btn" type="button" disabled title="You cannot delete your own account" aria-label="You cannot delete your own account">${icon("trash")}</button>`
          : `<button class="icon-btn danger" type="button" data-remove="${esc(u.email)}" ${isSuper ? "" : "disabled"} title="Remove admin access" aria-label="Delete user">${icon("trash")}</button>`}</td>
      </tr>`;
    }).join("");
  }

  $("[data-rows]").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-remove]");
    if (!b) return;
    const email = b.dataset.remove;
    const ok = await A.confirmDialog({ title: "Remove admin access?", text: `${esc(email)} won't be able to open the admin panel any more. Their website account is kept.`, confirm: "Remove access", danger: true });
    if (!ok) return;
    try { await rpc("set_admin_role", { p_email: email, p_role: "user" }); A.toast("Admin access removed."); load(); }
    catch (err) { A.toast(A.errMsg(err), "err"); }
  });

  $("[data-create]").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const msg = $("[data-msg]");
    const say = (t, ok) => { msg.textContent = t; msg.className = ok ? "ok-text" : "error-text"; msg.hidden = false; };
    const email = form.email.value.trim().toLowerCase();
    if (!email || !form.email.checkValidity()) return say("Please enter a valid email.");
    const btn = $("button[type=submit]", form);
    btn.disabled = true;
    try {
      let res = await rpc("set_admin_role", { p_email: email, p_role: form.role.value });
      if (!res.found) {
        // No account yet: create it by sending a login link, then give it the role
        const { error } = await A.db.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: new URL("login.html", location.href).href } });
        if (error) throw error;
        res = await rpc("set_admin_role", { p_email: email, p_role: form.role.value });
        if (!res.found) throw new Error("The account was created but its profile isn't ready yet. Try again in a few seconds.");
        say(`Invitation sent to ${email}. They can log in with the link in the email.`, true);
      } else {
        say(`${email} now has ${form.role.value} access.`, true);
      }
      form.reset();
      load();
    } catch (err) {
      say(/rate limit/i.test(err.message) ? "Too many emails sent in a short time. Try again later." : A.errMsg(err));
    } finally { btn.disabled = false; }
  });

  load();
})();
