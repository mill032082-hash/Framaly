-- FRAMALY Studio · claves guardadas desde la plataforma (bóveda cifrada) y registro de errores
-- Ejecutar DESPUÉS de budget.sql. Requiere la extensión supabase_vault (viene activa en Supabase).

create table if not exists public.framaly_secret_meta (
  provider   text primary key check (provider in ('anthropic','openai','elevenlabs')),
  last4      text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.framaly_secret_meta enable row level security;
drop policy if exists "framaly_secret_meta_admin" on public.framaly_secret_meta;
create policy "framaly_secret_meta_admin" on public.framaly_secret_meta
  for select to authenticated using (public.framaly_is_admin());

create or replace function public.framaly_set_secret(p_provider text, p_value text) returns void
language plpgsql security definer set search_path = public, vault as $$
declare
  v_name text := 'framaly_' || p_provider;
  v_val  text := btrim(coalesce(p_value, ''));
  v_id   uuid;
begin
  if not public.framaly_is_admin() then raise exception 'forbidden'; end if;
  if p_provider not in ('anthropic','openai','elevenlabs') then raise exception 'provider'; end if;
  if length(v_val) < 16 or length(v_val) > 400 or v_val ~ '\s' then raise exception 'invalid_key'; end if;
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

create or replace function public.framaly_delete_secret(p_provider text) returns void
language plpgsql security definer set search_path = public, vault as $$
begin
  if not public.framaly_is_admin() then raise exception 'forbidden'; end if;
  delete from vault.secrets where name = 'framaly_' || p_provider;
  delete from public.framaly_secret_meta where provider = p_provider;
end $$;

-- Solo la función segura del servidor puede leer la clave descifrada
create or replace function public.framaly_get_secret(p_provider text) returns text
language sql stable security definer set search_path = public, vault as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'framaly_' || p_provider limit 1
$$;

revoke execute on function public.framaly_set_secret(text, text) from public, anon;
revoke execute on function public.framaly_delete_secret(text) from public, anon;
grant execute on function public.framaly_set_secret(text, text) to authenticated;
grant execute on function public.framaly_delete_secret(text) to authenticated;
revoke execute on function public.framaly_get_secret(text) from public, anon, authenticated;
grant execute on function public.framaly_get_secret(text) to service_role;

-- Registro de errores de las APIs
create table if not exists public.framaly_errors (
  id         bigint generated always as identity primary key,
  provider   text,
  user_id    uuid,
  email      text,
  kind       text not null,
  status     integer,
  message    text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists framaly_errors_created_idx on public.framaly_errors (created_at desc);
alter table public.framaly_errors enable row level security;
drop policy if exists "framaly_errors_select" on public.framaly_errors;
create policy "framaly_errors_select" on public.framaly_errors
  for select to authenticated using (public.framaly_is_admin());
drop policy if exists "framaly_errors_delete" on public.framaly_errors;
create policy "framaly_errors_delete" on public.framaly_errors
  for delete to authenticated using (public.framaly_is_admin());
