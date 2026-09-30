import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type TouchEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Ban, CloudSun, Download, Flag, Grid2X2, LoaderCircle, MessageCircle, Mic, MoonStar, Music2, Play, Repeat2, Share2, Square, Trash2, Volume2, VolumeX } from "lucide-react";
import { useSession } from "../contexts/SessionContext";
import RequireVibesPro from "../components/RequireVibesPro";
import { fetchClipsPage, type ClipRecord } from "../lib/clipsApi";
import { likePost, unlikePost } from "../lib/likeApi";
import { addComment, deleteComment, editComment, getComments, type CommentRecord } from "../lib/commentApi";
import { getSurfacePostInteractionCounts, hydrateSurfacePostInteractions } from "../lib/surfacePostInteractions";
import { useVoiceCommentRecorder } from "../hooks/useVoiceCommentRecorder";
import { useAuth } from "../hooks/useAuth";
import { deletePostFromSupabase, fetchPostByIdFromSupabase, savePostToSupabase } from "../lib/postApi";
import SurfaceDock from "../components/SurfaceDock";
import ReportReasonModal, { type PostReportReason } from "../components/ReportReasonModal";
import { submitPostReport } from "../lib/reportApi";
import { restoreSurfaceScrollPosition, saveSurfaceScrollPosition } from "../lib/surfaceScrollPosition";
import { useLanguage } from "../contexts/LanguageContext";

const PAGE_SIZE = 8;
const CLIPS_CACHE_KEY = "metoyou-clips-cache";
const CLIPS_SCROLL_KEY_PREFIX = "metoyou-clips-scroll:";

type CachedClipsState = {
  clips: ClipRecord[];
  activeId: string | null;
  hasMore: boolean;
};

const readClipsCache = (): CachedClipsState => {
  if (typeof window === "undefined") {
    return { clips: [], activeId: null, hasMore: true };
  }

  try {
    const raw = window.sessionStorage.getItem(CLIPS_CACHE_KEY);
    if (!raw) {
      return { clips: [], activeId: null, hasMore: true };
    }

    const parsed = JSON.parse(raw) as Partial<CachedClipsState>;
    return {
      clips: Array.isArray(parsed.clips) ? parsed.clips : [],
      activeId: typeof parsed.activeId === "string" ? parsed.activeId : null,
      hasMore: parsed.hasMore !== false,
    };
  } catch {
    return { clips: [], activeId: null, hasMore: true };
  }
};

