import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import MessageCard from "../components/MessageCard";
import { useAuth } from "../hooks/useAuth";
import { getMessageThreads, type MessageThread } from "../lib/messageApi";

export default function Messages() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user || typeof user !== "object" || !("id" in user)) return;
    const userId = (user as any).id as string;

    setIsLoading(true);
    getMessageThreads(userId)
      .then((data) => {
        const sorted = [...data].sort((a, b) => {
          const aTime = a.lastTime ? new Date(a.lastTime).getTime() : 0;
          const bTime = b.lastTime ? new Date(b.lastTime).getTime() : 0;
          return bTime - aTime;
        });
        setThreads(sorted);
      })
      .finally(() => setIsLoading(false));
  }, [user]);

  return (
    <div className="min-h-screen bg-linear-to-br from-pink-100 via-purple-100 to-blue-100 p-6 pb-24">

      <div className="max-w-xl mx-auto">

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Link
              to="/feed"
              className="text-slate-900 bg-white/80 shadow-sm rounded-full p-2 hover:bg-white transition"
              aria-label="Go back"
            >
              ←
            </Link>
            <h1 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-linear-to-r from-fuchsia-500 via-cyan-300 to-amber-300 shadow-[0_0_30px_rgba(255,255,255,0.35)]">
              MeToYou 💎✨
            </h1>
          </div>

          <p className="text-slate-900 text-base sm:text-lg mt-3 leading-7">
            Rainbow iced, diamond chain energy — chat flex hard.
          </p>

          <div className="mt-3 inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-700 justify-center">
            <span className="inline-block px-3 py-1 rounded-full bg-linear-to-r from-fuchsia-500 via-cyan-300 to-amber-300 text-white shadow-lg shadow-fuchsia-200/40">
              Diamond drip
            </span>
            <span className="inline-block px-3 py-1 rounded-full bg-white/90 text-slate-900 border border-slate-200 backdrop-blur-sm shadow-sm">
              Ice cold
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white/20 backdrop-blur-3xl border border-white/30 rounded-4xl p-4 shadow-2xl mb-6">
          <input
            type="text"
            placeholder="Search the squad..."
            className="w-full bg-transparent outline-none"
            disabled
          />
        </div>

        {/* Message List */}

        <div className="space-y-4">
          {isLoading ? (
            <div className="bg-white/30 backdrop-blur-3xl border border-white/40 rounded-[28px] p-6 text-center text-slate-700 shadow-sm">
              Loading conversations...
            </div>
          ) : threads.length === 0 ? (
            <div className="bg-white/30 backdrop-blur-3xl border border-white/40 rounded-[28px] p-6 text-center text-slate-700 shadow-sm">
              No conversations yet. Start messaging someone from a profile.
            </div>
          ) : (
            threads.map((thread) => (
              <Link
                key={thread.otherId}
                to={`/chat?recipient=${thread.otherId}&username=${encodeURIComponent(thread.otherUsername)}`}
                className="block"
              >
                <MessageCard
                  name={thread.otherUsername}
                  message={thread.lastText ?? ""}
                  time={thread.lastTime ?? ""}
                  unread={Boolean(thread.lastText) && Boolean(thread.lastTime)}
                />
              </Link>
            ))
          )}
        </div>

      </div>


    </div>
  );
}