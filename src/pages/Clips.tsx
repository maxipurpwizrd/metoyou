import { useEffect, useRef, useState, type FormEvent, type TouchEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Ban, CloudSun, Download, Flag, Grid2X2, LoaderCircle, MessageCircle, Mic, MoonStar, Music2, Play, Repeat2, Share2, Square, Trash2, Volume2, VolumeX } from "lucide-react";
import { useSession } from "../contexts/SessionContext";
import RequireVibesPro from "../components/RequireVibesPro";
import { fetchClipsPage, type ClipRecord } from "../lib/clipsApi";
import { likePost, unlikePost } from "../lib/likeApi";
import { addComment, deleteComment, editComment, getComments, type CommentRecord } from "../lib/commentApi";
import { getSurfacePostInteractionCounts, hydrateSurfacePostInteractions } from "../lib/surfacePostInteractions";
import { useVoiceCommentRecorder } from "../hooks/useVoiceCommentRecorder";
import { useAuth } from "../hooks/useAuth";
import { deletePostFromSupabase, savePostToSupabase } from "../lib/postApi";
import SurfaceDock from "../components/SurfaceDock";
import ReportReasonModal, { type PostReportReason } from "../components/ReportReasonModal";
import { submitPostReport } from "../lib/reportApi";

const PAGE_SIZE = 8;

function ClipSkeleton() {
  return (
    <div className="mx-auto flex min-h-[calc(100svh-7rem)] max-w-xl animate-pulse flex-col overflow-hidden rounded-3xl bg-slate-900">
      <div className="flex-1 bg-slate-800" />
      <div className="space-y-3 p-5">
        <div className="h-4 w-32 rounded bg-slate-700" />
        <div className="h-4 w-3/4 rounded bg-slate-700" />
      </div>
    </div>
  );
}

