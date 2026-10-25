// Memberships tests (supabase/memberships.sql on top of every earlier migration) in an in-memory Postgres (PGlite)
// with Supabase-style stubs. Covers plans, prices, permissions by status, grants, quotas, hidden links, discounts,
// webhook application (idempotency, out-of-order, history, e-mails), invoices, RLS and the MemberPress importer.
// Nothing touches the real database or Stripe.   cd pipeline && npm run test:memberships
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { render, words, money, day } from "../../supabase/functions/_shared/email-render.js";
const ROOT = process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const db = new PGlite();
const sql = (f) => fs.readFileSync(`${ROOT}/supabase/${f}`, "utf8");

await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key, email text, created_at timestamptz default now(), raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon; create role authenticated; create role service_role;
  grant usage on schema public to anon, authenticated, service_role;
  grant usage on schema auth to anon, authenticated;
  grant select on auth.users to authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  create schema storage; create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1, '/') $$;
`);
const CHAIN = ["schema.sql", "library.sql", "admin.sql", "admin-superadmin-only.sql", "library-ideas.sql", "org.sql", "member-profile.sql", "billing.sql", "stripe.sql", "memberships.sql"];
for (const f of CHAIN) {
  try { await db.exec(sql(f)); console.log(`✓ migration ${f}`); }
  catch (e) { console.log(`✗ migration ${f}: ${e.message}`); process.exit(1); }
}
try { await db.exec(sql("memberships.sql")); console.log("✓ memberships.sql re-run is safe"); } catch (e) { console.log(`✗ re-run: ${e.message}`); process.exit(1); }

let pass = 0, fail = 0;
const check = (name, cond, extra = "") => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name} ${extra}`); } };
const throws = async (fn) => { try { await fn(); return false; } catch { return true; } };

const U = { A: "aaaaaaaa-0000-0000-0000-000000000001", B: "bbbbbbbb-0000-0000-0000-000000000002", C: "cccccccc-0000-0000-0000-000000000003",
  D: "dddddddd-0000-0000-0000-000000000004", E: "eeeeeeee-0000-0000-0000-000000000005", SUPER: "99999999-0000-0000-0000-000000000009" };
for (const [k, id] of Object.entries(U)) await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, `${k.toLowerCase()}@test.dev`]);
await db.exec(`update public.profiles set role = 'superadmin' where id = '${U.SUPER}'`);
await db.exec(`update public.profiles set preferences = '{"language": "ca"}' where id = '${U.B}'`);
await db.exec(`insert into public.content_ideas (external_id, title, url) select 'p' || g, 'Post ' || g, 'https://www.instagram.com/p/X' || g || '/' from generate_series(1, 10) g;`);

