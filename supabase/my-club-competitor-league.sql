-- My Club admin: a competitor that is a competition (e.g. LaLiga) says so in admin_club ("competition": its library tag
-- id), so its card offers "Add its clubs" in one click (admin/js/my-club.js). Patches admin_club in place. Safe to run again.
do $do$
declare d text := pg_get_functiondef('public.admin_club'::regproc);
begin
  if position('''competition''' in d) = 0 then
    d := replace(d, '''active'', p.active,', '''active'', p.active, ''competition'', (select v.id from public.idea_catalog v where v.id = p.catalog_value_id and v.category = ''competition''),');
    execute d;
  end if;
end $do$;
