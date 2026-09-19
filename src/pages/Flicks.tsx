import { useEffect, useRef, useState, type FormEvent, type TouchEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Ban, CloudSun, Download, Flag, Grid2X2, LoaderCircle, MessageCircle, Mic, MoonStar, Repeat2, Share2, Square, Trash2 } from "lucide-react";
import { fetchFlicksPage, type FlickRecord } from "../lib/flicksApi";
import { likePost, unlikePost } from "../lib/likeApi";
import { addComment, deleteComment, editComment, getComments, type CommentRecord } from "../lib/commentApi";
import { getSurfacePostInteractionCounts, hydrateSurfacePostInteractions } from "../lib/surfacePostInteractions";
import { useVoiceCommentRecorder } from "../hooks/useVoiceCommentRecorder";
import { useAuth } from "../hooks/useAuth";
import SurfaceDock from "../components/SurfaceDock";
import ReportReasonModal, { type PostReportReason } from "../components/ReportReasonModal";
import { deletePostFromSupabase, savePostToSupabase } from "../lib/postApi";
import { submitPostReport } from "../lib/reportApi";

const PAGE_SIZE = 7;

function FlickSkeleton() {
  return (
    <div className="mx-auto min-h-[calc(100svh-6rem)] max-w-xl animate-pulse overflow-hidden rounded-3xl bg-slate-200">
      <div className="h-[calc(100svh-14rem)] bg-slate-300" />
      <div className="space-y-3 p-5">
        <div className="h-4 w-32 rounded bg-slate-300" />
        <div className="h-4 w-3/4 rounded bg-slate-300" />
      </div>
    </div>
  );
}

