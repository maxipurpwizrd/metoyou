import { useEffect, useRef, useState, type FormEvent, type TouchEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, CloudSun, Disc3, LoaderCircle, MessageCircle, MoonStar, Pause, Play, SkipBack, SkipForward, Trash2 } from "lucide-react";
import { useSession } from "../contexts/SessionContext";
import { useLanguage } from "../contexts/LanguageContext";
import RequireVibesPro from "../components/RequireVibesPro";
import { addComment, getComments, type CommentRecord } from "../lib/commentApi";
import { getSurfacePostInteractionCounts, hydrateSurfacePostInteractions } from "../lib/surfacePostInteractions";
import { likePost, unlikePost } from "../lib/likeApi";
import { fetchTracksPage, type TrackRecord } from "../lib/tracksApi";
import { deletePostFromSupabase, fetchPostByIdFromSupabase } from "../lib/postApi";
import { useAuth } from "../hooks/useAuth";
import SurfaceDock from "../components/SurfaceDock";
import MediaActionMenu, { type MediaAction } from "../components/MediaActionMenu";
import ReportReasonModal, { type PostReportReason } from "../components/ReportReasonModal";
import { submitPostReport } from "../lib/reportApi";

const PAGE_SIZE = 8;
const TRACKS_CACHE_KEY = "metoyou-tracks-cache";

type CachedTracksState = {
  tracks: TrackRecord[];
  currentIndex: number;
  hasMore: boolean;
};

const readTracksCache = (): CachedTracksState => {
  if (typeof window === "undefined") {
    return { tracks: [], currentIndex: 0, hasMore: true };
  }

  try {
    const raw = window.sessionStorage.getItem(TRACKS_CACHE_KEY);
    if (!raw) {
      return { tracks: [], currentIndex: 0, hasMore: true };
    }

    const parsed = JSON.parse(raw) as Partial<CachedTracksState>;
    return {
      tracks: Array.isArray(parsed.tracks) ? parsed.tracks : [],
      currentIndex: typeof parsed.currentIndex === "number" ? parsed.currentIndex : 0,
      hasMore: parsed.hasMore !== false,
    };
  } catch {
    return { tracks: [], currentIndex: 0, hasMore: true };
  }
};

