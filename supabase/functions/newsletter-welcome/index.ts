// Supabase Edge Function: welcome email for new newsletter sign-ups (home pop-up).
// Triggered by a Database Webhook on INSERT into public.newsletter_signups.
//   1. adds the person to Resend (contact in the newsletter segment)
//   2. sends the welcome email
//   3. marks the sign-up as welcomed
//
// Secrets (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY, RESEND_SEGMENT_ID, NEWSLETTER_FROM (e.g. "SCP Newsletter <newsletter@sportscontentplaybook.com>"),
//   WEBHOOK_SECRET (same value as the webhook's "x-webhook-secret" header)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.

const RESEND = "https://api.resend.com";
const SITE = "https://martiruiz.github.io/newscp2627";   // GitHub Pages: keeps working (redirects) once the domain points here
const env = (k: string) => Deno.env.get(k) ?? "";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// The welcome email in the language the person signed up in (newsletter_signups.lang, supabase/newsletter-lang.sql)
const T = {
  en: { subject: "Welcome to the SCP newsletter", title: "Welcome to SCP", eyebrow: "Welcome to the newsletter", hi: (n: string) => (n ? `Hi ${n},` : "Hi there,"), in: "you're in.",
    body: "Thanks for joining. Every Monday you'll get the latest in sports digital marketing, with real examples of the sports posts that are working right now and why they work.",
    wait: "While you wait for Monday:", browse: "browse thousands of posts from clubs, leagues and brands, filtered by sport, format and competition, in the", lib: "Content Library",
    foot: "You're receiving this because you signed up at sportscontentplaybook.com. Every newsletter includes a one-click unsubscribe link." },
  es: { subject: "Bienvenido a la newsletter de SCP", title: "Bienvenido a SCP", eyebrow: "Bienvenido a la newsletter", hi: (n: string) => (n ? `Hola ${n},` : "¡Hola!"), in: "ya estás dentro.",
    body: "Gracias por apuntarte. Cada lunes recibirás lo último en marketing digital deportivo, con ejemplos reales de los posts deportivos que están funcionando ahora mismo y por qué funcionan.",
    wait: "Mientras llega el lunes:", browse: "explora miles de posts de clubes, ligas y marcas, filtrados por deporte, formato y competición, en la", lib: "Biblioteca de contenido",
    foot: "Recibes este correo porque te apuntaste en sportscontentplaybook.com. Cada newsletter incluye un enlace para darte de baja con un clic." },
};

function welcomeHtml(firstName: string, lang: "es" | "en") {
  const t = T[lang];
  const hi = t.hi(firstName ? esc(firstName) : "");
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t.title}</title></head>
<body style="margin:0;padding:0;background:#0e1529">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0e1529"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#17213b;border:1px solid rgba(240,184,74,0.35);border-radius:20px;font-family:Arial,Helvetica,sans-serif">
    <tr><td style="padding:32px 32px 8px"><a href="${SITE}" style="color:#fff;text-decoration:none;font-weight:700;font-size:16px"><img src="${SITE}/assets/logo-scp.png" width="110" height="45" alt="Sports Content Playbook" style="display:block;border:0"></a></td></tr>
    <tr><td style="padding:16px 32px 0"><table role="presentation" width="100%">
      <tr><td style="color:#f0b84a;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;padding-bottom:10px">${t.eyebrow}</td></tr>
      <tr><td style="color:#fff;font-size:28px;line-height:1.2;font-weight:700;padding-bottom:16px">${hi} ${t.in}</td></tr>
      <tr><td style="color:#b4c0d3;font-size:15px;line-height:1.6;padding-bottom:20px">${t.body}</td></tr>
      <tr><td style="padding:20px;background:#121b33;border-radius:14px;color:#b4c0d3;font-size:14px;line-height:1.6">
        <b style="color:#fff">${t.wait}</b> ${t.browse} <a href="${SITE}/content-library.html" style="color:#f0b84a">${t.lib}</a>.
      </td></tr>
    </table></td></tr>
    <tr><td style="padding:28px 32px 32px;color:#6f7d95;font-size:12px;line-height:1.6">${t.foot}</td></tr>
  </table>
