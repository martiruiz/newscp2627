// Billing / AI-unlock / planner-permission tests against the real SCP migrations, in an in-memory Postgres (PGlite)
// with Supabase-style stubs (auth.uid(), anon / authenticated roles, storage). Nothing touches the real database.
//   cd pipeline && npm run test:billing
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const db = new PGlite();
const sql = (f) => fs.readFileSync(`${ROOT}/supabase/${f}`, "utf8");

await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon; create role authenticated; create role service_role;
  grant usage on schema public to anon, authenticated, service_role;
  grant usage on schema auth to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  create schema storage; create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1, '/') $$;
`);
for (const f of ["schema.sql", "library.sql", "admin.sql", "admin-superadmin-only.sql", "library-ideas.sql", "org.sql", "member-profile.sql", "billing.sql"]) {
  try { await db.exec(sql(f)); console.log(`✓ migration ${f}`); }
  catch (e) { console.log(`✗ migration ${f}: ${e.message}`); process.exit(1); }
}
// re-running must be safe
try { await db.exec(sql("billing.sql")); console.log("✓ billing.sql re-run is safe"); } catch (e) { console.log(`✗ re-run: ${e.message}`); process.exit(1); }

// ---------- fixtures ----------
const U = { A: "aaaaaaaa-0000-0000-0000-000000000001", B: "bbbbbbbb-0000-0000-0000-000000000002", C: "cccccccc-0000-0000-0000-000000000003",
  LIB: "dddddddd-0000-0000-0000-000000000004", PLAN: "eeeeeeee-0000-0000-0000-000000000005", ALL: "ffffffff-0000-0000-0000-000000000006",
  SUPER: "99999999-0000-0000-0000-000000000009" };
for (const [k, id] of Object.entries(U)) await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, `${k.toLowerCase()}@test.dev`]);
await db.exec(`update public.profiles set role = 'superadmin' where id = '${U.SUPER}'`);
await db.exec(`insert into public.content_ideas (external_id, title, url) select 'p' || g, 'Post ' || g, 'https://www.instagram.com/p/X' || g || '/' from generate_series(1, 40) g;`);
const plan = (u, key, started = "now()") => db.exec(`insert into public.subscriptions (user_id, plan_key, started_at) values ('${u}', '${key}', ${started}) on conflict (user_id) do update set plan_key = excluded.plan_key, started_at = excluded.started_at, status = 'active'`);
await plan(U.A, "library_ai"); await plan(U.B, "library_ai"); await plan(U.C, "library_ai");
await plan(U.LIB, "library"); await plan(U.PLAN, "library_planner"); await plan(U.ALL, "all_access");

// act as a user (RLS applies) — every call in its own transaction, like PostgREST
async function as(user, q, params = []) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role authenticated; select set_config('request.jwt.claim.sub', '${user}', true);`);
    return (await tx.query(q, params)).rows;
  });
}
const unlock = async (u, post) => (await as(u, `select public.unlock_analysis($1) r`, [post]))[0].r;
const ent = async (u) => (await as(u, `select public.my_entitlements() r`))[0].r;
// the Edge Function (service role): claim → (API call) → complete / fail
let apiCalls = 0;
async function generate(post, ok = true) {
  const claimed = (await db.query(`select public.claim_generation($1, 'v1') c`, [post])).rows[0].c;
  if (!claimed) return "not-claimed";
  apiCalls++;
  if (!ok) { await db.query(`select public.fail_generation($1, 'v1', 'boom')`, [post]); return "failed"; }
  await db.query(`select public.complete_generation($1, 'v1', $2::jsonb, 'claude-opus-5-5', 1200, 900, 0.05)`, [post, JSON.stringify({ summary: `Analysis of ${post}`, hook: { text: "hook" }, whyItWorks: "x", format: {}, angle: {}, basis: "image" })]);
  return "done";
}

