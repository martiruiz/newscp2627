// Transactional e-mail rendering (plain JS: send-emails Edge Function, admin preview, tests).
// Template body: paragraphs separated by blank lines, {{variables}}, [Button label](https://…) on its own line.
// Values are HTML-escaped; empty lines left by empty variables are dropped.

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const fill = (text, vars) => String(text || "").replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k) => (vars[k] == null ? "" : String(vars[k])));

const WORDS = {
  en: { next: (a, d) => (a && d ? `Next charge: ${a} on ${d}.` : ""), month: "/ month", year: "/ year", footer: "You're receiving this because you have a Sports Content Playbook account. Billing questions? Just reply.", trialNote: (d, a, p, monthly) => `Your first charge will be on ${d}${a ? `: ${a}` : ""}${monthly ? ` for the days until the 1st, then ${p} on the 1st of every month` : ""}.`, payNote: (d, a, monthly) => `Today's charge covers until ${d}${a ? ` (${a})` : ""}${monthly ? "; then the full price on the 1st of every month" : ""}.` },
  ca: { next: (a, d) => (a && d ? `Pròxim cobrament: ${a} el ${d}.` : ""), month: "/ mes", year: "/ any", footer: "Reps aquest correu perquè tens un compte a Sports Content Playbook. Dubtes de facturació? Respon aquest correu.", trialNote: (d, a, p, monthly) => `El primer cobrament serà el ${d}${a ? `: ${a}` : ""}${monthly ? ` pels dies fins a l'1 del mes, i després ${p} l'1 de cada mes` : ""}.`, payNote: (d, a, monthly) => `El cobrament d'avui cobreix fins al ${d}${a ? ` (${a})` : ""}${monthly ? "; després, el preu complet l'1 de cada mes" : ""}.` },
  es: { next: (a, d) => (a && d ? `Próximo cobro: ${a} el ${d}.` : ""), month: "/ mes", year: "/ año", footer: "Recibes este correo porque tienes una cuenta en Sports Content Playbook. ¿Dudas de facturación? Responde a este correo.", trialNote: (d, a, p, monthly) => `El primer cobro será el ${d}${a ? `: ${a}` : ""}${monthly ? ` por los días hasta el día 1, y después ${p} el día 1 de cada mes` : ""}.`, payNote: (d, a, monthly) => `El cobro de hoy cubre hasta el ${d}${a ? ` (${a})` : ""}${monthly ? "; después, el precio completo el día 1 de cada mes" : ""}.` },
};
export const words = (locale) => WORDS[locale] || WORDS.en;

// Plan names and what a plan unlocks, in the e-mail's language (the plans table holds the English names)
const PLAN_NAMES = {
  en: { library: "Library", library_ai: "Library + AI", library_planner: "Library + Content Plan", all_access: "Library + AI + Content Plan" },
  ca: { library: "Biblioteca", library_ai: "Biblioteca + IA", library_planner: "Biblioteca + Pla de contingut", all_access: "Biblioteca amb IA i Pla de contingut" },
  es: { library: "Biblioteca", library_ai: "Biblioteca + IA", library_planner: "Biblioteca + Plan de contenido", all_access: "Biblioteca con IA & Plan de contenido" },
};
const PLAN_UNLOCKS = {
  en: { library: ["Content Library"], library_ai: ["AI analysis"], library_planner: ["Content Plan"], all_access: ["AI analysis", "Content Plan"] },
  ca: { library: ["Biblioteca de contingut"], library_ai: ["Anàlisi amb IA"], library_planner: ["Pla de contingut"], all_access: ["Anàlisi amb IA", "Pla de contingut"] },
  es: { library: ["Biblioteca de contenido"], library_ai: ["Análisis con IA"], library_planner: ["Plan de contenido"], all_access: ["Análisis con IA", "Plan de contenido"] },
};
// a plan key or its English name -> the name in this language (anything else is left as it is)
export function planName(keyOrName, locale = "en") {
  if (!keyOrName) return "";
  const key = PLAN_NAMES.en[keyOrName] ? keyOrName : Object.keys(PLAN_NAMES.en).find((k) => PLAN_NAMES.en[k] === keyOrName);
  return key ? (PLAN_NAMES[locale] || PLAN_NAMES.en)[key] : keyOrName;
}
export const planUnlocks = (key, locale = "en") => ((PLAN_UNLOCKS[locale] || PLAN_UNLOCKS.en)[key] || []).join(", ");

