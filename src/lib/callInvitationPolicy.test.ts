import { describe, expect, it } from 'vitest';
import {
  canAcceptInvitation,
  isCallInvitationParticipant,
  isDuplicateSignalEvent,
  isExpiredCallInvitation,
  isOwnedDeviceRegistration,
} from './callInvitationPolicy';

describe('call invitation policy', () => {
  it('keeps invitation access restricted to the actual participants', () => {
    const invitation = { callerId: 'user-a', calleeId: 'user-b' };

    expect(isCallInvitationParticipant(invitation, 'user-a')).toBe(true);
    expect(isCallInvitationParticipant(invitation, 'user-b')).toBe(true);
    expect(isCallInvitationParticipant(invitation, 'user-c')).toBe(false);
  });

  it('rejects expired or cancelled invitations before acceptance', () => {
    const expired = {
      status: 'ringing',
      expiresAt: '2024-01-01T00:00:00.000Z',
      callerId: 'user-a',
      calleeId: 'user-b',
    };
    const cancelled = {
      status: 'cancelled',
      expiresAt: '2099-01-01T00:00:00.000Z',
      callerId: 'user-a',
      calleeId: 'user-b',
    };

    expect(isExpiredCallInvitation(expired, new Date('2024-01-02T00:00:00.000Z'))).toBe(true);
    expect(canAcceptInvitation(expired, 'user-b', new Date('2024-01-02T00:00:00.000Z'))).toBe(false);
    expect(canAcceptInvitation(cancelled, 'user-b', new Date('2024-01-02T00:00:00.000Z'))).toBe(false);
  });

  it('treats repeated signaling payloads as idempotent', () => {
    const seen = new Set(['call:invite:abc:offer', 'call:invite:abc:answer']);

    expect(isDuplicateSignalEvent('call:invite:abc:offer', seen)).toBe(true);
    expect(isDuplicateSignalEvent('call:invite:abc:ice:1', seen)).toBe(false);
  });

  it('requires the current account to own a device registration before it can be used', () => {
    expect(isOwnedDeviceRegistration('user-a', 'user-a')).toBe(true);
    expect(isOwnedDeviceRegistration('user-a', 'user-b')).toBe(false);
  });
});
