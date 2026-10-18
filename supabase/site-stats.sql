-- Public library totals for the website (home and pricing show "500,000+ posts from 770+ clubs…" from these).
-- Only aggregate numbers, read from the precomputed library counts (refreshed after every import), so it's fast
-- and reveals nothing else. Run once in Supabase → SQL Editor (safe to re-run).
create or replace function public.site_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'posts',        coalesce((select n from public.library_totals where key = 'library'), 0),
    'clubs',        (select count(*) from public.idea_catalog v join public.library_value_counts c on c.value_id = v.id where v.category = 'club' and c.ideas > 0),
    'competitions', (select count(*) from public.idea_catalog v join public.library_value_counts c on c.value_id = v.id where v.category = 'competition' and c.ideas > 0),
    'sports',       (select count(*) from public.idea_catalog v join public.library_value_counts c on c.value_id = v.id where v.category = 'sport' and c.ideas > 0)
  );
$$;
revoke execute on function public.site_stats() from public;
grant execute on function public.site_stats() to anon, authenticated;
