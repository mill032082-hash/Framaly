-- FRAMALY Studio · modo de ejecución de las conexiones MCP/API y auditoría de costes.
-- Ejecutar después de oauth.sql. Es seguro ejecutarlo más de una vez.
-- exec_mode:
--   'external'  (por defecto) → modo ChatGPT externo: la IA conectada trae sus propios guiones, imágenes y audios.
--                               FRAMALY NO genera nada (ningún proveedor) y no gasta créditos de nadie.
--   'no_openai' → FRAMALY puede generar con Claude, Gemini o ElevenLabs; OpenAI queda BLOQUEADO en el servidor.
--   'all'       → FRAMALY puede generar con cualquier proveedor habilitado (incluye OpenAI). Hay que elegirlo a propósito.

alter table public.framaly_api_tokens   add column if not exists exec_mode text not null default 'external';
alter table public.framaly_oauth_grants add column if not exists exec_mode text not null default 'external';
alter table public.framaly_oauth_requests add column if not exists exec_mode text not null default 'external';
do $$ begin
  alter table public.framaly_api_tokens   add constraint framaly_tok_mode  check (exec_mode in ('external','no_openai','all'));
  alter table public.framaly_oauth_grants add constraint framaly_gr_mode   check (exec_mode in ('external','no_openai','all'));
  alter table public.framaly_oauth_requests add constraint framaly_rq_mode check (exec_mode in ('external','no_openai','all'));
exception when duplicate_object then null; end $$;

-- Libro de auditoría: una fila por cada operación (generación, bloqueo, importación o montaje)
create table if not exists public.framaly_mcp_ledger (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  token_id   uuid,
  created_at timestamptz not null default now(),
  tool       text not null,
  provider   text not null,          -- openai, gemini, elevenlabs, anthropic, externo (recurso traído de fuera) o framaly (montaje)
  model      text,
  kind       text not null,          -- texto, imagen, voz, importacion, montaje
  units      jsonb not null default '{}'::jsonb,   -- créditos consumidos (tokens, imágenes, caracteres…)
  cost_usd   numeric not null default 0,
  project_id text,
  mode       text not null,          -- modo de ejecución vigente
  blocked    boolean not null default false,       -- true = se intentó generar y el servidor lo impidió (coste 0)
  detail     text
);
create index if not exists framaly_mcp_ledger_user on public.framaly_mcp_ledger (user_id, created_at desc);
alter table public.framaly_mcp_ledger enable row level security;   -- sin políticas: solo el servidor y las funciones de abajo

