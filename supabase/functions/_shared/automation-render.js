// Automation e-mails (Admin → Newsletter → Automations): blocks → HTML + plain text, with the contact's variables.
// Shared by the Edge Function automation-send (sending, admin preview and test). Plain JS.
// Blocks: { type: "text", text } · { type: "image", src, alt, href } · { type: "button", label, url } · { type: "divider" } · { type: "footer", text }
// Text: blank line = new paragraph, **bold**, [label](https://…), {{variable}} or {{variable|fallback}}.
// Every e-mail ends with the unsubscribe link (commercial and service alike): it isn't a block that can be removed.
import { day, money, planName } from "./email-render.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ascii = (h) => h.replace(/[^\x00-\x7f]/gu, (c) => `&#${c.codePointAt(0)};`);
const LOGO = "https://sportscontentplaybook.com/assets/logo-scp.png";

export const VARIABLES = ["first_name", "org_name", "trial_end_date", "trial_days_left", "plan_name", "first_charge_amount", "last_payment_amount", "billing_period", "platform_url", "pricing_url", "account_url", "subscription_url", "unsubscribe_url"];
// what a variable becomes when the contact has no value (an author's {{x|fallback}} wins)
const FALLBACK = {
  en: { first_name: "there", org_name: "your club", trial_end_date: "the end of your trial", trial_days_left: "a few", plan_name: "your plan", first_charge_amount: "your plan's price", last_payment_amount: "your plan", billing_period: "" },
  ca: { first_name: "", org_name: "el teu club", trial_end_date: "el final de la prova", trial_days_left: "uns quants", plan_name: "el teu pla", first_charge_amount: "el preu del teu pla", last_payment_amount: "el teu pla", billing_period: "" },
  es: { first_name: "", org_name: "tu club", trial_end_date: "el final de tu prueba", trial_days_left: "unos", plan_name: "tu plan", first_charge_amount: "el precio de tu plan", last_payment_amount: "tu plan", billing_period: "" },
};
const FOOT = {
  en: { why: "You're receiving this because you have a Sports Content Playbook account.", unsub: "Unsubscribe from these e-mails", notice: "This is a notice about your account and subscription." },
  ca: { why: "Reps aquest correu perquè tens un compte a Sports Content Playbook.", unsub: "No vull rebre aquests correus", notice: "Aquest és un avís sobre el teu compte i la teva subscripció." },
  es: { why: "Recibes este correo porque tienes una cuenta en Sports Content Playbook.", unsub: "Darme de baja de estos correos", notice: "Este es un aviso sobre tu cuenta y tu suscripción." },
};

const PERIOD = { en: { month: "monthly", year: "yearly" }, ca: { month: "mensual", year: "anual" }, es: { month: "mensual", year: "anual" } };
// the contact's values (facts from public.automation_facts). firstCharge: the real first charge after the trial, from
// Stripe's upcoming invoice (billing on the 1st makes it proportional, so it isn't the plan price)
export function varsOf(facts, locale, site, token, firstCharge = null) {
  const f = facts || {};
  const left = f.trial_end ? Math.max(0, Math.ceil((new Date(f.trial_end).getTime() - Date.now()) / 864e5)) : null;
  return {
    first_name: f.first_name || "", org_name: f.org_name || "",
    trial_end_date: f.trial_end ? day(f.trial_end, locale) : "", trial_days_left: left == null ? "" : String(left),
    plan_name: f.plan_key ? planName(f.plan_key, locale) || f.plan_name || "" : "",
    first_charge_amount: firstCharge ? money(firstCharge.amount, firstCharge.currency, locale) : "",
    last_payment_amount: f.last_payment ? money(f.last_payment.amount, f.last_payment.currency, locale) : "",
    billing_period: (PERIOD[locale] || PERIOD.en)[f.billing_interval] || "",
    platform_url: `${site}/content-library.html`, pricing_url: `${site}/pricing.html`, account_url: `${site}/profile.html`, subscription_url: `${site}/profile.html#billing`,
    unsubscribe_url: token ? `${site}/unsubscribe.html?t=${token}` : `${site}/unsubscribe.html`,
  };
}

export const fill = (text, vars, locale = "en") => String(text || "").replace(/\{\{\s*([a-z_]+)\s*(?:\|([^}]*))?\}\}/g, (_, k, fb) => {
  const v = vars[k];
  if (v != null && v !== "") return String(v);
  return fb != null ? fb.trim() : ((FALLBACK[locale] || FALLBACK.en)[k] ?? "");
}).replace(/[ \t]+([,.!?;:])/g, "$1"); // an empty name leaves "Hola ," → "Hola,"

// the language version to use: the contact's, else the e-mail's fallback language
export function pickLocale(email, locale) {
  const c = email?.content || {};
  if (c[locale]?.subject) return locale;
  return c[email?.fallback_locale] ? email.fallback_locale : Object.keys(c)[0] || "en";
}

