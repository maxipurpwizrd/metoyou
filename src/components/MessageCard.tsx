type Props = {
  name: string;
  message: string;
  time: string;
};

export default function MessageCard({
  name,
  message,
  time,
}: Props) {
  return (
    <div className="bg-white/20 backdrop-blur-3xl border border-white/30 rounded-[28px] px-4 py-3 shadow-sm hover:bg-white/30 transition cursor-pointer">

      <div className="flex items-center justify-between gap-3">

        <div className="flex items-center gap-3 min-w-0">

          {/* Avatar */}
          <div className="grid place-items-center w-10 h-10 rounded-[20px] bg-linear-to-r from-pink-500 via-purple-500 to-blue-500 text-white font-bold text-sm shrink-0">
            {name.charAt(0)}
          </div>

          {/* User Info */}
          <div className="min-w-0">
            <h3 className="font-semibold text-sm text-slate-900 truncate">
              {name}
            </h3>

            <p className="text-xs text-slate-600 truncate mt-1">
              {message}
            </p>
          </div>

        </div>

        {/* Time */}
        <div className="text-right flex flex-col items-end gap-2">
          <p className="text-[10px] text-slate-500 whitespace-nowrap">
            {time}
          </p>

          <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
        </div>

      </div>

    </div>
  );
}