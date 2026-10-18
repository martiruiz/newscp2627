# SCP memberships — architecture, setup and operations

Memberships replace MemberPress: plans, EUR / USD prices, free trials with card, renewals on the 1st, hidden plans,
discounts, self-service billing, transactional e-mails, a superadmin back-office and a MemberPress importer.
Everything lives inside the existing SCP site + Supabase. **Stripe is the source of truth for subscriptions and
payments; SCP is the source of truth for permissions, derived only from what Stripe confirms.**

> Status (18 Oct 2026): code, database migration and automated tests are done. Nothing is deployed and nothing has
> been sent to Stripe: it needs a Stripe **test** secret key, the SQL run in Supabase and the functions deployed
> (checklist at the end). No real charges, no migration of active subscriptions and no mass e-mails happen without
> an explicit decision.

## 1. Architecture

```
pricing.html ─ js/plans.js ──► public_membership_plans() / private_membership(token)        (Supabase, SQL)
     │  "Get plan" → js/checkout.js: terms first (preview) ──► stripe-checkout ──► Stripe Checkout (card)
     ▼                                                                                   │
profile.html#billing ─ js/profile-billing.js ──► my_membership() + stripe-manage         │ webhooks (signed)
                                                  (cancel, reactivate, change, portal)   ▼
admin/memberships.html ─ admin/js/memberships.js ──► admin_* RPCs + stripe-admin   stripe-webhook ──► billing_apply_subscription()
                                                     send-emails, billing-cron            │            billing_record_invoice()
                                                                                          ▼
                                                    subscriptions · subscription_events · billing_invoices · stripe_events
                                                    email_delivery_logs ──► send-emails (Resend) ──► member
permissions: user_entitlements() → entitlements() / has_feature() / has_entitlement() → RLS, unlock_analysis(), planner…
```

- **Access** comes only from `subscriptions` rows written by the webhook (or a superadmin *grant*). The success page
  after Checkout only waits for the webhook; it never grants anything.
- **Permissions** (`entitlement_keys`, `plan_entitlements`) are independent of plan names. Server checks:
  `ai.analyze_posts` in `unlock_analysis()`, `planner.access` in the Content Plan RLS policies, and
  `library.access` through `library_allowed()` once **Settings → Library access** is switched on (off until the
  MemberPress members are linked, so nobody loses access).
- **Status → access**: active, trialing → yes; past_due → yes while Stripe retries (setting); unpaid, paused,
  canceled, incomplete, incomplete_expired → no. A scheduled cancellation keeps access until the period ends.
  Data is never deleted on downgrade/cancel: calendars, boards and analyses come back with the plan.

## 2. Files

| Area | Files |
|---|---|
| Database | `supabase/memberships.sql` (new), `supabase/library-filters.sql`; extends `billing.sql` + `stripe.sql` tables |
| Edge Functions | `supabase/functions/stripe-checkout` (rewritten), `stripe-webhook` (rewritten), `stripe-manage` (new), `stripe-admin` (new), `send-emails` (new), `billing-cron` (new), `stripe-portal` (unchanged); shared: `_shared/stripe.ts`, `_shared/sync.ts`, `_shared/reconcile.ts`, `_shared/billing-dates.js`, `_shared/email-render.js` |
| Website | `pricing.html`, `js/plans.js`, `js/checkout.js`, `js/profile-billing.js`, `profile.html`, `css/styles.css` |
| Admin | `admin/memberships.html`, `admin/js/memberships.js`, `admin/js/core.js` (menu), `admin/js/billing.js` (now "AI & packs"), `admin/css/admin.css` |
| Tools | `pipeline/stripe/setup.mjs` (packs, VAT, portal, webhook), `pipeline/stripe/test-clocks.mjs` (Stripe validation) |
| Tests | `pipeline/tests/memberships.test.mjs`, `pipeline/tests/billing-dates.test.mjs`, `pipeline/tests/billing.test.mjs` |
| Ops | `.github/workflows/billing-daily.yml` |

## 3. Database (`supabase/memberships.sql`)

Run order: `billing.sql` → `stripe.sql` → `memberships.sql` (safe to re-run; **re-run `memberships.sql` after any
re-run of `billing.sql` or `stripe.sql`**, which would restore their older `entitlements()`).

