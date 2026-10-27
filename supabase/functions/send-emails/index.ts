// Supabase Edge Function "send-emails": delivers queued transactional e-mails (email_delivery_logs) with Resend.
//   called by stripe-webhook / billing-cron (header x-cron-secret) → sends the queue
//   superadmin { action: "preview", template, locale, subject?, body? } → rendered HTML with sample data (no send)
//   superadmin { action: "test", template, locale }                     → sends a test to the superadmin's own address
// Without RESEND_API_KEY nothing is sent: messages stay queued (sent later if still recent, otherwise marked skipped).
// Secrets: RESEND_API_KEY, CRON_SECRET, SITE_URL. Sender, reply-to and time zone: Memberships → Settings.
import { CORS, cronAllowed, env, json, rest, setting, superadmin } from "../_shared/stripe.ts";
import { day, money, monthsOf, planIncludes, planName, planUnlocks, render, weekday, words } from "../_shared/email-render.js";

const site = () => (env("SITE_URL").split(",")[0] || "https://sportscontentplaybook.com").replace(/\/$/, "");
const MAX_AGE_H = 48;   // a billing e-mail older than this isn't sent any more (it would be confusing)

// how many rows a member has in a table (capped: it's for a friendly sentence, not accounting)
async function count(table: string, filter: string) {
  const rows = await rest(`${table}?select=user_id&${filter}&limit=500`).catch(() => []);
  return Array.isArray(rows) ? rows.length : 0;
}
// one-click answers to "why are you leaving?" (cancel_feedback, supabase/email-improvements.sql)
const REASONS = ["price", "unused", "missing", "other"];
async function feedbackLinks(userId: string | null, locale: string) {
  if (!userId) return {};
  const [row] = await rest("cancel_feedback", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ user_id: userId }) }).catch(() => [null]);
  if (!row?.token) return {};
  return Object.fromEntries(REASONS.map((r) => [`fb_${r}`, `${site()}/feedback.html?t=${row.token}&r=${r}&l=${locale}`]));
}

async function varsFor(row: { id?: number; user_id: string | null; to_email: string; template: string; vars: Record<string, unknown> }, locale: string, tz: string) {
  const v = row.vars || {};
  const [profile] = row.user_id ? await rest(`profiles?select=first_name&id=eq.${row.user_id}`) : [null];
  const [sub] = row.user_id ? await rest(`subscriptions?select=plan_key,billing_interval,currency,amount,current_period_end,trial_end,cancel_at,status&user_id=eq.${row.user_id}`) : [null];
  const [plan] = sub ? await rest(`plans?select=name,features&key=eq.${sub.plan_key}`) : [null];
  const w = words(locale);
  const cur = (v.currency as string) || sub?.currency || "eur";
  const monthly = sub?.billing_interval !== "year";
  const price = sub?.amount != null ? money(sub.amount, cur, locale) : "";
  const trialEnd = (v.trial_end as string) || sub?.trial_end || null;
  const firstAmount = v.first_charge_amount != null ? money(v.first_charge_amount, (v.first_charge_currency as string) || cur, locale) : "";
  const [m1, m2] = monthsOf(trialEnd, locale, tz);
  const trialish = ["trial_ending", "trial_welcome"].includes(row.template) || (row.template === "subscription_confirmed" && sub?.status === "trialing");
  const firstNote = trialish
    ? w.trialNote(day(trialEnd, locale, tz), firstAmount || price, price, monthly, firstAmount && firstAmount !== price ? m1 : "", m2)
    : row.template === "subscription_confirmed" && monthly && sub?.current_period_end ? w.payNote(day(sub.current_period_end, locale, tz), "", true) : "";
  return {
    name: profile?.first_name || row.to_email.split("@")[0],
    plan: planName((v.plan as string) || sub?.plan_key || plan?.name, locale) || "SCP",
    from_plan: planName((v.from_plan as string) || "", locale),
    price, interval: sub ? (monthly ? w.month : w.year) : "",
    next_charge_date: day(sub?.status === "trialing" ? trialEnd : sub?.current_period_end, locale, tz),
    next_charge_amount: sub?.status === "trialing" ? (firstAmount || price) : price,
    trial_end: day(trialEnd, locale, tz),
    first_charge_amount: firstAmount, first_charge_note: firstNote,
    // the "next charge" line only when the first-charge note above doesn't already say it
    next_charge_line: firstNote ? "" : w.next(sub?.status === "trialing" ? (firstAmount || price) : price, day(sub?.status === "trialing" ? trialEnd : sub?.current_period_end, locale, tz)),
    access_until: day((v.access_until as string) || sub?.cancel_at || sub?.current_period_end, locale, tz),
    amount: v.amount != null ? money(v.amount, cur, locale) : "",
    features_lost: planUnlocks(sub?.plan_key, locale),
    plan_includes: planIncludes(sub?.plan_key, locale),
    trial_end_day: weekday(trialEnd, locale, tz),
    next_attempt: w.retry(v.next_attempt ? day(typeof v.next_attempt === "number" ? new Date((v.next_attempt as number) * 1000).toISOString() : String(v.next_attempt), locale, tz) : ""),
    usage_line: row.template === "trial_ending" && row.user_id
      ? w.usage(await count("folder_items", `user_id=eq.${row.user_id}`), await count("user_ai_unlocks", `user_id=eq.${row.user_id}&status=eq.completed`), await count("org_entries", `user_id=eq.${row.user_id}`))
      : "",
    ...(row.template === "cancellation_confirmed" ? await feedbackLinks(row.user_id, locale) : {}),
    account_url: `${site()}/profile.html#billing`, site_url: site(),
    update_payment_url: (v.invoice_url as string) || `${site()}/profile.html#billing`,
  };
}

