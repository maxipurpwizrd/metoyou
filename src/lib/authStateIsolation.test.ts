import { describe, expect, it, beforeEach } from 'vitest';
import { buildUserScopedStorageKey, clearUserScopedClientState, shouldRedirectAuthenticatedPublicRoute } from './authStateIsolation';

describe('auth state isolation', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('redirects authenticated users away from login and signup', () => {
    expect(shouldRedirectAuthenticatedPublicRoute('/login', 'user-a')).toBe(true);
    expect(shouldRedirectAuthenticatedPublicRoute('/signup', 'user-a')).toBe(true);
    expect(shouldRedirectAuthenticatedPublicRoute('/login', null)).toBe(false);
  });

  it('clears user-scoped state for the previous account before switching', () => {
    const previousUserId = 'user-a';
    const nextUserId = 'user-b';

    const previousSessionKey = buildUserScopedStorageKey('metoyou-session-cache', previousUserId);
    const previousChatKey = buildUserScopedStorageKey('metoyou-chat-cache', previousUserId);
    const previousRouteKey = 'metoyou:last-auth-route';

    window.localStorage.setItem(previousSessionKey, JSON.stringify({ profileId: previousUserId }));
    window.sessionStorage.setItem(previousChatKey, JSON.stringify({ conversation: 'conv-a' }));
    window.sessionStorage.setItem(previousRouteKey, '/chat?recipient=user-a');

    clearUserScopedClientState({ previousUserId, nextUserId, routeKey: previousRouteKey });

    expect(window.localStorage.getItem(previousSessionKey)).toBeNull();
    expect(window.sessionStorage.getItem(previousChatKey)).toBeNull();
    expect(window.sessionStorage.getItem(previousRouteKey)).toBeNull();
  });
});
