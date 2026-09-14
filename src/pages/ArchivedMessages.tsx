import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useLanguage } from "../contexts/LanguageContext";
import { useAppInit } from "../contexts/AppInitContext";
import { getMessageThreads, type MessageThread } from "../lib/messageApi";
import { useSession } from "../contexts/SessionContext";
import { formatDisplayDate } from "../lib/time";
import { isVibesProEnabled } from "../lib/vibesPro";

export default function ArchivedMessages() {
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
        const archiveKey = `metoyou-archived-threads:${userId}`;
        const archivedRaw = sessionStorage.getItem(archiveKey);
        const archivedIds = archivedRaw ? (JSON.parse(archivedRaw) as string[]) : [];

        if (archivedIds.length === 0) {
          setThreads([]);
          return;
        }

        const allThreads = await getMessageThreads(userId);
        if (!mounted || !allThreads) return;

        const filtered = allThreads.filter((thread) => archivedIds.includes(thread.otherId));
        setThreads(filtered);
      } catch (error) {
        console.error("Failed to load archived messages", error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user]);

  return (
    <div className={`app-screen ${isVibesPro ? 'bg-[#0B0B0B]' : 'bg-linear-to-br from-sky-100 via-white to-cyan-100'} p-6 pb-32`}>
      <div className={`max-w-xl mx-auto ${isVibesPro ? 'pt-8' : ''}`}>
        <div className={`mb-6 rounded-4xl p-5 shadow-2xl border ${isVibesPro ? 'border-white/10 bg-[#111111]/95 text-white' : 'border-white/40 bg-white/30 backdrop-blur-3xl text-slate-900'}`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black">{t("messages.archiveTitle") || "Archived Messages"}</h1>
              <p className={`mt-2 text-sm ${isVibesPro ? 'text-white/60' : 'text-slate-700'}`}>
                {t("messages.archiveSubtitle") || "Your archived conversations are stored here."}
              </p>
            </div>
            <Link
              to="/messages"
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${isVibesPro ? 'border-white/10 bg-white/5 text-white hover:bg-white/10' : 'border-white/60 bg-white/80 text-slate-900 shadow-sm hover:bg-white'}`}
            >
              {t("messages.archiveBack") || "Back"}
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className={`rounded-4xl p-6 ${isVibesPro ? 'bg-[#181818] text-white/70' : 'bg-white/30 backdrop-blur-3xl border border-white/40 text-slate-700'}`}>
              {t("messages.archiveLoading") || "Loading archived messages..."}
            </div>
          ) : threads.length === 0 ? (
            <div className={`rounded-4xl p-6 text-center shadow-sm ${isVibesPro ? 'bg-[#181818] border border-[#D4AF37]/20 text-white/70' : 'bg-white/30 backdrop-blur-3xl border border-white/40 text-slate-700'}`}>
              {t("messages.archiveEmpty") || "No archived messages yet."}
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
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white ${isVibesPro ? 'bg-linear-to-r from-[#D4AF37] to-[#F0C75E]' : 'bg-linear-to-r from-sky-400 via-cyan-400 to-blue-500'}`}>
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