async function template(key: string, locale: string) {
  const [t] = await rest(`email_templates?select=subject,body,enabled,required&key=eq.${key}&locale=eq.${locale}`);
  if (t) return t;
  const [en] = await rest(`email_templates?select=subject,body,enabled,required&key=eq.${key}&locale=eq.en`);
  return en;
}

async function deliver(to: string, msg: { subject: string; html: string; text: string }, idem: string) {
  const cfg = (await setting("emails")) || {};
  const r = await fetch("https://api.resend.com/emails", { method: "POST",
    headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json", "Idempotency-Key": idem },
    body: JSON.stringify({ from: `${cfg.from_name || "Sports Content Playbook"} <${cfg.from_email || "hello@sportscontentplaybook.com"}>`, to: [to], subject: msg.subject,
      html: msg.html, text: msg.text, ...(cfg.reply_to ? { reply_to: cfg.reply_to } : {}) }) });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(out?.message || `Resend ${r.status}`);
  return out.id as string;
}

async function sendQueue() {
  if (!env("RESEND_API_KEY")) return { sent: 0, note: "RESEND_API_KEY not set: e-mails stay queued" };
  const tz = (await setting("timezone")) || "Europe/Madrid";
  const cutoff = new Date(Date.now() - MAX_AGE_H * 3600e3).toISOString();
  await rest(`email_delivery_logs?status=eq.queued&created_at=lt.${cutoff}`, { method: "PATCH", body: JSON.stringify({ status: "skipped", error: `Not sent within ${MAX_AGE_H} h` }) });
  const queue = await rest(`email_delivery_logs?select=id,template,locale,user_id,to_email,vars,attempts&status=eq.queued&order=created_at&limit=40`);
  let sent = 0, failed = 0;
  for (const row of queue) {
    // claim the row (another run may be sending it)
    const claimed = await rest(`email_delivery_logs?id=eq.${row.id}&status=eq.queued`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "sending", attempts: row.attempts + 1 }) });
    if (!claimed?.length) continue;
    try {
      let key = row.template;
      if (key === "subscription_confirmed" && row.user_id) {
        const [s0] = await rest(`subscriptions?select=status&user_id=eq.${row.user_id}`);
        if (s0?.status === "trialing") key = "trial_welcome";
      }
      const t = await template(key, row.locale);
      // an optional e-mail switched off (an active automation flow replaces it, supabase/automations.sql) is not sent:
      // the trial flow's welcome carries the trial's billing terms (end date, first charge, plan, renewal)
      if (t && t.enabled === false && !t.required) {
        await rest(`email_delivery_logs?id=eq.${row.id}`, { method: "PATCH", body: JSON.stringify({ status: "skipped", error: "switched off (replaced by an automation flow)" }) });
        continue;
      }
      if (!t) throw new Error(`No template ${key}`);
      const msg = render(t, await varsFor({ ...row, template: key }, row.locale, tz), row.locale, key === "newsletter_welcome" ? "newsletter" : "");
      const id = await deliver(row.to_email, msg, `scp-email-${row.id}`);
      await rest(`email_delivery_logs?id=eq.${row.id}`, { method: "PATCH", body: JSON.stringify({ status: "sent", provider_id: id, subject: msg.subject, sent_at: new Date().toISOString(), error: null }) });
      sent++;
    } catch (e) {
      failed++;
      await rest(`email_delivery_logs?id=eq.${row.id}`, { method: "PATCH", body: JSON.stringify({ status: row.attempts + 1 >= 5 ? "failed" : "queued", error: String((e as Error).message || e).slice(0, 300) }) });
    }
  }
  return { sent, failed };
}

