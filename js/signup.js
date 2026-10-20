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

  // Already logged in → go straight to the platform
  auth?.client?.auth.getSession().then(({ data: { session } }) => {
    if (session && mode === "login") location.href = redirectUrl;
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
  let usePassword = false;
  pwToggle?.addEventListener("click", () => {
    usePassword = !usePassword;
    pwField.hidden = !usePassword;
    pwField.querySelector("input").required = usePassword;
    document.querySelector("[data-submit-label]").textContent = usePassword ? "Log in" : "Send me a login link";
    pwToggle.textContent = usePassword ? "Email me a login link instead" : "Log in with a password instead";
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
