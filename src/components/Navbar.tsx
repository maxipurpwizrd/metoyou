import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-linear-to-br from-blue-100 via-pink-100 to-purple-100 border-b border-white/40">
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-[28px] shadow-xl px-6 py-4">

          <div className="flex items-center justify-between">

            {/* Logo */}
            <h1 className="text-3xl font-black bg-linear-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
              MeToYou 💜
            </h1>

            {/* Nav */}
            <div className="flex items-center gap-5">

              <Link
                to="/search"
                className="text-2xl hover:scale-105 transition"
              >
                🔍
              </Link>

              <Link
                to="/feed"
                className="font-bold text-blue-700 hover:scale-105 transition"
              >
                🏠 Home
              </Link>

              <Link
                to="/profile"
                className="font-semibold text-blue-700 hover:scale-105 transition"
              >
                👤 Profile
              </Link>


              <Link
                to="/messages"
                className="relative text-2xl hover:scale-105 transition"
              >
                💬

                <span className="absolute -top-1 -right-2 bg-pink-500 text-white text-[10px] min-w-4.5 h-4.5 rounded-full flex items-center justify-center font-bold">
                  3
                </span>
              </Link>

              <Link
                to="/notifications"
                className="relative text-2xl hover:scale-105 transition"
              >
                🔔

                <span className="absolute -top-1 -right-2 bg-pink-500 text-white text-[10px] min-w-4.5 h-4.5 rounded-full flex items-center justify-center font-bold">
                  2
                </span>
              </Link>

            </div>

          </div>

        </div>
      </div>
    </div>
  );
}