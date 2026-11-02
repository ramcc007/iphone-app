-- NumFall articles: the database the website reads and NumFall Writer writes.
-- Supabase project "numfall" (us-east-1). Safe to run more than once.
--
-- Who can do what
--   * Visitors (anon key, used by the website): can read only rows of public.posts that are live
--     (status scheduled/published and publish_at <= now()). Nothing else.
--   * NumFall Writer: calls public.writer_api(secret, op, args). The secret is checked against a
--     SHA-256 hash; only the hash is stored here. The function can touch only the writer tables and
--     public.posts, so the app never holds a key that can read anything else.
--   * pg_cron: every minute, pokes /api/tick only when an article is waiting for work; every
--     10 minutes, marks due scheduled posts as published and pokes /api/tick to sweep leftovers.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron;
create extension if not exists pg_net;

create schema if not exists writer_private;
revoke all on schema writer_private from public, anon, authenticated;

create table if not exists writer_private.config (
  id int primary key default 1 check (id = 1),
  secret_hash text not null,
  tick_url text not null default 'https://www.numfall.store/api/tick',
  tick_secret text not null default ''
);

-- One row per article in the pipeline. "data" is the whole working article (research, plan,
-- drafts, scores, usage); the columns beside it are copies used for queueing and leases.
create table if not exists writer_private.articles (
  id text primary key,
  batch_id text,
  position int not null default 0,
  status text not null,
  stopped boolean not null default false,
  next_attempt_at timestamptz not null default now(),
  lease_owner text,
  lease_until timestamptz,
  publish_at timestamptz,
  slug text,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists articles_queue on writer_private.articles (status, stopped, next_attempt_at, created_at, position);

create table if not exists writer_private.settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb
);
insert into writer_private.settings (id) values (1) on conflict do nothing;

-- Small shared flags, e.g. {"key":"humanizer_paused_until"}.
create table if not exists writer_private.state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Every paid call, with its cost.
create table if not exists writer_private.usage_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  article_id text,
  step text not null,
  provider text not null,          -- anthropic | groq | openrouter | gptzero
  model text,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  searches int not null default 0,
  words int not null default 0,     -- GPTZero words
  cost_usd numeric(12,6) not null default 0,
  ok boolean not null default true,
  note text
);
create index if not exists usage_log_at on writer_private.usage_log (at);

-- What the website shows, at numfall.store/blog/<slug>. Slugs are 3 to 6 lowercase hyphenated words.
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  article_id text unique,
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+){2,5}$'),
  title text not null,
  description text not null,
  author text not null,
  category text not null,
  tags text[] not null default '{}',
  html text not null,
  faq jsonb not null default '[]'::jsonb,
  headings text[] not null default '{}',
  related text[] not null default '{}',
  word_count int not null default 0,
  reading_minutes int not null default 1,
  status text not null check (status in ('scheduled','published','unpublished')),
  publish_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create index if not exists posts_live on public.posts (status, publish_at desc);

alter table public.posts enable row level security;
drop policy if exists "live posts are public" on public.posts;
create policy "live posts are public" on public.posts for select to anon, authenticated
  using (status in ('scheduled','published') and publish_at <= now());
revoke insert, update, delete on public.posts from anon, authenticated;
grant select on public.posts to anon, authenticated;

