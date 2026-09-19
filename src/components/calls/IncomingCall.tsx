import { Phone, Video, X } from "lucide-react";

interface IncomingCallProps {
  senderName: string;
  callType: "audio" | "video";
  onAccept: () => void;
  onReject: () => void;
}

export default function IncomingCall({ senderName, callType, onAccept, onReject }: IncomingCallProps) {
  const isVideo = callType === "video";

  return (
    <div className="fixed inset-0 z-100 flex min-h-dvh flex-col bg-slate-950 text-white backdrop-blur-xl">
      <div className="relative flex min-h-dvh w-full flex-1 flex-col overflow-hidden bg-slate-900/95 px-6 py-10 shadow-2xl shadow-slate-950/50 sm:px-10 sm:py-14">
        <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-sky-400 via-cyan-400 to-blue-500" />
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="relative mb-5">
            <div className="absolute -inset-3 animate-ping rounded-full bg-cyan-400/15" />
            <div className="relative grid h-24 w-24 place-items-center rounded-full border-4 border-cyan-300/60 bg-linear-to-br from-sky-400 to-cyan-500 text-3xl font-bold shadow-xl shadow-cyan-500/20">
              {senderName.charAt(0).toUpperCase() || "?"}
            </div>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/70">Incoming call</p>
          <h2 className="mt-2 text-2xl font-bold">{senderName || "Someone"}</h2>
          <p className="mt-2 text-sm text-white/60">{isVideo ? "Video call" : "Audio call"} is calling you</p>
        </div>
        <div className="mt-8 grid w-full grid-cols-2 gap-3 sm:mx-auto sm:max-w-md">
          <button type="button" onClick={onReject} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 font-semibold text-white transition hover:bg-rose-500/20">
            <X className="h-5 w-5" /> Decline
          </button>
          <button type="button" onClick={onAccept} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300">
            {isVideo ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />} Accept
          </button>
        </div>
      </div>
    </div>
  );
}
