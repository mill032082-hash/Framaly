-- FRAMALY Studio · esquema de Supabase
-- Pégalo completo en: Supabase → SQL Editor → New query → Run.
-- Es seguro ejecutarlo más de una vez.

-- ---------- Proyectos ----------
create table if not exists public.framaly_projects (
  user_id    uuid    not null default auth.uid() references auth.users(id) on delete cascade,
  id         text    not null,
  data       jsonb   not null default '{}'::jsonb,
  updated    bigint  not null default 0,        -- milisegundos (Date.now() del navegador)
  deleted    boolean not null default false,
  primary key (user_id, id)
);

-- ---------- Biblioteca (metadatos; el archivo va a Storage) ----------
create table if not exists public.framaly_media (
  user_id    uuid    not null default auth.uid() references auth.users(id) on delete cascade,
  id         text    not null,
  type       text    not null check (type in ('image', 'audio', 'video')),
  name       text    not null default '',
  source     text    not null default 'upload',
  meta       jsonb   not null default '{}'::jsonb,
  size       bigint  not null default 0,
  duration   double precision,
  mime       text    not null default '',
  created    bigint  not null default 0,
  updated    bigint  not null default 0,
  deleted    boolean not null default false,
  primary key (user_id, id)
);

-- ---------- Seguridad: cada usuario solo ve y modifica lo suyo ----------
alter table public.framaly_projects enable row level security;
alter table public.framaly_media    enable row level security;

drop policy if exists "framaly_projects_own" on public.framaly_projects;
create policy "framaly_projects_own" on public.framaly_projects
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "framaly_media_own" on public.framaly_media;
create policy "framaly_media_own" on public.framaly_media
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Storage: bucket privado, una carpeta por usuario ----------
insert into storage.buckets (id, name, public)
values ('framaly-media', 'framaly-media', false)
on conflict (id) do nothing;

drop policy if exists "framaly_storage_select" on storage.objects;
create policy "framaly_storage_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'framaly-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "framaly_storage_insert" on storage.objects;
create policy "framaly_storage_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'framaly-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "framaly_storage_update" on storage.objects;
create policy "framaly_storage_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'framaly-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "framaly_storage_delete" on storage.objects;
create policy "framaly_storage_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'framaly-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- Videos MP4: la tabla de medios también acepta type = 'video'
alter table public.framaly_media drop constraint if exists framaly_media_type_check;
alter table public.framaly_media add constraint framaly_media_type_check check (type in ('image','audio','video'));
