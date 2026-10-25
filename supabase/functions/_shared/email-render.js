// Transactional e-mail rendering (plain JS: send-emails Edge Function, admin preview, tests).
// Template body: paragraphs separated by blank lines, {{variables}}, [Button label](https://…) on its own line.
// Values are HTML-escaped; empty lines left by empty variables are dropped.

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const fill = (text, vars) => String(text || "").replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k) => (vars[k] == null ? "" : String(vars[k])));

const WORDS = {
  en: { month: "/ month", year: "/ year", footer: "You're receiving this because you have a Sports Content Playbook account. Billing questions? Just reply.", trialNote: (d, a, p, monthly) => `Your first charge will be on ${d}${a ? `: ${a}` : ""}${monthly ? ` for the days until the 1st, then ${p} on the 1st of every month` : ""}.`, payNote: (d, a, monthly) => `Today's charge covers until ${d}${a ? ` (${a})` : ""}${monthly ? "; then the full price on the 1st of every month" : ""}.` },
  ca: { month: "/ mes", year: "/ any", footer: "Reps aquest correu perquè tens un compte a Sports Content Playbook. Dubtes de facturació? Respon aquest correu.", trialNote: (d, a, p, monthly) => `El primer cobrament serà el ${d}${a ? `: ${a}` : ""}${monthly ? ` pels dies fins a l'1 del mes, i després ${p} l'1 de cada mes` : ""}.`, payNote: (d, a, monthly) => `El cobrament d'avui cobreix fins al ${d}${a ? ` (${a})` : ""}${monthly ? "; després, el preu complet l'1 de cada mes" : ""}.` },
  es: { month: "/ mes", year: "/ año", footer: "Recibes este correo porque tienes una cuenta en Sports Content Playbook. ¿Dudas de facturación? Responde a este correo.", trialNote: (d, a, p, monthly) => `El primer cobro será el ${d}${a ? `: ${a}` : ""}${monthly ? ` por los días hasta el día 1, y después ${p} el día 1 de cada mes` : ""}.`, payNote: (d, a, monthly) => `El cobro de hoy cubre hasta el ${d}${a ? ` (${a})` : ""}${monthly ? "; después, el precio completo el día 1 de cada mes" : ""}.` },
};
export const words = (locale) => WORDS[locale] || WORDS.en;

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

export function render({ subject, body }, vars, locale = "en") {
  const w = words(locale);
  const subj = fill(subject, vars).replace(/\s+/g, " ").trim();
  const blocks = fill(body, vars).split(/\n\s*\n/).map((b) => b.split("\n").map((l) => l.trim()).filter(Boolean)).filter((b) => b.length);
  const html = blocks.map((lines) => {
    const btn = lines.length === 1 && /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(lines[0]);
    if (btn) return `<p style="margin:26px 0"><a href="${esc(btn[2])}" style="display:inline-block;padding:13px 24px;border-radius:100px;background:#f0b84a;color:#121b33;font-weight:700;text-decoration:none">${esc(btn[1])}</a></p>`;
    return `<p style="margin:0 0 16px">${lines.map((l) => esc(l).replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, t, u) => `<a href="${u}" style="color:#b87a0c">${t}</a>`)).join("<br>")}</p>`;
  }).join("");
  const text = blocks.map((lines) => lines.map((l) => l.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1: $2")).join("\n")).join("\n\n");
  const page = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subj)}</title></head>
<body style="margin:0;background:#f4f6fa;font-family:Inter,Helvetica,Arial,sans-serif;color:#121b33">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="background:#121b33;border-radius:16px 16px 0 0;padding:22px 28px;color:#ffffff;font-weight:700;font-size:17px"><span style="color:#f0b84a">▲</span>&nbsp; Sports Content Playbook</td></tr>
<tr><td style="background:#ffffff;border-radius:0 0 16px 16px;padding:30px 28px;font-size:15px;line-height:1.6">${html}</td></tr>
<tr><td style="padding:18px 8px;color:#6b7690;font-size:12px;line-height:1.5;text-align:center">${esc(w.footer)}</td></tr>
</table></td></tr></table></body></html>`;
  return { subject: subj, html: page, text: `${text}\n\n— Sports Content Playbook\n${w.footer}` };
}
