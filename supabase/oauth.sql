-- FRAMALY Studio · inicio de sesión OAuth para el servidor MCP (ChatGPT, Claude y otros conectores)
-- Ejecutar después de api_tokens.sql. Es seguro ejecutarlo más de una vez.
-- Flujo: el conector abre /authorize → FRAMALY pide al usuario que inicie sesión y pulse «Permitir» →
-- el conector canjea el código (PKCE) por un token de acceso de 1 hora y un token de renovación.

create table if not exists public.framaly_oauth_clients (
  client_id     text primary key,
  client_name   text not null,
  redirect_uris text[] not null,
  created_at    timestamptz not null default now()
);

create table if not exists public.framaly_oauth_grants (       -- una «aplicación conectada» por persona y cliente
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  client_id  text not null references public.framaly_oauth_clients(client_id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists framaly_oauth_grants_user on public.framaly_oauth_grants (user_id);

create table if not exists public.framaly_oauth_requests (     -- solicitudes de permiso pendientes (10 minutos)
  id             uuid primary key default gen_random_uuid(),
  client_id      text not null references public.framaly_oauth_clients(client_id) on delete cascade,
  redirect_uri   text not null,
  code_challenge text not null,
  state          text,
  scope          text,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null default now() + interval '10 minutes',
  decided_at     timestamptz
);

create table if not exists public.framaly_oauth_codes (        -- códigos de un solo uso (5 minutos), guardados con huella
  code_hash      text primary key,
  request_id     uuid references public.framaly_oauth_requests(id) on delete cascade,
  client_id      text not null,
  user_id        uuid not null references auth.users(id) on delete cascade,
  redirect_uri   text not null,
  code_challenge text not null,
  scope          text,
  expires_at     timestamptz not null default now() + interval '5 minutes',
  used_at        timestamptz
);

create table if not exists public.framaly_oauth_refresh (      -- tokens de renovación (se rotan en cada uso)
  token_hash text primary key,
  grant_id   uuid not null references public.framaly_oauth_grants(id) on delete cascade,
  client_id  text not null,
  user_id    uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '90 days',
  used_at    timestamptz
);

alter table public.framaly_api_tokens add column if not exists expires_at timestamptz;
alter table public.framaly_api_tokens add column if not exists grant_id uuid references public.framaly_oauth_grants(id) on delete cascade;
alter table public.framaly_api_tokens add column if not exists kind text not null default 'manual';

alter table public.framaly_oauth_clients  enable row level security;
alter table public.framaly_oauth_grants   enable row level security;
alter table public.framaly_oauth_requests enable row level security;
alter table public.framaly_oauth_codes    enable row level security;
alter table public.framaly_oauth_refresh  enable row level security;
-- Sin políticas: solo el servidor (service_role) y las funciones de abajo tocan estas tablas.

-- La lista de claves manuales no mezcla los tokens temporales de OAuth
create or replace function public.framaly_token_list() returns table (id uuid, name text, prefix text, scopes text[], created_at timestamptz, last_used_at timestamptz, revoked_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.id, t.name, t.prefix, t.scopes, t.created_at, t.last_used_at, t.revoked_at
  from public.framaly_api_tokens t where t.user_id = auth.uid() and t.kind = 'manual' order by t.created_at desc;
$$;

-- El servidor MCP comprueba la clave: vigente, no revocada y, si viene de OAuth, con su permiso vigente
create or replace function public.framaly_token_auth(p_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.framaly_api_tokens;
begin
  select * into t from public.framaly_api_tokens
   where token_hash = p_hash and revoked_at is null and (expires_at is null or expires_at > now());
  if not found then return null; end if;
  if t.grant_id is not null and exists (select 1 from public.framaly_oauth_grants g where g.id = t.grant_id and g.revoked_at is not null) then return null; end if;
  update public.framaly_api_tokens set last_used_at = now() where id = t.id;
  return jsonb_build_object('token_id', t.id, 'user_id', t.user_id, 'scopes', to_jsonb(t.scopes), 'name', t.name);
end $$;

/* ---------- solo servidor MCP (service_role) ---------- */
create or replace function public.framaly_oauth_register(p_name text, p_redirects text[]) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_id text := 'fmc_' || encode(gen_random_bytes(12), 'hex');
begin
  if coalesce(array_length(p_redirects, 1), 0) = 0 or array_length(p_redirects, 1) > 5 then raise exception 'redirects'; end if;
  -- tope de clientes registrados: se borran los más antiguos sin permisos activos
  if (select count(*) from public.framaly_oauth_clients) >= 300 then
    delete from public.framaly_oauth_clients c where c.client_id in (
      select client_id from public.framaly_oauth_clients o where not exists (select 1 from public.framaly_oauth_grants g where g.client_id = o.client_id) order by created_at limit 50);
  end if;
  insert into public.framaly_oauth_clients (client_id, client_name, redirect_uris) values (v_id, left(coalesce(nullif(btrim(p_name), ''), 'Aplicación'), 80), p_redirects);
  return v_id;
end $$;

create or replace function public.framaly_oauth_client(p_id text) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(c) from public.framaly_oauth_clients c where c.client_id = p_id;
$$;

create or replace function public.framaly_oauth_start(p_client text, p_redirect text, p_challenge text, p_state text, p_scope text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.framaly_oauth_clients where client_id = p_client and p_redirect = any (redirect_uris)) then raise exception 'client'; end if;
  delete from public.framaly_oauth_requests where expires_at < now() - interval '1 day';
  insert into public.framaly_oauth_requests (client_id, redirect_uri, code_challenge, state, scope) values (p_client, p_redirect, p_challenge, left(p_state, 500), left(p_scope, 200)) returning id into v_id;
  return v_id;
end $$;

-- Canjea un código (una sola vez). Devuelve null si no existe, venció o ya se usó.
create or replace function public.framaly_oauth_exchange(p_code_hash text, p_client text, p_redirect text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.framaly_oauth_codes;
begin
  update public.framaly_oauth_codes set used_at = now()
   where code_hash = p_code_hash and used_at is null and expires_at > now() and client_id = p_client and redirect_uri = p_redirect
   returning * into c;
  if not found then
    -- un código ya usado que se presenta otra vez: se revocan los permisos que nacieron de él
    update public.framaly_oauth_grants g set revoked_at = now() where g.client_id = p_client and g.revoked_at is null
      and g.user_id in (select user_id from public.framaly_oauth_codes where code_hash = p_code_hash and used_at is not null);
    return null;
  end if;
  return jsonb_build_object('user_id', c.user_id, 'code_challenge', c.code_challenge, 'scope', c.scope);
end $$;

create or replace function public.framaly_oauth_issue(p_user uuid, p_client text, p_access_hash text, p_access_prefix text, p_refresh_hash text, p_ttl integer, p_scope text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_grant uuid; v_name text;
begin
  select id into v_grant from public.framaly_oauth_grants where user_id = p_user and client_id = p_client and revoked_at is null order by created_at desc limit 1;
  if v_grant is null then insert into public.framaly_oauth_grants (user_id, client_id) values (p_user, p_client) returning id into v_grant; end if;
  select client_name into v_name from public.framaly_oauth_clients where client_id = p_client;
  delete from public.framaly_api_tokens where kind = 'oauth' and expires_at < now() - interval '1 day';
  delete from public.framaly_oauth_refresh where expires_at < now();
  insert into public.framaly_api_tokens (user_id, name, token_hash, prefix, kind, grant_id, expires_at)
  values (p_user, left(coalesce(v_name, 'Aplicación') || ' (OAuth)', 60), p_access_hash, p_access_prefix, 'oauth', v_grant, now() + make_interval(secs => p_ttl));
  insert into public.framaly_oauth_refresh (token_hash, grant_id, client_id, user_id) values (p_refresh_hash, v_grant, p_client, p_user);
  return jsonb_build_object('grant_id', v_grant);
end $$;

-- Renueva: el token de renovación se usa una vez; si se reutiliza uno ya usado, se revoca el permiso entero
create or replace function public.framaly_oauth_refresh(p_old_hash text, p_client text, p_access_hash text, p_access_prefix text, p_refresh_hash text, p_ttl integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.framaly_oauth_refresh; v_name text;
begin
  select * into r from public.framaly_oauth_refresh where token_hash = p_old_hash and client_id = p_client;
  if not found or r.expires_at < now() then return null; end if;
  if r.used_at is not null then update public.framaly_oauth_grants set revoked_at = now() where id = r.grant_id and revoked_at is null; return null; end if;
  if exists (select 1 from public.framaly_oauth_grants where id = r.grant_id and revoked_at is not null) then return null; end if;
  update public.framaly_oauth_refresh set used_at = now() where token_hash = p_old_hash;
  select client_name into v_name from public.framaly_oauth_clients where client_id = p_client;
  insert into public.framaly_api_tokens (user_id, name, token_hash, prefix, kind, grant_id, expires_at)
  values (r.user_id, left(coalesce(v_name, 'Aplicación') || ' (OAuth)', 60), p_access_hash, p_access_prefix, 'oauth', r.grant_id, now() + make_interval(secs => p_ttl));
  insert into public.framaly_oauth_refresh (token_hash, grant_id, client_id, user_id) values (p_refresh_hash, r.grant_id, p_client, r.user_id);
  return jsonb_build_object('grant_id', r.grant_id);
end $$;

/* ---------- personas con sesión en FRAMALY (authenticated) ---------- */
create or replace function public.framaly_oauth_request_info(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r record;
begin
  if auth.uid() is null or not public.framaly_is_approved() then raise exception 'forbidden'; end if;
  select q.id, c.client_name, q.redirect_uri, q.expires_at, q.decided_at into r
    from public.framaly_oauth_requests q join public.framaly_oauth_clients c on c.client_id = q.client_id where q.id = p_id;
  if not found or r.decided_at is not null or r.expires_at < now() then return null; end if;
  return jsonb_build_object('client_name', r.client_name, 'redirect_host', substring(r.redirect_uri from '^[a-z]+://([^/?#]+)'));
end $$;

-- Permitir o negar. Devuelve a dónde volver (con el código, o con error=access_denied)
create or replace function public.framaly_oauth_decide(p_id uuid, p_allow boolean) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare q public.framaly_oauth_requests; v_code text;
begin
  if auth.uid() is null or not public.framaly_is_approved() then raise exception 'forbidden'; end if;
  select * into q from public.framaly_oauth_requests where id = p_id and decided_at is null and expires_at > now() for update;
  if not found then raise exception 'expired'; end if;
  update public.framaly_oauth_requests set decided_at = now() where id = p_id;
  if not p_allow then return jsonb_build_object('redirect_uri', q.redirect_uri, 'state', q.state, 'error', 'access_denied'); end if;
  v_code := encode(gen_random_bytes(32), 'hex');
  insert into public.framaly_oauth_codes (code_hash, request_id, client_id, user_id, redirect_uri, code_challenge, scope)
  values (encode(digest(v_code, 'sha256'), 'hex'), p_id, q.client_id, auth.uid(), q.redirect_uri, q.code_challenge, q.scope);
  return jsonb_build_object('redirect_uri', q.redirect_uri, 'state', q.state, 'code', v_code);
end $$;

create or replace function public.framaly_grants_list() returns table (id uuid, client_name text, created_at timestamptz, last_used_at timestamptz)
language sql stable security definer set search_path = public as $$
  select g.id, c.client_name, g.created_at, (select max(t.last_used_at) from public.framaly_api_tokens t where t.grant_id = g.id)
  from public.framaly_oauth_grants g join public.framaly_oauth_clients c on c.client_id = g.client_id
  where g.user_id = auth.uid() and g.revoked_at is null order by g.created_at desc;
$$;

create or replace function public.framaly_grant_revoke(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.framaly_oauth_grants set revoked_at = now() where id = p_id and user_id = auth.uid() and revoked_at is null;
  update public.framaly_api_tokens set revoked_at = now() where grant_id = p_id and revoked_at is null;
end $$;

revoke execute on function public.framaly_oauth_register(text, text[]), public.framaly_oauth_client(text), public.framaly_oauth_start(text, text, text, text, text), public.framaly_oauth_exchange(text, text, text),
  public.framaly_oauth_issue(uuid, text, text, text, text, integer, text), public.framaly_oauth_refresh(text, text, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.framaly_oauth_register(text, text[]), public.framaly_oauth_client(text), public.framaly_oauth_start(text, text, text, text, text), public.framaly_oauth_exchange(text, text, text),
  public.framaly_oauth_issue(uuid, text, text, text, text, integer, text), public.framaly_oauth_refresh(text, text, text, text, text, integer) to service_role;
revoke execute on function public.framaly_oauth_request_info(uuid), public.framaly_oauth_decide(uuid, boolean), public.framaly_grants_list(), public.framaly_grant_revoke(uuid) from public, anon;
grant execute on function public.framaly_oauth_request_info(uuid), public.framaly_oauth_decide(uuid, boolean), public.framaly_grants_list(), public.framaly_grant_revoke(uuid) to authenticated;
