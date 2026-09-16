import { useEffect, useState, type RefObject } from "react";
import { Loader, Mic, MicOff, Phone, Video, VideoOff, Volume2 } from "lucide-react";
import type { CallSession } from "../../types/call";

interface VideoCallProps {
  session: CallSession;
  localVideoRef: RefObject<HTMLVideoElement | null>;
  localStream: MediaStream | null;
  remoteVideoRef: RefObject<HTMLVideoElement | null>;
  remoteStream: MediaStream | null;
  isRemoteVideoActive: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onEndCall: () => void;
}

export default function VideoCall({ session, localVideoRef, localStream, remoteVideoRef, remoteStream, isRemoteVideoActive, isMuted, isCameraOff, onToggleMute, onToggleCamera, onEndCall }: VideoCallProps) {
  const [duration, setDuration] = useState(0);
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, localVideoRef]);
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, remoteVideoRef]);
  useEffect(() => {
    if (!session.startTime) return;
    const timer = window.setInterval(() => setDuration(Math.floor((Date.now() - new Date(session.startTime!).getTime()) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [session.startTime]);
  const formattedDuration = `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-90 overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-black">
        {isRemoteVideoActive ? <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" /> : <div className="flex h-full w-full flex-col items-center justify-center bg-linear-to-br from-slate-900 to-sky-950"><div className="grid h-32 w-32 place-items-center rounded-full border-4 border-cyan-300/60 bg-linear-to-br from-sky-400 to-cyan-500 text-5xl font-bold">{session.remoteUsername?.charAt(0).toUpperCase() || "?"}</div><p className="mt-5 text-xl font-semibold">{session.remoteUsername || "User"}</p><p className="mt-2 text-sm text-cyan-200/70">{session.status === "ringing" ? "Connecting..." : "Connected"}</p></div>}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-black/40" />
      <div className="absolute left-0 right-0 top-6 z-10 text-center"><p className="text-sm font-semibold text-cyan-200/80">{session.remoteUsername || "User"}</p><p className="mt-1 font-mono text-2xl font-bold">{formattedDuration}</p></div>
      <div className="absolute right-5 top-20 z-10 h-40 w-28 overflow-hidden rounded-2xl border-2 border-white/30 bg-slate-900 shadow-xl">
        {!isCameraOff ? <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full scale-x-[-1] object-cover" /> : <div className="grid h-full place-items-center"><VideoOff className="h-7 w-7 text-white/50" /></div>}
      </div>
      <div className="absolute bottom-7 left-0 right-0 z-10 flex items-center justify-center gap-3">
        <button type="button" onClick={onToggleMute} className={`grid h-14 w-14 place-items-center rounded-full border border-white/15 ${isMuted ? "bg-rose-500" : "bg-white/10"}`} title={isMuted ? "Unmute" : "Mute"}>{isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}</button>
        <button type="button" onClick={onToggleCamera} className={`grid h-14 w-14 place-items-center rounded-full border border-white/15 ${isCameraOff ? "bg-rose-500" : "bg-white/10"}`} title={isCameraOff ? "Turn on camera" : "Turn off camera"}>{isCameraOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}</button>
        <button type="button" className="grid h-14 w-14 place-items-center rounded-full border border-white/15 bg-white/10" title="Speaker"><Volume2 className="h-6 w-6" /></button>
        <button type="button" onClick={onEndCall} className="grid h-16 w-16 place-items-center rounded-full bg-rose-500 shadow-lg shadow-rose-500/25" title="End call"><Phone className="h-7 w-7 rotate-135" /></button>
        <span className="grid h-14 w-14 place-items-center rounded-full border border-white/15 bg-white/10" aria-label="Connection status">{session.status === "ringing" ? <Loader className="h-6 w-6 animate-spin" /> : <span className="h-3 w-3 rounded-full bg-emerald-400" />}</span>
      </div>
    </div>
  );
}
