-- FRAMALY Studio · permisos por IA para cada conexión (ChatGPT, Claude u otro agente).
-- Ejecutar después de exec_mode.sql. Es seguro ejecutarlo más de una vez.
-- ai_allow: lista de IAs de FRAMALY que esa conexión puede usar: anthropic, gemini, elevenlabs, openai.
--   null  → se deduce del modo (external = ninguna · no_openai = todas menos OpenAI · all = todas)
--   {}    → ninguna (equivale al modo externo)
-- OpenAI solo funciona si está en la lista Y el modo es «all»; el servidor lo comprueba en cada llamada.

alter table public.framaly_api_tokens     add column if not exists ai_allow text[];
alter table public.framaly_oauth_grants   add column if not exists ai_allow text[];
alter table public.framaly_oauth_requests add column if not exists ai_allow text[];

create or replace function public.framaly_ai_clean(p_ai text[]) returns text[]
language sql immutable set search_path = public as $$
  select coalesce(array_agg(distinct x order by x), '{}') from unnest(coalesce(p_ai, '{}')) x where x in ('anthropic','gemini','elevenlabs','openai');
$$;

-- El servidor MCP recibe también la lista de IAs permitidas (en OAuth manda la del permiso concedido)
create or replace function public.framaly_token_auth(p_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.framaly_api_tokens; v_mode text; v_ai text[];
begin
  select * into t from public.framaly_api_tokens
   where token_hash = p_hash and revoked_at is null and (expires_at is null or expires_at > now());
  if not found then return null; end if;
  v_mode := t.exec_mode; v_ai := t.ai_allow;
  if t.grant_id is not null then
    select g.exec_mode, g.ai_allow into v_mode, v_ai from public.framaly_oauth_grants g where g.id = t.grant_id and g.revoked_at is null;
    if not found then return null; end if;
  end if;
  update public.framaly_api_tokens set last_used_at = now() where id = t.id;
  return jsonb_build_object('token_id', t.id, 'user_id', t.user_id, 'scopes', to_jsonb(t.scopes), 'name', t.name, 'exec_mode', coalesce(v_mode, 'external'), 'ai_allow', to_jsonb(v_ai));
end $$;

-- Pantalla «Permitir»: la persona marca qué IAs puede usar la aplicación
create or replace function public.framaly_oauth_set_ai(p_id uuid, p_mode text, p_ai text[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.framaly_is_approved() then raise exception 'forbidden'; end if;
  if p_mode not in ('external','no_openai','all') then raise exception 'mode'; end if;
  update public.framaly_oauth_requests set exec_mode = p_mode, ai_allow = public.framaly_ai_clean(p_ai) where id = p_id and decided_at is null;
end $$;

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
  if v_grant is null then insert into public.framaly_oauth_grants (user_id, client_id, exec_mode, ai_allow) values (auth.uid(), q.client_id, q.exec_mode, q.ai_allow);
  else update public.framaly_oauth_grants set exec_mode = q.exec_mode, ai_allow = q.ai_allow where id = v_grant; end if;
  v_code := encode(gen_random_bytes(32), 'hex');
  insert into public.framaly_oauth_codes (code_hash, request_id, client_id, user_id, redirect_uri, code_challenge, scope)
  values (encode(digest(v_code, 'sha256'), 'hex'), p_id, q.client_id, auth.uid(), q.redirect_uri, q.code_challenge, q.scope);
  return jsonb_build_object('redirect_uri', q.redirect_uri, 'state', q.state, 'code', v_code);
end $$;

-- Cambiar las IAs permitidas de una clave o de una aplicación ya conectada
create or replace function public.framaly_token_set_ai(p_id uuid, p_mode text, p_ai text[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_mode not in ('external','no_openai','all') then raise exception 'mode'; end if;
  update public.framaly_api_tokens set exec_mode = p_mode, ai_allow = public.framaly_ai_clean(p_ai) where id = p_id and user_id = auth.uid() and kind = 'manual';
end $$;
create or replace function public.framaly_grant_set_ai(p_id uuid, p_mode text, p_ai text[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_mode not in ('external','no_openai','all') then raise exception 'mode'; end if;
  update public.framaly_oauth_grants set exec_mode = p_mode, ai_allow = public.framaly_ai_clean(p_ai) where id = p_id and user_id = auth.uid() and revoked_at is null;
end $$;

-- { "<id>": { "mode": "...", "ai": [...] | null } } de mis claves y mis aplicaciones
create or replace function public.framaly_conn_ai() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(id::text, jsonb_build_object('mode', exec_mode, 'ai', to_jsonb(ai_allow))), '{}'::jsonb) from (
    select id, exec_mode, ai_allow from public.framaly_api_tokens where user_id = auth.uid() and kind = 'manual' and revoked_at is null
    union all
    select id, exec_mode, ai_allow from public.framaly_oauth_grants where user_id = auth.uid() and revoked_at is null) x;
$$;

revoke execute on function public.framaly_oauth_set_ai(uuid, text, text[]), public.framaly_token_set_ai(uuid, text, text[]), public.framaly_grant_set_ai(uuid, text, text[]), public.framaly_conn_ai() from public, anon;
grant execute on function public.framaly_oauth_set_ai(uuid, text, text[]), public.framaly_token_set_ai(uuid, text, text[]), public.framaly_grant_set_ai(uuid, text, text[]), public.framaly_conn_ai() to authenticated;
