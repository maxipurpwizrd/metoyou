import type { ReactNode } from "react";

const shimmer = "animate-pulse";

function CardShell({ children }: { children: ReactNode }) {
  return (
    <div className={`rounded-2xl border border-white/20 bg-white/80 shadow-sm p-5 md:p-7 transition-opacity duration-300 ${shimmer}`}>
      {children}
    </div>
  );
}

export function FeedSkeleton({ isVibesPro }: { isVibesPro?: boolean }) {
  if (isVibesPro) {
    return (
      <div className="space-y-5">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="rounded-[34px] border border-[#D4AF37]/15 bg-[#111111]/80 shadow-[0_30px_80px_rgba(0,0,0,0.22)] p-6 md:p-7 transition-opacity duration-300"
          >
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full bg-linear-to-br from-[#B08C3D] via-[#E8CF7B] to-[#F9E7A9] ${shimmer}`} />
                <div className="space-y-2">
                  <div className={`h-4 w-36 rounded-full bg-white/10 ${shimmer}`} />
                  <div className={`h-3 w-24 rounded-full bg-white/10 ${shimmer}`} />
                </div>
              </div>
              <div className={`h-3 w-24 rounded-full bg-white/10 ${shimmer}`} />
            </div>

            <div className={`rounded-[30px] border border-white/10 bg-white/5 overflow-hidden mb-4`}>
              <div className={`h-64 bg-linear-to-r from-white/10 via-white/5 to-white/10 ${shimmer}`} />
            </div>

            <div className="space-y-3">
              <div className={`h-3 rounded-full bg-white/10 w-5/6 ${shimmer}`} />
              <div className={`h-3 rounded-full bg-white/10 w-1/2 ${shimmer}`} />
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className={`h-10 rounded-2xl bg-white/10 ${shimmer}`} />
              <div className={`h-10 rounded-2xl bg-white/10 ${shimmer}`} />
              <div className={`h-10 rounded-2xl bg-white/10 ${shimmer}`} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <CardShell key={index}>
          <div className="flex items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full bg-slate-200 ${shimmer}`} />
              <div className="space-y-2">
                <div className={`h-4 w-32 rounded-full bg-slate-200 ${shimmer}`} />
                <div className={`h-3 w-20 rounded-full bg-slate-200 ${shimmer}`} />
              </div>
            </div>
            <div className={`h-3 w-16 rounded-full bg-slate-200 ${shimmer}`} />
          </div>
          <div className="space-y-3">
            <div className={`h-56 rounded-3xl bg-slate-200 ${shimmer}`} />
            <div className={`h-3 rounded-full bg-slate-200 w-5/6 ${shimmer}`} />
            <div className={`h-3 rounded-full bg-slate-200 w-2/3 ${shimmer}`} />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <div className={`h-10 flex-1 min-w-30 rounded-2xl bg-slate-200 ${shimmer}`} />
            <div className={`h-10 w-24 rounded-2xl bg-slate-200 ${shimmer}`} />
            <div className={`h-10 w-24 rounded-2xl bg-slate-200 ${shimmer}`} />
          </div>
        </CardShell>
      ))}
    </div>
  );
}

