import { Link } from "react-router-dom";
import { PhoneCall, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useSession } from "../contexts/SessionContext";
import { useAppInit } from "../contexts/AppInitContext";
import { isVibesProEnabled } from "../lib/vibesPro";
import { getCallHistory, type CallHistoryRecord } from "../lib/callHistoryApi";
import { supabase } from "../lib/supabase";
import { formatDisplayDateTime } from "../lib/time";

export default function CallHistory() {
  const { appReady } = useAppInit();
  const { profileReady, profile } = useSession();
  const { user } = useAuth();
  const [calls, setCalls] = useState<CallHistoryRecord[]>([]);
  const [usernames, setUsernames] = useState<Record<string, string>>({});
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
    if (status === "completed") return "Completed";
    if (status === "missed") return "Missed";
    if (status === "declined") return "Declined";
    if (status === "failed") return "Failed";
    return status === "connected" ? "Connected" : "Ringing";
  };

  const formatDuration = (seconds: number | null) => {
    if (seconds === null) return "";
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  };

  return (
    <div className={`app-screen min-h-screen p-6 pb-32 ${isVibesPro ? "bg-[#0B0B0B] text-white" : "bg-linear-to-br from-sky-100 via-white to-cyan-100 text-slate-900"}`}>
      <div className="mx-auto max-w-xl pt-8">
        <div className={`mb-6 rounded-4xl border p-5 shadow-2xl ${isVibesPro ? "border-white/10 bg-[#111111]/95" : "border-white/40 bg-white/30 backdrop-blur-3xl"}`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black">Call history</h1>
              <p className={`mt-2 text-sm ${isVibesPro ? "text-white/60" : "text-slate-700"}`}>
                Your recent calls will appear here.
              </p>
            </div>
            <Link
              to="/messages"
              aria-label="Back to messages"
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${isVibesPro ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : "border-white/60 bg-white/80 text-slate-900 shadow-sm hover:bg-white"}`}
            >
              Back
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className={`rounded-4xl border p-10 text-center ${isVibesPro ? "border-white/10 bg-[#181818] text-white/70" : "border-white/40 bg-white/30 text-slate-700 backdrop-blur-3xl"}`}>
            Loading call history...
          </div>
        ) : calls.length === 0 ? (
          <div className={`rounded-4xl border p-10 text-center shadow-sm ${isVibesPro ? "border-[#D4AF37]/20 bg-[#181818] text-white/70" : "border-white/40 bg-white/30 text-slate-700 backdrop-blur-3xl"}`}>
            <PhoneCall className="mx-auto h-10 w-10 opacity-60" aria-hidden="true" />
            <p className="mt-4 font-semibold">No calls yet</p>
            <p className="mt-2 text-sm opacity-70">Completed and missed calls will be listed here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {calls.map((call) => {
              const otherUserId = call.caller_id === user?.id ? call.recipient_id : call.caller_id;
              const otherUsername = usernames[otherUserId] ?? "User";
              const isOutgoing = call.caller_id === user?.id;
              return (
                <div key={call.id} className={`flex items-center gap-3 rounded-3xl border p-4 ${isVibesPro ? "border-[#D4AF37]/20 bg-[#181818]" : "border-white/40 bg-white/30 backdrop-blur-3xl"}`}>
                  <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${isVibesPro ? "bg-[#D4AF37] text-black" : "bg-white/70 text-slate-900"}`}>
                    {call.call_type === "video" ? <Video className="h-5 w-5" /> : <PhoneCall className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{otherUsername}</p>
                    <p className="text-sm opacity-65">{isOutgoing ? "Outgoing" : "Incoming"} · {statusLabel(call.status)}</p>
                  </div>
                  <div className="text-right text-xs opacity-60">
                    <p>{formatDisplayDateTime(call.created_at)}</p>
                    {call.duration_seconds !== null && <p className="mt-1">{formatDuration(call.duration_seconds)}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
