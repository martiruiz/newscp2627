-- Public link to one post (post.html?s=<token>): anyone who uses the platform can make one (library card → Share), and
-- whoever opens it — even without an account — sees only that post (the post, its metrics, its filters and the summary of
-- its AI analysis). The rest of the library stays behind the log-in. Links never expire. Run once in the SQL Editor.

create table if not exists public.post_shares (
  token text primary key,                               -- random, so nobody can guess other posts' links
  post_id bigint not null unique references public.content_ideas (id) on delete cascade,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.post_shares enable row level security;   -- only through the two functions below

-- the post's public link (the same one every time for the same post)
create or replace function public.share_post(p_id bigint)
returns text
language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if auth.uid() is null then raise exception 'Log in to share a post'; end if;
  if not exists (select 1 from content_ideas where id = p_id and unavailable_at is null) then raise exception 'Post not found'; end if;
  select token into t from post_shares where post_id = p_id;
  if t is null then
    t := translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/', '-_');
    insert into post_shares (token, post_id) values (t, p_id) on conflict (post_id) do nothing;
    select token into t from post_shares where post_id = p_id;
  end if;
  return t;
end $$;
revoke execute on function public.share_post(bigint) from public, anon;
grant execute on function public.share_post(bigint) to authenticated;

-- what the public page shows: only the post of that link (nothing for an unknown link)
create or replace function public.shared_post(p_token text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'url', c.url, 'title', c.title, 'published_at', c.published_at,
    'account', c.account, 'platform', c.account_platform,
    'cover_url', coalesce(c.cover_url, c.cover_source),
    'views', c.views, 'likes', c.likes, 'comments', c.comments, 'shares', c.shares,
    'media_ratio', c.media_ratio,
    'tags', coalesce((select jsonb_agg(jsonb_build_object('category', v.category, 'name', v.name, 'logo', v.logo_url) order by v.category, v.name)
                      from content_idea_tags t join idea_catalog v on v.id = t.value_id where t.idea_id = c.id), '[]'),
    'summary', (select a.result ->> 'summary' from ai_analyses a where a.post_id = c.id order by a.generated_at desc limit 1),
    'summary_es', (select a.result -> 'es' ->> 'summary' from ai_analyses a where a.post_id = c.id order by a.generated_at desc limit 1))
  from post_shares s join content_ideas c on c.id = s.post_id
  where s.token = p_token and c.unavailable_at is null
$$;
grant execute on function public.shared_post(text) to anon, authenticated;