const LOGO = "https://sportscontentplaybook.com/assets/logo-scp.png";
const FOOTERS = {
  newsletter: { en: "You're receiving this because you signed up for the SCP newsletter.", ca: "Reps aquest correu perquè t'has apuntat a la newsletter de SCP.", es: "Recibes este correo porque te has apuntado a la newsletter de SCP." },
};
// every character outside ASCII as an HTML entity: no mail client can garble accents, whatever charset it assumes
const ascii = (h) => h.replace(/[^\x00-\x7f]/gu, (c) => `&#${c.codePointAt(0)};`);

export function money(amount, currency, locale = "en") {
  if (amount === null || amount === undefined || amount === "") return "";
  const loc = { en: "en-GB", ca: "ca-ES", es: "es-ES" }[locale] || "en-GB";
  return new Intl.NumberFormat(loc, { style: "currency", currency: String(currency || "eur").toUpperCase() }).format(Number(amount));
}
export function day(iso, locale = "en", tz = "Europe/Madrid") {
  if (!iso) return "";
  const loc = { en: "en-GB", ca: "ca-ES", es: "es-ES" }[locale] || "en-GB";
  return new Date(iso).toLocaleDateString(loc, { day: "numeric", month: "long", year: "numeric", timeZone: tz });
}

export function render({ subject, body }, vars, locale = "en", kind = "") {
  const w = words(locale);
  const footer = (FOOTERS[kind] || {})[locale] || w.footer;
  const subj = fill(subject, vars).replace(/\s+/g, " ").trim();
  const blocks = fill(body, vars).split(/\n\s*\n/).map((b) => b.split("\n").map((l) => l.trim()).filter(Boolean)).filter((b) => b.length);
  const html = blocks.map((lines, i) => {
    const btn = lines.length === 1 && /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(lines[0]);
    if (btn) return `<p style="margin:26px 0 8px"><a href="${esc(btn[2])}" style="display:inline-block;padding:14px 26px;border-radius:999px;background:#f0b84a;color:#1a1205;font-weight:700;font-size:15px;text-decoration:none">${esc(btn[1])}</a></p>`;
    const color = i === 0 ? "#ffffff" : "#c9d1e0";
    return `<p style="margin:0 0 16px;color:${color}">${lines.map((l) => esc(l).replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, t, u) => `<a href="${u}" style="color:#f0b84a">${t}</a>`)).join("<br>")}</p>`;
  }).join("");
  const text = blocks.map((lines) => lines.map((l) => l.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1: $2")).join("\n")).join("\n\n");
  const page = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${esc(subj)}</title></head>
<body style="margin:0;padding:0;background:#0b1020;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1020"><tr><td align="center" style="padding:32px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#17213b;border:1px solid rgba(240,184,74,.35);border-radius:20px">
<tr><td style="padding:30px 32px 6px"><img src="${LOGO}" width="150" alt="Sports Content Playbook" style="display:block;border:0;width:150px;height:auto"></td></tr>
<tr><td style="padding:18px 32px 30px;font-size:15px;line-height:1.6;color:#c9d1e0">${html}</td></tr>
</table>
<p style="max-width:580px;margin:18px auto 0;color:#7f8aa3;font-size:12px;line-height:1.5;text-align:center">${esc(footer)}<br>Sports Content Playbook &middot; <a href="https://sportscontentplaybook.com" style="color:#7f8aa3">sportscontentplaybook.com</a></p>
</td></tr></table></body></html>`;
  return { subject: subj, html: ascii(page), text: `${text}\n\n— Sports Content Playbook\n${footer}` };
}