-- The writer's only door.
create or replace function public.writer_api(p_secret text, p_op text, p_args jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, writer_private, extensions
as $$
declare
  v_hash text;
  v_out jsonb;
  v_id text := p_args->>'id';
  v_owner text := p_args->>'owner';
  v_secs int := coalesce((p_args->>'seconds')::int, 330);
  v_row writer_private.articles;
  v_n int;
begin
  select secret_hash into v_hash from writer_private.config where id = 1;
  if v_hash is null or p_secret is null or encode(extensions.digest(p_secret, 'sha256'), 'hex') <> v_hash then
    raise exception 'unauthorised' using errcode = '42501';
  end if;

  case p_op
  when 'article_get' then
    select to_jsonb(a) into v_out from writer_private.articles a where a.id = v_id;
    return v_out;

  when 'article_list' then
    select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'batch_id', a.batch_id, 'status', a.status, 'stopped', a.stopped,
      'publish_at', a.publish_at, 'slug', a.slug, 'created_at', a.created_at, 'updated_at', a.updated_at,
      'lease_until', a.lease_until, 'summary', a.data->'summary') order by a.created_at desc, a.position desc), '[]'::jsonb)
      into v_out from (select * from writer_private.articles order by created_at desc limit coalesce((p_args->>'limit')::int, 500)) a;
    return v_out;

  when 'article_put' then
    -- Saves only if the caller still holds the lease (or nobody does), so two runners never overwrite each other.
    insert into writer_private.articles as a (id, batch_id, position, status, stopped, next_attempt_at, publish_at, slug, data, created_at, updated_at)
    values (v_id, p_args->>'batch_id', coalesce((p_args->>'position')::int, 0), p_args->>'status',
            coalesce((p_args->>'stopped')::boolean, false), coalesce((p_args->>'next_attempt_at')::timestamptz, now()),
            (p_args->>'publish_at')::timestamptz, p_args->>'slug', p_args->'data',
            coalesce((p_args->>'created_at')::timestamptz, now()), now())
    on conflict (id) do update set
      status = excluded.status, stopped = excluded.stopped, next_attempt_at = excluded.next_attempt_at,
      publish_at = excluded.publish_at, slug = excluded.slug, data = excluded.data, updated_at = now()
    where a.lease_owner is null or a.lease_until < now() or a.lease_owner = v_owner
    returning * into v_row;
    if v_row.id is null then raise exception 'lease held by another runner' using errcode = '55P03'; end if;
    return jsonb_build_object('id', v_row.id, 'updated_at', v_row.updated_at);

  when 'article_delete' then
    delete from writer_private.articles where id = v_id;
    return jsonb_build_object('deleted', found);

  when 'lease_claim' then
    update writer_private.articles set lease_owner = v_owner, lease_until = now() + make_interval(secs => v_secs)
    where id = v_id and (lease_owner is null or lease_until < now() or lease_owner = v_owner)
    returning * into v_row;
    return case when v_row.id is null then null else to_jsonb(v_row) end;

  when 'lease_release' then
    update writer_private.articles set lease_owner = null, lease_until = null where id = v_id and lease_owner = v_owner;
    return jsonb_build_object('released', found);

  when 'next_job' then
    -- Oldest batch first, then batch order; one article at a time per runner.
    update writer_private.articles set lease_owner = v_owner, lease_until = now() + make_interval(secs => v_secs)
    where id = (
      select id from writer_private.articles
      where status in ('queued','generating','checking','publishing') and not stopped and next_attempt_at <= now()
        and (lease_owner is null or lease_until < now())
      order by created_at, position
      limit 1 for update skip locked)
    returning * into v_row;
    return case when v_row.id is null then null else to_jsonb(v_row) end;

  when 'settings_get' then
    select data into v_out from writer_private.settings where id = 1;
    return coalesce(v_out, '{}'::jsonb);

  when 'settings_put' then
    update writer_private.settings set data = p_args->'data' where id = 1;
    return p_args->'data';

  when 'state_get' then
    select value into v_out from writer_private.state where key = p_args->>'key';
    return v_out;

  when 'state_put' then
    insert into writer_private.state (key, value) values (p_args->>'key', p_args->'value')
    on conflict (key) do update set value = excluded.value, updated_at = now();
    return p_args->'value';

  when 'usage_add' then
    insert into writer_private.usage_log (article_id, step, provider, model, input_tokens, output_tokens, searches, words, cost_usd, ok, note)
    values (p_args->>'article_id', p_args->>'step', p_args->>'provider', p_args->>'model',
            coalesce((p_args->>'input_tokens')::int, 0), coalesce((p_args->>'output_tokens')::int, 0),
            coalesce((p_args->>'searches')::int, 0), coalesce((p_args->>'words')::int, 0),
            coalesce((p_args->>'cost_usd')::numeric, 0), coalesce((p_args->>'ok')::boolean, true), p_args->>'note');
    return jsonb_build_object('ok', true);

  when 'usage_list' then
    select coalesce(jsonb_agg(to_jsonb(u) order by u.at desc), '[]'::jsonb) into v_out
    from writer_private.usage_log u
    where u.at >= coalesce((p_args->>'from')::timestamptz, now() - interval '31 days')
      and u.at < coalesce((p_args->>'to')::timestamptz, now() + interval '1 day');
    return v_out;

  when 'post_upsert' then
    insert into public.posts as p (article_id, slug, title, description, author, category, tags, html, faq, headings, related,
                                   word_count, reading_minutes, status, publish_at, updated_at)
    values (p_args->>'article_id', p_args->>'slug', p_args->>'title', p_args->>'description', p_args->>'author',
            p_args->>'category', array(select jsonb_array_elements_text(coalesce(p_args->'tags', '[]'))),
            p_args->>'html', coalesce(p_args->'faq', '[]'), array(select jsonb_array_elements_text(coalesce(p_args->'headings', '[]'))),
            array(select jsonb_array_elements_text(coalesce(p_args->'related', '[]'))),
            coalesce((p_args->>'word_count')::int, 0), coalesce((p_args->>'reading_minutes')::int, 1),
            p_args->>'status', (p_args->>'publish_at')::timestamptz, now())
    on conflict (article_id) do update set slug = excluded.slug, title = excluded.title, description = excluded.description,
      author = excluded.author, category = excluded.category, tags = excluded.tags, html = excluded.html, faq = excluded.faq,
      headings = excluded.headings, related = excluded.related, word_count = excluded.word_count,
      reading_minutes = excluded.reading_minutes, status = excluded.status, publish_at = excluded.publish_at, updated_at = now();
    return jsonb_build_object('slug', p_args->>'slug');

  when 'post_unpublish' then
    update public.posts set status = 'unpublished', updated_at = now() where article_id = v_id;
    return jsonb_build_object('ok', found);

  when 'post_admin' then
    -- Any post, live or not, for the signed-in preview.
    select to_jsonb(p) into v_out from public.posts p where p.slug = p_args->>'slug';
    return v_out;

  when 'posts_index' then
    -- Every post the writer knows of (titles and headings for uniqueness, slugs for links, dates for scheduling).
    select coalesce(jsonb_agg(jsonb_build_object('article_id', p.article_id, 'slug', p.slug, 'title', p.title,
      'headings', to_jsonb(p.headings), 'tags', to_jsonb(p.tags), 'category', p.category, 'status', p.status,
      'publish_at', p.publish_at) order by p.publish_at desc), '[]'::jsonb) into v_out from public.posts p;
    return v_out;

  when 'sweep' then
    v_n := writer_private.sweep();
    return jsonb_build_object('published', v_n);

  else
    raise exception 'unknown op %', p_op;
  end case;
