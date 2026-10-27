-- Newsletter visual editor: admins can upload replacement images to the public "newsletter" bucket (jpeg/png/webp, 5 MB).
create policy "Admins upload newsletter images" on storage.objects for insert to authenticated
  with check (bucket_id = 'newsletter' and public.is_admin());
