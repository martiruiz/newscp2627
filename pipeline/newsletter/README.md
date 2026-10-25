# SCP newsletter (Resend)

```
Home pop-up sign-up ─▶ newsletter_signups ─▶ Database Webhook ─▶ Edge Function "newsletter-welcome"
                                                                   ├─ contact in the Resend segment
                                                                   └─ welcome email + Sports Content Idea Kit
Profile "Send me the newsletter" ─▶ profiles.newsletter ─────────▶ synced to the segment every Monday

Every Monday 08:00 (Barcelona) — GitHub Action "Weekly newsletter"
node newsletter/weekly.mjs  → header + intro · Social News "This week on SCP" (top story + headlines, last 7 days)
                              · 4 featured Content Library posts (2 × 2, cover image → post) · 3 latest blog articles
                              with photo · Follow SCP icons (Instagram, TikTok, LinkedIn)
                            → Claude writes subject, intro, top-story take and a teaser per article
                            → Resend broadcast DRAFT + preview email to NEWSLETTER_REVIEW_TO
You: Resend → Broadcasts → "SCP weekly — <date>" → Send   (nothing goes out without this click)
```

## Setup (once)

1. **Resend** (resend.com)
   - Domains → add `sportscontentplaybook.com` → add the DNS records it shows at your domain provider → wait for "Verified".
   - Audience → Segments → create **"SCP Newsletter"** → copy its ID.
   - API Keys → create one with "Full access" (keep it private).
2. **Supabase**
   - SQL Editor: run `supabase/newsletter.sql`.
   - Edge Functions → Deploy a new function → name `newsletter-welcome` → paste `supabase/functions/newsletter-welcome/index.ts` → turn **off** "Verify JWT" (the webhook uses its own secret) → Deploy.
   - Edge Functions → Secrets: `RESEND_API_KEY`, `RESEND_SEGMENT_ID`, `NEWSLETTER_FROM` (e.g. `SCP Newsletter <newsletter@sportscontentplaybook.com>`), `WEBHOOK_SECRET` (any long random text), optionally `KIT_URL`.
   - Database → Webhooks → Create: table `newsletter_signups`, event **Insert**, type **Supabase Edge Function** → `newsletter-welcome`, HTTP header `x-webhook-secret` = the same `WEBHOOK_SECRET`.
3. **GitHub** → repo → Settings → Secrets and variables → Actions: `RESEND_API_KEY`, `RESEND_SEGMENT_ID`, `NEWSLETTER_FROM`, `NEWSLETTER_REVIEW_TO` (your email). `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_API_KEY` are the ones Social News already uses.
4. Test: GitHub → Actions → "Weekly newsletter" → Run workflow. You'll get a "[Preview]" email and a draft in Resend.

Local dry run (no emails, writes `pipeline/newsletter-preview.html`): `node newsletter/weekly.mjs --dry-run` with `pipeline/.env`.

Emails load images from `sportscontentplaybook.com` (logo and blog photos), so the website must be published at that domain.
Social links: edit `SOCIAL` at the top of `newsletter/template.mjs` (empty = hidden).
