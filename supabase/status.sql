-- Estado real de cada API: «ok» solo si la última prueba de conexión salió bien.
create or replace function public.framaly_record_check(p_provider text, p_ok boolean, p_msg text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.framaly_is_admin() then raise exception 'forbidden'; end if;
  if p_provider not in ('anthropic','openai','elevenlabs','gemini','minimax') then raise exception 'provider'; end if;
  insert into public.framaly_api_events (provider, kind, detail)
  values (p_provider, case when p_ok then 'prueba_ok' else 'prueba_fallo' end, jsonb_build_object('msg', left(coalesce(p_msg, ''), 300)));
end $$;

create or replace function public.framaly_api_status() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.framaly_is_approved() then return '{}'::jsonb; end if;
  return coalesce((
    select jsonb_object_agg(p.provider, coalesce((
      select case e.kind when 'prueba_ok' then 'ok' when 'prueba_fallo' then 'fail' when 'quitada' then 'none' else 'untested' end
      from public.framaly_api_events e
      where e.provider = p.provider and e.kind in ('conectada','reemplazada','quitada','prueba_ok','prueba_fallo')
      order by e.created_at desc, e.id desc limit 1
    ), case when exists (select 1 from public.framaly_secret_meta m where m.provider = p.provider) then 'untested' else 'none' end))
    from (values ('anthropic'),('openai'),('elevenlabs'),('gemini'),('minimax')) as p(provider)
  ), '{}'::jsonb);
end $$;

revoke execute on function public.framaly_record_check(text, boolean, text) from public, anon;
revoke execute on function public.framaly_api_status() from public, anon;
grant execute on function public.framaly_record_check(text, boolean, text) to authenticated;
grant execute on function public.framaly_api_status() to authenticated;
