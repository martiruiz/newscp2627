// Sign-up & log-in pages (Supabase auth: Google OAuth + email magic link)
(() => {
  const auth = window.SCP_AUTH;
  const mode = document.body.dataset.authMode || "signup"; // "signup" | "login"
  const params = new URLSearchParams(location.search);
  const plan = ["monthly", "yearly"].includes(params.get("plan")) ? params.get("plan") : "";
  const users = Math.min(Math.max(parseInt(params.get("users"), 10) || 1, 1), 8);
  const status = document.querySelector("[data-auth-status]");
  // Only allow returning to a page of this site (e.g. ?next=content-library.html)
  const next = /^[a-z0-9-]+\.html$/i.test(params.get("next") || "") ? params.get("next") : "";
  const redirectUrl = next ? auth?.pageUrl(next) : auth?.afterLoginUrl;

  const setStatus = (text, kind) => {
    status.className = `form-status ${kind}`;
    status.textContent = text;
  };

  // Show the plan picked on the pricing cards
  const summary = document.querySelector("[data-plan-summary]");
  if (plan && summary) {
    const prices = { monthly: 39, yearly: 32 };
    const label = plan === "monthly" ? "Monthly" : "Yearly";
    summary.innerHTML = `Selected plan: <b>${label}</b> · ${users} user${users > 1 ? "s" : ""} · €${prices[plan] * users}/mo`;
    summary.hidden = false;
  }

  if (!auth?.ready) {
    setStatus("Sign-up isn't connected yet (Supabase keys missing in js/config.js).", "err");
  }

  // Already logged in → go straight to the platform
  auth?.client?.auth.getSession().then(({ data: { session } }) => {
    if (session && mode === "login") location.href = redirectUrl;
  });

  // Google
  document.querySelector("[data-google-signup]").addEventListener("click", async () => {
    if (!auth?.ready) return;
    const { error } = await auth.client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectUrl },
    });
    if (error) setStatus(error.message, "err");
  });

  // Email magic link
  const form = document.querySelector("[data-signup-form]");
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
    form.reset();
  });
  form.addEventListener("input", (e) => e.target.classList.remove("is-invalid"));
})();