let pass = 0, fail = 0;
const check = (name, cond, extra = "") => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name} ${extra}`); } };

console.log("\n1-3. Two users, same post: each pays 1, only one API call, no double charge on re-open");
let r = await unlock(U.A, 1);
check("A: post not analysed yet → pending, charged", r.status === "pending" && r.charged === true, JSON.stringify(r));
check("A: second click while generating → no extra charge", (await unlock(U.A, 1)).charged === false);
check("generation claimed once", (await generate(1)) === "done");
check("second claim for same post refused (no 2nd API call)", (await generate(1)) === "not-claimed");
r = await unlock(U.A, 1);
check("A: re-open after generation → unlocked, not charged", r.status === "unlocked" && r.charged === false && r.analysis?.summary === "Analysis of 1");
check("A balance 30 → 29", (await ent(U.A)).monthly_left === 29, JSON.stringify(await ent(U.A)));
r = await unlock(U.B, 1);
check("B: stored analysis → unlocked immediately, charged", r.status === "unlocked" && r.charged === true);
check("B balance 30 → 29", (await ent(U.B)).monthly_left === 29);
check("B: re-open → free", (await unlock(U.B, 1)).charged === false && (await ent(U.B)).monthly_left === 29);
check("exactly 1 real API call for post 1", apiCalls === 1, `apiCalls=${apiCalls}`);
const reuse = (await db.query(`select user_id, reused from public.user_ai_unlocks where post_id = 1 order by unlocked_at`)).rows;
check("B's unlock marked as reused (internal metric)", reuse.find((x) => x.user_id === U.B)?.reused === true && reuse.find((x) => x.user_id === U.A)?.reused === false);

console.log("\n4. Failed generation does not keep the credit");
r = await unlock(U.A, 2);
check("A unlocks post 2 → pending (balance 28)", r.status === "pending" && (await ent(U.A)).monthly_left === 28);
await generate(2, false);
check("after failure the credit is refunded (balance 29)", (await ent(U.A)).monthly_left === 29);
check("unlock marked failed", (await as(U.A, `select status from public.user_ai_unlocks where post_id = 2`))[0].status === "failed");
r = await unlock(U.A, 2);
check("retry charges again (28) as attempt 2", r.status === "pending" && (await ent(U.A)).monthly_left === 28);
await generate(2);
check("retry succeeds, A can read it", (await unlock(U.A, 2)).status === "unlocked" && (await ent(U.A)).monthly_left === 28);

console.log("\n5. Simultaneous clicks of the same user");
const both = await Promise.all([unlock(U.C, 3), unlock(U.C, 3)]);
check("only one of two simultaneous requests charges", both.filter((x) => x.charged).length === 1, JSON.stringify(both.map((x) => [x.status, x.charged])));
check("C balance 30 → 29 (one consumption)", (await ent(U.C)).monthly_left === 29);
const dupe = await db.query(`insert into public.user_ai_unlocks (user_id, post_id, status, source) values ($1, 3, 'pending', 'subscription') on conflict do nothing returning id`, [U.C]);
check("database refuses a second unlock row for the same user + post", dupe.rows.length === 0);
const ledgerDupe = await db.query(`select count(*)::int n from public.ai_credit_ledger where user_id = $1 and type = 'consume'`, [U.C]);
check("ledger has a single consumption for C", ledgerDupe.rows[0].n === 1);

console.log("\n6. Plans & permissions");
check("Library: AI → no_access, no charge", (await unlock(U.LIB, 5)).status === "no_access");
check("Library + Planner: AI → no_access", (await unlock(U.PLAN, 5)).status === "no_access");
check("All Access: AI allowed", (await unlock(U.ALL, 5)).status === "pending");
const tryPlanner = async (u) => { try { await as(u, `insert into public.org_entries (entry_date, time_slot, label) values (current_date, '10:00', 'x')`); return true; } catch { return false; } };
check("Library: planner blocked by RLS", !(await tryPlanner(U.LIB)));
check("Library + AI: planner blocked by RLS", !(await tryPlanner(U.A)));
check("Library + Planner: planner allowed", await tryPlanner(U.PLAN));
check("All Access: planner allowed", await tryPlanner(U.ALL));
check("Library: pack purchase refused (no AI plan)", await db.query(`select public.grant_pack($1, 'pack_10')`, [U.LIB]).then(() => false, () => true));
const e = await ent(U.ALL);
check("All Access has 100 monthly units (1 used)", e.monthly_limit === 100 && e.monthly_left === 99, JSON.stringify(e));

console.log("\n7. The planner never touches AI credits");
const before = (await ent(U.ALL)).monthly_left;
await as(U.ALL, `insert into public.org_plans (name) values ('Matchday plan')`);
const pid = (await as(U.ALL, `select id from public.org_plans limit 1`))[0].id;
await as(U.ALL, `insert into public.org_entries (plan_id, entry_date, time_slot, label, inspiration, status) values ($1, current_date, '12:00', 'Reuse post 1', 'ci-1', 'planned'), ($1, current_date + 7, '12:00', 'Reuse post 1 again', 'ci-1', 'idea')`, [pid]);
await as(U.ALL, `update public.org_entries set entry_date = entry_date + 1, notes = 'moved', status = 'in_production' where label = 'Reuse post 1'`);
await as(U.ALL, `delete from public.org_entries where label = 'x'`);
check("dragging / duplicating / moving / saving: balance unchanged", (await ent(U.ALL)).monthly_left === before);
check("same saved post reused in two entries", (await as(U.ALL, `select count(*)::int n from public.org_entries where inspiration = 'ci-1'`))[0].n === 2);

console.log("\n8. Packs: monthly first, then pack");
await db.query(`select public.grant_pack($1, 'pack_10')`, [U.B]);
for (let i = 0; i < 29; i++) await db.query(`insert into public.ai_credit_ledger (user_id, type, amount, source, reference, cycle_start) values ($1, 'consume', -1, 'subscription', 'test:' || $2, (select public.ai_cycle_start(started_at) from public.subscriptions where user_id = $1))`, [U.B, i]);
let eb = await ent(U.B);
check("B: monthly exhausted, 10 pack units", eb.monthly_left === 0 && eb.pack_left === 10, JSON.stringify(eb));
await generate(6); // analysis exists for post 6
r = await unlock(U.B, 6);
check("next unlock uses the pack (10 → 9)", r.status === "unlocked" && (await ent(U.B)).pack_left === 9);
check("pack movement recorded with source 'pack'", (await db.query(`select source from public.ai_credit_ledger where user_id = $1 and type = 'consume' order by id desc limit 1`, [U.B])).rows[0].source === "pack");
await plan(U.B, "library"); // downgrade
check("pack balance kept but not usable without AI", (await ent(U.B)).pack_left === 0 && (await ent(U.B)).pack_balance === 9);
check("after downgrade the stored analysis is hidden", (await as(U.B, `select count(*)::int n from public.ai_analyses`))[0].n === 0);
await plan(U.B, "library_ai");

console.log("\n9. Monthly renewal (also on yearly plans)");
const cyc = async (start, now) => (await db.query(`select public.ai_cycle_start($1::timestamptz, $2::timestamptz) c`, [start, now])).rows[0].c.toISOString().slice(0, 10);
check("started 15 Jan, now 20 Mar → cycle 15 Mar", (await cyc("2026-01-15", "2026-03-20")) === "2026-03-15");
check("started 15 Jan, now 10 Mar → cycle 15 Feb", (await cyc("2026-01-15", "2026-03-10")) === "2026-02-15");
await db.exec(`update public.subscriptions set started_at = now() - interval '40 days', billing_interval = 'year' where user_id = '${U.C}'`);
check("C (yearly, started 40 days ago): last month's usage no longer counts → 30 left", (await ent(U.C)).monthly_left === 30, JSON.stringify(await ent(U.C)));

console.log("\n10. Data protection");
check("C (never unlocked post 6) can't read its analysis", (await as(U.C, `select count(*)::int n from public.ai_analyses where post_id = 6`))[0].n === 0);
check("A reads analyses they unlocked", (await as(U.A, `select count(*)::int n from public.ai_analyses`))[0].n === 2);
check("library list doesn't reveal stored analyses", !("has_analysis" in (await as(U.A, `select public.library_ideas('{}'::jsonb) r`))[0].r.data[0]));
check("members can't call the generation functions", await as(U.A, `select public.complete_generation(9, 'v1', '{}'::jsonb, 'm', 1, 1, 0)`).then(() => false, () => true));
check("members can't write their own credits", await as(U.A, `insert into public.ai_credit_ledger (user_id, type, amount, source, reference) values ('${U.A}', 'adjust', 100, 'pack', 'hack')`).then(() => false, () => true));

console.log("\n11. Metrics");
const m = (await as(U.SUPER, `select public.admin_ai_metrics() r`))[0].r;
check("metrics separate generations from unlocks", m.analyses_generated_api === 3 && m.unlocks === 4 && m.unlocks_reused === 2 && m.reuse_pct === 50 && Number(m.api_cost_usd) === 0.15, JSON.stringify(m));

const subs = await as(U.SUPER, `select * from public.admin_subscriptions()`);
check("admin sees every member's plan and balance", subs.length === 6 && subs.find((x) => x.email === "a@test.dev").monthly_left === 28);
check("members can't list subscriptions", await as(U.A, `select * from public.admin_subscriptions()`).then(() => false, () => true));
check("members can't change prices", (await as(U.A, `update public.plans set price_month = 0 where key = 'all_access' returning key`)).length === 0);
check("anonymous visitors can read plan prices", (await db.transaction(async (tx) => { await tx.exec("set local role anon"); return (await tx.query("select count(*)::int n from public.plans")).rows[0].n; })) === 4);

console.log("\n12. Quality review: superadmin removes posts from the library");
await db.exec(sql("quality.sql")); await db.exec(sql("quality.sql"));
const libTotal = async (u) => (await as(u, `select public.library_ideas('{}'::jsonb) r`))[0].r.total;
const libBefore = await libTotal(U.A);
check("members can't remove posts", await as(U.A, `select public.remove_content_idea(20, 'x')`).then(() => false, () => true));
await as(U.SUPER, `select public.remove_content_idea(20, 'Low quality')`);
check("removed post disappears from the library", (await libTotal(U.A)) === libBefore - 1);
check("members can't read it directly (saved boards, planner)", (await as(U.A, `select count(*)::int n from public.content_ideas where id = 20`))[0].n === 0);
check("members can't read the removals list", (await as(U.A, `select count(*)::int n from public.content_removals`))[0].n === 0);
check("superadmin sees the removal with its reason", (await as(U.SUPER, `select reason from public.content_removals where external_id = 'p20'`))[0]?.reason === "Low quality");
await db.exec(`delete from public.content_ideas where external_id = 'p20'; insert into public.content_ideas (external_id, title, url) values ('p20', 'Post 20 again', 'https://www.instagram.com/p/X20/');`);
check("re-imported post stays hidden", (await libTotal(U.A)) === libBefore - 1 && (await as(U.A, `select count(*)::int n from public.content_ideas where external_id = 'p20'`))[0].n === 0);
check("members can't restore", await as(U.A, `select public.restore_content_idea('p20')`).then(() => false, () => true));
await as(U.SUPER, `select public.restore_content_idea('p20')`);
check("restore brings it back", (await libTotal(U.A)) === libBefore);

console.log("\n13. Stripe: subscriptions from the webhook, 7-day trial, yearly, packs");
await db.exec(sql("stripe.sql")); await db.exec(sql("stripe.sql"));
const yearly = (await db.query(`select key, price_month, price_year from public.plans order by sort`)).rows;
check("yearly prices filled in (10 × monthly)", yearly.every((p) => Number(p.price_year) === Math.round(Number(p.price_month) * 1000) / 100), JSON.stringify(yearly));
const T = "77777777-0000-0000-0000-000000000007";
await db.query(`insert into auth.users (id, email) values ($1, 't@test.dev')`, [T]);
await db.exec(`insert into public.stripe_customers (user_id, customer_id) values ('${T}', 'cus_T')`);
check("members can't activate a plan themselves", await as(T, `select public.stripe_apply_subscription('${T}', 'all_access', 'month', 'active', 'cus_T', 'sub_1', now(), now())`).then(() => false, () => true));
check("members can't read Stripe customers", (await as(T, `select count(*)::int n from public.stripe_customers`))[0].n === 0);
await db.query(`select public.stripe_apply_subscription($1, 'all_access', 'year', 'trialing', 'cus_T', 'sub_1', now(), now() + interval '7 days')`, [T]);
let se = await ent(T);
check("trial gives the plan's access", se.has_ai && se.has_planner && se.status === "trialing" && se.billing_interval === "year", JSON.stringify(se));
check("AI during the trial is capped at 5", se.monthly_limit === 5, JSON.stringify(se));
check("trial marked as used (one per member)", (await db.query(`select trial_used from public.stripe_customers where user_id = $1`, [T])).rows[0].trial_used === true);
const startedTrial = (await db.query(`select started_at from public.subscriptions where user_id = $1`, [T])).rows[0].started_at;
await db.query(`select public.stripe_apply_subscription($1, 'all_access', 'year', 'active', 'cus_T', 'sub_1', now() - interval '1 day', now() + interval '1 year')`, [T]);
se = await ent(T);
check("after the trial: full 100 AI credits", se.status === "active" && se.monthly_limit === 100);
check("renewal / status change keeps the AI cycle anchor", String((await db.query(`select started_at from public.subscriptions where user_id = $1`, [T])).rows[0].started_at) === String(startedTrial));
await db.query(`select public.grant_pack($1, 'pack_10', 9.99, 'stripe', 'cs_test_1')`, [T]);
await db.query(`select public.grant_pack($1, 'pack_10', 9.99, 'stripe', 'cs_test_1')`, [T]);
check("pack from Stripe granted once per checkout (webhook retries)", (await ent(T)).pack_left === 10);
await db.query(`select public.stripe_apply_subscription($1, 'all_access', 'year', 'canceled', 'cus_T', 'sub_1', now(), now())`, [T]);
se = await ent(T);
check("canceled → no access", !se.has_library && !se.has_ai && se.pack_left === 0);
const b = (await as(T, `select public.my_billing() r`))[0].r;
check("profile billing shows the ended plan", b.has_customer && b.trial_used && b.subscription.status === "canceled" && b.subscription.plan === "all_access", JSON.stringify(b));

console.log("\n14. Admin → Import: delete imports");
await db.exec(sql("import-delete.sql"));
const mkImport = async (name) => (await db.query(`insert into public.idea_imports (filename, status, total_rows, rows_created) values ($1, 'completed', 2, 2) returning id`, [name])).rows[0].id;
const i1 = await mkImport("keep.csv"), i2 = await mkImport("undo.csv");
await db.query(`insert into public.content_ideas (external_id, title, url, import_id) values ('k1','K1','u',$1), ('k2','K2','u',$1), ('u1','U1','u',$2), ('u2','U2','u',$2)`, [i1, i2]);
check("members can't delete imports", await as(U.A, `select public.delete_content_import(${i1}, false)`).then(() => false, () => true));
await as(U.SUPER, `select public.delete_content_import(${i1}, false)`);
const kept = (await db.query(`select count(*)::int n, count(import_id)::int linked from public.content_ideas where external_id in ('k1','k2')`)).rows[0];
check("history only: import gone, its posts stay (unlinked)", kept.n === 2 && kept.linked === 0 && !(await db.query(`select 1 from public.idea_imports where id = $1`, [i1])).rows.length);
const r2 = (await as(U.SUPER, `select public.delete_content_import(${i2}, true) r`))[0].r;
check("delete + undo: its posts are removed", r2.deleted === 2 && (await db.query(`select count(*)::int n from public.content_ideas where external_id in ('u1','u2')`)).rows[0].n === 0, JSON.stringify(r2));

console.log("\n15. Performance SQL: same results, cached counts");
const latestBefore = (await as(U.A, `select public.library_ideas('{}'::jsonb, null, null, null, 'latest', '', null, 5) r`))[0].r;
await db.exec(sql("performance.sql")); await db.exec(sql("performance.sql"));
await db.query(`select public.refresh_library_stats('values')`); await db.query(`select public.refresh_library_stats('totals')`);
const latestAfter = (await as(U.A, `select public.library_ideas('{}'::jsonb, null, null, null, 'latest', '', null, 5) r`))[0].r;
check("latest page identical after optimisation", JSON.stringify(latestAfter.data.map((x) => x.id)) === JSON.stringify(latestBefore.data.map((x) => x.id)) && latestAfter.total === latestBefore.total, `${latestBefore.total} vs ${latestAfter.total}`);
const rnd1 = (await as(U.A, `select public.library_ideas('{}'::jsonb, null, null, null, 'random', 'abc', null, 5) r`))[0].r.data.map((x) => x.id);
const rnd2 = (await as(U.A, `select public.library_ideas('{}'::jsonb, null, null, null, 'random', 'abc', null, 5) r`))[0].r.data.map((x) => x.id);
check("random order is stable for the same seed", rnd1.length === 5 && JSON.stringify(rnd1) === JSON.stringify(rnd2));
const q = (await as(U.A, `select public.library_ideas('{}'::jsonb, 'Post 3', null, null, 'latest', '', null, 50) r`))[0].r;
check("search counts exactly", q.total === q.data.length && q.data.every((x) => /Post 3/.test(x.title)), JSON.stringify(q.total));
await as(U.SUPER, `select public.remove_content_idea(5, 'x')`);
const live = (await as(U.A, `select public.library_ideas('{}'::jsonb, 'Post', null, null, 'latest', '', null, 100) r`))[0].r;
check("removed posts stay hidden", !live.data.some((x) => x.id === 5));
check("members can't read a removed post directly (RLS)", (await as(U.A, `select count(*)::int n from public.content_ideas where id = 5`))[0].n === 0 && (await as(U.SUPER, `select count(*)::int n from public.content_ideas where id = 5`))[0].n === 1);
await as(U.SUPER, `select public.restore_content_idea('p5')`);
check("restored post visible again", (await as(U.A, `select count(*)::int n from public.content_ideas where id = 5`))[0].n === 1);
check("members can't refresh stats", await as(U.A, `select public.refresh_library_stats('values')`).then(() => false, () => true));
check("admin db stats only for admins", (await as(U.A, `select public.admin_db_stats() r`))[0].r === null && (await as(U.SUPER, `select public.admin_db_stats() r`))[0].r.database_bytes > 0);

console.log("\n16. Performance part 2: tag-driven filters, cached pair counts");
await db.exec(`insert into public.idea_catalog (category, name) values ('sport','Football'),('sport','Basketball'),('club','Betis') on conflict do nothing`);
const vid = async (cat, name) => (await db.query(`select id from public.idea_catalog where category=$1 and name=$2`, [cat, name])).rows[0].id;
const FB = await vid("sport", "Football"), BK = await vid("sport", "Basketball"), BE = await vid("club", "Betis");
await db.exec(`insert into public.content_idea_tags (idea_id, value_id) select id, ${FB} from public.content_ideas where id % 2 = 0 on conflict do nothing;
  insert into public.content_idea_tags (idea_id, value_id) select id, ${BK} from public.content_ideas where id % 2 = 1 on conflict do nothing;
  insert into public.content_idea_tags (idea_id, value_id) select id, ${BE} from public.content_ideas where id % 4 = 0 on conflict do nothing;`);
const before2 = {
  fb: (await as(U.A, `select public.library_ideas($1::jsonb, null, null, null, 'latest', '', null, 100) r`, [JSON.stringify({ sport: { ids: [FB] } })]))[0].r,
  fbBe: (await as(U.A, `select public.library_ideas($1::jsonb, null, null, null, 'latest', '', null, 100) r`, [JSON.stringify({ sport: { ids: [FB] }, club: { ids: [BE] } })]))[0].r,
  either: (await as(U.A, `select public.library_ideas($1::jsonb, null, null, null, 'latest', '', null, 100) r`, [JSON.stringify({ sport: { ids: [FB, BK] } })]))[0].r,
  liveCounts: (await as(U.A, `select value_id, ideas from public.library_filter_counts($1::jsonb)`, [JSON.stringify({ sport: { ids: [FB] } })])),
};
await db.exec(sql("performance-2.sql")); await db.exec(sql("performance-2.sql"));
await db.query(`select public.refresh_library_stats('all')`);
const after2 = {
  fb: (await as(U.A, `select public.library_ideas($1::jsonb, null, null, null, 'latest', '', null, 100) r`, [JSON.stringify({ sport: { ids: [FB] } })]))[0].r,
  fbBe: (await as(U.A, `select public.library_ideas($1::jsonb, null, null, null, 'latest', '', null, 100) r`, [JSON.stringify({ sport: { ids: [FB] }, club: { ids: [BE] } })]))[0].r,
  either: (await as(U.A, `select public.library_ideas($1::jsonb, null, null, null, 'latest', '', null, 100) r`, [JSON.stringify({ sport: { ids: [FB, BK] } })]))[0].r,
  pairCounts: (await as(U.A, `select value_id, ideas from public.library_filter_counts($1::jsonb)`, [JSON.stringify({ sport: { ids: [FB] } })])),
};
const ids = (r) => JSON.stringify(r.data.map((x) => x.id));
check("one filter: same posts and total", ids(after2.fb) === ids(before2.fb) && after2.fb.total === before2.fb.total, `${before2.fb.total} vs ${after2.fb.total}`);
check("two categories (AND): same posts", ids(after2.fbBe) === ids(before2.fbBe) && after2.fbBe.total === before2.fbBe.total);
check("two values in one category (OR): same posts", ids(after2.either) === ids(before2.either) && after2.either.total === before2.either.total);
const cm = (rows) => JSON.stringify(Object.fromEntries(rows.map((r) => [r.value_id, Number(r.ideas)]).sort((a, b) => a[0] - b[0])));
check("cached pair counts = live counts", cm(after2.pairCounts) === cm(before2.liveCounts), `${cm(before2.liveCounts)} vs ${cm(after2.pairCounts)}`);
const mixed = (await as(U.A, `select value_id, ideas from public.library_filter_counts($1::jsonb, 'Post')`, [JSON.stringify({ sport: { ids: [FB] }, club: { ids: [BE] } })]));
check("live counts with search + two filters", mixed.find((r) => Number(r.value_id) === BE)?.ideas == after2.fbBe.total);

console.log("\n17. Performance part 3: strategy by size, cached totals, no temp tables");
const libq = async (filters, q = null, order = "latest") => (await as(U.A, `select public.library_ideas($1::jsonb, $2, null, null, $3, 's', null, 100) r`, [JSON.stringify(filters), q, order]))[0].r;
const cnt = async (filters, q = null) => cm(await as(U.A, `select value_id, ideas from public.library_filter_counts($1::jsonb, $2)`, [JSON.stringify(filters), q]));
const cases = [{}, { sport: { ids: [FB] } }, { sport: { ids: [FB] }, club: { ids: [BE] } }, { sport: { ids: [FB, BK] } }, { club: { ids: [BE], mode: "all" } }];
const snap = async () => { const o = []; for (const f of cases) { o.push(ids(await libq(f)), (await libq(f)).total, ids(await libq(f, "Post 1")), ids(await libq(f, null, "random")), await cnt(f), await cnt(f, "Post")); } return JSON.stringify(o); };
const s2 = await snap();
await db.exec(sql("performance-3.sql")); await db.exec(sql("performance-3.sql"));
const s3 = await snap();
check("same pages, totals and counts for every filter combination", s2 === s3);
check("totals for one value / two values come from the cache", (await libq({ sport: { ids: [FB] }, club: { ids: [BE] } })).total === after2.fbBe.total);
await as(U.SUPER, `select public.remove_content_idea(4, 'x')`);
check("removed post excluded from tag totals", (await libq({ sport: { ids: [FB, BK] } })).total === after2.either.total - 1);
await as(U.SUPER, `select public.restore_content_idea('p4')`);

console.log("\n18. Performance part 4: sampled shuffle and counts");
const s3b = await snap();
await db.exec(sql("performance-4.sql")); await db.exec(sql("performance-4.sql"));
const s4 = await snap();
check("small selections: identical results (exact)", s3b === s4);
const full = (await as(U.A, `select array_agg(x order by x) a from public.ideas_matching_tags($1::jsonb) x`, [JSON.stringify({ sport: { ids: [FB, BK] } })]))[0].a;
const half = (await as(U.A, `select array_agg(x order by x) a from public.ideas_matching_tags_sample($1::jsonb, 2, 1) x`, [JSON.stringify({ sport: { ids: [FB, BK] } })]))[0].a;
check("sample = 1 in k of the matches", JSON.stringify(half) === JSON.stringify(full.filter((x) => x % 2 === 1)));
check("shuffle step ≈ 5,000 posts per shuffle", (await db.query(`select public.shuffle_step(367692) k`)).rows[0].k === 74);

console.log("\n19. Performance part 5");
const s4b = await snap();
await db.exec(sql("performance-5.sql")); await db.exec(sql("performance-5.sql"));
check("small selections: identical results", s4b === await snap());

console.log("\n20. Post links from embed codes");
await db.exec(sql("post-urls.sql"));
const E = {
  ig: `<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/p/Decze7IivhX" data-instgrm-captioned></blockquote>`,
  tt: `<blockquote class="tiktok-embed" cite="https://www.tiktok.com/@nfl/video/7696306986983378190" data-video-id="7696306986983378190"><section></section></blockquote>`,
  x: `<blockquote class="twitter-tweet"><a href="https://twitter.com/ManUtd/status/2110152632920571992#m"></a></blockquote>`,
  fb: `<iframe src="https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2Freel%2F1787670255857411&width=500" width="500"></iframe>`,
  yt: `<iframe width='560' height='315' src='https://www.youtube.com/embed/YJEbHmRnlOg' frameborder='0' allowfullscreen></iframe>`,
  li: `<iframe src="https://www.linkedin.com/embed/feed/update/urn:li:activity:7515867717803986944?collapsed=1" height="600"></iframe>`,
};
const U2 = {};
for (const [k, e] of Object.entries(E)) U2[k] = (await db.query(`select public.url_from_embed($1) u`, [e])).rows[0].u;
check("Instagram link", U2.ig === "https://www.instagram.com/p/Decze7IivhX/", U2.ig);
check("TikTok link", U2.tt === "https://www.tiktok.com/@nfl/video/7696306986983378190", U2.tt);
check("X link", U2.x === "https://x.com/ManUtd/status/2110152632920571992", U2.x);
check("Facebook link", U2.fb === "https://www.facebook.com/reel/1787670255857411", U2.fb);
check("YouTube link", U2.yt === "https://www.youtube.com/watch?v=YJEbHmRnlOg", U2.yt);
check("LinkedIn link", U2.li === "https://www.linkedin.com/feed/update/urn:li:activity:7515867717803986944/", U2.li);
await db.query(`insert into public.content_ideas (external_id, title, embed) values ('tt-new', 'x', $1)`, [E.tt]);
check("new imports get their link automatically", (await db.query(`select url from public.content_ideas where external_id = 'tt-new'`)).rows[0].url === U2.tt);
check("an existing link is kept", (await db.query(`select url from public.content_ideas where external_id = 'p1'`)).rows[0].url === "https://www.instagram.com/p/X1/");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
