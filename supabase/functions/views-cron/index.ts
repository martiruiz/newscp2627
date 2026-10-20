// Supabase Edge Function "views-cron": every 10 minutes (pg_cron, supabase/views-cron.sql) reads the views of the posts
// that are due (views_due: last 7 days daily, 8–30 days weekly, 31–90 days monthly) and saves them, with likes and comments.
// Read by _shared/engagement.ts (TikTok video page · YouTube player / "next" API · Instagram embed page).
// Header x-cron-secret = the vault secret cron_secret (checked with the RPC cron_secret_ok). Slow on purpose (pauses between posts) so no platform blocks it; stops after ~110 s.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { engagementOf, engagementRow } from "../_shared/engagement.ts";

const env = (k: string) => Deno.env.get(k) ?? "";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const service = { apikey: env("SUPABASE_SERVICE_ROLE_KEY"), Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" };
const rest = (path: string, init: RequestInit = {}) => fetch(`${env("SUPABASE_URL")}/rest/v1/${path}`, { ...init, headers: { ...service, ...(init.headers || {}) } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  // the call carries the vault secret "cron_secret" (supabase/views-cron.sql); checked against the vault itself
  const ok = await (await rest("rpc/cron_secret_ok", { method: "POST", body: JSON.stringify({ p_secret: req.headers.get("x-cron-secret") || "" }) })).json().catch(() => false);
  if (ok !== true) return json({ error: "Not allowed" }, 403);
  const t0 = Date.now();
  const due = await (await rest("rpc/views_due", { method: "POST", body: JSON.stringify({ p_limit: 40 }) })).json();
  let done = 0, none = 0, removed = 0;
  const paused = new Set<string>();   // a platform that answered "too many requests" waits for the next run
  for (const p of Array.isArray(due) ? due : []) {
    if (Date.now() - t0 > 110000) break;
    const pf = /tiktok/.test(p.url) ? "tiktok" : /instagram/.test(p.url) ? "instagram" : "youtube";
    if (paused.has(pf)) continue;
    const v = await engagementOf(p.url).catch(() => null);
    const now = new Date().toISOString();
    if (v?.throttled) { paused.add(pf); continue; }
    if (v?.removed) { removed++; await rest(`content_ideas?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify({ unavailable_at: now }) }); }
    else if (v?.views || v?.likes) { done++; await rest(`content_ideas?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify({ ...engagementRow(v), views_at: now }) }); }
    else { none++; await rest(`content_ideas?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify({ views_at: now }) }); }   // try again at its next turn
    await sleep(pf === "youtube" ? 300 : 1500);
  }
  return json({ due: Array.isArray(due) ? due.length : 0, done, not_read: none, removed, paused: [...paused], ms: Date.now() - t0 });
});
