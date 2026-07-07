export default function PostSkeleton() {
  return (
    <div className="bg-white/70 backdrop-blur-sm border border-white/40 rounded-[28px] shadow-sm p-5 md:p-7 mb-4 md:rounded-3xl animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-slate-200 animate-pulse" />
          <div className="min-w-0">
            <div className="h-4 bg-slate-200 rounded w-32 mb-1" />
            <div className="h-3 bg-slate-200 rounded w-20" />
          </div>
        </div>
        <div className="w-8 h-8 bg-slate-200 rounded-full" />
      </div>

      <div className="space-y-3">
        <div className="h-48 bg-slate-200 rounded-xl" />
        <div className="h-3 bg-slate-200 rounded w-5/6" />
        <div className="h-3 bg-slate-200 rounded w-2/3" />
      </div>
    </div>
  );
}