end;
$$;

revoke all on function public.writer_api(text, text, jsonb) from public;
grant execute on function public.writer_api(text, text, jsonb) to anon, authenticated;

-- Marks scheduled posts whose time has come as published (in both tables).
create or replace function writer_private.sweep() returns int
language plpgsql security definer set search_path = public, writer_private as $$
declare v_n int;
begin
  update public.posts set status = 'published', updated_at = now() where status = 'scheduled' and publish_at <= now();
  get diagnostics v_n = row_count;
  update writer_private.articles set status = 'published',
    data = jsonb_set(jsonb_set(data, '{status}', '"published"'), '{publishedAt}', to_jsonb(publish_at))
  where status = 'scheduled' and publish_at <= now();
  return v_n;
end;
$$;
revoke all on function writer_private.sweep() from public, anon, authenticated;

-- Pokes the writer's /api/tick (fire and forget). Does nothing when no article is waiting.
create or replace function writer_private.poke(p_force boolean default false) returns void
language plpgsql security definer set search_path = public, writer_private, extensions as $$
declare c writer_private.config;
begin
  select * into c from writer_private.config where id = 1;
  if c.tick_secret = '' then return; end if;
  if p_force or exists (select 1 from writer_private.articles
      where status in ('queued','generating','checking','publishing') and not stopped and next_attempt_at <= now()
        and (lease_owner is null or lease_until < now())) then
    perform net.http_post(url := c.tick_url, body := '{}'::jsonb,
      headers := jsonb_build_object('content-type', 'application/json', 'authorization', 'Bearer ' || c.tick_secret),
      timeout_milliseconds := 10000);
  end if;
end;
$$;
revoke all on function writer_private.poke(boolean) from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname in ('numfall-tick', 'numfall-sweep');
select cron.schedule('numfall-tick', '* * * * *', $c$select writer_private.poke(false)$c$);
select cron.schedule('numfall-sweep', '*/10 * * * *', $c$select writer_private.sweep(); select writer_private.poke(false)$c$);
