import React from "react";
import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-linear-to-br from-blue-100 via-pink-100 to-purple-100 border-b border-white/30 h-20 px-3 sm:px-4">
      <div className="max-w-3xl mx-auto h-full">
        <div className="bg-white/20 backdrop-blur-3xl border border-white/30 rounded-[36px] shadow-sm h-full flex items-center justify-between px-5 py-3">

          {/* Logo */}
          <h1 className="text-[1.2rem] font-bold bg-linear-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
            MeToYou
          </h1>

          {/* Nav */}
          <div className="flex items-center gap-2.5 sm:gap-3">

              <Link
                to="/search"
                className="inline-flex h-12 w-12 items-center justify-center rounded-[24px] text-lg text-slate-900 hover:bg-white/30 transition"
              >
                <span aria-hidden>🔍</span>
                <span className="sr-only">Search</span>
              </Link>

              <Link
                to="/feed"
                onClick={() => window.dispatchEvent(new CustomEvent('metoyou:refreshFeed'))}
                className="inline-flex h-12 w-12 items-center justify-center rounded-3xl text-lg text-slate-900 hover:bg-white/30 transition"
              >
                <span aria-hidden>🏠</span>
                <span className="sr-only">Home</span>
              </Link>

              <Link
                to="/profile"
                className="inline-flex h-12 w-12 items-center justify-center rounded-3xl text-lg text-slate-900 hover:bg-white/30 transition"
              >
                <span aria-hidden>👤</span>
                <span className="sr-only">Profile</span>
              </Link>

              <Link
                to="/messages"
                className="relative inline-flex h-12 w-12 items-center justify-center rounded-3xl text-lg text-slate-900 hover:bg-white/30 transition"
              >
                <span aria-hidden>💬</span>
                <span className="sr-only">Messages</span>

                <span className="absolute -top-1 -right-1 bg-pink-500 text-white text-[9px] h-4 w-4 rounded-full flex items-center justify-center font-bold">
                  3
                </span>
              </Link>

              <Link
                to="/notifications"
                className="relative inline-flex h-12 w-12 items-center justify-center rounded-3xl text-lg text-slate-900 hover:bg-white/30 transition"
              >
                <span aria-hidden>🔔</span>
                <span className="sr-only">Notifications</span>

                <span className="absolute -top-1 -right-1 bg-pink-500 text-white text-[9px] h-4 w-4 rounded-full flex items-center justify-center font-bold">
                  2
                </span>
              </Link>

            </div>

        </div>
      </div>
    </div>
  );
}