async function as(user, q, params = []) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role authenticated; select set_config('request.jwt.claim.sub', '${user}', true);`);
    return (await tx.query(q, params)).rows;
  });
}
const one = async (user, q, params = []) => (await as(user, q, params))[0]?.r;
const svc = async (q, params = []) => (await db.query(q, params)).rows[0]?.r;      // service role / server
const apply = (p) => svc(`select public.billing_apply_subscription($1::jsonb) r`, [JSON.stringify(p)]);
const ent = (u) => svc(`select public.entitlements($1) r`, [u]);

console.log("\n1. Plans, prices and permissions from the admin (no code)");
let r = await one(U.SUPER, `select public.admin_save_plan($1::jsonb) r`, [JSON.stringify({ key: "club_partner", name: "Club Partner", description: "Hidden plan for partner clubs",
  features: ["Everything"], visibility: "hidden", trial_days: 14, ai_monthly_units: 50, entitlements: ["library.access", "library.save_posts", "ai.access", "ai.analyze_posts"] })]);
check("superadmin creates a hidden plan", r?.key === "club_partner" && r.visibility === "hidden" && r.trial_days === 14);
check("member can't create plans", await throws(() => one(U.A, `select public.admin_save_plan('{"key":"x","name":"X"}'::jsonb) r`)));
check("anonymous can't call admin RPCs", await throws(() => db.transaction(async (tx) => { await tx.exec("set local role anon"); await tx.query("select public.admin_membership_plans()"); })));
await one(U.SUPER, `select public.admin_set_price('club_partner', 'eur', 'month', 15) r`);
await one(U.SUPER, `select public.admin_set_price('club_partner', 'usd', 'month', 17) r`);
await one(U.SUPER, `select public.admin_set_price('club_partner', 'eur', 'year', 150) r`);
r = await one(U.SUPER, `select public.admin_set_price('club_partner', 'eur', 'month', 15) r`);
check("same amount again → unchanged (no new version)", r?.unchanged === true);
await one(U.SUPER, `select public.admin_set_price('club_partner', 'eur', 'month', 18) r`);
const hist = (await db.query(`select amount, active from public.membership_prices where plan_key = 'club_partner' and currency = 'eur' and interval = 'month' order by id`)).rows;
check("price change keeps history: old inactive, new active", hist.length === 2 && !hist[0].active && hist[1].active && Number(hist[1].amount) === 18, JSON.stringify(hist));
check("EUR / USD / monthly / yearly prices stored separately", Number((await db.query(`select count(*) n from public.membership_prices where plan_key = 'club_partner' and active`)).rows[0].n) === 3);
r = await one(U.A, `select public.public_membership_plans() r`);
check("pricing lists the 4 public plans, not the hidden one", r.plans.length === 4 && !r.plans.some((p) => p.key === "club_partner"), r.plans.map((p) => p.key).join());
check("pricing shows prices from the database (EUR month + year seeded)", r.plans.find((p) => p.key === "all_access").prices.some((p) => p.currency === "eur" && p.interval === "year"));
check("no USD price invented for existing plans", !r.plans.some((p) => p.prices.some((x) => x.currency === "usd")));
check("prices not synced with Stripe are marked not ready", r.plans[0].prices.every((p) => p.ready === false));
r = await one(U.SUPER, `select public.admin_duplicate_plan('all_access', 'all_access_promo', 'All Access (promo)') r`);
check("duplicate plan: hidden, off sale, same permissions and prices", r?.visibility === "hidden" && r.entitlements.length === 8 && r.prices.length === 2);
await one(U.SUPER, `select public.admin_archive_plan('all_access_promo', true) r`);
check("archived plan is retired and off sale", (await db.query(`select active, archived_at is not null a from public.plans where key = 'all_access_promo'`)).rows[0].a === true);
await one(U.SUPER, `select public.admin_add_entitlement_key('reports.export', 'Export reports') r`);
check("new permission keys can be added", (await db.query(`select 1 from public.entitlement_keys where key = 'reports.export'`)).rows.length === 1);
check("unknown permission rejected", await throws(() => one(U.SUPER, `select public.admin_set_plan_entitlements('library', array['nope.nope']) r`)));

console.log("\n2. Access by plan and subscription status (server side)");
const sub = (u, plan, status, extra = {}) => apply({ user: u, plan, interval: "month", status, customer: `cus_${u.slice(0, 4)}`, subscription: `sub_${u.slice(0, 4)}`,
  price: "price_x", currency: "eur", amount: 9.99, started: "2026-10-01T00:00:00Z", period_end: "2026-11-01T00:00:00Z", stripe_updated: new Date().toISOString(), ...extra });
await sub(U.A, "library", "active");
let e = await ent(U.A);
check("Library: library yes, AI no, planner no", e.has_library && !e.has_ai && !e.has_planner, JSON.stringify(e.entitlements));
check("Library: server refuses an AI unlock", (await one(U.A, `select public.unlock_analysis(1) r`)).status === "no_access");
check("Library: planner tables refuse writes (RLS)", await throws(() => as(U.A, `insert into public.org_plans (user_id, name) values ('${U.A}', 'x')`)));
await sub(U.A, "library_ai", "active");
e = await ent(U.A);
check("Library + AI: AI yes, planner no, 30 analyses", e.has_ai && !e.has_planner && e.monthly_left === 30);
check("Library + AI: unlock allowed", (await one(U.A, `select public.unlock_analysis(1) r`)).status !== "no_access");
await sub(U.A, "library_planner", "active");
e = await ent(U.A);
check("Library + Planner: planner yes, AI no", e.has_planner && !e.has_ai);
check("Library + Planner: can create a calendar", (await as(U.A, `insert into public.org_plans (user_id, name) values ('${U.A}', 'Season') returning id`)).length === 1);
await sub(U.A, "all_access", "active");
e = await ent(U.A);
check("Full Access: everything", e.has_library && e.has_ai && e.has_planner && e.entitlements.includes("premium_features.access"));
await sub(U.A, "all_access", "past_due");
check("past_due keeps access while Stripe retries", (await ent(U.A)).has_ai);
await db.exec(`update public.billing_settings set value = '{"keep_access_while_retrying": false}' where key = 'dunning'`);
check("past_due without grace (setting) → no access", !(await ent(U.A)).has_ai);
await db.exec(`update public.billing_settings set value = '{"keep_access_while_retrying": true}' where key = 'dunning'`);
for (const st of ["unpaid", "paused", "canceled", "incomplete", "incomplete_expired"]) {
  await sub(U.A, "all_access", st);
  const x = await ent(U.A);
  check(`${st} → no premium access`, !x.has_ai && !x.has_planner && !x.has_library);
}
check("canceled member keeps their calendars (data not deleted)", Number((await db.query(`select count(*) n from public.org_plans where user_id = '${U.A}'`)).rows[0].n) === 1);
check("…but can't read them while without the planner (RLS)", (await as(U.A, `select * from public.org_plans`)).length === 0);
await sub(U.A, "all_access", "active");
check("subscribes again → calendars are back", (await as(U.A, `select * from public.org_plans`)).length === 1);
await sub(U.A, "all_access", "active", { cancel_at_period_end: true, cancel_at: "2026-11-01T00:00:00Z" });
check("scheduled cancellation keeps access until the end", (await ent(U.A)).has_ai);
check("member asking for someone else's permissions → false", (await one(U.B, `select public.has_entitlement('library.access', '${U.A}') r`)) === false);
check("library gate off until enforce_library_access is on", (await one(U.C, `select public.library_allowed() r`)) === true);
await db.exec(`update public.billing_settings set value = 'true' where key = 'enforce_library_access'`);
check("library gate on: member without plan refused", (await one(U.C, `select public.library_allowed() r`)) === false);
check("library gate on: member with plan allowed", (await one(U.A, `select public.library_allowed() r`)) === true);
await db.exec(`update public.billing_settings set value = 'false' where key = 'enforce_library_access'`);

console.log("\n3. AI quotas");
await one(U.SUPER, `select public.admin_save_plan($1::jsonb) r`, [JSON.stringify({ key: "unlimited_ai", name: "Unlimited AI", visibility: "hidden", ai_unlimited: true, entitlements: ["library.access", "ai.access", "ai.analyze_posts"] })]);
await sub(U.D, "unlimited_ai", "active");
e = await ent(U.D);
check("unlimited plan → no quota limit", e.ai_unlimited === true && e.monthly_left >= 999999);
await sub(U.E, "library_ai", "trialing", { trial_end: "2026-10-08T00:00:00Z" });
check("trial caps AI to the trial allowance (5)", (await ent(U.E)).monthly_limit === 5);
for (let i = 1; i <= 5; i++) await one(U.E, `select public.unlock_analysis(${i}) r`);
check("6th analysis in the trial → no credits", (await one(U.E, `select public.unlock_analysis(6) r`)).status === "no_credits");
check("reopening an analysis already unlocked costs nothing", (await one(U.E, `select public.unlock_analysis(1) r`)).charged === false);

console.log("\n4. Grants (superadmin, with reason, audited)");
const g = await one(U.SUPER, `select public.admin_grant_access('${U.C}', 'library_planner', null, now() + interval '30 days', 'Partner trial for the season') r`);
e = await ent(U.C);
check("granted plan gives its permissions", e.has_planner && e.status === "granted");
check("grant needs a reason", await throws(() => one(U.SUPER, `select public.admin_grant_access('${U.C}', 'library', null, null, '') r`)));
await one(U.SUPER, `select public.admin_revoke_grant('${g}', 'season over') r`);
check("revoked grant → access gone", !(await ent(U.C)).has_planner);
check("grant and revoke are in the audit log", Number((await db.query(`select count(*) n from public.billing_audit_logs where target_user = '${U.C}' and action in ('access.granted', 'access.revoked')`)).rows[0].n) === 2);
const ent1 = (await db.query(`select public.admin_grant_access('${U.C}', null, 'ai.access', null, 'Support case 42') r`).catch(() => ({ rows: [] }))).rows;
check("service role can grant a single permission", (await ent(U.C)).entitlements.includes("ai.access") || ent1.length === 1);

console.log("\n5. Hidden memberships (private links)");
const link = await one(U.SUPER, `select public.admin_create_private_link('club_partner', 'Partner clubs', now() + interval '7 days', 2) r`);
check("token is long and random (64 hex)", /^[0-9a-f]{64}$/.test(link.token));
check("only the hash is stored", (await db.query(`select count(*) n from public.private_membership_links where token_hash = $1`, [link.token])).rows[0].n == 0);
r = await one(U.A, `select public.private_membership($1) r`, [link.token]);
check("valid token → hidden plan with its prices", r.ok && r.plan.key === "club_partner" && r.plan.prices.length === 3);
check("anonymous visitors can open the link too", (await db.transaction(async (tx) => { await tx.exec("set local role anon"); return (await tx.query(`select public.private_membership($1) r`, [link.token])).rows[0].r; })).ok);
check("wrong token → refused", !(await one(U.A, `select public.private_membership('deadbeef') r`)).ok);
await sub(U.B, "club_partner", "active", { private_link: link.id });
await sub(U.C, "club_partner", "trialing", { private_link: link.id, subscription: "sub_cccc2" });
check("max uses reached → link refused", !(await one(U.A, `select public.private_membership($1) r`, [link.token])).ok);
const l2 = await one(U.SUPER, `select public.admin_create_private_link('club_partner', 'Expired', now() - interval '1 day') r`);
check("expired link refused", !(await one(U.A, `select public.private_membership($1) r`, [l2.token])).ok);
const l3 = await one(U.SUPER, `select public.admin_create_private_link('club_partner', 'To revoke') r`);
await one(U.SUPER, `select public.admin_revoke_private_link('${l3.id}') r`);
check("revoked link refused", !(await one(U.A, `select public.private_membership($1) r`, [l3.token])).ok);
const l4 = await one(U.SUPER, `select public.admin_regenerate_private_link('${link.id}') r`);
check("regenerate → new token works, old one doesn't", (await one(U.A, `select public.private_membership($1) r`, [l4.token])).ok && l4.token !== link.token);
const links = await one(U.SUPER, `select public.admin_private_links() r`);
check("links list shows uses and subscriptions", links.find((x) => x.id === link.id)?.subscriptions === 2);
check("members can't read the links table", (await as(U.A, `select * from public.private_membership_links`)).length === 0);

console.log("\n6. Discounts (server-side checks)");
const did = await one(U.SUPER, `select public.admin_save_discount($1::jsonb) r`, [JSON.stringify({ name: "Black Friday", code: "bf26", kind: "percent", percent_off: 30, duration: "repeating", duration_months: 3,
  plan_keys: ["all_access"], currencies: ["eur"], max_per_customer: 1 })]);
r = await one(U.A, `select public.check_discount('BF26', 'all_access', 'eur', 'month') r`);
check("code not in Stripe yet → refused", r.ok === false);
await db.exec(`update public.billing_discounts set stripe_coupon_id = 'co_1', stripe_promotion_code_id = 'promo_1' where id = '${did}'`);
r = await one(U.A, `select public.check_discount('bf26', 'all_access', 'eur', 'month') r`);
check("valid code (case-insensitive) → 30% for 3 months", r.ok && Number(r.percent_off) === 30 && r.duration_months === 3);
check("the Stripe promotion code id isn't shown to members", r.promotion_code === undefined);
check("other plan → refused", !(await one(U.A, `select public.check_discount('bf26', 'library', 'eur', 'month') r`)).ok);
check("other currency → refused", !(await one(U.A, `select public.check_discount('bf26', 'all_access', 'usd', 'month') r`)).ok);
await db.exec(`insert into public.billing_discount_redemptions (discount_id, user_id, checkout_session) values ('${did}', '${U.A}', 'cs_1')`);
check("used once by this customer → refused (limit 1)", !(await one(U.A, `select public.check_discount('bf26', 'all_access', 'eur', 'month') r`)).ok);
await db.exec(`update public.billing_discounts set expires_at = now() - interval '1 minute' where id = '${did}'`);
check("expired code → refused", !(await one(U.B, `select public.check_discount('bf26', 'all_access', 'eur', 'month') r`)).ok);
check("100% discount allowed", (await one(U.SUPER, `select public.admin_save_discount('{"name":"Partners","code":"FREE100","kind":"percent","percent_off":100,"duration":"forever"}'::jsonb) r`)) !== null);
check("bad discount (repeating without months) rejected", await throws(() => one(U.SUPER, `select public.admin_save_discount('{"name":"x","code":"X1","kind":"percent","percent_off":10,"duration":"repeating"}'::jsonb) r`)));

console.log("\n7. Webhook application: history, idempotency, out of order, e-mails");
const T0 = "2026-10-10T10:00:00Z", T1 = "2026-10-10T10:05:00Z", T2 = "2026-10-10T10:10:00Z";
const base = { user: U.D, plan: "library_ai", interval: "month", customer: "cus_D", subscription: "sub_D1", price: "price_m", currency: "eur", amount: 19.99,
  started: T0, period_end: "2026-10-17T10:00:00Z", trial_end: "2026-10-17T10:00:00Z" };
await db.exec(`delete from public.subscriptions where user_id = '${U.D}'`);
await db.exec(`delete from public.subscription_events where user_id = '${U.D}'; delete from public.email_delivery_logs where user_id = '${U.D}'`);
await db.exec(`insert into public.stripe_customers (user_id, customer_id) values ('${U.D}', 'cus_D')`);
await apply({ ...base, status: "trialing", stripe_updated: T0, event_id: "evt_1" });
check("new trial → 'trial_started' event", Number((await db.query(`select count(*) n from public.subscription_events where user_id = '${U.D}' and kind = 'trial_started'`)).rows[0].n) === 1);
check("confirmation e-mail queued once", Number((await db.query(`select count(*) n from public.email_delivery_logs where user_id = '${U.D}' and template = 'subscription_confirmed'`)).rows[0].n) === 1);
await apply({ ...base, status: "trialing", stripe_updated: T0, event_id: "evt_1" });
check("same event twice → no duplicate history or e-mail", Number((await db.query(`select count(*) n from public.subscription_events where user_id = '${U.D}'`)).rows[0].n) === 1
  && Number((await db.query(`select count(*) n from public.email_delivery_logs where user_id = '${U.D}'`)).rows[0].n) === 1);
check("trial marks the customer's trial as used", (await db.query(`select trial_used from public.stripe_customers where user_id = '${U.D}'`)).rows[0].trial_used === true);
await apply({ ...base, status: "active", stripe_updated: T2, event_id: "evt_3", period_end: "2026-11-01T00:00:00Z" });
r = await apply({ ...base, status: "trialing", stripe_updated: T1, event_id: "evt_2" });
check("older event after a newer one → ignored", r.applied === false && (await db.query(`select status from public.subscriptions where user_id = '${U.D}'`)).rows[0].status === "active");
check("trial → active recorded as conversion", Number((await db.query(`select count(*) n from public.subscription_events where user_id = '${U.D}' and kind = 'trial_converted'`)).rows[0].n) === 1);
await apply({ ...base, status: "active", stripe_updated: "2026-10-12T00:00:00Z", event_id: "evt_4", cancel_at_period_end: true, cancel_at: "2026-11-01T00:00:00Z", period_end: "2026-11-01T00:00:00Z" });
check("cancel scheduled → event + cancellation e-mail", Number((await db.query(`select count(*) n from public.email_delivery_logs where user_id = '${U.D}' and template = 'cancellation_confirmed'`)).rows[0].n) === 1);
await apply({ ...base, status: "active", stripe_updated: "2026-10-13T00:00:00Z", event_id: "evt_5", cancel_at_period_end: false, period_end: "2026-11-01T00:00:00Z" });
check("reactivated → event + e-mail", Number((await db.query(`select count(*) n from public.subscription_events where user_id = '${U.D}' and kind = 'reactivated'`)).rows[0].n) === 1);
await apply({ ...base, plan: "all_access", amount: 39.99, status: "active", stripe_updated: "2026-10-14T00:00:00Z", event_id: "evt_6", period_end: "2026-11-01T00:00:00Z" });
check("upgrade → plan_changed + access updated", (await ent(U.D)).has_planner && Number((await db.query(`select count(*) n from public.subscription_events where user_id = '${U.D}' and kind = 'plan_changed'`)).rows[0].n) === 1);
check("plan change doesn't restart the AI cycle", (await db.query(`select started_at from public.subscriptions where user_id = '${U.D}'`)).rows[0].started_at.toISOString() === new Date(T0).toISOString());
await svc(`select public.billing_record_invoice($1::jsonb) r`, [JSON.stringify({ id: "in_1", user: U.D, customer: "cus_D", subscription: "sub_D1", status: "open", currency: "eur",
  total: 39.99, amount_due: 39.99, amount_paid: 0, attempt_count: 1, hosted_invoice_url: "https://invoice", event: "payment_failed", event_id: "evt_7" })]);
await apply({ ...base, plan: "all_access", amount: 39.99, status: "past_due", stripe_updated: "2026-11-01T01:00:00Z", event_id: "evt_8", period_end: "2026-12-01T00:00:00Z" });
check("failed payment → event + e-mail with the invoice link", Number((await db.query(`select count(*) n from public.email_delivery_logs where user_id = '${U.D}' and template = 'payment_failed' and vars ->> 'invoice_url' = 'https://invoice'`)).rows[0].n) === 1);
await svc(`select public.billing_record_invoice($1::jsonb) r`, [JSON.stringify({ id: "in_1", user: U.D, status: "paid", currency: "eur", total: 39.99, amount_due: 39.99, amount_paid: 39.99, paid_at: "2026-11-03T00:00:00Z", event: "paid" })]);
await apply({ ...base, plan: "all_access", amount: 39.99, status: "active", stripe_updated: "2026-11-03T00:00:01Z", event_id: "evt_9", period_end: "2026-12-01T00:00:00Z" });
check("payment recovered → 'recovered' event + one recovery e-mail", Number((await db.query(`select count(*) n from public.subscription_events where user_id = '${U.D}' and kind = 'recovered'`)).rows[0].n) === 1
  && Number((await db.query(`select count(*) n from public.email_delivery_logs where user_id = '${U.D}' and template = 'payment_recovered'`)).rows[0].n) >= 1);
check("invoice stored once, updated to paid", (await db.query(`select status, amount_paid from public.billing_invoices where id = 'in_1'`)).rows[0].status === "paid");
check("member sees own invoices only", (await as(U.D, `select id from public.billing_invoices`)).length === 1 && (await as(U.A, `select id from public.billing_invoices`)).length === 0);
check("e-mail language follows the profile (ca)", (await db.query(`select public.billing_enqueue_email('plan_changed', '${U.B}', '{}'::jsonb, 'lang-test') r`)).rows[0].r !== null
  && (await db.query(`select locale from public.email_delivery_logs where dedupe_key = 'lang-test'`)).rows[0].locale === "ca");
check("members can't read e-mail logs or webhook events", (await as(U.D, `select * from public.email_delivery_logs`)).length === 0 && (await as(U.D, `select * from public.stripe_events`)).length === 0);
check("members can't call webhook functions", await throws(() => one(U.D, `select public.billing_apply_subscription('{}'::jsonb) r`)));

console.log("\n8. Webhook event log");
check("first delivery → run", (await svc(`select public.billing_event_begin('evt_x', 'invoice.paid', 'in_9', false, now()) r`)) === "run");
check("parallel duplicate while processing → skip", (await svc(`select public.billing_event_begin('evt_x', 'invoice.paid', 'in_9', false, now()) r`)) === "skip");
await svc(`select public.billing_event_end('evt_x', 'failed', 'timeout') r`);
check("after a failure the retry runs again", (await svc(`select public.billing_event_begin('evt_x', 'invoice.paid', 'in_9', false, now()) r`)) === "run");
await svc(`select public.billing_event_end('evt_x', 'processed') r`);
check("after success a redelivery is skipped", (await svc(`select public.billing_event_begin('evt_x', 'invoice.paid', 'in_9', false, now()) r`)) === "skip");
check("attempts counted", (await db.query(`select attempts from public.stripe_events where id = 'evt_x'`)).rows[0].attempts === 2);

console.log("\n9. Trial eligibility (one per member, exceptions)");
check("member with a past subscription isn't eligible", (await svc(`select public.billing_trial_eligible('${U.D}') r`)) === false);
check("new member is eligible", (await svc(`select public.billing_trial_eligible('${U.SUPER}') r`)) === true);
await one(U.SUPER, `select public.admin_trial_exception('${U.D}', true, 'Came back after a year') r`);
check("superadmin exception → eligible again", (await svc(`select public.billing_trial_eligible('${U.D}') r`)) === true);

console.log("\n10. Member billing area");
r = await one(U.D, `select public.my_membership() r`);
check("my_membership: plan, status, currency, invoices", r.subscription.plan === "all_access" && r.subscription.currency === "eur" && r.invoices.length === 1);
check("old profile RPC still works", (await one(U.D, `select public.my_billing() r`)).subscription.plan === "all_access");

console.log("\n11. Dashboard metrics");
await sub(U.E, "library", "active", { interval: "year", currency: "usd", amount: 120, subscription: "sub_E_year", stripe_updated: new Date(Date.now() + 1000).toISOString() });
const m = await one(U.SUPER, `select public.admin_membership_metrics(30) r`);
check("MRR by currency from paying subscriptions only", typeof m.mrr.eur === "number" && m.active >= 1 && m.trialing >= 1, JSON.stringify(m.mrr));
check("yearly counted as ÷ 12 (USD 120/year → 10 MRR, separate currency)", Number(m.mrr.usd) === 10, JSON.stringify(m.mrr));
check("members can't read metrics", await throws(() => one(U.A, `select public.admin_membership_metrics(30) r`)));

console.log("\n12. MemberPress migration");
await db.query(`insert into auth.users (id, email) values ('11111111-0000-0000-0000-00000000000a', 'mp.member@club.com'), ('11111111-0000-0000-0000-00000000000b', 'mp.second@club.com')`);
const rows = [
  { email: "MP.member@club.com", membership: "Premium", status: "active", interval: "monthly", amount: "€39.99", currency: "EUR", started_at: "2025-03-14", stripe_customer_id: "cus_mp1", stripe_subscription_id: "sub_mp1", raw: {} },
  { email: "mp.second@club.com", membership: "Basic", status: "active", interval: "yearly", amount: "99", currency: "eur", started_at: "2025-06-01", stripe_customer_id: "cus_mp2", stripe_subscription_id: "sub_mp2", raw: {} },
  { email: "nobody@club.com", membership: "Premium", status: "active", interval: "monthly", amount: "39.99", currency: "eur", stripe_subscription_id: "sub_mp3", raw: {} },
  { email: "old@club.com", membership: "Premium", status: "expired", raw: {} },
  { email: "broken", membership: "Unknown", status: "active", raw: {} },
  { email: "mp.member@club.com", membership: "Premium", status: "active", stripe_subscription_id: "sub_mp9", raw: {} },
];
const bid = await one(U.SUPER, `select public.admin_mp_stage('memberpress.csv', '{}'::jsonb, $1::jsonb) r`, [JSON.stringify(rows)]);
let b = await one(U.SUPER, `select public.admin_mp_validate('${bid}', '{"Premium": "all_access", "Basic": "library"}'::jsonb) r`);
const rec = (n) => b.records.find((x) => x.row === n);
check("e-mails normalised and matched to accounts", rec(1).has_account && rec(2).has_account && !rec(3).has_account);
check("amount parsed ('€39.99' → 39.99), interval mapped", Number(rec(1).amount) === 39.99 && rec(2).interval === "year");
check("unknown membership / bad e-mail → error", rec(5).validation === "error");
check("duplicate active rows for one e-mail → error", rec(1).validation === "error" && rec(6).validation === "error");
check("inactive rows skipped, no account → needs account", rec(4).link_status === "skipped" && rec(3).link_status === "needs_account");
// fix the duplicate (row 6 was an old export line) and re-validate
await db.exec(`update public.memberpress_import_records set mp_status = 'cancelled' where batch_id = '${bid}' and row_number = 6`);
b = await one(U.SUPER, `select public.admin_mp_validate('${bid}', '{"Premium": "all_access", "Basic": "library"}'::jsonb) r`);
let sim = await one(U.SUPER, `select public.admin_mp_simulate('${bid}') r`);
check("simulation writes nothing and needs Stripe verification first", sim.would_link === 2 && sim.not_verified_in_stripe === 2
  && Number((await db.query(`select count(*) n from public.subscriptions where origin = 'memberpress'`)).rows[0].n) === 0, JSON.stringify(sim));
r = await one(U.SUPER, `select public.admin_mp_link('${bid}') r`);
check("not verified in Stripe → nothing linked", r.linked === 0);
// stripe-admin verify_import (service role) — row 1 OK in the same account, row 2 belongs to another Stripe account
const id1 = b.records.find((x) => x.row === 1).id, id2 = b.records.find((x) => x.row === 2).id;
await svc(`select public.billing_mp_set_check(${id1}, $1::jsonb) r`, [JSON.stringify({ ok: true, customer: "cus_mp1", status: "active", price: "price_mp_premium", product: "prod_mp", currency: "eur", interval: "month", amount: 39.99, current_period_end: "2026-11-14T00:00:00Z", start_date: "2025-03-14T00:00:00Z" })]);
await svc(`select public.billing_mp_set_check(${id2}, '{"ok": false, "reason": "No such subscription in this Stripe account"}'::jsonb, 'needs_specific_migration') r`);
r = await one(U.SUPER, `select public.admin_mp_link('${bid}') r`);
check("verified row linked, other account left for a specific migration", r.linked === 1);
const mpSub = (await db.query(`select * from public.subscriptions where stripe_subscription_id = 'sub_mp1'`)).rows[0];
check("linked keeps Stripe's renewal date and price (not day 1)", mpSub.origin === "memberpress" && mpSub.current_period_end.toISOString().startsWith("2026-11-14") && Number(mpSub.amount) === 39.99);
check("linked member gets the plan's access", (await ent("11111111-0000-0000-0000-00000000000a")).has_planner);
check("legacy price mapped for future webhooks (never sold)", (await db.query(`select legacy, active from public.membership_prices where stripe_price_id = 'price_mp_premium'`)).rows[0]?.legacy === true);
check("no welcome e-mail for a migrated member", Number((await db.query(`select count(*) n from public.email_delivery_logs where dedupe_key = 'subscription_confirmed:sub_mp1' and status = 'queued'`)).rows[0].n) === 0);
r = await one(U.SUPER, `select public.admin_mp_link('${bid}') r`);
const bid2 = await one(U.SUPER, `select public.admin_mp_stage('memberpress.csv', '{}'::jsonb, $1::jsonb) r`, [JSON.stringify(rows.slice(0, 1))]);
await one(U.SUPER, `select public.admin_mp_validate('${bid2}', '{"Premium": "all_access"}'::jsonb) r`);
const idb2 = (await db.query(`select id from public.memberpress_import_records where batch_id = '${bid2}'`)).rows[0].id;
await svc(`select public.billing_mp_set_check(${idb2}, $1::jsonb) r`, [JSON.stringify({ ok: true, customer: "cus_mp1", status: "active", price: "price_mp_premium", currency: "eur", interval: "month", amount: 39.99, current_period_end: "2026-11-14T00:00:00Z" })]);
await one(U.SUPER, `select public.admin_mp_link('${bid2}') r`);
check("importing again doesn't duplicate subscriptions or customers", Number((await db.query(`select count(*) n from public.subscriptions where stripe_subscription_id = 'sub_mp1'`)).rows[0].n) === 1
  && Number((await db.query(`select count(*) n from public.stripe_customers where customer_id = 'cus_mp1'`)).rows[0].n) === 1);
check("migration steps are audited", Number((await db.query(`select count(*) n from public.billing_audit_logs where action like 'migration.%'`)).rows[0].n) >= 5);
check("members can't read import data", (await as(U.A, `select * from public.memberpress_import_records`)).length === 0);

console.log("\n13. Subscriber admin");
const list = await one(U.SUPER, `select public.admin_subscribers(null, null, null, 100) r`);
check("subscribers list with plan, status, currency, origin", list.length >= 4 && list.some((x) => x.origin === "memberpress"));
const det = await one(U.SUPER, `select public.admin_subscriber('${U.D}') r`);
check("subscriber card: history, invoices, e-mails, permissions", det.events.length >= 5 && det.invoices.length === 1 && det.emails.length >= 3 && det.entitlements.has_ai);
await one(U.SUPER, `select public.admin_add_billing_note('${U.D}', 'Called about the failed payment') r`);
check("internal note saved with author", (await one(U.SUPER, `select public.admin_subscriber('${U.D}') r`)).notes[0].author === "super@test.dev");

console.log("\n14. E-mail templates (en / ca / es)");
const tpls = (await db.query(`select key, locale, subject, body, required from public.email_templates order by key, locale`)).rows;
check("11 templates × 3 languages", tpls.length === 33, String(tpls.length));
check("the 5 essential billing e-mails can't be switched off", ["subscription_confirmed", "cancellation_confirmed", "trial_ending", "payment_failed", "payment_action_required"].every((k) => tpls.filter((t) => t.key === k).every((t) => t.required)));
let leftovers = 0, buttons = 0;
for (const t of tpls) {
  const w = words(t.locale);
  const vars = { name: "Marta", plan: "All Access", from_plan: "Library", price: money(39.99, "eur", t.locale), interval: w.month, next_charge_date: day("2026-12-01T11:00:00Z", t.locale),
    next_charge_amount: money(18.71, "eur", t.locale), trial_end: day("2026-11-17T09:30:00Z", t.locale), first_charge_amount: money(18.71, "eur", t.locale), first_charge_note: "",
    access_until: day("2026-12-01T11:00:00Z", t.locale), amount: money(39.99, "eur", t.locale), features_lost: "AI analysis", account_url: "https://scp.test/profile.html#billing",
    site_url: "https://scp.test", update_payment_url: "https://invoice.stripe.com/x" };
  const m = render(t, vars, t.locale);
  if (/\{\{|\}\}/.test(m.html + m.subject)) leftovers++;
  if (m.html.includes('href="https://')) buttons++;
}
check("every template renders without leftover {{variables}}", leftovers === 0, String(leftovers));
check("every template has its button / link", buttons === 33, String(buttons));
const evil = render({ subject: "Hi {{name}}", body: "Hello {{name}}" }, { name: "<script>alert(1)</script>" }, "en");
check("values are HTML-escaped", !evil.html.includes("<script>") && evil.html.includes("&lt;script&gt;"));
check("dates in Madrid time, localised (ca)", day("2026-11-30T23:30:00Z", "ca") === "1 de desembre de 2026" || day("2026-11-30T23:30:00Z", "ca").startsWith("1 "), day("2026-11-30T23:30:00Z", "ca"));

console.log("\n15. Team seats (one subscription, up to 5 users) and website language");
const T = { F: "ffffffff-0000-0000-0000-000000000006", G: "11111111-0000-0000-0000-000000000007", H: "22222222-0000-0000-0000-000000000008", I: "33333333-0000-0000-0000-000000000010" };
for (const [k, id] of Object.entries(T)) await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, `${k.toLowerCase()}@team.dev`]);
await db.exec(`insert into public.stripe_customers (user_id, customer_id) values ('${T.F}', 'cus_F')`);
await apply({ user: T.F, plan: "all_access", interval: "month", status: "active", customer: "cus_F", subscription: "sub_F", price: "price_aa", currency: "eur", amount: 39.99,
  started: T0, period_end: "2026-11-01T11:00:00Z", stripe_updated: T0, event_id: "evt_team_1" });
await db.exec(`update public.subscriptions set seats = 3 where user_id = '${T.F}'`);
check("someone not added has no access", !(await ent(T.G)).has_library);
r = await one(T.F, `select public.team_add('G@Team.dev') r`);
check("buyer adds a person by e-mail (any case)", r.ok === true, JSON.stringify(r));
let eg = await ent(T.G);
check("…who gets the buyer's plan", eg.plan === "all_access" && eg.has_ai && eg.has_planner && eg.source === "team" && eg.team_owner === T.F, JSON.stringify(eg));
check("…with their own AI quota", eg.monthly_left === eg.monthly_limit && eg.monthly_limit > 0);
check("the same person can't be added twice", (await one(T.F, `select public.team_add('g@team.dev') r`)).ok === false);
check("the buyer can't add themselves", (await one(T.F, `select public.team_add('f@team.dev') r`)).ok === false);
check("invalid e-mail refused", (await one(T.F, `select public.team_add('not-an-email') r`)).ok === false);
check("second person added (3 seats = buyer + 2)", (await one(T.F, `select public.team_add('h@team.dev') r`)).ok === true && (await ent(T.H)).has_library);
r = await one(T.F, `select public.team_add('i@team.dev') r`);
check("no more people than seats", r.ok === false && r.full === true);
check("someone else can't add people to a team they don't own", (await one(T.G, `select public.team_add('i@team.dev') r`)).ok === false);
let ts = await one(T.F, `select public.my_membership() r`);
check("buyer sees seats and who is on them", ts.team.role === "owner" && ts.team.seats === 3 && ts.team.members.length === 2 && ts.team.members.every((m) => m.joined && m.active) && ts.subscription.seats === 3, JSON.stringify(ts.team));
ts = await one(T.G, `select public.my_membership() r`);
check("member sees whose plan they're on", ts.team.role === "member" && ts.team.owner_email === "f@team.dev" && ts.team.plan_name === "All Access", JSON.stringify(ts.team));
check("members can't read the seats table", (await as(T.G, `select * from public.team_seats`)).length === 0);
await db.exec(`update public.subscriptions set seats = 2 where user_id = '${T.F}'`);
check("fewer seats → the newest person loses access, the first keeps it", (await ent(T.G)).has_library && !(await ent(T.H)).has_library);
await db.exec(`update public.subscriptions set seats = 3 where user_id = '${T.F}'`);
const seatH = (await db.query(`select id from public.team_seats where lower(email) = 'h@team.dev' and removed_at is null`)).rows[0].id;
check("buyer removes a person → access ends", (await one(T.F, `select public.team_remove('${seatH}') r`)).ok === true && !(await ent(T.H)).has_library);
await db.exec(`insert into public.stripe_customers (user_id, customer_id) values ('${T.G}', 'cus_G')`);
await apply({ user: T.G, plan: "library", interval: "month", status: "active", customer: "cus_G", subscription: "sub_G", price: "price_l", currency: "eur", amount: 9.99,
  started: T0, period_end: "2026-11-01T11:00:00Z", stripe_updated: T0, event_id: "evt_team_2" });
check("a member's own live subscription wins over the team plan", (await ent(T.G)).plan === "library");
await db.exec(`delete from public.subscriptions where user_id = '${T.G}'`);
const m2 = await one(U.SUPER, `select public.admin_membership_metrics(30) r`);
check("MRR counts every seat (3 × 39.99 in it)", Number(m2.mrr.eur) >= 119.97, JSON.stringify(m2.mrr));
await apply({ user: T.F, plan: "all_access", interval: "month", status: "canceled", customer: "cus_F", subscription: "sub_F", price: "price_aa", currency: "eur", amount: 39.99,
  started: T0, period_end: "2026-11-01T11:00:00Z", ended_at: T2, stripe_updated: T2, event_id: "evt_team_3" });
check("buyer's membership ends → the team loses access too", !(await ent(T.G)).has_library);
await db.exec(`update public.profiles set preferences = '{"language": "ca", "ui_language": "es"}' where id = '${U.B}'`);
await db.query(`select public.billing_enqueue_email('plan_changed', '${U.B}', '{}'::jsonb, 'lang-test-2')`);
check("e-mails use the website language first (es over content language ca)", (await db.query(`select locale from public.email_delivery_logs where dedupe_key = 'lang-test-2'`)).rows[0].locale === "es");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
