// Supabase Edge Function "automation-send": delivers the automation e-mails (Admin → Newsletter → Automations).
//   pg_cron "scp-automations" (header x-cron-secret), every 5 min when something is due → claims the queue
//     (public.automation_claim_sends: last eligibility check, consent, suppressions, frequency cap) and sends with Resend
//   superadmin { action: "preview", email, locale, user_id? } → { subject, html, text } (no send)
//   superadmin { action: "test", email, locale, to, user_id? }  → sends one test to the address the admin typed
//   anyone POST ?u=<token> → one-click unsubscribe (List-Unsubscribe-Post from mail clients)
// Nothing is sent to contacts while billing_settings.automations.sending_enabled is false (tests still go out).
// Secrets: RESEND_API_KEY, CRON_SECRET, SITE_URL. Sender and reply-to: Memberships → Settings → E-mails.
import { CORS, cronAllowed, env, json, rest, rpc, setting, stripe, superadmin } from "../_shared/stripe.ts";
import { pickLocale, renderEmail, varsOf } from "../_shared/automation-render.js";

const site = () => (env("SITE_URL").split(",")[0] || "https://sportscontentplaybook.com").replace(/\/$/, "");
const fnUrl = () => `${env("SUPABASE_URL")}/functions/v1/automation-send`;

async function deliver(to: string, msg: { subject: string; html: string; text: string }, idem: string, token: string | null) {
  const cfg = (await setting("emails")) || {};
  if (!env("RESEND_API_KEY")) throw new Error("RESEND_API_KEY is not set");
  const headers: Record<string, string> = {};
  if (token) { headers["List-Unsubscribe"] = `<${fnUrl()}?u=${token}>`; headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"; }
  const r = await fetch("https://api.resend.com/emails", { method: "POST",
    headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json", "Idempotency-Key": idem },
    body: JSON.stringify({ from: `${cfg.from_name || "Sports Content Playbook"} <${cfg.from_email || "hello@sportscontentplaybook.com"}>`, to: [to], subject: msg.subject,
      html: msg.html, text: msg.text, headers, ...(cfg.reply_to ? { reply_to: cfg.reply_to } : {}) }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.message || `Resend ${r.status}`);
  return d.id as string;
}

// the real first charge after the trial (Stripe's upcoming invoice; read only). Only looked up when the e-mail uses it.
async function firstCharge(email: { content?: Record<string, unknown> }, facts: { stripe_subscription_id?: string; in_trial?: boolean } | null) {
  if (!facts?.stripe_subscription_id || !facts.in_trial || !JSON.stringify(email?.content || {}).includes("first_charge_amount")) return null;
  try {
    // deno-lint-ignore no-explicit-any
    const inv: any = await (stripe.invoices as any).retrieveUpcoming({ subscription: facts.stripe_subscription_id });
    return { amount: inv.amount_due / 100, currency: inv.currency };
  } catch { return null; }
}

// sample values for previews without a chosen contact
const SAMPLE = { first_name: "Alex", org_name: "FC Example", trial_end: new Date(Date.now() + 3 * 864e5).toISOString(), plan_key: "library_planner", plan_name: "Plus", billing_interval: "month" };

async function factsOf(userId?: string) {
  if (!userId) return null;
  return await rpc("automation_facts", { p_user: userId }).catch(() => null);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const u = new URL(req.url).searchParams.get("u");
  if (u) {
    // one-click unsubscribe (RFC 8058): the token is the only key
    if (!/^[0-9a-f-]{36}$/i.test(u)) return json({ error: "Bad token" }, 400);
    await rpc("email_unsubscribe", { p_token: u }).catch(() => null);
    return json({ ok: true });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (cronAllowed(req)) {
    let sent = 0, failed = 0;
    for (let round = 0; round < 5; round++) {
      const batch = (await rpc("automation_claim_sends", { p_limit: 40 })) || [];
      if (!batch.length) break;
      for (const s of batch) {
        let subject = "";
        try {
          const locale = pickLocale(s.email, s.facts?.locale || "en");
          const vars = varsOf(s.facts, locale, site(), s.token, await firstCharge(s.email, s.facts));
          const msg = renderEmail(s.email.content[locale], vars, locale, s.category);
          subject = msg.subject;
          const id = await deliver(s.to, msg, `scp-auto-${s.id}`, s.category === "transactional" ? null : s.token);
          await rpc("automation_send_result", { p_id: s.id, p_ok: true, p_provider: id, p_subject: subject, p_error: null });
          sent++;
        } catch (e) {
          failed++;
          await rpc("automation_send_result", { p_id: s.id, p_ok: false, p_provider: null, p_subject: subject, p_error: String((e as Error).message || e) });
        }
      }
    }
    return json({ sent, failed });
  }

  const admin = await superadmin(req);
  if (!admin) return json({ error: "Not allowed" }, 403);
  const body = await req.json().catch(() => ({}));
  try {
    const email = body.email || {};
    const facts = (await factsOf(body.user_id)) || SAMPLE;
    const locale = pickLocale(email, body.locale || facts.locale || "en");
    const vars = varsOf(facts, locale, site(), null, body.user_id ? await firstCharge(email, facts) : { amount: 12.4, currency: "eur" });
    const msg = renderEmail(email.content?.[locale], vars, locale, email.category);
    if (body.action === "preview") return json({ ...msg, locale });
    if (body.action === "test") {
      const to = String(body.to || admin.email || "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return json({ error: "Write a valid e-mail address." }, 400);
      const [row] = await rest("automation_sends", { method: "POST", headers: { Prefer: "return=representation" },
        body: JSON.stringify({ to_email: to, email_id: email.id || null, category: email.category || "commercial", status: "sending", is_test: true, attempts: 1, subject: `[Test] ${msg.subject}` }) });
      try {
        const id = await deliver(to, { ...msg, subject: `[Test] ${msg.subject}` }, `scp-auto-test-${row.id}`, null);
        await rest(`automation_sends?id=eq.${row.id}`, { method: "PATCH", body: JSON.stringify({ status: "sent", provider_id: id, sent_at: new Date().toISOString() }) });
        return json({ ok: true, to });
      } catch (e) {
        await rest(`automation_sends?id=eq.${row.id}`, { method: "PATCH", body: JSON.stringify({ status: "failed", error: String((e as Error).message || e).slice(0, 300) }) });
        throw e;
      }
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
