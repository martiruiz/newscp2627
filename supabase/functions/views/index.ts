// Supabase Edge Function "views": the current views, likes and comments of a TikTok, YouTube or Instagram post, read from
// its public page when a member plays it in the Content Library (js/library.js). POST { id } → { views, likes, comments }. Any signed-in member;
// each post is read from the platform at most every 6 hours (content_ideas.views_at, supabase/views-refresh.sql).
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { engagementOf, engagementRow } from "../_shared/engagement.ts";

const env = (k: string) => Deno.env.get(k) ?? "";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const service = { apikey: env("SUPABASE_SERVICE_ROLE_KEY"), Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" };
const FRESH_MS = 6 * 3600 * 1000;

async function signedIn(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const r = await fetch(`${env("SUPABASE_URL")}/auth/v1/user`, { headers: { apikey: env("SUPABASE_ANON_KEY"), Authorization: `Bearer ${token}` } });
  return r.ok && !!(await r.json())?.id;
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!(await signedIn(req))) return json({ error: "Sign in" }, 401);
  const { id } = await req.json().catch(() => ({}));
  if (!Number(id)) return json({ error: "id" }, 400);
  const rows = await (await fetch(`${env("SUPABASE_URL")}/rest/v1/content_ideas?select=id,url,views,likes,comments,views_at&id=eq.${Number(id)}`, { headers: service })).json();
  const p = rows?.[0];
  const now = { views: p?.views ?? null, likes: p?.likes ?? null, comments: p?.comments ?? null };
  if (!p || !/tiktok\.com|youtu|instagram\.com/.test(p.url || "")) return json(now);
  if (p.views_at && Date.now() - new Date(p.views_at).getTime() < FRESH_MS) return json({ ...now, fresh: true });
  const e = await engagementOf(p.url).catch(() => null);
  if (!e || e.removed || e.throttled || (!e.views && !e.likes)) return json(now);
  const row = engagementRow(e);
  await fetch(`${env("SUPABASE_URL")}/rest/v1/content_ideas?id=eq.${p.id}`, { method: "PATCH", headers: service, body: JSON.stringify({ ...row, views_at: new Date().toISOString() }) });
  return json({ ...now, ...row, updated: true });
});
