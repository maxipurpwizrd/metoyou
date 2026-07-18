import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ProfileProvider, setGlobalProfile } from './contexts/ProfileContext';
import { FeedProvider } from "./contexts/FeedContext";
import { AuthProvider } from "./hooks/useAuth";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { Analytics } from '@vercel/analytics/react'
import { fetchProfileFromSupabase } from './lib/profileApi';
import { saveProfile } from './utils/profileStorage';

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
      <LanguageProvider>
        <FeedProvider>
        <StartupSync />
        <ProfileProvider>
          <div className="relative app-screen overflow-hidden">

          {/* Background Blob 1 */}
          <div className="fixed top-0 left-0 w-96 h-96 bg-pink-400/30 blur-[120px] rounded-full animate-pulse pointer-events-none"></div>

          {/* Background Blob 2 */}
          <div className="fixed bottom-0 right-0 w-96 h-96 bg-purple-500/30 blur-[120px] rounded-full animate-pulse pointer-events-none"></div>

          {/* Background Blob 3 */}
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-400/20 blur-[150px] rounded-full pointer-events-none"></div>

          <App />
          <Analytics />
          </div>
        </ProfileProvider>
        </FeedProvider>
      </LanguageProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
);

  function StartupSync() {
    useEffect(() => {
      let mounted = true;
      (async () => {
        try {
          const serverProfile = await fetchProfileFromSupabase();
          if (!mounted) return;
          if (serverProfile) {
            console.log('[startup] fetched profile from server', { id: serverProfile.id, is_vibes_pro: serverProfile.is_vibes_pro });
            // Save authoritative server profile to localStorage so entitlements are reconciled
            saveProfile(serverProfile);
            // apply any server-driven theme if present
            if (serverProfile.is_vibes_pro) {
              document.documentElement.dataset.theme = 'vibespro';
            }
            // update global profile context so components re-render without reload
            try { setGlobalProfile(serverProfile); } catch {}
          }
        } catch (e) {
          console.warn('[startup] failed to fetch profile from supabase', e);
        }
      })();

      return () => { mounted = false };
    }, []);

    return null;
  }