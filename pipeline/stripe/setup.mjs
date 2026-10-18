#!/usr/bin/env node
// Sets up the Stripe account for SCP. Safe to re-run.
//   • AI packs: one product per pack (one-time price, EUR, VAT included); price IDs saved into ai_packs
//   • the VAT rate shown on invoices (IVA 21% included)
//   • the customer portal: card, billing details, invoices and cancellation at period end. Plan changes are made in
//     Account → Billing (Edge Function stripe-manage) so the day-1 renewal and downgrade rules always apply.
//   • the webhook endpoint → Supabase Edge Function "stripe-webhook" with every event it handles (prints its signing
//     secret the first time)
// Membership plans and their EUR / USD prices are created from Super Admin → Memberships → "Sync with Stripe"
// (Edge Function stripe-admin), not here.
//
//   cd pipeline && node stripe/setup.mjs            (test mode: STRIPE_SECRET_KEY=sk_test_… in pipeline/.env)
//   node stripe/setup.mjs --live                    (only after testing; needs sk_live_…)
// Needs in pipeline/.env: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Optional: SITE_URL.
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "../library/env.mjs";

loadEnv();
const env = (k) => process.env[k] || "";
const live = process.argv.includes("--live");
const key = env("STRIPE_SECRET_KEY");
if (!key) { console.error("Add STRIPE_SECRET_KEY to pipeline/.env (sk_test_… from Stripe → Developers → API keys)."); process.exit(1); }
if (key.startsWith("pk_")) { console.error("That's the PUBLISHABLE key (pk_…). Use the SECRET key (sk_test_…): Stripe → API keys → Standard keys → Secret key → Reveal."); process.exit(1); }
if (key.startsWith("rk_")) { console.error("That's a restricted key (rk_…). Use the standard SECRET key (sk_test_…)."); process.exit(1); }
if (!/^sk_(test|live)_/.test(key)) { console.error("STRIPE_SECRET_KEY should start with sk_test_ (test) or sk_live_ (live)."); process.exit(1); }
if (key.startsWith("sk_live_") && !live) { console.error("That's a LIVE key. Test with sk_test_… first, then run again with --live."); process.exit(1); }
if (!key.startsWith("sk_live_") && live) { console.error("--live needs a live key (sk_live_…)."); process.exit(1); }
if (!env("SUPABASE_URL") || !env("SUPABASE_SERVICE_ROLE_KEY")) { console.error("Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to pipeline/.env."); process.exit(1); }

const stripe = new Stripe(key);
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const mode = live ? "LIVE" : "TEST";
const cents = (eur) => Math.round(Number(eur) * 100);
console.log(`\nStripe setup · ${mode} mode\n`);

async function product(id, name, description) {
  try {
    const p = await stripe.products.retrieve(id);
    if (p.name !== name || (p.description || "") !== (description || "") || !p.active) await stripe.products.update(id, { name, description: description || "", active: true });
    return id;
  } catch (e) {
    if (e.statusCode !== 404) throw e;
    await stripe.products.create({ id, name, description: description || undefined, metadata: { scp: "1" } });
    return id;
  }
}
// One price per amount (Stripe prices are immutable): reuse it by lookup key, otherwise create it
async function price(productId, lookup, amount, recurring) {
  const { data } = await stripe.prices.list({ lookup_keys: [lookup], limit: 1 });
  if (data[0]) return data[0].id;
  const p = await stripe.prices.create({
    product: productId, currency: "eur", unit_amount: amount, tax_behavior: "inclusive", lookup_key: lookup,
    ...(recurring ? { recurring: { interval: recurring } } : {}), metadata: { scp: "1" },
  });
  return p.id;
}
async function setConfig(k, value) {
  const { error } = await db.from("stripe_config").upsert({ key: k, value });
  if (error) throw new Error(`stripe_config: ${error.message} — run supabase/stripe.sql first`);
}

// ---------- Plans: created from Super Admin → Memberships → Sync with Stripe (stripe-admin) ----------
console.log("· Membership plans and prices: use Super Admin → Memberships → Plans → \"Sync with Stripe\".");

