-- FRAMALY Studio · Asesor IA: límite diario de consultas por persona
-- (ejecutar DESPUÉS de schema.sql y access.sql). La función "asesor" es la que usa esta tabla.
create table if not exists public.framaly_advisor_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null,
  count   integer not null default 0,
  primary key (user_id, day)
);
alter table public.framaly_advisor_usage enable row level security;
-- sin políticas: ninguna persona puede leerla ni escribirla desde la app

create or replace function public.framaly_advisor_hit(p_user uuid, p_limit integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare c integer;
begin
  insert into public.framaly_advisor_usage (user_id, day, count) values (p_user, current_date, 1)
  on conflict (user_id, day) do update set count = public.framaly_advisor_usage.count + 1
  returning count into c;
  return c <= p_limit;
end $$;

revoke all on function public.framaly_advisor_hit(uuid, integer) from public, anon, authenticated;
