// Supabase Edge Function "stripe-portal": opens Stripe's customer portal for the signed-in member
// (change plan, monthly ↔ yearly, card, invoices, cancel). Returns { url }.
import { config, CORS, currentUser, json, rest, siteUrl, stripe } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const user = await currentUser(req);
  if (!user?.id) return json({ error: "Sign in first" }, 401);
  try {
    const [row] = await rest(`stripe_customers?select=customer_id&user_id=eq.${user.id}`);
    if (!row) return json({ error: "You don't have any payments yet" }, 404);
    const portalConfig = await config("portal_config");
    const p = await stripe.billingPortal.sessions.create({ customer: row.customer_id, return_url: `${siteUrl(req)}/profile.html#billing`, ...(portalConfig ? { configuration: portalConfig } : {}) });
    return json({ url: p.url });
  } catch (e) {
    console.error(e);
    return json({ error: "We couldn't open the billing portal. Please try again in a moment." }, 500);
  }
});
