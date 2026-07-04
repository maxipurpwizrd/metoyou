import type { FaceToFaceSession } from "../../lib/faceToFaceApi";

type Props = {
  session: FaceToFaceSession;
  onClose: () => void;
};

export default function FaceToFacePlayer({ session, onClose }: Props) {
  return (
    <div className="mt-4 rounded-3xl bg-slate-950/95 p-4 border border-white/10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">FaceToFace replay</div>
          <div className="text-xs text-white/60">
            {session.title ?? "Session replay"} · {session.duration ? `${Math.floor(session.duration / 60)}m ${Math.floor(session.duration % 60)}s` : "No duration"}
          </div>
        </div>
        <button onClick={onClose} className="text-xs uppercase text-white/70 hover:text-white">
          Close
        </button>
      </div>
      <div className="mt-4 h-52 rounded-3xl bg-slate-900 border border-white/10 flex items-center justify-center text-white/50">
        Replay player
      </div>
    </div>
  );
}
