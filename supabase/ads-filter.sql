-- "Ads" filter (Content Library → Discover): the Instagram posts with the "Paid partnership" label
-- (content_ideas.paid_partnership, supabase/instagram-paid-partnership.sql) carry the catalog value trend · Ads, kept in
-- step by a trigger, so it works like any other filter (its count, combinations). js/library.js hides it while no post has it.
insert into public.idea_catalog (category, name) values ('trend', 'Ads') on conflict (category, name) do nothing;

create or replace function public.content_ideas_ads_tag()
returns trigger language plpgsql security definer set search_path = public as $$
declare v bigint := (select id from public.idea_catalog where category = 'trend' and name = 'Ads');
begin
  if v is null or (tg_op = 'INSERT' and new.paid_partnership is null) then return new; end if;
  if new.paid_partnership is true and new.account_platform = 'instagram' then
    insert into public.content_idea_tags (idea_id, value_id, source) values (new.id, v, 'meta') on conflict do nothing;
  else
    delete from public.content_idea_tags where idea_id = new.id and value_id = v;
  end if;
  return new;
end $$;
revoke execute on function public.content_ideas_ads_tag() from public, anon, authenticated;
drop trigger if exists content_ideas_ads_tag on public.content_ideas;
create trigger content_ideas_ads_tag after insert or update of paid_partnership on public.content_ideas
  for each row execute function public.content_ideas_ads_tag();
