-- Saved searches in the Content Library (js/library.js): 10 per member at most; saving one with an existing name updates it.
create or replace function public.saved_searches_max()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.saved_searches where user_id = new.user_id) >= 10 then
    raise exception 'You can save up to 10 searches: delete one to save another' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.saved_searches_max() from public, anon, authenticated;
drop trigger if exists saved_searches_max on public.saved_searches;
create trigger saved_searches_max before insert on public.saved_searches for each row execute function public.saved_searches_max();
