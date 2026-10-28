# Team alerts: sign-ups, trials, cancellations

`supabase/functions/admin-notify` e-mails the team (`NOTIFY_TO`) when someone signs up, starts the 7-day trial or cancels.
Nothing goes to the user. It uses the secrets contact-notify already has (`RESEND_API_KEY`, `CONTACT_FROM`, `NOTIFY_TO`,
`WEBHOOK_SECRET`), so there is nothing new to set.

1. Deploy: `npx supabase functions deploy admin-notify --no-verify-jwt --project-ref wppdbomtiliutpxsimtp`
2. Supabase → Database → Webhooks → Create a new hook, twice:

| Name | Table | Events | Type | URL | Header |
|---|---|---|---|---|---|
| admin-notify-signup | `profiles` | Insert | Supabase Edge Functions → `admin-notify` (POST) | — | `x-webhook-secret` = the same value as the contact-notify webhook |
| admin-notify-subs | `subscriptions` | Insert, Update | Supabase Edge Functions → `admin-notify` (POST) | — | `x-webhook-secret` = the same value |

What sends an e-mail (Stripe subscriptions only):
- **New sign-up**: every new profile.
- **Trial started**: the status becomes `trialing`.
- **Cancelled**: "cancel at period end" switched on (the e-mail says until when they keep access), or the subscription
  ends without that having been scheduled. A scheduled cancellation that later runs out does not send a second one.
