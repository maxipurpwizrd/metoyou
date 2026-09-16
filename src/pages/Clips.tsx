import { useEffect, useRef, useState, type FormEvent, type TouchEvent } from "react";
import { useNavigate } from "react-router-dom";
import { CloudSun, LoaderCircle, MessageCircle, MoonStar, Play, Volume2, VolumeX } from "lucide-react";
import { useSession } from "../contexts/SessionContext";
import RequireVibesPro from "../components/RequireVibesPro";
import { fetchClipsPage, type ClipRecord } from "../lib/clipsApi";
import { likePost, unlikePost } from "../lib/likeApi";
import { addComment, getComments, type CommentRecord } from "../lib/commentApi";
import { useAuth } from "../hooks/useAuth";

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
  onVisible,
}: {
  clip: ClipRecord;
  isActive: boolean;
  isDark: boolean;
  userId?: string;
  onLike: (clip: ClipRecord) => void;
  onVisible: (node: HTMLDivElement | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [liked, setLiked] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);

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

  const toggleLike = async () => {
    if (!userId) return;
    const nextLiked = !liked;
    setLiked(nextLiked);
    try {
      if (nextLiked) await likePost(clip.id, userId);
      else await unlikePost(clip.id, userId);
      onLike(clip);
    } catch {
      setLiked(!nextLiked);
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
    if (!text || !userId) return;
    const added = await addComment(clip.id, userId, text);
    if (added) {
      setComments((current) => [...current, added]);
      setCommentText("");
    }
  };

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
          <p className="font-bold">@{clip.username}</p>
          <p className="mt-2 line-clamp-3 text-sm text-white/90">{clip.text || ""}</p>
        </div>
        <div className="flex flex-col items-center gap-4">
          <button type="button" onClick={() => void toggleLike()} aria-label="Like clip" className="text-2xl transition hover:scale-110">
            {liked ? "❤️" : "🤍"}
          </button>
          <span className="text-xs text-white/80">{clip.likes_count}</span>
          <button type="button" onClick={() => void toggleComments()} aria-label="Comments" className="text-white/90">
            <MessageCircle className="h-7 w-7" />
          </button>
          <span className="text-xs text-white/80">{clip.comments_count}</span>
          <button type="button" onClick={() => setIsMuted((value) => !value)} aria-label={isMuted ? "Unmute clip" : "Mute clip"} className="text-white/90">
            {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
          </button>
        </div>
      </div>
      {commentsOpen && (
        <div className="absolute inset-x-4 bottom-24 z-20 max-h-64 overflow-y-auto rounded-2xl bg-slate-950/95 p-4 text-white shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-semibold">Comments</p>
            <button type="button" onClick={() => setCommentsOpen(false)} className="text-white/60">Close</button>
          </div>
          {commentsLoading ? <p className="text-sm text-white/60">Loading...</p> : comments.length === 0 ? <p className="text-sm text-white/60">No comments yet.</p> : (
            <div className="space-y-2">
              {comments.map((comment) => <p key={comment.id} className="text-sm"><strong>{comment.profiles?.username ?? "User"}</strong> {comment.text}</p>)}
            </div>
          )}
          <form onSubmit={submitComment} className="mt-3 flex gap-2">
            <input value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Add a comment" className="min-w-0 flex-1 rounded-xl bg-white/10 px-3 py-2 text-sm outline-none" />
            <button type="submit" className="rounded-xl bg-sky-500 px-3 py-2 text-sm font-semibold">Send</button>
          </form>
        </div>
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
    if (deltaX >= 80 && Math.abs(deltaX) > Math.abs(deltaY) * 1.35) {
      navigate("/feed", { replace: true });
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
      .then((rows) => {
        if (!active) return;
        setClips(rows);
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
  }, [profile?.is_vibes_pro]);

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
      setClips((current) => {
        const seen = new Set(current.map((clip) => clip.id));
        return [...current, ...rows.filter((clip) => !seen.has(clip.id))];
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
        {loadingMore && <LoaderCircle className={`absolute right-12 h-5 w-5 animate-spin ${isDark ? "text-amber-300" : "text-sky-600"}`} />}
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
            onLike={() => undefined}
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
    </main>
  );
}
