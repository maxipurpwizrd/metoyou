import type { ReactNode } from "react";
import { useProfile } from "../contexts/ProfileContext";

type RequireVibesProProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

export default function RequireVibesPro({ children, fallback }: RequireVibesProProps) {
  const { profile } = useProfile();
  const isVibesPro = Boolean(profile?.vibes_pro || profile?.is_vibes_pro);

  if (isVibesPro) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-amber-300/40 bg-slate-950/90 p-5 text-white shadow-xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,215,0,0.16),transparent_45%)]" />
      <div className="relative flex flex-col gap-3">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-300/40 bg-amber-400/10 px-3 py-1 text-sm font-semibold text-amber-200">
          <span>🔒</span>
          VibesPro Feature
        </div>
        <p className="text-sm leading-6 text-white/80">Upgrade to unlock.</p>
      </div>
    </div>
  );
}
