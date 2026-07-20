import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ProfileProvider } from './contexts/ProfileContext';
import { FeedProvider } from "./contexts/FeedContext";
import { AuthProvider } from "./hooks/useAuth";
import { AppInitProvider } from './contexts/AppInitContext';
import { SessionProvider } from './contexts/SessionContext';
import AppBootstrap from './components/AppBootstrap';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { Analytics } from '@vercel/analytics/react'


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
      <LanguageProvider>
        <SessionProvider>
        <FeedProvider>
        <AppInitProvider>
          <AppBootstrap>
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
          </AppBootstrap>
        </AppInitProvider>
        </FeedProvider>
        </SessionProvider>
      </LanguageProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
);

  