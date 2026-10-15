-- Member profile: who the client is, their sport, goals, favourite profiles / creators and newsletter preferences.
-- Used to personalise the Content Library ("For you") and to segment newsletters (Admin → Audience).
-- Run after supabase/schema.sql. Safe to re-run.

alter table public.profiles add column if not exists preferences            jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists preferences_updated_at timestamptz;
alter table public.profiles add column if not exists newsletter             boolean not null default false;
alter table public.profiles add column if not exists newsletter_frequency   text check (newsletter_frequency in ('weekly', 'biweekly', 'monthly'));
alter table public.profiles add column if not exists newsletter_consent_at  timestamptz;   -- when they opted in (GDPR record)

-- preferences JSON (all optional):
-- { "role", "organization", "orgType", "country", "language", "teamSize",
--   "sports": [catalog ids], "competitions": [catalog ids], "platforms": ["instagram", …], "audience": "s|m|l|xl|xxl",
--   "favouriteProfiles": [{ "id": catalog id | null, "name" }], "favouriteCreators": [{ "id", "name" }],   -- max 5 each
--   "goals": […], "formats": […], "topics": […], "challenge": "free text", "newsletterTopics": […] }

-- Each member saves only their own row (never role or plan).
create or replace function public.update_my_preferences(p_preferences jsonb, p_newsletter boolean, p_frequency text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  update public.profiles set
    preferences            = coalesce(p_preferences, '{}'::jsonb),
    preferences_updated_at = now(),
    newsletter             = coalesce(p_newsletter, false),
    newsletter_frequency   = case when coalesce(p_newsletter, false) then coalesce(p_frequency, 'weekly') end,
    newsletter_consent_at  = case
                               when coalesce(p_newsletter, false) and not newsletter then now()
                               when not coalesce(p_newsletter, false) then null
                               else newsletter_consent_at
                             end
  where id = auth.uid();
end;
$$;
revoke execute on function public.update_my_preferences(jsonb, boolean, text) from public, anon;
grant execute on function public.update_my_preferences(jsonb, boolean, text) to authenticated;

-- ---------- Profile photo ----------
alter table public.profiles add column if not exists avatar_url text;

-- Public bucket "avatars": anyone can view; each member can only write inside their own folder (<user id>/…)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Members read own avatars" on storage.objects;
create policy "Members read own avatars" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Members upload own avatar" on storage.objects;
create policy "Members upload own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Members update own avatar" on storage.objects;
create policy "Members update own avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Members delete own avatar" on storage.objects;
create policy "Members delete own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Save the photo URL (only a URL from the member's own folder, or null to remove it)
create or replace function public.update_my_avatar(p_url text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_url is not null and p_url not like '%/storage/v1/object/public/avatars/' || auth.uid()::text || '/%' then
    raise exception 'Invalid photo URL';
  end if;
  update public.profiles set avatar_url = p_url where id = auth.uid();
end;
$$;
revoke execute on function public.update_my_avatar(text) from public, anon;
grant execute on function public.update_my_avatar(text) to authenticated;
