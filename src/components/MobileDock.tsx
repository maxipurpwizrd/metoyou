import { Link, useLocation } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";

export default function MobileDock() {
  const location = useLocation();
  const { t } = useLanguage();

  const navItems = [
    { path: "/feed", icon: "🏠", label: t("nav.home") },
    { path: "/messages", icon: "💬", label: t("nav.messages") },
    { path: "/chat", icon: "🔥", label: "Chat" },
    { path: "/profile", icon: "👤", label: t("nav.profile") },
  ];

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-white/20 backdrop-blur-3xl border border-white/30 rounded-full px-4 py-3 shadow-2xl flex gap-4">

        {navItems.map((item) => {
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                w-12 h-12
                rounded-full
                flex items-center justify-center
                text-2xl
                transition-all duration-300
                ${
                  isActive
                    ? "bg-white/30 scale-110 shadow-lg"
                    : "hover:scale-105"
                }
              `}
            >
              <span aria-hidden>{item.icon}</span>
              <span className="sr-only">{item.label}</span>
            </Link>
          );
        })}

      </div>
    </div>
  );
}