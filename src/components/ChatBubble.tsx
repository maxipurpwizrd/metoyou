import { useEffect, useRef, useState } from "react";
import type { Message } from "../lib/messageApi";
import { updateMessageReactions } from "../lib/messageApi";

type Props = {
  message: Message;
  mine?: boolean;
};

function formatMessageTime(dateString?: string) {
  if (!dateString) return "";

  const date = new Date(dateString);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusIcon(status?: string) {
  switch (status) {
    case "read":
      return "👀";
    default:
      return "📨";
  }
}

function formatDuration(seconds: number) {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function ChatBubble({ message, mine = false }: Props) {
  const hasImage = Boolean(message.image_url);
  const hasVideo = Boolean(message.video_url);
  const hasAudio = Boolean(message.audio_url);
  const hasText = Boolean(message.text?.trim());

  const timestamp = formatMessageTime(message.created_at);

  const bubbleBase = `rounded-[28px] shadow-sm ${
    mine
      ? "bg-linear-to-r from-pink-500 to-purple-500 text-white"
      : "bg-white/60 backdrop-blur-2xl border border-white/50 text-slate-800"
  }`;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showReactions, setShowReactions] = useState(false);
  const [reactions, setReactions] = useState<Record<string, string[]>>(message.reactions ?? {});
  const bubbleWrapperRef = useRef<HTMLDivElement | null>(null);
  const reactionTrayRef = useRef<HTMLDivElement | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        window.clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try {
        sourceRef.current?.disconnect();
        analyserRef.current?.disconnect();
        audioCtxRef.current?.close();
      } catch {
        // ignore cleanup errors
      }
    };
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      const isInsideBubble = bubbleWrapperRef.current?.contains(target);
      const isInsideTray = reactionTrayRef.current?.contains(target);

      if (showReactions && (!isInsideBubble || (isInsideBubble && !isInsideTray))) {
        setShowReactions(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [showReactions]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setAudioDuration(audio.duration);
      setCurrentTime(0);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  function drawWave() {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(255,255,255,0)";
    ctx.fillRect(0, 0, width, height);

    ctx.lineWidth = 2;
    ctx.strokeStyle = mine ? "rgba(255,255,255,0.95)" : "#0f172a";
    ctx.beginPath();

    const sliceWidth = (width * 1.0) / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i += 1) {
      const v = dataArray[i] / 128.0;
      const y = (v * height) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }

    ctx.lineTo(width, height / 2);
    ctx.stroke();

    rafRef.current = requestAnimationFrame(drawWave);
  }

  function startReactionHold() {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
    }
    holdTimerRef.current = window.setTimeout(() => {
      setShowReactions(true);
    }, 260);
  }

  function cancelReactionHold() {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }

  function handleReact(emoji: string) {
    cancelReactionHold();
    setReactions((prev) => {
      const next: Record<string, string[]> = {};
      let currentReaction: string | null = null;

      Object.entries(prev).forEach(([key, list]) => {
        if (list.includes("me")) {
          currentReaction = key;
        }
        const filtered = list.filter((item) => item !== "me");
        if (filtered.length > 0) {
          next[key] = filtered;
        }
      });

      if (currentReaction === emoji) {
        return next;
      }

      const list = next[emoji] ?? [];
      next[emoji] = [...list, "me"];
      return next;
    });

    // Save reactions to database and broadcast to other users
    setReactions((updated) => {
      void updateMessageReactions(message.id, updated);
      return updated;
    });

    setShowReactions(false);
  }

  async function togglePlay() {
    if (!audioRef.current) return;

    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    if (!sourceRef.current && audioRef.current && audioCtxRef.current) {
      try {
        sourceRef.current = audioCtxRef.current.createMediaElementSource(audioRef.current);
        analyserRef.current = audioCtxRef.current.createAnalyser();
        analyserRef.current.fftSize = 2048;
        sourceRef.current.connect(analyserRef.current);
        analyserRef.current.connect(audioCtxRef.current.destination);
      } catch {
        analyserRef.current = null;
      }
    }

    if (audioRef.current.paused) {
      await audioRef.current.play();
      setIsPlaying(true);
      if (analyserRef.current) drawWave();
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
  }

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[75%] mb-2 text-sm ${mine ? "text-right" : "text-left"}`}>
        <div
          ref={bubbleWrapperRef}
          className={`${bubbleBase} inline-block px-4 py-4`}
          onPointerDown={startReactionHold}
          onPointerUp={cancelReactionHold}
          onPointerLeave={cancelReactionHold}
          onPointerCancel={cancelReactionHold}
        >
          <div className="flex flex-col gap-3">
            {hasText && (
              <div className="break-words whitespace-pre-wrap text-left">{message.text}</div>
            )}

            {hasImage && (
              <a
                href={message.image_url ?? ""}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-2xl shadow-sm max-w-60 mx-auto"
              >
                <img
                  src={message.image_url ?? ""}
                  alt={message.text ? message.text : "Image attachment"}
                  className="block w-full h-auto object-cover"
                />
              </a>
            )}

            {hasVideo && (
              <div className="overflow-hidden rounded-2xl shadow-sm max-w-[260px] mx-auto">
                <video controls src={message.video_url ?? ""} className="block w-full h-auto object-cover" />
              </div>
            )}

            {hasAudio && (
              <div className="overflow-hidden rounded-2xl shadow-sm p-3 flex items-center gap-3 max-w-[260px] mx-auto">
                <button
                  onClick={togglePlay}
                  aria-label={isPlaying ? "Pause audio" : "Play audio"}
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    mine ? "bg-white/20 text-white" : "bg-white text-slate-800"
                  }`}
                >
                  {isPlaying ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="6" y="5" width="4" height="14" />
                      <rect x="14" y="5" width="4" height="14" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  )}
                </button>

                <div className="flex-1">
                  <canvas ref={canvasRef} width={320} height={48} className="w-full h-12" />
                </div>

                <div className={`text-xs shrink-0 ${mine ? "text-white/70" : "text-slate-700"}`}>
                  {formatDuration(audioDuration - currentTime)}
                </div>
                <audio ref={audioRef} src={message.audio_url ?? ""} preload="auto" style={{ display: "none" }} />
              </div>
            )}
          </div>

          {showReactions && (
            <div
              ref={reactionTrayRef}
              className="mt-2 flex flex-wrap items-center gap-2 rounded-full border border-white/10 bg-slate-900/95 px-2.5 py-2 shadow-[0_12px_35px_rgba(15,23,42,0.4)] backdrop-blur-xl"
            >
              {['❤️','😂','🔥','😭','👍'].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleReact(emoji);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-lg transition duration-200 ease-out hover:scale-125 hover:bg-white/10 active:scale-110"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          <div className="mt-2 flex flex-wrap gap-1">
            {Object.entries(reactions).map(([emoji, users]) => (
              <span key={emoji} className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-medium shadow-sm">
                {emoji} {users.length}
              </span>
            ))}
          </div>

          <div className={`flex items-center gap-2 text-[11px] mt-1 ${mine ? "justify-end text-white/70" : "text-slate-500"}`}>
            <span>{timestamp}</span>
            {mine && (
              <span className="ml-1 text-sm">{getStatusIcon(message.status ?? undefined)}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
