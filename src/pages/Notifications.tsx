import Navbar from "../components/Navbar";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import {
  getNotifications,
  markNotificationsRead,
  subscribeToNotifications,
  deleteNotification,
  deleteAllNotifications,
  type Notification,
} from "../lib/notificationApi";
import { useSession } from "../contexts/SessionContext";
import { VibesProFeed } from "../themes/vibespro";
import { NotificationsSkeleton } from "../components/skeletons/Skeletons";
import { useLanguage } from "../contexts/LanguageContext";
import { useAppInit } from "../contexts/AppInitContext";
import { isVibesProEnabled } from "../lib/vibesPro";

function joinActorNames(names: string[]) {
  if (names.length === 0) return "Someone";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} others`;
}

type NotificationItem = Notification & {
  notificationIds: string[];
  count: number;
  actors: string[];
  actorIds: string[];
};

function groupNotifications(notifications: Notification[]): NotificationItem[] {
  const grouped = new Map<string, NotificationItem>();

  for (const notification of notifications) {
    const key = `${notification.type}:${notification.postId ?? ""}:${notification.message}`;
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        ...notification,
        notificationIds: [notification.id],
        count: 1,
        actors: [notification.user],
        actorIds: notification.actorId ? [notification.actorId] : [],
      });
      continue;
    }

    const actors = Array.from(new Set([...existing.actors, notification.user]));
    const actorIds = Array.from(new Set([...existing.actorIds, ...(notification.actorId ? [notification.actorId] : [])]));

    grouped.set(key, {
      ...existing,
      notificationIds: [...existing.notificationIds, notification.id],
      count: existing.count + 1,
      actors,
      actorIds,
      user: joinActorNames(actors),
      avatar: existing.avatar ?? notification.avatar,
      read: existing.read && notification.read,
      timestamp: [existing.timestamp, notification.timestamp].sort((a, b) => Number(a) - Number(b))[1] ?? existing.timestamp,
    });
  }

  return Array.from(grouped.values()).sort((a, b) => {
    const aTime = Date.parse(a.timestamp) || 0;
    const bTime = Date.parse(b.timestamp) || 0;
    return bTime - aTime;
  });
}

type NotificationsProps = {
  embedded?: boolean;
};

export default function Notifications({ embedded }: NotificationsProps) {
  // Prevent rendering until app initialization completes
  const { appReady } = useAppInit();
  const { profileReady } = useSession();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { profile } = useSession();
  const isVibesPro = isVibesProEnabled(profile);
  void embedded;
  const greetingName = (() => {
    const rawFirstName = profile?.firstName?.trim();
    if (rawFirstName) return rawFirstName;

    const rawUsername = profile?.username?.trim();
    if (!rawUsername) return "there";

    const [firstPart] = rawUsername.split(/\s+/);
    return firstPart || "there";
  })();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [confirmDialog, setConfirmDialog] = useState<{
    mode: "single" | "all";
    item?: NotificationItem;
  } | null>(null);
  const mountedRef = useRef(true);
  const notificationsRef = useRef<Notification[]>([]);

  const saveNotificationsCache = (nextNotifications: Notification[], userId: string) => {
    if (typeof window === "undefined") return;
    const cacheKey = `metoyou-notifs:${userId}`;
    const lastKey = `${cacheKey}:lastFetch`;

    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(nextNotifications));
      sessionStorage.setItem(lastKey, String(Date.now()));
    } catch {
      // ignore storage failures
    }
  };

  const updateNotifications = (nextNotifications: Notification[]) => {
    notificationsRef.current = nextNotifications;
    setNotifications(nextNotifications);
  };

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    const scrollKey = `metoyou-notifications-scroll:${userId}`;
    const saved = Number(sessionStorage.getItem(scrollKey) || "0");
    if (saved && typeof window !== "undefined") {
      window.requestAnimationFrame(() => window.scrollTo(0, saved));
    }

    return () => {
      try {
        sessionStorage.setItem(scrollKey, String(window.scrollY || 0));
      } catch {
        // ignore
      }
    };
  }, [user]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const userId = user?.id;
    if (!userId) return;
    const cacheKey = `metoyou-notifs:${userId}`;

    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw) as Notification[];
        window.requestAnimationFrame(() => updateNotifications(cached));
      } else {
        window.requestAnimationFrame(() => setNotificationsLoading(true));
      }
    } catch {
      window.requestAnimationFrame(() => setNotificationsLoading(true));
    }

    const performBackgroundRefresh = async () => {
      try {
        const last = Number(sessionStorage.getItem(`${cacheKey}:lastFetch`) || "0");
        const now = Date.now();
        if (last && now - last < 30_000) return; // throttle

        const remote = await getNotifications(userId);
        if (!mountedRef.current || !remote) return;

        const currentJson = JSON.stringify(notificationsRef.current);
        const remoteJson = JSON.stringify(remote);
        if (currentJson !== remoteJson) {
          updateNotifications(remote);
          saveNotificationsCache(remote, userId);
        }
      } catch (err) {
        console.warn("Failed to refresh notifications", err);
      } finally {
        setNotificationsLoading(false);
      }
    };

    void performBackgroundRefresh();

    const channel = subscribeToNotifications(userId, () => {
      void performBackgroundRefresh();
    });

    void markNotificationsRead(userId)
      .then((success) => {
        if (success) {
          updateNotifications(notificationsRef.current.map((item) => ({ ...item, read: true })));
          saveNotificationsCache(notificationsRef.current, userId);
        }
      })
      .catch(() => {});

    return () => {
      mountedRef.current = false;
      try {
        channel?.unsubscribe();
      } catch {
        // ignore
      }
    };
  }, [user]);

  const getTimeString = (timestamp: string | number) => {
    const parsedTime = typeof timestamp === "number" ? timestamp : Date.parse(timestamp);
    if (!Number.isFinite(parsedTime) || parsedTime <= 0) {
      return t("notifications.justNow");
    }

    const diff = currentTime - parsedTime;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t("notifications.justNow");
    if (minutes < 60) return t("notifications.minutesAgo").replace("{count}", String(minutes));
    if (hours < 24) return t("notifications.hoursAgo").replace("{count}", String(hours));
    if (days === 1) return t("notifications.yesterday");
    return t("notifications.daysAgo").replace("{count}", String(days));
  };

  const handleDeleteNotification = async (notif: NotificationItem) => {
    if (!user || typeof user !== "object" || !("id" in user)) return;
    setConfirmDialog({ mode: "single", item: notif });
  };

  const handleDeleteAllNotifications = async () => {
    if (!user || typeof user !== "object" || !("id" in user)) return;
    setConfirmDialog({ mode: "all" });
  };

  if (!appReady || !profileReady) return null;

  const confirmDelete = async () => {
    if (!user || typeof user !== "object" || !("id" in user) || !confirmDialog) return;
    const userId = user?.id;
    if (!userId) return;

    if (confirmDialog.mode === "all") {
      const success = await deleteAllNotifications(userId);
      if (!success) return;
      updateNotifications([]);
      saveNotificationsCache([], userId);
    } else if (confirmDialog.mode === "single" && confirmDialog.item) {
      const results = await Promise.all(
        confirmDialog.item.notificationIds.map((notificationId) => deleteNotification(userId, notificationId))
      );

      if (results.some((ok) => ok)) {
        const remaining = notifications.filter((item) => !confirmDialog.item!.notificationIds.includes(item.id));
        updateNotifications(remaining);
        saveNotificationsCache(remaining, userId);
      }
    }

    setConfirmDialog(null);
  };

  const cancelDelete = () => setConfirmDialog(null);

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
    <div className={`app-screen ${isVibesPro ? 'bg-[#0B0B0B]' : 'bg-linear-to-br from-sky-100 via-white to-cyan-100'} p-6`}>
      {!isVibesPro && <Navbar />}

      <div className={`max-w-2xl mx-auto ${isVibesPro ? 'pt-8' : 'pt-20'} pb-24`}>
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
              <p className={`text-sm font-semibold uppercase tracking-[0.3em] ${isVibesPro ? 'text-[#D4AF37]' : 'text-sky-600'}`}>
              {t("notifications.activity")}
            </p>
            <h1 className={`text-4xl sm:text-5xl font-black ${isVibesPro ? 'text-white' : 'text-slate-950'}`}>
              {t("notifications.title")}
            </h1>
          </div>
          <button
            type="button"
            onClick={handleDeleteAllNotifications}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
              isVibesPro
                ? 'bg-white/10 text-white border border-white/10 hover:bg-white/15'
                : 'bg-white/90 text-slate-900 border border-slate-200 hover:bg-white'
            }`}
          >
            <Trash2 size={16} />
            {t("notifications.deleteAll")}
          </button>
        </div>

        {notificationsLoading && notifications.length === 0 ? (
          <NotificationsSkeleton isVibesPro={isVibesPro} />
        ) : notifications.length === 0 ? (
          <div className={`rounded-4xl shadow-2xl p-10 text-center ${
            isVibesPro
              ? 'bg-[#181818] border border-[#D4AF37]/20'
              : 'bg-white/20 backdrop-blur-3xl border border-white/30'
          }`}>
            <p className={isVibesPro ? 'text-white/70' : 'text-slate-600'}>
              {t("notifications.empty")}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupNotifications(notifications).map((notif) => (
              <div
                key={notif.notificationIds.join("-")}
                onClick={() => {
                  if (notif.type === "follow" || notif.type === "follow_back") {
                    const primaryActor = notif.actors?.[0] ?? notif.user ?? null;
                    navigate("/profile", {
                      state: {
                        openHommiesList: true,
                        highlightUserId: notif.actorId ?? null,
                        highlightUsername: primaryActor,
                        recentFollowerIds: notif.actorIds ?? [],
                      },
                    });
                    return;
                  }

                  if (notif.postId) {
                    navigate(`/feed?postId=${encodeURIComponent(String(notif.postId))}`);
                  }
                }}
                className={`relative rounded-4xl shadow-2xl px-5 py-5 pb-12 transition-all duration-200 cursor-pointer ${
                  isVibesPro
                    ? `bg-[#181818] border ${
                        !notif.read
                          ? 'border-[#D4AF37] bg-[#181818]'
                          : 'border-[#D4AF37]/20 hover:border-[#D4AF37]/40'
                      }`
                    : `bg-white/20 backdrop-blur-3xl border border-white/30 hover:bg-white/30 ${
                        !notif.read ? 'border-sky-400/50 bg-sky-50/20' : ''
                      }`
                }`}>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleDeleteNotification(notif);
                  }}
                  className={`absolute top-4 right-4 rounded-full p-2 transition ${
                    isVibesPro
                      ? 'bg-white/10 text-white hover:bg-white/15'
                      : 'bg-white/90 text-slate-900 hover:bg-white'
                  }`}
                  aria-label={t("notifications.deleteSingle")}
                >
                  <Trash2 size={14} />
                </button>
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
                        : 'bg-linear-to-r from-sky-400 via-cyan-400 to-blue-500'
                    }`}>
                      {notif.user[0]}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${isVibesPro ? 'text-white' : 'text-slate-900'}`}>
                      Hey {greetingName}
                    </p>
                    <div className="flex items-start gap-2 mt-2">
                      <span className="text-2xl mt-0.5">{getEmoji(notif.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${
                          isVibesPro ? 'text-white' : 'text-slate-900'
                        }`}>
                          <span
                            onClick={() => navigate(`/profile/${notif.user}`)}
                            className={`hover:opacity-80 cursor-pointer ${
                              isVibesPro
                                ? 'text-[#D4AF37]'
                                : 'text-sky-600 hover:text-sky-700'
                            }`}
                          >
                            {notif.user}
                          </span>
                        </p>
                        <p className={`text-sm mt-1 ${isVibesPro ? 'text-white/80' : 'text-slate-700'}`}>
                          {notif.message}
                        </p>
                      </div>
                    </div>
                  </div>

                  {!notif.read && (
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      isVibesPro ? 'bg-[#D4AF37]' : 'bg-sky-500'
                    }`}></div>
                  )}
                </div>

                <div className={`absolute right-5 bottom-4 text-xs ${
                  isVibesPro ? 'text-white/50' : 'text-slate-600'
                }`}>
                  {getTimeString(notif.timestamp)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {confirmDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className={`w-full max-w-md rounded-4xl border ${isVibesPro ? 'border-[#D4AF37]/50 bg-[#111111]' : 'border-white/60 bg-white'} p-6 shadow-2xl`}>
            <p className={`text-xl font-bold ${isVibesPro ? 'text-white' : 'text-slate-950'}`}>
              {confirmDialog.mode === 'all' ? t("notifications.confirmClearAll") : t("notifications.confirmDelete")}
            </p>
            <p className={`mt-3 text-sm ${isVibesPro ? 'text-white/70' : 'text-slate-600'}`}>
              {confirmDialog.mode === 'all'
                ? t("notifications.confirmClearBody")
                : t("notifications.confirmDeleteBody")
                    .replace("{count}", String(confirmDialog.item?.count ?? 1))
                    .replace("{plural}", confirmDialog.item?.count === 1 ? "" : "s")}
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={cancelDelete}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${isVibesPro ? 'border-white/20 bg-white/5 text-white hover:bg-white/10' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'}`}
              >
                {t("notifications.cancel")}
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${isVibesPro ? 'bg-[#D4AF37] text-black hover:bg-[#e0c766]' : 'bg-rose-600 text-white hover:bg-rose-700'}`}
              >
                {confirmDialog.mode === 'all' ? t("notifications.confirmClearYes") : t("notifications.confirmDeleteYes")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
