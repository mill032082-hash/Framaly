-- FRAMALY · Guiones recibidos de otra IA (ChatGPT, Claude…) por MCP o API.
-- El servidor MCP los guarda aquí; la app los muestra en Guiones → «Recibidos de tu IA».
create table if not exists public.framaly_scripts (
  user_id uuid    not null default auth.uid() references auth.users(id) on delete cascade,
  id      text    not null,
  title   text    not null default '',
  data    jsonb   not null default '{}'::jsonb,   -- { topic, bible, aspect, language, scenes:[{ narration, image_prompt, on_screen_text, image_media_id, voice_media_id }] }
  source  text    not null default 'mcp',
  created bigint  not null default 0,
  updated bigint  not null default 0,
  deleted boolean not null default false,
  primary key (user_id, id)
);
create index if not exists framaly_scripts_user_idx on public.framaly_scripts (user_id, updated desc);
alter table public.framaly_scripts enable row level security;
drop policy if exists "framaly_scripts_own" on public.framaly_scripts;
create policy "framaly_scripts_own" on public.framaly_scripts
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
