import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Mic, Square } from "lucide-react";
import ImageViewer from "./ImageViewer";
import { useProfile } from "../contexts/ProfileContext";
import { useAutoplayVideo } from "../hooks/useAutoplayVideo";
import { useAutoplayAudio } from "../hooks/useAutoplayAudio";
import { useVideoContext } from "../contexts/VideoContext";
import type { Comment, User } from "../contexts/FeedContext";

type Props = {
  author: User;
  postId?: string | number;
  authorId?: string;
  time: string;
  text: string;
  image?: string;
  video?: string;
  isVibesPro?: boolean;
  variant?: "default" | "gold";

  comments?: Comment[];
  likes: number;
  liked?: boolean;
  highlighted?: boolean;

  onDeletePost?: () => void;
  onRetryPost?: () => void;
  onEditPost?: () => void;
  onDeleteImage?: () => void;
  onDeleteVideo?: () => void;

  isSelected?: boolean;
  onToggleLike?: () => void;
  onSelectPost?: () => void;
  onClosePost?: () => void;
  onRepost?: () => void;
  onSavePost?: () => void;
  onMuteUser?: () => void;
  onHighlight?: () => void;

  audio?: string;
  uploadState?: "uploading" | "completed" | "waiting-network" | "failed";
  uploadProgress?: number;
  onMediaLoad?: () => void;
  onAddComment?: (comment: { id: number; text?: string; voice?: string }) => void;
  onDeleteComment?: (commentId: number) => void;
  onEditComment?: (commentId: number, newText: string) => void;
  onLikeComment?: (commentId: number) => void;
  onInteractionActivity?: (isActive: boolean) => void;
};

