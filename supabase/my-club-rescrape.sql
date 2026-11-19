-- My Club: every profile scraped from My Club is scraped again every 12 hours (9:00 and 21:00, Madrid time) by
-- pipeline/library/club-rescrape.mjs (.github/workflows/club-rescrape.yml). It imports with the service key, like the
-- admin's "Scrape" button does with a superadmin's session: these import functions accept the service role too.
do $$
declare f text; d text;
begin
  foreach f in array array['public.import_content_ideas_batch(bigint, jsonb)', 'public.set_idea_accounts(jsonb)', 'public.set_idea_cover_sources(jsonb)', 'public.set_idea_scrape_extras(jsonb)'] loop
    d := pg_get_functiondef(f::regprocedure);
    if position('service_role' in d) = 0 then
      execute replace(d, 'if not public.is_admin() then raise exception', 'if not (public.is_admin() or auth.role() = ''service_role'') then raise exception');
    end if;
  end loop;
end $$;
