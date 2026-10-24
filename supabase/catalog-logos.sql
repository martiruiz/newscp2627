-- Admin → Filters: admins upload the logo of a brand / club / competition (bucket "logos", folder catalog/), saved in
-- idea_catalog.logo_url (supabase/library-filters.sql). Pasting a link instead needs nothing from this file.
-- Run once in Supabase > SQL editor. Safe to run again.

drop policy if exists "Admins upload catalog logos" on storage.objects;
create policy "Admins upload catalog logos" on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and name like 'catalog/%' and public.is_admin());
drop policy if exists "Admins replace catalog logos" on storage.objects;
create policy "Admins replace catalog logos" on storage.objects for update to authenticated
  using (bucket_id = 'logos' and name like 'catalog/%' and public.is_admin());
drop policy if exists "Admins delete catalog logos" on storage.objects;
create policy "Admins delete catalog logos" on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and name like 'catalog/%' and public.is_admin());
