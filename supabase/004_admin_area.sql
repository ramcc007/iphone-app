-- Admin area on numfall.store (owner's approval, 3 November 2026).
--  * key_takeaways ("In short" box) and created_at on posts.
--  * live_list and live_get in writer_blog_api (secret-checked, server only), which apply the live rule
--    (status scheduled/published and publish_at <= now) on every call. Public pages switch to these;
--    005 then removes direct public reads of the table.

alter table public.posts add column if not exists key_takeaways jsonb not null default '[]'::jsonb;
alter table public.posts add column if not exists created_at timestamptz;
update public.posts set created_at = least(coalesce(publish_at, updated_at), updated_at) where created_at is null;
alter table public.posts alter column created_at set default now();
alter table public.posts alter column created_at set not null;

create or replace function public.writer_blog_api(p_secret text, p_op text, p_args jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, writer_private, extensions
as $$
declare
  v_hash text;
  v_out jsonb;
  v_post jsonb := coalesce(p_args->'post', '{}'::jsonb);
  v_id uuid := nullif(coalesce(p_args->>'id', v_post->>'id'), '')::uuid;
  v_row public.posts;
begin
  select secret_hash into v_hash from writer_private.config where id = 1;
  if v_hash is null or p_secret is null or encode(extensions.digest(p_secret, 'sha256'), 'hex') <> v_hash then
    raise exception 'unauthorised' using errcode = '42501';
  end if;

  case p_op
  when 'post_list' then
    select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'article_id', p.article_id, 'slug', p.slug, 'title', p.title,
      'excerpt', p.excerpt, 'description', p.description, 'author', p.author, 'category', p.category, 'tags', to_jsonb(p.tags),
      'status', p.status, 'publish_at', p.publish_at, 'updated_at', p.updated_at, 'created_at', p.created_at, 'word_count', p.word_count)
      order by p.publish_at desc), '[]'::jsonb) into v_out from public.posts p;
    return v_out;

  when 'post_get' then
    select to_jsonb(p) into v_out from public.posts p where p.id = v_id;
    return v_out;

  when 'post_save' then
    -- Insert (no id) or update (id). Article-made posts keep their article_id; hand-written posts have none.
    if v_id is null then
      insert into public.posts (article_id, slug, title, description, excerpt, meta_title, author, category, tags, html, faq, sources,
                                headings, related, word_count, reading_minutes, status, publish_at, updated_at, key_takeaways)
      values (nullif(v_post->>'article_id', ''), v_post->>'slug', v_post->>'title', coalesce(v_post->>'description', ''),
              coalesce(v_post->>'excerpt', ''), coalesce(v_post->>'meta_title', ''), v_post->>'author', v_post->>'category',
              array(select jsonb_array_elements_text(coalesce(v_post->'tags', '[]'))), coalesce(v_post->>'html', ''),
              coalesce(v_post->'faq', '[]'), coalesce(v_post->'sources', '[]'),
              array(select jsonb_array_elements_text(coalesce(v_post->'headings', '[]'))),
              array(select jsonb_array_elements_text(coalesce(v_post->'related', '[]'))),
              coalesce((v_post->>'word_count')::int, 0), coalesce((v_post->>'reading_minutes')::int, 1),
              v_post->>'status', coalesce((v_post->>'publish_at')::timestamptz, now()), now(), coalesce(v_post->'key_takeaways', '[]'))
      returning * into v_row;
    else
      update public.posts set slug = v_post->>'slug', title = v_post->>'title', description = coalesce(v_post->>'description', ''),
        excerpt = coalesce(v_post->>'excerpt', ''), meta_title = coalesce(v_post->>'meta_title', ''), author = v_post->>'author',
        category = v_post->>'category', tags = array(select jsonb_array_elements_text(coalesce(v_post->'tags', '[]'))),
        html = coalesce(v_post->>'html', ''), faq = coalesce(v_post->'faq', '[]'), sources = coalesce(v_post->'sources', '[]'),
        headings = array(select jsonb_array_elements_text(coalesce(v_post->'headings', '[]'))),
        word_count = coalesce((v_post->>'word_count')::int, word_count), reading_minutes = coalesce((v_post->>'reading_minutes')::int, reading_minutes),
        status = v_post->>'status', publish_at = coalesce((v_post->>'publish_at')::timestamptz, publish_at), updated_at = now(),
        key_takeaways = coalesce(v_post->'key_takeaways', key_takeaways)
      where id = v_id
      returning * into v_row;
      if v_row.id is null then raise exception 'post not found' using errcode = 'P0002'; end if;
    end if;
    return to_jsonb(v_row);

  when 'post_upsert_article' then
    -- The writer posting one of its articles (keyed by article_id), with the new columns.
    insert into public.posts as p (article_id, slug, title, description, excerpt, meta_title, author, category, tags, html, faq, sources,
                                   headings, related, word_count, reading_minutes, status, publish_at, updated_at)
    values (v_post->>'article_id', v_post->>'slug', v_post->>'title', coalesce(v_post->>'description', ''), coalesce(v_post->>'excerpt', ''),
            coalesce(v_post->>'meta_title', ''), v_post->>'author', v_post->>'category',
            array(select jsonb_array_elements_text(coalesce(v_post->'tags', '[]'))), v_post->>'html', coalesce(v_post->'faq', '[]'),
            coalesce(v_post->'sources', '[]'), array(select jsonb_array_elements_text(coalesce(v_post->'headings', '[]'))),
            array(select jsonb_array_elements_text(coalesce(v_post->'related', '[]'))),
            coalesce((v_post->>'word_count')::int, 0), coalesce((v_post->>'reading_minutes')::int, 1),
            v_post->>'status', (v_post->>'publish_at')::timestamptz, now())
    on conflict (article_id) do update set slug = excluded.slug, title = excluded.title, description = excluded.description,
      excerpt = excluded.excerpt, meta_title = excluded.meta_title, author = excluded.author, category = excluded.category,
      tags = excluded.tags, html = excluded.html, faq = excluded.faq, sources = excluded.sources, headings = excluded.headings,
      related = excluded.related, word_count = excluded.word_count, reading_minutes = excluded.reading_minutes,
      status = excluded.status, publish_at = excluded.publish_at, updated_at = now()
    returning * into v_row;
    return jsonb_build_object('id', v_row.id, 'slug', v_row.slug);

  when 'live_list' then
    -- Public pages: posts that are live right now (status scheduled or published, time has come). Checked on every call.
    select coalesce(jsonb_agg(jsonb_build_object('slug', p.slug, 'title', p.title, 'description', p.description, 'excerpt', p.excerpt,
      'author', p.author, 'category', p.category, 'tags', to_jsonb(p.tags), 'related', to_jsonb(p.related),
      'reading_minutes', p.reading_minutes, 'publish_at', p.publish_at, 'updated_at', p.updated_at, 'status', p.status)
      order by p.publish_at desc), '[]'::jsonb) into v_out
    from public.posts p where p.status in ('scheduled', 'published') and p.publish_at <= now();
    return v_out;

  when 'live_get' then
    select to_jsonb(p) into v_out from public.posts p
    where p.slug = p_args->>'slug' and p.status in ('scheduled', 'published') and p.publish_at <= now();
    return v_out;

  when 'post_delete' then
    delete from public.posts where id = v_id;
    return jsonb_build_object('deleted', found);

  else
    raise exception 'unknown op %', p_op;
  end case;
end;
$$;

revoke all on function public.writer_blog_api(text, text, jsonb) from public;
grant execute on function public.writer_blog_api(text, text, jsonb) to anon, authenticated;
