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
  const { user } = useAuth();
  const { t } = useLanguage();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [isStoryComposerOpen, setIsStoryComposerOpen] = useState(false);

  useEffect(() => {
    const handleCreatePostVisibility = (event: Event) => {
      setIsCreatePostOpen((event as CustomEvent<boolean>).detail === true);
    };

    window.addEventListener("metoyou:create-post-visibility", handleCreatePostVisibility);
    const handleStoryVisibility = (event: Event) => {
      setIsStoryComposerOpen((event as CustomEvent<boolean>).detail === true);
    };
    window.addEventListener("metoyou:create-story-visibility", handleStoryVisibility);
    return () => {
      window.removeEventListener("metoyou:create-post-visibility", handleCreatePostVisibility);
      window.removeEventListener("metoyou:create-story-visibility", handleStoryVisibility);
    };
  }, []);

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

  if (!appReady || !profileReady) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 bg-linear-to-br from-sky-100 via-white to-cyan-100 border-b border-sky-200/60 h-20 px-2 sm:px-3 pt-[env(safe-area-inset-top)] transition-transform duration-200 ${isCreatePostOpen || isStoryComposerOpen ? "-translate-y-full pointer-events-none" : "translate-y-0"}`}>
      <div className="max-w-3xl mx-auto h-full px-1 sm:px-2">
        <div className="bg-white/20 backdrop-blur-3xl border border-white/30 rounded-[36px] shadow-sm h-full flex items-center justify-between px-5 py-3">

          {/* Logo */}
          <h1 className="text-[1.2rem] font-bold bg-linear-to-r from-sky-600 via-cyan-500 to-blue-600 bg-clip-text text-transparent">
            MeToYou
          </h1>

          {/* Nav */}
          <div className="flex items-center gap-2.5 sm:gap-3">

              <Link
                to="/search"
                className="inline-flex h-12 w-12 items-center justify-center rounded-3xl text-lg text-slate-900 hover:bg-white/30 transition"
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

                <span className="absolute -top-1 -right-1 bg-sky-500 text-white text-[9px] h-4 w-4 rounded-full flex items-center justify-center font-bold">
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
                  <span className="absolute -top-1 -right-1 bg-sky-500 text-white text-[9px] min-h-4 min-w-4 px-1 rounded-full flex items-center justify-center font-bold">
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