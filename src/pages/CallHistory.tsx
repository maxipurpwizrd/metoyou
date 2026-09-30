import { Link, useNavigate } from "react-router-dom";
import { PhoneCall, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useSession } from "../contexts/SessionContext";
import { useAppInit } from "../contexts/AppInitContext";
import { isVibesProEnabled } from "../lib/vibesPro";
import { getCallHistory, type CallHistoryRecord } from "../lib/callHistoryApi";
import { supabase } from "../lib/supabase";
import { formatDisplayDateTime } from "../lib/time";
import { useLanguage } from "../contexts/LanguageContext";

export default function CallHistory() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { appReady } = useAppInit();
  const { profileReady, profile } = useSession();
  const { user } = useAuth();
  const [calls, setCalls] = useState<CallHistoryRecord[]>([]);
  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const [pendingCallTarget, setPendingCallTarget] = useState<{ id: string; username: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isVibesPro = isVibesProEnabled(profile);

  useEffect(() => {
    if (!user?.id) return;

    let mounted = true;
    setIsLoading(true);

    void (async () => {
      const records = await getCallHistory(user.id);
      if (!mounted) return;
      setCalls(records);

      const otherUserIds = Array.from(new Set(records.map((record) => (
        record.caller_id === user.id ? record.recipient_id : record.caller_id
      ))));

      if (otherUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", otherUserIds);

        if (mounted) {
          setUsernames(Object.fromEntries((profiles ?? []).map((item) => [item.id, item.username])));
        }
      }

      setIsLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  if (!appReady || !profileReady) return null;

  const statusLabel = (status: CallHistoryRecord["status"]) => {
    if (status === "completed") return t("callHistory.completed");
    if (status === "missed") return t("callHistory.missed");
    if (status === "declined") return t("callHistory.declined");
    if (status === "failed") return t("callHistory.failed");
    return status === "connected" ? t("callHistory.connected") : t("callHistory.ringing");
  };

  const formatDuration = (seconds: number | null) => {
    if (seconds === null) return "";
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  };

  const handleCallChoice = (callType: "audio" | "video") => {
    if (!pendingCallTarget) return;

    const params = new URLSearchParams({
      recipient: pendingCallTarget.id,
      username: pendingCallTarget.username,
      callType,
    });

    setPendingCallTarget(null);
    navigate(`/chat?${params.toString()}`);
  };

  return (
    <div className={`app-screen min-h-screen p-6 pb-32 ${isVibesPro ? "bg-[#0B0B0B] text-white" : "bg-linear-to-br from-sky-100 via-white to-cyan-100 text-slate-900"}`}>
      <div className="mx-auto max-w-xl pt-8">
        <div className={`mb-6 rounded-4xl border p-5 shadow-2xl ${isVibesPro ? "border-white/10 bg-[#111111]/95" : "border-white/40 bg-white/30 backdrop-blur-3xl"}`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black">{t("callHistory.title")}</h1>
              <p className={`mt-2 text-sm ${isVibesPro ? "text-white/60" : "text-slate-700"}`}>
                {t("callHistory.description")}
              </p>
            </div>
            <Link
              to="/messages"
              aria-label={t("messages.archiveBack")}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${isVibesPro ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : "border-white/60 bg-white/80 text-slate-900 shadow-sm hover:bg-white"}`}
            >
              {t("callHistory.back")}
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className={`rounded-4xl border p-10 text-center ${isVibesPro ? "border-white/10 bg-[#181818] text-white/70" : "border-white/40 bg-white/30 text-slate-700 backdrop-blur-3xl"}`}>
            {t("callHistory.loading")}
          </div>
        ) : calls.length === 0 ? (
          <div className={`rounded-4xl border p-10 text-center shadow-sm ${isVibesPro ? "border-[#D4AF37]/20 bg-[#181818] text-white/70" : "border-white/40 bg-white/30 text-slate-700 backdrop-blur-3xl"}`}>
            <PhoneCall className="mx-auto h-10 w-10 opacity-60" aria-hidden="true" />
            <p className="mt-4 font-semibold">{t("callHistory.empty")}</p>
            <p className="mt-2 text-sm opacity-70">{t("callHistory.emptyDescription")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {calls.map((call) => {
              const otherUserId = call.caller_id === user?.id ? call.recipient_id : call.caller_id;
              const otherUsername = usernames[otherUserId] ?? t("calls.user");
              const isOutgoing = call.caller_id === user?.id;
              return (
                <button
                  key={call.id}
                  type="button"
                  onClick={() => setPendingCallTarget({ id: otherUserId, username: otherUsername })}
                  className={`flex w-full items-center gap-3 rounded-3xl border p-4 text-left transition ${isVibesPro ? "border-[#D4AF37]/20 bg-[#181818] hover:bg-[#1B1B1B]" : "border-white/40 bg-white/30 backdrop-blur-3xl hover:bg-white/40"}`}
                >
                  <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${isVibesPro ? "bg-[#D4AF37] text-black" : "bg-white/70 text-slate-900"}`}>
                    {call.call_type === "video" ? <Video className="h-5 w-5" /> : <PhoneCall className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{otherUsername}</p>
                    <p className="text-sm opacity-65">{isOutgoing ? t("callHistory.outgoing") : t("callHistory.incoming")} · {statusLabel(call.status)}</p>
                  </div>
                  <div className="text-right text-xs opacity-60">
                    <p>{formatDisplayDateTime(call.created_at)}</p>
                    {call.duration_seconds !== null && <p className="mt-1">{formatDuration(call.duration_seconds)}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {pendingCallTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className={`w-full max-w-sm rounded-3xl border p-5 shadow-2xl ${isVibesPro ? "border-white/10 bg-[#111111] text-white" : "border-white/40 bg-white text-slate-900"}`}>
              <p className="text-center text-lg font-bold">{t("calls.chooseType")}</p>
              <p className="mt-2 text-center text-sm opacity-70">{pendingCallTarget.username}</p>

              <div className="mt-5 grid gap-3">
                <button
                  type="button"
                  onClick={() => handleCallChoice("audio")}
                  className={`rounded-2xl px-4 py-3 font-semibold transition ${isVibesPro ? "bg-[#D4AF37] text-black hover:brightness-105" : "bg-slate-900 text-white hover:bg-slate-800"}`}
                >
                  {t("calls.startAudio")}
                </button>

                <button
                  type="button"
                  onClick={() => handleCallChoice("video")}
                  className={`rounded-2xl px-4 py-3 font-semibold transition ${isVibesPro ? "border border-white/10 bg-white/5 text-white hover:bg-white/10" : "border border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100"}`}
                >
                  {t("calls.startVideo")}
                </button>

                <button
                  type="button"
                  onClick={() => setPendingCallTarget(null)}
                  className={`rounded-2xl px-4 py-3 font-semibold transition ${isVibesPro ? "text-white/70 hover:bg-white/5" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  {t("profile.cancel")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
