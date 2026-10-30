-- Apply as the Supabase project owner; SECURITY DEFINER functions rely on the
-- migration owner retaining table access.
-- native_expire_call_invitations() is explicit only; a trusted scheduler is a
-- separate operational requirement and is not installed by this migration.
create table public.native_call_invitations (
  id uuid primary key default gen_random_uuid(),
  call_history_id uuid not null unique references public.call_history(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  caller_id uuid not null references auth.users(id) on delete cascade,
  callee_id uuid not null references auth.users(id) on delete cascade,
  call_type text not null check (call_type in ('audio', 'video')),
  status text not null default 'ringing'
    check (status in ('ringing', 'accepted', 'declined', 'cancelled', 'expired', 'ended')),
  idempotency_key uuid not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint native_call_participants_differ check (caller_id <> callee_id),
  unique (caller_id, idempotency_key)
);

create table public.native_call_signals (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.native_call_invitations(id) on delete cascade,
  sequence_number bigint generated always as identity,
  sender_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('offer', 'answer', 'ice', 'declined', 'cancelled', 'expired', 'hangup')),
  dedupe_key text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (invitation_id, sequence_number),
  unique (invitation_id, dedupe_key)
);

create table public.native_push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id uuid not null,
  expo_push_token text not null,
  platform text not null check (platform in ('android', 'ios')),
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.native_call_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.native_call_invitations(id) on delete cascade,
  device_id uuid not null references public.native_push_devices(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'sending', 'provider_ticketed', 'receipt_accepted', 'failed', 'stale_token')),
  attempt_count integer not null default 0,
  expo_ticket_id text,
  last_error_code text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (invitation_id, device_id)
);

create index native_call_invitations_callee_status_expiry_idx
  on public.native_call_invitations (callee_id, status, expires_at);
create index native_call_invitations_caller_created_idx
  on public.native_call_invitations (caller_id, created_at desc);
create index native_call_invitations_pending_expiry_idx
  on public.native_call_invitations (expires_at) where status = 'ringing';
create index native_call_invitations_terminal_cleanup_idx
  on public.native_call_invitations (updated_at)
  where status in ('declined', 'cancelled', 'expired', 'ended');
create index native_push_devices_active_user_idx
  on public.native_push_devices (user_id) where active;
create unique index native_push_devices_active_token_idx
  on public.native_push_devices (expo_push_token) where active;
create unique index native_push_devices_active_installation_idx
  on public.native_push_devices (installation_id) where active;
create unique index native_call_push_ticket_id_idx
  on public.native_call_push_deliveries (expo_ticket_id) where expo_ticket_id is not null;
create index native_call_push_pending_receipts_idx
  on public.native_call_push_deliveries (updated_at) where status = 'provider_ticketed';

alter table public.native_call_invitations enable row level security;
alter table public.native_call_signals enable row level security;
alter table public.native_push_devices enable row level security;
alter table public.native_call_push_deliveries enable row level security;

create policy native_call_invitation_participants_read
  on public.native_call_invitations for select to authenticated
  using (auth.uid() = caller_id or auth.uid() = callee_id);

create policy native_call_signal_participants_read
  on public.native_call_signals for select to authenticated
  using (
    exists (
      select 1 from public.native_call_invitations invitation
      where invitation.id = public.native_call_signals.invitation_id
        and (auth.uid() = invitation.caller_id or auth.uid() = invitation.callee_id)
    )
  );

revoke all on public.native_call_invitations, public.native_call_signals from public, anon, authenticated;
grant select on public.native_call_invitations, public.native_call_signals to authenticated;
revoke all on public.native_push_devices from anon, authenticated;
revoke all on public.native_call_push_deliveries from anon, authenticated;
revoke all on public.native_push_devices, public.native_call_push_deliveries from public, anon, authenticated;
grant select on public.native_call_push_deliveries to service_role;

create or replace function public.native_create_call_invitation(
  p_conversation_id uuid,
  p_callee_id uuid,
  p_call_type text,
  p_initial_offer jsonb,
  p_idempotency_key uuid
)
returns public.native_call_invitations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_invitation public.native_call_invitations;
  v_call_history_id uuid;
  v_other_participant uuid;
  v_existing_offer jsonb;
