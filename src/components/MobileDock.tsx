import { Link, useLocation } from "react-router-dom";

export default function MobileDock() {
  const location = useLocation();

  const navItems = [
    { path: "/feed", icon: "🏠" },
    { path: "/messages", icon: "💬" },
    { path: "/chat", icon: "🔥" },
    { path: "/profile", icon: "👤" },
  ];

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-white/40 backdrop-blur-3xl border border-white/50 rounded-full px-4 py-3 shadow-2xl flex gap-4">

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
                    ? "bg-white/60 scale-110 shadow-lg"
                    : "hover:scale-105"
                }
              `}
            >
              {item.icon}
            </Link>
          );
        })}

      </div>
    </div>
  );
}