</td></tr></table></body></html>`;
}

// The version edited in Admin → Newsletter (email_templates "newsletter_welcome", supabase/newsletter-welcome-template.sql);
// the built-in one above while there's none. Body: paragraphs, the first = headline, {{name}}, [Button](url).
async function edited(lang: "es" | "en") {
  const r = await fetch(`${env("SUPABASE_URL")}/rest/v1/email_templates?select=subject,body,enabled&key=eq.newsletter_welcome&locale=eq.${lang}`, {
    headers: { apikey: env("SUPABASE_SERVICE_ROLE_KEY"), Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}` } }).catch(() => null);
  const rows = r?.ok ? await r.json().catch(() => []) : [];
  return rows?.[0] || null;
}
function editedHtml(body: string, firstName: string, lang: "es" | "en") {
  const name = (t: string) => t.replace(/\s?\{\{name\}\}/g, firstName ? ` ${firstName}` : "");
  const paras = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const rows = paras.map((p, i) => {
    const btn = p.match(/^\[(.+)\]\((https?:\/\/[^)\s]+)\)$/);
    if (btn) return `<tr><td style="padding:6px 0 4px"><a href="${esc(btn[2])}" style="display:inline-block;padding:14px 26px;border-radius:999px;background:#f0b84a;color:#1a1205;font-weight:700;font-size:15px;text-decoration:none">${esc(name(btn[1]))}</a></td></tr>`;
    const text = esc(name(p)).replace(/\n/g, "<br>");
    return i === 0 ? `<tr><td style="color:#fff;font-size:28px;line-height:1.2;font-weight:700;padding-bottom:16px">${text}</td></tr>`
      : `<tr><td style="color:#b4c0d3;font-size:15px;line-height:1.6;padding-bottom:16px">${text}</td></tr>`;
  }).join("");
  return welcomeHtml(firstName, lang).replace(/<tr><td style="padding:16px 32px 0"><table role="presentation" width="100%">[\s\S]*?<\/table><\/td><\/tr>/,
    `<tr><td style="padding:16px 32px 0"><table role="presentation" width="100%"><tr><td style="color:#f0b84a;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;padding-bottom:10px">${T[lang].eyebrow}</td></tr>${rows}</table></td></tr>`);
}

Deno.serve(async (req) => {
  if (!env("WEBHOOK_SECRET") || req.headers.get("x-webhook-secret") !== env("WEBHOOK_SECRET")) return new Response("Unauthorized", { status: 401 });
  const { type, table, record } = await req.json().catch(() => ({}));
  if (type !== "INSERT" || table !== "newsletter_signups" || !record?.email || record.welcomed_at) return new Response("Ignored");

  const headers = { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" };
  const firstName = String(record.first_name || "").trim();
  const lang = record.lang === "es" ? "es" : "en";

  // 1. Contact in the newsletter segment (already existing → fine)
  await fetch(`${RESEND}/contacts`, {
    method: "POST", headers,
    body: JSON.stringify({ email: record.email, first_name: firstName || undefined, segments: env("RESEND_SEGMENT_ID") ? [{ id: env("RESEND_SEGMENT_ID") }] : undefined }),
  }).catch(() => null);

  // 2. Welcome email (switched off in the admin → none)
  const tpl = await edited(lang);
  if (tpl && !tpl.enabled) return new Response("Welcome email switched off");
  const sent = await fetch(`${RESEND}/emails`, {
    method: "POST", headers,
    body: JSON.stringify({
      from: env("NEWSLETTER_FROM"),
      to: [record.email],
      subject: tpl?.subject || T[lang].subject,
      html: tpl?.body ? editedHtml(tpl.body, firstName, lang) : welcomeHtml(firstName, lang),
    }),
  });
  if (!sent.ok) return new Response(`Resend error ${sent.status}: ${await sent.text()}`, { status: 502 });

  // 3. Mark as welcomed
  await fetch(`${env("SUPABASE_URL")}/rest/v1/newsletter_signups?id=eq.${record.id}`, {
    method: "PATCH",
    headers: { apikey: env("SUPABASE_SERVICE_ROLE_KEY"), Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ welcomed_at: new Date().toISOString() }),
  });
  return new Response("Welcomed");
});
