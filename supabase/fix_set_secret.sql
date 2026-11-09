-- Guardar clave (versión tolerante). Ejecutar al final, después de history.sql.
-- Quita espacios y saltos de línea al pegar; acepta claves largas (10 a 4000 caracteres).
create or replace function public.framaly_set_secret(p_provider text, p_value text) returns void
language plpgsql security definer set search_path = public, vault as $$
declare
  v_name text := 'framaly_' || p_provider;
  v_val  text := regexp_replace(coalesce(p_value, ''), '\s', '', 'g');
  v_id   uuid;
  v_new  boolean;
begin
  if not public.framaly_is_admin() then raise exception 'forbidden'; end if;
  if p_provider not in ('anthropic','openai','elevenlabs','gemini','minimax') then raise exception 'provider'; end if;
  if length(v_val) < 10 then raise exception 'key_short:%', length(v_val); end if;
  if length(v_val) > 4000 then raise exception 'key_long:%', length(v_val); end if;
  select id into v_id from vault.secrets where name = v_name;
  v_new := v_id is null;
  if v_new then
    perform vault.create_secret(v_val, v_name, 'FRAMALY ' || p_provider);
  else
    perform vault.update_secret(v_id, v_val, v_name, 'FRAMALY ' || p_provider);
  end if;
  insert into public.framaly_secret_meta (provider, last4, updated_at, updated_by)
  values (p_provider, right(v_val, 4), now(), auth.uid())
  on conflict (provider) do update set last4 = excluded.last4, updated_at = now(), updated_by = auth.uid();
  insert into public.framaly_api_events (provider, kind, detail)
  values (p_provider, case when v_new then 'conectada' else 'reemplazada' end, jsonb_build_object('last4', right(v_val, 4), 'length', length(v_val)));
end $$;
revoke execute on function public.framaly_set_secret(text, text) from public, anon;
grant execute on function public.framaly_set_secret(text, text) to authenticated;
