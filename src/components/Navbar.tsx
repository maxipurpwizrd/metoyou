import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useLanguage } from "../contexts/LanguageContext";
import { getUnreadNotificationCount, subscribeToNotifications } from "../lib/notificationApi";
import { useAppInit } from "../contexts/AppInitContext";
import { useSession } from "../contexts/SessionContext";

export default function Navbar() {
  const { appReady } = useAppInit();
  const { profileReady } = useSession();
  if (!appReady || !profileReady) return null;
  const { user } = useAuth();
  const { t } = useLanguage();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user || typeof user !== "object" || !("id" in user)) return;
    const userId = (user as any).id as string;

    let channel: ReturnType<typeof subscribeToNotifications> | undefined;

    const refreshUnread = () => {
      void getUnreadNotificationCount(userId).then((count) => setUnreadCount(count));
    };

    refreshUnread();
    channel = subscribeToNotifications(userId, refreshUnread);

    return () => {
      channel?.unsubscribe();
    };
  }, [user]);
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-linear-to-br from-blue-100 via-pink-100 to-purple-100 border-b border-white/30 h-20 px-2 sm:px-3 pt-[env(safe-area-inset-top)]">
      <div className="max-w-3xl mx-auto h-full px-1 sm:px-2">
        <div className="bg-white/20 backdrop-blur-3xl border border-white/30 rounded-[36px] shadow-sm h-full flex items-center justify-between px-5 py-3">

          {/* Logo */}
          <h1 className="text-[1.2rem] font-bold bg-linear-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
            MeToYou
          </h1>

          {/* Nav */}
          <div className="flex items-center gap-2.5 sm:gap-3">

              <Link
                to="/search"
                className="inline-flex h-12 w-12 items-center justify-center rounded-[24px] text-lg text-slate-900 hover:bg-white/30 transition"
              >
                <span aria-hidden>🔍</span>
                <span className="sr-only">{t("nav.search")}</span>
              </Link>

              <Link
                to="/feed"
                onClick={() => window.dispatchEvent(new CustomEvent('metoyou:refreshFeed'))}
                className="inline-flex h-12 w-12 items-center justify-center rounded-3xl text-lg text-slate-900 hover:bg-white/30 transition"
              >
                <span aria-hidden>🏠</span>
                <span className="sr-only">{t("nav.home")}</span>
              </Link>

              <Link
                to="/profile"
                className="inline-flex h-12 w-12 items-center justify-center rounded-3xl text-lg text-slate-900 hover:bg-white/30 transition"
              >
                <span aria-hidden>👤</span>
                <span className="sr-only">{t("nav.profile")}</span>
              </Link>

              <Link
                to="/messages"
                className="relative inline-flex h-12 w-12 items-center justify-center rounded-3xl text-lg text-slate-900 hover:bg-white/30 transition"
              >
                <span aria-hidden>💬</span>
                <span className="sr-only">{t("nav.messages")}</span>

                <span className="absolute -top-1 -right-1 bg-pink-500 text-white text-[9px] h-4 w-4 rounded-full flex items-center justify-center font-bold">
                  3
                </span>
              </Link>

              <Link
                to="/notifications"
                className="relative inline-flex h-12 w-12 items-center justify-center rounded-3xl text-lg text-slate-900 hover:bg-white/30 transition"
              >
                <span aria-hidden>🔔</span>
                <span className="sr-only">{t("nav.notifications")}</span>

                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-pink-500 text-white text-[9px] min-h-4 min-w-4 px-1 rounded-full flex items-center justify-center font-bold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>

            </div>

        </div>
      </div>
    </div>
  );
}