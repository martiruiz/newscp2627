// Supabase Edge Function "resend-webhook": Resend → Webhooks (events email.delivered, email.bounced, email.complained,
// email.clicked, contact.updated). Every request is verified with the Svix signature (secret RESEND_WEBHOOK_SECRET,
// "whsec_…", shown by Resend when the webhook is created) and recorded once per svix-id (public.email_event_record):
// duplicates and out-of-order deliveries are harmless. Permanent bounces and spam complaints stop future automation
// e-mails; a newsletter unsubscribe in Resend also stops tips and offers. Deploy with --no-verify-jwt (Resend has no JWT).
import { env, json, rpc } from "../_shared/stripe.ts";

const enc = new TextEncoder();
const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function verified(req: Request, body: string) {
  const id = req.headers.get("svix-id") || "", ts = req.headers.get("svix-timestamp") || "", sigs = req.headers.get("svix-signature") || "";
  const secret = env("RESEND_WEBHOOK_SECRET");
  if (!secret || !id || !ts || !sigs) return null;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 5 * 60) return null;           // replayed or stale
  const key = await crypto.subtle.importKey("raw", fromB64(secret.replace(/^whsec_/, "")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = b64(await crypto.subtle.sign("HMAC", key, enc.encode(`${id}.${ts}.${body}`)));
  // the header may carry several signatures ("v1,abc v1,def"); constant-time compare each
  const ok = sigs.split(" ").some((s) => {
    const sig = s.split(",")[1] || "";
    if (sig.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  });
  return ok ? id : null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await req.text();
  const id = await verified(req, body);
  if (!id) return json({ error: "Invalid signature" }, 401);
  const evt = JSON.parse(body || "{}");
  const d = evt.data || {};
  const email = Array.isArray(d.to) ? d.to[0] : d.email || d.to || "";
  try {
    await rpc("email_event_record", { p_svix: id, p_type: evt.type || "", p_provider: d.email_id || d.id || null, p_email: email, p_data: d });
  } catch (e) {
    console.error("resend-webhook", e);
    return json({ error: "Not stored" }, 500);                                   // Resend retries
  }
  return json({ ok: true });
});
