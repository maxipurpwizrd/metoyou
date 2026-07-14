import { Link } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import MessageCard from "../components/MessageCard";
import { useAuth } from "../hooks/useAuth";
import { getMessageThreads, type MessageThread } from "../lib/messageApi";
import { getProfile } from "../utils/profileStorage";
import { VibesProFeed } from "../themes/vibespro";

export default function Messages(_props: { embedded?: boolean } = {}) {
  const { user } = useAuth();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const mountedRef = useRef(true);
  const profile = getProfile();
  const isVibesPro = profile?.is_vibes_pro === true;

  // Restore/save scroll position for messages list per user
  useEffect(() => {
    const userId = (user as any)?.id;
    if (!userId) return;
    const scrollKey = `metoyou-messages-scroll:${userId}`;
    const saved = Number(sessionStorage.getItem(scrollKey) || "0");
    if (saved && typeof window !== "undefined") {
      window.requestAnimationFrame(() => window.scrollTo(0, saved));
    }

    return () => {
      try {
        sessionStorage.setItem(scrollKey, String(window.scrollY || 0));
      } catch (e) {
        // ignore
      }
    };
  }, [user]);

  // Cache-first load of message threads + silent background refresh
  useEffect(() => {
    mountedRef.current = true;
    const userId = (user as any)?.id as string | undefined;
    if (!userId) return;

    const cacheKey = `metoyou-threads:${userId}`;
    const lastKey = `${cacheKey}:lastFetch`;

    // Try cache first
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw) as MessageThread[];
        const sorted = [...cached].sort((a, b) => {
          const aTime = a.lastTime ? new Date(a.lastTime).getTime() : 0;
          const bTime = b.lastTime ? new Date(b.lastTime).getTime() : 0;
          return bTime - aTime;
        });
        setThreads(sorted);
      }
    } catch (e) {
      // ignore parse errors
    }

    // If no cached data, show loading until first remote arrives
    const hasCache = Boolean(sessionStorage.getItem(cacheKey));
    if (!hasCache) setIsLoading(true);

    void (async () => {
      try {
        const last = Number(sessionStorage.getItem(lastKey) || "0");
        const now = Date.now();
        if (last && now - last < 30_000) return; // throttle background refresh

        const remote = await getMessageThreads(userId);
        if (!mountedRef.current || !remote) return;

        setThreads((prevThreads) => {
          const byId = new Map<string, MessageThread>();
          prevThreads.forEach((t) => byId.set(t.otherId, t));

          let changed = false;
          remote.forEach((r) => {
            const existing = byId.get(r.otherId);
            if (!existing) {
              byId.set(r.otherId, r);
              changed = true;
              return;
            }

            const existingTime = existing.lastTime ? new Date(existing.lastTime).getTime() : 0;
            const remoteTime = r.lastTime ? new Date(r.lastTime).getTime() : 0;
            if (remoteTime !== existingTime || r.lastText !== existing.lastText) {
              byId.set(r.otherId, r);
              changed = true;
            }
          });

          if (!changed && hasCache) {
            return prevThreads;
          }

          const merged = Array.from(byId.values()).sort((a, b) => {
            const aTime = a.lastTime ? new Date(a.lastTime).getTime() : 0;
            const bTime = b.lastTime ? new Date(b.lastTime).getTime() : 0;
            return bTime - aTime;
          });

          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(merged));
            sessionStorage.setItem(lastKey, String(Date.now()));
          } catch (e) {
            // ignore storage errors
          }

          return merged;
        });
      } catch (err) {
        console.warn("Failed to refresh message threads", err);
      } finally {
        setIsLoading(false);
      }
    })();

    return () => {
      mountedRef.current = false;
    };
  }, [user]);

  const messagesContent = (
    <div className={`app-screen ${isVibesPro ? 'bg-[#0B0B0B]' : 'bg-linear-to-br from-pink-100 via-purple-100 to-blue-100'} p-6 pb-24`}>
      {!isVibesPro && (
        <div className="max-w-xl mx-auto">
          {/* Header for free tier */}
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Link
                to="/feed"
                className="text-slate-900 bg-white/80 shadow-sm rounded-full p-2 hover:bg-white transition"
                aria-label="Go back"
              >
                ←
              </Link>
              <h1 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-linear-to-r from-fuchsia-500 via-cyan-300 to-amber-300 shadow-[0_0_30px_rgba(255,255,255,0.35)]">
                MeToYou 💎✨
              </h1>
            </div>

            <p className="text-slate-900 text-base sm:text-lg mt-3 leading-7">
              Rainbow iced, diamond chain energy — chat flex hard.
            </p>

            <div className="mt-3 inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-700 justify-center">
              <span className="inline-block px-3 py-1 rounded-full bg-linear-to-r from-fuchsia-500 via-cyan-300 to-amber-300 text-white shadow-lg shadow-fuchsia-200/40">
                Diamond drip
              </span>
              <span className="inline-block px-3 py-1 rounded-full bg-white/90 text-slate-900 border border-slate-200 backdrop-blur-sm shadow-sm">
                Ice cold
              </span>
            </div>
          </div>
        </div>
      )}

      <div className={`max-w-xl mx-auto ${isVibesPro ? 'pt-8' : ''}`}>
        {isVibesPro && (
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-8">Messages</h1>
        )}

        {/* Search Bar */}
        <div className={`rounded-4xl p-4 shadow-2xl mb-6 ${
          isVibesPro
            ? 'bg-[#181818] border border-[#D4AF37]/30'
            : 'bg-white/20 backdrop-blur-3xl border border-white/30'
        }`}>
          <input
            type="text"
            placeholder="Search conversations..."
            className={`w-full outline-none bg-transparent ${
              isVibesPro ? 'text-white placeholder-white/50' : 'text-slate-900 placeholder-slate-700'
            }`}
            disabled
          />
        </div>

        {/* Message List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className={`rounded-[28px] p-6 text-center shadow-sm ${
              isVibesPro
                ? 'bg-[#181818] border border-[#D4AF37]/20 text-white/70'
                : 'bg-white/30 backdrop-blur-3xl border border-white/40 text-slate-700'
            }`}>
              Loading conversations...
            </div>
          ) : threads.length === 0 ? (
            <div className={`rounded-[28px] p-6 text-center shadow-sm ${
              isVibesPro
                ? 'bg-[#181818] border border-[#D4AF37]/20 text-white/70'
                : 'bg-white/30 backdrop-blur-3xl border border-white/40 text-slate-700'
            }`}>
              No conversations yet. Start messaging someone from a profile.
            </div>
          ) : (
            threads.map((thread) => (
              <Link
                key={thread.otherId}
                to={`/chat?recipient=${thread.otherId}&username=${encodeURIComponent(thread.otherUsername)}`}
                className={`block rounded-4xl transition-all duration-200 ${
                  isVibesPro
                    ? 'hover:bg-[#1a1a1a] border border-[#D4AF37]/20 hover:border-[#D4AF37]/40 bg-[#181818]'
                    : 'hover:bg-white/30'
                }`}
              >
                <div className={`p-4 ${
                  isVibesPro
                    ? 'text-white'
                    : 'text-slate-900'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                      isVibesPro
                        ? 'bg-linear-to-r from-[#D4AF37] to-[#F0C75E]'
                        : 'bg-linear-to-r from-pink-400 via-purple-400 to-blue-400'
                    }`}>
                      {thread.otherUsername[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold truncate ${
                        isVibesPro ? 'text-white' : 'text-slate-900'
                      }`}>
                        {thread.otherUsername}
                      </p>
                      <p className={`text-sm truncate ${
                        isVibesPro ? 'text-white/60' : 'text-slate-600'
                      }`}>
                        {thread.lastText || "No messages yet"}
                      </p>
                    </div>
                    {thread.lastTime && (
                      <p className={`text-xs whitespace-nowrap ${
                        isVibesPro ? 'text-white/40' : 'text-slate-500'
                      }`}>
                        {new Date(thread.lastTime).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );

  if (isVibesPro) {
    return (
      <VibesProFeed>
        {messagesContent}
      </VibesProFeed>
    );
  }

  return messagesContent;
}