-- La comprobación de la clave ahora devuelve también el modo (en OAuth manda el del permiso concedido)
create or replace function public.framaly_token_auth(p_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.framaly_api_tokens; v_mode text;
begin
  select * into t from public.framaly_api_tokens
   where token_hash = p_hash and revoked_at is null and (expires_at is null or expires_at > now());
  if not found then return null; end if;
  v_mode := t.exec_mode;
  if t.grant_id is not null then
    select g.exec_mode into v_mode from public.framaly_oauth_grants g where g.id = t.grant_id and g.revoked_at is null;
    if not found then return null; end if;
  end if;
  update public.framaly_api_tokens set last_used_at = now() where id = t.id;
  return jsonb_build_object('token_id', t.id, 'user_id', t.user_id, 'scopes', to_jsonb(t.scopes), 'name', t.name, 'exec_mode', coalesce(v_mode, 'external'));
end $$;

-- Pantalla «Permitir»: la persona elige el modo antes de aceptar
create or replace function public.framaly_oauth_set_mode(p_id uuid, p_mode text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.framaly_is_approved() then raise exception 'forbidden'; end if;
  if p_mode not in ('external','no_openai','all') then raise exception 'mode'; end if;
  update public.framaly_oauth_requests set exec_mode = p_mode where id = p_id and decided_at is null;
end $$;

-- Al permitir se crea (o se actualiza) el permiso de esa aplicación con el modo elegido
create or replace function public.framaly_oauth_decide(p_id uuid, p_allow boolean) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare q public.framaly_oauth_requests; v_code text; v_grant uuid;
begin
  if auth.uid() is null or not public.framaly_is_approved() then raise exception 'forbidden'; end if;
  select * into q from public.framaly_oauth_requests where id = p_id and decided_at is null and expires_at > now() for update;
  if not found then raise exception 'expired'; end if;
  update public.framaly_oauth_requests set decided_at = now() where id = p_id;
  if not p_allow then return jsonb_build_object('redirect_uri', q.redirect_uri, 'state', q.state, 'error', 'access_denied'); end if;
  select id into v_grant from public.framaly_oauth_grants where user_id = auth.uid() and client_id = q.client_id and revoked_at is null order by created_at desc limit 1;
  if v_grant is null then insert into public.framaly_oauth_grants (user_id, client_id, exec_mode) values (auth.uid(), q.client_id, q.exec_mode);
  else update public.framaly_oauth_grants set exec_mode = q.exec_mode where id = v_grant; end if;
  v_code := encode(gen_random_bytes(32), 'hex');
  insert into public.framaly_oauth_codes (code_hash, request_id, client_id, user_id, redirect_uri, code_challenge, scope)
  values (encode(digest(v_code, 'sha256'), 'hex'), p_id, q.client_id, auth.uid(), q.redirect_uri, q.code_challenge, q.scope);
  return jsonb_build_object('redirect_uri', q.redirect_uri, 'state', q.state, 'code', v_code);
end $$;

-- Cambiar el modo de una clave o de una aplicación conectada
create or replace function public.framaly_token_set_mode(p_id uuid, p_mode text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_mode not in ('external','no_openai','all') then raise exception 'mode'; end if;
  update public.framaly_api_tokens set exec_mode = p_mode where id = p_id and user_id = auth.uid() and kind = 'manual';
end $$;
create or replace function public.framaly_grant_set_mode(p_id uuid, p_mode text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_mode not in ('external','no_openai','all') then raise exception 'mode'; end if;
  update public.framaly_oauth_grants set exec_mode = p_mode where id = p_id and user_id = auth.uid() and revoked_at is null;
end $$;

-- Modos actuales de mis claves y mis aplicaciones: { "<id>": "external", … }
create or replace function public.framaly_conn_modes() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(id::text, exec_mode), '{}'::jsonb) from (
    select id, exec_mode from public.framaly_api_tokens where user_id = auth.uid() and kind = 'manual' and revoked_at is null
    union all
    select id, exec_mode from public.framaly_oauth_grants where user_id = auth.uid() and revoked_at is null) x;
$$;

-- Auditoría de costes para la persona dueña
create or replace function public.framaly_mcp_ledger_recent(p_limit integer default 15)
returns table (created_at timestamptz, tool text, provider text, model text, kind text, units jsonb, cost_usd numeric, project_id text, mode text, blocked boolean, detail text)
language sql stable security definer set search_path = public as $$
  select l.created_at, l.tool, l.provider, l.model, l.kind, l.units, l.cost_usd, l.project_id, l.mode, l.blocked, l.detail
  from public.framaly_mcp_ledger l where l.user_id = auth.uid() order by l.created_at desc limit least(greatest(p_limit, 1), 100);
$$;
create or replace function public.framaly_mcp_ledger_summary()
returns table (provider text, operations bigint, blocked bigint, cost_usd numeric)
language sql stable security definer set search_path = public as $$
  select l.provider, count(*) filter (where not l.blocked), count(*) filter (where l.blocked), coalesce(sum(l.cost_usd), 0)
  from public.framaly_mcp_ledger l where l.user_id = auth.uid() and l.created_at > now() - interval '30 days' group by l.provider order by 4 desc;
$$;

revoke execute on function public.framaly_oauth_set_mode(uuid, text), public.framaly_token_set_mode(uuid, text), public.framaly_grant_set_mode(uuid, text),
  public.framaly_conn_modes(), public.framaly_mcp_ledger_recent(integer), public.framaly_mcp_ledger_summary() from public, anon;
grant execute on function public.framaly_oauth_set_mode(uuid, text), public.framaly_token_set_mode(uuid, text), public.framaly_grant_set_mode(uuid, text),
  public.framaly_conn_modes(), public.framaly_mcp_ledger_recent(integer), public.framaly_mcp_ledger_summary() to authenticated;
