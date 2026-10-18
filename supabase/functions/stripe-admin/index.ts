// Supabase Edge Function "stripe-admin": Super Admin → Memberships actions that talk to Stripe (superadmins only).
//   sync_plan { plan } / sync_all     → Stripe Product + a Stripe Price for every new price version (EUR / USD,
//                                       monthly / yearly, VAT included); replaced prices stop being sold in Stripe
//                                       (customers on them keep paying them)
//   sync_discount { id }              → Stripe coupon + promotion code;   disable_discount { id } → stops new uses
//   subscriber { user }               → the member as Stripe has them (customer, subscriptions, invoices, card)
//   reconcile { user? }               → re-read from Stripe and fix SCP (one member or everyone); differences reported
//   verify_import { batch }           → MemberPress: check each Stripe subscription exists in THIS account and matches
//   create_accounts { batch }         → MemberPress: create SCP accounts (no password, no e-mail sent) for active rows
// Nothing here charges a customer or changes an existing subscription's price.
import { audit, cents, CORS, isoOf, json, rest, rpc, setting, stripe, superadmin } from "../_shared/stripe.ts";
import { syncSubscription } from "../_shared/sync.ts";
import { reconcile } from "../_shared/reconcile.ts";
import { env } from "../_shared/stripe.ts";

