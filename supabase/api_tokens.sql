-- FRAMALY Studio · claves de conexión para ChatGPT, Claude y otras IAs (servidor MCP + API)
-- Ejecutar después de schema.sql, access.sql y budget.sql. Es seguro ejecutarlo más de una vez.

create table if not exists public.framaly_api_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null check (length(name) between 1 and 60),
  token_hash   text not null unique,          -- SHA-256 de la clave: la clave en sí nunca se guarda
  prefix       text not null,                 -- primeros caracteres, solo para reconocerla
  scopes       text[] not null default '{read,write}',
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);
create index if not exists framaly_api_tokens_user on public.framaly_api_tokens (user_id);

create table if not exists public.framaly_api_calls (
  id         bigserial primary key,
  token_id   uuid references public.framaly_api_tokens(id) on delete set null,
  user_id    uuid not null references auth.users(id) on delete cascade,
  tool       text not null,
  ok         boolean not null default true,
  ms         integer,
  detail     text,
  created_at timestamptz not null default now()
);
create index if not exists framaly_api_calls_user on public.framaly_api_calls (user_id, created_at desc);
create index if not exists framaly_api_calls_token on public.framaly_api_calls (token_id, created_at desc);

alter table public.framaly_api_tokens enable row level security;
alter table public.framaly_api_calls  enable row level security;
-- Sin políticas para usuarios: todo pasa por las funciones de abajo (SECURITY DEFINER) o por el servidor.

-- Crear una clave (la clave completa se devuelve UNA sola vez)
create or replace function public.framaly_token_create(p_name text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_name  text := btrim(coalesce(p_name, ''));
  v_token text;
  v_id    uuid;
begin
  if auth.uid() is null or not public.framaly_is_approved() then raise exception 'forbidden'; end if;
  if length(v_name) < 1 or length(v_name) > 60 then raise exception 'name'; end if;
  if (select count(*) from public.framaly_api_tokens where user_id = auth.uid() and revoked_at is null) >= 10 then raise exception 'too_many'; end if;
  v_token := 'fmk_' || encode(gen_random_bytes(24), 'hex');
  insert into public.framaly_api_tokens (user_id, name, token_hash, prefix)
  values (auth.uid(), v_name, encode(digest(v_token, 'sha256'), 'hex'), left(v_token, 8))
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'token', v_token, 'prefix', left(v_token, 8), 'name', v_name);
end $$;

create or replace function public.framaly_token_list() returns table (id uuid, name text, prefix text, scopes text[], created_at timestamptz, last_used_at timestamptz, revoked_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.id, t.name, t.prefix, t.scopes, t.created_at, t.last_used_at, t.revoked_at
  from public.framaly_api_tokens t where t.user_id = auth.uid() order by t.created_at desc;
$$;

create or replace function public.framaly_token_revoke(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.framaly_api_tokens set revoked_at = now() where id = p_id and user_id = auth.uid() and revoked_at is null;
end $$;

create or replace function public.framaly_api_calls_recent(p_limit integer default 15) returns table (tool text, ok boolean, ms integer, detail text, created_at timestamptz, token_name text)
language sql stable security definer set search_path = public as $$
  select c.tool, c.ok, c.ms, c.detail, c.created_at, t.name
  from public.framaly_api_calls c left join public.framaly_api_tokens t on t.id = c.token_id
  where c.user_id = auth.uid() order by c.created_at desc limit greatest(1, least(p_limit, 50));
$$;

-- Solo para el servidor MCP (service_role): comprueba la clave y marca el último uso
create or replace function public.framaly_token_auth(p_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.framaly_api_tokens;
begin
  select * into t from public.framaly_api_tokens where token_hash = p_hash and revoked_at is null;
  if not found then return null; end if;
  update public.framaly_api_tokens set last_used_at = now() where id = t.id;
  return jsonb_build_object('token_id', t.id, 'user_id', t.user_id, 'scopes', to_jsonb(t.scopes), 'name', t.name);
end $$;

revoke execute on function public.framaly_token_create(text), public.framaly_token_list(), public.framaly_token_revoke(uuid), public.framaly_api_calls_recent(integer) from public, anon;
grant  execute on function public.framaly_token_create(text), public.framaly_token_list(), public.framaly_token_revoke(uuid), public.framaly_api_calls_recent(integer) to authenticated;
revoke execute on function public.framaly_token_auth(text) from public, anon, authenticated;
grant  execute on function public.framaly_token_auth(text) to service_role;
