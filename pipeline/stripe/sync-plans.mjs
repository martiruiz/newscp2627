#!/usr/bin/env node
// Same as Super Admin → Memberships → Plans → "Sync with Stripe" (Edge Function stripe-admin), from the terminal:
// one Stripe product per plan and a Stripe price for every price version that isn't in Stripe yet (EUR / USD,
// monthly / yearly, VAT included). Replaced prices stop being sold in Stripe; customers on them keep paying them.
//   cd pipeline && node stripe/sync-plans.mjs [--plan all_access]      (test key)
//   node stripe/sync-plans.mjs --live                                   (only with explicit approval; live key)
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "../library/env.mjs";

loadEnv();
const key = process.env.STRIPE_SECRET_KEY || "";
const live = process.argv.includes("--live");
if (!/^sk_(test|live)_/.test(key)) { console.error("STRIPE_SECRET_KEY (sk_test_… / sk_live_…) missing in pipeline/.env"); process.exit(1); }
if (key.startsWith("sk_live_") !== live) { console.error(live ? "--live needs a live key." : "That's a LIVE key: test first, then run with --live."); process.exit(1); }
const stripe = new Stripe(key);
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const only = process.argv.includes("--plan") ? process.argv[process.argv.indexOf("--plan") + 1] : null;

const q = db.from("plans").select("key,name,description,active,archived_at,stripe_product_id").is("archived_at", null);
const { data: plans, error } = only ? await q.eq("key", only) : await q;
if (error) { console.error(/archived_at|does not exist/.test(error.message) ? "Run supabase/memberships.sql first." : error.message); process.exit(1); }
console.log(`\nSync plans · ${live ? "LIVE" : "TEST"} mode\n`);
for (const plan of plans) {
  const productData = { name: `SCP · ${plan.name}`, description: plan.description || undefined, active: !plan.archived_at, metadata: { plan_key: plan.key } };
  let product = plan.stripe_product_id;
  if (product) { try { await stripe.products.update(product, productData); } catch (e) { if (e.statusCode === 404) product = null; else throw e; } }
  if (!product) {
    product = (await stripe.products.create(productData)).id;
    await db.from("plans").update({ stripe_product_id: product }).eq("key", plan.key);
  }
  const { data: prices } = await db.from("membership_prices").select("id,currency,interval,amount,stripe_price_id,active").eq("plan_key", plan.key).eq("legacy", false);
  const created = [], retired = [];
  for (const p of prices) {
    if (p.active && !p.stripe_price_id) {
      const sp = await stripe.prices.create({ product, currency: p.currency, unit_amount: Math.round(Number(p.amount) * 100), recurring: { interval: p.interval },
        tax_behavior: p.currency === "usd" ? "exclusive" : "inclusive", nickname: `${plan.name} · ${p.interval === "year" ? "yearly" : "monthly"} · ${p.currency.toUpperCase()}`,
        metadata: { plan_key: plan.key, scp_price_id: String(p.id) } }, { idempotencyKey: `scp-price-${live ? "live" : "test"}-${p.id}` });
      await db.from("membership_prices").update({ stripe_price_id: sp.id }).eq("id", p.id);
      if (p.currency === "eur") await db.from("plans").update(p.interval === "year" ? { stripe_price_year: sp.id } : { stripe_price_month: sp.id }).eq("key", plan.key);
      created.push(`${p.currency.toUpperCase()} ${p.interval} ${p.amount}`);
    } else if (!p.active && p.stripe_price_id) {
      const sp = await stripe.prices.retrieve(p.stripe_price_id).catch(() => null);
      if (sp?.active) { await stripe.prices.update(p.stripe_price_id, { active: false }); retired.push(p.stripe_price_id); }
    }
  }
  await db.from("billing_audit_logs").insert({ action: "stripe.plan_synced", target: plan.key, details: { product, created, retired, via: "sync-plans.mjs", mode: live ? "live" : "test" } });
  console.log(`✓ ${plan.name}${created.length ? ` — new prices: ${created.join(", ")}` : " — up to date"}${retired.length ? ` — retired ${retired.length}` : ""}`);
}
console.log("\nDone. The pricing page shows these plans as payable now.\n");