function ClipCard({
  clip,
  isActive,
  isDark,
  userId,
  onLike,
  onDelete,
  onVisible,
}: {
  clip: ClipRecord;
  isActive: boolean;
  isDark: boolean;
  userId?: string;
  onLike: (clip: ClipRecord) => void;
  onDelete: (clipId: string) => void;
  onVisible: (node: HTMLDivElement | null) => void;
}) {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [blockedAuthorIds, setBlockedAuthorIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("metoyou-muted-users") ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const longPressTimerRef = useRef<number | null>(null);
  const { isRecording, recordingDuration, voiceUrl, startRecording, stopRecording, clearVoiceUrl } = useVoiceCommentRecorder();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.muted = isMuted;
      void video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [isActive, isMuted]);

  useEffect(() => {
    if (!commentsOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [commentsOpen]);

  useEffect(() => {
    if (!menuOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [menuOpen]);

  const toggleLike = async () => {
    if (!userId) return;
    const nextLiked = !clip.liked;
    try {
      const result = nextLiked
        ? await likePost(clip.id, userId)
        : await unlikePost(clip.id, userId);
      if (!result) return;
      const counts = await getSurfacePostInteractionCounts(clip.id);
      onLike({ ...clip, liked: nextLiked, ...counts });
    } catch {
      onLike(clip);
    }
  };

  const toggleComments = async () => {
    const nextOpen = !commentsOpen;
    setCommentsOpen(nextOpen);
    if (nextOpen && comments.length === 0) {
      setCommentsLoading(true);
      try {
        setComments(await getComments(clip.id));
      } finally {
        setCommentsLoading(false);
      }
    }
  };

  const submitComment = async (event: FormEvent) => {
    event.preventDefault();
    const text = commentText.trim();
    if ((!text && !voiceUrl) || !userId) return;
    const added = await addComment(clip.id, userId, text, voiceUrl);
    if (added) {
      setComments((current) => [...current, added]);
      setCommentText("");
      clearVoiceUrl();
      onLike({ ...clip, ...(await getSurfacePostInteractionCounts(clip.id)) });
    }
  };

  const startCommentLongPress = (comment: CommentRecord) => {
    if (!userId || comment.author_id !== userId) return;
    if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      setActiveCommentId(comment.id);
      longPressTimerRef.current = null;
    }, 500);
  };

  const cancelCommentLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const removeComment = async (comment: CommentRecord) => {
    if (!userId || comment.author_id !== userId) return;
    if (!await deleteComment(comment.id)) return;
    setComments((current) => current.filter((item) => item.id !== comment.id));
    setActiveCommentId(null);
    onLike({ ...clip, ...(await getSurfacePostInteractionCounts(clip.id)) });
  };

  const saveCommentEdit = async (comment: CommentRecord) => {
    if (!userId || comment.author_id !== userId) return;
    const text = editingCommentText.trim();
    if (!text) return;
    const updated = await editComment(comment.id, text);
    if (!updated) return;
    setComments((current) => current.map((item) => item.id === comment.id ? { ...item, text: updated.text } : item));
    setEditingCommentId(null);
    setActiveCommentId(null);
  };

  const shareClip = async () => {
    const url = `${window.location.origin}/clips`;
    try {
      if (navigator.share) await navigator.share({ title: `${clip.username}'s Clip`, text: clip.text ?? "", url });
      else await navigator.clipboard.writeText(url);
    } catch {
      // Sharing was cancelled.
    }
    setMenuOpen(false);
  };

  const saveClipToDevice = async () => {
    try {
      const response = await fetch(clip.video_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `clip-${clip.id}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      window.alert("Unable to save this Clip.");
    }
    setMenuOpen(false);
  };

  const repostClip = async () => {
    if (!userId) return;
    try {
      await savePostToSupabase({ author_id: userId, text: clip.text, image_url: clip.image_url, video_url: clip.video_url });
      window.alert("Reposted to your feed.");
    } catch {
      window.alert("Unable to repost this Clip.");
    }
    setMenuOpen(false);
  };

  const reportClip = async (reason: PostReportReason) => {
    if (!userId) return;
    await submitPostReport({ postId: clip.id, reporterId: userId, reportedUserId: clip.author_id, reason });
    window.alert("Report submitted. Thanks for helping keep MeToYou safe.");
    setIsReportModalOpen(false);
  };

  const blockClipAuthor = () => {
    const next = blockedAuthorIds.includes(clip.author_id) ? blockedAuthorIds : [...blockedAuthorIds, clip.author_id];
    setBlockedAuthorIds(next);
    localStorage.setItem("metoyou-muted-users", JSON.stringify(next));
    setMenuOpen(false);
  };

  const deleteClip = async () => {
    if (!userId || clip.author_id !== userId) return;
    if (!window.confirm("Delete this Clip?")) return;

    const deleted = await deletePostFromSupabase(clip.id);
    if (!deleted) {
      window.alert("Unable to delete this Clip right now.");
      return;
    }

    onDelete(clip.id);
    setMenuOpen(false);
  };

  if (blockedAuthorIds.includes(clip.author_id)) return null;

  return (
    <article ref={onVisible} className={`relative mx-auto min-h-[calc(100svh-7rem)] max-w-xl overflow-hidden rounded-3xl shadow-2xl ${isDark ? "bg-[#111111] shadow-amber-950/30" : "bg-slate-950 shadow-sky-900/20"}`}>
      <video
        ref={videoRef}
        src={clip.video_url}
        poster={clip.image_url ?? undefined}
        playsInline
        preload={isActive ? "metadata" : "none"}
        loop
        muted={isMuted}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="absolute inset-0 h-full w-full object-cover"
        onClick={() => {
          if (isPlaying) videoRef.current?.pause();
          else void videoRef.current?.play();
        }}
      />

      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/85 via-black/10 to-black/20" />
      {!isPlaying && isActive && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-white">
          <Play className="h-12 w-12 fill-current opacity-90" />
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 flex items-end gap-4 p-5 text-white">
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => navigate(`/profile/${encodeURIComponent(clip.username)}`)} className="pointer-events-auto font-bold hover:underline">
            @{clip.username}
          </button>
          {clip.text ? (
            <div className={`mt-2 ${isCaptionExpanded ? "max-h-40 overflow-y-auto rounded-xl border border-white/15 bg-slate-950/95 p-3 shadow-xl backdrop-blur-sm" : ""}`}>
              <p className={`text-base text-white/90 ${!isCaptionExpanded ? "line-clamp-3" : ""}`}>
                {clip.text}
              </p>
              {clip.text.length > 120 && (
                <button
                  type="button"
                  onClick={() => setIsCaptionExpanded((current) => !current)}
                  aria-expanded={isCaptionExpanded}
                  className="pointer-events-auto mt-1 inline-flex text-xs font-semibold text-sky-200 underline-offset-2 hover:underline"
                >
                  {isCaptionExpanded ? "See less" : "See more"}
                </button>
              )}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col items-center gap-4">
          <button type="button" onClick={() => void toggleLike()} aria-label="Like clip" className="text-2xl transition hover:scale-110">
            {clip.liked ? "❤️" : "🤍"}
          </button>
          <span className="text-xs text-white/80">{clip.likes_count}</span>
          <button type="button" onClick={() => void toggleComments()} aria-label="Comments" className="text-white/90">
            <MessageCircle className="h-7 w-7" />
          </button>
          <span className="text-xs text-white/80">{clip.comments_count}</span>
          <div className="relative">
            <button type="button" onClick={() => setMenuOpen((current) => !current)} aria-label="More Clip actions" className="text-white/90 transition hover:scale-110">
              <Grid2X2 className="h-6 w-6" />
            </button>
            {menuOpen && (
              <div className="fixed inset-0 z-60 grid place-items-center bg-black/35 p-4">
                <button type="button" aria-label="Close actions" onClick={() => setMenuOpen(false)} className="absolute inset-0" />
                <div onClick={(event) => event.stopPropagation()} className={`relative z-10 grid w-full max-w-xs grid-cols-2 gap-2 rounded-2xl border p-3 text-left text-xs shadow-2xl ${isDark ? "border-white/15 bg-slate-950 text-white" : "border-sky-100 bg-white text-slate-700"}`}>
                  <button type="button" onClick={() => void shareClip()} className="flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-center hover:bg-sky-50"><Share2 className="h-5 w-5" />Share</button>
                  <button type="button" onClick={() => void saveClipToDevice()} className="flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-center hover:bg-sky-50"><Download className="h-5 w-5" />Save to device</button>
                  <button type="button" onClick={() => void repostClip()} className="flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-center hover:bg-sky-50"><Repeat2 className="h-5 w-5" />Repost</button>
                  {clip.author_id !== userId && (
                    <button type="button" onClick={() => { setIsReportModalOpen(true); setMenuOpen(false); }} className="flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-center hover:bg-sky-50"><Flag className="h-5 w-5" />Report</button>
                  )}
                  {clip.author_id === userId && (
                    <button type="button" onClick={() => void deleteClip()} className="col-span-2 flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-center text-rose-500 hover:bg-rose-50"><Trash2 className="h-5 w-5" />Delete</button>
                  )}
                  {clip.author_id !== userId && (
                    <button type="button" onClick={blockClipAuthor} className="col-span-2 flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-center text-rose-500 hover:bg-rose-50"><Ban className="h-5 w-5" />Block author</button>
                  )}
                </div>
              </div>
            )}
          </div>
          <button type="button" onClick={() => setIsMuted((value) => !value)} aria-label={isMuted ? "Unmute clip" : "Mute clip"} className="text-white/90">
            {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
          </button>
        </div>
      </div>
      <ReportReasonModal
        open={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSelect={reportClip}
      />
      {commentsOpen && (
        <>
          <button
            type="button"
            aria-label="Close comments"
            onClick={() => setCommentsOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-black/20"
          />
          <div onClick={(event) => event.stopPropagation()} className={`fixed inset-x-[3%] bottom-[10%] z-50 flex max-h-[80vh] flex-col overflow-hidden rounded-2xl p-4 shadow-2xl ring-1 ${isDark ? "bg-slate-950/98 text-white ring-white/15" : "bg-white/98 text-slate-900 ring-sky-200"}`}>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold">Comments</p>
              <button type="button" onClick={() => setCommentsOpen(false)} className={isDark ? "text-white/60" : "text-slate-500"}>Close</button>
            </div>
            <div className="max-h-[calc(80vh-9rem)] overflow-y-auto pr-1">
              {commentsLoading ? <p className={isDark ? "text-sm text-white/60" : "text-sm text-slate-500"}>Loading...</p> : comments.length === 0 ? <p className={isDark ? "text-sm text-white/60" : "text-sm text-slate-500"}>No comments yet.</p> : (
                <div className="space-y-2">
                  {comments.map((comment) => (
                    <div
                      key={comment.id}
                      onPointerDown={() => startCommentLongPress(comment)}
                      onPointerUp={cancelCommentLongPress}
                      onPointerLeave={cancelCommentLongPress}
                      onPointerCancel={cancelCommentLongPress}
                      onContextMenu={(event) => event.preventDefault()}
                      className={`rounded-xl border p-3 ${isDark ? "border-white/10 bg-white/5" : "border-sky-100 bg-sky-50/80"}`}
                    >
                      {editingCommentId === comment.id ? (
                        <div className="space-y-2">
                          <textarea value={editingCommentText} onChange={(event) => setEditingCommentText(event.target.value)} rows={3} className={`w-full resize-none rounded-lg p-2 text-sm outline-none ${isDark ? "bg-white/10" : "bg-slate-100"}`} />
                          <div className="flex gap-2">
                            <button type="button" onClick={() => void saveCommentEdit(comment)} className="rounded-lg bg-sky-500 px-3 py-1 text-xs font-semibold">Save</button>
                            <button type="button" onClick={() => setEditingCommentId(null)} className={`rounded-lg px-3 py-1 text-xs ${isDark ? "bg-white/10" : "bg-slate-100 text-slate-600"}`}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <p className="max-h-20 overflow-y-auto whitespace-pre-wrap wrap-break-word text-sm leading-5"><strong>{comment.profiles?.username ?? "User"}</strong> {comment.text}{comment.voice_url && <audio controls src={comment.voice_url} className="mt-2 h-8 w-full" />}</p>
                      )}
                      {activeCommentId === comment.id && editingCommentId !== comment.id && (
                        <div className={`mt-2 flex gap-2 border-t pt-2 ${isDark ? "border-white/10" : "border-sky-100"}`}>
                          <button type="button" onClick={() => { setEditingCommentId(comment.id); setEditingCommentText(comment.text ?? ""); }} className="text-xs font-semibold text-sky-300">Edit</button>
                          <button type="button" onClick={() => void removeComment(comment)} className="text-xs font-semibold text-rose-300">Delete</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {voiceUrl && (
              <div className={`mb-2 flex items-center gap-2 rounded-xl border p-2 ${isDark ? "border-white/10 bg-white/5" : "border-sky-100 bg-sky-50/80"}`}>
                <audio controls src={voiceUrl} className="h-7 min-w-0 flex-1" />
                <button type="button" onClick={clearVoiceUrl} className={isDark ? "text-xs text-white/60" : "text-xs text-slate-500"}>Remove</button>
              </div>
            )}
            {isRecording && <p className="mb-2 text-xs text-rose-300">Recording voice comment: {recordingDuration}s / 15s</p>}
            <form onSubmit={submitComment} className="mt-3 flex w-full items-end gap-2">
              <textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Add a comment" rows={4} className={`w-full min-w-0 flex-1 resize-none overflow-y-auto rounded-xl px-3 py-2 text-sm outline-none ${isDark ? "bg-white/10 text-white placeholder:text-white/45" : "bg-slate-100 text-slate-900 placeholder:text-slate-400"}`} />
              <button
                type="button"
                onClick={() => void (isRecording ? stopRecording() : startRecording())}
                aria-label={isRecording ? "Stop voice comment" : "Record voice comment"}
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${isRecording ? "bg-rose-500 text-white" : isDark ? "bg-white/10 text-white" : "bg-sky-100 text-sky-700"}`}
              >
                {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <button type="submit" className="shrink-0 rounded-xl bg-sky-500 px-3 py-2 text-sm font-semibold">Send</button>
            </form>
          </div>
        </>
      )}
    </article>
  );
}

export default function Clips() {
  const navigate = useNavigate();
  const { profile } = useSession();
  const { user } = useAuth();
  const [theme, setTheme] = useState<"bluesky" | "dark">(() => {
    if (typeof window === "undefined") return "bluesky";
    return window.localStorage.getItem("metoyou-clips-theme") === "dark" ? "dark" : "bluesky";
  });
  const [clips, setClips] = useState<ClipRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const cardNodesRef = useRef(new Map<string, HTMLDivElement>());
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select")) {
      touchStartRef.current = null;
      return;
    }
    const touch = event.changedTouches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) > 80 && Math.abs(deltaX) > Math.abs(deltaY) * 1.35) {
      navigate(deltaX < 0 ? "/flicks" : "/feed", { replace: true });
    }
  };

  useEffect(() => {
    window.localStorage.setItem("metoyou-clips-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!profile?.is_vibes_pro) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    void fetchClipsPage(PAGE_SIZE)
      .then(async (rows) => {
        if (!active) return;
        setClips(await hydrateSurfacePostInteractions(rows, user?.id));
        setActiveId(rows[0]?.id ?? null);
        setHasMore(rows.length === PAGE_SIZE);
      })
      .catch(() => {
        if (active) setError("Unable to load Clips right now.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      observerRef.current?.disconnect();
    };
  }, [profile?.is_vibes_pro, user?.id]);

  useEffect(() => {
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const clipId = visible.target.getAttribute("data-clip-id");
          if (clipId) setActiveId(clipId);
        }
      },
      { threshold: [0.6, 0.85] }
    );
    cardNodesRef.current.forEach((node) => observerRef.current?.observe(node));

    return () => observerRef.current?.disconnect();
  }, [clips.length]);

  const loadMore = async () => {
    if (loadingMore || !hasMore || clips.length === 0) return;
    setLoadingMore(true);
    setError(null);
    try {
      const rows = await fetchClipsPage(PAGE_SIZE, clips[clips.length - 1].created_at);
      const hydratedRows = await hydrateSurfacePostInteractions(rows, user?.id);
      setClips((current) => {
        const seen = new Set(current.map((clip) => clip.id));
        return [...current, ...hydratedRows.filter((clip) => !seen.has(clip.id))];
      });
      setHasMore(rows.length === PAGE_SIZE);
    } catch {
      setError("Unable to load more Clips. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  };

  if (!profile?.is_vibes_pro) {
    return <RequireVibesPro>{null}</RequireVibesPro>;
  }

  const isDark = theme === "dark";

  return (
    <main onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className={`min-h-screen px-3 pb-8 pt-6 transition-colors ${isDark ? "bg-[#0B0B0B]" : "bg-linear-to-br from-sky-100 via-white to-cyan-100"}`}>
      <div className="relative mx-auto mb-2 flex max-w-xl items-center justify-center px-2 text-center">
        <button
          type="button"
          onClick={() => setTheme("bluesky")}
          aria-label="Use BlueSky theme"
          title="BlueSky theme"
          className={`absolute left-0 grid h-10 w-10 place-items-center rounded-full border shadow-sm transition ${theme === "bluesky" ? "border-sky-500 bg-sky-500 text-white" : isDark ? "border-white/15 bg-white/5 text-white/60" : "border-sky-200 bg-white/70 text-sky-600"}`}
        >
          <CloudSun className="h-5 w-5" />
        </button>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.3em] ${isDark ? "text-amber-300" : "text-sky-600"}`}>VibesPro</p>
          <h1 className={`text-3xl font-black ${isDark ? "text-amber-100" : "text-slate-950"}`}>Clips</h1>
        </div>
        <button
          type="button"
          onClick={() => setTheme("dark")}
          aria-label="Use Dark Gold theme"
          title="Dark Gold theme"
          className={`absolute right-0 grid h-10 w-10 place-items-center rounded-full border shadow-sm transition ${theme === "dark" ? "border-amber-300 bg-amber-400 text-slate-950" : "border-sky-200 bg-white/70 text-slate-700"}`}
        >
          <MoonStar className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => navigate("/tracks", { replace: true })}
          aria-label="Open Tracks"
          title="Tracks"
          className={`absolute right-12 grid h-10 w-10 place-items-center rounded-full border shadow-sm ${isDark ? "border-white/15 bg-white/5 text-amber-300" : "border-sky-200 bg-white/70 text-sky-600"}`}
        >
          <Music2 className="h-5 w-5" />
        </button>
        {loadingMore && <LoaderCircle className={`absolute right-24 h-5 w-5 animate-spin ${isDark ? "text-amber-300" : "text-sky-600"}`} />}
      </div>

      {loading && <ClipSkeleton />}
      {error && <p className="mx-auto mb-3 max-w-xl rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {!loading && clips.length === 0 && !error && <p className="mx-auto max-w-xl rounded-2xl bg-white p-6 text-center text-slate-600">No Clips yet.</p>}

      <div className="space-y-5">
        {clips.map((clip) => (
          <ClipCard
            key={clip.id}
            clip={clip}
            userId={user?.id}
            isActive={activeId === clip.id}
            isDark={isDark}
            onLike={(nextClip) => setClips((current) => current.map((item) => item.id === nextClip.id ? nextClip : item))}
            onDelete={(clipId) => setClips((current) => current.filter((item) => item.id !== clipId))}
            onVisible={(node) => {
              if (node) {
                node.dataset.clipId = clip.id;
                cardNodesRef.current.set(clip.id, node);
                observerRef.current?.observe(node);
              } else {
                cardNodesRef.current.delete(clip.id);
              }
            }}
          />
        ))}
      </div>

      {!loading && hasMore && clips.length > 0 && (
        <button type="button" onClick={() => void loadMore()} className="mx-auto mt-5 block rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50" disabled={loadingMore}>
          {loadingMore ? "Loading..." : "Load more"}
        </button>
      )}
      <SurfaceDock />
    </main>
  );
}
