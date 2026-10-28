-- LinkedIn is no longer shown on SCP (28/10/2026): its posts are hidden from the Content Library with the same mark the
-- library already skips everywhere (content_ideas.unavailable_at), and new LinkedIn imports get it on arrival.
-- They are not deleted; admin → Content ideas leaves them out of its "no longer available" review and bulk delete.
-- Undo: drop the trigger and set unavailable_at = null where url ilike '%linkedin.com%'.

update public.content_ideas set unavailable_at = now()
where url ilike '%linkedin.com%' and unavailable_at is null;

create or replace function public.content_ideas_hide_linkedin()
returns trigger language plpgsql as $$
begin
  if new.url ilike '%linkedin.com%' and new.unavailable_at is null then new.unavailable_at := now(); end if;
  return new;
end $$;

drop trigger if exists content_ideas_hide_linkedin on public.content_ideas;
create trigger content_ideas_hide_linkedin before insert or update of url, unavailable_at on public.content_ideas
for each row execute function public.content_ideas_hide_linkedin();
