// Transactional e-mail rendering (plain JS: send-emails Edge Function, admin preview, tests).
// Template body: paragraphs separated by blank lines, {{variables}}, [Button label](https://…) on its own line.
// Values are HTML-escaped; empty lines left by empty variables are dropped.

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const fill = (text, vars) => String(text || "").replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k) => (vars[k] == null ? "" : String(vars[k])));

const WORDS = {
  en: { retry: (d) => (d ? `on ${d}` : "in the next few days"), usage: (posts, ai, plan) => (posts || ai || plan ? `So far you've saved ${posts} posts, unlocked ${ai} AI analyses and planned ${plan} posts.` : "There's still time to make the most of it: search for your club in the Library and try an AI analysis."), next: (a, d) => (a && d ? `Next charge: ${a} on ${d}.` : ""), month: "/ month", year: "/ year", footer: "You're receiving this because you have a Sports Content Playbook account. Billing questions? Just reply.", trialNote: (d, a, p, monthly, m, m2) => (monthly && a && m ? `On ${d} we'll charge ${a} for the rest of ${m}. From 1 ${m2}, ${p} a month.` : `Your first charge will be on ${d}${a ? `: ${a}` : ""}.`), payNote: (d, a, monthly) => `Today's charge covers until ${d}${a ? ` (${a})` : ""}${monthly ? "; then the full price on the 1st of every month" : ""}.` },
  ca: { retry: (d) => (d ? `el ${d}` : "en els pròxims dies"), usage: (posts, ai, plan) => (posts || ai || plan ? `Fins ara has desat ${posts} posts, has fet ${ai} anàlisis amb IA i has planificat ${plan} posts.` : "Encara hi ets a temps: busca el teu club a la Biblioteca i prova una anàlisi amb IA."), next: (a, d) => (a && d ? `Pròxim cobrament: ${a} el ${d}.` : ""), month: "/ mes", year: "/ any", footer: "Reps aquest correu perquè tens un compte a Sports Content Playbook. Dubtes de facturació? Respon aquest correu.", trialNote: (d, a, p, monthly, m, m2) => (monthly && a && m ? `El ${d} et cobrarem ${a} pels dies que queden ${/^[aeiou]/i.test(m) ? "d'" : "de "}${m}. A partir de l'1 ${/^[aeiou]/i.test(m2) ? "d'" : "de "}${m2}, ${p} al mes.` : `El primer cobrament serà el ${d}${a ? `: ${a}` : ""}.`), payNote: (d, a, monthly) => `El cobrament d'avui cobreix fins al ${d}${a ? ` (${a})` : ""}${monthly ? "; després, el preu complet l'1 de cada mes" : ""}.` },
  es: { retry: (d) => (d ? `el ${d}` : "en los próximos días"), usage: (posts, ai, plan) => (posts || ai || plan ? `Hasta ahora has guardado ${posts} posts, has hecho ${ai} análisis con IA y has planificado ${plan} posts.` : "Aún estás a tiempo: busca tu club en la Biblioteca y prueba un análisis con IA."), next: (a, d) => (a && d ? `Próximo cobro: ${a} el ${d}.` : ""), month: "/ mes", year: "/ año", footer: "Recibes este correo porque tienes una cuenta en Sports Content Playbook. ¿Dudas de facturación? Responde a este correo.", trialNote: (d, a, p, monthly, m, m2) => (monthly && a && m ? `El ${d} te cobraremos ${a} por los días que quedan de ${m}. Desde el 1 de ${m2}, ${p} al mes.` : `El primer cobro será el ${d}${a ? `: ${a}` : ""}.`), payNote: (d, a, monthly) => `El cobro de hoy cubre hasta el ${d}${a ? ` (${a})` : ""}${monthly ? "; después, el precio completo el día 1 de cada mes" : ""}.` },
};
export const words = (locale) => WORDS[locale] || WORDS.en;

// Plan names and what a plan unlocks, in the e-mail's language (the plans table holds the English names)
const PLAN_NAMES = {
  en: { library: "Starter", library_ai: "Library + AI", library_planner: "Plus", all_access: "Pro" },
  ca: { library: "Starter", library_ai: "Biblioteca + IA", library_planner: "Plus", all_access: "Pro" },
  es: { library: "Starter", library_ai: "Biblioteca + IA", library_planner: "Plus", all_access: "Pro" },
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
export const planIncludes = (key, locale = "en") => [...new Set([((PLAN_UNLOCKS[locale] || PLAN_UNLOCKS.en).library || [])[0], ...((PLAN_UNLOCKS[locale] || PLAN_UNLOCKS.en)[key] || [])])].filter(Boolean).map((f) => `✓ ${f}`).join("\n");
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

export function monthsOf(iso, locale = "en", tz = "Europe/Madrid") {
  if (!iso) return ["", ""];
  const loc = { en: "en-GB", ca: "ca-ES", es: "es-ES" }[locale] || "en-GB";
  const d = new Date(iso), next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 15));
  const m = (x) => new Intl.DateTimeFormat(loc, { month: "long", timeZone: tz }).format(x).replace(/^de /, "");
  return [m(d), m(next)];
}
export function weekday(iso, locale = "en", tz = "Europe/Madrid") {
  if (!iso) return "";
  const loc = { en: "en-GB", ca: "ca-ES", es: "es-ES" }[locale] || "en-GB";
  return new Date(iso).toLocaleDateString(loc, { weekday: "long", day: "numeric", timeZone: tz });
}

export function render({ subject, body }, vars, locale = "en", kind = "") {
  const w = words(locale);
  const footer = (FOOTERS[kind] || {})[locale] || w.footer;
  const subj = fill(subject, vars).replace(/\s+/g, " ").trim();
  const blocks = fill(body, vars).split(/\n\s*\n/).map((b) => b.split("\n").map((l) => l.trim()).filter(Boolean)).filter((b) => b.length);
  const titled = blocks.some((b) => b.some((l) => l.startsWith("# ")));
  const inline = (l) => esc(l).replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, t, u) => `<a href="${u}" style="color:#f0b84a">${t}</a>`);
  const html = blocks.map((lines, i) => {
    const btn = lines.length === 1 && /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(lines[0]);
    if (btn) return `<p style="margin:26px 0 8px"><a href="${esc(btn[2])}" style="display:inline-block;padding:14px 26px;border-radius:999px;background:#f0b84a;color:#1a1205;font-weight:700;font-size:15px;text-decoration:none">${esc(btn[1])}</a></p>`;
    let out = "", para = [];
    const flush = () => { if (para.length) out += `<p style="margin:0 0 16px;color:${!titled && i === 0 ? "#ffffff" : "#c9d1e0"}">${para.map(inline).join("<br>")}</p>`; para = []; };
    for (const l of lines) {
      if (l.startsWith("^ ")) { flush(); out += `<p style="margin:0 0 10px;color:#f0b84a;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">${esc(l.slice(2))}</p>`; }
      else if (l.startsWith("# ")) { flush(); out += `<h1 style="margin:0 0 18px;color:#ffffff;font-size:27px;line-height:1.2;font-weight:700">${esc(l.slice(2))}</h1>`; }
      else para.push(l);
    }
    flush();
    return out;
  }).join("");
  const text = blocks.map((lines) => lines.map((l) => l.replace(/^[#^] /, "").replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1: $2")).join("\n")).join("\n\n");
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
