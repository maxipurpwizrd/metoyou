import Navbar from "../components/Navbar";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getNotifications, markNotificationsRead, subscribeToNotifications, type Notification } from "../lib/notificationApi";
import { getProfile } from "../utils/profileStorage";
import { VibesProFeed } from "../themes/vibespro";

export default function Notifications(_props: { embedded?: boolean } = {}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const profile = getProfile();
  const isVibesPro = profile?.is_vibes_pro === true;
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const mountedRef = useRef(true);

  // Restore/save scroll position for notifications per user
  useEffect(() => {
    const userId = (user as any)?.id;
    if (!userId) return;
    const scrollKey = `metoyou-notifications-scroll:${userId}`;
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

  useEffect(() => {
    mountedRef.current = true;
    if (!user || typeof user !== "object" || !("id" in user)) return;
    const userId = (user as any).id as string;

    const cacheKey = `metoyou-notifs:${userId}`;
    const lastKey = `${cacheKey}:lastFetch`;

    // Try cache-first
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw) as Notification[];
        setNotifications(cached);
      }
    } catch (e) {
      // ignore parse errors
    }

    const performBackgroundRefresh = async () => {
      try {
        const last = Number(sessionStorage.getItem(lastKey) || "0");
        const now = Date.now();
        if (last && now - last < 30_000) return; // throttle

        const remote = await getNotifications(userId);
        if (!mountedRef.current || !remote) return;

        // Merge remote notifications into current, updating only changed items
        const byId = new Map<string | number, Notification>();
        notifications.forEach((n) => byId.set(n.id, n));

        let changed = false;
        remote.forEach((r) => {
          const existing = byId.get(r.id);
          if (!existing) {
            byId.set(r.id, r);
            changed = true;
            return;
          }
          if (existing.read !== r.read || existing.message !== r.message || existing.timestamp !== r.timestamp) {
            byId.set(r.id, r);
            changed = true;
          }
        });

        if (changed || !sessionStorage.getItem(cacheKey)) {
          const merged = Array.from(byId.values()).sort((a, b) => {
            const aTime = a.timestamp ? Number(a.timestamp) : 0;
            const bTime = b.timestamp ? Number(b.timestamp) : 0;
            return bTime - aTime;
          });
          setNotifications(merged);
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(merged));
            sessionStorage.setItem(lastKey, String(Date.now()));
          } catch (e) {
            // ignore storage failures
          }
        }
      } catch (err) {
        console.warn("Failed to refresh notifications", err);
      }
    };

    // Initial background refresh if needed
    void performBackgroundRefresh();

    // Realtime subscription: merge incoming events into cache/state
    const channel = subscribeToNotifications(userId, () => {
      void performBackgroundRefresh();
    });

    // mark read once (non-blocking)
    void markNotificationsRead(userId).catch(() => {});

    return () => {
      mountedRef.current = false;
      try {
        channel?.unsubscribe();
      } catch (e) {}
    };
  }, [user]);

  const getTimeString = (timestamp: string | number) => {
    const numericTimestamp = typeof timestamp === "string" ? Number(timestamp) : timestamp;
    if (!Number.isFinite(numericTimestamp)) return "just now";

    const diff = Date.now() - numericTimestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getEmoji = (type: string) => {
    switch (type) {
      case "like":
        return "❤️";
      case "comment":
        return "💬";
      case "view":
        return "👀";
      case "follow":
        return "👤";
      case "follow_back":
        return "🤝";
      default:
        return "📢";
    }
  };

  const notificationContent = (
    <div className={`app-screen ${isVibesPro ? 'bg-[#0B0B0B]' : 'bg-linear-to-br from-blue-100 via-pink-100 to-purple-100'} p-6`}>
      {!isVibesPro && <Navbar />}

      <div className={`max-w-2xl mx-auto ${isVibesPro ? 'pt-8' : 'pt-20'} pb-24`}>
        <h1 className={`text-4xl sm:text-5xl font-black mb-8 ${
          isVibesPro ? 'text-white' : 'text-slate-950'
        }`}>
          Notifications
        </h1>

        {notifications.length === 0 ? (
          <div className={`rounded-4xl shadow-2xl p-10 text-center ${
            isVibesPro
              ? 'bg-[#181818] border border-[#D4AF37]/20'
              : 'bg-white/20 backdrop-blur-3xl border border-white/30'
          }`}>
            <p className={isVibesPro ? 'text-white/70' : 'text-slate-600'}>
              No notifications yet
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => {
                  if (notif.postId) {
                    navigate(`/feed`);
                  }
                }}
                className={`rounded-4xl shadow-2xl px-5 py-4 transition-all duration-200 cursor-pointer ${
                  isVibesPro
                    ? `bg-[#181818] border ${
                        !notif.read
                          ? 'border-[#D4AF37] bg-[#181818]'
                          : 'border-[#D4AF37]/20 hover:border-[#D4AF37]/40'
                      }`
                    : `bg-white/20 backdrop-blur-3xl border border-white/30 hover:bg-white/30 ${
                        !notif.read ? 'border-pink-400/50 bg-pink-50/20' : ''
                      }`
                }`}
              >
                <div className="flex items-center gap-3">
                  {notif.avatar ? (
                    <img
                      src={notif.avatar}
                      alt={notif.user}
                      className={`w-11 h-11 rounded-2xl object-cover shrink-0 ${
                        isVibesPro ? 'ring-2 ring-[#D4AF37]/30' : ''
                      }`}
                    />
                  ) : (
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-sm shrink-0 ${
                      isVibesPro
                        ? 'bg-linear-to-r from-[#D4AF37] to-[#F0C75E]'
                        : 'bg-linear-to-r from-pink-400 via-purple-400 to-blue-400'
                    }`}>
                      {notif.user[0]}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{getEmoji(notif.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${
                          isVibesPro ? 'text-white' : 'text-slate-900'
                        }`}>
                          <span
                            onClick={() =>
                              navigate(`/profile/${notif.user}`)
                            }
                            className={`hover:opacity-80 cursor-pointer ${
                              isVibesPro
                                ? 'text-[#D4AF37]'
                                : 'text-pink-600 hover:text-pink-700'
                            }`}
                          >
                            {notif.user}
                          </span>
                          <span className={isVibesPro ? 'text-white/80' : 'text-slate-700'}>
                            {" "}{notif.message}
                          </span>
                        </p>
                      </div>
                    </div>

                    <p className={`text-xs mt-2 ${
                      isVibesPro ? 'text-white/50' : 'text-slate-600'
                    }`}>
                      {getTimeString(notif.timestamp)}
                    </p>
                  </div>

                  {!notif.read && (
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      isVibesPro ? 'bg-[#D4AF37]' : 'bg-pink-500'
                    }`}></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (isVibesPro) {
    return (
      <VibesProFeed>
        {notificationContent}
      </VibesProFeed>
    );
  }

  return notificationContent;
}