const inline = (t) => esc(t).replace(/\*\*([^*]+)\*\*/g, "<b style=\"color:#ffffff\">$1</b>")
  .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, l, u) => `<a href="${u}" style="color:#f0b84a">${l}</a>`);
const plain = (t) => String(t || "").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1: $2");

// category "transactional" (account notices: trial ending, payment…) carries no unsubscribe link: unsubscribing from
// tips and offers never stops them
export function renderEmail(version, vars, locale = "en", category = "commercial") {
  const v = version || {};
  const F = (t) => fill(t, vars, locale);
  const subject = F(v.subject).replace(/\s+/g, " ").trim();
  const preheader = F(v.preheader);
  const foot = FOOT[locale] || FOOT.en, notice = category === "transactional";
  let html, text;
  if (v.html && String(v.html).trim()) {
    html = F(v.html);
    if (!notice && !/unsubscribe_url|unsubscribe\.html/.test(v.html)) html = html.replace(/<\/body>/i, `<p style="text-align:center;font-size:12px"><a href="${esc(vars.unsubscribe_url)}">${foot.unsub}</a></p></body>`);
  } else {
    const parts = [], txt = [];
    for (const b of v.blocks || []) {
      if (b.type === "text") {
        const paras = F(b.text).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
        // lines starting with "* " or "- " are a bullet list
        const bullets = (p) => p.replace(/^[*-] +/gm, "• ");
        parts.push(paras.map((p) => `<p style="margin:0 0 16px;color:#c9d1e0">${inline(bullets(p)).replace(/\n/g, "<br>")}</p>`).join(""));
        txt.push(paras.map((p) => plain(bullets(p))).join("\n\n"));
      } else if (b.type === "heading") {
        parts.push(`<h1 style="margin:0 0 18px;color:#ffffff;font-size:26px;line-height:1.2;font-weight:700">${esc(F(b.text))}</h1>`); txt.push(F(b.text));
      } else if (b.type === "image" && b.src) {
        const img = `<img src="${esc(F(b.src))}" alt="${esc(F(b.alt))}" width="516" style="display:block;width:100%;max-width:516px;height:auto;border:0;border-radius:12px">`;
        parts.push(`<div style="margin:6px 0 20px">${b.href ? `<a href="${esc(F(b.href))}">${img}</a>` : img}</div>`);
      } else if (b.type === "button" && b.label) {
        parts.push(`<p style="margin:24px 0 24px"><a href="${esc(F(b.url))}" style="display:inline-block;padding:14px 26px;border-radius:999px;background:#f0b84a;color:#1a1205;font-weight:700;font-size:15px;text-decoration:none">${esc(F(b.label))}</a></p>`);
        txt.push(`${F(b.label)}: ${F(b.url)}`);
      } else if (b.type === "divider") {
        parts.push(`<hr style="border:0;border-top:1px solid rgba(255,255,255,.12);margin:24px 0">`); txt.push("—");
      } else if (b.type === "footer") {
        parts.push(`<p style="margin:20px 0 0;color:#8b98ae;font-size:13px">${inline(F(b.text)).replace(/\n/g, "<br>")}</p>`); txt.push(plain(F(b.text)));
      }
    }
    html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#0b1020;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1020"><tr><td align="center" style="padding:32px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#17213b;border:1px solid rgba(240,184,74,.35);border-radius:20px">
<tr><td style="padding:30px 32px 6px"><a href="${esc(vars.platform_url || "https://sportscontentplaybook.com")}"><img src="${LOGO}" width="150" alt="Sports Content Playbook" style="display:block;border:0;width:150px;height:auto"></a></td></tr>
<tr><td style="padding:18px 32px 30px;font-size:15px;line-height:1.6;color:#c9d1e0">${parts.join("")}</td></tr>
</table>
<p style="max-width:580px;margin:18px auto 0;color:#7f8aa3;font-size:12px;line-height:1.5;text-align:center">${notice ? `${esc(foot.notice)}<br>` : `${esc(foot.why)}<br><a href="${esc(vars.unsubscribe_url)}" style="color:#7f8aa3">${esc(foot.unsub)}</a> &middot; `}<a href="https://sportscontentplaybook.com" style="color:#7f8aa3">sportscontentplaybook.com</a></p>
</td></tr></table></body></html>`;
    text = txt.join("\n\n");
  }
  if (v.text && String(v.text).trim()) text = F(v.text);
  if (text == null) text = html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  text = notice ? `${text}\n\n— Sports Content Playbook\n${foot.notice}` : `${text}\n\n— Sports Content Playbook\n${foot.why}\n${foot.unsub}: ${vars.unsubscribe_url}`;
  return { subject, html: ascii(html), text };
}
