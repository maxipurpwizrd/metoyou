export type CallInvitationStatus = 'ringing' | 'accepted' | 'declined' | 'cancelled' | 'expired' | 'timed_out';

export type CallInvitationShape = {
  callerId: string;
  calleeId: string;
  status: CallInvitationStatus;
  expiresAt: string;
};

export function isCallInvitationParticipant(invitation: Pick<CallInvitationShape, 'callerId' | 'calleeId'>, userId: string): boolean {
  return invitation.callerId === userId || invitation.calleeId === userId;
}

export function isExpiredCallInvitation(
  invitation: Pick<CallInvitationShape, 'expiresAt'>,
  asOf: Date = new Date(),
): boolean {
  return new Date(invitation.expiresAt).getTime() <= asOf.getTime();
}

export function canAcceptInvitation(
  invitation: Pick<CallInvitationShape, 'callerId' | 'calleeId' | 'status' | 'expiresAt'>,
  userId: string,
  asOf: Date = new Date(),
): boolean {
  if (!isCallInvitationParticipant(invitation, userId)) return false;
  if (invitation.status !== 'ringing') return false;
  if (isExpiredCallInvitation(invitation, asOf)) return false;
  return true;
}

export function isDuplicateSignalEvent(signalKey: string, seenKeys: Set<string>): boolean {
  return seenKeys.has(signalKey);
}

export function isOwnedDeviceRegistration(ownerUserId: string, currentUserId: string): boolean {
  return ownerUserId === currentUserId;
}
