// Sign-up & log-in pages (Supabase auth: Google OAuth + email magic link)
(() => {
  const auth = window.SCP_AUTH;
  const mode = document.body.dataset.authMode || "signup"; // "signup" | "login"
  const params = new URLSearchParams(location.search);
  const PLAN_NAMES = { library: "Library", library_planner: "Library + Content Plan", library_ai: "Library + AI", all_access: "All Access" };
  const plan = PLAN_NAMES[params.get("plan")] ? params.get("plan") : "";
  const users = Math.min(Math.max(parseInt(params.get("users"), 10) || 1, 1), 8);
  const status = document.querySelector("[data-auth-status]");
  // Only allow returning to a page of this site (e.g. ?next=content-library.html)
  const next = /^[a-z0-9-]+\.html$/i.test(params.get("next") || "") ? params.get("next") : "";
  const redirectUrl = next ? auth?.pageUrl(next) : auth?.afterLoginUrl;

  const setStatus = (text, kind) => {
    status.className = `form-status ${kind}`;
    status.textContent = text;
  };

  // Plan picked on the pricing cards: the payment continues by itself after signing up (js/checkout.js)
  const interval = params.get("interval") === "year" ? "year" : "month";
  if (plan && mode === "signup") {
    try { if (!localStorage.getItem("scp-checkout")) localStorage.setItem("scp-checkout", JSON.stringify({ req: { kind: "plan", plan, interval }, at: Date.now() })); } catch {}
  }
  // Show the plan picked on the pricing cards
  const summary = document.querySelector("[data-plan-summary]");
  if (plan && summary) {
    summary.innerHTML = `Selected plan: <b>${PLAN_NAMES[plan]}</b> · ${interval === "year" ? "yearly" : "monthly"} · 7-day free trial`;
    summary.hidden = false;
  }

  if (!auth?.ready) {
    setStatus("Sign-up isn't connected yet (Supabase keys missing in js/config.js).", "err");
  }

  // Password recovery: the link from "Forgot your password?" opens this page signed in for that purpose only — first a
  // new password, then the platform (login.html?reset=1, or Supabase's PASSWORD_RECOVERY event)
  let recovering = mode === "login" && (params.get("reset") === "1" || /type=recovery/.test(location.hash));
  const resetForm = document.querySelector("[data-reset-form]");
  const showReset = () => {
    recovering = true;
    if (!resetForm) return;
    document.querySelector("[data-signup-form]").hidden = true;
    document.querySelectorAll(".auth-or, .auth-google, .auth-switch, .auth-signed").forEach((el) => (el.hidden = true));
    const h = document.querySelector(".auth h1"); if (h) h.innerHTML = `${tx("Set your")} <span class="gold">${tx("password")}</span>`;
    resetForm.hidden = false; resetForm.password.focus();
  };
  auth?.client?.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY") showReset(); });
  if (recovering) auth?.client?.auth.getSession().then(({ data: { session } }) => { if (session) showReset(); else setStatus("This link has expired. Ask for a new one below.", "err"); });
  resetForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = resetForm.password.value, pw2 = resetForm.password2.value;
    if (pw.length < 8) return setStatus("Use at least 8 characters.", "err");
    if (pw !== pw2) return setStatus("The two passwords don't match.", "err");
    const btn = resetForm.querySelector("[type=submit]"); btn.disabled = true;
    const { error } = await auth.client.auth.updateUser({ password: pw });
    btn.disabled = false;
    if (error) return setStatus(/same|different/i.test(error.message) ? "Choose a different password from your current one." : error.message, "err");
    setStatus("Password saved. Taking you to the platform…", "ok");
    setTimeout(() => (location.href = redirectUrl), 900);
  });

  // Already logged in: the log-in form still shows (to enter with another email or a password); a note offers to
  // continue to the platform or to log out first
  auth?.client?.auth.getSession().then(({ data: { session } }) => {
    if (!session || mode !== "login" || recovering) return;
    const card = document.querySelector(".auth-card");
    if (!card || card.querySelector(".auth-signed")) return;
    const t = (x, v) => (window.tx ? window.tx(x, v) : x.replace("{email}", v?.email || ""));
    card.insertAdjacentHTML("afterbegin", `<p class="auth-signed">${t("You're signed in as {email}.", { email: session.user.email })}
      <a class="link-gold" href="${redirectUrl}">${t("Go to the platform →")}</a> · <button type="button" class="auth-signout" data-auth-signout>${t("Log out")}</button></p>`);
    card.querySelector("[data-auth-signout]").addEventListener("click", async () => {
      await auth.client.auth.signOut();
      card.querySelector(".auth-signed")?.remove();
    });
  });

  // Google. Supabase only accepts it once the provider is switched on (Authentication → Providers → Google);
  // until then, say so here instead of sending people to Supabase's raw error page.
  const googleBtn = document.querySelector("[data-google-signup]");
  const cfg = window.SCP_CONFIG || {};
  const googleOn = fetch(`${cfg.supabaseUrl}/auth/v1/settings`, { headers: { apikey: cfg.supabaseAnonKey } })
    .then((r) => r.json()).then((j) => j?.external?.google === true).catch(() => true);
  googleBtn.addEventListener("click", async () => {
    if (!auth?.ready) return;
    googleBtn.disabled = true;
    if (!(await googleOn)) {
      googleBtn.disabled = false;
      setStatus(tx("Google sign-in isn't available yet. Please continue with your email."), "err");
      document.querySelector("[data-signup-form]")?.email?.focus();
      return;
    }
    const { error } = await auth.client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectUrl },
    });
    googleBtn.disabled = false;
    if (error) setStatus(error.message, "err");
  });

  // Email magic link (or password on the login page)
  const form = document.querySelector("[data-signup-form]");
  const pwField = document.querySelector("[data-password-field]");
  const pwToggle = document.querySelector("[data-password-toggle]");
  // Log in = email + password only (no login links). Sign up still confirms the email with a link.
  const usePassword = mode === "login";
  // "Forgot your password?": an email to set a new one (also for accounts that never had a password)
  document.querySelector("[data-forgot]")?.addEventListener("click", async (e) => {
    const email = form.email.value.trim();
    if (!form.email.checkValidity() || !email) { form.email.classList.add("is-invalid"); form.email.focus(); return setStatus("Write your email above and we'll send you a link to set a new password.", "err"); }
    e.currentTarget.disabled = true;
    const { error } = await auth.client.auth.resetPasswordForEmail(email, { redirectTo: auth.pageUrl("login.html?reset=1") });
    e.currentTarget.disabled = false;
    if (error) return setStatus(/rate limit/i.test(error.message) ? "Too many emails sent in a short time. Please check your inbox or try again later." : error.message, "err");
    setStatus("Check your inbox — we've sent you a link to set a new password.", "ok");
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    let ok = true;
    form.querySelectorAll("input[required]").forEach((input) => {
      const valid = input.checkValidity() && input.value.trim();
      input.classList.toggle("is-invalid", !valid);
      if (!valid) ok = false;
    });
    if (!ok) {
      setStatus(mode === "login" ? "Please enter a valid email." : "Please fill in your name and a valid email.", "err");
      return;
    }
    if (!auth?.ready) return;

    const fields = Object.fromEntries(new FormData(form));
    const button = form.querySelector("[type=submit]");
    button.disabled = true;
    if (usePassword) {
      const { error: pwError } = await auth.client.auth.signInWithPassword({ email: fields.email.trim(), password: fields.password });
      button.disabled = false;
      if (pwError) return setStatus("Wrong email or password.", "err");
      location.href = redirectUrl;
      return;
    }
    const { error } = await auth.client.auth.signInWithOtp({
      email: fields.email.trim(),
      options: {
        emailRedirectTo: redirectUrl,
        shouldCreateUser: mode === "signup",
        data: mode === "signup"
          ? { first_name: fields.first_name?.trim(), last_name: fields.last_name?.trim(), plan, users: plan ? users : null }
          : undefined,
      },
    });
    button.disabled = false;
    if (error) {
      let msg = error.message;
      if (/rate limit/i.test(msg)) msg = "Too many emails sent in a short time. Please check your inbox or try again later.";
      else if (mode === "login" && /signups not allowed|not found/i.test(msg)) msg = "We couldn't find an account with that email. Sign up first.";
      setStatus(msg, "err");
      return;
    }
    setStatus("Check your inbox — we've sent you a link to continue.", "ok");
    if (mode === "signup") window.SCP_TRACK?.("free_trial_started", { step: "signup" });   // js/lead-flow.js (no personal data)
    form.reset();
  });
  form.addEventListener("input", (e) => e.target.classList.remove("is-invalid"));
})();
