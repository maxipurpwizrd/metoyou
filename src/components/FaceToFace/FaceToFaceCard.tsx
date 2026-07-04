import { useMemo, useState } from "react";
import FaceToFacePlayer from "./FaceToFacePlayer";
import type { FaceToFaceSession } from "../../lib/faceToFaceApi";

type Props = {
  session: FaceToFaceSession;
};

export default function FaceToFaceCard({ session }: Props) {
  const [showPlayer, setShowPlayer] = useState(false);
  const duration = useMemo(
    () =>
      session.duration
        ? `${Math.floor(session.duration / 60)}m ${Math.floor(session.duration % 60)}s`
        : "--:--",
    [session.duration]
  );
  const savedAt = useMemo(() => {
    if (!session.ended_at) return "Saved now";
    return new Date(session.ended_at).toLocaleDateString([], { month: "short", day: "numeric" });
  }, [session.ended_at]);

  return (
    <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-4 text-white shadow-lg">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm font-semibold">
        <div>
          <div>📹 FaceToFace</div>
          <div className="text-xs text-white/50">{savedAt}</div>
        </div>
        <span className="text-cyan-200">{duration}</span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => setShowPlayer((prev) => !prev)}
          className="rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition"
        >
          {showPlayer ? "Close" : "Replay"}
        </button>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
          {session.saved ? "Saved" : "Draft"}
        </span>
      </div>
      {showPlayer && <FaceToFacePlayer session={session} onClose={() => setShowPlayer(false)} />}
    </div>
  );
}