// ---------- AI packs ----------
const { data: packs, error: ke } = await db.from("ai_packs").select("*").order("sort");
if (ke) throw new Error(`ai_packs: ${ke.message}`);
for (const k of packs) {
  if (!k.active) continue;
  const prodId = await product(`scp_pack_${k.key}`, `SCP · ${k.name}`, `${k.units} AI analyses`);
  const id = await price(prodId, `scp_pack_${k.key}_${cents(k.price)}`, cents(k.price), null);
  const { error } = await db.from("ai_packs").update({ stripe_price: id, updated_at: new Date().toISOString() }).eq("key", k.key);
  if (error) throw error;
  console.log(`✓ ${k.name}: €${k.price} (${k.units} analyses)`);
}

// ---------- VAT shown on invoices: IVA 21% included in the price ----------
const rates = await stripe.taxRates.list({ active: true, limit: 100 });
let rate = rates.data.find((r) => r.metadata?.scp === "iva21");
if (!rate) rate = await stripe.taxRates.create({ display_name: "IVA", percentage: 21, inclusive: true, country: "ES", jurisdiction: "ES", description: "IVA 21% (included)", metadata: { scp: "iva21" } });
await setConfig("tax_rate", rate.id);
console.log(`✓ VAT: IVA 21% included (${rate.id})`);

// ---------- Customer portal: change plan / monthly ↔ yearly, card, invoices, cancel at period end ----------
const site = (env("SITE_URL") || "https://sportscontentplaybook.com").split(",")[0].replace(/\/$/, "");
const portal = {
  business_profile: { headline: "Sports Content Playbook · manage your plan", privacy_policy_url: `${site}/`, terms_of_service_url: `${site}/` },
  default_return_url: `${site}/profile.html#billing`,
  features: {
    customer_update: { enabled: true, allowed_updates: ["email", "address", "tax_id", "name"] },
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_cancel: { enabled: true, mode: "at_period_end", cancellation_reason: { enabled: true, options: ["too_expensive", "missing_features", "unused", "switched_service", "other"] } },
    subscription_update: { enabled: false },   // plan changes: Account → Billing (keeps the day-1 rule)
  },
  metadata: { scp: "1" },
};
const { data: existingPortals } = await stripe.billingPortal.configurations.list({ limit: 100 });
const mine = existingPortals.find((c) => c.metadata?.scp === "1");
const portalConfig = mine ? await stripe.billingPortal.configurations.update(mine.id, portal) : await stripe.billingPortal.configurations.create(portal);
await setConfig("portal_config", portalConfig.id);
console.log(`✓ Customer portal (${portalConfig.id})`);

// ---------- Webhook → Supabase Edge Function ----------
const hook = `${env("SUPABASE_URL").replace(/\/$/, "")}/functions/v1/stripe-webhook`;
const events = ["checkout.session.completed", "checkout.session.async_payment_succeeded",
  "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "customer.subscription.paused",
  "customer.subscription.resumed", "customer.subscription.pending_update_applied", "customer.subscription.pending_update_expired",
  "customer.subscription.trial_will_end", "invoice.created", "invoice.finalized", "invoice.updated", "invoice.paid", "invoice.payment_succeeded",
  "invoice.payment_failed", "invoice.payment_action_required", "invoice.voided", "invoice.marked_uncollectible",
  "subscription_schedule.created", "subscription_schedule.updated", "subscription_schedule.released", "subscription_schedule.canceled",
  "subscription_schedule.completed", "customer.updated"];
const { data: hooks } = await stripe.webhookEndpoints.list({ limit: 100 });
const existing = hooks.find((h) => h.url === hook);
if (existing) {
  await stripe.webhookEndpoints.update(existing.id, { enabled_events: events });
  console.log(`✓ Webhook already exists → ${hook}\n  (its signing secret is in Stripe → Developers → Webhooks → the endpoint → "Signing secret")`);
} else {
  const created = await stripe.webhookEndpoints.create({ url: hook, enabled_events: events, description: "SCP → Supabase stripe-webhook" });
  console.log(`✓ Webhook created → ${hook}`);
  console.log(`\n  Signing secret (shown only now — save it as a Supabase secret):\n  supabase secrets set STRIPE_WEBHOOK_SECRET=${created.secret}\n`);
}

console.log(`\nDone (${mode}). Next: Super Admin → Memberships → Plans → "Sync all plans with Stripe".\n`);
