import {
  type AdminClient,
  authenticateUser,
  corsHeaders,
  isRecord,
  isResponse,
  isValidUuid,
  jsonResponse,
} from '../_shared/native.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const MAX_PUSH_BATCH = 100;
const MAX_SDP_PAYLOAD_BYTES = 60 * 1024;
const MAX_ICE_PAYLOAD_BYTES = 7 * 1024;
const textEncoder = new TextEncoder();

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: string[]): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function isWithinPayloadByteLimit(value: Record<string, unknown>, maxBytes: number): boolean {
  const serialized = JSON.stringify(value);
  // JSON.stringify UTF-8 bytes and PostgreSQL JSONB text bytes can differ.
  // These conservative limits leave room for that overhead; SQL checks remain authoritative.
  return serialized !== undefined && textEncoder.encode(serialized).byteLength <= maxBytes;
}

function isSessionDescription(
  value: unknown,
  type: 'offer' | 'answer',
  renegotiation: boolean,
): value is Record<string, unknown> {
  if (!isRecord(value) || value.type !== type || typeof value.sdp !== 'string'
    || value.sdp.length === 0 || !isWithinPayloadByteLimit(value, MAX_SDP_PAYLOAD_BYTES)) {
    return false;
  }
  if (renegotiation) {
    return value.renegotiation === true
      && hasOnlyKeys(value, ['type', 'sdp', 'renegotiation']);
  }
  return !Object.prototype.hasOwnProperty.call(value, 'renegotiation')
    && hasOnlyKeys(value, ['type', 'sdp']);
}

function isIcePayload(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value) || typeof value.candidate !== 'string' || value.candidate.length === 0
    || !isWithinPayloadByteLimit(value, MAX_ICE_PAYLOAD_BYTES)
    || !hasOnlyKeys(value, ['candidate', 'sdpMLineIndex', 'sdpMid', 'usernameFragment'])) {
    return false;
  }
  return (!Object.prototype.hasOwnProperty.call(value, 'sdpMLineIndex')
      || value.sdpMLineIndex === null
      || (typeof value.sdpMLineIndex === 'number' && Number.isFinite(value.sdpMLineIndex)))
    && (!Object.prototype.hasOwnProperty.call(value, 'sdpMid')
      || value.sdpMid === null || typeof value.sdpMid === 'string')
    && (!Object.prototype.hasOwnProperty.call(value, 'usernameFragment')
      || value.usernameFragment === null || typeof value.usernameFragment === 'string');
}

