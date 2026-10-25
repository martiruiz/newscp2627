// Lead-magnet landing pages: name + email → newsletter_signups (same table and RLS as the home pop-up and the footer),
// then the download button appears. Config on the form: data-resource (what was promised), data-source (where from).
(function () {
  const cfg = window.SCP_CONFIG || {};
  const CONSENT = "Send me the free resource and the SCP newsletter. I can unsubscribe at any time.";
  const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  document.querySelectorAll("[data-lm-form]").forEach((form) => {
    const card = form.closest("[data-lm-card]") || form.parentElement;
    const done = card.querySelector("[data-lm-done]");
    const msg = form.querySelector("[data-lm-msg]");
    const say = (t) => { msg.textContent = t; msg.hidden = !t; };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      say("");
      const first = form.first_name.value.trim().slice(0, 80);
      const email = form.email.value.trim();
      if (!first) { say("Please tell us your first name."); return form.first_name.focus(); }
      if (!EMAIL.test(email) || email.length > 254) { say("Please enter a valid email."); return form.email.focus(); }
      if (!form.consent.checked) return say("Please tick the box so we can send you the resource.");
      if (!cfg.supabaseUrl) return say("Something went wrong. Please try again in a moment.");

      const btn = form.querySelector("button[type=submit]");
      btn.disabled = true;
      try {
        const res = await fetch(`${cfg.supabaseUrl}/rest/v1/newsletter_signups`, {
          method: "POST",
          headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({
            email, first_name: first,
            source: (form.dataset.source || "resource").slice(0, 40),
            resource: (form.dataset.resource || "").slice(0, 80) || null,
            lang: "en", consent: true, consent_text: CONSENT,
          }),
        });
        if (!res.ok && res.status !== 409) throw new Error(String(res.status));   // 409 = already on the list: they still get the file
        done.querySelector("[data-lm-name]").textContent = first;
        form.hidden = true;
        card.querySelectorAll("[data-lm-intro]").forEach((n) => (n.hidden = true));
        done.hidden = false;
        done.querySelector("a.btn")?.focus();
      } catch {
        say("Something went wrong. Please try again in a moment.");
      } finally { btn.disabled = false; }
    });
  });
})();