export default function PostCard({
  author,
  postId,
  authorId,
  time,
  text,
  image,
  video,
  isVibesPro = false,
  variant = "default",
  comments,
  likes,
  liked = false,
  highlighted = false,
  isSelected = false,
  onToggleLike,
  onSelectPost,
  onClosePost,
  onRepost,
  onSavePost,
  onMuteUser,
  onDeletePost,
  onRetryPost,
  onEditPost,
  onDeleteImage,
  onDeleteVideo,
  onHighlight,
  audio,
  uploadState,
  uploadProgress,
  onMediaLoad,
  onAddComment,
  onDeleteComment,
  onEditComment,
  onLikeComment,
  onInteractionActivity,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile: currentUser } = useProfile();
  const ownerId = authorId ?? author?.id;
  const isOwner = Boolean(currentUser && ownerId && currentUser.id === ownerId);

  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [newComment, setNewComment] = useState("");
  const [voiceComment, setVoiceComment] = useState<string | undefined>(undefined);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isReadingModeOpen, setIsReadingModeOpen] = useState(false);
  const MAX_RECORDING_SECONDS = 60;

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingTimeoutRef = useRef<number | null>(null);
  const activeVoiceUrlRef = useRef<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const loadTimeoutRef = useRef<number | null>(null);

  // Video autoplay state
  const [isMuted, setIsMuted] = useState(true);
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaErrored, setMediaErrored] = useState(false);
  const { playingVideoId, setPlayingVideoId } = useVideoContext();

  const videoElementId = `video_${postId}`;
  const audioElementId = `audio_${postId}`;

  const videoRef = useAutoplayVideo({
    videoId: videoElementId,
    onVisibilityChange: (isVisible) => {
      if (isVisible && video) {
        setPlayingVideoId(videoElementId);
      } else if (playingVideoId === videoElementId) {
        setPlayingVideoId(null);
      }
    },
    threshold: 0.5,
  });

  // Smart image loading: start loading when element is near-visible (300px threshold)
  // and set timeout to handle slow/failed loads gracefully
  useEffect(() => {
    if (!image || !imgRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && imgRef.current && !imgRef.current.src) {
            imgRef.current.src = image;

            // Set a 8 second timeout - if image hasn't loaded by then, mark as ready anyway
            if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
            loadTimeoutRef.current = window.setTimeout(() => {
              if (!mediaReady && imgRef.current) {
                setMediaReady(true);
              }
              loadTimeoutRef.current = null;
            }, 8000);

            observer.unobserve(imgRef.current);
          }
        });
      },
      { rootMargin: "300px" } // Start loading 300px before element is visible
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      observer.disconnect();
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    };
  }, [image, mediaReady]);

  const audioRef = useAutoplayAudio({
    audioId: audioElementId,
    threshold: 0.6,
    onVisibilityChange: () => undefined,
  });

  const hasVisualMedia = Boolean(image || video);
  const showMedia = Boolean(image || video || audio || text);

  useEffect(() => {
    if (import.meta.env.DEV) {
      const isTextOnly = Boolean(text && !image && !video && !audio);
      if (isTextOnly) {
        console.debug("PostCard: mount text-only", postId);
      }
      return () => {
        if (isTextOnly) console.debug("PostCard: unmount text-only", postId);
      };
    }
    return undefined;
  }, [postId, text, image, video, audio]);

  useEffect(() => {
    if (!isReadingModeOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isReadingModeOpen]);

  useEffect(() => {
    const onScroll = () => setShowMenu(false);
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(target)
      ) {
        setShowMenu(false);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("mousedown", onDocClick);

    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mousedown", onDocClick);
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => setShowMenu(false), 0);
    return () => window.clearTimeout(timeout);
  }, [location.pathname]);

  useEffect(() => {
    if (isRecording || !voiceComment) return;
    void drawWaveformFromUrl(voiceComment);
  }, [voiceComment, isRecording]);

  useEffect(() => {
    if (!image && !video) {
      setMediaReady(true);
      return;
    }

    setMediaReady(false);
    setMediaErrored(false);
  }, [image, video]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (recordingTimeoutRef.current) {
        window.clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }
      stopWaveformVisualization();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      if (activeVoiceUrlRef.current) {
        URL.revokeObjectURL(activeVoiceUrlRef.current);
      }
    };
  }, []);

  const stopWaveformVisualization = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    analyserRef.current = null;

    if (waveCanvasRef.current) {
      const canvasCtx = waveCanvasRef.current.getContext("2d");
      if (canvasCtx) {
        canvasCtx.clearRect(0, 0, waveCanvasRef.current.width, waveCanvasRef.current.height);
      }
    }
  };

  const startWaveformVisualization = (stream: MediaStream) => {
    const AudioContextCtor = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const audioContext = new AudioContextCtor();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const drawWaveform = () => {
      const canvas = waveCanvasRef.current;
      const currentAnalyser = analyserRef.current;
      if (!canvas || !currentAnalyser) return;

      const canvasCtx = canvas.getContext("2d");
      if (!canvasCtx) return;

      const width = (canvas.width = canvas.clientWidth || 240);
      const height = (canvas.height = 40);
      const dataArray = new Uint8Array(currentAnalyser.frequencyBinCount);

      currentAnalyser.getByteFrequencyData(dataArray);
      canvasCtx.clearRect(0, 0, width, height);
      canvasCtx.fillStyle = "rgba(148, 163, 184, 0.2)";
      for (let i = 0; i < width; i += 1) {
        const value = dataArray[i * Math.max(1, Math.floor(dataArray.length / width))] ?? 0;
        const barHeight = Math.max(3, (value / 255) * (height - 8));
        const y = (height - barHeight) / 2;
        canvasCtx.fillRect(i, y, 1, barHeight);
      }

      animationFrameRef.current = window.requestAnimationFrame(drawWaveform);
    };

    drawWaveform();
  };

  const drawWaveformFromUrl = async (audioUrl: string) => {
    const canvas = waveCanvasRef.current;
    if (!canvas) return;

    try {
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const AudioContextCtor = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;

      const audioContext = new AudioContextCtor();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const rawData = audioBuffer.getChannelData(0);
      const canvasCtx = canvas.getContext("2d");
      if (!canvasCtx) return;

      const width = (canvas.width = canvas.clientWidth || 240);
      const height = (canvas.height = 40);
      canvasCtx.clearRect(0, 0, width, height);
      canvasCtx.fillStyle = "rgba(148, 163, 184, 0.2)";
      const blockSize = Math.max(1, Math.floor(rawData.length / width));
      for (let i = 0; i < width; i += 1) {
        let sum = 0;
        const start = i * blockSize;
        for (let j = 0; j < blockSize; j += 1) {
          sum += Math.abs(rawData[start + j] ?? 0);
        }
        const avg = sum / blockSize;
        const barHeight = Math.max(3, avg * height * 2);
        const y = (height - barHeight) / 2;
        canvasCtx.fillRect(i, y, 1, barHeight);
      }

      await audioContext.close();
    } catch {
      const canvasCtx = canvas.getContext("2d");
      if (canvasCtx) {
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const formatRecordingDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const startRecording = async (replaceExisting = false) => {
    if (!replaceExisting && voiceComment) {
      alert("Only one voice comment can be attached at a time.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      mediaStreamRef.current = stream;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const audioUrl = URL.createObjectURL(blob);
        if (activeVoiceUrlRef.current) {
          URL.revokeObjectURL(activeVoiceUrlRef.current);
        }
        activeVoiceUrlRef.current = audioUrl;
        setVoiceComment(audioUrl);
      };

      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
      }
      if (recordingTimeoutRef.current) {
        window.clearTimeout(recordingTimeoutRef.current);
      }
      setRecordingDuration(0);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingDuration((current) => current + 1);
      }, 1000);
      recordingTimeoutRef.current = window.setTimeout(() => {
        stopRecording();
      }, MAX_RECORDING_SECONDS * 1000);

      recorder.start();
      startWaveformVisualization(stream);
      setIsRecording(true);
    } catch {
      alert("Microphone permission denied.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (recordingTimeoutRef.current) {
        window.clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }
      stopWaveformVisualization();
      setIsRecording(false);
    }
  };

  const retryRecording = async () => {
    if (isRecording) return;
    if (activeVoiceUrlRef.current) {
      URL.revokeObjectURL(activeVoiceUrlRef.current);
      activeVoiceUrlRef.current = null;
    }
    setVoiceComment(undefined);
    await startRecording(true);
  };

  const removeVoiceComment = () => {
    if (activeVoiceUrlRef.current) {
      URL.revokeObjectURL(activeVoiceUrlRef.current);
      activeVoiceUrlRef.current = null;
    }
    setVoiceComment(undefined);
  };

  const normalizedText = text?.trim() ?? "";
  const isLongCaption = Boolean(normalizedText) && (normalizedText.length > 220 || normalizedText.split(/\r?\n/).length > 5);
  const captionPreviewText = isLongCaption
    ? normalizedText.length > 220
      ? `${normalizedText.slice(0, 220).trimEnd()}…`
      : `${normalizedText.split(/\r?\n/).slice(0, 7).join("\n")}…`
    : normalizedText;
  const isPremiumTheme = Boolean(isVibesPro || variant === "gold" || author?.is_vibes_pro);

  return (
    <>
      {isPremiumTheme && (
        <style>{`
          @keyframes goldShimmer {
            0% { transform: translateX(-120%); }
            100% { transform: translateX(220%); }
          }
        `}</style>
      )}
      <div
        className={`relative overflow-hidden rounded-[28px] p-5 mb-4 transition-all duration-300 md:rounded-3xl md:p-7 ${
          isPremiumTheme
            ? "border border-amber-200/80 bg-[linear-gradient(135deg,rgba(255,249,196,0.96)_0%,rgba(255,224,130,0.92)_38%,rgba(245,158,11,0.85)_100%)] shadow-[0_0_0_1px_rgba(255,215,0,0.25),0_18px_60px_rgba(217,119,6,0.16)] backdrop-blur-xl"
            : "bg-white/70 backdrop-blur-sm border border-white/40 shadow-sm md:backdrop-blur-md md:shadow-xs"
        } ${
          isSelected
            ? isPremiumTheme
              ? "shadow-[0_0_0_1px_rgba(250,204,21,0.35),0_0_30px_rgba(250,204,21,0.2)]"
              : "shadow-lg ring-1 ring-purple-200/50"
            : isPremiumTheme
              ? "hover:shadow-[0_0_0_1px_rgba(250,204,21,0.32),0_14px_40px_rgba(217,119,6,0.16)]"
              : "hover:bg-white/80"
        }`}
      >
        {isPremiumTheme && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
            <div
              className="absolute inset-y-0 left-[-35%] w-1/2 rotate-6 bg-linear-to-r from-transparent via-white/40 to-transparent"
              style={{ animation: "goldShimmer 3.4s ease-in-out infinite" }}
            />
          </div>
        )}
      <div className="transition-all duration-300" style={{ opacity: uploadState === "uploading" ? 0.6 : 1 }}>
      {/* Header Container */}
      <div className="flex items-center justify-between mb-4">
        {/* Author Left Info Column */}
        <div className="flex items-center gap-3 min-w-0">
          {author.avatar ? (
            <img
              src={author.avatar}
              alt={author.username}
              loading="lazy"
              className="w-10 h-10 rounded-xl object-cover shrink-0 shadow-xs"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-pink-400 via-purple-400 to-blue-400 shrink-0 shadow-xs"></div>
          )}

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <h3
                onClick={() => navigate(`/profile/${author.username}`)}
                className={`font-bold text-sm cursor-pointer transition-colors truncate ${
                  isPremiumTheme ? "text-amber-950 hover:text-amber-700" : "text-slate-800 hover:text-pink-500"
                }`}
              >
                {author.username}
              </h3>
              {isPremiumTheme && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/80 bg-white/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-800 shadow-sm">
                  <span>👑</span>
                  <span>VibesPro</span>
                </span>
              )}
              <span className={`text-[11px] font-medium shrink-0 ${isPremiumTheme ? "text-amber-800/80" : "text-slate-400"}`}>{time}</span>
            </div>
            {highlighted && (
              <span className={`inline-block text-[9px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5 mt-0.5 ${isPremiumTheme ? "bg-amber-100/80 text-amber-800" : "bg-amber-100 text-amber-700"}`}>
                ✨ Highlight
              </span>
            )}
          </div>
        </div>

        {/* Dropdown Options Button Menu - Floats Right */}
        <div className="relative shrink-0">
          <button
            ref={menuButtonRef}
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu((prev) => !prev);
            }}
            className={`font-bold text-lg w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isPremiumTheme ? "text-amber-800 hover:text-amber-900 hover:bg-white/60" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}
          >
            ⋯
          </button>

          {showMenu && (
            <div
              ref={menuRef}
              onMouseDown={(e) => e.stopPropagation()}
              className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-white border border-slate-100 shadow-xl text-xs font-semibold text-slate-600 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100"
            >
              {isOwner ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onEditPost?.();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors"
                  >
                    ✏️ Edit Post
                  </button>

                  {image && (
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteImage?.();
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors"
                    >
                      🗑️ Delete Image
                    </button>
                  )}

                  {video && (
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteVideo?.();
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors"
                    >
                      🗑️ Delete Video
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      onHighlight?.();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors text-amber-600"
                  >
                    {highlighted ? "✨ Unhighlight" : "✨ Highlight"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onDeletePost?.();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-red-50 text-red-500 transition-colors border-t border-slate-50"
                  >
                    🗑️ Delete Post
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.share({ title: `${author.username}'s post`, text, url: window.location.href });
                      } catch (err) {
                        console.warn(err);
                      }
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors"
                  >
                    📤 Share
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onRepost?.();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors"
                  >
                    🔁 Repost
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onSavePost?.();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors"
                  >
                    💾 Save Post
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onMuteUser?.();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors text-slate-500"
                  >
                    🔕 Mute User
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      alert("Report submitted. Thanks for helping keep MeToYou safe.");
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-red-50 text-red-500 transition-colors border-t border-slate-50"
                  >
                    🚩 Report
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/post/${postId ?? ownerId}`);
                  alert("Link copied!");
                  setShowMenu(false);
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors border-t border-slate-50"
              >
                🔗 Copy Link
              </button>
            </div>
          )}
        </div>
      </div>

      {uploadState && (
        <div className="mb-3 rounded-2xl border border-white/50 bg-white/80 px-3 py-2.5 shadow-sm">
          {uploadState === "uploading" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                <span>Uploading... {uploadProgress ?? 0}%</span>
                <span className="text-[10px] uppercase tracking-wide text-pink-500">Live</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div className="h-full rounded-full bg-linear-to-r from-pink-500 via-purple-500 to-blue-500 transition-all duration-300" style={{ width: `${Math.max(4, uploadProgress ?? 0)}%` }} />
              </div>
            </div>
          )}
          {uploadState === "completed" && (
            <div className="text-[11px] font-semibold text-emerald-600">✓ Upload complete</div>
          )}
          {uploadState === "waiting-network" && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-amber-600">
                <span>⚠</span>
                <span>Waiting for network...</span>
              </div>
              <p className="text-[10px] text-slate-500">Will continue automatically</p>
            </div>
          )}
          {uploadState === "failed" && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-red-600">Upload failed</span>
              <button type="button" onClick={(e)=>{e.stopPropagation(); onRetryPost?.();}} className="rounded-full bg-pink-500 px-2.5 py-1 text-[10px] font-semibold text-white">Retry</button>
              <button type="button" onClick={(e)=>{e.stopPropagation(); onDeletePost?.();}} className="rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-700">Delete</button>
            </div>
          )}
        </div>
      )}

      {/* Primary Layout Block Container */}
      {showMedia ? (
        <div className="flex flex-col md:flex-col gap-3.5">
          {hasVisualMedia ? (
            <div className="flex md:flex-col gap-3 md:gap-3.5">
              {/* LEFT: Media Container (45% on mobile, full width on desktop) */}
              <div className={`w-[45%] md:w-full shrink-0 rounded-2xl flex items-center justify-center overflow-hidden relative shadow-inner border ${isPremiumTheme ? "border-amber-200/80 bg-[linear-gradient(135deg,rgba(255,250,205,0.95),rgba(253,230,138,0.9))]" : "bg-linear-to-br from-pink-100 via-purple-100 to-blue-100 border-white/20"}`}>
                {!mediaReady && !mediaErrored && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-pink-300 border-t-transparent" />
                  </div>
                )}

                {video ? (
                  <>
                    <video
                      ref={videoRef}
                      src={video}
                      muted={isMuted}
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-contain bg-black/5"
                      onLoadedData={() => {
                        setMediaReady(true);
                        onMediaLoad?.();
                      }}
                      onError={() => {
                        setMediaReady(true);
                        setMediaErrored(true);
                        onMediaLoad?.();
                      }}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsMuted(!isMuted);
                      }}
                      className="absolute bottom-2 right-2 bg-black/40 hover:bg-black/60 text-white rounded-full w-7 h-7 md:w-9 md:h-9 flex items-center justify-center text-xs md:text-sm transition-colors backdrop-blur-md z-10"
                      title={isMuted ? "Unmute" : "Mute"}
                    >
                      {isMuted ? "🔇" : "🔊"}
                    </button>
                  </>
                ) : (
                  <img
                    ref={imgRef}
                    alt={`${author.username}'s post`}
                    className="w-full h-full object-contain bg-black/5 cursor-pointer active:scale-98 transition-transform"
                    onLoad={() => {
                      setMediaReady(true);
                      if (loadTimeoutRef.current) {
                        clearTimeout(loadTimeoutRef.current);
                        loadTimeoutRef.current = null;
                      }
                      onMediaLoad?.();
                    }}
                    onError={() => {
                      setMediaReady(true);
                      setMediaErrored(true);
                      if (loadTimeoutRef.current) {
                        clearTimeout(loadTimeoutRef.current);
                        loadTimeoutRef.current = null;
                      }
                      onMediaLoad?.();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewerIndex(0);
                      onClosePost?.();
                      setViewerOpen(true);
                    }}
                  />
                )}

                {audio && image && !video && (
                  <div className="absolute bottom-2 left-2 right-2 rounded-xl border border-white/40 bg-white/80 p-2 shadow-sm backdrop-blur-sm">
                    <audio
                      ref={audioRef}
                      src={audio}
                      preload="auto"
                      controls
                      className="w-full h-7"
                    />
                  </div>
                )}
              </div>

              {/* RIGHT: Caption & Interactions (55% on mobile, full width on desktop) */}
              <div className="w-[55%] md:w-full flex flex-col justify-between self-stretch min-h-0">
                <div className={`flex-1 min-h-0 rounded-2xl p-2.5 shadow-sm ${isPremiumTheme ? "border border-amber-200/80 bg-white/70 backdrop-blur-sm" : "border border-slate-100/80 bg-white/70"}`}>
                  <div className="h-full max-h-36 md:max-h-60 overflow-y-auto pr-1 text-base md:text-lg font-medium text-slate-700 leading-relaxed whitespace-pre-wrap wrap-break-word">
                    {isLongCaption ? (
                      <>
                        <div className="whitespace-pre-wrap wrap-break-word">{captionPreviewText}</div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsReadingModeOpen(true);
                          }}
                          className="mt-2 inline-flex items-center rounded-full bg-slate-800 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white"
                        >
                          More
                        </button>
                      </>
                    ) : (
                      <div className="whitespace-pre-wrap wrap-break-word">{normalizedText}</div>
                    )}
                  </div>
                </div>

                {audio && !image && !video && (
                  <div className="mt-2 rounded-xl border border-white/40 bg-white/60 p-2 shadow-sm">
                    <audio
                      ref={audioRef}
                      src={audio}
                      preload="auto"
                      controls
                      className="w-full h-7"
                    />
                  </div>
                )}

                <div className="flex flex-col gap-2 mt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLike?.();
                    }}
                    className={`py-1.5 md:py-2.5 text-xs font-bold text-center transition-colors rounded-lg border ${isPremiumTheme ? "text-amber-800 hover:bg-amber-100/70 border-amber-200/70" : "text-pink-600 hover:bg-pink-50/40 border-pink-200/50 md:border-slate-100"}`}
                  >
                    {liked ? "❤️" : "🤍"} {likes}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPost?.();
                    }}
                    className={`py-1.5 md:py-2.5 text-xs font-bold text-center transition-colors rounded-lg border ${isPremiumTheme ? "text-amber-900 hover:bg-amber-100/70 border-amber-200/70" : "text-blue-600 hover:bg-blue-50/40 border-blue-200/50 md:border-slate-100"}`}
                  >
                    💬 {comments?.length || 0}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className={`rounded-2xl p-2.5 shadow-sm ${isPremiumTheme ? "border border-amber-200/80 bg-white/70 backdrop-blur-sm" : "border border-slate-100/80 bg-white/70"}`}>
                <div className="max-h-60 overflow-y-auto pr-1 text-base md:text-lg font-medium text-slate-700 leading-relaxed whitespace-pre-wrap wrap-break-word">
                  {text}
                </div>
              </div>

              {audio && !video && (
                <div className="rounded-xl border border-white/40 bg-white/60 p-2 shadow-sm">
                  <audio
                    ref={audioRef}
                    src={audio}
                    preload="auto"
                    controls
                    className="w-full h-7"
                  />
                </div>
              )}

              <div className={`flex rounded-xl overflow-hidden shadow-2xs ${isPremiumTheme ? "border border-amber-200/80 bg-white/60" : "bg-white/50 border border-slate-100"}`}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleLike?.();
                  }}
                  className={`flex-1 py-2.5 text-xs font-bold text-center transition-colors ${isPremiumTheme ? "text-amber-800 hover:bg-amber-100/70" : "text-pink-600 hover:bg-pink-50/40"}`}
                >
                  {liked ? "❤️" : "🤍"} {likes} Likes
                </button>
                <div className="w-px bg-slate-100"></div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPost?.();
                  }}
                  className={`flex-1 py-2.5 text-xs font-bold text-center transition-colors ${isPremiumTheme ? "text-amber-900 hover:bg-amber-100/70" : "text-blue-600 hover:bg-blue-50/40"}`}
                >
                  💬 {comments?.length || 0} Comments
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {isReadingModeOpen && (
        <div className="fixed inset-0 z-80 flex items-center justify-center px-3 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => setIsReadingModeOpen(false)}
            className="absolute inset-0 bg-slate-950/25 backdrop-blur-xl"
            aria-label="Close reading mode"
          />
          <div className={`relative z-10 w-full max-w-160 max-h-[85vh] rounded-[28px] p-4 shadow-2xl sm:p-5 ${isPremiumTheme ? "border border-amber-200/80 bg-[linear-gradient(135deg,rgba(255,251,235,0.96),rgba(255,244,183,0.9))]" : "border border-white/60 bg-white/95"}`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className={`truncate text-sm font-semibold ${isPremiumTheme ? "text-amber-950" : "text-slate-800"}`}>{author.username}</p>
                <p className={`text-[11px] ${isPremiumTheme ? "text-amber-800/80" : "text-slate-400"}`}>{time}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsReadingModeOpen(false)}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${isPremiumTheme ? "border-amber-300/80 bg-white/70 text-amber-900" : "border-slate-200 bg-white text-slate-600"}`}
              >
                Show Photo
              </button>
            </div>

            <div className={`max-h-64 overflow-y-auto rounded-2xl p-3.5 text-lg md:text-xl leading-7 whitespace-pre-wrap wrap-break-word shadow-inner sm:p-4 ${isPremiumTheme ? "bg-white/70 text-amber-950" : "bg-slate-50/80 text-slate-700"}`}>
              {normalizedText}
            </div>
          </div>
        </div>
      )}

      {/* Inline Comments Section Extension */}
      {isSelected && (
        <div
          className="mt-4 pt-4 border-t border-slate-200/60 space-y-4"
          onTouchStart={() => onInteractionActivity?.(true)}
          onTouchMove={() => onInteractionActivity?.(true)}
          onTouchEnd={() => onInteractionActivity?.(false)}
          onTouchCancel={() => onInteractionActivity?.(false)}
          onWheel={() => onInteractionActivity?.(true)}
          onPointerDown={() => onInteractionActivity?.(true)}
          onPointerUp={() => onInteractionActivity?.(false)}
        >
          <h4 className="font-bold text-sm text-slate-800 px-0.5">Comments</h4>

          {/* Comments List Scroll Tray */}
          <div className="max-h-56 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
            {comments?.length ? (
              comments.map((comment) => (
                <div
                  key={comment.id}
                  className="bg-slate-50/60 rounded-2xl p-3 border border-slate-100 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p
                      onClick={() => navigate(`/profile/${comment.user.username}`)}
                      className="font-bold text-xs text-slate-800 cursor-pointer hover:text-pink-500 transition-colors"
                    >
                      {comment.user.username}
                    </p>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(Number(comment.id));
                          setEditingText(comment.text || "");
                        }}
                        className="text-slate-400 hover:text-blue-500 text-xs p-0.5"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteComment?.(Number(comment.id))}
                        className="text-slate-400 hover:text-red-500 text-xs p-0.5"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {editingId === Number(comment.id) ? (
                    <div className="space-y-1.5 pt-1">
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs bg-white outline-none focus:border-pink-300"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          onEditComment?.(Number(comment.id), editingText);
                          setEditingId(null);
                        }}
                        className="bg-pink-500 hover:bg-pink-600 text-white font-bold px-3 py-1 rounded-lg text-[11px] transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <p className="text-slate-600 text-xs font-medium leading-relaxed">
                      {comment.text}
                    </p>
                  )}

                  <div className="flex items-center gap-3 pt-0.5">
                    <button
                      type="button"
                      onClick={() => onLikeComment?.(Number(comment.id))}
                      className="text-pink-500 font-bold text-[11px] flex items-center gap-1 hover:scale-105 transition-transform"
                    >
                      <span>❤️</span> {comment.likes}
                    </button>
                  </div>

                  {comment.voice && (
                    <div className="mt-1.5 pt-1 border-t border-slate-100">
                      <audio controls src={comment.voice} className="w-full h-6 opacity-80" />
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-slate-400 text-center text-xs py-4 font-medium">
                No comments yet. Drop a vibe below! 👇
              </p>
            )}
          </div>

          {/* Bottom Interactive Comment Composer Bar */}
          <div className="bg-slate-50 rounded-2xl p-2.5 border border-slate-100 space-y-2">
            <div className="flex gap-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                rows={3}
                className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-pink-300 transition-colors placeholder:text-slate-400 resize-none max-h-30 overflow-y-auto"
                onFocus={() => onInteractionActivity?.(true)}
                onBlur={() => onInteractionActivity?.(false)}
              />

              <button
                type="button"
                onClick={() => {
                  if (isRecording) {
                    stopRecording();
                  } else {
                    void startRecording();
                  }
                }}
                className={`h-11 w-11 rounded-full flex items-center justify-center shrink-0 transition shadow-md ${
                  isRecording ? "bg-red-500 text-white shadow-lg shadow-red-500/40 animate-pulse scale-105" : "bg-blue-500 text-white hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-500/30 active:scale-95"
                }`}
                title={isRecording ? "Stop recording" : "Start recording"}
              >
                {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!newComment.trim() && !voiceComment) return;

                  onAddComment?.({
                    id: Date.now(),
                    text: newComment,
                    voice: voiceComment,
                  });

                  setNewComment("");
                  setVoiceComment(undefined);
                }}
                className="bg-pink-500 hover:bg-pink-600 text-white font-bold px-3.5 rounded-xl text-xs transition-colors shadow-2xs"
              >
                Send
              </button>
            </div>

            {isRecording && (
              <div className="pt-1.5 border-t border-slate-200/50">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[11px] font-semibold text-red-600">Recording voice comment</span>
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                      {formatRecordingDuration(recordingDuration)} / 01:00
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-semibold text-white"
                  >
                    ⏹ Stop
                  </button>
                </div>
                <canvas ref={waveCanvasRef} className="mt-2 h-8 w-full rounded-xl bg-slate-900/90" />
              </div>
            )}

            {voiceComment && !isRecording && (
              <div className="pt-1.5 border-t border-slate-200/50">
                <div className="flex items-center gap-2">
                  <audio controls src={voiceComment} className="h-6 flex-1 opacity-90" />
                  <button
                    type="button"
                    onClick={retryRecording}
                    className="rounded-full border border-pink-300 bg-white px-2.5 py-1 text-[10px] font-semibold text-pink-600"
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    onClick={removeVoiceComment}
                    className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600"
                  >
                    ✕
                  </button>
                </div>
                <canvas ref={waveCanvasRef} className="mt-2 h-8 w-full rounded-xl bg-slate-900/90" />
              </div>
            )}
          </div>

          {/* Close Section Action Block */}
          <button
            type="button"
            onClick={() => onClosePost?.()}
            className="w-full py-2 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-700 font-bold text-xs hover:bg-slate-200/80 transition-colors"
          >
            Close Comments
          </button>
        </div>
      )}

      </div>

      {viewerOpen && image && (
        <ImageViewer
          images={[image]}
          initialIndex={viewerIndex}
          onClose={() => setViewerOpen(false)}
          postId={postId}
          authorId={authorId ?? author.id}
          authorUsername={author.username}
          onEditPost={onEditPost}
          onDeleteImage={onDeleteImage}
          onDeletePost={onDeletePost}
          onRepost={onRepost}
          onMuteUser={onMuteUser}
          variant={isPremiumTheme ? "vibespro" : "default"}
        />
      )}
    </div>
    </>
  );
}