-- Instagram reels with licensed music: Instagram doesn't play them outside its app (its embed shows only "Watch on
-- Instagram"). supabase/functions/ig-rights reads each Instagram post's embed once and stores here whether it's blocked;
-- library_ideas() returns it so the library shows those cards with a "watch on Instagram" link and why. Safe to run again.
alter table public.content_ideas add column if not exists ig_blocked boolean, add column if not exists ig_checked_at timestamptz;

do $$
declare d text; n int;
begin
  d := pg_get_functiondef('public.library_ideas(jsonb,text,date,date,text,text,bigint[],integer,integer,bigint[],bigint[],bigint,bigint)'::regprocedure);
  if d not like '%ig_blocked%' then
    n := (length(d) - length(replace(d, '''duration_s'', p.duration_s, ''views'', p.views)', ''))) / length('''duration_s'', p.duration_s, ''views'', p.views)')
       + (length(d) - length(replace(d, '''duration_s'', c.duration_s, ''views'', c.views)', ''))) / length('''duration_s'', c.duration_s, ''views'', c.views)');
    d := replace(d, '''duration_s'', p.duration_s, ''views'', p.views)',
      '''duration_s'', p.duration_s, ''views'', p.views, ''ig_blocked'', (select x.ig_blocked from public.content_ideas x where x.id = p.id))');
    d := replace(d, '''duration_s'', c.duration_s, ''views'', c.views)', '''duration_s'', c.duration_s, ''views'', c.views, ''ig_blocked'', c.ig_blocked)');
    if n < 3 then raise exception 'library_ideas changed: % places found', n; end if;
    execute d;
  end if;
end $$;
