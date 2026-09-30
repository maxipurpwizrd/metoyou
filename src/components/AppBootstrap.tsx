import React, { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getMessageThreads } from '../lib/messageApi';
import { getNotifications, subscribeToNotifications } from '../lib/notificationApi';
import { useAppInit } from '../contexts/AppInitContext';
import { useSession } from '../contexts/SessionContext';
import { syncGrantedPushSubscription } from '../lib/notificationPush';
import { supabase } from '../lib/supabase';
import { startBackgroundSubscriptions, stopBackgroundSubscriptions } from '../lib/backgroundSubscriptions';

const APP_PRESENCE_EVENT = 'metoyou:app-presence-state';
const APP_MESSAGE_EVENT = 'metoyou:messages-updated';

export default function AppBootstrap({ children }: { children: React.ReactNode }) {
  const { setProgress, setCurrentTask, setAppReady } = useAppInit();
  useSession();

  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    void startBackgroundSubscriptions(user.id, () => {
      window.dispatchEvent(new CustomEvent(APP_MESSAGE_EVENT));
    });

    return () => {
      void stopBackgroundSubscriptions();
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase.channel('presence:app', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    const normalizePresenceState = (state: unknown) => {
      const normalized: Record<string, { last_active?: number; username?: string }> = {};
      if (!state || typeof state !== 'object') {
        return normalized;
      }

      for (const [userId, entry] of Object.entries(state as Record<string, unknown>)) {
        const meta = Array.isArray(entry) ? entry[0] : entry;
        const payload = meta && typeof meta === 'object' ? meta as Record<string, unknown> : {};
        normalized[userId] = {
          last_active: typeof payload.last_active === 'number' ? payload.last_active : Date.now(),
          username: typeof payload.username === 'string' ? payload.username : undefined,
        };
      }

      return normalized;
    };

    const broadcastPresenceState = () => {
      const nextState = normalizePresenceState((channel as { presenceState?: () => unknown }).presenceState?.());
      window.dispatchEvent(new CustomEvent(APP_PRESENCE_EVENT, { detail: nextState }));
    };

    const trackPresence = async () => {
      try {
        await channel.track({
          last_active: Date.now(),
          username: user.email ?? 'MeToYou user',
          online_at: new Date().toISOString(),
        });
        broadcastPresenceState();
      } catch (error) {
        console.warn('[AppBootstrap] presence tracking failed', error);
      }
    };

    channel.on('presence', { event: 'sync' }, broadcastPresenceState);
    channel.on('presence', { event: 'join' }, broadcastPresenceState);
    channel.on('presence', { event: 'leave' }, broadcastPresenceState);

    let unsubscribed = false;
    let keepAliveHandle: number | undefined;

    channel.subscribe(async (status: string) => {
      if (status !== 'SUBSCRIBED' || unsubscribed) return;

      await trackPresence();
      keepAliveHandle = window.setInterval(() => {
        if (unsubscribed) return;
        void trackPresence();
      }, 30000);
    });

    return () => {
      unsubscribed = true;
      if (keepAliveHandle) {
        window.clearInterval(keepAliveHandle);
      }
      try {
        void channel.untrack();
      } catch (error) {
        console.warn('[AppBootstrap] presence untrack failed', error);
      }
      try {
        void channel.unsubscribe();
      } catch (error) {
        console.warn('[AppBootstrap] presence unsubscribe failed', error);
      }
      window.dispatchEvent(new CustomEvent(APP_PRESENCE_EVENT, { detail: {} }));
    };
  }, [user?.id, user?.email]);

  useEffect(() => {
    let mounted = true;

    const runInit = async (currentUserId: string | null) => {
      try {
        setCurrentTask?.('Checking session...');
        setProgress?.(5);

        setCurrentTask?.('Preparing your account...');
        setProgress?.(15);

        setCurrentTask?.('Loading profile...');
        setProgress?.(30);

        setCurrentTask?.('Loading VibesPro...');
        setProgress?.(50);

        setCurrentTask?.('Loading language...');
        setProgress?.(60);


        setCurrentTask?.('Loading feeds...');
        setProgress?.(70);
        window.dispatchEvent(new CustomEvent('metoyou:refreshFeed'));

        setCurrentTask?.('Loading messages...');
        setProgress?.(80);
        if (currentUserId) {
          try { await getMessageThreads(currentUserId); } catch { /* ignore */ }
        }

        setCurrentTask?.('Loading notifications...');
        setProgress?.(88);
        if (currentUserId) {
          try { await getNotifications(currentUserId); } catch { /* ignore */ }
        }

        setCurrentTask?.('Initializing realtime...');
        setProgress?.(95);
        if (import.meta.env.PROD) {
          if (currentUserId) {
            try { await syncGrantedPushSubscription(currentUserId); } catch { /* ignore */ }
          }
        }
        if (currentUserId) {
          try { subscribeToNotifications(currentUserId, () => {}); } catch { /* ignore */ }
        }

        setCurrentTask?.('Almost ready...');
        setProgress?.(98);

        setProgress?.(100);
        setCurrentTask?.('Done');

        // mark initialized for this user in session
        try { if (currentUserId) sessionStorage.setItem('metoyou:appInitializedUserId', currentUserId); } catch { /* ignore */ }

        if (mounted) setAppReady?.(true);
      } catch (e) {
        console.warn('[AppBootstrap] initialization error', e);
        setCurrentTask?.('Almost ready...');
        setProgress?.(100);
        if (mounted) setAppReady?.(true);
      }
    };

    const initializedUserId = (() => {
      try { return sessionStorage.getItem('metoyou:appInitializedUserId'); } catch { return null; }
    })();

    const currentUserId = user?.id ?? null;

    if (initializedUserId && currentUserId && initializedUserId !== currentUserId) {
      try { sessionStorage.removeItem('metoyou:appInitializedUserId'); } catch { /* ignore */ }
    }

    // If we've already initialized this session for this user, skip initialization
    if (initializedUserId && currentUserId && initializedUserId === currentUserId) {
      setProgress?.(100);
      setCurrentTask?.('Done');
      setAppReady?.(true);
      return () => { mounted = false };
    }

    // If there's no authenticated user, clear any per-user init flag and allow app to render (login flow)
    if (!currentUserId) {
      try { sessionStorage.removeItem('metoyou:appInitializedUserId'); } catch { /* ignore */ }
      setAppReady?.(true);
      return () => { mounted = false };
    }

    // At this point we have a user but haven't initialized for them this session -> run full init (show loader)
    // Reset appReady until init completes
    setAppReady?.(false);
    void runInit(currentUserId);

    return () => { mounted = false };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return <>{children}</>;
}
