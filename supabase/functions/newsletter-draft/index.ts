// Supabase Edge Function "newsletter-draft": Admin → Audience → Newsletter (superadmins only).
// POST { action, id, items? }
//   preview  → { html } of the issue (items sent = unsaved edits; otherwise the saved ones), same template as the weekly script
//   push     → re-renders the saved issue and updates its Resend broadcast draft (still a draft: it's sent from Resend)
//   test     → e-mails the saved issue to the superadmin who asks, marked "Preview — not sent to subscribers"
//   create_draft → creates the Resend broadcast draft for an issue that has none
//   send     → { confirm: "SEND" } only: puts every recipient in the Resend segment (admin_newsletter_recipients), updates the
//              draft with the saved issue and sends it to the segment. Once sent, an issue can't be sent again.
// Secrets: RESEND_API_KEY, RESEND_SEGMENT_ID, NEWSLETTER_FROM (already used by newsletter-welcome); SUPABASE_* are provided by Supabase.
import { renderWeekly } from "../_shared/newsletter-template.mjs";

const env = (k: string) => Deno.env.get(k) ?? "";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const service = { apikey: env("SUPABASE_SERVICE_ROLE_KEY"), Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}` };
const rest = async (path: string, init: RequestInit = {}) => {
  const r = await fetch(`${env("SUPABASE_URL")}/rest/v1/${path}`, { ...init, headers: { ...service, "Content-Type": "application/json", ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`${path.split("?")[0]}: ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json().catch(() => null);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const resend = async (method: string, path: string, body: unknown) => {
  await sleep(110);   // Resend: under 10 requests / second
  const r = await fetch(`https://api.resend.com${path}`, { method, headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const text = await r.text();
  if (!r.ok) throw new Error(`Resend ${r.status}: ${text}`);
  return text ? JSON.parse(text) : null;
};

// the recipients (website + imported contacts still subscribed, members who opted in) → contacts in the Resend segment
async function syncRecipients(token: string) {
  const r = await fetch(`${env("SUPABASE_URL")}/rest/v1/rpc/admin_newsletter_recipients`, { method: "POST", headers: { apikey: env("SUPABASE_ANON_KEY"), Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: "{}" });
  if (!r.ok) throw new Error(`recipients: ${r.status} ${await r.text()}`);
  const list = await r.json() as { email: string; first_name: string | null }[];
  let added = 0;
  for (const c of list) {
    try { await resend("POST", "/contacts", { email: c.email, first_name: c.first_name || undefined, segments: [{ id: env("RESEND_SEGMENT_ID") }] }); added++; }
    catch (_) { /* already a contact (or unsubscribed in Resend): Resend keeps its own choice */ }
  }
  return { total: list.length, added };
}

async function superadmin(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const u = await fetch(`${env("SUPABASE_URL")}/auth/v1/user`, { headers: { apikey: env("SUPABASE_ANON_KEY"), Authorization: `Bearer ${token}` } });
  const user = u.ok ? await u.json() : null;
  if (!user?.id) return null;
  const [p] = await rest(`profiles?select=role,email&id=eq.${user.id}`);
  return p?.role === "superadmin" ? { email: p.email || user.email } : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const me = await superadmin(req);
  if (!me) return json({ error: "Only superadmins" }, 403);
  try {
    const { action, id, items, confirm } = await req.json();
    const [issue] = await rest(`newsletter_issues?select=id,subject,broadcast_id,items,week_start,sent_at&id=eq.${Number(id)}`);
    if (!issue) return json({ error: "Issue not found" }, 404);
    const content = action === "preview" && items ? items : issue.items;
    const html = renderWeekly({ ...content, subject: content.subject || issue.subject, posts: content.posts || [], blogs: content.blogs || [], news: content.news || [] });
    const personal = (h: string) => h.replaceAll("{{{contact.first_name|there}}}", "there").replaceAll("{{{RESEND_UNSUBSCRIBE_URL}}}", "#");

    if (action === "preview") return json({ html: personal(html) });
    if (issue.sent_at && action !== "test") return json({ error: "This issue was already sent." }, 400);
    if (!env("RESEND_API_KEY")) return json({ error: "Add RESEND_API_KEY to the Supabase secrets first." }, 400);

    if (action === "create_draft") {
      if (issue.broadcast_id) return json({ error: "This issue already has a Resend draft." }, 400);
      if (!env("RESEND_SEGMENT_ID") || !env("NEWSLETTER_FROM")) return json({ error: "Add RESEND_SEGMENT_ID and NEWSLETTER_FROM to the Supabase secrets first." }, 400);
      const d = await resend("POST", "/broadcasts", { segment_id: env("RESEND_SEGMENT_ID"), from: env("NEWSLETTER_FROM"), subject: issue.subject, html, name: `SCP weekly — ${issue.week_start}` });
      await rest(`newsletter_issues?id=eq.${issue.id}`, { method: "PATCH", body: JSON.stringify({ broadcast_id: d.id, draft_synced_at: new Date().toISOString() }) });
      return json({ ok: true, broadcast_id: d.id });
    }
    if (action === "send") {
      if (confirm !== "SEND") return json({ error: "Not confirmed." }, 400);
      if (issue.sent_at) return json({ error: "This issue was already sent." }, 400);
      if (!issue.broadcast_id) return json({ error: "Create the Resend draft first." }, 400);
      const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      const sync = await syncRecipients(token);
      await resend("PATCH", `/broadcasts/${issue.broadcast_id}`, { subject: issue.subject, html });
      await resend("POST", `/broadcasts/${issue.broadcast_id}/send`, {});
      await rest(`newsletter_issues?id=eq.${issue.id}`, { method: "PATCH", body: JSON.stringify({ sent_at: new Date().toISOString(), sent_to: sync.total, draft_synced_at: new Date().toISOString() }) });
      return json({ ok: true, sent_to: sync.total });
    }
    if (action === "push") {
      if (!issue.broadcast_id) return json({ error: "This issue has no Resend draft." }, 400);
      await resend("PATCH", `/broadcasts/${issue.broadcast_id}`, { subject: issue.subject, html });
      await rest(`newsletter_issues?id=eq.${issue.id}`, { method: "PATCH", body: JSON.stringify({ draft_synced_at: new Date().toISOString() }) });
      return json({ ok: true });
    }
    if (action === "test") {
      const banner = `<div style="background:#f0b84a;color:#121b33;padding:14px 18px;font-family:Arial,sans-serif;font-size:14px;text-align:center"><b>Test — not sent to subscribers.</b> It goes out when it's sent from Resend → Broadcasts.</div>`;
      const body = personal(html).replace(/<body([^>]*)>/, `<body$1>${banner}`);
      await resend("POST", "/emails", { from: env("NEWSLETTER_FROM"), to: [me.email], subject: `[Test] ${issue.subject}`, html: body });
      return json({ ok: true, to: me.email });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
