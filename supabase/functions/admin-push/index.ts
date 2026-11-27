// Supabase Edge Function: notifications on the admins' Macs (Web Push to the SCP app added to the Dock, or any browser
// where an admin switched them on: Admin → bell). Only admins get them (supabase/admin-push.sql).
//   GET                                  → { publicKey } for the page to subscribe
//   POST Database Webhook (x-webhook-secret = WEBHOOK_SECRET) from supabase/admin-push.sql:
//        profiles INSERT · subscriptions INSERT/UPDATE · contact_requests INSERT · leads INSERT/UPDATE · idea_imports UPDATE · feedback INSERT
//   POST { title, body, url } with x-worker-key (the GitHub workflows when they fail)
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (made by pipeline/push-keys.mjs), WEBHOOK_SECRET.
import webpush from "npm:web-push@3.6.7";

const env = (k: string) => Deno.env.get(k) ?? "";
const SITE = "https://sportscontentplaybook.com";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-worker-key", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
type Row = Record<string, any>;

async function rest(path: string, init: RequestInit = {}) {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const r = await fetch(`${env("SUPABASE_URL")}/rest/v1/${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers || {}) } });
  return r.ok && r.status !== 204 ? r.json().catch(() => null) : null;
}
async function isWorker(req: Request) {   // the same check as club-scrape: a key the database accepts for a worker call
  const key = req.headers.get("x-worker-key") || "";
  if (!key) return false;
  const r = await fetch(`${env("SUPABASE_URL")}/rest/v1/rpc/post_benchmark`, {
    method: "POST", body: JSON.stringify({ p_post_id: 0 }),
    headers: { apikey: key, "Content-Type": "application/json", ...(key.startsWith("sb_") ? {} : { Authorization: `Bearer ${key}` }) },
  }).catch(() => null);
  return r?.ok === true;
}
async function isAdmin(req: Request) {   // a signed-in superadmin (the test notification from Admin → bell)
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const r = await fetch(`${env("SUPABASE_URL")}/rest/v1/rpc/is_admin`, { method: "POST", body: "{}",
    headers: { apikey: env("SUPABASE_ANON_KEY"), Authorization: auth, "Content-Type": "application/json" } }).catch(() => null);
  return r?.ok === true && (await r.json().catch(() => false)) === true;
}
const who = async (id?: string) => (id ? ((await rest(`profiles?select=email,first_name,last_name&id=eq.${encodeURIComponent(id)}`)) || [])[0] || {} : {});
const nameOf = (p: Row) => [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Someone";

// the notification for a database change, or null
async function message(type: string, table: string, r: Row, o: Row | null): Promise<Row | null> {
  if (table === "profiles" && type === "INSERT") return { title: "🆕 New sign-up", body: nameOf(r), url: "/admin/users.html", tag: `signup-${r.id}` };
  if (table === "subscriptions" && r.source === "stripe") {
    const p = await who(r.user_id), plan = [r.plan_key, r.billing_interval].filter(Boolean).join(" · ");
    if (r.status === "trialing" && (type === "INSERT" || o?.status !== "trialing")) return { title: "🎯 Free trial started", body: `${nameOf(p)} · ${plan}`, url: "/admin/memberships.html" };
    if (r.status === "active" && (type === "INSERT" || o?.status !== "active")) return { title: "💶 New payment", body: `${nameOf(p)} · ${plan}${r.amount ? ` · ${r.amount} ${String(r.currency || "").toUpperCase()}` : ""}`, url: "/admin/memberships.html" };
    if (["past_due", "unpaid"].includes(r.status) && o?.status !== r.status) return { title: "⚠️ Payment failed", body: `${nameOf(p)} · ${plan}`, url: "/admin/memberships.html" };
    if (type === "UPDATE" && ((r.cancel_at_period_end && !o?.cancel_at_period_end) || (r.status === "canceled" && o?.status !== "canceled" && !o?.cancel_at_period_end)))
      return { title: "👋 Subscription cancelled", body: `${nameOf(p)} · ${plan}`, url: "/admin/memberships.html" };
    return null;
  }
  if (table === "contact_requests" && type === "INSERT") return { title: "✉️ Contact form", body: `${r.name || r.email || "Someone"}${r.message ? `: ${String(r.message).slice(0, 90)}` : ""}`, url: "/admin/crm.html" };
  if (table === "leads") {
    const n = r.name || r.email || r.organization || "A lead";
    if (type === "INSERT" && r.source_page === "my_club") return { title: "🏟️ My Club trial", body: `${n}${r.organization ? ` · ${r.organization}` : ""}`, url: "/admin/crm.html" };
    if (type === "INSERT" && r.source_page !== "trial" && (r.email || r.phone)) return { title: "🧲 New lead", body: `${n}${r.organization ? ` · ${r.organization}` : ""}`, url: "/admin/crm.html" };
    if (type === "UPDATE" && r.meeting_status === "booked" && o?.meeting_status !== "booked")
      return { title: "📅 Video call booked", body: `${n}${r.meeting_at ? ` · ${new Date(r.meeting_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid", dateStyle: "medium", timeStyle: "short" })}` : ""}`, url: "/admin/crm.html" };
    return null;
  }
  if (table === "feedback" && type === "INSERT") {
    const p = await who(r.user_id);
    const title = r.kind === "bug" ? "🐞 New bug report" : r.kind === "content" ? `📥 Content request${r.context?.wants ? ` · ${r.context.wants}` : ""}` : "💡 New suggestion";
    return { title, body: `${nameOf(p)}: ${String(r.message || "").slice(0, 110)}`, url: "/admin/support.html", mail: { title, who: p, r } };
  }
  if (table === "idea_imports" && type === "UPDATE" && r.status === "failed" && o?.status !== "failed")
    return { title: "❌ Import failed", body: String(r.filename || "An import").slice(0, 120), url: "/admin/import.html" };
  return null;
}

// Support reports also by e-mail to the team (the same NOTIFY_TO / CONTACT_FROM / RESEND_API_KEY as admin-notify)
const escH = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
async function mail({ title, who: p, r }: Row) {
  const to = env("NOTIFY_TO").split(",").map((x) => x.trim()).filter(Boolean);
  if (!env("RESEND_API_KEY") || !env("CONTACT_FROM") || !to.length) return;
  const c = r.context || {}, label = title.replace(/^\S+\s/, "");
  const row = (k: string, v: unknown) => (v ? `<tr><td style="padding:5px 12px 5px 0;color:#6f7d95;font-size:13px;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:5px 0;color:#fff;font-size:13.5px">${escH(v)}</td></tr>` : "");
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0e1529"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0e1529"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#17213b;border:1px solid rgba(240,184,74,0.35);border-radius:20px;font-family:Arial,Helvetica,sans-serif">
<tr><td style="padding:28px 32px 4px"><img src="${SITE}/assets/logo-scp.png" width="110" height="45" alt="Sports Content Playbook" style="display:block;border:0"></td></tr>
<tr><td style="padding:18px 32px 32px;color:#b4c0d3;font-size:15px;line-height:1.6">
<p style="color:#f0b84a;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;margin:0 0 8px">${escH(label)}</p>
<p style="color:#fff;font-size:20px;font-weight:700;margin:0 0 14px">${escH(nameOf(p))}</p>
<div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:14px 16px;color:#fff;font-size:15px;white-space:pre-line">${escH(r.message)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:14px">${row("Email", p.email)}${row("Wants", c.wants)}${row("Page", c.page)}${row("Plan", c.plan)}${row("Language", [c.lang, c.region].filter(Boolean).join("-"))}${row("Opened from", c.app)}${row("Screenshots", r.images?.length ? `${r.images.length} (in the admin)` : "")}${row("Browser", c.ua)}</table>
<p style="margin:22px 0 0"><a href="${SITE}/admin/support.html" style="color:#f0b84a;font-weight:700">Answer in the admin →</a></p></td></tr></table></td></tr></table></body></html>`;
  await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env("CONTACT_FROM"), to, ...(p.email ? { reply_to: p.email } : {}), subject: `${label}: ${nameOf(p)}`, html }) }).catch(() => null);
}

