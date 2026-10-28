-- Admin → Content ideas → posts that no longer exist → "Cover": admins can upload a post's cover by hand (a screenshot of
-- the post, an image…) to the public bucket "covers" (supabase/covers.sql). Run once in Supabase (SQL Editor). Safe to run again.
drop policy if exists "Admins upload covers" on storage.objects;
create policy "Admins upload covers" on storage.objects for insert to authenticated with check (bucket_id = 'covers' and public.is_admin());
drop policy if exists "Admins replace covers" on storage.objects;
create policy "Admins replace covers" on storage.objects for update to authenticated using (bucket_id = 'covers' and public.is_admin());
