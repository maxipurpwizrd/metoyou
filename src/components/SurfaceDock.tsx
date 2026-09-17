import { useEffect, useRef, useState } from "react";
import { Home, Image, Music2, Video } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const SURFACES = [
  { path: "/feed", label: "Feed", Icon: Home },
  { path: "/clips", label: "Clips", Icon: Video },
  { path: "/flicks", label: "Flicks", Icon: Image },
  { path: "/tracks", label: "Tracks", Icon: Music2 },
];

export default function SurfaceDock() {
  const location = useLocation();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(true);
  const stopTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const clearTimers = () => {
      if (stopTimerRef.current !== null) window.clearTimeout(stopTimerRef.current);
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
      stopTimerRef.current = null;
      hideTimerRef.current = null;
    };

    const showThenHide = () => {
      setVisible(true);
      hideTimerRef.current = window.setTimeout(() => setVisible(false), 6000);
    };

    const handleScroll = () => {
      clearTimers();
      setVisible(false);
      stopTimerRef.current = window.setTimeout(showThenHide, 180);
    };

    if (location.pathname === "/tracks") {
      setVisible(true);
      return clearTimers;
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    showThenHide();

    return () => {
      clearTimers();
      window.removeEventListener("scroll", handleScroll);
    };
  }, [location.pathname]);

  return (
    <nav
      aria-label="Vibe surfaces"
      className={`fixed bottom-4 left-1/2 z-60 -translate-x-1/2 transition-all duration-300 ${visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-8 opacity-0"}`}
    >
      <div className="flex items-center gap-2 rounded-full border border-white/35 bg-slate-950/75 p-2 shadow-2xl shadow-slate-950/25 backdrop-blur-2xl">
        {SURFACES.map(({ path, label, Icon }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              type="button"
              onClick={() => navigate(path, { replace: true })}
              aria-label={label}
              title={label}
              className={`grid h-11 w-11 place-items-center rounded-full transition ${active ? "bg-white text-slate-950 shadow-lg" : "text-white/75 hover:bg-white/15 hover:text-white"}`}
            >
              <Icon className="h-5 w-5" />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
