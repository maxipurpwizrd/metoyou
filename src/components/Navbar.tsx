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
  const [isPostOpen, setIsPostOpen] = useState(false);

  useEffect(() => {
    const handleCreatePostVisibility = (event: Event) => {
      setIsCreatePostOpen((event as CustomEvent<boolean>).detail === true);
    };

    const handleFeedPostVisibility = (event: Event) => {
      setIsPostOpen((event as CustomEvent<boolean>).detail === true);
    };

    window.addEventListener("metoyou:create-post-visibility", handleCreatePostVisibility);
    const handleStoryVisibility = (event: Event) => {
      setIsStoryComposerOpen((event as CustomEvent<boolean>).detail === true);
    };
    window.addEventListener("metoyou:create-story-visibility", handleStoryVisibility);
    window.addEventListener("metoyou:feed-post-visibility", handleFeedPostVisibility);
    return () => {
      window.removeEventListener("metoyou:create-post-visibility", handleCreatePostVisibility);
      window.removeEventListener("metoyou:create-story-visibility", handleStoryVisibility);
      window.removeEventListener("metoyou:feed-post-visibility", handleFeedPostVisibility);
    };
  }, []);

  useEffect(() => {
    if (!user || typeof user !== "object" || !("id" in user)) return;
    const userId = typeof user.id === "string" ? user.id : null;
    if (!userId) return;

    const refreshUnread = () => {
      void getUnreadNotificationCount(userId).then((count) => setUnreadCount(count));
    };

    refreshUnread();
    const channel = subscribeToNotifications(userId, refreshUnread);

    return () => {
      channel?.unsubscribe();
    };
  }, [user]);

  if (!appReady || !profileReady) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 border-b border-sky-200/60 bg-linear-to-br from-sky-100 via-white to-cyan-100 px-2 pt-[max(env(safe-area-inset-top),0px)] transition-transform duration-250 sm:px-3 ${isCreatePostOpen || isStoryComposerOpen || isPostOpen ? "-translate-y-full pointer-events-none" : "translate-y-0"}`}>
      <div className="mx-auto h-20 max-w-3xl px-1 sm:h-22 sm:px-2">
        <div className="flex h-full items-center justify-between gap-2 rounded-[28px] border border-white/30 bg-white/20 px-3 py-2 shadow-sm backdrop-blur-3xl sm:gap-3 sm:rounded-[36px] sm:px-5 sm:py-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[clamp(1.25rem,4vw,1.6rem)] font-bold bg-linear-to-r from-sky-600 via-cyan-500 to-blue-600 bg-clip-text text-transparent">
              MeToYou
            </h1>
          </div>

          <div className="flex min-w-0 max-w-full items-center justify-end gap-1.5 sm:gap-2.5">
            <Link
              to="/search"
              className="inline-flex h-[2.85rem] w-[2.85rem] items-center justify-center rounded-2xl text-base text-slate-900 transition hover:bg-white/30 sm:h-[3.25rem] sm:w-[3.25rem] sm:rounded-3xl sm:text-lg"
            >
              <span aria-hidden>🔍</span>
              <span className="sr-only">{t("nav.search")}</span>
            </Link>

            <Link
              to="/feed"
              onClick={() => window.dispatchEvent(new CustomEvent('metoyou:refreshFeed'))}
              className="inline-flex h-[2.85rem] w-[2.85rem] items-center justify-center rounded-2xl text-base text-slate-900 transition hover:bg-white/30 sm:h-[3.25rem] sm:w-[3.25rem] sm:rounded-3xl sm:text-lg"
            >
              <span aria-hidden>🏠</span>
              <span className="sr-only">{t("nav.home")}</span>
            </Link>

            <Link
              to="/profile"
              className="inline-flex h-[2.85rem] w-[2.85rem] items-center justify-center rounded-2xl text-base text-slate-900 transition hover:bg-white/30 sm:h-[3.25rem] sm:w-[3.25rem] sm:rounded-3xl sm:text-lg"
            >
              <span aria-hidden>👤</span>
              <span className="sr-only">{t("nav.profile")}</span>
            </Link>

            <Link
              to="/messages"
              className="relative inline-flex h-[2.85rem] w-[2.85rem] items-center justify-center rounded-2xl text-base text-slate-900 transition hover:bg-white/30 sm:h-[3.25rem] sm:w-[3.25rem] sm:rounded-3xl sm:text-lg"
            >
              <span aria-hidden>💬</span>
              <span className="sr-only">{t("nav.messages")}</span>
            </Link>

            <Link
              to="/notifications"
              className="relative inline-flex h-[2.85rem] w-[2.85rem] items-center justify-center rounded-2xl text-base text-slate-900 transition hover:bg-white/30 sm:h-[3.25rem] sm:w-[3.25rem] sm:rounded-3xl sm:text-lg"
            >
              <span aria-hidden>🔔</span>
              <span className="sr-only">{t("nav.notifications")}</span>

              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-[9px] font-bold text-white">
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