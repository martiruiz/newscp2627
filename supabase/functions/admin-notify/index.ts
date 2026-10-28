// Supabase Edge Function: tells the team (NOTIFY_TO) when someone signs up, starts the free trial or cancels.
// Only the team gets these e-mails, never the user. Triggered by two Database Webhooks (supabase/admin-notify.md):
//   public.profiles      INSERT          → "New sign-up"     (a profile is created for every new account)
//   public.subscriptions INSERT, UPDATE  → "Trial started"   (status becomes trialing)
//                                          "Cancelled"       (cancel at period end switched on, or the subscription ends
//                                                             without one having been scheduled)
// Secrets (the same ones contact-notify uses): RESEND_API_KEY, CONTACT_FROM, NOTIFY_TO, WEBHOOK_SECRET.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

const SITE = "https://sportscontentplaybook.com";
const env = (k: string) => Deno.env.get(k) ?? "";
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Madrid" }) : "");

type Row = Record<string, any>;

async function profile(id: string): Promise<Row> {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const r = await fetch(`${env("SUPABASE_URL")}/rest/v1/profiles?select=email,first_name,last_name&id=eq.${encodeURIComponent(id)}`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  return r.ok ? ((await r.json())[0] ?? {}) : {};
}

const shell = (inner: string) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0e1529"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0e1529"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#17213b;border:1px solid rgba(240,184,74,0.35);border-radius:20px;font-family:Arial,Helvetica,sans-serif">
<tr><td style="padding:28px 32px 4px"><a href="${SITE}"><img src="${SITE}/assets/logo-scp.png" width="110" height="45" alt="Sports Content Playbook" style="display:block;border:0"></a></td></tr>
<tr><td style="padding:18px 32px 32px;color:#b4c0d3;font-size:15px;line-height:1.6">${inner}</td></tr>
</table></td></tr></table></body></html>`;

function html(label: string, who: Row, rows: [string, unknown][], link: string) {
  const name = [who.first_name, who.last_name].filter(Boolean).join(" ");
  const row = ([k, v]: [string, unknown]) => (v ? `<tr><td style="padding:6px 12px 6px 0;color:#6f7d95;font-size:13px;white-space:nowrap">${k}</td><td style="padding:6px 0;color:#fff;font-size:14px">${esc(v)}</td></tr>` : "");
  return shell(`<p style="color:#f0b84a;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;margin:0 0 8px">${label}</p>
<p style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px">${esc(name || who.email)}</p>
<table role="presentation" cellpadding="0" cellspacing="0">${row(["Email", who.email])}${rows.map(row).join("")}</table>
<p style="margin:22px 0 0"><a href="${SITE}/admin/${link}" style="color:#f0b84a;font-weight:700">Open in the admin →</a></p>`);
}

// what happened, or null when this change is not worth an e-mail
function event(type: string, table: string, rec: Row, old: Row | null) {
  if (table === "profiles" && type === "INSERT") return "signup";
  if (table !== "subscriptions" || rec.source !== "stripe") return null;
  if (rec.status === "trialing" && (type === "INSERT" || old?.status !== "trialing")) return "trial";
  if (type === "UPDATE" && old) {
    if (rec.cancel_at_period_end && !old.cancel_at_period_end) return "cancel";
    if (rec.status === "canceled" && old.status !== "canceled" && !old.cancel_at_period_end) return "cancel";
  }
  return null;
}

Deno.serve(async (req) => {
  if (!env("WEBHOOK_SECRET") || req.headers.get("x-webhook-secret") !== env("WEBHOOK_SECRET")) return new Response("Unauthorized", { status: 401 });
  const { type, table, record, old_record } = await req.json().catch(() => ({}));
  const what = record ? event(type, table, record, old_record) : null;
  if (!what) return new Response("Ignored");
  const to = env("NOTIFY_TO").split(",").map((s) => s.trim()).filter(Boolean);
  if (!env("RESEND_API_KEY") || !env("CONTACT_FROM") || !to.length) return new Response("Email not configured", { status: 503 });

  const r = record as Row;
  const who = table === "profiles" ? r : await profile(r.user_id);
  const plan = [r.plan_key, r.billing_interval].filter(Boolean).join(" · ");
  const mail = what === "signup"
    ? { subject: `New sign-up: ${who.email}`, body: html("New sign-up", who, [["Plan chosen", r.plan], ["Users", r.users], ["Signed up", day(r.created_at)]], "users.html") }
    : what === "trial"
    ? { subject: `Trial started: ${who.email}`, body: html("7-day trial started", who, [["Plan", plan], ["Seats", r.seats > 1 ? r.seats : null],
        ["Trial ends", day(r.trial_end)], ["Price", r.amount ? `${r.amount} ${String(r.currency || "").toUpperCase()}` : null], ["Discount code", r.discount_code]], "memberships.html") }
    : { subject: `Cancelled: ${who.email}`, body: html("Subscription cancelled", who, [["Plan", plan], ["Status", r.status],
        ["Access until", day(r.cancel_at || r.current_period_end || r.ended_at)]], "memberships.html") };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env("CONTACT_FROM"), to, ...(who.email ? { reply_to: who.email } : {}), subject: mail.subject, html: mail.body }),
  });
  return res.ok ? new Response("Sent") : new Response(`Resend ${res.status}: ${await res.text()}`, { status: 502 });
});
