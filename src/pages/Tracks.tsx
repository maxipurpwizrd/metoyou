import { useEffect, useRef, useState, type FormEvent, type TouchEvent } from "react";
import { useNavigate } from "react-router-dom";
import { CloudSun, Disc3, LoaderCircle, MessageCircle, MoonStar, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useSession } from "../contexts/SessionContext";
import RequireVibesPro from "../components/RequireVibesPro";
import { addComment, getComments, type CommentRecord } from "../lib/commentApi";
import { getSurfacePostInteractionCounts, hydrateSurfacePostInteractions } from "../lib/surfacePostInteractions";
import { likePost, unlikePost } from "../lib/likeApi";
import { fetchTracksPage, type TrackRecord } from "../lib/tracksApi";
import { useAuth } from "../hooks/useAuth";
import SurfaceDock from "../components/SurfaceDock";

const PAGE_SIZE = 8;

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
  const navigate = useNavigate();
  const { profile } = useSession();
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const requestRef = useRef(0);
  const [theme, setTheme] = useState<"bluesky" | "dark">(() => (
    typeof window !== "undefined" && window.localStorage.getItem("metoyou-clips-theme") === "dark" ? "dark" : "bluesky"
  ));
  const [tracks, setTracks] = useState<TrackRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");

  const isDark = theme === "dark";
  const currentTrack = tracks[currentIndex];

  useEffect(() => {
    window.localStorage.setItem("metoyou-clips-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!profile?.is_vibes_pro) {
      setLoading(false);
      return;
    }

    const requestId = ++requestRef.current;
    setLoading(true);
    void fetchTracksPage(PAGE_SIZE)
      .then(async (rows) => {
        const hydrated = await hydrateSurfacePostInteractions(rows, user?.id);
        if (requestId !== requestRef.current) return;
        setTracks(hydrated);
        setCurrentIndex(0);
        setHasMore(rows.length === PAGE_SIZE);
      })
      .catch(() => {
        if (requestId === requestRef.current) setError("Unable to load Tracks right now.");
      })
      .finally(() => {
        if (requestId === requestRef.current) setLoading(false);
      });

    return () => {
      requestRef.current += 1;
      audioRef.current?.pause();
    };
  }, [profile?.is_vibes_pro, user?.id]);

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

  const play = async () => {
    if (!audioRef.current || !currentTrack) return;
    try {
      await audioRef.current.play();
      setIsPlaying(true);
      setAudioError(null);
    } catch {
      setIsPlaying(false);
      setAudioError("This Track could not be played.");
    }
  };

  const pause = () => {
    audioRef.current?.pause();
    setIsPlaying(false);
  };

  const next = async () => {
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

  const toggleLike = async () => {
    if (!user || !currentTrack) return;
    const result = currentTrack.liked ? await unlikePost(currentTrack.id, user.id) : await likePost(currentTrack.id, user.id);
    if (!result) return;
    const counts = await getSurfacePostInteractionCounts(currentTrack.id);
    setTracks((current) => current.map((track) => track.id === currentTrack.id ? { ...track, ...counts, liked: !currentTrack.liked } : track));
  };

  const toggleComments = async () => {
    const nextOpen = !commentsOpen;
    setCommentsOpen(nextOpen);
    if (nextOpen && currentTrack && comments.length === 0) {
      setCommentsLoading(true);
      try {
        setComments(await getComments(currentTrack.id));
      } finally {
        setCommentsLoading(false);
      }
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
        <button type="button" onClick={() => setTheme("bluesky")} aria-label="Use BlueSky theme" className={`absolute left-0 grid h-10 w-10 place-items-center rounded-full border shadow-sm ${theme === "bluesky" ? "border-sky-500 bg-sky-500 text-white" : isDark ? "border-white/15 bg-white/5 text-white/60" : "border-sky-200 bg-white/70 text-sky-600"}`}><CloudSun className="h-5 w-5" /></button>
        <div><p className={`text-xs font-semibold uppercase tracking-[0.3em] ${isDark ? "text-amber-300" : "text-sky-600"}`}>VibesPro</p><h1 className={`text-3xl font-black ${isDark ? "text-amber-100" : "text-slate-950"}`}>Tracks</h1></div>
        <button type="button" onClick={() => setTheme("dark")} aria-label="Use Dark Gold theme" className={`absolute right-0 grid h-10 w-10 place-items-center rounded-full border shadow-sm ${theme === "dark" ? "border-amber-300 bg-amber-400 text-slate-950" : "border-sky-200 bg-white/70 text-slate-700"}`}><MoonStar className="h-5 w-5" /></button>
      </div>

      {loading && <TrackSkeleton />}
      {error && <p className="mx-auto mb-3 max-w-xl rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {!loading && tracks.length === 0 && !error && <div className="mx-auto max-w-xl rounded-3xl border border-sky-100 bg-white/80 p-10 text-center text-slate-600 shadow-xl"><Disc3 className="mx-auto h-12 w-12 text-sky-500" /><h2 className="mt-4 text-xl font-bold text-slate-900">No Tracks yet.</h2><p className="mt-2 text-sm">Drop a vibe with some music and it can live here.</p></div>}

      {currentTrack && (
        <section className={`mx-auto max-w-xl rounded-3xl border p-4 shadow-2xl ${isDark ? "border-amber-300/20 bg-[#151515] text-white" : "border-sky-100 bg-white/90 text-slate-900"}`}>
          <div className="mx-auto aspect-square max-w-md overflow-hidden rounded-2xl bg-slate-950 shadow-xl">
            {currentTrack.image_url ? <img src={currentTrack.image_url} alt={`${currentTrack.username}'s Track cover`} className="h-full w-full object-cover" /> : <div className={`grid h-full w-full place-items-center ${isDark ? "bg-linear-to-br from-amber-950 via-slate-950 to-black" : "bg-linear-to-br from-sky-600 via-cyan-500 to-blue-700"}`}><Disc3 className={`h-2/3 w-2/3 ${isPlaying ? "animate-spin" : ""} ${isDark ? "text-amber-300" : "text-white"}`} /></div>}
          </div>
          <div className="mt-5 text-center"><button type="button" onClick={() => navigate(`/profile/${encodeURIComponent(currentTrack.username)}`)} className={`font-semibold hover:underline ${isDark ? "text-amber-200" : "text-sky-700"}`}>@{currentTrack.username}</button><h2 className="mt-1 text-2xl font-black">{currentTrack.text?.trim() || "Untitled Track"}</h2></div>
          <audio ref={audioRef} src={currentTrack.audio_url} preload="metadata" onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || duration)} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => void next()} onError={() => { setIsPlaying(false); setAudioError("This Track could not be played."); }} />
          <div className="mt-5"><input type="range" min={0} max={Math.max(duration, 0)} step={0.1} value={Math.min(currentTime, duration || 0)} onChange={(event) => { const value = Number(event.target.value); if (audioRef.current) audioRef.current.currentTime = value; setCurrentTime(value); }} className="w-full accent-sky-500" aria-label="Track progress" /><div className="flex justify-between text-xs opacity-60"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div></div>
          {audioError && <p className="mt-3 text-center text-sm text-rose-500">{audioError}</p>}
          <div className="mt-5 flex items-center justify-center gap-5"><button type="button" onClick={previous} aria-label="Previous Track" className="grid h-11 w-11 place-items-center rounded-full border border-current/20"><SkipBack className="h-5 w-5" /></button><button type="button" onClick={() => void (isPlaying ? pause() : play())} aria-label={isPlaying ? "Pause Track" : "Play Track"} className={`grid h-14 w-14 place-items-center rounded-full ${isDark ? "bg-amber-400 text-slate-950" : "bg-sky-500 text-white"}`}>{isPlaying ? <Pause className="h-6 w-6" /> : <Play className="ml-0.5 h-6 w-6 fill-current" />}</button><button type="button" onClick={() => void next()} aria-label="Next Track" className="grid h-11 w-11 place-items-center rounded-full border border-current/20"><SkipForward className="h-5 w-5" /></button></div>
          <div className="mt-5 flex items-center justify-between border-t border-current/10 pt-4"><button type="button" onClick={() => void toggleLike()} className="font-semibold">{currentTrack.liked ? "❤️" : "🤍"} {currentTrack.likes_count}</button><button type="button" onClick={() => void toggleComments()} className="inline-flex items-center gap-2 font-semibold"><MessageCircle className="h-5 w-5" />{currentTrack.comments_count}</button></div>
        </section>
      )}

      {commentsOpen && currentTrack && <div className={`fixed inset-x-[3%] bottom-[10%] z-50 mx-auto flex max-h-[80vh] max-w-xl flex-col overflow-hidden rounded-2xl border p-4 shadow-2xl ${isDark ? "border-white/15 bg-slate-950 text-white" : "border-sky-100 bg-white text-slate-900"}`}><div className="mb-3 flex items-center justify-between"><h3 className="font-bold">Comments</h3><button type="button" onClick={() => setCommentsOpen(false)} className="text-sm opacity-60">Close</button></div><div className="max-h-[calc(80vh-10rem)] overflow-y-auto space-y-2">{commentsLoading ? <p className="text-sm opacity-60">Loading...</p> : comments.length === 0 ? <p className="text-sm opacity-60">No comments yet.</p> : comments.map((comment) => <div key={comment.id} className="rounded-xl border border-current/10 p-3 text-sm"><strong>{comment.profiles?.username ?? "User"}</strong> {comment.text}{comment.voice_url && <audio controls src={comment.voice_url} className="mt-2 h-8 w-full" />}</div>)}</div><form onSubmit={submitComment} className="mt-3 flex gap-2"><textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} rows={3} placeholder="Add a comment" className="min-w-0 flex-1 resize-none rounded-xl border border-current/10 bg-transparent p-2 text-sm" /><button type="submit" className="rounded-xl bg-sky-500 px-3 text-sm font-semibold text-white">Send</button></form></div>}

      {!loading && tracks.length > 0 && hasMore && <div className="mx-auto mt-5 flex max-w-xl justify-center">{loadingMore ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <button type="button" onClick={() => void loadMore()} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Load more</button>}</div>}
      <SurfaceDock />
    </main>
  );
}
