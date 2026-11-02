-- Error log for NumFall Writer (owner's approval, 2 November 2026). Every failure is written here so a
-- scheduled check (and the admin Errors tab) can see and fix problems without the owner reporting them.

create table if not exists writer_private.error_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  article_id text,
  title text,
  stage text,
  kind text not null default 'error',   -- error | stopped | blocked | warning
  message text not null,
  resolved boolean not null default false,
  resolved_at timestamptz,
  resolution text
);
create index if not exists error_log_open on writer_private.error_log (resolved, at desc);

create or replace function public.writer_errors_api(p_secret text, p_op text, p_args jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, writer_private, extensions
as $$
declare
  v_hash text;
  v_out jsonb;
begin
  select secret_hash into v_hash from writer_private.config where id = 1;
  if v_hash is null or p_secret is null or encode(extensions.digest(p_secret, 'sha256'), 'hex') <> v_hash then
    raise exception 'unauthorised' using errcode = '42501';
  end if;
  case p_op
  when 'error_add' then
    insert into writer_private.error_log (article_id, title, stage, kind, message)
    values (p_args->>'article_id', p_args->>'title', p_args->>'stage', coalesce(p_args->>'kind', 'error'), left(coalesce(p_args->>'message', ''), 2000));
    return jsonb_build_object('ok', true);
  when 'error_list' then
    select coalesce(jsonb_agg(to_jsonb(e) order by e.at desc), '[]'::jsonb) into v_out
    from (select * from writer_private.error_log
          where (coalesce((p_args->>'open_only')::boolean, false) = false or not resolved)
          order by at desc limit coalesce((p_args->>'limit')::int, 200)) e;
    return v_out;
  when 'error_resolve' then
    update writer_private.error_log set resolved = true, resolved_at = now(), resolution = left(p_args->>'resolution', 500)
    where id in (select jsonb_array_elements_text(coalesce(p_args->'ids', '[]'))::bigint) and not resolved;
    return jsonb_build_object('ok', true);
  else
    raise exception 'unknown op %', p_op;
  end case;
end;
$$;
revoke all on function public.writer_errors_api(text, text, jsonb) from public;
grant execute on function public.writer_errors_api(text, text, jsonb) to anon, authenticated;
