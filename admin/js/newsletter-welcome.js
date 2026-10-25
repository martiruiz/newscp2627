// SCP Admin — Newsletter: edit the welcome email new sign-ups receive, in Spanish and English (email_templates
// "newsletter_welcome", supabase/newsletter-welcome-template.sql; sent by the Edge Function newsletter-welcome).
// Body: paragraphs separated by a blank line, the first one is the headline, {{name}} = first name, [Button](url).
(() => {
  const A = window.SCPA;
  const { $, esc } = A;
  const wait = setInterval(() => { const nl = $("[data-nl]"); if (nl) { clearInterval(wait); start(nl); } }, 200);
  setTimeout(() => clearInterval(wait), 15000);

  // the same look as the email (preview only)
  function preview(subject, body, lang) {
    const name = (t) => t.replace(/\s?\{\{name\}\}/g, " Marta");
    const rows = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p, i) => {
      const b = p.match(/^\[(.+)\]\((https?:\/\/[^)\s]+)\)$/);
      if (b) return `<p style="margin:6px 0 4px"><a style="display:inline-block;padding:14px 26px;border-radius:999px;background:#f0b84a;color:#1a1205;font-weight:700;font-size:15px;text-decoration:none">${esc(name(b[1]))}</a></p>`;
      const t = esc(name(p)).replace(/\n/g, "<br>");
      return i === 0 ? `<p style="color:#fff;font-size:28px;line-height:1.2;font-weight:700;margin:0 0 16px">${t}</p>` : `<p style="color:#b4c0d3;font-size:15px;line-height:1.6;margin:0 0 16px">${t}</p>`;
    }).join("");
    return `<body style="margin:0;background:#0e1529;font-family:Arial,Helvetica,sans-serif;padding:24px 12px">
      <p style="max-width:560px;margin:0 auto 10px;color:#8a97ad;font-size:13px">${esc(subject)}</p>
      <div style="max-width:560px;margin:0 auto;background:#17213b;border:1px solid rgba(240,184,74,.35);border-radius:20px;padding:32px">
        <img src="../assets/logo-scp.png" width="110" alt="" style="display:block;margin-bottom:24px">
        <p style="color:#f0b84a;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;margin:0 0 10px">${lang === "es" ? "Bienvenido a la newsletter" : "Welcome to the newsletter"}</p>${rows}</div></body>`;
  }

  async function start(nl) {
    nl.insertAdjacentHTML("afterend", `<section class="panel panel-pad nlw" data-nlw><p class="muted">Loading…</p></section>`);
    const box = $("[data-nlw]");
    let list = [];
    try { list = ((await A.db.rpc("admin_email_templates")).data?.templates || []).filter((t) => t.key === "newsletter_welcome"); } catch {}
    if (!list.length) { box.innerHTML = `<h2>Welcome email</h2><p class="muted">Run supabase/newsletter-welcome-template.sql in Supabase to edit it here.</p>`; return; }
    let lang = "es";
    const draw = () => {
      const t = list.find((x) => x.locale === lang) || { subject: "", body: "", enabled: true };
      box.innerHTML = `<div class="nlw-head"><div><h2>Welcome email</h2><p class="muted">What new newsletter sign-ups receive, in the language they signed up in.</p></div>
          <div class="ms-loc">${["es", "en"].map((l) => `<button type="button" data-nlw-lang="${l}" aria-selected="${l === lang}">${l === "es" ? "Español" : "English"}</button>`).join("")}</div></div>
        <div class="nlw-grid"><form class="nlw-form" data-nlw-form>
            <label class="field"><span class="label">Subject</span><input class="input" name="subject" value="${esc(t.subject)}" maxlength="150"></label>
            <label class="field"><span class="label">Body</span><textarea class="textarea" name="body" rows="12">${esc(t.body)}</textarea></label>
            <p class="hint">Blank line = new paragraph · the first one is the headline · {{name}} = first name (left out if there's none) · [Button text](https://…) = button</p>
            <label class="ms-check"><input type="checkbox" name="enabled"${t.enabled ? " checked" : ""}> Send the welcome email</label>
            <div><button class="btn btn-primary" type="submit">Save</button></div>
          </form>
          <iframe class="nlw-preview" title="Preview" data-nlw-frame></iframe></div>`;
      const f = $("[data-nlw-form]", box), fr = $("[data-nlw-frame]", box);
      const paint = () => { fr.srcdoc = preview(f.subject.value, f.body.value, lang); };
      paint();
      f.addEventListener("input", paint);
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = $("button[type=submit]", f); btn.disabled = true;
        const { error } = await A.db.rpc("admin_save_email_template", { p_key: "newsletter_welcome", p_locale: lang, p_subject: f.subject.value.trim(), p_body: f.body.value.trim(), p_enabled: f.enabled.checked });
        btn.disabled = false;
        if (error) return A.toast(A.errMsg(error), "error");
        Object.assign(t, { subject: f.subject.value.trim(), body: f.body.value.trim(), enabled: f.enabled.checked });
        A.toast(lang === "es" ? "Spanish welcome email saved." : "English welcome email saved.");
      });
    };
    box.addEventListener("click", (e) => { const b = e.target.closest("[data-nlw-lang]"); if (b && b.dataset.nlwLang !== lang) { lang = b.dataset.nlwLang; draw(); } });
    draw();
  }
})();
