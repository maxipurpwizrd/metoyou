import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useLanguage } from "../contexts/LanguageContext";
import { useAppInit } from "../contexts/AppInitContext";
import { getMessageThreads, type MessageThread } from "../lib/messageApi";
import { getFollowStatus } from "../lib/followApi";
import { useSession } from "../contexts/SessionContext";
import { isVibesProEnabled } from "../lib/vibesPro";
import { formatDisplayDate } from "../lib/time";

export default function SpamMessages() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { appReady } = useAppInit();
  const { profileReady, profile } = useSession();
  const isVibesPro = isVibesProEnabled(profile);
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;

    let mounted = true;
    window.requestAnimationFrame(() => setIsLoading(true));

    void (async () => {
      try {
        const allThreads = await getMessageThreads(userId);
        if (!mounted || !allThreads) return;

        const threadStatuses = await Promise.all(
          allThreads.map(async (thread) => {
            const status = await getFollowStatus(userId, thread.otherId);
            return { thread, status };
          })
        );

        const spamThreads = threadStatuses
          .filter(({ status, thread }) =>
            (!status.isFollowing || !status.isFollowedBy) && !thread.hasOutgoingMessages
          )
          .map(({ thread }) => thread);

        setThreads(spamThreads);
      } catch (error) {
        console.error("Failed to load spam messages", error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  if (!appReady || !profileReady) return null;

  return (
    <div className={`app-screen ${isVibesPro ? 'bg-[#0B0B0B]' : 'bg-linear-to-br from-pink-100 via-purple-100 to-blue-100'} p-6 pb-32`}>
      <div className={`max-w-xl mx-auto ${isVibesPro ? 'pt-8' : ''}`}>
        <div className={`mb-6 rounded-4xl p-5 shadow-2xl border ${isVibesPro ? 'border-white/10 bg-[#111111]/95 text-white' : 'border-white/40 bg-white/30 backdrop-blur-3xl text-slate-900'}`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black">{t("messages.spamTitle") || "Spam Messages"}</h1>
              <p className={`mt-2 text-sm ${isVibesPro ? 'text-white/60' : 'text-slate-700'}`}>
                {t("messages.spamSubtitle") || "Messages from people you do not follow back."}
              </p>
            </div>
            <Link
              to="/messages/archived"
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${isVibesPro ? 'border-white/10 bg-white/5 text-white hover:bg-white/10' : 'border-white/60 bg-white/80 text-slate-900 shadow-sm hover:bg-white'}`}
            >
              {t("messages.archive") || "Archived"}
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className={`rounded-4xl p-6 ${isVibesPro ? 'bg-[#181818] text-white/70' : 'bg-white/30 backdrop-blur-3xl border border-white/40 text-slate-700'}`}>
              {t("messages.loading") || "Loading messages..."}
            </div>
          ) : threads.length === 0 ? (
            <div className={`rounded-4xl p-6 text-center shadow-sm ${isVibesPro ? 'bg-[#181818] border border-[#D4AF37]/20 text-white/70' : 'bg-white/30 backdrop-blur-3xl border border-white/40 text-slate-700'}`}>
              {t("messages.spamEmpty") || "No spam messages yet."}
            </div>
          ) : (
            threads.map((thread) => (
              <Link
                key={thread.conversationId}
                to={`/chat?recipient=${thread.otherId}&username=${encodeURIComponent(thread.otherUsername)}`}
                className={`block rounded-4xl border transition ${isVibesPro ? 'border-[#D4AF37]/20 bg-[#181818] text-white hover:bg-[#1a1a1a]' : 'border-white/40 bg-white/30 backdrop-blur-3xl text-slate-900 hover:bg-white/40'}`}
              >
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white ${isVibesPro ? 'bg-linear-to-r from-[#D4AF37] to-[#F0C75E]' : 'bg-linear-to-r from-pink-400 via-purple-400 to-blue-400'}`}>
                      {thread.otherUsername[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{thread.otherUsername}</p>
                      <p className={`text-sm truncate ${isVibesPro ? 'text-white/60' : 'text-slate-600'}`}>{thread.lastText || t("messages.noMessages")}</p>
                    </div>
                    {thread.lastTime && (
                      <p className={`text-xs whitespace-nowrap ${isVibesPro ? 'text-white/40' : 'text-slate-500'}`}>
                        {formatDisplayDate(thread.lastTime)}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
