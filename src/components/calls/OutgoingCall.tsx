import { useEffect } from "react";
import { Phone, Video } from "lucide-react";
import type { RefObject } from "react";
import type { CallSession } from "../../types/call";

interface OutgoingCallProps {
  session: CallSession;
  localVideoRef: RefObject<HTMLVideoElement | null>;
  localStream: MediaStream | null;
  onEndCall: () => void;
}

export default function OutgoingCall({ session, localVideoRef, localStream, onEndCall }: OutgoingCallProps) {
  const isVideo = session.callType === "video";

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, localVideoRef]);

  return (
    <div className="fixed inset-0 z-90 flex items-center justify-center overflow-hidden bg-linear-to-br from-slate-950 via-sky-950 to-slate-950 text-white">
      <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
      <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="relative flex w-full max-w-sm flex-col items-center px-6 text-center">
        {isVideo && (
          <div className="mb-7 h-48 w-32 overflow-hidden rounded-2xl border-2 border-white/30 bg-slate-900 shadow-xl">
            <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full scale-x-[-1] object-cover" />
          </div>
        )}
        <div className="relative mb-7">
          <div className="absolute -inset-5 animate-ping rounded-full border border-cyan-300/20" />
          <div className="absolute -inset-2 rounded-full border border-sky-300/30" />
          <div className="relative grid h-28 w-28 place-items-center rounded-full border-4 border-cyan-300/60 bg-linear-to-br from-sky-400 to-cyan-500 text-4xl font-bold shadow-2xl shadow-cyan-500/20">
            {session.remoteUsername?.charAt(0).toUpperCase() || "?"}
          </div>
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/70">Calling</p>
        <h1 className="mt-2 text-3xl font-bold">{session.remoteUsername || "User"}</h1>
        <div className="mt-3 flex items-center gap-2 text-sm text-white/60">
          {isVideo ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
          <span>Waiting for them to answer...</span>
        </div>
        <div className="mt-10 flex items-center gap-2 text-cyan-200/70">
          <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300 [animation-delay:120ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300 [animation-delay:240ms]" />
        </div>
        <button type="button" onClick={onEndCall} className="mt-12 inline-flex items-center gap-2 rounded-full bg-rose-500 px-6 py-3 font-semibold shadow-lg shadow-rose-500/20 transition hover:bg-rose-400">
          <Phone className="h-5 w-5 rotate-135" /> Cancel call
        </button>
      </div>
    </div>
  );
}
