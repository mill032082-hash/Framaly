-- FRAMALY Studio · agregar Gemini (Google) y MiniMax. Ejecutar DESPUÉS de budget.sql y secrets.sql.
do $$
declare c text;
begin
  for c in select conname from pg_constraint where conrelid = 'public.framaly_limits'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%provider%'
  loop execute format('alter table public.framaly_limits drop constraint %I', c); end loop;
  for c in select conname from pg_constraint where conrelid = 'public.framaly_secret_meta'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%provider%'
  loop execute format('alter table public.framaly_secret_meta drop constraint %I', c); end loop;
end $$;
alter table public.framaly_limits add constraint framaly_limits_provider_check
  check (provider in ('anthropic','openai','elevenlabs','gemini','minimax'));
alter table public.framaly_secret_meta add constraint framaly_secret_meta_provider_check
  check (provider in ('anthropic','openai','elevenlabs','gemini','minimax'));
insert into public.framaly_limits (provider, monthly_usd) values ('gemini', 10), ('minimax', 5) on conflict (provider) do nothing;

alter table public.framaly_access alter column ai set default
  '{"anthropic":"own","openai":"own","elevenlabs":"own","gemini":"own","minimax":"own"}'::jsonb;
alter table public.framaly_invites alter column ai set default
  '{"anthropic":"own","openai":"own","elevenlabs":"own","gemini":"own","minimax":"own"}'::jsonb;
update public.framaly_access
   set ai = ai || jsonb_build_object('gemini', case when role = 'admin' then 'shared' else 'own' end,
                                     'minimax', case when role = 'admin' then 'shared' else 'own' end)
 where not (ai ? 'gemini');
update public.framaly_invites set ai = ai || '{"gemini":"own","minimax":"own"}'::jsonb where not (ai ? 'gemini');

-- Guardar clave: acepta los cinco proveedores
create or replace function public.framaly_set_secret(p_provider text, p_value text) returns void
language plpgsql security definer set search_path = public, vault as $$
declare
  v_name text := 'framaly_' || p_provider;
  v_val  text := btrim(coalesce(p_value, ''));
  v_id   uuid;
begin
  if not public.framaly_is_admin() then raise exception 'forbidden'; end if;
  if p_provider not in ('anthropic','openai','elevenlabs','gemini','minimax') then raise exception 'provider'; end if;
  if length(v_val) < 16 or length(v_val) > 600 or v_val ~ '\s' then raise exception 'invalid_key'; end if;
  select id into v_id from vault.secrets where name = v_name;
  if v_id is null then
    perform vault.create_secret(v_val, v_name, 'FRAMALY ' || p_provider);
  else
    perform vault.update_secret(v_id, v_val, v_name, 'FRAMALY ' || p_provider);
  end if;
  insert into public.framaly_secret_meta (provider, last4, updated_at, updated_by)
  values (p_provider, right(v_val, 4), now(), auth.uid())
  on conflict (provider) do update set last4 = excluded.last4, updated_at = now(), updated_by = auth.uid();
end $$;
revoke execute on function public.framaly_set_secret(text, text) from public, anon;
grant execute on function public.framaly_set_secret(text, text) to authenticated;

-- Registro de personas: valores por defecto con cinco proveedores
create or replace function public.framaly_on_user_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  em text := lower(coalesce(new.email, ''));
  via_google boolean := coalesce(new.raw_app_meta_data->>'provider', '') = 'google';
  owner boolean := (lower(coalesce(new.email, '')) = 'mill032082@gmail.com'
                    and coalesce(new.raw_app_meta_data->>'provider', '') = 'google');
  inv public.framaly_invites%rowtype;
  invited boolean := false;
  ok boolean;
begin
  select * into inv from public.framaly_invites where email = em;
  invited := found;
  ok := owner or (invited and via_google);
  insert into public.framaly_access (user_id, email, status, role, decided_at, perms, ai, daily_usd)
  values (new.id, coalesce(new.email, ''),
          case when ok then 'approved' else 'pending' end,
          case when owner then 'admin' else 'user' end,
          case when ok then now() end,
          case when invited then inv.perms else '{"integraciones": false}'::jsonb end,
          case when owner then '{"anthropic":"shared","openai":"shared","elevenlabs":"shared","gemini":"shared","minimax":"shared"}'::jsonb
               when invited then inv.ai
               else '{"anthropic":"own","openai":"own","elevenlabs":"own","gemini":"own","minimax":"own"}'::jsonb end,
          case when invited then inv.daily_usd else 2 end)
  on conflict (user_id) do nothing;
  if invited then delete from public.framaly_invites where email = em; end if;
  return new;
exception when others then
  return new;
end $$;
revoke execute on function public.framaly_on_user_created() from public, anon, authenticated;
