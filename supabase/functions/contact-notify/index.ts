// Supabase Edge Function: emails for every contact / demo / custom-plan request.
// Triggered by a Database Webhook on INSERT into public.contact_requests (supabase/contact-requests.sql).
//   1. tells the team (NOTIFY_TO) with everything the visitor wrote and the CTA they came from
//   2. confirms to the visitor, in their language, that we got it (and, for demos, the booking link if there is one)
//
// Secrets (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY, CONTACT_FROM (e.g. "Sports Content Playbook <hello@sportscontentplaybook.com>"),
//   NOTIFY_TO (where the team gets the alerts, comma-separated), WEBHOOK_SECRET (same value as the webhook's
//   "x-webhook-secret" header), DEMO_BOOKING_URL (optional: the Google Calendar booking page)

const RESEND = "https://api.resend.com";
const SITE = "https://sportscontentplaybook.com";
const env = (k: string) => Deno.env.get(k) ?? "";
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

type Req = {
  id: number; kind: "contact" | "demo" | "custom_plan"; name: string; email: string; company?: string; country?: string;
  role?: string; team_size?: string; users?: number; preferred_day?: string; preferred_time?: string; message?: string;
  lang?: string; page?: string; created_at?: string;
};

const KIND = { contact: "Message", demo: "Demo request", custom_plan: "Custom plan request" };

const T = {
  en: {
    subject: { contact: "We've got your message", demo: "Your SCP demo request", custom_plan: "Your custom plan request" },
    hi: (n: string) => `Hi ${n},`,
    body: {
      contact: "Thanks for writing to us. We've got your message and we'll reply within one working day.",
      demo: "Thanks for asking for a demo. We'll confirm the time and send you a video call link within one working day.",
      custom_plan: "Thanks for your interest in a plan for a bigger team. We'll get back to you within one working day to understand what you need.",
    },
    book: "Prefer to pick a time yourself? Book it here:",
    meanwhile: "Meanwhile, you can try the platform free for 7 days:",
    trial: "Start your free trial",
    sign: "The Sports Content Playbook team",
  },
  es: {
    subject: { contact: "Hemos recibido tu mensaje", demo: "Tu solicitud de demo de SCP", custom_plan: "Tu solicitud de plan a medida" },
    hi: (n: string) => `Hola ${n}:`,
    body: {
      contact: "Gracias por escribirnos. Hemos recibido tu mensaje y te responderemos en menos de un día laborable.",
      demo: "Gracias por pedir una demo. Te confirmaremos la hora y te enviaremos el enlace de la videollamada en menos de un día laborable.",
      custom_plan: "Gracias por tu interés en un plan para un equipo más grande. Te escribiremos en menos de un día laborable para entender qué necesitas.",
    },
    book: "¿Prefieres elegir tú la hora? Resérvala aquí:",
    meanwhile: "Mientras tanto, puedes probar la plataforma gratis durante 7 días:",
    trial: "Empieza tu prueba gratis",
    sign: "El equipo de Sports Content Playbook",
  },
};

const shell = (inner: string) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0e1529"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0e1529"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#17213b;border:1px solid rgba(240,184,74,0.35);border-radius:20px;font-family:Arial,Helvetica,sans-serif">
<tr><td style="padding:28px 32px 4px"><a href="${SITE}" style="color:#fff;text-decoration:none;font-weight:700;font-size:16px"><img src="${SITE}/assets/logo-scp.png" width="110" height="45" alt="Sports Content Playbook" style="display:block;border:0"></a></td></tr>
<tr><td style="padding:18px 32px 32px;color:#b4c0d3;font-size:15px;line-height:1.6">${inner}</td></tr>
</table></td></tr></table></body></html>`;

function visitorHtml(r: Req, lang: "en" | "es") {
  const t = T[lang], first = esc((r.name || "").split(" ")[0]), booking = env("DEMO_BOOKING_URL");
  const btn = (href: string, label: string) => `<a href="${href}" style="display:inline-block;padding:12px 22px;border-radius:100px;background:#f0b84a;color:#0b0f1c;font-weight:700;text-decoration:none">${label}</a>`;
  return shell(`<p style="color:#fff;font-size:20px;font-weight:700;margin:0 0 12px">${t.hi(first)}</p>
