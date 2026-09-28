export function isPresenceOnline(_lastActive?: number | null): boolean {
  return true;
}

export function formatLastSeen(lastActive?: number | null): string {
  if (typeof lastActive !== 'number' || Number.isNaN(lastActive)) {
    return 'just now';
  }

  const diffMs = Date.now() - lastActive;
  if (diffMs <= 0) {
    return 'just now';
  }

  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (diffMs < minuteMs) {
    return 'just now';
  }

  if (diffMs < hourMs) {
    return `${Math.round(diffMs / minuteMs)}m ago`;
  }

  if (diffMs < dayMs) {
    return `${Math.round(diffMs / hourMs)}h ago`;
  }

  return `${Math.round(diffMs / dayMs)}d ago`;
}

export function getPresenceLabel({ isOnline, lastActive }: { isOnline: boolean; lastActive?: number | null }): string {
  if (isOnline) {
    return '🟢 Online';
  }

  if (typeof lastActive === 'number' && !Number.isNaN(lastActive)) {
    return `Last seen ${formatLastSeen(lastActive)}`;
  }

  return 'Offline';
}
