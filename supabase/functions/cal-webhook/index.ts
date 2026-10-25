// Supabase Edge Function "cal-webhook": Cal.com tells us about demo bookings, so Admin → Leads & Demos is always right.
//   BOOKING_CREATED · BOOKING_RESCHEDULED · BOOKING_CANCELLED · MEETING_ENDED · BOOKING_NO_SHOW_UPDATED
// Every request is signed by Cal.com (HMAC-SHA256 of the raw body with the webhook secret, header x-cal-signature-256);
// unsigned or wrongly signed requests are refused. The lead is matched by the lead id the booking form sent as
// metadata (js/lead-flow.js), or by the attendee's email.
//
// Set up:
//   1. supabase secrets set CAL_WEBHOOK_SECRET=<a long random string>
//   2. supabase functions deploy cal-webhook --no-verify-jwt
//   3. Cal.com → Settings → Developer → Webhooks → New: URL https://<project>.supabase.co/functions/v1/cal-webhook,
//      the same secret, events: Booking created, rescheduled, cancelled, Meeting ended, No-show updated.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
const env = (k: string) => Deno.env.get(k) ?? "";

async function validSignature(raw: string, signature: string | null) {
  const secret = env("CAL_WEBHOOK_SECRET");
  if (!secret || !signature) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hex.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ signature.charCodeAt(i);   // constant time
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const raw = await req.text();
  if (!(await validSignature(raw, req.headers.get("x-cal-signature-256")))) return new Response("Invalid signature", { status: 401 });
  let body: { triggerEvent?: string; payload?: Record<string, unknown> };
  try { body = JSON.parse(raw); } catch { return new Response("Bad request", { status: 400 }); }
  const p = (body.payload || {}) as Record<string, any>;
  const attendee = (p.attendees || [])[0] || {};
  const event = {
    trigger: body.triggerEvent,
    uid: p.uid || p.bookingUid || null,
    start: p.startTime || null,
    email: attendee.email || p.responses?.email?.value || null,
    name: attendee.name || p.responses?.name?.value || null,
    lead_id: p.metadata?.lead_id || null,
  };
  const r = await fetch(`${env("SUPABASE_URL")}/rest/v1/rpc/lead_calcom_event`, {
    method: "POST",
    headers: { apikey: env("SUPABASE_SERVICE_ROLE_KEY"), Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p: event }),
  });
  if (!r.ok) { console.error("lead_calcom_event", r.status, await r.text()); return new Response("Error", { status: 500 }); }
  return new Response("ok");
});
