-- Covers from the scraping (Bright Data's image_url): the import CSV can carry a "cover" column with the post's image
-- link; it is kept in content_ideas.cover_source and the Edge Function "covers" copies that image to Storage first,
-- without going to Instagram (which blocks big imports). Posts without it keep the current way (the platform's page).
-- Instagram's image links expire after a few days: import the CSV the same day or the next.
-- Run once in Supabase (SQL Editor), then deploy the function: npx supabase functions deploy covers
alter table public.content_ideas add column if not exists cover_source text;

-- [{external_id, cover}] from the import; a post still without a cover goes back to the queue (cover_at = null)
create or replace function public.set_idea_cover_sources(p_rows jsonb)
returns int language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  update public.content_ideas c set cover_source = r.cover,
      cover_at = case when c.cover_url is null and c.unavailable_at is null then null else c.cover_at end
    from (select x ->> 'external_id' as external_id, nullif(trim(x ->> 'cover'), '') as cover
          from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) x) r
    where c.external_id = r.external_id and r.cover like 'https://%';
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.set_idea_cover_sources(jsonb) from public, anon;
grant execute on function public.set_idea_cover_sources(jsonb) to authenticated;
