// My profile: edit first / last name (via update_my_profile RPC) and set a password.
(async () => {
  const auth = window.SCP_AUTH;
  if (!auth?.ready) return;
  const r = await auth.getProfile();
  if (!r) return;
  const { session, profile } = r;
  const nameForm = document.querySelector("[data-profile-form]");
  const passForm = document.querySelector("[data-password-form]");
  const say = (el, msg, ok) => { el.textContent = msg; el.className = `form-status ${ok ? "ok" : "err"}`; };

  nameForm.first_name.value = profile?.first_name || "";
  nameForm.last_name.value = profile?.last_name || "";
  nameForm.email.value = session.user.email;
  const plan = document.querySelector("[data-profile-plan]");
  if (profile?.plan || profile?.role === "superadmin") {
    plan.innerHTML = profile.role === "superadmin" ? "Role: <b>Superadmin</b>" : `Plan: <b>${profile.plan}</b>`;
    plan.hidden = false;
  }

  nameForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = nameForm.querySelector("[data-profile-status]");
    const first = nameForm.first_name.value.trim();
    const last = nameForm.last_name.value.trim();
    if (!first) { nameForm.first_name.classList.add("is-invalid"); return say(status, "Please enter your first name."); }
    nameForm.first_name.classList.remove("is-invalid");
    const { error } = await auth.client.rpc("update_my_profile", { p_first_name: first, p_last_name: last });
    if (error) return say(status, `Couldn't save: ${error.message}`);
    say(status, "Saved.", true);
    window.SCP_SET_USER?.({ first_name: first, last_name: last }, session.user.email);
  });

  passForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = passForm.querySelector("[data-password-status]");
    const pw = passForm.password.value;
    if (pw.length < 8) return say(status, "Use at least 8 characters.");
    const { error } = await auth.client.auth.updateUser({ password: pw });
    if (error) return say(status, error.message);
    passForm.reset();
    say(status, "Password updated. You can now log in with it.", true);
  });
})();