function ClipSkeleton() {
  return (
    <div className="mx-auto flex h-dvh w-full max-w-xl animate-pulse snap-start snap-always flex-col overflow-hidden bg-slate-900 md:rounded-3xl">
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
  onOverlayChange,
  initialCommentsOpen = false,
  onCommentsOpenChange,
}: {
  clip: ClipRecord;
  isActive: boolean;
  isDark: boolean;
  userId?: string;
  onLike: (clip: ClipRecord) => void;
  onDelete: (clipId: string) => void;
  onVisible: (node: HTMLDivElement | null) => void;
  onOverlayChange: (clipId: string, isOpen: boolean) => void;
  initialCommentsOpen?: boolean;
  onCommentsOpenChange?: (isOpen: boolean) => void;
}) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoOrientation, setVideoOrientation] = useState<"landscape" | "portrait" | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(initialCommentsOpen);
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

  useEffect(() => {
    if (!commentsOpen || comments.length > 0) return;
    let active = true;
    setCommentsLoading(true);
    void getComments(clip.id)
      .then((rows) => { if (active) setComments(rows); })
      .finally(() => { if (active) setCommentsLoading(false); });
    return () => { active = false; };
  }, [clip.id, comments.length, commentsOpen]);

  useEffect(() => {
    const isOverlayOpen = commentsOpen || menuOpen || isReportModalOpen;
    onOverlayChange(clip.id, isOverlayOpen);
    return () => onOverlayChange(clip.id, false);
  }, [clip.id, commentsOpen, isReportModalOpen, menuOpen, onOverlayChange]);

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
    onCommentsOpenChange?.(nextOpen);
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
    await submitPostReport({ postId: clip.id, reportedUserId: clip.author_id, reason });
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
    <article ref={onVisible} className={`relative mx-auto h-dvh w-full max-w-xl snap-start snap-always overflow-hidden bg-slate-950 shadow-2xl md:rounded-3xl ${isDark ? "shadow-amber-950/30" : "shadow-sky-900/20"}`}>
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
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          setVideoOrientation(video.videoWidth > video.videoHeight ? "landscape" : "portrait");
        }}
        className={`absolute inset-0 h-full w-full ${videoOrientation === "portrait" ? "object-cover" : "object-contain"}`}
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
                  {isCaptionExpanded ? t("media.seeLess") : t("media.seeMore")}
                </button>
              )}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col items-center gap-4">
          <button type="button" onClick={() => void toggleLike()} aria-label={t("media.likeClip")} className="text-2xl transition hover:scale-110">
            {clip.liked ? "❤️" : "🤍"}
          </button>
          <span className="text-xs text-white/80">{clip.likes_count}</span>
          <button type="button" onClick={() => void toggleComments()} aria-label={t("media.comments")} className="text-white/90">
            <MessageCircle className="h-7 w-7" />
          </button>
          <span className="text-xs text-white/80">{clip.comments_count}</span>
          <div className="relative">
            <button type="button" onClick={() => setMenuOpen((current) => !current)} aria-label={t("media.moreClipActions")} className="text-white/90 transition hover:scale-110">
              <Grid2X2 className="h-6 w-6" />
            </button>
            {menuOpen && (
              <div className="fixed inset-0 z-60 grid place-items-center bg-black/35 p-4">
                <button type="button" aria-label={t("media.closeActions")} onClick={() => setMenuOpen(false)} className="absolute inset-0" />
                <div onClick={(event) => event.stopPropagation()} className={`relative z-10 grid w-full max-w-xs grid-cols-2 gap-2 rounded-2xl border p-3 text-left text-xs shadow-2xl ${isDark ? "border-white/15 bg-slate-950 text-white" : "border-sky-100 bg-white text-slate-700"}`}>
                  <button type="button" onClick={() => void shareClip()} className="flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-center hover:bg-sky-50"><Share2 className="h-5 w-5" />{t("common.share")}</button>
                  <button type="button" onClick={() => void saveClipToDevice()} className="flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-center hover:bg-sky-50"><Download className="h-5 w-5" />{t("media.saveToDevice")}</button>
                  <button type="button" onClick={() => void repostClip()} className="flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-center hover:bg-sky-50"><Repeat2 className="h-5 w-5" />{t("media.repost")}</button>
                  {clip.author_id !== userId && (
                    <button type="button" onClick={() => { setIsReportModalOpen(true); setMenuOpen(false); }} className="flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-center hover:bg-sky-50"><Flag className="h-5 w-5" />{t("common.report")}</button>
                  )}
                  {clip.author_id === userId && (
                    <button type="button" onClick={() => void deleteClip()} className="col-span-2 flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-center text-rose-500 hover:bg-rose-50"><Trash2 className="h-5 w-5" />{t("media.delete")}</button>
                  )}
                  {clip.author_id !== userId && (
                    <button type="button" onClick={blockClipAuthor} className="col-span-2 flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-center text-rose-500 hover:bg-rose-50"><Ban className="h-5 w-5" />{t("media.blockAuthor")}</button>
                  )}
                </div>
              </div>
            )}
          </div>
          <button type="button" onClick={() => setIsMuted((value) => !value)} aria-label={isMuted ? t("media.unmuteClip") : t("media.muteClip")} className="text-white/90">
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
            aria-label={t("media.closeComments")}
            onClick={() => { setCommentsOpen(false); onCommentsOpenChange?.(false); }}
            className="fixed inset-0 z-40 cursor-default bg-black/20"
          />
          <div onClick={(event) => event.stopPropagation()} className={`fixed inset-x-[3%] bottom-[10%] z-50 flex max-h-[80vh] flex-col overflow-hidden rounded-2xl p-4 shadow-2xl ring-1 ${isDark ? "bg-slate-950/98 text-white ring-white/15" : "bg-white/98 text-slate-900 ring-sky-200"}`}>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold">{t("media.comments")}</p>
              <button type="button" onClick={() => { setCommentsOpen(false); onCommentsOpenChange?.(false); }} className={isDark ? "text-white/60" : "text-slate-500"}>{t("common.close")}</button>
            </div>
            <div className="max-h-[calc(80vh-9rem)] overflow-y-auto pr-1">
              {commentsLoading ? <p className={isDark ? "text-sm text-white/60" : "text-sm text-slate-500"}>{t("media.loading")}</p> : comments.length === 0 ? <p className={isDark ? "text-sm text-white/60" : "text-sm text-slate-500"}>{t("media.noComments")}</p> : (
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
                            <button type="button" onClick={() => void saveCommentEdit(comment)} className="rounded-lg bg-sky-500 px-3 py-1 text-xs font-semibold">{t("common.saveChanges")}</button>
                            <button type="button" onClick={() => setEditingCommentId(null)} className={`rounded-lg px-3 py-1 text-xs ${isDark ? "bg-white/10" : "bg-slate-100 text-slate-600"}`}>{t("common.cancel")}</button>
                          </div>
                        </div>
                      ) : (
                        <p className="max-h-20 overflow-y-auto whitespace-pre-wrap wrap-break-word text-sm leading-5"><strong>{comment.profiles?.username ?? "User"}</strong> {comment.text}{comment.voice_url && <audio controls src={comment.voice_url} className="mt-2 h-8 w-full" />}</p>
                      )}
                      {activeCommentId === comment.id && editingCommentId !== comment.id && (
                        <div className={`mt-2 flex gap-2 border-t pt-2 ${isDark ? "border-white/10" : "border-sky-100"}`}>
                          <button type="button" onClick={() => { setEditingCommentId(comment.id); setEditingCommentText(comment.text ?? ""); }} className="text-xs font-semibold text-sky-300">{t("media.edit")}</button>
                          <button type="button" onClick={() => void removeComment(comment)} className="text-xs font-semibold text-rose-300">{t("media.delete")}</button>
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
                <button type="button" onClick={clearVoiceUrl} className={isDark ? "text-xs text-white/60" : "text-xs text-slate-500"}>{t("media.remove")}</button>
              </div>
            )}
            {isRecording && <p className="mb-2 text-xs text-rose-300">{t("media.recordingVoiceComment").replace("{duration}", String(recordingDuration))}</p>}
            <form onSubmit={submitComment} className="mt-3 flex w-full items-end gap-2">
              <textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder={t("media.addComment")} rows={4} className={`w-full min-w-0 flex-1 resize-none overflow-y-auto rounded-xl px-3 py-2 text-sm outline-none ${isDark ? "bg-white/10 text-white placeholder:text-white/45" : "bg-slate-100 text-slate-900 placeholder:text-slate-400"}`} />
              <button
                type="button"
                onClick={() => void (isRecording ? stopRecording() : startRecording())}
                aria-label={isRecording ? t("media.stopVoiceComment") : t("media.recordVoiceComment")}
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
  const location = useLocation();
  const { profile } = useSession();
  const { user } = useAuth();
  const requestedPostId = new URLSearchParams(location.search).get("postId");
  const requestedCommentsOpen = new URLSearchParams(location.search).get("showComments") === "1";
  const hasQueryFocus = Boolean(requestedPostId);
  const [theme, setTheme] = useState<"bluesky" | "dark">(() => {
    if (typeof window === "undefined") return "bluesky";
    return window.localStorage.getItem("metoyou-clips-theme") === "dark" ? "dark" : "bluesky";
  });
  const cachedClips = readClipsCache();
  const hasCachedClips = cachedClips.clips.length > 0;
  const [clips, setClips] = useState<ClipRecord[]>(() => cachedClips.clips);
  const [focusedClip, setFocusedClip] = useState<ClipRecord | null>(null);
  const [focusedClipLoading, setFocusedClipLoading] = useState(false);
  const [focusedClipError, setFocusedClipError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(() => cachedClips.activeId ?? cachedClips.clips[0]?.id ?? null);
  const [loading, setLoading] = useState(() => cachedClips.clips.length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(() => cachedClips.hasMore);
  const [error, setError] = useState<string | null>(null);
  const [overlayClipId, setOverlayClipId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const cardNodesRef = useRef(new Map<string, HTMLDivElement>());
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const restoredScrollKeyRef = useRef<string | null>(null);
  const scrollSaveFrameRef = useRef<number | null>(null);
  const scrollCacheKey = `${CLIPS_SCROLL_KEY_PREFIX}${user?.id ?? "anonymous"}`;
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const handleClipOverlayChange = useCallback((clipId: string, isOpen: boolean) => {
    setOverlayClipId((current) => isOpen ? clipId : current === clipId ? null : current);
  }, []);

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
    if (!profile?.is_vibes_pro || hasCachedClips || hasQueryFocus) {
      return;
    }

    let active = true;

    const loadInitialClips = async () => {
      setLoading(true);
      try {
        const rows = await fetchClipsPage(PAGE_SIZE);
        if (!active) return;
        const hydratedRows = await hydrateSurfacePostInteractions(rows, user?.id);
        setClips(hydratedRows);
        setActiveId(hydratedRows[0]?.id ?? null);
        setHasMore(rows.length === PAGE_SIZE);
      } catch {
        if (active) setError("Unable to load Clips right now.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadInitialClips();

    return () => {
      active = false;
      observerRef.current?.disconnect();
    };
  }, [hasCachedClips, hasQueryFocus, profile?.is_vibes_pro, user?.id]);

  useEffect(() => {
    if (!requestedPostId) {
      setFocusedClip(null);
      setFocusedClipError(null);
      setFocusedClipLoading(false);
      return undefined;
    }

    let active = true;
    setFocusedClip(null);
    setFocusedClipError(null);
    setFocusedClipLoading(true);

    void (async () => {
      try {
        const post = await fetchPostByIdFromSupabase(requestedPostId);
        if (!active) return;
        if (!post?.video_url) throw new Error("Unable to find this Clip.");

        const candidate: ClipRecord = {
          id: post.id,
          author_id: post.author_id,
          username: post.profiles?.username ?? "User",
          profile_pic: post.profiles?.profile_pic ?? null,
          text: post.text ?? null,
          image_url: post.image_url ?? null,
          image_original_url: post.image_original_url ?? null,
          video_url: post.video_url,
          audio_url: post.audio_url ?? null,
          duration_ms: null,
          created_at: post.created_at,
          likes_count: post.likes_count ?? 0,
          comments_count: post.comments_count ?? 0,
        };
        const [hydrated] = await hydrateSurfacePostInteractions([candidate], user?.id);
        if (active) setFocusedClip(hydrated ?? candidate);
      } catch {
        if (active) setFocusedClipError("Unable to load this Clip right now.");
      } finally {
        if (active) setFocusedClipLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [requestedPostId, user?.id]);

  useLayoutEffect(() => {
    const scroller = scrollContainerRef.current;
    if (hasQueryFocus) {
      restoredScrollKeyRef.current = null;
      return;
    }
    if (!scroller || loading || clips.length === 0 || restoredScrollKeyRef.current === scrollCacheKey) return;

    restoreSurfaceScrollPosition(scroller, scrollCacheKey);
    restoredScrollKeyRef.current = scrollCacheKey;
  }, [clips.length, hasQueryFocus, loading, scrollCacheKey]);

  useEffect(() => () => {
    if (scrollSaveFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollSaveFrameRef.current);
      scrollSaveFrameRef.current = null;
    }
    if (!hasQueryFocus && scrollContainerRef.current) {
      saveSurfaceScrollPosition(scrollContainerRef.current, scrollCacheKey);
    }
  }, [hasQueryFocus, scrollCacheKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!profile?.is_vibes_pro) return;
    window.sessionStorage.setItem(CLIPS_CACHE_KEY, JSON.stringify({ clips, activeId, hasMore }));
  }, [activeId, clips, hasMore, profile?.is_vibes_pro]);

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

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || !hasMore || loading || loadingMore || clips.length === 0) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        if (loadingMore || !hasMore || clips.length === 0) return;

        void (async () => {
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
        })();
      },
      { rootMargin: "0px 0px 600px 0px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [clips, hasMore, loading, loadingMore, user?.id]);

  if (!profile?.is_vibes_pro) {
    return <RequireVibesPro>{null}</RequireVibesPro>;
  }

  const isDark = theme === "dark";
  const visibleClips = hasQueryFocus ? focusedClip ? [focusedClip] : [] : clips;
  const visibleLoading = hasQueryFocus
    ? focusedClipLoading || (!focusedClip && !focusedClipError)
    : loading;
  const visibleError = hasQueryFocus ? focusedClipError : error;

  return (
    <main onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className={`relative h-dvh w-full overflow-hidden transition-colors ${isDark ? "bg-[#0B0B0B]" : "bg-linear-to-br from-sky-100 via-white to-cyan-100"}`}>
      <div className="absolute left-1/2 top-4 z-40 flex w-full max-w-xl -translate-x-1/2 items-center justify-center px-5 text-center">
        <button
          type="button"
          onClick={() => hasQueryFocus ? navigate(-1) : setTheme("bluesky")}
          aria-label={hasQueryFocus ? "Back" : "Use BlueSky theme"}
          title={hasQueryFocus ? "Back" : "BlueSky theme"}
          className={`absolute left-0 grid h-10 w-10 place-items-center rounded-full border shadow-sm transition ${theme === "bluesky" ? "border-sky-500 bg-sky-500 text-white" : isDark ? "border-white/15 bg-white/5 text-white/60" : "border-sky-200 bg-white/70 text-sky-600"}`}
        >
          {hasQueryFocus ? <ArrowLeft className="h-5 w-5" /> : <CloudSun className="h-5 w-5" />}
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

      <div
        ref={scrollContainerRef}
        data-surface-scroll
        onScroll={(event) => {
          const scroller = event.currentTarget;
          if (scrollSaveFrameRef.current !== null) return;
          scrollSaveFrameRef.current = window.requestAnimationFrame(() => {
            scrollSaveFrameRef.current = null;
            saveSurfaceScrollPosition(scroller, scrollCacheKey);
          });
        }}
        className="absolute inset-0 h-full snap-y snap-mandatory overflow-x-hidden overflow-y-auto overscroll-y-contain"
        style={{ overflowY: overlayClipId ? "hidden" : "auto" }}
      >
        {visibleLoading && <ClipSkeleton />}
        {visibleError && <p className="mx-auto mt-20 max-w-xl rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{visibleError}</p>}
        {!visibleLoading && visibleClips.length === 0 && !visibleError && <p className="mx-auto mt-24 max-w-xl rounded-2xl bg-white p-6 text-center text-slate-600">No Clips yet.</p>}

        <div className="flex w-full flex-col">
          {visibleClips.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              userId={user?.id}
              isActive={hasQueryFocus || activeId === clip.id}
              isDark={isDark}
              initialCommentsOpen={hasQueryFocus && requestedCommentsOpen}
              onCommentsOpenChange={hasQueryFocus ? (isOpen) => {
                const params = new URLSearchParams(location.search);
                if (isOpen) params.set("showComments", "1");
                else params.delete("showComments");
                const search = params.toString();
                navigate({ pathname: location.pathname, search: search ? `?${search}` : "" }, { replace: true });
              } : undefined}
              onLike={(nextClip) => {
                if (hasQueryFocus) setFocusedClip(nextClip);
                else setClips((current) => current.map((item) => item.id === nextClip.id ? nextClip : item));
              }}
              onDelete={(clipId) => {
                setClips((current) => current.filter((item) => item.id !== clipId));
                if (focusedClip?.id === clipId) {
                  setFocusedClip(null);
                  navigate("/clips", { replace: true });
                }
              }}
              onOverlayChange={handleClipOverlayChange}
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

        {!hasQueryFocus && !loading && hasMore && clips.length > 0 && (
          <div ref={loadMoreSentinelRef} className="h-1 snap-none" aria-hidden="true" />
        )}
        {!hasQueryFocus && loadingMore && (
          <div className="py-4 text-center text-sm font-medium text-slate-500">
            Loading more clips...
          </div>
        )}
      </div>
      <SurfaceDock />
    </main>
  );
}
