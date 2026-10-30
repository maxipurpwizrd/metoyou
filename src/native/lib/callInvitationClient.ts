import { nativeSupabase } from './supabase';

async function retryIdempotentRequest<T>(
  request: () => Promise<{ data: T; error: Error | null }>,
): Promise<T> {
  try {
    const result = await request();
    if (result.error) throw result.error;
    return result.data;
  } catch {
    // The request retains its idempotency key and payload across this retry.
    const result = await request();
    if (result.error) throw result.error;
    return result.data;
  }
}

export type CallOffer = {
  type: 'offer';
  sdp: string;
};

export type CallAnswer = {
  type: 'answer';
  sdp: string;
};

export type CallIceCandidatePayload = {
  candidate: string;
  sdpMLineIndex?: number | null;
  sdpMid?: string | null;
  usernameFragment?: string | null;
};

export type CallRenegotiationOffer = CallOffer & { renegotiation: true };
export type CallRenegotiationAnswer = CallAnswer & { renegotiation: true };

export type CallInvitationRequest = {
  conversationId: string;
  calleeId: string;
  callType: 'audio' | 'video';
  offer: CallOffer;
  idempotencyKey: string;
};

export type CreatedServerCallInvitation = {
  id: string;
  callHistoryId: string;
  status: string;
  expiresAt: string;
};

export type CreateServerCallInvitationResponse = {
  invitation: CreatedServerCallInvitation;
  push: unknown;
};

export type RecoveredServerCallInvitation = {
  id: string;
  call_history_id: string;
  conversation_id: string;
  caller_id: string;
  callee_id: string;
  call_type: 'audio' | 'video';
  status: string;
  expires_at: string;
};

export type RecoveredServerCallSignal = {
  id: string;
  sequence_number: number;
  sender_id: string;
  event_type: string;
  dedupe_key: string;
  payload: unknown;
};

export type RecoverServerCallInvitationResponse = {
  invitation: RecoveredServerCallInvitation;
  signals: RecoveredServerCallSignal[];
};

export type GetServerCallInvitationResponse = {
  invitation: RecoveredServerCallInvitation;
};

export async function createServerCallInvitation(
  input: CallInvitationRequest,
): Promise<CreateServerCallInvitationResponse> {
  const data = await retryIdempotentRequest(() =>
    nativeSupabase.functions.invoke('native-call', {
      body: { action: 'create', ...input },
    }));

  if (!data?.invitation) throw new Error('The call invitation response was incomplete.');
  return data as CreateServerCallInvitationResponse;
}

export async function recoverServerCallInvitation(
  invitationId: string,
): Promise<RecoverServerCallInvitationResponse> {
  const { data, error } = await nativeSupabase.functions.invoke('native-call', {
    body: { action: 'recover', invitationId },
  });

  if (error) throw error;
  if (!data?.invitation || !Array.isArray(data.signals)) {
    throw new Error('The recovered call invitation response was incomplete.');
  }
  return data as RecoverServerCallInvitationResponse;
}

export async function getServerCallInvitation(
  invitationId: string,
): Promise<GetServerCallInvitationResponse> {
  const { data, error } = await nativeSupabase.functions.invoke('native-call', {
    body: { action: 'get', invitationId },
  });

  if (error) throw error;
  if (!data?.invitation) throw new Error('The call invitation response was incomplete.');
  return data as GetServerCallInvitationResponse;
}

export async function acceptServerCallInvitation(
  invitationId: string,
  answer: CallAnswer,
  dedupeKey: string,
) {
  const data = await retryIdempotentRequest(() =>
    nativeSupabase.functions.invoke('native-call', {
      body: { action: 'accept', invitationId, answer, dedupeKey },
    }));
  return data;
}

export function appendServerCallSignal(
  invitationId: string,
  eventType: 'ice',
  payload: CallIceCandidatePayload,
  dedupeKey: string,
): Promise<unknown>;
export function appendServerCallSignal(
  invitationId: string,
  eventType: 'renegotiation-offer',
  payload: CallRenegotiationOffer,
  dedupeKey: string,
): Promise<unknown>;
export function appendServerCallSignal(
  invitationId: string,
  eventType: 'renegotiation-answer',
  payload: CallRenegotiationAnswer,
  dedupeKey: string,
): Promise<unknown>;
export async function appendServerCallSignal(
  invitationId: string,
  eventType: 'ice' | 'renegotiation-offer' | 'renegotiation-answer',
  payload: CallIceCandidatePayload | CallRenegotiationOffer | CallRenegotiationAnswer,
  dedupeKey: string,
) {
  const signalType = eventType === 'renegotiation-offer' ? 'offer'
    : eventType === 'renegotiation-answer' ? 'answer' : 'ice';
  const signalPayload = eventType === 'ice' ? payload : { ...payload, renegotiation: true };
  const data = await retryIdempotentRequest(() =>
    nativeSupabase.functions.invoke('native-call', {
      body: { action: 'signal', invitationId, eventType: signalType, payload: signalPayload, dedupeKey },
    }));
  return data;
}

export async function transitionServerCallInvitation(
  invitationId: string,
  action: 'decline' | 'cancel' | 'expire' | 'end',
  dedupeKey: string,
) {
  const data = await retryIdempotentRequest(() =>
    nativeSupabase.functions.invoke('native-call', {
      body: { action, invitationId, dedupeKey },
    }));
  return data;
}
