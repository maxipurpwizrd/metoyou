import { useEffect, useRef, useState } from "react";
import { Loader, Mic, MicOff, Phone, Volume2 } from "lucide-react";
import type { CallSession } from "../../types/call";

interface AudioCallProps {
  session: CallSession;
  remoteStream: MediaStream | null;
  isRemoteAudioActive: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onEndCall: () => void;
}

export default function AudioCall({ session, remoteStream, isRemoteAudioActive, isMuted, onToggleMute, onEndCall }: AudioCallProps) {
  const [duration, setDuration] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.srcObject = remoteStream;

    return () => {
      if (audioRef.current) {
        audioRef.current.srcObject = null;
      }
    };
  }, [remoteStream]);

  useEffect(() => {
    if (!session.startTime) return;
    const timer = window.setInterval(() => setDuration(Math.floor((Date.now() - new Date(session.startTime!).getTime()) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [session.startTime]);

  useEffect(() => {
    if (!isRemoteAudioActive || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;
    let frame = 0;
    const draw = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "rgba(103, 232, 249, .8)";
      for (let index = 0; index < 8; index += 1) {
        const height = 12 + Math.random() * 45;
        context.fillRect(index * 38 + 5, (canvas.height - height) / 2, 22, height);
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [isRemoteAudioActive]);

  const formattedDuration = `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-90 flex items-center justify-center overflow-hidden bg-linear-to-br from-slate-950 via-cyan-950 to-violet-950 text-white">
      <audio ref={audioRef} autoPlay playsInline />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,.18),transparent_38%),radial-gradient(circle_at_bottom,rgba(139,92,246,.2),transparent_42%)]" />
      <div className="relative flex w-full max-w-md flex-col items-center px-6 text-center">
        <div className={`relative grid h-32 w-32 place-items-center rounded-full border-4 border-cyan-300/70 bg-linear-to-br from-cyan-400 to-violet-500 text-5xl font-bold shadow-2xl shadow-cyan-500/25 ${isRemoteAudioActive ? "ring-8 ring-cyan-300/10" : ""}`}>
          {session.remoteUsername?.charAt(0).toUpperCase() || "?"}
        </div>
        <p className="mt-7 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/70">{session.status === "ringing" ? "Connecting" : "Connected"}</p>
        <h1 className="mt-2 text-3xl font-bold">{session.remoteUsername || "User"}</h1>
        <p className="mt-2 font-mono text-white/60">{formattedDuration}</p>
        <canvas ref={canvasRef} width={300} height={70} className="mt-10 h-20 w-full rounded-2xl border border-white/10 bg-white/5" />
        <div className="mt-10 flex items-center gap-4">
          <button type="button" onClick={onToggleMute} className={`grid h-14 w-14 place-items-center rounded-full border border-white/10 transition ${isMuted ? "bg-rose-500" : "bg-white/10 hover:bg-white/20"}`} title={isMuted ? "Unmute" : "Mute"}>
            {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </button>
          <button type="button" className="grid h-14 w-14 place-items-center rounded-full border border-white/10 bg-white/10" title="Speaker"><Volume2 className="h-6 w-6" /></button>
          <button type="button" onClick={onEndCall} className="grid h-16 w-16 place-items-center rounded-full bg-rose-500 shadow-lg shadow-rose-500/25 transition hover:bg-rose-400" title="End call"><Phone className="h-7 w-7 rotate-135" /></button>
          <span className="grid h-14 w-14 place-items-center rounded-full border border-white/10 bg-white/10" aria-label="Connection status">{session.status === "ringing" ? <Loader className="h-6 w-6 animate-spin" /> : <span className="h-3 w-3 rounded-full bg-emerald-400" />}</span>
        </div>
      </div>
    </div>
  );
}