async function send(msg: Row) {
  if (msg.mail) await mail(msg.mail);
  webpush.setVapidDetails(env("VAPID_SUBJECT") || "mailto:info@sportscontentplaybook.com", env("VAPID_PUBLIC_KEY"), env("VAPID_PRIVATE_KEY"));
  const subs: Row[] = (await rest("admin_push_subscriptions?select=endpoint,p256dh,auth")) || [];
  const payload = JSON.stringify({ title: msg.title, body: msg.body, url: new URL(msg.url || "/admin/", SITE).href, tag: msg.tag });
  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: "high" }); sent++; }
    catch (e) { if ([404, 410].includes((e as Row)?.statusCode)) await rest(`admin_push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: "DELETE" }); }
  }));
  return sent;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method === "GET") return json({ publicKey: env("VAPID_PUBLIC_KEY") || null });
  if (!env("VAPID_PRIVATE_KEY")) return json({ error: "Push keys not set (pipeline/push-keys.mjs)" }, 503);
  const body = await req.json().catch(() => ({}));
  let msg: Row | null = null;
  if (env("WEBHOOK_SECRET") && req.headers.get("x-webhook-secret") === env("WEBHOOK_SECRET")) msg = body.record ? await message(body.type, body.table, body.record, body.old_record) : null;
  else if (body.test && (await isAdmin(req))) msg = { title: "🔔 SCP notifications are on", body: "Sales, leads and failures will show up here.", url: "/admin/" };
  else if (await isWorker(req)) msg = body.title ? { title: String(body.title).slice(0, 80), body: String(body.body || "").slice(0, 200), url: body.url || "/admin/" } : null;
  else return json({ error: "Unauthorized" }, 401);
  if (!msg) return json({ ok: true, ignored: true });
  return json({ ok: true, sent: await send(msg) });
});
