import { describe, expect, it } from 'vitest';
import { formatLastSeen, getPresenceLabel } from './presenceStatus';

describe('presence status formatting', () => {
  it('shows online when the presence member exists even if the timestamp is stale', () => {
    expect(getPresenceLabel({ isOnline: true, lastActive: Date.now() - 60 * 60 * 1000 })).toBe('🟢 Online');
  });

  it('shows last seen when the user is offline', () => {
    const lastSeen = Date.now() - 2 * 60 * 1000;
    expect(getPresenceLabel({ isOnline: false, lastActive: lastSeen })).toContain('Last seen');
    expect(formatLastSeen(lastSeen)).toContain('2m ago');
  });

  it('falls back to offline when there is no presence data', () => {
    expect(getPresenceLabel({ isOnline: false, lastActive: undefined })).toBe('Offline');
  });
});
