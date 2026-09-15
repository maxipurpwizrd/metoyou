export function buildUserScopedStorageKey(key: string, userId: string | null | undefined) {
  return userId ? `${key}:${userId}` : `${key}:anonymous`;
}

export function clearUserScopedClientState({
  previousUserId,
  nextUserId,
  routeKey,
}: {
  previousUserId?: string | null;
  nextUserId?: string | null;
  routeKey?: string;
}) {
  if (typeof window === 'undefined') {
    return;
  }

  const userScopedPrefixes = [
    'metoyou-session-cache',
    'metoyou-feed-cache',
    'metoyou-chat-cache',
    'metoyou:appInitializedUserId',
    'metoyou:last-auth-route',
  ];

  const entriesToRemove = new Set<string>();

  const removeMatchingKeys = (storage: Storage) => {
    const allKeys = Object.keys(storage);
    for (const key of allKeys) {
      if (userScopedPrefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}:`))) {
        if (previousUserId && key.includes(previousUserId)) {
          entriesToRemove.add(key);
        }
        if (nextUserId && key.includes(nextUserId)) {
          entriesToRemove.add(key);
        }
        if (!previousUserId && !nextUserId && key.startsWith('metoyou:last-auth-route')) {
          entriesToRemove.add(key);
        }
      }
    }
  };

  removeMatchingKeys(window.localStorage);
  removeMatchingKeys(window.sessionStorage);

  if (routeKey) {
    entriesToRemove.add(routeKey);
  }

  for (const key of entriesToRemove) {
    try {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    } catch {
      // ignore storage cleanup errors
    }
  }

  if (previousUserId && previousUserId !== nextUserId) {
    const previousRouteKey = buildUserScopedStorageKey('metoyou:last-auth-route', previousUserId);
    window.sessionStorage.removeItem(previousRouteKey);
    window.localStorage.removeItem(buildUserScopedStorageKey('metoyou-session-cache', previousUserId));
    window.localStorage.removeItem(buildUserScopedStorageKey('metoyou-feed-cache', previousUserId));
    window.sessionStorage.removeItem(buildUserScopedStorageKey('metoyou-chat-cache', previousUserId));
    window.sessionStorage.removeItem('metoyou:appInitializedUserId');
  }

  if (nextUserId) {
    window.sessionStorage.removeItem('metoyou:last-auth-route');
  }

  window.dispatchEvent(new Event('metoyou:auth-user-changed'));
}

export function shouldRedirectAuthenticatedPublicRoute(pathname: string, userId?: string | null) {
  if (!userId) return false;
  return pathname === '/login' || pathname === '/signup';
}
