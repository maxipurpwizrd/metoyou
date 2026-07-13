import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import Feed from "../pages/Feed";
import Messages from "../pages/Messages";
import Notifications from "../pages/Notifications";
import Profile from "../pages/Profile";
import Settings from "../pages/Settings";

type Props = {
  children: ReactNode;
};

export default function DesktopSplitLayout({ children }: Props) {
  const location = useLocation();
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(min-width: 1024px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);

    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  const layout = useMemo(() => {
    const pathname = location.pathname;
    const isProfileView = pathname === "/profile" || pathname.startsWith("/profile/");
    const isSettingsView = pathname === "/settings" || pathname.startsWith("/settings/");
    const isMessagesView = pathname === "/messages" || pathname.startsWith("/messages");

    if (pathname === "/feed" || pathname === "/") {
      return {
        left: <Feed embedded />,
        right: <Profile embedded />,
        mode: "feed-profile" as const,
      };
    }

    if (isProfileView || isSettingsView) {
      return {
        left: <Profile embedded />,
        right: <Settings />,
        mode: "profile-settings" as const,
      };
    }

    if (isMessagesView || pathname === "/notifications") {
      return {
        left: <Messages embedded />,
        right: <Notifications embedded />,
        mode: "messages-notifications" as const,
      };
    }

    return null;
  }, [location.pathname]);

  if (!isDesktop || !layout) {
    return <>{children}</>;
  }

  return (
    <div className="app-screen bg-linear-to-br from-blue-100 via-pink-100 to-purple-100 p-3 lg:p-4 xl:p-6">
      <div className="mx-auto flex h-[calc(100dvh-1.5rem)] max-w-7xl gap-3 lg:gap-4 xl:gap-6">
        <div className="flex-1 min-w-0 overflow-hidden rounded-4xl border border-white/40 bg-white/20 shadow-[0_20px_70px_rgba(15,23,42,0.12)] backdrop-blur-2xl">
          <div className="h-full overflow-y-auto overflow-x-hidden">
            {layout.left}
          </div>
        </div>

        <div className={`min-w-0 overflow-hidden rounded-4xl border border-white/40 bg-white/20 shadow-[0_20px_70px_rgba(15,23,42,0.12)] backdrop-blur-2xl ${layout.mode === "profile-settings" ? "w-[34%] max-w-[34%]" : "flex-1"}`}>
          <div className="h-full overflow-y-auto overflow-x-hidden">
            {layout.right}
          </div>
        </div>
      </div>
    </div>
  );
}
