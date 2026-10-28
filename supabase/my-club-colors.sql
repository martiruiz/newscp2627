-- My Club in the club's colours: clubs.colors = {"primary": "#a50044", "secondary": "#004d98"} (Admin → My Club).
-- club_space() and admin_club() return them; admin_club_save() stores them when sent. Empty = the page takes them
-- from the crest (js/my-club.js). Patched in place, the rest of each function unchanged. Safe to run again.
alter table public.clubs add column if not exists colors jsonb;

do $$
declare d text;
begin
  d := pg_get_functiondef('public.club_space(bigint)'::regprocedure);
  if d not like '%''colors'', c.colors%' then
    execute replace(d, '''logo_url'', c.logo_url, ''accounts'', c.accounts)', '''logo_url'', c.logo_url, ''accounts'', c.accounts, ''colors'', c.colors)');
  end if;
  d := pg_get_functiondef('public.admin_club(bigint)'::regprocedure);
  if d not like '%''colors'', c.colors%' then
    execute replace(d, '''accounts'', c.accounts, ''active'', c.active,', '''accounts'', c.accounts, ''active'', c.active, ''colors'', c.colors,');
  end if;
  d := pg_get_functiondef('public.admin_club_save(jsonb)'::regprocedure);
  if d not like '%colors =%' then
    execute replace(d, 'active = coalesce((p ->> ''active'')::boolean, active), updated_at = now()',
      'active = coalesce((p ->> ''active'')::boolean, active), colors = case when p ? ''colors'' then nullif(p -> ''colors'', ''{}''::jsonb) else colors end, updated_at = now()');
  end if;
end $$;
