-- FRAMALY Studio · historial por API y saldo del proveedor. Ejecutar DESPUÉS de budget.sql, secrets.sql y gemini_minimax.sql.
create table if not exists public.framaly_api_events (
  id         bigint generated always as identity primary key,
  provider   text not null,
  kind       text not null,
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists framaly_api_events_idx on public.framaly_api_events (provider, created_at desc);
alter table public.framaly_api_events enable row level security;
drop policy if exists "framaly_api_events_select" on public.framaly_api_events;
create policy "framaly_api_events_select" on public.framaly_api_events for select to authenticated using (public.framaly_is_admin());

create table if not exists public.framaly_balance (
  id         bigint generated always as identity primary key,
  provider   text not null,
  used       numeric,
  quota      numeric,
  unit       text not null default '',
  plan       text not null default '',
  resets_at  timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists framaly_balance_idx on public.framaly_balance (provider, created_at desc);
alter table public.framaly_balance enable row level security;
drop policy if exists "framaly_balance_select" on public.framaly_balance;
create policy "framaly_balance_select" on public.framaly_balance for select to authenticated using (public.framaly_is_admin());

-- Guardar / quitar clave dejan constancia en el historial
create or replace function public.framaly_set_secret(p_provider text, p_value text) returns void
language plpgsql security definer set search_path = public, vault as $$
declare
  v_name text := 'framaly_' || p_provider;
  v_val  text := btrim(coalesce(p_value, ''));
  v_id   uuid;
  v_new  boolean;
begin
  if not public.framaly_is_admin() then raise exception 'forbidden'; end if;
  if p_provider not in ('anthropic','openai','elevenlabs','gemini','minimax') then raise exception 'provider'; end if;
  if length(v_val) < 16 or length(v_val) > 600 or v_val ~ '\s' then raise exception 'invalid_key'; end if;
  select id into v_id from vault.secrets where name = v_name;
  v_new := v_id is null;
  if v_new then perform vault.create_secret(v_val, v_name, 'FRAMALY ' || p_provider);
  else perform vault.update_secret(v_id, v_val, v_name, 'FRAMALY ' || p_provider); end if;
  insert into public.framaly_secret_meta (provider, last4, updated_at, updated_by)
  values (p_provider, right(v_val, 4), now(), auth.uid())
  on conflict (provider) do update set last4 = excluded.last4, updated_at = now(), updated_by = auth.uid();
  insert into public.framaly_api_events (provider, kind, detail)
  values (p_provider, case when v_new then 'conectada' else 'reemplazada' end, jsonb_build_object('last4', right(v_val, 4)));
end $$;

create or replace function public.framaly_delete_secret(p_provider text) returns void
language plpgsql security definer set search_path = public, vault as $$
begin
  if not public.framaly_is_admin() then raise exception 'forbidden'; end if;
  delete from vault.secrets where name = 'framaly_' || p_provider;
  delete from public.framaly_secret_meta where provider = p_provider;
  insert into public.framaly_api_events (provider, kind) values (p_provider, 'quitada');
end $$;

-- Resumen por API (solo administrador)
create or replace function public.framaly_api_overview(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.framaly_is_admin() then return '{}'::jsonb; end if;
  return coalesce((
    select jsonb_object_agg(p.provider, jsonb_build_object(
      'days', (select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'cost', d.cost) order by d.day), '[]'::jsonb)
               from (select created_at::date as day, sum(cost_usd) as cost from public.framaly_usage u
                     where u.provider = p.provider and u.created_at >= now() - make_interval(days => greatest(p_days, 1)) group by 1) d),
      'total', (select coalesce(sum(cost_usd), 0) from public.framaly_usage u where u.provider = p.provider),
      'first_use', (select min(created_at) from public.framaly_usage u where u.provider = p.provider),
      'events', (select coalesce(jsonb_agg(jsonb_build_object('kind', e.kind, 'at', e.created_at, 'detail', e.detail) order by e.created_at desc), '[]'::jsonb)
                 from (select * from public.framaly_api_events x where x.provider = p.provider order by x.created_at desc limit 10) e),
      'balance', (select to_jsonb(b) - 'id' - 'provider' from (select * from public.framaly_balance y where y.provider = p.provider order by y.created_at desc limit 1) b),
      'balance_history', (select coalesce(jsonb_agg(jsonb_build_object('at', h.created_at, 'used', h.used, 'quota', h.quota) order by h.created_at), '[]'::jsonb)
                          from (select * from public.framaly_balance z where z.provider = p.provider order by z.created_at desc limit 12) h)
    ))
    from (values ('anthropic'), ('openai'), ('elevenlabs'), ('gemini'), ('minimax')) as p(provider)
  ), '{}'::jsonb);
end $$;
revoke execute on function public.framaly_api_overview(integer) from public, anon;
grant execute on function public.framaly_api_overview(integer) to authenticated, service_role;
revoke execute on function public.framaly_set_secret(text, text) from public, anon;
grant execute on function public.framaly_set_secret(text, text) to authenticated;
revoke execute on function public.framaly_delete_secret(text) from public, anon;
grant execute on function public.framaly_delete_secret(text) to authenticated;