begin
  if v_caller_id is null or p_conversation_id is null or p_callee_id is null
    or p_idempotency_key is null then
    raise exception 'required invitation input missing';
  end if;
  if p_call_type is null or p_call_type not in ('audio', 'video') then raise exception 'invalid call type'; end if;
  if p_initial_offer is null or jsonb_typeof(p_initial_offer) is distinct from 'object'
    or p_initial_offer ->> 'type' is distinct from 'offer'
    or jsonb_typeof(p_initial_offer -> 'sdp') is distinct from 'string'
    or coalesce(p_initial_offer ->> 'sdp', '') = ''
    or p_initial_offer ? 'renegotiation'
    or p_initial_offer - array['type', 'sdp'] <> '{}'::jsonb
    or octet_length(p_initial_offer::text) > 65536 then
    raise exception 'invalid initial offer';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_caller_id::text));
  perform pg_advisory_xact_lock(hashtext(v_caller_id::text || p_idempotency_key::text));
  select * into v_invitation
  from public.native_call_invitations
  where caller_id = v_caller_id and idempotency_key = p_idempotency_key;
  if found then
    select payload into v_existing_offer
    from public.native_call_signals
    where invitation_id = v_invitation.id
      and event_type = 'offer'
      and dedupe_key = 'initial-offer';
    if v_invitation.conversation_id <> p_conversation_id
      or v_invitation.callee_id <> p_callee_id
      or v_invitation.call_type <> p_call_type
      or v_existing_offer is distinct from p_initial_offer then
      raise exception 'idempotency key reused with different invitation data';
    end if;
    if exists (
      select 1 from public.user_blocks block_row
      where (block_row.blocker_user_id = v_invitation.caller_id and block_row.blocked_user_id = v_invitation.callee_id)
         or (block_row.blocker_user_id = v_invitation.callee_id and block_row.blocked_user_id = v_invitation.caller_id)
    ) then
      raise exception 'calling is not permitted';
    end if;
    return v_invitation;
  end if;

  select case when conversation.user_1 = v_caller_id then conversation.user_2 else conversation.user_1 end
    into v_other_participant
  from public.conversations conversation
  where conversation.id = p_conversation_id
    and (conversation.user_1 = v_caller_id or conversation.user_2 = v_caller_id);
  if v_other_participant is null or v_other_participant <> p_callee_id then
    raise exception 'conversation participant mismatch';
  end if;

  if (select count(*) from public.native_call_invitations
      where caller_id = v_caller_id and created_at > now() - interval '1 minute') >= 3
    or (select count(*) from public.native_call_invitations
      where caller_id = v_caller_id and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'call invitation rate limit exceeded';
  end if;

  if exists (
    select 1 from public.user_blocks block_row
    where (block_row.blocker_user_id = v_caller_id and block_row.blocked_user_id = p_callee_id)
       or (block_row.blocker_user_id = p_callee_id and block_row.blocked_user_id = v_caller_id)
  ) then
    raise exception 'calling is not permitted';
  end if;

  -- Preserve the existing in-app/browser notification trigger. Native Expo
  -- dispatch is separate and must not invoke the browser sender a second time.
  -- The deployed trigger's JWT/custom-header issue remains outside this migration.
  insert into public.call_history (
    conversation_id, caller_id, recipient_id, call_type, status
  ) values (
    p_conversation_id, v_caller_id, p_callee_id, p_call_type, 'ringing'
  ) returning id into v_call_history_id;

  insert into public.native_call_invitations (
    call_history_id, conversation_id, caller_id, callee_id, call_type,
    idempotency_key, expires_at
  ) values (
    v_call_history_id, p_conversation_id, v_caller_id, p_callee_id, p_call_type,
    p_idempotency_key, now() + interval '60 seconds'
  ) returning * into v_invitation;

  insert into public.native_call_signals (
    invitation_id, sender_id, event_type, dedupe_key, payload
  ) values (
    v_invitation.id, v_caller_id, 'offer', 'initial-offer', p_initial_offer
  );

  return v_invitation;
end;
$$;

create or replace function public.native_accept_call_invitation(
  p_invitation_id uuid,
  p_answer jsonb,
  p_dedupe_key text
)
returns public.native_call_invitations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_callee_id uuid := auth.uid();
  v_invitation public.native_call_invitations;
  v_existing_answer uuid;
begin
  if v_callee_id is null or p_invitation_id is null or p_dedupe_key is null
    or btrim(p_dedupe_key) = '' or length(p_dedupe_key) > 160
    or left(p_dedupe_key, length('server-terminal:')) = 'server-terminal:' then
    raise exception 'required answer input missing';
  end if;
  if p_answer is null or jsonb_typeof(p_answer) is distinct from 'object'
    or p_answer ->> 'type' is distinct from 'answer'
    or jsonb_typeof(p_answer -> 'sdp') is distinct from 'string'
    or coalesce(p_answer ->> 'sdp', '') = ''
    or p_answer ? 'renegotiation'
    or p_answer - array['type', 'sdp'] <> '{}'::jsonb then
    raise exception 'invalid answer';
  end if;
  if octet_length(p_answer::text) > 65536 then raise exception 'answer is too large'; end if;

  select * into v_invitation
  from public.native_call_invitations
  where id = p_invitation_id and callee_id = v_callee_id
  for update;
  if not found then raise exception 'invitation unavailable'; end if;

  if exists (
    select 1 from public.user_blocks block_row
    where (block_row.blocker_user_id = v_invitation.caller_id and block_row.blocked_user_id = v_invitation.callee_id)
       or (block_row.blocker_user_id = v_invitation.callee_id and block_row.blocked_user_id = v_invitation.caller_id)
  ) then raise exception 'calling is not permitted'; end if;

  if v_invitation.status = 'accepted' then
    select id into v_existing_answer
    from public.native_call_signals
    where invitation_id = p_invitation_id
      and sender_id = v_callee_id
      and event_type = 'answer'
      and dedupe_key = p_dedupe_key
      and payload = p_answer;
    if v_existing_answer is not null then return v_invitation; end if;
    raise exception 'invitation already accepted';
  end if;
  if v_invitation.status <> 'ringing' then raise exception 'invitation is not acceptable'; end if;
  if v_invitation.expires_at <= now() then
    update public.native_call_invitations
    set status = 'expired', ended_at = now(), updated_at = now()
    where id = p_invitation_id
    returning * into v_invitation;
    update public.call_history
    set status = 'missed', ended_at = now(), duration_seconds = 0
    where id = v_invitation.call_history_id;
    insert into public.native_call_signals (
      invitation_id, sender_id, event_type, dedupe_key, payload
    ) values (
      v_invitation.id, v_invitation.caller_id, 'expired',
      'server-terminal:expired:' || v_invitation.id::text, '{}'::jsonb
    ) on conflict (invitation_id, dedupe_key) do nothing;
    return v_invitation;
  end if;

  update public.native_call_invitations
  set status = 'accepted', accepted_at = now(), updated_at = now()
  where id = p_invitation_id and callee_id = v_callee_id
    and status = 'ringing' and expires_at > now()
  returning * into v_invitation;
  if not found then raise exception 'invitation is not acceptable'; end if;

  update public.call_history
  set status = 'connected', answered_at = v_invitation.accepted_at
  where id = v_invitation.call_history_id;

  insert into public.native_call_signals (
    invitation_id, sender_id, event_type, dedupe_key, payload
  ) values (
    v_invitation.id, v_callee_id, 'answer', p_dedupe_key, p_answer
  );

  return v_invitation;
end;
$$;

create or replace function public.native_append_call_signal(
  p_invitation_id uuid,
  p_event_type text,
  p_dedupe_key text,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_invitation public.native_call_invitations;
  v_signal_id uuid;
  v_existing_sender uuid;
  v_existing_event text;
  v_existing_payload jsonb;
  v_last_renegotiation_event text;
begin
  if v_user_id is null or p_invitation_id is null or p_event_type is null
    or p_dedupe_key is null or btrim(p_dedupe_key) = '' or length(p_dedupe_key) > 160
    or left(p_dedupe_key, length('server-terminal:')) = 'server-terminal:'
    or p_payload is null or jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'invalid signaling payload';
  end if;
  if p_event_type not in ('offer', 'answer', 'ice') then raise exception 'invalid signaling event'; end if;
  if p_event_type in ('offer', 'answer')
    and p_payload -> 'renegotiation' is distinct from 'true'::jsonb then
    raise exception 'generic offer and answer signaling is reserved for renegotiation';
  end if;
  if (p_event_type = 'offer' and (p_payload ->> 'type' is distinct from 'offer'
      or jsonb_typeof(p_payload -> 'sdp') is distinct from 'string'
      or coalesce(p_payload ->> 'sdp', '') = ''))
    or (p_event_type = 'answer' and (p_payload ->> 'type' is distinct from 'answer'
      or jsonb_typeof(p_payload -> 'sdp') is distinct from 'string'
      or coalesce(p_payload ->> 'sdp', '') = ''))
    or (p_event_type = 'ice' and (
      jsonb_typeof(p_payload -> 'candidate') is distinct from 'string'
      or coalesce(p_payload ->> 'candidate', '') = ''
      or octet_length(p_payload::text) > 8192
      or (p_payload ? 'sdpMLineIndex' and jsonb_typeof(p_payload -> 'sdpMLineIndex') not in ('number', 'null'))
      or (p_payload ? 'sdpMid' and jsonb_typeof(p_payload -> 'sdpMid') not in ('string', 'null'))
      or (p_payload ? 'usernameFragment' and jsonb_typeof(p_payload -> 'usernameFragment') not in ('string', 'null'))
      or p_payload - array['candidate', 'sdpMLineIndex', 'sdpMid', 'usernameFragment'] <> '{}'::jsonb
    ))
    or (p_event_type in ('offer', 'answer') and (
      octet_length(p_payload::text) > 65536
      or p_payload - array['type', 'sdp', 'renegotiation'] <> '{}'::jsonb
    )) then
    raise exception 'invalid signaling payload';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_invitation_id::text));
  select * into v_invitation
  from public.native_call_invitations
  where id = p_invitation_id
    and v_user_id in (caller_id, callee_id)
  for update;
  if not found then raise exception 'invitation unavailable'; end if;

  if p_event_type = 'ice' then
    if v_invitation.status = 'ringing' then
      if v_invitation.expires_at <= now() or v_user_id <> v_invitation.caller_id then
        raise exception 'ringing ICE is caller-only and expires with the invitation';
      end if;
    elsif v_invitation.status <> 'accepted' then
      raise exception 'invitation unavailable';
    end if;
  else
    if v_invitation.status <> 'accepted' then
      raise exception 'renegotiation requires an accepted invitation';
    end if;
    if (p_event_type = 'offer' and v_user_id <> v_invitation.caller_id)
      or (p_event_type = 'answer' and v_user_id <> v_invitation.callee_id) then
      raise exception 'renegotiation sender role is not permitted';
    end if;
  end if;

  -- Replay is permitted only while signaling remains eligible. In particular,
  -- terminal invitations never report an old signal as newly accepted.
  if exists (
    select 1 from public.user_blocks block_row
    where (block_row.blocker_user_id = v_invitation.caller_id and block_row.blocked_user_id = v_invitation.callee_id)
       or (block_row.blocker_user_id = v_invitation.callee_id and block_row.blocked_user_id = v_invitation.caller_id)
  ) then raise exception 'calling is not permitted'; end if;

  select id, sender_id, event_type, payload
  into v_signal_id, v_existing_sender, v_existing_event, v_existing_payload
  from public.native_call_signals
  where invitation_id = p_invitation_id and dedupe_key = p_dedupe_key;
  if found then
    if v_existing_sender = v_user_id
      and v_existing_event = p_event_type
      and v_existing_payload = p_payload
      and (p_event_type = 'ice' or v_existing_payload -> 'renegotiation' = 'true'::jsonb) then
      return v_signal_id;
    end if;
    raise exception 'dedupe key reused with different signal data';
  end if;

  if p_event_type in ('offer', 'answer') then
    select signal.event_type into v_last_renegotiation_event
    from public.native_call_signals signal
    where signal.invitation_id = p_invitation_id
      and signal.payload -> 'renegotiation' = 'true'::jsonb
      and signal.event_type in ('offer', 'answer')
    order by signal.sequence_number desc
    limit 1;

    if (p_event_type = 'offer' and v_last_renegotiation_event = 'offer')
      or (p_event_type = 'answer' and v_last_renegotiation_event is distinct from 'offer') then
      raise exception 'renegotiation offer/answer order is invalid';
    end if;
  end if;
  if (select count(*) from public.native_call_signals signal
    where signal.invitation_id = p_invitation_id
      and signal.created_at > now() - interval '90 seconds') >= 256 then
    raise exception 'call signaling rate limit exceeded';
  end if;

  insert into public.native_call_signals (
    invitation_id, sender_id, event_type, dedupe_key, payload
  ) values (
    p_invitation_id, v_user_id, p_event_type, p_dedupe_key, p_payload
  )
  returning id into v_signal_id;
  return v_signal_id;
