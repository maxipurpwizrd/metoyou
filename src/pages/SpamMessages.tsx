import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useLanguage } from "../contexts/LanguageContext";
import { useAppInit } from "../contexts/AppInitContext";
import { getMessageThreads, type MessageThread } from "../lib/messageApi";
import { getFollowStatus } from "../lib/followApi";
import { useSession } from "../contexts/SessionContext";
import { isVibesProEnabled } from "../lib/vibesPro";

export default function SpamMessages() {
  const { appReady } = useAppInit();
  const { profileReady } = useSession();
  if (!appReady || !profileReady) return null;

  const { user } = useAuth();
  const { t } = useLanguage();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { profile } = useSession();
  const isVibesPro = isVibesProEnabled(profile);

  useEffect(() => {
    const userId = (user as any)?.id as string | undefined;
    if (!userId) return;

    let mounted = true;
    setIsLoading(true);

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
  }, [user]);

  return (
    <div className={`app-screen ${isVibesPro ? 'bg-[#0B0B0B]' : 'bg-linear-to-br from-pink-100 via-purple-100 to-blue-100'} p-6 pb-32`}>
      <div className={`max-w-xl mx-auto ${isVibesPro ? 'pt-8' : ''}`}>
        <div className="mb-6 rounded-4xl p-5 shadow-2xl border border-white/10 bg-[#111111]/95">
          <div className="flex items-center justify-between gap-4 text-white">
            <div>
              <h1 className="text-3xl font-black">{t("messages.spamTitle") || "Spam Messages"}</h1>
              <p className="mt-2 text-sm text-white/60">
                {t("messages.spamSubtitle") || "Messages from people you do not follow back."}
              </p>
            </div>
            <Link
              to="/messages/archived"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              {t("messages.archive") || "Archived"}
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="rounded-4xl p-6 bg-[#181818] text-white/70">{t("messages.loading") || "Loading messages..."}</div>
          ) : threads.length === 0 ? (
            <div className="rounded-4xl p-6 text-center shadow-sm bg-[#181818] border border-[#D4AF37]/20 text-white/70">
              {t("messages.spamEmpty") || "No spam messages yet."}
            </div>
          ) : (
            threads.map((thread) => (
              <Link
                key={thread.conversationId}
                to={`/chat?recipient=${thread.otherId}&username=${encodeURIComponent(thread.otherUsername)}`}
                className="block rounded-4xl border border-[#D4AF37]/20 bg-[#181818] text-white transition hover:bg-[#1a1a1a]"
              >
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-linear-to-r from-[#D4AF37] to-[#F0C75E] flex items-center justify-center font-bold text-white">
                      {thread.otherUsername[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{thread.otherUsername}</p>
                      <p className="text-sm text-white/60 truncate">{thread.lastText || t("messages.noMessages")}</p>
                    </div>
                    {thread.lastTime && (
                      <p className="text-xs whitespace-nowrap text-white/40">
                        {new Date(thread.lastTime).toLocaleDateString()}
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