function TrackSkeleton() {
  return (
    <div className="mx-auto max-w-xl animate-pulse rounded-3xl border border-sky-100 bg-white/80 p-5 shadow-xl">
      <div className="mx-auto aspect-square max-w-md rounded-2xl bg-slate-200" />
      <div className="mt-5 space-y-3">
        <div className="h-4 w-32 rounded bg-slate-200" />
        <div className="h-6 w-2/3 rounded bg-slate-200" />
        <div className="h-2 rounded-full bg-slate-200" />
        <div className="mx-auto h-12 w-40 rounded-full bg-slate-200" />
      </div>
    </div>
  );
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function Tracks() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useSession();
  const { user } = useAuth();
  const requestedPostId = new URLSearchParams(location.search).get("postId");
  const requestedCommentsOpen = new URLSearchParams(location.search).get("showComments") === "1";
  const hasQueryFocus = Boolean(requestedPostId);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const requestRef = useRef(0);
  const [theme, setTheme] = useState<"bluesky" | "dark">(() => (
    typeof window !== "undefined" && window.localStorage.getItem("metoyou-clips-theme") === "dark" ? "dark" : "bluesky"
  ));
  const cachedTracks = readTracksCache();
  const hasCachedTracks = cachedTracks.tracks.length > 0;
  const [tracks, setTracks] = useState<TrackRecord[]>(() => cachedTracks.tracks);
  const [focusedTrack, setFocusedTrack] = useState<TrackRecord | null>(null);
  const [focusedTrackLoading, setFocusedTrackLoading] = useState(false);
  const [focusedTrackError, setFocusedTrackError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(() => cachedTracks.currentIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(() => cachedTracks.tracks.length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(() => cachedTracks.hasMore);
  const [error, setError] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(() => Boolean(requestedPostId && requestedCommentsOpen));
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [trackMenuOpen, setTrackMenuOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isDeleteTrackModalOpen, setIsDeleteTrackModalOpen] = useState(false);
  const [isDeletingTrack, setIsDeletingTrack] = useState(false);
  const [deleteTrackError, setDeleteTrackError] = useState<string | null>(null);

  const isDark = theme === "dark";
  const currentTrack = hasQueryFocus ? focusedTrack : tracks[currentIndex];
  const visibleLoading = hasQueryFocus
    ? focusedTrackLoading || (!focusedTrack && !focusedTrackError)
    : loading;
  const visibleError = hasQueryFocus ? focusedTrackError : error;

  const play = async () => {
    if (!audioRef.current || !currentTrack) return;
    try {
      await audioRef.current.play();
      setIsPlaying(true);
      setAudioError(null);
    } catch {
      setIsPlaying(false);
      setAudioError(t("media.trackPlaybackError"));
    }
  };

  const pause = () => {
    audioRef.current?.pause();
    setIsPlaying(false);
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore || tracks.length === 0) return [] as TrackRecord[];
    setLoadingMore(true);
    try {
      const rows = await fetchTracksPage(PAGE_SIZE, tracks[tracks.length - 1].created_at);
      const hydrated = await hydrateSurfacePostInteractions(rows, user?.id);
      const addedTracks = hydrated.filter((track) => !tracks.some((current) => current.id === track.id));
      setTracks((current) => {
        const seen = new Set(current.map((track) => track.id));
        return [...current, ...hydrated.filter((track) => !seen.has(track.id))];
      });
      setHasMore(rows.length === PAGE_SIZE);
      return addedTracks;
    } catch {
      setError("Unable to load more Tracks.");
      return [] as TrackRecord[];
    } finally {
      setLoadingMore(false);
    }
  };

  const next = async () => {
    if (hasQueryFocus) return;
    if (currentIndex < tracks.length - 1) {
      setCurrentIndex((index) => index + 1);
      setIsPlaying(true);
      return;
    }
    if (hasMore) {
      const loaded = await loadMore();
      if (loaded.length > 0) {
        setCurrentIndex((index) => index + 1);
        setIsPlaying(true);
      }
    } else {
      pause();
      setCurrentTime(0);
    }
  };

  const previous = () => {
    if (hasQueryFocus) {
      if (audioRef.current) audioRef.current.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    if (currentTime > 3 && audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    if (currentIndex > 0) {
      setCurrentIndex((index) => index - 1);
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    window.localStorage.setItem("metoyou-clips-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!currentTrack || !("mediaSession" in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.text?.trim() || "Untitled Track",
      artist: currentTrack.username || "MeToYou",
      album: "MeToYou Tracks",
      artwork: currentTrack.image_url ? [{ src: currentTrack.image_url }] : [],
    });
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";

    const actionHandlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ["play", () => void play()],
      ["pause", pause],
      ["nexttrack", () => void next()],
      ["previoustrack", previous],
    ];

    for (const [action, handler] of actionHandlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Some browsers expose Media Session without supporting every action.
      }
    }

    return () => {
      for (const [action] of actionHandlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // Ignore unsupported action cleanup.
        }
      }
    };
  }, [currentTrack, isPlaying]);

  useEffect(() => {
    if (!profile?.is_vibes_pro || hasCachedTracks || hasQueryFocus) return;

    const requestId = ++requestRef.current;
    void (async () => {
      setLoading(true);
      try {
        const rows = await fetchTracksPage(PAGE_SIZE);
        const hydrated = await hydrateSurfacePostInteractions(rows, user?.id);
        if (requestId !== requestRef.current) return;
        setTracks(hydrated);
        setCurrentIndex(0);
        setHasMore(rows.length === PAGE_SIZE);
      } catch {
        if (requestId === requestRef.current) setError("Unable to load Tracks right now.");
      } finally {
        if (requestId === requestRef.current) setLoading(false);
      }
    })();

    return () => {
      requestRef.current += 1;
      audioRef.current?.pause();
    };
  }, [hasCachedTracks, hasQueryFocus, profile?.is_vibes_pro, user?.id]);

  useEffect(() => {
    if (!requestedPostId) {
      setFocusedTrack(null);
      setFocusedTrackError(null);
      setFocusedTrackLoading(false);
      return undefined;
    }

    let active = true;
    setFocusedTrack(null);
    setFocusedTrackError(null);
    setFocusedTrackLoading(true);

    void (async () => {
      try {
        const post = await fetchPostByIdFromSupabase(requestedPostId);
        if (!active) return;
        if (!post?.audio_url) throw new Error("Unable to find this Track.");

        const candidate: TrackRecord = {
          id: post.id,
          author_id: post.author_id,
          username: post.profiles?.username ?? "User",
          profile_pic: post.profiles?.profile_pic ?? null,
          text: post.text ?? null,
          image_url: post.image_url ?? null,
          image_original_url: post.image_original_url ?? null,
          video_url: post.video_url ?? null,
          audio_url: post.audio_url,
          duration_ms: null,
          created_at: post.created_at,
          likes_count: post.likes_count ?? 0,
          comments_count: post.comments_count ?? 0,
        };
        const [hydrated] = await hydrateSurfacePostInteractions([candidate], user?.id);
        if (active) setFocusedTrack(hydrated ?? candidate);
      } catch {
        if (active) setFocusedTrackError("Unable to load this Track right now.");
      } finally {
        if (active) setFocusedTrackLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [requestedPostId, user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!profile?.is_vibes_pro) return;
    window.sessionStorage.setItem(TRACKS_CACHE_KEY, JSON.stringify({ tracks, currentIndex, hasMore }));
  }, [currentIndex, hasMore, profile?.is_vibes_pro, tracks]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    setCurrentTime(0);
    setDuration(currentTrack.duration_ms ? currentTrack.duration_ms / 1000 : 0);
    setAudioError(null);
    setComments([]);
    setCommentsOpen(false);
    audio.pause();
    audio.load();
    if (isPlaying) {
      void audio.play().catch(() => setIsPlaying(false));
    }
  }, [currentIndex, currentTrack?.id]);

  const shouldShowComments = commentsOpen || (hasQueryFocus && requestedCommentsOpen);

  useEffect(() => {
    if (!shouldShowComments || !currentTrack || comments.length > 0) return;
    let active = true;
    setCommentsLoading(true);
    void getComments(currentTrack.id)
      .then((rows) => { if (active) setComments(rows); })
      .finally(() => { if (active) setCommentsLoading(false); });
    return () => { active = false; };
  }, [comments.length, currentTrack?.id, shouldShowComments]);

  const toggleLike = async () => {
    if (!user || !currentTrack) return;
    const result = currentTrack.liked ? await unlikePost(currentTrack.id, user.id) : await likePost(currentTrack.id, user.id);
    if (!result) return;
    const counts = await getSurfacePostInteractionCounts(currentTrack.id);
    if (hasQueryFocus) {
      setFocusedTrack((track) => track ? { ...track, ...counts, liked: !currentTrack.liked } : track);
      return;
    }
    setTracks((current) => current.map((track) => track.id === currentTrack.id ? { ...track, ...counts, liked: !currentTrack.liked } : track));
  };

  const deleteTrack = async () => {
    if (!user || !currentTrack || currentTrack.author_id !== user.id) return;

    setIsDeletingTrack(true);
    setDeleteTrackError(null);
    try {
      const deleted = await deletePostFromSupabase(currentTrack.id);
      if (!deleted) {
        setDeleteTrackError("We couldn't delete this Track. Please try again.");
        return;
      }

      audioRef.current?.pause();
      setIsPlaying(false);
      setTrackMenuOpen(false);
      setIsDeleteTrackModalOpen(false);
      setTracks((current) => current.filter((track) => track.id !== currentTrack.id));
      setCurrentIndex((index) => Math.min(index, Math.max(0, tracks.length - 2)));
      if (hasQueryFocus) {
        setFocusedTrack(null);
        navigate("/tracks", { replace: true });
      }
    } finally {
      setIsDeletingTrack(false);
    }
  };

  const trackActions: MediaAction[] = [
    {
      label: "Share",
      icon: "share",
      onClick: () => {
        setTrackMenuOpen(false);
        if (!currentTrack) return;
        const shareText = `${currentTrack.text?.trim() || "Untitled Track"} — @${currentTrack.username}`;
        if (navigator.share) {
          void navigator.share({ title: "MeToYou Track", text: shareText, url: currentTrack.audio_url ?? window.location.href }).catch(() => undefined);
          return;
        }
        void navigator.clipboard.writeText(`${shareText} ${currentTrack.audio_url ?? window.location.href}`).catch(() => undefined);
      },
    },
    {
      label: "Save",
      icon: "download",
      onClick: () => {
        setTrackMenuOpen(false);
        if (!currentTrack?.audio_url) return;
        const anchor = document.createElement("a");
        anchor.href = currentTrack.audio_url;
        anchor.download = `${(currentTrack.text?.trim() || "track").replace(/\s+/g, "-").toLowerCase()}.mp3`;
        anchor.target = "_blank";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      },
    },
    ...(currentTrack && currentTrack.author_id !== user?.id ? [{
      label: "Report",
      icon: "report" as const,
      onClick: () => {
        setTrackMenuOpen(false);
        setIsReportModalOpen(true);
      },
    }] : []),
    ...(currentTrack && currentTrack.author_id === user?.id ? [{
      label: "Delete",
      icon: "delete" as const,
      tone: "danger" as const,
      onClick: () => {
        setTrackMenuOpen(false);
        setDeleteTrackError(null);
        setIsDeleteTrackModalOpen(true);
      },
    }] : []),
    {
      label: "Close",
      icon: "close",
      onClick: () => setTrackMenuOpen(false),
    },
  ];

  const reportTrack = async (reason: PostReportReason) => {
    if (!user?.id || !currentTrack) throw new Error("Authentication is required to report this Track.");
    await submitPostReport({ postId: currentTrack.id, reportedUserId: currentTrack.author_id, reason });
    window.alert("Report submitted. Thanks for helping keep MeToYou safe.");
    setIsReportModalOpen(false);
  };

  const toggleComments = async () => {
    const nextOpen = !shouldShowComments;
    setCommentsOpen(nextOpen);
    if (hasQueryFocus) {
      const params = new URLSearchParams(location.search);
      if (nextOpen) params.set("showComments", "1");
      else params.delete("showComments");
      const search = params.toString();
      navigate({ pathname: location.pathname, search: search ? `?${search}` : "" }, { replace: true });
    }
  };

  const submitComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !currentTrack || !commentText.trim()) return;
    const added = await addComment(currentTrack.id, user.id, commentText.trim());
    if (!added) return;
    setComments((current) => [...current, added]);
    setCommentText("");
    const counts = await getSurfacePostInteractionCounts(currentTrack.id);
    if (hasQueryFocus) {
      setFocusedTrack((track) => track ? { ...track, ...counts } : track);
      return;
    }
    setTracks((current) => current.map((track) => track.id === currentTrack.id ? { ...track, ...counts } : track));
  };

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, textarea, audio")) return;
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
    navigate(deltaX > 0 ? "/flicks" : "/feed", { replace: true });
  };

  if (!profile?.is_vibes_pro) return <RequireVibesPro>{null}</RequireVibesPro>;

  return (
    <main onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className={`min-h-screen px-3 pb-8 pt-6 transition-colors ${isDark ? "bg-[#0B0B0B]" : "bg-linear-to-br from-sky-100 via-white to-cyan-100"}`}>
      <div className="relative mx-auto mb-4 flex max-w-xl items-center justify-center px-2 text-center">
        <button type="button" onClick={() => setTheme("bluesky")} aria-label={t("media.useBlueSkyTheme")} title={t("media.blueSkyTheme")} className={`absolute left-0 grid h-10 w-10 place-items-center rounded-full border shadow-sm ${theme === "bluesky" ? "border-sky-500 bg-sky-500 text-white" : isDark ? "border-white/15 bg-white/5 text-white/60" : "border-sky-200 bg-white/70 text-sky-600"}`}><CloudSun className="h-5 w-5" /></button>
        <div><p className={`text-xs font-semibold uppercase tracking-[0.3em] ${isDark ? "text-amber-300" : "text-sky-600"}`}>VibesPro</p><h1 className={`text-3xl font-black ${isDark ? "text-amber-100" : "text-slate-950"}`}>Tracks</h1></div>
        {hasQueryFocus && <button type="button" onClick={() => navigate(-1)} aria-label="Back" className={`absolute right-12 grid h-10 w-10 place-items-center rounded-full border shadow-sm ${isDark ? "border-white/15 bg-white/5 text-white" : "border-sky-200 bg-white/80 text-slate-700"}`}><ArrowLeft className="h-5 w-5" /></button>}
        <button type="button" onClick={() => setTheme("dark")} aria-label={t("media.useDarkGoldTheme")} title={t("media.darkGoldTheme")} className={`absolute right-0 grid h-10 w-10 place-items-center rounded-full border shadow-sm ${theme === "dark" ? "border-amber-300 bg-amber-400 text-slate-950" : "border-sky-200 bg-white/70 text-slate-700"}`}><MoonStar className="h-5 w-5" /></button>
      </div>

      {visibleLoading && <TrackSkeleton />}
      {visibleError && <p className="mx-auto mb-3 max-w-xl rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{visibleError}</p>}
      {!visibleLoading && !currentTrack && !visibleError && <div className="mx-auto max-w-xl rounded-3xl border border-sky-100 bg-white/80 p-10 text-center text-slate-600 shadow-xl"><Disc3 className="mx-auto h-12 w-12 text-sky-500" /><h2 className="mt-4 text-xl font-bold text-slate-900">{t("media.noTracks")}</h2><p className="mt-2 text-sm">{t("media.noTracksDescription")}</p></div>}

      {currentTrack && (
        <section className={`mx-auto max-w-xl rounded-3xl border p-4 shadow-2xl ${isDark ? "border-amber-300/20 bg-[#151515] text-white" : "border-sky-100 bg-white/90 text-slate-900"}`}>
          <div className="relative mx-auto aspect-square max-w-md overflow-hidden rounded-2xl bg-slate-950 shadow-xl">
            {currentTrack.image_url ? <img src={currentTrack.image_url} alt={`${currentTrack.username}'s Track cover`} className="h-full w-full object-cover" /> : <div className={`grid h-full w-full place-items-center ${isDark ? "bg-linear-to-br from-amber-950 via-slate-950 to-black" : "bg-linear-to-br from-sky-600 via-cyan-500 to-blue-700"}`}><Disc3 className={`h-2/3 w-2/3 ${isPlaying ? "animate-spin" : ""} ${isDark ? "text-amber-300" : "text-white"}`} /></div>}
            <div className="absolute right-3 top-3 z-10 drop-shadow-md">
              <MediaActionMenu
                open={trackMenuOpen}
                isDark={isDark}
                onToggle={() => setTrackMenuOpen((value) => !value)}
                onClose={() => setTrackMenuOpen(false)}
                actions={trackActions}
              />
            </div>
          </div>
          <div className="mt-5 text-center"><button type="button" onClick={() => navigate(`/profile/${encodeURIComponent(currentTrack.username)}`)} className={`font-semibold hover:underline ${isDark ? "text-amber-200" : "text-sky-700"}`}>@{currentTrack.username}</button><h2 className="mt-1 text-2xl font-black">{currentTrack.text?.trim() || t("media.untitledTrack")}</h2></div>
          <audio ref={audioRef} src={currentTrack.audio_url} preload="metadata" onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || duration)} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => { if (hasQueryFocus) { setIsPlaying(false); setCurrentTime(0); } else void next(); }} onError={() => { setIsPlaying(false); setAudioError("This Track could not be played."); }} />
          <div className="mt-5"><input type="range" min={0} max={Math.max(duration, 0)} step={0.1} value={Math.min(currentTime, duration || 0)} onChange={(event) => { const value = Number(event.target.value); if (audioRef.current) audioRef.current.currentTime = value; setCurrentTime(value); }} className="w-full accent-sky-500" aria-label={t("media.trackProgress")} /><div className="flex justify-between text-xs opacity-60"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div></div>
          {audioError && <p className="mt-3 text-center text-sm text-rose-500">{audioError}</p>}
          <div className="mt-5 flex items-center justify-center gap-5">{!hasQueryFocus && <button type="button" onClick={previous} aria-label={t("media.previousTrack")} className="grid h-11 w-11 place-items-center rounded-full border border-current/20"><SkipBack className="h-5 w-5" /></button>}<button type="button" onClick={() => void (isPlaying ? pause() : play())} aria-label={isPlaying ? t("media.pauseTrack") : t("media.playTrack")} className={`grid h-14 w-14 place-items-center rounded-full ${isDark ? "bg-amber-400 text-slate-950" : "bg-sky-500 text-white"}`}>{isPlaying ? <Pause className="h-6 w-6" /> : <Play className="ml-0.5 h-6 w-6 fill-current" />}</button>{!hasQueryFocus && <button type="button" onClick={() => void next()} aria-label={t("media.nextTrack")} className="grid h-11 w-11 place-items-center rounded-full border border-current/20"><SkipForward className="h-5 w-5" /></button>}</div>
          <div className="mt-5 flex items-center justify-between border-t border-current/10 pt-4">
            <button type="button" onClick={() => void toggleLike()} className="font-semibold">{currentTrack.liked ? "❤️" : "🤍"} {currentTrack.likes_count}</button>
            <button type="button" onClick={() => void toggleComments()} className="inline-flex items-center gap-2 font-semibold"><MessageCircle className="h-5 w-5" />{currentTrack.comments_count}</button>
          </div>
        </section>
      )}

      <ReportReasonModal
        open={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSelect={reportTrack}
      />

      {isDeleteTrackModalOpen && currentTrack && (
        <div className="fixed inset-0 z-10000 grid place-items-center bg-black/45 p-4 backdrop-blur-sm" onClick={() => { if (!isDeletingTrack) setIsDeleteTrackModalOpen(false); }}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-track-title"
            aria-describedby="delete-track-description"
            onClick={(event) => event.stopPropagation()}
            className={`w-full max-w-sm rounded-3xl border p-6 text-center shadow-2xl ${isDark ? "border-rose-300/20 bg-[#171313] text-white" : "border-rose-100 bg-white text-slate-900"}`}
          >
            <div className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl ${isDark ? "bg-rose-400/15 text-rose-300" : "bg-rose-100 text-rose-600"}`}>
              <Trash2 className="h-6 w-6" />
            </div>
            <h2 id="delete-track-title" className="mt-4 text-xl font-bold">{t("media.deleteTrackTitle")}</h2>
            <p id="delete-track-description" className={`mt-2 text-sm ${isDark ? "text-white/65" : "text-slate-600"}`}>
              {t("media.deleteTrackBody").replace("{title}", currentTrack.text?.trim() || t("media.untitledTrack"))}
            </p>
            {deleteTrackError && <p className="mt-3 text-sm text-rose-500" role="alert">{deleteTrackError}</p>}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteTrackModalOpen(false)}
                disabled={isDeletingTrack}
                className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition disabled:opacity-50 ${isDark ? "bg-white/10 text-white hover:bg-white/15" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
              >
                {t("media.keepTrack")}
              </button>
              <button
                type="button"
                onClick={() => void deleteTrack()}
                disabled={isDeletingTrack}
                className="flex-1 rounded-xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:cursor-wait disabled:opacity-60"
              >
                {isDeletingTrack ? t("media.deletingTrack") : t("media.deleteTrack")}
              </button>
            </div>
          </div>
        </div>
      )}

      {shouldShowComments && currentTrack && <div className={`fixed inset-x-[3%] bottom-[10%] z-50 mx-auto flex max-h-[80vh] max-w-xl flex-col overflow-hidden rounded-2xl border p-4 shadow-2xl ${isDark ? "border-white/15 bg-slate-950 text-white" : "border-sky-100 bg-white text-slate-900"}`}><div className="mb-3 flex items-center justify-between"><h3 className="font-bold">{t("media.comments")}</h3><button type="button" onClick={() => void toggleComments()} className="text-sm opacity-60">{t("common.close")}</button></div><div className="max-h-[calc(80vh-10rem)] overflow-y-auto space-y-2">{commentsLoading ? <p className="text-sm opacity-60">{t("media.loading")}</p> : comments.length === 0 ? <p className="text-sm opacity-60">{t("media.noComments")}</p> : comments.map((comment) => <div key={comment.id} className="rounded-xl border border-current/10 p-3 text-sm"><strong>{comment.profiles?.username ?? t("calls.user")}</strong> {comment.text}{comment.voice_url && <audio controls src={comment.voice_url} className="mt-2 h-8 w-full" />}</div>)}</div><form onSubmit={submitComment} className="mt-3 flex gap-2"><textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} rows={3} placeholder={t("media.addComment")} className="min-w-0 flex-1 resize-none rounded-xl border border-current/10 bg-transparent p-2 text-sm" /><button type="submit" className="rounded-xl bg-sky-500 px-3 text-sm font-semibold text-white">{t("media.send")}</button></form></div>}

      {!hasQueryFocus && !loading && tracks.length > 0 && hasMore && <div className="mx-auto mt-5 flex max-w-xl justify-center">{loadingMore ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <button type="button" onClick={() => void loadMore()} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white">{t("media.loadMore")}</button>}</div>}
      <SurfaceDock />
    </main>
  );
}