end;
$$;

create or replace function public.native_transition_call_invitation(
  p_invitation_id uuid,
  p_transition text,
  p_dedupe_key text
)
returns public.native_call_invitations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_invitation public.native_call_invitations;
  v_history_status text;
  v_effective_dedupe_key text;
  v_terminal_event text;
  v_terminal_sender uuid;
  v_existing_sender uuid;
  v_existing_event text;
  v_existing_payload jsonb;
  v_ended_at timestamptz := clock_timestamp();
begin
  if v_user_id is null or p_invitation_id is null then raise exception 'authentication required'; end if;
  if p_transition is null or p_transition not in ('declined', 'cancelled', 'expired', 'ended') then
    raise exception 'invalid invitation transition';
  end if;
  if p_transition <> 'expired' and (p_dedupe_key is null or btrim(p_dedupe_key) = ''
    or length(p_dedupe_key) > 160
    or left(p_dedupe_key, length('server-terminal:')) = 'server-terminal:') then
    raise exception 'invalid transition idempotency key';
  end if;

  v_terminal_event := case when p_transition = 'ended' then 'hangup' else p_transition end;
  v_effective_dedupe_key := 'server-terminal:' || p_transition || ':' || p_invitation_id::text
    || case when p_transition = 'expired' then '' else ':' || p_dedupe_key end;

  select * into v_invitation
  from public.native_call_invitations
  where id = p_invitation_id and v_user_id in (caller_id, callee_id)
  for update;
  if not found then raise exception 'invitation transition rejected'; end if;
  v_terminal_sender := case when p_transition = 'expired' then v_invitation.caller_id else v_user_id end;

  if v_invitation.status = p_transition then
    select sender_id, event_type, payload
    into v_existing_sender, v_existing_event, v_existing_payload
    from public.native_call_signals
    where invitation_id = p_invitation_id and dedupe_key = v_effective_dedupe_key;
    if found and v_existing_sender = v_terminal_sender
      and v_existing_event = v_terminal_event
      and v_existing_payload = '{}'::jsonb then
      return v_invitation;
    end if;
    raise exception 'terminal transition signal does not match';
  end if;

  update public.native_call_invitations
  set status = p_transition, ended_at = v_ended_at, updated_at = v_ended_at
  where id = p_invitation_id
    and v_user_id in (caller_id, callee_id)
    and ((p_transition = 'declined' and v_user_id = callee_id and status = 'ringing')
      or (p_transition = 'cancelled' and v_user_id = caller_id and status = 'ringing')
      or (p_transition = 'expired' and status = 'ringing' and expires_at <= now())
      or (p_transition = 'ended' and status = 'accepted'))
  returning * into v_invitation;
  if not found then raise exception 'invitation transition rejected'; end if;

  v_history_status := case p_transition
    when 'declined' then 'declined'
    when 'ended' then 'completed'
    else 'missed'
  end;
  update public.call_history
  set status = v_history_status,
      ended_at = v_ended_at,
      duration_seconds = case
        when p_transition <> 'ended' then 0
        when answered_at is null then 0
        else greatest(0, floor(extract(epoch from (v_ended_at - answered_at)))::integer)
      end
  where id = v_invitation.call_history_id;

  insert into public.native_call_signals (
    invitation_id, sender_id, event_type, dedupe_key, payload
  ) values (
    v_invitation.id, v_terminal_sender, v_terminal_event,
    v_effective_dedupe_key,
    '{}'::jsonb
  ) on conflict (invitation_id, dedupe_key) do nothing;

  select sender_id, event_type, payload
  into v_existing_sender, v_existing_event, v_existing_payload
  from public.native_call_signals
  where invitation_id = p_invitation_id and dedupe_key = v_effective_dedupe_key;
  if not found or v_existing_sender <> v_terminal_sender
    or v_existing_event <> v_terminal_event
    or v_existing_payload <> '{}'::jsonb then
    raise exception 'terminal transition signal does not match';
  end if;

  return v_invitation;
