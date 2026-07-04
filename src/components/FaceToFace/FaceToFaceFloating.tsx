import { useEffect, useMemo, useState } from "react";
import { useFaceToFace } from "../../contexts/FaceToFaceContext";

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function FaceToFaceFloating() {
  const { activeCall, isCalling, endCall } = useFaceToFace();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!activeCall || !isCalling) return undefined;

    const update = () => {
      const diff = Math.max(0, Date.now() - activeCall.started_at);
      setElapsedSeconds(Math.floor(diff / 1000));
    };

    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [activeCall, isCalling]);

  const startedLabel = useMemo(() => {
    if (!activeCall?.started_at) return "Connecting...";
    return `Started ${new Date(activeCall.started_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }, [activeCall]);

  if (!isCalling || !activeCall) return null;

  return (
    <div className="fixed top-24 right-4 z-50 w-72 rounded-3xl border border-white/15 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-xl text-white">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">FaceToFace live</div>
          <div className="text-[11px] text-white/60">{startedLabel}</div>
        </div>
        <button onClick={endCall} className="rounded-full bg-white/10 px-3 py-2 text-xs hover:bg-white/20 transition">
          End
        </button>
      </div>
      <div className="mt-3 h-36 rounded-3xl bg-slate-900/70 border border-white/10 flex flex-col items-center justify-center gap-2 text-slate-400 text-sm">
        <div className="text-base font-semibold text-white">{formatDuration(elapsedSeconds)}</div>
        <div className="rounded-full bg-cyan-500/15 px-3 py-1 text-xs text-cyan-200">Live session</div>
      </div>
    </div>
  );
}