<p style="margin:0 0 18px">${t.body[r.kind] || t.body.contact}</p>
${r.kind === "demo" && booking ? `<p style="margin:0 0 10px">${t.book}</p><p style="margin:0 0 22px">${btn(booking, lang === "es" ? "Reservar mi demo" : "Book my demo")}</p>` : ""}
<p style="margin:0 0 10px">${t.meanwhile}</p><p style="margin:0 0 22px">${btn(`${SITE}/signup.html`, t.trial)}</p>
<p style="margin:0;color:#6f7d95;font-size:13px">${t.sign}</p>`);
}

function teamHtml(r: Req) {
  const row = (k: string, v: unknown) => (v ? `<tr><td style="padding:6px 12px 6px 0;color:#6f7d95;font-size:13px;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:6px 0;color:#fff;font-size:14px">${esc(v)}</td></tr>` : "");
  return shell(`<p style="color:#f0b84a;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;margin:0 0 8px">New ${esc(KIND[r.kind] || "request").toLowerCase()}</p>
<p style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px">${esc(r.name)}${r.company ? ` · ${esc(r.company)}` : ""}</p>
<table role="presentation" cellpadding="0" cellspacing="0">
${row("Email", r.email)}${row("Club / org", r.company)}${row("Role", r.role)}${row("Country", r.country)}${row("Team size", r.team_size)}
${row("Users", r.users)}${row("Preferred day", r.preferred_day)}${row("Preferred time", r.preferred_time)}${row("Language", (r.lang || "").toUpperCase())}
${row("Came from", r.page)}
</table>
${r.message ? `<p style="margin:18px 0 0;padding:14px 16px;background:#121b33;border-radius:12px;color:#fff;white-space:pre-line">${esc(r.message)}</p>` : ""}
<p style="margin:22px 0 0"><a href="mailto:${esc(r.email)}" style="color:#f0b84a;font-weight:700">Reply to ${esc((r.name || "").split(" ")[0])} →</a> · <a href="${SITE}/admin/memberships.html" style="color:#b4c0d3">Admin → Requests</a></p>`);
}

async function send(payload: Record<string, unknown>) {
  const res = await fetch(`${RESEND}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

Deno.serve(async (req) => {
  if (!env("WEBHOOK_SECRET") || req.headers.get("x-webhook-secret") !== env("WEBHOOK_SECRET")) return new Response("Unauthorized", { status: 401 });
  const { type, table, record } = await req.json().catch(() => ({}));
  if (type !== "INSERT" || table !== "contact_requests" || !record?.email) return new Response("Ignored");
  if (!env("RESEND_API_KEY") || !env("CONTACT_FROM")) return new Response("Email not configured", { status: 503 });
  const r = record as Req;
  const lang = r.lang === "es" ? "es" : "en";
  const errors: string[] = [];
  const to = env("NOTIFY_TO").split(",").map((s) => s.trim()).filter(Boolean);
  if (to.length) {
    await send({ from: env("CONTACT_FROM"), to, reply_to: r.email,
      subject: `${KIND[r.kind] || "Request"}: ${r.name}${r.company ? ` (${r.company})` : ""}`, html: teamHtml(r) }).catch((e) => errors.push(String(e)));
  }
  await send({ from: env("CONTACT_FROM"), to: [r.email], reply_to: to[0] || undefined,
    subject: T[lang].subject[r.kind] || T[lang].subject.contact, html: visitorHtml(r, lang) }).catch((e) => errors.push(String(e)));
  return errors.length ? new Response(errors.join("\n"), { status: 502 }) : new Response("Sent");
});
