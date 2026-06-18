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
    <div className="backdrop-blur-2xl bg-white/40 border border-white/50 rounded-3xl p-4 shadow-xl hover:scale-[1.02] transition cursor-pointer">

      <div className="flex items-center justify-between">

        <div className="flex items-center gap-4">

          {/* Avatar */}
          <div className="w-14 h-14 rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-lg">
            {name.charAt(0)}
          </div>

          {/* User Info */}
          <div>
            <h3 className="font-bold text-lg">
              {name}
            </h3>

            <p className="text-gray-600 truncate max-w-[180px]">
              {message}
            </p>
          </div>

        </div>

        {/* Time */}
        <div className="text-right">
          <p className="text-sm text-gray-500">
            {time}
          </p>

          <div className="mt-2 w-3 h-3 rounded-full bg-green-500 ml-auto"></div>
        </div>

      </div>

    </div>
  );
}