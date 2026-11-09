-- FRAMALY Studio · claves de IA compartidas, límites, avisos y correos preparados
-- Ejecutar DESPUÉS de schema.sql, access.sql y asesor.sql.

-- ===== Modos de IA por persona y tope diario =====
alter table public.framaly_access add column if not exists ai jsonb not null
  default '{"anthropic":"own","openai":"own","elevenlabs":"own"}'::jsonb;
alter table public.framaly_access add column if not exists daily_usd numeric not null default 2;
update public.framaly_access set ai = '{"anthropic":"shared","openai":"shared","elevenlabs":"shared"}'::jsonb where role = 'admin';

-- ===== Correos preparados por el administrador =====
create table if not exists public.framaly_invites (
  email      text primary key,
  perms      jsonb not null default '{"integraciones": false}'::jsonb,
  ai         jsonb not null default '{"anthropic":"own","openai":"own","elevenlabs":"own"}'::jsonb,
  daily_usd  numeric not null default 2,
  created_at timestamptz not null default now()
);
alter table public.framaly_invites enable row level security;
drop policy if exists "framaly_invites_admin" on public.framaly_invites;
create policy "framaly_invites_admin" on public.framaly_invites
  for all to authenticated using (public.framaly_is_admin()) with check (public.framaly_is_admin());

-- ===== Límites mensuales por API =====
create table if not exists public.framaly_limits (
  provider    text primary key check (provider in ('anthropic','openai','elevenlabs')),
  monthly_usd numeric not null default 10 check (monthly_usd >= 0),
  alert_pct   integer not null default 80 check (alert_pct between 1 and 100),
  updated_at  timestamptz not null default now()
);
insert into public.framaly_limits (provider, monthly_usd) values ('anthropic', 10), ('openai', 20), ('elevenlabs', 5)
  on conflict (provider) do nothing;
alter table public.framaly_limits enable row level security;
drop policy if exists "framaly_limits_admin" on public.framaly_limits;
create policy "framaly_limits_admin" on public.framaly_limits
  for all to authenticated using (public.framaly_is_admin()) with check (public.framaly_is_admin());

-- ===== Registro de gasto (lo escribe solo la función segura) =====
create table if not exists public.framaly_usage (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users(id) on delete set null,
  provider   text not null,
  kind       text not null,
  units      jsonb not null default '{}'::jsonb,
  cost_usd   numeric not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists framaly_usage_provider_idx on public.framaly_usage (provider, created_at);
create index if not exists framaly_usage_user_idx on public.framaly_usage (user_id, created_at);
alter table public.framaly_usage enable row level security;
drop policy if exists "framaly_usage_select" on public.framaly_usage;
create policy "framaly_usage_select" on public.framaly_usage
  for select to authenticated using (user_id = auth.uid() or public.framaly_is_admin());

-- ===== Avisos para el administrador =====
create table if not exists public.framaly_notifications (
  id         bigint generated always as identity primary key,
  dedupe     text unique,
  level      text not null default 'info' check (level in ('info','warn','crit')),
  title      text not null,
  body       text not null default '',
  provider   text,
  user_id    uuid,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.framaly_notifications enable row level security;
drop policy if exists "framaly_notifications_select" on public.framaly_notifications;
create policy "framaly_notifications_select" on public.framaly_notifications
  for select to authenticated using (public.framaly_is_admin());
drop policy if exists "framaly_notifications_update" on public.framaly_notifications;
create policy "framaly_notifications_update" on public.framaly_notifications
  for update to authenticated using (public.framaly_is_admin()) with check (public.framaly_is_admin());

-- ===== Informe de consumo (el administrador ve todo; cada persona, solo lo suyo) =====
create or replace function public.framaly_usage_report() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  m timestamptz := date_trunc('month', now());
  d timestamptz := date_trunc('day', now());
  adm boolean := public.framaly_is_admin();
begin
  return jsonb_build_object(
    'providers', case when adm then coalesce((
      select jsonb_object_agg(provider, jsonb_build_object('cost', cost, 'units', units))
      from (select u.provider, sum(u.cost_usd) as cost,
              jsonb_build_object(
                'in_tokens',  sum(coalesce((u.units->>'in_tokens')::numeric, 0)),
                'out_tokens', sum(coalesce((u.units->>'out_tokens')::numeric, 0)),
                'images',     sum(coalesce((u.units->>'images')::numeric, 0)),
                'chars',      sum(coalesce((u.units->>'chars')::numeric, 0))) as units
            from public.framaly_usage u where u.created_at >= m group by u.provider) p
    ), '{}'::jsonb) else '{}'::jsonb end,
    'people', case when adm then coalesce((
      select jsonb_agg(jsonb_build_object('user_id', x.user_id, 'email', coalesce(a.email, ''), 'month', x.month, 'today', coalesce(x.today, 0)))
      from (select user_id, sum(cost_usd) as month, sum(cost_usd) filter (where created_at >= d) as today
            from public.framaly_usage where created_at >= m and user_id is not null group by user_id) x
      left join public.framaly_access a on a.user_id = x.user_id
    ), '[]'::jsonb) else '[]'::jsonb end,
    'mine_today', coalesce((select sum(cost_usd) from public.framaly_usage where user_id = auth.uid() and created_at >= d), 0),
    'mine_month', coalesce((select sum(cost_usd) from public.framaly_usage where user_id = auth.uid() and created_at >= m), 0)
  );
end $$;
revoke execute on function public.framaly_usage_report() from public, anon;
grant execute on function public.framaly_usage_report() to authenticated, service_role;

-- ===== Suma de gasto (la usa solo la función segura) =====
create or replace function public.framaly_cost_sum(p_provider text, p_user uuid, p_since timestamptz)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(cost_usd), 0) from public.framaly_usage
  where created_at >= p_since
    and (p_provider is null or provider = p_provider)
    and (p_user is null or user_id = p_user)
$$;
revoke execute on function public.framaly_cost_sum(text, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.framaly_cost_sum(text, uuid, timestamptz) to service_role;

-- ===== Registro de personas: aplica los correos preparados =====
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
  -- Con Google el correo está verificado: la persona preparada entra aprobada.
  -- Con contraseña queda pendiente (con sus ajustes ya cargados) hasta que el administrador la apruebe.
  ok := owner or (invited and via_google);
  insert into public.framaly_access (user_id, email, status, role, decided_at, perms, ai, daily_usd)
  values (new.id, coalesce(new.email, ''),
          case when ok then 'approved' else 'pending' end,
          case when owner then 'admin' else 'user' end,
          case when ok then now() end,
          case when invited then inv.perms else '{"integraciones": false}'::jsonb end,
          case when owner then '{"anthropic":"shared","openai":"shared","elevenlabs":"shared"}'::jsonb
               when invited then inv.ai
               else '{"anthropic":"own","openai":"own","elevenlabs":"own"}'::jsonb end,
          case when invited then inv.daily_usd else 2 end)
  on conflict (user_id) do nothing;
  if invited then delete from public.framaly_invites where email = em; end if;
  return new;
exception when others then
  return new;
end $$;
revoke execute on function public.framaly_on_user_created() from public, anon, authenticated;
