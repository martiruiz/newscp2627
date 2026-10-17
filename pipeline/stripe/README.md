# Stripe payments — setup

How it works: the website opens **Stripe Checkout** (Edge Function `stripe-checkout`); Stripe tells Supabase what happened
(`stripe-webhook`), and only then the member gets access. Members manage their plan, card, invoices and cancellation in
the **Stripe customer portal** (`stripe-portal`, button in Profile → Plan & billing).

- Plans: monthly or yearly (yearly = 10 × monthly), **7-day free trial with card** (once per member), VAT included.
- During the trial the member gets at most **5 AI analyses** (Admin → Plans & AI → "AI in trial"), then the full allowance.
- AI packs: one-time payment, only for plans with AI. Credits are added once per payment, even if Stripe retries.
- Invoices show **IVA 21% included**. Companies can add their VAT number in Checkout.

Do everything in **test mode** first (Stripe dashboard → "Test mode"), then repeat with live keys.

## 1. Database
Run `supabase/stripe.sql` in the Supabase SQL Editor (after `billing.sql`).

## 2. Products, prices, VAT, portal and webhook in Stripe
In `pipeline/.env` add `STRIPE_SECRET_KEY=sk_test_…` (Stripe → Developers → API keys) next to `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`, and optionally `SITE_URL=https://your-domain`. Then:

```bash
cd pipeline && node stripe/setup.mjs
```

It creates the products and prices from Admin → Plans & AI and links them, and prints the webhook **signing secret** the
first time. Run it again whenever you change a price.

## 3. Secrets and functions in Supabase
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_… STRIPE_WEBHOOK_SECRET=whsec_… SITE_URL=https://your-domain
supabase functions deploy stripe-checkout
supabase functions deploy stripe-portal
supabase functions deploy stripe-webhook --no-verify-jwt
```

## 4. Test
On the pricing page start a trial with the test card `4242 4242 4242 4242` (any future date, any CVC). You should land on
the Content Library with "Welcome to …", and see the plan in Profile → Plan & billing and in Admin → Plans & AI.
Useful test cards: `4000 0000 0000 0341` (card declined after the trial), `4000 0025 0000 3155` (3-D Secure).

## 5. Go live
Switch Stripe to live mode, complete the business profile, and repeat steps 2–3 with `sk_live_…`
(`node stripe/setup.mjs --live`) and the live webhook secret.
