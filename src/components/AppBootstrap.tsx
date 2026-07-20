import React, { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getMessageThreads } from '../lib/messageApi';
import { getNotifications, subscribeToNotifications } from '../lib/notificationApi';
import { useAppInit } from '../contexts/AppInitContext';
import { useSession } from '../contexts/SessionContext';

export default function AppBootstrap({ children }: { children: React.ReactNode }) {
  const { appReady, progress, currentTask, setProgress, setCurrentTask, setAppReady } = useAppInit();
  const { profileReady } = useSession();

  const { user } = useAuth();

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
          try { await getMessageThreads(currentUserId); } catch (e) {}
        }

        setCurrentTask?.('Loading notifications...');
        setProgress?.(88);
        if (currentUserId) {
          try { await getNotifications(currentUserId); } catch (e) {}
        }

        setCurrentTask?.('Initializing realtime...');
        setProgress?.(95);
        if (currentUserId) {
          try { subscribeToNotifications(currentUserId, () => {}); } catch (e) {}
        }

        setCurrentTask?.('Almost ready...');
        setProgress?.(98);

        setProgress?.(100);
        setCurrentTask?.('Done');

        // mark initialized for this user in session
        try { if (currentUserId) sessionStorage.setItem('metoyou:appInitializedUserId', currentUserId); } catch (e) {}

        if (mounted) setAppReady?.(true);
      } catch (e) {
        console.warn('[AppBootstrap] initialization error', e);
        setCurrentTask?.('Almost ready...');
        setProgress?.(100);
        if (mounted) setAppReady?.(true);
      }
    };

    const initializedUserId = (() => {
      try { return sessionStorage.getItem('metoyou:appInitializedUserId'); } catch (e) { return null; }
    })();

    const currentUserId = user?.id ?? null;

    // If we've already initialized this session for this user, skip initialization
    if (initializedUserId && currentUserId && initializedUserId === currentUserId) {
      setProgress?.(100);
      setCurrentTask?.('Done');
      setAppReady?.(true);
      return () => { mounted = false };
    }

    // If there's no authenticated user, clear any per-user init flag and allow app to render (login flow)
    if (!currentUserId) {
      try { sessionStorage.removeItem('metoyou:appInitializedUserId'); } catch (e) {}
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

  if (!appReady || !profileReady) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white">
        <div className="text-center max-w-md p-6">
          <h2 className="text-2xl font-bold mb-4">Preparing your experience…</h2>
          <p className="mb-3">{currentTask}</p>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div style={{ width: `${progress}%` }} className="h-3 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500"></div>
          </div>
          <p className="mt-2 text-sm text-slate-500">{progress}%</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
