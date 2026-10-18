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
const SITE = "https://sportscontentplaybook.com";
const env = (k: string) => Deno.env.get(k) ?? "";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function welcomeHtml(firstName: string) {
  const hi = firstName ? `Hi ${esc(firstName)},` : "Hi there,";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Welcome to SCP</title></head>
<body style="margin:0;padding:0;background:#0e1529">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0e1529"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#17213b;border:1px solid rgba(240,184,74,0.35);border-radius:20px;font-family:Arial,Helvetica,sans-serif">
    <tr><td style="padding:32px 32px 8px"><a href="${SITE}" style="color:#fff;text-decoration:none;font-weight:700;font-size:16px"><img src="${SITE}/assets/logo-scp.png" width="110" height="45" alt="Sports Content Playbook" style="display:block;border:0"></a></td></tr>
    <tr><td style="padding:16px 32px 0"><table role="presentation" width="100%">
      <tr><td style="color:#f0b84a;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;padding-bottom:10px">Welcome to the newsletter</td></tr>
      <tr><td style="color:#fff;font-size:28px;line-height:1.2;font-weight:700;padding-bottom:16px">${hi} you're in.</td></tr>
      <tr><td style="color:#b4c0d3;font-size:15px;line-height:1.6;padding-bottom:20px">Thanks for joining. Every Monday you'll get the latest in sports digital marketing, with real examples of the sports posts that are working right now and why they work.</td></tr>
      <tr><td style="padding:20px;background:#121b33;border-radius:14px;color:#b4c0d3;font-size:14px;line-height:1.6">
        <b style="color:#fff">While you wait for Monday:</b> browse thousands of posts from clubs, leagues and brands, filtered by sport, format and competition, in the <a href="${SITE}/content-library.html" style="color:#f0b84a">Content Library</a>.
      </td></tr>
    </table></td></tr>
    <tr><td style="padding:28px 32px 32px;color:#6f7d95;font-size:12px;line-height:1.6">You're receiving this because you signed up at sportscontentplaybook.com. Every newsletter includes a one-click unsubscribe link.</td></tr>
  </table>
</td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (!env("WEBHOOK_SECRET") || req.headers.get("x-webhook-secret") !== env("WEBHOOK_SECRET")) return new Response("Unauthorized", { status: 401 });
  const { type, table, record } = await req.json().catch(() => ({}));
  if (type !== "INSERT" || table !== "newsletter_signups" || !record?.email || record.welcomed_at) return new Response("Ignored");

  const headers = { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" };
  const firstName = String(record.first_name || "").trim();

  // 1. Contact in the newsletter segment (already existing → fine)
  await fetch(`${RESEND}/contacts`, {
    method: "POST", headers,
    body: JSON.stringify({ email: record.email, first_name: firstName || undefined, segments: env("RESEND_SEGMENT_ID") ? [{ id: env("RESEND_SEGMENT_ID") }] : undefined }),
  }).catch(() => null);

  // 2. Welcome email
  const sent = await fetch(`${RESEND}/emails`, {
    method: "POST", headers,
    body: JSON.stringify({
      from: env("NEWSLETTER_FROM"),
      to: [record.email],
      subject: "Welcome to the SCP newsletter",
      html: welcomeHtml(firstName),
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
