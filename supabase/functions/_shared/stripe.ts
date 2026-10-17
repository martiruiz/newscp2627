// Shared helpers for the Stripe Edge Functions (stripe-checkout, stripe-portal, stripe-webhook).
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (webhook only), SITE_URL (e.g. https://sportscontentplaybook.com).
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import Stripe from "npm:stripe@17.7.0";

export const env = (k: string) => Deno.env.get(k) ?? "";
export const stripe = new Stripe(env("STRIPE_SECRET_KEY"), { httpClient: Stripe.createFetchHttpClient() });
export { Stripe };

export const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Supabase REST with the service role (bypasses RLS; only used server-side)
const service = () => ({ apikey: env("SUPABASE_SERVICE_ROLE_KEY"), Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" });
export async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(`${env("SUPABASE_URL")}/rest/v1/${path}`, { ...init, headers: { ...service(), ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`${path.split("?")[0]}: ${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
export const rpc = (fn: string, args: unknown) => rest(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });

// The signed-in member calling the function
export async function currentUser(req: Request) {
  const r = await fetch(`${env("SUPABASE_URL")}/auth/v1/user`, { headers: { apikey: env("SUPABASE_ANON_KEY"), Authorization: req.headers.get("Authorization") ?? "" } });
  return r.ok ? await r.json() : null;
}

// Where Stripe sends the member back: the site the request came from if it's ours (or a local dev server), else SITE_URL
export function siteUrl(req: Request) {
  const allowed = env("SITE_URL").split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
  const origin = (req.headers.get("origin") || "").replace(/\/$/, "");
  if (origin && (allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) return origin;
  return allowed[0] || origin;
}

export async function config(key: string): Promise<string | null> {
  const rows = await rest(`stripe_config?select=value&key=eq.${encodeURIComponent(key)}`);
  return rows?.[0]?.value || null;
}

// One Stripe customer per member, created on first checkout
export async function customerFor(user: { id: string; email?: string; user_metadata?: Record<string, string> }) {
  const rows = await rest(`stripe_customers?select=customer_id,trial_used&user_id=eq.${user.id}`);
  if (rows?.[0]) return rows[0] as { customer_id: string; trial_used: boolean };
  const c = await stripe.customers.create({ email: user.email, name: user.user_metadata?.full_name || user.user_metadata?.name || undefined, metadata: { user_id: user.id } });
  await rest("stripe_customers", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify({ user_id: user.id, customer_id: c.id }) });
  const again = await rest(`stripe_customers?select=customer_id,trial_used&user_id=eq.${user.id}`);
  return again[0] as { customer_id: string; trial_used: boolean };
}