export default function Flicks() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const requestedImage = new URLSearchParams(location.search).get("image");
  const requestedPostId = new URLSearchParams(location.search).get("postId");
  const [theme, setTheme] = useState<"bluesky" | "dark">(() => {
    if (typeof window === "undefined") return "bluesky";
    return window.localStorage.getItem("metoyou-clips-theme") === "dark" ? "dark" : "bluesky";
  });
  const [flicks, setFlicks] = useState<FlickRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [commentsById, setCommentsById] = useState<Record<string, CommentRecord[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentsLoadingById, setCommentsLoadingById] = useState<Record<string, boolean>>({});
  const [expandedCaptions, setExpandedCaptions] = useState<Record<string, boolean>>({});
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<FlickRecord | null>(null);
  const [blockedAuthorIds, setBlockedAuthorIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("metoyou-muted-users") ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const longPressTimerRef = useRef<number | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const { isRecording, recordingDuration, voiceUrl, startRecording, stopRecording, clearVoiceUrl } = useVoiceCommentRecorder();
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDark = theme === "dark";

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
    if (Math.abs(deltaX) < 80 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.35) return;
    if (deltaX >= 80) navigate("/clips", { replace: true });
    else if (deltaX <= -80) navigate("/tracks", { replace: true });
  };

  useEffect(() => {
    window.localStorage.setItem("metoyou-clips-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!menuFor) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [menuFor]);

  useEffect(() => {
    if (!commentsFor) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [commentsFor]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const rows = await fetchFlicksPage(PAGE_SIZE);
        if (!active) return;

        const hydratedRows = await hydrateSurfacePostInteractions(rows, user?.id);

        const selectedIndex = hydratedRows.findIndex((flick) => (
          (requestedPostId && flick.id === requestedPostId)
          || (requestedImage && (flick.image_url === requestedImage || flick.image_original_url === requestedImage))
        ));
        const orderedRows = selectedIndex >= 0
          ? [hydratedRows[selectedIndex], ...hydratedRows.filter((_, index) => index !== selectedIndex)]
          : requestedImage
            ? [{
                id: requestedPostId ?? `image-${Date.now()}`,
                author_id: "",
                username: "Image",
                profile_pic: null,
                text: null,
                image_url: requestedImage,
                image_original_url: requestedImage,
                video_url: null,
                audio_url: null,
                duration_ms: null,
                created_at: new Date().toISOString(),
                likes_count: 0,
                comments_count: 0,
                liked: false,
              }, ...hydratedRows]
            : hydratedRows;

        setFlicks(orderedRows);
        setHasMore(rows.length === PAGE_SIZE);
      } catch {
        if (active) setError("Unable to load Flicks right now.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [requestedImage, requestedPostId, user?.id]);

  const loadMore = async () => {
    if (loadingMore || !hasMore || flicks.length === 0) return;
    setLoadingMore(true);
    setError(null);
    try {
      const rows = await fetchFlicksPage(PAGE_SIZE, flicks[flicks.length - 1].created_at);
      const hydratedRows = await hydrateSurfacePostInteractions(rows, user?.id);

      setFlicks((current) => {
        const seen = new Set(current.map((flick) => flick.id));
        return [...current, ...hydratedRows.filter((flick) => !seen.has(flick.id))];
      });
      setHasMore(rows.length === PAGE_SIZE);
    } catch {
      setError("Unable to load more Flicks. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || !hasMore || loading || loadingMore || flicks.length === 0) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadMore();
      },
      { rootMargin: "0px 0px 600px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [flicks.length, hasMore, loading, loadingMore]);

  const toggleLike = async (flick: FlickRecord) => {
    if (!user) return;
    try {
      const currentLiked = Boolean(flick.liked);
      if (currentLiked) {
        const removed = await unlikePost(flick.id, user.id);
        if (removed) {
          const counts = await getSurfacePostInteractionCounts(flick.id);
          setFlicks((current) => current.map((item) => item.id === flick.id ? {
            ...item,
            liked: false,
            ...counts,
          } : item));
        }
        return;
      }

      const savedLike = await likePost(flick.id, user.id);
      if (savedLike) {
        const counts = await getSurfacePostInteractionCounts(flick.id);
        setFlicks((current) => current.map((item) => item.id === flick.id ? {
          ...item,
          liked: true,
          ...counts,
        } : item));
      }
    } catch {
      setError("Unable to update this Flick right now.");
    }
  };

  const toggleComments = async (flick: FlickRecord) => {
    const isOpen = commentsFor === flick.id;
    setCommentsFor(isOpen ? null : flick.id);

    if (isOpen) return;

    if (!commentsById[flick.id]) {
      setCommentsLoadingById((current) => ({ ...current, [flick.id]: true }));
      try {
        const nextComments = await getComments(flick.id);
        setCommentsById((current) => ({ ...current, [flick.id]: nextComments }));
      } finally {
        setCommentsLoadingById((current) => ({ ...current, [flick.id]: false }));
      }
    }
  };

  const submitComment = async (event: FormEvent, flick: FlickRecord) => {
    event.preventDefault();
    if (!user) return;

    const text = (commentDrafts[flick.id] ?? "").trim();
    if (!text && !voiceUrl) return;

    const added = await addComment(flick.id, user.id, text, voiceUrl);
    if (!added) return;
    const counts = await getSurfacePostInteractionCounts(flick.id);

    setCommentsById((current) => ({
      ...current,
      [flick.id]: [...(current[flick.id] ?? []), added],
    }));
    setCommentDrafts((current) => ({ ...current, [flick.id]: "" }));
    clearVoiceUrl();
    setFlicks((current) => current.map((item) => item.id === flick.id ? { ...item, ...counts } : item));
  };

  const toggleCaption = (flickId: string) => {
    setExpandedCaptions((current) => ({
      ...current,
      [flickId]: !(current[flickId] ?? false),
    }));
  };

  const shareFlick = async (flick: FlickRecord) => {
    const url = `${window.location.origin}/flicks?postId=${encodeURIComponent(flick.id)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${flick.username}'s Flick`, text: flick.text ?? "", url });
      } else {
        await navigator.clipboard.writeText(url);
        window.alert("Link copied to clipboard.");
      }
    } catch {
      // Sharing was cancelled.
    }
    setMenuFor(null);
  };

  const saveFlickToDevice = async (flick: FlickRecord) => {
    try {
      const response = await fetch(flick.image_original_url ?? flick.image_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `flick-${flick.id}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      window.alert("Unable to save this Flick.");
    }
    setMenuFor(null);
  };

  const repostFlick = async (flick: FlickRecord) => {
    if (!user) return;
    try {
      await savePostToSupabase({ author_id: user.id, text: flick.text, image_url: flick.image_url, image_original_url: flick.image_original_url });
      window.alert("Reposted to your feed.");
    } catch {
      window.alert("Unable to repost this Flick.");
    }
    setMenuFor(null);
  };

  const reportFlick = async (flick: FlickRecord, reason: PostReportReason) => {
    if (!user) return;
    await submitPostReport({ postId: flick.id, reporterId: user.id, reportedUserId: flick.author_id, reason });
    window.alert("Report submitted. Thanks for helping keep MeToYou safe.");
    setReportTarget(null);
  };

  const blockFlickAuthor = (flick: FlickRecord) => {
    const next = blockedAuthorIds.includes(flick.author_id) ? blockedAuthorIds : [...blockedAuthorIds, flick.author_id];
    setBlockedAuthorIds(next);
    localStorage.setItem("metoyou-muted-users", JSON.stringify(next));
    setMenuFor(null);
  };

  const deleteFlick = async (flick: FlickRecord) => {
    if (!user || flick.author_id !== user.id) return;
    if (!window.confirm("Delete this Flick?")) return;

    const deleted = await deletePostFromSupabase(flick.id);
    if (!deleted) {
      window.alert("Unable to delete this Flick right now.");
      return;
    }

    setFlicks((current) => current.filter((item) => item.id !== flick.id));
    setMenuFor(null);
  };

  const startCommentLongPress = (comment: CommentRecord) => {
    if (!user || comment.author_id !== user.id) return;
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
    if (!user || comment.author_id !== user.id) return;
    if (!await deleteComment(comment.id)) return;
    setCommentsById((current) => ({
      ...current,
      [comment.post_id]: (current[comment.post_id] ?? []).filter((item) => item.id !== comment.id),
    }));
    setActiveCommentId(null);
    const counts = await getSurfacePostInteractionCounts(comment.post_id);
    setFlicks((current) => current.map((item) => item.id === comment.post_id ? { ...item, ...counts } : item));
  };

  const saveCommentEdit = async (comment: CommentRecord) => {
    if (!user || comment.author_id !== user.id) return;
    const text = editingCommentText.trim();
    if (!text) return;
    const updated = await editComment(comment.id, text);
    if (!updated) return;
    setCommentsById((current) => ({
      ...current,
      [comment.post_id]: (current[comment.post_id] ?? []).map((item) => item.id === comment.id ? { ...item, text: updated.text } : item),
    }));
    setEditingCommentId(null);
    setActiveCommentId(null);
  };

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
          <h1 className={`text-3xl font-black ${isDark ? "text-amber-100" : "text-slate-950"}`}>Flicks</h1>
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
        {loadingMore && <LoaderCircle className={`absolute right-12 h-5 w-5 animate-spin ${isDark ? "text-amber-300" : "text-sky-600"}`} />}
      </div>

      {loading && <FlickSkeleton />}
      {error && <p className="mx-auto mb-3 max-w-xl rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {!loading && flicks.length === 0 && !error && <p className="mx-auto max-w-xl rounded-2xl bg-white p-6 text-center text-slate-600">No Flicks yet.</p>}

      <div className="space-y-5">
        {flicks.filter((flick) => !blockedAuthorIds.includes(flick.author_id)).map((flick, index) => {
          const caption = flick.text || "";
          const isLongCaption = caption.length > 120;
          const isExpanded = expandedCaptions[flick.id] ?? false;

          return (
            <article key={flick.id} className={`relative mx-auto min-h-[calc(100svh-7rem)] max-w-xl overflow-hidden rounded-3xl shadow-2xl ${isDark ? "bg-[#111111] shadow-amber-950/30" : "bg-slate-950 shadow-sky-900/20"}`}>
              <div className="absolute inset-0 z-0 flex h-full w-full items-center justify-center bg-slate-950">
                <img src={flick.image_url} alt={caption || `${flick.username}'s Flick`} loading={index < 2 ? "eager" : "lazy"} decoding="async" className="max-h-full w-full object-contain" />
              </div>
              <div className="pointer-events-none absolute inset-0 z-10 bg-linear-to-t from-black/85 via-transparent to-black/10" />
              <div className="absolute bottom-0 left-0 right-0 z-20 flex items-end gap-4 p-5 text-white">
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => navigate(`/profile/${encodeURIComponent(flick.username)}`)} className="pointer-events-auto font-bold hover:underline">
                    @{flick.username}
                  </button>
                  {caption ? (
                    <div className={`mt-2 ${isExpanded ? "max-h-40 overflow-y-auto rounded-xl border border-white/15 bg-slate-950/95 p-3 shadow-xl backdrop-blur-sm" : ""}`}>
                      <p className={`text-base text-white/90 ${!isExpanded && isLongCaption ? "line-clamp-3" : ""}`}>
                        {caption}
                      </p>
                      {isLongCaption && (
                        <button
                          type="button"
                          onClick={() => toggleCaption(flick.id)}
                          aria-expanded={isExpanded}
                          className={`pointer-events-auto mt-1 inline-flex text-xs font-semibold underline-offset-2 hover:underline ${isExpanded ? "text-sky-200" : "text-sky-200"}`}
                        >
                          {isExpanded ? "See less" : "See more"}
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-col items-center gap-4">
                  <button type="button" onClick={() => void toggleLike(flick)} aria-label="Like Flick" className="text-2xl transition hover:scale-110">
                    <span aria-hidden="true">{flick.liked ? "❤️" : "🤍"}</span>
                  </button>
                  <span className="text-xs text-white/80">{flick.likes_count}</span>
                  <button type="button" onClick={() => void toggleComments(flick)} aria-label="View comments" className="text-white/90 transition hover:scale-110">
                    <MessageCircle className="h-7 w-7" />
                  </button>
                  <span className="text-xs text-white/80">{flick.comments_count}</span>
                  <div className="relative">
                    <button type="button" onClick={() => setMenuFor((current) => current === flick.id ? null : flick.id)} aria-label="More Flick actions" className="text-white/90 transition hover:scale-110">
                      <Grid2X2 className="h-6 w-6" />
                    </button>
                    {menuFor === flick.id && (
                      <div className="fixed inset-0 z-60 grid place-items-center bg-black/35 p-4">
                        <button type="button" aria-label="Close actions" onClick={() => setMenuFor(null)} className="absolute inset-0" />
                        <div onClick={(event) => event.stopPropagation()} className={`relative z-10 grid w-full max-w-xs grid-cols-2 gap-2 rounded-2xl border p-3 text-left text-xs shadow-2xl ${isDark ? "border-white/15 bg-slate-950 text-white" : "border-sky-100 bg-white text-slate-700"}`}>
                          <button type="button" onClick={() => void shareFlick(flick)} className="flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-center hover:bg-sky-50"><Share2 className="h-5 w-5" />Share</button>
                          <button type="button" onClick={() => void saveFlickToDevice(flick)} className="flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-center hover:bg-sky-50"><Download className="h-5 w-5" />Save to device</button>
                          <button type="button" onClick={() => void repostFlick(flick)} className="flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-center hover:bg-sky-50"><Repeat2 className="h-5 w-5" />Repost</button>
                          {flick.author_id !== user?.id && (
                            <button type="button" onClick={() => { setReportTarget(flick); setMenuFor(null); }} className="flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-center hover:bg-sky-50"><Flag className="h-5 w-5" />Report</button>
                          )}
                          {flick.author_id !== user?.id && (
                            <button type="button" onClick={() => blockFlickAuthor(flick)} className="col-span-2 flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-center text-rose-500 hover:bg-rose-50"><Ban className="h-5 w-5" />Block author</button>
                          )}
                          {flick.author_id === user?.id && (
                            <button type="button" onClick={() => void deleteFlick(flick)} className="col-span-2 flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-center text-rose-500 hover:bg-rose-50"><Trash2 className="h-5 w-5" />Delete</button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {commentsFor === flick.id && (
                <>
                  <button
                    type="button"
                    aria-label="Close comments"
                    onClick={() => setCommentsFor(null)}
                    className="fixed inset-0 z-40 cursor-default bg-black/20"
                  />
                  <div onClick={(event) => event.stopPropagation()} className={`fixed inset-x-[3%] bottom-[10%] z-50 flex max-h-[80vh] flex-col overflow-hidden rounded-2xl p-4 shadow-2xl ring-1 ${isDark ? "bg-slate-950/98 text-white ring-white/15" : "bg-white/98 text-slate-900 ring-sky-200"}`}>
                    <div className="mb-3 flex items-center justify-between">
                      <p className="font-semibold">Comments</p>
                      <button type="button" onClick={() => setCommentsFor(null)} className={isDark ? "text-white/60" : "text-slate-500"}>Close</button>
                    </div>

                    <div className="max-h-[calc(80vh-9rem)] overflow-y-auto pr-1">
                      {commentsLoadingById[flick.id] ? (
                        <p className={isDark ? "text-sm text-white/60" : "text-sm text-slate-500"}>Loading...</p>
                      ) : (commentsById[flick.id] ?? []).length === 0 ? (
                        <p className={isDark ? "text-sm text-white/60" : "text-sm text-slate-500"}>No comments yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {(commentsById[flick.id] ?? []).map((comment) => (
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
                                <p className="max-h-20 overflow-y-auto whitespace-pre-wrap wrap-break-word text-sm leading-5">
                                  <strong>{comment.profiles?.username ?? "User"}</strong> {comment.text}
                                  {comment.voice_url && <audio controls src={comment.voice_url} className="mt-2 h-8 w-full" />}
                                </p>
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
                    <form onSubmit={(event) => void submitComment(event, flick)} className="mt-3 flex w-full items-end gap-2">
                      <textarea
                        value={commentDrafts[flick.id] ?? ""}
                        onChange={(event) => setCommentDrafts((current) => ({ ...current, [flick.id]: event.target.value }))}
                        placeholder="Add a comment"
                        rows={4}
                        className={`w-full min-w-0 flex-1 resize-none overflow-y-auto rounded-xl px-3 py-2 text-sm outline-none ${isDark ? "bg-white/10 text-white placeholder:text-white/45" : "bg-slate-100 text-slate-900 placeholder:text-slate-400"}`}
                      />
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
        })}
      </div>

      <ReportReasonModal
        open={reportTarget !== null}
        onClose={() => setReportTarget(null)}
        onSelect={(reason) => reportTarget ? reportFlick(reportTarget, reason) : Promise.reject(new Error("No report target selected."))}
      />

      {hasMore && flicks.length > 0 && <div ref={loadMoreSentinelRef} className="h-4" aria-hidden="true" />}
      {loadingMore && <LoaderCircle className="mx-auto mt-5 h-6 w-6 animate-spin text-sky-600" aria-label="Loading more Flicks" />}
      <SurfaceDock />
    </main>
  );
}
