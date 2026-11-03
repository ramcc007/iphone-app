-- Applied after the site reads posts only through writer_blog_api (004). Visitors can no longer read
-- public.posts directly: no public policy and no table rights for anon/authenticated (they also had
-- TRUNCATE, REFERENCES and TRIGGER, which the web API never exposed but should not be granted).
alter table public.posts enable row level security;
drop policy if exists "live posts are public" on public.posts;
revoke all on table public.posts from anon, authenticated;