async function syncPlan(key: string, actor: string) {
  const [plan] = await rest(`plans?select=key,name,description,active,archived_at,stripe_product_id&key=eq.${encodeURIComponent(key)}`);
  if (!plan) throw new Error(`Plan ${key} not found`);
  const productData = { name: `SCP · ${plan.name}`, description: plan.description || undefined, active: !plan.archived_at, metadata: { plan_key: plan.key } };
  let product = plan.stripe_product_id;
  if (product) await stripe.products.update(product, productData);
  else {
    product = (await stripe.products.create({ ...productData, tax_code: "txcd_10103001" /* SaaS */ })).id;
    await rest(`plans?key=eq.${plan.key}`, { method: "PATCH", body: JSON.stringify({ stripe_product_id: product }) });
  }
  const created: string[] = [], retired: string[] = [];
  const prices = await rest(`membership_prices?select=id,currency,interval,amount,stripe_price_id,active,legacy&plan_key=eq.${plan.key}&legacy=eq.false`);
  for (const p of prices) {
    if (p.active && !p.stripe_price_id) {
      const sp = await stripe.prices.create({ product, currency: p.currency, unit_amount: Math.round(Number(p.amount) * 100), recurring: { interval: p.interval },
        tax_behavior: p.currency === "usd" ? "exclusive" : "inclusive", nickname: `${plan.name} · ${p.interval === "year" ? "yearly" : "monthly"} · ${p.currency.toUpperCase()}`,
        metadata: { plan_key: plan.key, scp_price_id: String(p.id) } }, { idempotencyKey: `scp-price-${p.id}` });
      await rest(`membership_prices?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify({ stripe_price_id: sp.id }) });
      if (p.currency === "eur") await rest(`plans?key=eq.${plan.key}`, { method: "PATCH", body: JSON.stringify(p.interval === "year" ? { stripe_price_year: sp.id } : { stripe_price_month: sp.id }) });
      created.push(sp.id);
    } else if (!p.active && p.stripe_price_id) {
      const sp = await stripe.prices.retrieve(p.stripe_price_id);
      if (sp.active) { await stripe.prices.update(p.stripe_price_id, { active: false }); retired.push(sp.id); }
    }
  }
  await audit(actor, "stripe.plan_synced", null, plan.key, { product, created, retired });
  return { plan: plan.key, product, created, retired };
}

async function syncDiscount(id: string, actor: string) {
  const [d] = await rest(`billing_discounts?id=eq.${id}`);
  if (!d) throw new Error("Discount not found");
  if (!d.stripe_coupon_id) {
    const products = d.plan_keys?.length ? (await rest(`plans?select=stripe_product_id&key=in.(${d.plan_keys.map(encodeURIComponent).join(",")})`)).map((p: { stripe_product_id: string }) => p.stripe_product_id).filter(Boolean) : [];
    if (d.plan_keys?.length && products.length !== d.plan_keys.length) throw new Error("Sync the plans with Stripe first");
    const amount = d.kind === "amount";
    const base = amount ? (d.amount_off_eur ? { amount_off: Math.round(d.amount_off_eur * 100), currency: "eur" } : { amount_off: Math.round(d.amount_off_usd * 100), currency: "usd" }) : { percent_off: Number(d.percent_off) };
    const coupon = await stripe.coupons.create({
      name: d.name.slice(0, 40), ...base,
      ...(amount && d.amount_off_eur && d.amount_off_usd ? { currency_options: { usd: { amount_off: Math.round(d.amount_off_usd * 100) } } } : {}),
      duration: d.duration, ...(d.duration === "repeating" ? { duration_in_months: d.duration_months } : {}),
      ...(products.length ? { applies_to: { products } } : {}),
      ...(d.max_redemptions ? { max_redemptions: d.max_redemptions } : {}),
      ...(d.expires_at ? { redeem_by: Math.floor(new Date(d.expires_at).getTime() / 1000) } : {}),
      metadata: { scp_discount_id: d.id },
    }, { idempotencyKey: `scp-coupon-${d.id}` });
    const promo = await stripe.promotionCodes.create({ coupon: coupon.id, code: d.code, active: d.active,
      ...(d.max_redemptions ? { max_redemptions: d.max_redemptions } : {}), ...(d.expires_at ? { expires_at: Math.floor(new Date(d.expires_at).getTime() / 1000) } : {}),
      metadata: { scp_discount_id: d.id } }, { idempotencyKey: `scp-promo-${d.id}` });
    await rest(`billing_discounts?id=eq.${d.id}`, { method: "PATCH", body: JSON.stringify({ stripe_coupon_id: coupon.id, stripe_promotion_code_id: promo.id }) });
    await audit(actor, "stripe.discount_created", null, d.id, { coupon: coupon.id, promotion_code: promo.id });
    return { coupon: coupon.id, promotion_code: promo.id };
  }
  await stripe.promotionCodes.update(d.stripe_promotion_code_id, { active: d.active });
  await audit(actor, "stripe.discount_updated", null, d.id, { active: d.active });
  return { updated: true };
}

async function subscriber(user: string) {
  const [c] = await rest(`stripe_customers?select=customer_id&user_id=eq.${user}`);
  if (!c) return { customer: null };
  const customer = await stripe.customers.retrieve(c.customer_id, { expand: ["invoice_settings.default_payment_method"] });
  const subs = await stripe.subscriptions.list({ customer: c.customer_id, status: "all", limit: 10 });
  const invoices = await stripe.invoices.list({ customer: c.customer_id, limit: 12 });
  const live = env("STRIPE_SECRET_KEY").startsWith("sk_live");
  const dash = `https://dashboard.stripe.com${live ? "" : "/test"}`;
  return {
    customer: { id: c.customer_id, url: `${dash}/customers/${c.customer_id}`, // deno-lint-ignore no-explicit-any
      email: (customer as any).email, currency: (customer as any).currency, balance: cents((customer as any).balance), deleted: (customer as any).deleted || false },
    subscriptions: subs.data.map((s) => ({ id: s.id, url: `${dash}/subscriptions/${s.id}`, status: s.status, price: s.items.data[0]?.price?.id,
      amount: cents(s.items.data[0]?.price?.unit_amount), currency: s.currency, interval: s.items.data[0]?.price?.recurring?.interval,
      // deno-lint-ignore no-explicit-any
      current_period_end: isoOf((s as any).current_period_end ?? (s.items.data[0] as any)?.current_period_end), cancel_at_period_end: s.cancel_at_period_end,
      trial_end: isoOf(s.trial_end), schedule: typeof s.schedule === "string" ? s.schedule : s.schedule?.id || null })),
    invoices: invoices.data.map((i) => ({ id: i.id, number: i.number, status: i.status, total: cents(i.total), currency: i.currency, created: isoOf(i.created), url: i.hosted_invoice_url })),
  };
}

async function verifyImport(batch: string, actor: string) {
  const recs = await rest(`memberpress_import_records?select=id,stripe_subscription_id,stripe_customer_id,link_status&batch_id=eq.${batch}&stripe_subscription_id=not.is.null&link_status=in.(pending,needs_account,needs_specific_migration,unlinked)`);
  let ok = 0, other = 0, missing = 0, canceled = 0;
  for (const r of recs) {
    try {
      const s = await stripe.subscriptions.retrieve(r.stripe_subscription_id);
      const cus = typeof s.customer === "string" ? s.customer : s.customer.id;
      const price = s.items.data[0]?.price;
      if (r.stripe_customer_id && r.stripe_customer_id !== cus) {
        other++; await rpc("billing_mp_set_check", { p_record: r.id, p_check: { ok: false, reason: `Belongs to customer ${cus}, not ${r.stripe_customer_id}` }, p_status: "needs_specific_migration" }); continue;
      }
      if (["canceled", "incomplete_expired"].includes(s.status)) {
        canceled++; await rpc("billing_mp_set_check", { p_record: r.id, p_check: { ok: false, reason: `Canceled in Stripe (${s.status})`, status: s.status }, p_status: "skipped" }); continue;
      }
      ok++;
      await rpc("billing_mp_set_check", { p_record: r.id, p_check: { ok: true, customer: cus, status: s.status, price: price?.id, product: typeof price?.product === "string" ? price.product : price?.product?.id,
        currency: s.currency, interval: price?.recurring?.interval, amount: cents(price?.unit_amount), start_date: isoOf(s.start_date),
        // deno-lint-ignore no-explicit-any
        current_period_start: isoOf((s as any).current_period_start ?? (s.items.data[0] as any)?.current_period_start), current_period_end: isoOf((s as any).current_period_end ?? (s.items.data[0] as any)?.current_period_end),
        trial_end: isoOf(s.trial_end), cancel_at_period_end: s.cancel_at_period_end, cancel_at: isoOf(s.cancel_at) } });
    } catch (_) {
      missing++; await rpc("billing_mp_set_check", { p_record: r.id, p_check: { ok: false, reason: "No such subscription in this Stripe account (MemberPress may use another account)" }, p_status: "needs_specific_migration" });
    }
  }
  await audit(actor, "migration.verified", null, batch, { ok, other_customer: other, missing, canceled });
  return { ok, other_customer: other, missing, canceled };
}

async function createAccounts(batch: string, actor: string) {
  const recs = await rest(`memberpress_import_records?select=id,email,first_name,last_name&batch_id=eq.${batch}&link_status=eq.needs_account&validation=neq.error`);
  let created = 0, existed = 0;
  for (const r of recs) {
    const res = await fetch(`${env("SUPABASE_URL")}/auth/v1/admin/users`, { method: "POST",
      headers: { apikey: env("SUPABASE_SERVICE_ROLE_KEY"), Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: r.email, email_confirm: true, user_metadata: { first_name: r.first_name || undefined, last_name: r.last_name || undefined, origin: "memberpress" } }) });
    if (res.ok) created++; else existed++;
  }
  await audit(actor, "migration.accounts_created", null, batch, { created, existed });
  return { created, existed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const admin = await superadmin(req);
  if (!admin) return json({ error: "Only superadmins" }, 403);
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "mode") return json({ mode: env("STRIPE_SECRET_KEY").startsWith("sk_live") ? "live" : env("STRIPE_SECRET_KEY").startsWith("sk_test") ? "test" : "none", timezone: await setting("timezone") });
    if (!env("STRIPE_SECRET_KEY").startsWith("sk_") && body.action !== "create_accounts") return json({ error: "Stripe isn't connected (STRIPE_SECRET_KEY)." }, 409);
    switch (body.action) {
      case "sync_plan": return json(await syncPlan(body.plan, admin.id));
      case "sync_all": {
        const plans = await rest(`plans?select=key&archived_at=is.null`);
        const out = [];
        for (const p of plans) out.push(await syncPlan(p.key, admin.id));
        return json({ plans: out });
      }
      case "sync_discount": return json(await syncDiscount(body.id, admin.id));
      case "disable_discount":
        await rest(`billing_discounts?id=eq.${body.id}`, { method: "PATCH", body: JSON.stringify({ active: false, updated_at: new Date().toISOString() }) });
        return json(await syncDiscount(body.id, admin.id));
      case "subscriber": return json(await subscriber(body.user));
      case "reconcile": return json(await reconcile(admin.id, body.user || undefined));
      case "verify_import": return json(await verifyImport(body.batch, admin.id));
      case "create_accounts": return json(await createAccounts(body.batch, admin.id));
      default: return json({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});

