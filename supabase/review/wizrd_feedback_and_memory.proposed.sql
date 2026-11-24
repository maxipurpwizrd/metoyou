-- REVIEW-ONLY PROPOSAL. Do not execute until the live parent-table schemas,
-- existing RLS policies, grants, retention requirements, and ownership model
-- have been verified. This is not a migration.
--
-- The current repository references wizrd_conversations and wizrd_messages,
-- but does not define their schemas in checked-in migrations or database
-- typings. The foreign keys and policy predicates below are therefore
-- assumptions that must be reconciled with the live schema before approval.

create table public.wizrd_response_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  conversation_id uuid not null
    references public.wizrd_conversations (id) on delete cascade,
  assistant_message_id uuid not null
    references public.wizrd_messages (id) on delete cascade,
  rating text not null
    check (rating in ('helpful', 'not_helpful')),
  category text
    check (
      category is null
      or category in (
        'inaccurate',
        'outdated',
        'too_long',
        'unclear',
        'wrong_tone',
        'other'
      )
    ),
  correction text
    check (
      correction is null
      or (
        char_length(btrim(correction)) between 1 and 2000
        and char_length(correction) <= 2000
      )
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, assistant_message_id)
);

alter table public.wizrd_response_feedback enable row level security;

grant select, insert, update, delete
  on public.wizrd_response_feedback to authenticated;

create policy wizrd_response_feedback_select_own
  on public.wizrd_response_feedback
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy wizrd_response_feedback_insert_own_assistant_message
  on public.wizrd_response_feedback
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.wizrd_conversations as conversation
      join public.wizrd_messages as message
        on message.conversation_id = conversation.id
       and message.user_id = conversation.user_id
      where conversation.id = wizrd_response_feedback.conversation_id
        and conversation.user_id = (select auth.uid())
        and message.id = wizrd_response_feedback.assistant_message_id
        and message.role = 'assistant'
    )
  );

create policy wizrd_response_feedback_update_own_assistant_message
  on public.wizrd_response_feedback
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.wizrd_conversations as conversation
      join public.wizrd_messages as message
        on message.conversation_id = conversation.id
       and message.user_id = conversation.user_id
      where conversation.id = wizrd_response_feedback.conversation_id
        and conversation.user_id = (select auth.uid())
        and message.id = wizrd_response_feedback.assistant_message_id
        and message.role = 'assistant'
    )
  );

create policy wizrd_response_feedback_delete_own
  on public.wizrd_response_feedback
  for delete to authenticated
  using (user_id = (select auth.uid()));

create table public.wizrd_memory_consents (
  user_id uuid primary key default auth.uid()
    references auth.users (id) on delete cascade,
  memory_enabled boolean not null default false,
  consent_version text,
  consented_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (
      memory_enabled
      and consent_version is not null
      and char_length(btrim(consent_version)) > 0
      and consented_at is not null
      and revoked_at is null
    )
    or (
      not memory_enabled
      and (
        (
          consent_version is null
          and consented_at is null
          and revoked_at is null
        )
        or (
          consent_version is not null
          and consented_at is not null
          and revoked_at is not null
        )
      )
    )
  )
);

alter table public.wizrd_memory_consents enable row level security;

grant select, insert, update, delete
  on public.wizrd_memory_consents to authenticated;

create policy wizrd_memory_consents_select_own
  on public.wizrd_memory_consents
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy wizrd_memory_consents_insert_own
  on public.wizrd_memory_consents
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy wizrd_memory_consents_update_own
  on public.wizrd_memory_consents
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy wizrd_memory_consents_delete_own
  on public.wizrd_memory_consents
  for delete to authenticated
  using (user_id = (select auth.uid()));

create table public.wizrd_personal_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  memory_key text not null
    check (
      memory_key = btrim(memory_key)
      and char_length(memory_key) between 1 and 80
    ),
  category text not null
    check (
      category in ('response_style', 'formatting', 'language', 'workflow', 'other')
    ),
  memory_value text not null
    check (
      char_length(btrim(memory_value)) between 1 and 500
      and char_length(memory_value) <= 500
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, memory_key),
  foreign key (user_id)
    references public.wizrd_memory_consents (user_id) on delete cascade
);

alter table public.wizrd_personal_memories enable row level security;

grant select, insert, update, delete
  on public.wizrd_personal_memories to authenticated;

create policy wizrd_personal_memories_select_own
  on public.wizrd_personal_memories
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy wizrd_personal_memories_insert_own_with_consent
  on public.wizrd_personal_memories
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.wizrd_memory_consents as consent
      where consent.user_id = (select auth.uid())
        and consent.memory_enabled
    )
  );

create policy wizrd_personal_memories_update_own_with_consent
  on public.wizrd_personal_memories
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.wizrd_memory_consents as consent
      where consent.user_id = (select auth.uid())
        and consent.memory_enabled
    )
  );

create policy wizrd_personal_memories_delete_own
  on public.wizrd_personal_memories
  for delete to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.wizrd_memory_require_consent()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  consent_is_enabled boolean;
begin
  select consent.memory_enabled
    into consent_is_enabled
  from public.wizrd_memory_consents as consent
  where consent.user_id = new.user_id
  for update;

  if not coalesce(consent_is_enabled, false) then
    raise exception 'Active personal-memory consent is required'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger wizrd_personal_memories_require_consent
  before insert or update on public.wizrd_personal_memories
  for each row execute function public.wizrd_memory_require_consent();

-- This table contains only thresholded aggregates. It deliberately has no
-- user, conversation, message, or free-text correction identifiers/content.
create table public.wizrd_feedback_analytics_daily (
  report_date date not null,
  rating text not null
    check (rating in ('helpful', 'not_helpful')),
  category text not null
    check (
      category in (
        'inaccurate',
        'outdated',
        'too_long',
        'unclear',
        'wrong_tone',
        'other'
      )
    ),
  response_count integer not null check (response_count >= 10),
  primary key (report_date, rating, category)
);

alter table public.wizrd_feedback_analytics_daily enable row level security;

-- Intentionally no authenticated policy or client grant for aggregate data.
-- The aggregation process and owner-review access require separate approval.

create or replace function public.wizrd_feedback_set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger wizrd_response_feedback_updated_at
  before update on public.wizrd_response_feedback
  for each row execute function public.wizrd_feedback_set_updated_at();

create trigger wizrd_memory_consents_updated_at
  before update on public.wizrd_memory_consents
  for each row execute function public.wizrd_feedback_set_updated_at();

create or replace function public.wizrd_memory_revoke_cleanup()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.memory_enabled and not new.memory_enabled then
    delete from public.wizrd_personal_memories
    where user_id = old.user_id;
  end if;
  return new;
end;
$$;

create trigger wizrd_memory_revoke_cleanup
  after update of memory_enabled on public.wizrd_memory_consents
  for each row execute function public.wizrd_memory_revoke_cleanup();

create trigger wizrd_personal_memories_updated_at
  before update on public.wizrd_personal_memories
  for each row execute function public.wizrd_feedback_set_updated_at();