async function sendInvitationPush(
  adminClient: AdminClient,
  invitation: { id: string; caller_id: string; callee_id: string; call_type: string },
) {
  const { data: deliveries, error: claimError } = await adminClient.rpc(
    'native_claim_call_push_deliveries',
    { p_invitation_id: invitation.id },
  );
  if (claimError) throw new Error('Could not claim native push deliveries');

  const claimed = (deliveries ?? []).slice(0, MAX_PUSH_BATCH) as Array<{
    delivery_id: string;
    device_id: string;
    expo_push_token: string;
  }>;
  if (claimed.length === 0) return { queued: 0, reason: 'no_active_devices_or_already_dispatched' };

  const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (!expoAccessToken) {
    await Promise.all(claimed.map((delivery) => adminClient.rpc('native_record_push_result', {
      p_delivery_id: delivery.delivery_id,
      p_status: 'failed',
      p_ticket_id: null,
      p_error_code: 'EXPO_ACCESS_TOKEN_NOT_CONFIGURED',
      p_revoke_device: false,
    })));
    return { queued: 0, reason: 'push_credentials_not_configured' };
  }

  const messages = claimed.map((delivery) => ({
    to: delivery.expo_push_token,
    sound: 'default',
    title: 'Incoming call',
    body: 'You have an incoming MeToYou call.',
    data: {
      type: 'native_call_invitation',
      invitationId: invitation.id,
      callType: invitation.call_type,
    },
    priority: 'high',
    ttl: 60,
    channelId: 'calls',
    collapseId: invitation.id,
    tag: invitation.id,
  }));

  const { data: blockRows, error: blockError } = await adminClient
    .from('user_blocks')
    .select('blocker_user_id')
    .or(`and(blocker_user_id.eq.${invitation.caller_id},blocked_user_id.eq.${invitation.callee_id}),and(blocker_user_id.eq.${invitation.callee_id},blocked_user_id.eq.${invitation.caller_id})`)
    .limit(1);
  if (blockError) throw new Error('Could not verify call invitation block status');
  if ((blockRows ?? []).length > 0) {
    const recorded = await Promise.all(claimed.map((delivery) => adminClient.rpc('native_record_push_result', {
      p_delivery_id: delivery.delivery_id,
      p_status: 'failed',
      p_ticket_id: null,
      p_error_code: 'PARTICIPANTS_BLOCKED',
      p_revoke_device: false,
    })));
    if (recorded.some(({ error }) => error)) {
      throw new Error('Could not record suppressed native call push deliveries');
    }
    return { queued: 0, reason: 'participants_blocked' };
  }

  // A block can still be added after this check and before the Expo request.
  let response: Response;
  let tickets: unknown;
  try {
    response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${expoAccessToken}`,
      },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(12_000),
    });
    const result = await response.json();
    tickets = isRecord(result) ? result.data : null;
    if (!response.ok || !Array.isArray(tickets)) throw new Error('Expo push transport rejected the batch');
  } catch {
    await Promise.all(claimed.map((delivery) => adminClient.rpc('native_record_push_result', {
      p_delivery_id: delivery.delivery_id,
      p_status: 'failed',
      p_ticket_id: null,
      p_error_code: 'EXPO_TRANSPORT_ERROR',
      p_revoke_device: false,
    })));
    return { attempted: claimed.length, providerTicketed: 0, reason: 'transient_push_transport_failure' };
  }

  const ticketResults = tickets as Array<{ status?: string; id?: string; message?: string; details?: { error?: string } }>;
  const recorded = await Promise.all(claimed.map(async (delivery, index) => {
    const ticket = ticketResults[index];
    const stale = ticket?.details?.error === 'DeviceNotRegistered';
    const successful = ticket?.status === 'ok' && typeof ticket.id === 'string';
    const { error } = await adminClient.rpc('native_record_push_result', {
      p_delivery_id: delivery.delivery_id,
      p_status: stale ? 'stale_token' : successful ? 'provider_ticketed' : 'failed',
      p_ticket_id: successful ? ticket.id : null,
      p_error_code: stale ? 'DeviceNotRegistered' : successful ? null : ticket?.details?.error ?? 'EXPO_TICKET_ERROR',
      p_revoke_device: stale,
    });
    return { successful, stale, recordFailed: Boolean(error) };
  }));

  return {
    attempted: claimed.length,
    providerTicketed: recorded.filter((item) => item.successful && !item.recordFailed).length,
    stale: recorded.filter((item) => item.stale && !item.recordFailed).length,
    receiptProcessing: 'Provider tickets are stored for receipt checks; this does not confirm notification display on a device.',
  };
}

async function handleUserRequest(request: Request): Promise<Response> {
  const auth = await authenticateUser(request);
  if (isResponse(auth)) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }
  if (!isRecord(body) || typeof body.action !== 'string') {
    return jsonResponse(400, { error: 'A valid action is required' });
  }

  if (body.action === 'create') {
    if (!isValidUuid(body.conversationId) || !isValidUuid(body.calleeId)
      || !isValidUuid(body.idempotencyKey) || (body.callType !== 'audio' && body.callType !== 'video')
      || !isSessionDescription(body.offer, 'offer', false)) {
      return jsonResponse(400, { error: 'Invalid call invitation request' });
    }

    const { data: invitation, error } = await auth.userClient.rpc('native_create_call_invitation', {
      p_conversation_id: body.conversationId,
      p_callee_id: body.calleeId,
      p_call_type: body.callType,
      p_initial_offer: body.offer,
      p_idempotency_key: body.idempotencyKey,
    });
    if (error || !invitation) return jsonResponse(403, { error: 'Call invitation was not authorized' });

    const dispatch = await sendInvitationPush(auth.adminClient, invitation);
    return jsonResponse(200, {
      invitation: {
        id: invitation.id,
        callHistoryId: invitation.call_history_id,
        status: invitation.status,
        expiresAt: invitation.expires_at,
      },
      push: dispatch,
    });
  }

  if (body.action === 'get' || body.action === 'recover') {
    if (!isValidUuid(body.invitationId)) return jsonResponse(400, { error: 'Invalid invitation ID' });
    const { data: invitation, error } = await auth.userClient
      .from('native_call_invitations')
      .select('id, call_history_id, conversation_id, caller_id, callee_id, call_type, status, expires_at, accepted_at, ended_at, created_at')
      .eq('id', body.invitationId)
      .maybeSingle();
    if (error) return jsonResponse(500, { error: 'Could not retrieve call invitation' });
    if (!invitation) return jsonResponse(404, { error: 'Call invitation not found' });
    if (body.action === 'recover' && invitation.callee_id !== auth.user.id) {
      return jsonResponse(403, { error: 'This invitation is not addressed to the current user' });
    }

    if (invitation.status === 'ringing' && new Date(invitation.expires_at).getTime() <= Date.now()) {
      const { data: expired, error: expireError } = await auth.userClient.rpc('native_transition_call_invitation', {
        p_invitation_id: invitation.id,
        p_transition: 'expired',
        p_dedupe_key: `expired:${invitation.id}`,
      });
      if (expireError) return jsonResponse(409, { error: 'Call invitation has expired' });
      const { data: expiredSignals, error: expiredSignalsError } = await auth.userClient
        .from('native_call_signals')
        .select('id, sequence_number, sender_id, event_type, dedupe_key, payload, created_at')
        .eq('invitation_id', invitation.id)
        .order('sequence_number', { ascending: true })
        .limit(500);
      if (expiredSignalsError) return jsonResponse(500, { error: 'Could not recover call signaling' });
      return jsonResponse(200, { invitation: expired, signals: expiredSignals ?? [] });
    }
    if (body.action === 'recover' && invitation.status !== 'ringing' && invitation.status !== 'accepted') {
      return jsonResponse(409, { error: 'Call invitation is no longer active' });
    }

    const { data: signals, error: signalError } = await auth.userClient
      .from('native_call_signals')
      .select('id, sequence_number, sender_id, event_type, dedupe_key, payload, created_at')
      .eq('invitation_id', invitation.id)
      .order('sequence_number', { ascending: true })
      .limit(500);
    if (signalError) return jsonResponse(500, { error: 'Could not recover call signaling' });
    return jsonResponse(200, { invitation, signals: signals ?? [] });
  }

  if (body.action === 'accept') {
    if (!isValidUuid(body.invitationId) || !isSessionDescription(body.answer, 'answer', false)
      || typeof body.dedupeKey !== 'string') {
      return jsonResponse(400, { error: 'Invalid call answer' });
    }
    const { data, error } = await auth.userClient.rpc('native_accept_call_invitation', {
      p_invitation_id: body.invitationId,
      p_answer: body.answer,
      p_dedupe_key: body.dedupeKey,
    });
    if (error) return jsonResponse(409, { error: 'Call invitation cannot be accepted' });
    return jsonResponse(200, { invitation: data });
  }

  if (body.action === 'signal') {
    if (!isValidUuid(body.invitationId) || typeof body.dedupeKey !== 'string'
      || (body.eventType === 'ice'
        ? !isIcePayload(body.payload)
        : body.eventType === 'offer'
          ? !isSessionDescription(body.payload, 'offer', true)
          : body.eventType === 'answer'
            ? !isSessionDescription(body.payload, 'answer', true)
            : true)) {
      return jsonResponse(400, { error: 'Invalid signaling event' });
    }
    const { data, error } = await auth.userClient.rpc('native_append_call_signal', {
      p_invitation_id: body.invitationId,
      p_event_type: body.eventType,
      p_dedupe_key: body.dedupeKey,
      p_payload: body.payload,
    });
    if (error) return jsonResponse(403, { error: 'Signaling event was not authorized' });
    return jsonResponse(200, { signalId: data });
  }

  if (body.action === 'decline' || body.action === 'cancel' || body.action === 'expire' || body.action === 'end') {
    if (!isValidUuid(body.invitationId)) return jsonResponse(400, { error: 'Invalid invitation ID' });
    const transition = body.action === 'decline' ? 'declined'
      : body.action === 'cancel' ? 'cancelled'
        : body.action === 'expire' ? 'expired' : 'ended';
    const { data, error } = await auth.userClient.rpc('native_transition_call_invitation', {
      p_invitation_id: body.invitationId,
      p_transition: transition,
      p_dedupe_key: typeof body.dedupeKey === 'string' ? body.dedupeKey : null,
    });
    if (error) return jsonResponse(409, { error: 'Call invitation transition was rejected' });
    return jsonResponse(200, { invitation: data });
  }

  return jsonResponse(400, { error: 'Unsupported call action' });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  try {
    return await handleUserRequest(request);
  } catch {
    return jsonResponse(500, { error: 'Native call request failed' });
  }
});
