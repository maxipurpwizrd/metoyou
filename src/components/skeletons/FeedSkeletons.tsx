const shimmer = "animate-pulse";

export function FreeFeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <article
          key={index}
          className="rounded-[28px] border border-white/30 bg-white/80 shadow-sm p-5 md:p-7 transition-opacity duration-500"
        >
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
        </article>
      ))}
    </div>
  );
}

export function VibesProFeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-5">
      {Array.from({ length: count }).map((_, index) => (
        <article
          key={index}
          className="rounded-[34px] border border-[#D4AF37]/15 bg-[#111111]/80 shadow-[0_30px_80px_rgba(0,0,0,0.22)] p-6 md:p-7 transition-opacity duration-500"
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

          <div className="rounded-[30px] border border-white/10 bg-white/5 overflow-hidden mb-4">
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
        </article>
      ))}
    </div>
  );
}