export function ProfileSkeleton({ isVibesPro }: { isVibesPro?: boolean }) {
  if (isVibesPro) {
    return (
      <div className="app-screen bg-[#0B0B0B] p-3 md:p-6 pt-24 md:pt-32 pb-20 md:pb-24">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <div className="rounded-[34px] border border-[#D4AF37]/20 bg-[#121212]/80 p-6 md:p-8 shadow-[0_30px_80px_rgba(0,0,0,0.24)]">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-4">
                <div className={`h-3 w-40 rounded-full bg-white/10 ${shimmer}`} />
                <div className={`h-3 w-32 rounded-full bg-white/10 ${shimmer}`} />
                <div className={`h-3 w-52 rounded-full bg-white/10 ${shimmer}`} />
              </div>
              <div className={`w-36 h-36 rounded-full bg-linear-to-br from-[#B08C3D] via-[#E8CF7B] to-[#F9E7A9] ${shimmer}`} />
            </div>

            <div className="mt-8 grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className={`h-8 w-24 rounded-full bg-white/10 ${shimmer}`} />
                  <div className="mt-4 space-y-2">
                    <div className={`h-4 rounded-full bg-white/10 w-1/2 ${shimmer}`} />
                    <div className={`h-3 rounded-full bg-white/10 w-1/3 ${shimmer}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[34px] border border-white/10 bg-white/5 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.12)]">
              <div className={`h-5 w-28 rounded-full bg-white/10 ${shimmer}`} />
              <div className="mt-6 space-y-3">
                <div className={`h-3 w-full rounded-full bg-white/10 ${shimmer}`} />
                <div className={`h-3 w-5/6 rounded-full bg-white/10 ${shimmer}`} />
                <div className={`h-3 w-4/6 rounded-full bg-white/10 ${shimmer}`} />
              </div>
            </div>
            <div className="rounded-[34px] border border-white/10 bg-white/5 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.12)]">
              <div className={`h-5 w-24 rounded-full bg-white/10 ${shimmer}`} />
              <div className="mt-6 grid gap-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className={`h-20 rounded-3xl bg-white/10 ${shimmer}`} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-screen bg-linear-to-br from-pink-100 via-purple-100 to-blue-100 p-3 md:p-6 pt-24 md:pt-32 pb-20 md:pb-24">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className={`rounded-[28px] border border-white/30 bg-white/80 p-6 md:p-8 shadow-lg ${shimmer}`}>
          <div className="flex flex-col items-center gap-5 text-center">
            <div className={`h-10 w-36 rounded-full bg-slate-200 ${shimmer}`} />
            <div className={`w-32 h-32 rounded-full bg-slate-200 ${shimmer}`} />
            <div className={`h-5 w-40 rounded-full bg-slate-200 ${shimmer}`} />
            <div className={`h-3 w-56 rounded-full bg-slate-200 ${shimmer}`} />
          </div>

          <div className="mt-8 grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className={`h-24 rounded-3xl bg-slate-200 ${shimmer}`} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className={`h-24 rounded-3xl bg-slate-200 ${shimmer}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function MessagesSkeleton({ isVibesPro, variant = "list" }: { isVibesPro?: boolean; variant?: "list" | "chat" }) {
  const commonCard = "rounded-[28px] p-4 shadow-sm border transition-opacity duration-300";
  if (variant === "chat") {
    return (
      <div className={`space-y-4 ${isVibesPro ? "bg-[#0B0B0B] p-6" : "bg-linear-to-br from-blue-100 via-pink-100 to-purple-100 p-6"}`}>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-start gap-3 animate-pulse" aria-hidden>
              <div className={`w-10 h-10 rounded-full ${isVibesPro ? "bg-white/10" : "bg-slate-200"}`} />
              <div className="flex-1 space-y-3">
                <div className={`h-3 rounded-full ${isVibesPro ? "bg-white/10" : "bg-slate-200"} w-2/5`} />
                <div className={`h-12 rounded-3xl ${isVibesPro ? "bg-white/5" : "bg-slate-200"}`} />
              </div>
            </div>
          ))}
        </div>
        <div className={`rounded-[28px] ${isVibesPro ? "bg-[#181818] border border-[#D4AF37]/20" : "bg-white/30 border border-white/40"} p-4`}> 
          <div className={`h-12 rounded-full ${isVibesPro ? "bg-white/10" : "bg-slate-200"} ${shimmer}`} />
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${isVibesPro ? "bg-[#0B0B0B] p-6" : "bg-linear-to-br from-blue-100 via-pink-100 to-purple-100 p-6"}`}>
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className={`${commonCard} ${isVibesPro ? "border-[#D4AF37]/20 bg-[#181818]" : "border-white/40 bg-white/30"} ${shimmer}`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full ${isVibesPro ? "bg-white/10" : "bg-slate-200"}`} />
            <div className="flex-1 space-y-2">
              <div className={`h-4 rounded-full ${isVibesPro ? "bg-white/10" : "bg-slate-200"} w-3/5`} />
              <div className={`h-3 rounded-full ${isVibesPro ? "bg-white/10" : "bg-slate-200"} w-1/2`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function NotificationsSkeleton({ isVibesPro }: { isVibesPro?: boolean }) {
  return (
    <div className={`space-y-4 ${isVibesPro ? "bg-[#0B0B0B] p-6" : "bg-linear-to-br from-blue-100 via-pink-100 to-purple-100 p-6"}`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className={`rounded-[28px] p-5 shadow-sm ${isVibesPro ? "border border-[#D4AF37]/20 bg-[#181818]" : "border border-white/30 bg-white/30"} ${shimmer}`}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-12 h-12 rounded-2xl ${isVibesPro ? "bg-white/10" : "bg-slate-200"}`} />
            <div className="flex-1 space-y-2">
              <div className={`h-4 rounded-full ${isVibesPro ? "bg-white/10" : "bg-slate-200"} w-32`} />
              <div className={`h-3 rounded-full ${isVibesPro ? "bg-white/10" : "bg-slate-200"} w-1/2`} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className={`h-3 rounded-full ${isVibesPro ? "bg-white/10" : "bg-slate-200"} w-3/4`} />
            <div className={`h-3 rounded-full ${isVibesPro ? "bg-white/10" : "bg-slate-200"} w-16`} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SearchSkeleton({ isVibesPro }: { isVibesPro?: boolean }) {
  const panelClass = isVibesPro ? "border border-[#D4AF37]/20 bg-[#181818]" : "border border-white/30 bg-white/20";

  return (
    <div className={`space-y-6 ${isVibesPro ? "bg-[#0B0B0B] p-6" : "bg-linear-to-br from-blue-100 via-pink-100 to-purple-100 p-6"}`}>
      <div className={`rounded-[28px] p-4 ${panelClass} ${shimmer}`}>
        <div className={`h-12 rounded-full ${isVibesPro ? "bg-white/10" : "bg-slate-200"}`} />
      </div>

      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className={`rounded-[28px] p-4 ${panelClass} ${shimmer}`}>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-[20px] ${isVibesPro ? "bg-white/10" : "bg-slate-200"}`} />
              <div className="flex-1 space-y-2">
                <div className={`h-4 rounded-full ${isVibesPro ? "bg-white/10" : "bg-slate-200"} w-2/5`} />
                <div className={`h-3 rounded-full ${isVibesPro ? "bg-white/10" : "bg-slate-200"} w-1/3`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className={`rounded-[28px] p-4 ${panelClass} ${shimmer}`}>
            <div className={`h-3 rounded-full ${isVibesPro ? "bg-white/10" : "bg-slate-200"} w-2/3`} />
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <div className={`h-16 rounded-3xl ${isVibesPro ? "bg-white/10" : "bg-slate-200"}`} />
              <div className={`h-16 rounded-3xl ${isVibesPro ? "bg-white/10" : "bg-slate-200"}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StoriesSkeleton({ isVibesPro }: { isVibesPro?: boolean }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className={`w-26.5 h-38 md:w-35 md:h-50 shrink-0 rounded-4xl ${isVibesPro ? "border border-[#D4AF37]/20 bg-[#111111]/80" : "border border-white/20 bg-white/80"} ${shimmer}`}
        >
          <div className="h-full rounded-4xl bg-white/5" />
        </div>
      ))}
    </div>
  );
}

export function FollowersSkeleton({ isVibesPro }: { isVibesPro?: boolean }) {
  return (
    <div className={`space-y-3 ${isVibesPro ? "bg-[#0B0B0B] p-3" : "bg-transparent"}`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className={`flex items-center justify-between gap-3 rounded-[28px] p-4 ${isVibesPro ? "border border-[#D4AF37]/20 bg-[#181818]" : "border border-white/30 bg-white/30"} ${shimmer}`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full ${isVibesPro ? "bg-white/10" : "bg-slate-200"}`} />
            <div className="space-y-2">
              <div className={`h-4 w-28 rounded-full ${isVibesPro ? "bg-white/10" : "bg-slate-200"}`} />
              <div className={`h-3 w-20 rounded-full ${isVibesPro ? "bg-white/10" : "bg-slate-200"}`} />
            </div>
          </div>
          <div className={`h-10 w-24 rounded-full ${isVibesPro ? "bg-white/10" : "bg-slate-200"}`} />
        </div>
      ))}
    </div>
  );
}

export function CommentsSkeleton({ isVibesPro }: { isVibesPro?: boolean }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className={`rounded-3xl p-4 ${isVibesPro ? "border border-white/10 bg-white/10" : "border border-slate-200 bg-slate-100"} ${shimmer}`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-full ${isVibesPro ? "bg-white/10" : "bg-slate-200"}`} />
            <div className="space-y-2 flex-1">
              <div className={`h-3 rounded-full ${isVibesPro ? "bg-white/10" : "bg-slate-200"} w-1/2`} />
              <div className={`h-2.5 rounded-full ${isVibesPro ? "bg-white/10" : "bg-slate-200"} w-1/3`} />
            </div>
          </div>
          <div className={`h-3 rounded-full ${isVibesPro ? "bg-white/10" : "bg-slate-200"} w-full mb-2`} />
          <div className={`h-3 rounded-full ${isVibesPro ? "bg-white/10" : "bg-slate-200"} w-5/6`} />
        </div>
      ))}
    </div>
  );
}
