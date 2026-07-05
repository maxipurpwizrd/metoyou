type Props = {
  name: string;
  message?: string | null;
  time?: string | null;
  unread?: boolean;
};

export default function MessageCard({
  name,
  message,
  time,
  unread = false,
}: Props) {
  return (
    <div className={`rounded-[28px] border px-4 py-3 shadow-sm transition cursor-pointer backdrop-blur-3xl ${unread ? "bg-white/35 border-white/50 shadow-lg shadow-fuchsia-200/20" : "bg-white/20 border-white/30 hover:bg-white/30"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid place-items-center w-11 h-11 rounded-[20px] bg-linear-to-r from-pink-500 via-purple-500 to-blue-500 text-white font-bold text-sm shrink-0 shadow-md">
            {name.charAt(0)}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className={`font-semibold text-sm truncate ${unread ? "text-slate-950" : "text-slate-900"}`}>
                {name}
              </h3>
              {unread ? (
                <span className="rounded-full bg-fuchsia-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
                  new
                </span>
              ) : null}
            </div>

            <p className={`text-xs truncate mt-1 ${unread ? "text-slate-700" : "text-slate-600"}`}>
              {message || "Start a conversation"}
            </p>
          </div>
        </div>

        <div className="text-right flex flex-col items-end gap-2">
          <p className={`text-[10px] whitespace-nowrap ${unread ? "text-slate-800 font-semibold" : "text-slate-500"}`}>
            {time}
          </p>

          <div className={`h-2.5 w-2.5 rounded-full ${unread ? "bg-fuchsia-500" : "bg-emerald-500"}`} />
        </div>
      </div>
    </div>
  );
}