create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null,
  author_username text not null,
  author_profile_pic text,
  story_type text not null check (story_type in ('text', 'photo', 'voice')),
  text text,
  image_url text,
  voice_url text,
  duration_hours integer not null default 24,
  expires_at timestamptz not null,
  reactions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.stories enable row level security;

grant select, insert, update, delete on public.stories to authenticated;

drop policy if exists "Users can view stories" on public.stories;
create policy "Users can view stories"
  on public.stories
  for select
  using (true);

drop policy if exists "Users can insert stories" on public.stories;
create policy "Users can insert stories"
  on public.stories
  for insert
  with check (auth.uid() = author_id);

drop policy if exists "Users can update their stories" on public.stories;
create policy "Users can update their stories"
  on public.stories
  for update
  using (auth.uid() = author_id);

drop policy if exists "Users can delete their stories" on public.stories;
create policy "Users can delete their stories"
  on public.stories
  for delete
  using (auth.uid() = author_id);
