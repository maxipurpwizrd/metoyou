CREATE OR REPLACE FUNCTION public.native_claim_call_push_deliveries(p_invitation_id uuid)
RETURNS TABLE(delivery_id uuid, device_id uuid, expo_push_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
  on conflict on constraint native_call_push_deliveries_invitation_id_device_id_key do nothing;

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
$function$;
