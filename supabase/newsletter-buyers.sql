-- Who buys the platform starts subscribed to the newsletter (they can unsubscribe in Profile → Newsletter or from any e-mail).
-- Only on the first purchase (the subscription row is created once per member; later changes are updates), only for
-- Stripe purchases, and it never touches anyone who already has a subscription.
-- Run once in Supabase (project "NOVA WEB SCP 2627"): SQL Editor → New query → paste → Run. Safe to run again.
create or replace function public.subscribe_buyer_to_newsletter()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set newsletter = true where id = new.user_id and newsletter is not true;
  return new;
end $$;

drop trigger if exists subscribe_buyer_to_newsletter on public.subscriptions;
create trigger subscribe_buyer_to_newsletter after insert on public.subscriptions
  for each row when (new.source = 'stripe') execute function public.subscribe_buyer_to_newsletter();
