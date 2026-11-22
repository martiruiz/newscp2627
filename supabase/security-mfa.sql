-- Two-step verification for the back-end, in the database too: is_admin() is true only for a superadmin whose session was
-- confirmed with the authenticator app's code (aal2). A stolen password (or a session without the code) gets no admin
-- rights through the API. Run it only once the superadmins have set up their app (admin/js/core.js mfaGate).
-- Undo: run it again with "and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'" removed.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'superadmin' from public.profiles where id = auth.uid()), false)
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;