Existing tables reused instead of duplicated: `plans` (membership catalogue), `subscriptions` (one current row per
member, now with the full Stripe state), `stripe_customers` (billing customers), `stripe_events` (webhook log),
`ai_credit_ledger` (AI usage ledger), `ai_packs`.

| New table | Purpose |
|---|---|
| `membership_prices` | one row per plan × currency × interval version; history kept; `legacy` = MemberPress prices (never sold) |
| `entitlement_keys`, `plan_entitlements` | permissions and which plans include them |
| `entitlement_grants` | superadmin grants (plan or permission, period, reason) — no money moves |
| `subscription_events` | history: trial_started, activated, trial_converted, plan_changed, cancel_scheduled, reactivated, canceled, past_due, recovered, payment_failed, action_required, granted, linked |
| `billing_invoices` | invoices as Stripe reports them (members see their own) |
| `private_membership_links` | hidden plans: only the SHA-256 of the token is stored, expiry, max uses, revoke |
| `billing_discounts`, `billing_discount_redemptions` | discount codes ↔ Stripe coupons / promotion codes |
| `email_templates`, `email_delivery_logs` | 11 templates × en/ca/es; outbox + log with one-message-per-event dedupe keys |
| `memberpress_import_batches`, `memberpress_import_records` | staged CSV, validation, Stripe check, link status |
| `billing_notes`, `billing_audit_logs`, `billing_settings` | internal notes, who-did-what, non-secret settings |

RLS is on for every table; members read only their own invoices and subscription events; everything else goes
through `security definer` RPCs that check `billing_require_admin()` (superadmin) or are callable only by the service
role (webhook / functions).

## 4. Environment variables / secrets

Supabase (`supabase secrets set …`) — never in the repo, never in the browser:

| Secret | Used by |
|---|---|
| `STRIPE_SECRET_KEY` (`sk_test_…` first, later `sk_live_…`) | all stripe-* functions, billing-cron |
| `STRIPE_WEBHOOK_SECRET` (`whsec_…`) | stripe-webhook |
| `SITE_URL` (e.g. `https://sportscontentplaybook.com`) | redirects, e-mail links |
| `RESEND_API_KEY` | send-emails (without it e-mails stay queued) |
| `CRON_SECRET` (any long random string) | billing-cron, send-emails, and the GitHub workflow |

GitHub repository secrets: `SUPABASE_URL`, `BILLING_CRON_SECRET` (= `CRON_SECRET`).
`pipeline/.env` (local scripts): `STRIPE_SECRET_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL`.

## 5. Manual configuration in Stripe