const SAMPLE = { plan: "all_access", from_plan: "library", amount: 39.99, currency: "eur", first_charge_amount: 18.71, trial_end: new Date(Date.now() + 3 * 864e5).toISOString(),
  access_until: new Date(Date.now() + 3 * 864e5).toISOString(), invoice_url: "https://invoice.stripe.com/example" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await req.json().catch(() => ({}));
  try {
    if (cronAllowed(req) && !body.action) return json(await sendQueue());
    const admin = await superadmin(req);
    if (!admin) return json({ error: "Not allowed" }, 403);
    if (!body.action || body.action === "send_queue") return json(await sendQueue());
    const locale = ["en", "ca", "es"].includes(body.locale) ? body.locale : "en";
    const tz = (await setting("timezone")) || "Europe/Madrid";
    const t = body.subject || body.body ? { subject: body.subject || "", body: body.body || "" } : await template(body.template, locale);
    if (!t) return json({ error: "Template not found" }, 404);
    const w = words(locale);
    const vars = { name: "Marta", plan: planName(SAMPLE.plan, locale), from_plan: planName(SAMPLE.from_plan, locale), price: money(39.99, "eur", locale), interval: w.month,
      next_charge_date: day(SAMPLE.trial_end, locale, tz), next_charge_amount: money(18.71, "eur", locale), trial_end: day(SAMPLE.trial_end, locale, tz),
      first_charge_amount: money(18.71, "eur", locale), first_charge_note: w.trialNote(day(SAMPLE.trial_end, locale, tz), money(18.71, "eur", locale), money(39.99, "eur", locale), true, ...monthsOf(SAMPLE.trial_end, locale, tz)),
      next_charge_line: "", plan_includes: planIncludes(SAMPLE.plan, locale), trial_end_day: weekday(SAMPLE.trial_end, locale, tz),
      next_attempt: w.retry(day(new Date(Date.now() + 2 * 864e5).toISOString(), locale, tz)), usage_line: w.usage(12, 4, 6),
      ...Object.fromEntries(REASONS.map((r) => [`fb_${r}`, `${site()}/feedback.html?t=example&r=${r}&l=${locale}`])),
      access_until: day(SAMPLE.access_until, locale, tz), amount: money(39.99, "eur", locale), features_lost: planUnlocks(SAMPLE.plan, locale),
      account_url: `${site()}/profile.html#billing`, site_url: site(), update_payment_url: SAMPLE.invoice_url };
    const msg = render(t, vars, locale, body.template === "newsletter_welcome" ? "newsletter" : "");
    if (body.action === "preview") return json(msg);
    if (body.action === "test") {
      if (!env("RESEND_API_KEY")) return json({ error: "Add RESEND_API_KEY to the Supabase secrets to send e-mails." }, 409);
      const [log] = await rest("email_delivery_logs", { method: "POST", headers: { Prefer: "return=representation" },
        body: JSON.stringify({ template: body.template || "custom", locale, user_id: admin.id, to_email: admin.email, subject: msg.subject, vars: {}, status: "sending", is_test: true, attempts: 1 }) });
      try {
        const id = await deliver(admin.email, { ...msg, subject: `[Test] ${msg.subject}` }, `scp-test-${log.id}`);
        await rest(`email_delivery_logs?id=eq.${log.id}`, { method: "PATCH", body: JSON.stringify({ status: "sent", provider_id: id, sent_at: new Date().toISOString() }) });
        return json({ sent: true, to: admin.email });
      } catch (e) {
        await rest(`email_delivery_logs?id=eq.${log.id}`, { method: "PATCH", body: JSON.stringify({ status: "failed", error: String((e as Error).message) }) });
        return json({ error: String((e as Error).message) }, 502);
      }
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "E-mail sending failed" }, 500);
  }
});
