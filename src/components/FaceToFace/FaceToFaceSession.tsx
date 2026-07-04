import type { FaceToFaceSession as FaceToFaceSessionType } from "../../lib/FaceToFaceApi";

type Props = {
  session: FaceToFaceSessionType;
  onSave: () => void;
  onDiscard: () => void;
};

export default function FaceToFaceSession({ session, onSave, onDiscard }: Props) {
  return (
    <div className="fixed bottom-24 left-1/2 z-50 w-[min(420px,calc(100%-2rem))] -translate-x-1/2 rounded-3xl border border-white/15 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-xl text-white">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">FaceToFace ended</div>
          <div className="text-xs text-white/60">Session finished at {new Date(session.ended_at ?? Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
        </div>
      </div>

      <div className="mt-4 rounded-3xl border border-white/10 bg-slate-900/80 p-4 text-center text-sm text-slate-300">
        <div className="mb-2 text-white/80">Your FaceToFace session has ended.</div>
        <div className="mx-auto h-40 w-full max-w-xl rounded-3xl bg-slate-800/80 border border-white/10 flex items-center justify-center text-slate-500">
          Save or discard this session
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button onClick={onSave} className="rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition">
          Save FaceToFace
        </button>
        <button onClick={onDiscard} className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 transition">
          Discard FaceToFace
        </button>
      </div>
    </div>
  );
}