end;
$$;

create or replace function public.native_claim_call_push_deliveries(p_invitation_id uuid)
returns table (delivery_id uuid, device_id uuid, expo_push_token text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service role required'; end if;
  if p_invitation_id is null then raise exception 'invitation ID required'; end if;

  insert into public.native_call_push_deliveries (invitation_id, device_id, status)
  select p_invitation_id, device.id, 'queued'
  from public.native_push_devices device
  join public.native_call_invitations invitation on invitation.callee_id = device.user_id
  where invitation.id = p_invitation_id
    and invitation.status = 'ringing'
    and invitation.expires_at > now()
    and device.active
    and not exists (
      select 1 from public.user_blocks block_row
      where (block_row.blocker_user_id = invitation.caller_id and block_row.blocked_user_id = invitation.callee_id)
         or (block_row.blocker_user_id = invitation.callee_id and block_row.blocked_user_id = invitation.caller_id)
    )
  order by device.created_at
  limit 100
  on conflict (invitation_id, device_id) do nothing;

  return query
  with eligible as (
    select delivery.id as delivery_id, delivery.device_id, device.expo_push_token
    from public.native_call_push_deliveries delivery
    join public.native_push_devices device on device.id = delivery.device_id
    join public.native_call_invitations invitation on invitation.id = delivery.invitation_id
    where delivery.invitation_id = p_invitation_id
      and delivery.attempt_count < 3
      and (delivery.status = 'queued'
        or delivery.status = 'failed'
        or (delivery.status = 'sending' and delivery.updated_at < now() - interval '2 minutes'))
      and device.active
      and invitation.status = 'ringing'
      and invitation.expires_at > now()
      and not exists (
        select 1 from public.user_blocks block_row
        where (block_row.blocker_user_id = invitation.caller_id and block_row.blocked_user_id = invitation.callee_id)
           or (block_row.blocker_user_id = invitation.callee_id and block_row.blocked_user_id = invitation.caller_id)
      )
    order by delivery.created_at
    limit 100
    for update of delivery skip locked
  ), claimed as (
    update public.native_call_push_deliveries delivery
    set status = 'sending', attempt_count = delivery.attempt_count + 1, updated_at = now()
    from eligible
    where delivery.id = eligible.delivery_id
    returning delivery.id, delivery.device_id
  )
  select claimed.id, claimed.device_id, eligible.expo_push_token
  from claimed join eligible on eligible.delivery_id = claimed.id;
end;
$$;

create or replace function public.native_expire_call_invitations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service role required'; end if;
  with expired as (
    update public.native_call_invitations
    set status = 'expired', ended_at = now(), updated_at = now()
    where status = 'ringing' and expires_at <= now()
    returning id, call_history_id, caller_id
  ), histories as (
    update public.call_history history
    set status = 'missed', ended_at = now(), duration_seconds = 0
    from expired
    where history.id = expired.call_history_id and history.status = 'ringing'
  ), terminal_signals as (
    insert into public.native_call_signals (
      invitation_id, sender_id, event_type, dedupe_key, payload
    )
    select expired.id, expired.caller_id, 'expired',
      'server-terminal:expired:' || expired.id::text, '{}'::jsonb
    from expired
    on conflict (invitation_id, dedupe_key) do nothing
    returning id
  )
  select count(*) into v_count from expired;
  return coalesce(v_count, 0);
end;
$$;

create or replace function public.native_register_push_device(
  p_user_id uuid,
  p_installation_id uuid,
  p_expo_push_token text,
  p_platform text,
  p_previous_expo_push_token text default null
)
returns public.native_push_devices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device public.native_push_devices;
  v_previous public.native_push_devices;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service role required'; end if;
  if p_user_id is null or p_installation_id is null or p_expo_push_token is null
    or btrim(p_expo_push_token) = ''
    or p_expo_push_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$'
    or p_platform is null then
    raise exception 'invalid device registration';
  end if;
  if p_platform not in ('android', 'ios') then raise exception 'invalid device platform'; end if;

  perform pg_advisory_xact_lock(hashtext(p_installation_id::text));
  perform pg_advisory_xact_lock(hashtext(p_expo_push_token));
  select * into v_previous
  from public.native_push_devices
  where installation_id = p_installation_id and active
  for update;

  if found then
    if v_previous.user_id <> p_user_id
      and (p_previous_expo_push_token is null
        or v_previous.expo_push_token <> p_previous_expo_push_token) then
      raise exception 'device ownership proof failed';
    end if;
    if v_previous.expo_push_token <> p_expo_push_token
      and (p_previous_expo_push_token is null
        or v_previous.expo_push_token <> p_previous_expo_push_token) then
      raise exception 'token rotation proof failed';
    end if;
    if v_previous.user_id = p_user_id and v_previous.expo_push_token = p_expo_push_token then
      update public.native_push_devices
      set platform = p_platform, last_seen_at = now(), updated_at = now()
      where id = v_previous.id
      returning * into v_device;
      return v_device;
    end if;
    update public.native_push_devices
    set active = false, revoked_at = now(), updated_at = now()
    where id = v_previous.id;
  end if;

  if exists (
    select 1 from public.native_push_devices
    where expo_push_token = p_expo_push_token and active
  ) then raise exception 'push token is already assigned to another installation'; end if;

  insert into public.native_push_devices (
    user_id, installation_id, expo_push_token, platform,
    active, last_seen_at, revoked_at
  ) values (
    p_user_id, p_installation_id, p_expo_push_token, p_platform,
    true, now(), null
  ) returning * into v_device;
  return v_device;
end;
$$;

create or replace function public.native_prepare_push_device(
  p_user_id uuid,
  p_installation_id uuid,
  p_previous_expo_push_token text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service role required'; end if;
  if p_user_id is null or p_installation_id is null
    or (p_previous_expo_push_token is not null
      and p_previous_expo_push_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$') then
    raise exception 'invalid installation';
  end if;
  if p_previous_expo_push_token is null then return; end if;
  update public.native_push_devices
  set active = false, revoked_at = now(), updated_at = now()
  where installation_id = p_installation_id
    and user_id <> p_user_id
    and expo_push_token = p_previous_expo_push_token
    and active;
end;
$$;

create or replace function public.native_revoke_push_device(
  p_user_id uuid,
  p_installation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service role required'; end if;
  if p_user_id is null or p_installation_id is null then raise exception 'invalid installation'; end if;
  update public.native_push_devices
  set active = false, revoked_at = now(), updated_at = now()
  where user_id = p_user_id and installation_id = p_installation_id and active;
  return found;
end;
$$;

create or replace function public.native_record_push_result(
  p_delivery_id uuid,
  p_status text,
  p_ticket_id text,
  p_error_code text,
  p_revoke_device boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service role required'; end if;
  if p_delivery_id is null or p_status is null
    or p_status not in ('provider_ticketed', 'receipt_accepted', 'failed', 'stale_token') then
    raise exception 'invalid push delivery status';
  end if;
  if p_status = 'provider_ticketed' and (p_ticket_id is null or btrim(p_ticket_id) = '') then
    raise exception 'provider ticket ID required';
  end if;
  if coalesce(p_revoke_device, false) and p_status <> 'stale_token' then
    raise exception 'only stale tokens may be revoked from a push result';
  end if;
  update public.native_call_push_deliveries
  set status = p_status, expo_ticket_id = coalesce(p_ticket_id, expo_ticket_id),
      last_error_code = p_error_code, updated_at = now()
  where id = p_delivery_id
    and (p_status <> 'provider_ticketed' or p_ticket_id is not null)
  returning device_id into v_device_id;

  if v_device_id is not null and p_revoke_device then
    update public.native_push_devices
    set active = false, revoked_at = now(), updated_at = now()
    where id = v_device_id;
  end if;
end;
$$;

create or replace function public.native_apply_expo_receipts(p_receipts jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_receipt jsonb;
  v_count integer := 0;
  v_device_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service role required'; end if;
  if p_receipts is null or jsonb_typeof(p_receipts) is distinct from 'array' then
    raise exception 'receipts must be an array';
  end if;
  if jsonb_array_length(p_receipts) > 100 then
    raise exception 'receipt batch is too large';
  end if;

  for v_receipt in select value from jsonb_array_elements(p_receipts)
  loop
    if coalesce(v_receipt ->> 'id', '') = '' then continue; end if;
        update public.native_call_push_deliveries
    set status = case
          when v_receipt ->> 'status' = 'ok' then 'receipt_accepted'
          when v_receipt #>> '{details,error}' = 'DeviceNotRegistered' then 'stale_token'
          else 'failed'
        end,
        last_error_code = case
          when v_receipt ->> 'status' = 'ok' then null
          else coalesce(v_receipt #>> '{details,error}', 'EXPO_RECEIPT_ERROR')
        end,
        updated_at = now()
    where expo_ticket_id = v_receipt ->> 'id'
      and status = 'provider_ticketed'
    returning device_id into v_device_id;

    if found then
      if v_receipt #>> '{details,error}' = 'DeviceNotRegistered' then
        update public.native_push_devices
        set active = false, revoked_at = now(), updated_at = now()
        where id = v_device_id;
      end if;
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

create or replace function public.native_cleanup_call_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expired integer;
  v_invites integer;
  v_devices integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service role required'; end if;
  v_expired := public.native_expire_call_invitations();
  delete from public.native_call_invitations
  where status in ('declined', 'cancelled', 'expired', 'ended')
    and updated_at < now() - interval '30 days';
  get diagnostics v_invites = row_count;
  delete from public.native_push_devices
  where not active and revoked_at < now() - interval '30 days';
  get diagnostics v_devices = row_count;
  return jsonb_build_object('expired', v_expired, 'removedInvitations', v_invites, 'removedDevices', v_devices);
end;
$$;

revoke all on function public.native_create_call_invitation(uuid, uuid, text, jsonb, uuid) from public, anon;
revoke all on function public.native_accept_call_invitation(uuid, jsonb, text) from public, anon;
revoke all on function public.native_append_call_signal(uuid, text, text, jsonb) from public, anon;
revoke all on function public.native_transition_call_invitation(uuid, text, text) from public, anon;
revoke all on function public.native_claim_call_push_deliveries(uuid) from public, anon, authenticated;
revoke all on function public.native_expire_call_invitations() from public, anon, authenticated;
revoke all on function public.native_register_push_device(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.native_prepare_push_device(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.native_revoke_push_device(uuid, uuid) from public, anon, authenticated;
revoke all on function public.native_record_push_result(uuid, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.native_apply_expo_receipts(jsonb) from public, anon, authenticated;
revoke all on function public.native_cleanup_call_data() from public, anon, authenticated;
grant execute on function public.native_create_call_invitation(uuid, uuid, text, jsonb, uuid) to authenticated;
grant execute on function public.native_accept_call_invitation(uuid, jsonb, text) to authenticated;
grant execute on function public.native_append_call_signal(uuid, text, text, jsonb) to authenticated;
grant execute on function public.native_transition_call_invitation(uuid, text, text) to authenticated;
grant execute on function public.native_claim_call_push_deliveries(uuid) to service_role;
grant execute on function public.native_expire_call_invitations() to service_role;
grant execute on function public.native_register_push_device(uuid, uuid, text, text, text) to service_role;
grant execute on function public.native_prepare_push_device(uuid, uuid, text) to service_role;
grant execute on function public.native_revoke_push_device(uuid, uuid) to service_role;
grant execute on function public.native_record_push_result(uuid, text, text, text, boolean) to service_role;
grant execute on function public.native_apply_expo_receipts(jsonb) to service_role;
grant execute on function public.native_cleanup_call_data() to service_role;