1. Test mode first. Business profile, public details: **terms of service URL** and **privacy URL** (the legal pages
   don't exist on the site yet — create them, then put the URLs in Memberships → Settings and in Stripe).
2. `cd pipeline && node stripe/setup.mjs` — VAT rate (IVA 21 % included), customer portal (card, billing details,
   invoices, cancel at period end; plan changes disabled there), webhook endpoint with all the events it handles
   (prints the signing secret once).
3. Settings → Billing → Subscriptions and emails: **Smart Retries** schedule (e.g. 4 attempts over 2 weeks) and what
   happens after the last attempt (**mark the subscription unpaid** or cancel). Optionally Stripe's own receipts.
4. Settings → Payments → enable cards (3-D Secure is automatic), and optionally SEPA / wallets.
5. Tax: prices are VAT-inclusive with a fixed 21 % rate. For EU OSS / US sales tax consider **Stripe Tax** (a business
   decision, not done here).
6. Super Admin → Memberships → Plans → **Sync all plans with Stripe** (creates products and the EUR prices; add USD
   prices first if you want to sell in dollars).
7. Discounts → **Create in Stripe** for each code.

## 6. Adding a membership

Super Admin → Memberships → Plans → **New plan**: name, key, description, features, visibility, on sale, trial,
AI quota, permissions, EUR/USD monthly/yearly prices → Save → **Sync with Stripe**. Pricing shows it immediately
(no deploy). Changing a price later creates a new version: new customers get it after the next sync; existing
subscribers keep theirs (their Stripe subscription isn't touched).

## 7. Hidden membership

Create the plan with visibility **Hidden** (or **Duplicate** a public one — copies are hidden and off sale), set its
prices, sync. Then **Hidden memberships → New private link** (label, expiry, max uses). The URL
`pricing.html#private=<token>` is shown **once** (only its fingerprint is stored). The server checks the token on the
page and again at checkout; revoke or regenerate any time; the table shows uses, subscriptions and paying members.
The token is in the URL hash, so it doesn't reach server logs. (If the hosting supports rewrites, `/pricing/private/:token`
can redirect to `pricing.html#private=:token`.)

## 8. Free trials

- Card always required (`payment_method_collection: "always"`); nothing is charged during the trial.
- Trial length per plan (none, 3, 7, 14, 30 or custom days); trial AI allowance per plan.
- Eligibility (`billing_trial_eligible`): one trial per member — no trial if they ever had a trial or a Stripe
  subscription, or their Stripe customer used one; a superadmin can grant an exception per member.
- Before paying, the member sees: trial length, end date, first charge date (prorated to the 1st for monthly plans),
  price afterwards, renewal rule, cancellation terms. Stripe's exact first amount is e-mailed 3 days before the trial
  ends (`customer.subscription.trial_will_end` → `trial_ending` e-mail with Stripe's invoice preview).
- Cancelling during the trial = cancel at period end = no charge, access until the trial end.

## 9. Billing on the 1st (`_shared/billing-dates.js`)

Monthly subscriptions renew on the **1st of every month, Europe/Madrid**. Dates are stored in UTC.

- Start = end of the trial (or now). If the start isn't the 1st: `billing_cycle_anchor` = next **1st at 12:00
  Madrid** and `proration_behavior: create_prorations` → Stripe invoices the days until the 1st, then the full price
  every 1st. If the start is the 1st before noon: without a trial, anchor at noon that day without prorations; with a
  trial, the trial is extended to noon that day (Stripe rejects a non-prorated anchor right after a trial — found by
  the test clocks); after noon: no anchor.
- **Why noon, not midnight:** Stripe renews on the same UTC day-of-month and time. Midnight in Madrid is the previous
  day in UTC (22:00/23:00), which drifts to the last day of the month across summer/winter time. Noon is the 1st in UTC
  all year (`billing-dates.test.mjs` checks 24 consecutive renewals for several start dates, February, leap years and
  both clock changes).
- Amounts are always Stripe's: no-trial checkouts show Stripe's invoice preview; with a trial the exact prorated amount
  is calculated by Stripe at the end of the trial.
- Yearly plans renew on the anniversary of the start (or of the trial end).
- Upgrades apply immediately with `always_invoice` prorations and `pending_if_incomplete` (applied only if the payment
  succeeds); the anchor (the 1st) is kept. Downgrades and yearly → monthly are scheduled at the end of the period
  (subscription schedule). Monthly → yearly starts a yearly period at once (Stripe resets the anchor on an interval
  change). Known limitation: a yearly → monthly switch renews monthly on the date the year ends, not the 1st.
- Existing (MemberPress) subscriptions keep their own calendar until a migration policy is approved and communicated.

**Validated by:** `billing-dates.test.mjs` (dates, 27 checks, passing) and `pipeline/stripe/test-clocks.mjs` — run
against Stripe test mode on 18 Oct 2026: **23 passed, 0 failed** (7-day trial → €0, prorated €18.80 to 1 Dec, €39.99 on
1 Dec and 1 Jan; day 15 → €20.99 then full; 31 Jan; trial ending on the 1st; subscribing on the 1st morning/afternoon;
29 Feb 2028; yearly anniversary; declined card → past_due; 3-D Secure → incomplete).

## 10. MemberPress migration

Super Admin → Memberships → Migration:
1. Upload the MemberPress CSV export (members/subscriptions; include e-mail, membership, status, period, amount,
   currency, dates and the Stripe customer/subscription ids). Columns are detected; adjust the mapping.
2. Staging (no changes): rows are stored, e-mails normalised, amounts/dates parsed.
3. Map each MemberPress membership to an SCP plan → **Validate**: bad e-mails, unmapped memberships, duplicates per
   e-mail, missing/odd Stripe ids, expired-but-active, subscription already linked to another account.
4. **Verify in Stripe**: each `sub_…` must exist in *this* Stripe account, belong to the expected customer and be
   alive. If MemberPress used another Stripe account the row is marked *needs specific migration* (ids can't be moved).
5. **Create missing accounts** (optional): SCP accounts without password, no e-mail sent; members use "Forgot password"
   (WordPress password hashes are not imported).
6. **Simulate**, then **Link verified members**: writes only the SCP side (subscription row with origin `memberpress`,
   Stripe customer mapping, a *legacy* price mapping so future webhooks resolve the plan). Nothing changes in Stripe,
   no e-mails, same prices and renewal dates. Re-running doesn't duplicate anything.
Then: compare totals with MemberPress, check permissions, point Stripe's webhook to SCP (and stop MemberPress's
processing of the same events), switch **Settings → Library access** on, and only then retire MemberPress.
The migration isn't finished while any active subscription is unlinked (filter "Pending" / "Needs …").

## 11. Tests (run 18 Oct 2026)

```
cd pipeline
npm run test:billing        → 111 passed, 0 failed   (existing AI credits / planner permissions)
npm run test:memberships    → 120 passed, 0 failed   (plans, prices, statuses, quotas, grants, links, discounts,
                                                      webhook idempotency / out-of-order, invoices, e-mails, RLS,
                                                      metrics, MemberPress importer, 33 e-mail templates)
npm run test:billing-dates  → 27 passed, 0 failed    (day-1 rule, DST, February, leap year, yearly)
node stripe/test-clocks.mjs → 23 passed, 0 failed    (real Stripe invoices in test mode, simulated time)
```
Edge Functions type-check with Deno (`deno check`), no errors. **Not executed yet** (need the SQL + deployment): the
webhook with real Stripe events, Resend delivery, and an end-to-end checkout in the browser.

## 12. Pending

- Run the SQL and deploy the functions (checklist below).
- Resend account + verified sender domain, `RESEND_API_KEY`.
- Legal pages (terms, privacy, cancellation) — footer links are `#` today; required before live payments.
- An end-to-end test-mode checkout in the browser; review the trial / proration texts with real numbers.
- The MemberPress export (and which Stripe account MemberPress uses).
- Decide Stripe retry policy and Stripe Tax; USD prices (none are set: no automatic conversion).
- Translations of the pricing / billing pages (e-mails are already en / ca / es).

## 13. Deployment checklist

1. Supabase SQL editor: `stripe.sql` (if not run) → `memberships.sql` → `library-filters.sql` (if not run).
2. `supabase secrets set STRIPE_SECRET_KEY=sk_test_… SITE_URL=… CRON_SECRET=… RESEND_API_KEY=…`
3. Deploy: `supabase functions deploy stripe-checkout stripe-manage stripe-admin stripe-portal`
   and `supabase functions deploy stripe-webhook send-emails billing-cron --no-verify-jwt`.
4. `cd pipeline && node stripe/setup.mjs` → `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_…`.
5. Admin → Memberships → Plans: review prices (add USD if wanted) → Sync all plans with Stripe. Settings: sender,
   legal URLs.
6. `node stripe/test-clocks.mjs`; test-mode checkout with `4242 4242 4242 4242`, `4000 0000 0000 0341` (fails after
   trial), `4000 0025 0000 3155` (3-D Secure); cancel / reactivate / upgrade / downgrade from Account → Billing; check
   Billing events and e-mails.
7. GitHub secrets `SUPABASE_URL`, `BILLING_CRON_SECRET`.
8. MemberPress migration in test mode (section 10).
9. Go live only with explicit approval: `sk_live_` secrets, `node stripe/setup.mjs --live`, live webhook secret, sync
   plans again in live mode.

**Rollback:** the website falls back to the previous plan data if the new RPCs are missing; to roll back the code,
revert the commits and redeploy the previous functions (`git checkout <commit> -- supabase/functions && supabase
functions deploy …`). The SQL only adds tables/columns/functions (no data is deleted); `entitlements()` can be
restored by re-running `stripe.sql`. In Stripe nothing is removed: deactivate the webhook endpoint to stop processing;
subscriptions keep billing as they are.
