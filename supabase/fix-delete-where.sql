-- Fix: "DELETE requires a WHERE clause" when approving an import (Admin → Import → Approve and publish).
-- Called from the website (the API), a DELETE without WHERE is refused; both functions empty the library_total_cache
-- with one. Same functions as supabase/import-review.sql and supabase/performance-7.sql, now with "where true".
-- Run once in Supabase > SQL editor. Safe to run again.

create or replace function public.admin_import_approve(p_import_id bigint)
returns int language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  delete from public.content_hidden h using public.content_ideas c
    where c.import_id = p_import_id and h.external_id = c.external_id
      and not exists (select 1 from public.content_removals r where r.external_id = c.external_id);
  get diagnostics n = row_count;
  update public.idea_imports set review_status = 'approved', approved_at = now(), approved_by = auth.uid() where id = p_import_id;
  delete from public.library_total_cache where true;
  return n;
end $$;

create or replace function public.refresh_library_stats(p_part text default 'all')
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'Not allowed'; end if;
  if p_part in ('all', 'values') then refresh materialized view concurrently public.library_value_counts; end if;
  if p_part in ('all', 'totals') then refresh materialized view concurrently public.library_totals; end if;
  if p_part in ('all', 'pairs') then refresh materialized view concurrently public.library_pair_counts; end if;
  delete from public.library_total_cache where true;
end $$;
