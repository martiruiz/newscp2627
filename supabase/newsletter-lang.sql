-- Newsletter sign-ups remember the language the person was using (es / en), so the welcome email
-- (Edge Function newsletter-welcome) goes out in that language. Safe to re-run.
alter table public.newsletter_signups add column if not exists lang text check (lang in ('es', 'en'));
