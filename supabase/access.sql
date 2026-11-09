-- FRAMALY Studio · aprobación de personas (ejecutar DESPUÉS de schema.sql)
-- Cada persona que se registra queda "pendiente" hasta que un administrador la aprueba desde Ajustes.
-- Para cambiar el administrador principal, edita el correo de framaly_on_user_created.

create table if not exists public.framaly_access (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null default '',
  status     text not null default 'pending' check (status in ('pending','approved','blocked')),
  role       text not null default 'user' check (role in ('admin','user')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
alter table public.framaly_access enable row level security;

create or replace function public.framaly_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.framaly_access where user_id = auth.uid() and role = 'admin' and status = 'approved')
$$;

create or replace function public.framaly_is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.framaly_access where user_id = auth.uid() and status = 'approved')
$$;

drop policy if exists "framaly_access_select" on public.framaly_access;
create policy "framaly_access_select" on public.framaly_access
  for select to authenticated
  using (user_id = auth.uid() or public.framaly_is_admin());

drop policy if exists "framaly_access_admin_update" on public.framaly_access;
create policy "framaly_access_admin_update" on public.framaly_access
  for update to authenticated
  using (public.framaly_is_admin()) with check (public.framaly_is_admin());

-- El dueño entra como administrador solo con Google (correo verificado); el resto queda pendiente.
create or replace function public.framaly_on_user_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner boolean;
begin
  owner := lower(coalesce(new.email, '')) = 'mill032082@gmail.com'
           and coalesce(new.raw_app_meta_data->>'provider', '') = 'google';
  insert into public.framaly_access (user_id, email, status, role, decided_at)
  values (new.id, coalesce(new.email, ''),
          case when owner then 'approved' else 'pending' end,
          case when owner then 'admin' else 'user' end,
          case when owner then now() end)
  on conflict (user_id) do nothing;
  return new;
exception when others then
  return new;
end $$;

drop trigger if exists framaly_on_user_created on auth.users;
create trigger framaly_on_user_created after insert on auth.users
  for each row execute function public.framaly_on_user_created();

-- Solo las personas aprobadas pueden usar la nube
drop policy if exists "framaly_projects_own" on public.framaly_projects;
create policy "framaly_projects_own" on public.framaly_projects
  for all to authenticated
  using (user_id = auth.uid() and public.framaly_is_approved())
  with check (user_id = auth.uid() and public.framaly_is_approved());

drop policy if exists "framaly_media_own" on public.framaly_media;
create policy "framaly_media_own" on public.framaly_media
  for all to authenticated
  using (user_id = auth.uid() and public.framaly_is_approved())
  with check (user_id = auth.uid() and public.framaly_is_approved());

drop policy if exists "framaly_storage_select" on storage.objects;
create policy "framaly_storage_select" on storage.objects for select to authenticated
  using (bucket_id = 'framaly-media' and (storage.foldername(name))[1] = auth.uid()::text and public.framaly_is_approved());
drop policy if exists "framaly_storage_insert" on storage.objects;
create policy "framaly_storage_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'framaly-media' and (storage.foldername(name))[1] = auth.uid()::text and public.framaly_is_approved());
drop policy if exists "framaly_storage_update" on storage.objects;
create policy "framaly_storage_update" on storage.objects for update to authenticated
  using (bucket_id = 'framaly-media' and (storage.foldername(name))[1] = auth.uid()::text and public.framaly_is_approved());
drop policy if exists "framaly_storage_delete" on storage.objects;
create policy "framaly_storage_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'framaly-media' and (storage.foldername(name))[1] = auth.uid()::text and public.framaly_is_approved());
