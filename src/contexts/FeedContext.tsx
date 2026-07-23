import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type SetStateAction } from "react";
import { useQueryClient } from '@tanstack/react-query';
import { fetchPostsFromSupabase } from "../lib/postApi";
import { hydratePostComments } from "../lib/commentApi";
import { useAuth } from "../hooks/useAuth";
import { hydratePostLikeState } from "../lib/likeApi";
import { isVibesProEnabled } from "../lib/vibesPro";
import type { PostRecord } from "../types/post";

export type User = {
  id: string;
  username: string;
  avatar?: string;
  is_vibes_pro?: boolean;
};

export type Comment = {
  id: string | number;
  user: User;
  text?: string;
  voice?: string;
  likes: number;
};

export type Post = {
  id: string | number;
  author: User;
  authorId?: string;
  author_id?: string;
  time: string;
  created_at?: string;
  text: string;
  image?: string;
  video?: string;
  audio?: string;
  comments?: Comment[];
  likes?: number;
  likes_count?: number;
  comments_count?: number;
  liked?: boolean;
  highlighted?: boolean;
  uploadState?: "uploading" | "completed" | "waiting-network" | "failed";
  uploadProgress?: number;
  persisted?: boolean;
};

const PAGE_SIZE = 7;
const LOAD_MORE_THRESHOLD = 240;
const FEED_CACHE_KEY = "metoyou-feed-cache";
const FEED_CACHE_TTL_MS = 45_000;

type CachedFeedEntry = {
  posts: Post[];
  cachedAt: number;
};

const readCachedFeed = (): { posts: Post[]; cachedAt: number } | null => {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(FEED_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedFeedEntry>;
    if (!parsed || !Array.isArray(parsed.posts)) return null;
    return {
      posts: parsed.posts as Post[],
      cachedAt: typeof parsed.cachedAt === "number" ? parsed.cachedAt : 0,
    };
  } catch {
    return null;
  }
};

const writeCachedFeed = (posts: Post[]) => {
  if (typeof window === "undefined") return;

  try {
    const entry: CachedFeedEntry = {
      posts: posts.slice(0, 30),
      cachedAt: Date.now(),
    };
    window.localStorage.setItem(FEED_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // ignore cache write failures and keep the app usable
  }
};

type FeedContextValue = {
  posts: Post[];
  setPosts: (updater: SetStateAction<Post[]>) => void;
  loading: boolean;
  refreshPosts: (force?: boolean) => Promise<void>;
  lastFetchTime: number | null;
  savedScrollY: number;
  setSavedScrollY: (y: number) => void;
  selectedPostId: string | number | null;
  setSelectedPostId: (id: string | number | null) => void;
};

const FeedContext = createContext<FeedContextValue | undefined>(undefined);

export function useFeed() {
  const ctx = useContext(FeedContext);
  if (!ctx) throw new Error("useFeed must be used within FeedProvider");
  return ctx;
}

export function FeedProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [posts, setPostsState] = useState<Post[]>(() => readCachedFeed()?.posts ?? []);
  const [loading, setLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(null);
  const [savedScrollY, setSavedScrollY] = useState<number>(0);
  const [selectedPostId, setSelectedPostId] = useState<string | number | null>(null);
  const queryClient = useQueryClient();
  const postsRef = useRef<Post[]>([]);
  const isMountedRef = useRef(true);
  const isFetchingRef = useRef(false);
  const currentRequestId = useRef(0);
  const isDev = import.meta.env.DEV;
  const skipCachedFeed = typeof window !== "undefined" && window.localStorage.getItem("metoyou.skipCachedFeed") === "1";
  if (isDev && typeof window !== "undefined") console.debug("[FeedContext] skipCachedFeed=", skipCachedFeed);

  useEffect(() => {
    postsRef.current = posts;
    writeCachedFeed(posts);
  }, [posts]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const devLog = (...args: unknown[]) => {
    if (isDev) {
      console.debug("[FeedContext]", ...args);
    }
  };

  const getRelativeTime = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 1) return "just now";
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      if (days < 7) return `${days}d ago`;
      return date.toLocaleDateString();
    } catch {
      return "just now";
    }
  };

  const mapRecords = async (records: PostRecord[] | null | undefined, currentUserId?: string) => {
    const safeRecords = Array.isArray(records) ? records : [];

    const mapped = safeRecords.map((r: PostRecord) => ({
      id: r.id,
      author: {
        id: r.author_id,
        username: r.profiles?.username ?? r.author_id,
        avatar: r.profiles?.profile_pic ?? undefined,
        is_vibes_pro: isVibesProEnabled(r.profiles as any),
      },
      authorId: r.author_id,
      author_id: r.author_id,
      time: getRelativeTime(r.created_at),
      created_at: r.created_at,
      text: r.text ?? "",
      image: r.image_url ?? undefined,
      video: r.video_url ?? undefined,
      audio: r.audio_url ?? undefined,
      comments: [],
      likes: r.likes_count ?? 0,
      likes_count: r.likes_count ?? 0,
      comments_count: r.comments_count ?? 0,
      liked: false,
      highlighted: Boolean(r.highlighted),
    } as Post));

    return hydratePostLikeState(mapped, currentUserId);
  };  const syncPosts = (nextPosts: Post[]) => {
    setPosts(nextPosts);
  };

  const normalizeId = (id: string | number) => String(id);

  const mergePostsById = (incoming: Post[], existing: Post[], prependIncoming = false) => {
    const normalized = (post: Post) => normalizeId(post.id);
    const map = new Map<string, Post>();
    const order: string[] = [];

    const addPost = (post: Post) => {
      const postId = normalized(post);
      if (map.has(postId)) {
        const existingPost = map.get(postId)!;
        const mergedPost = { ...existingPost, ...post };
        if (isDev && JSON.stringify(existingPost) !== JSON.stringify(mergedPost)) {
          devLog("mergePostsById duplicate updated", postId, { existingPost, incomingPost: post, mergedPost });
        }
        map.set(postId, mergedPost);
      } else {
        map.set(postId, post);
        order.push(postId);
      }
    };

    const first = prependIncoming ? incoming : existing;
    const second = prependIncoming ? existing : incoming;

    for (const post of first) addPost(post);
    for (const post of second) addPost(post);

    return order.map((id) => map.get(id)!);
  };

  const prependNewPosts = (incoming: Post[]) => {
    if (incoming.length === 0) {
      devLog("prependNewPosts no incoming posts");
      return postsRef.current;
    }

    const nextPosts = mergePostsById(incoming, postsRef.current, true);
    if (nextPosts.length === postsRef.current.length) {
      devLog("prependNewPosts skipped duplicates", incoming.map((post) => post.id));
    } else {
      devLog("prependNewPosts merged posts", {
        incomingIds: incoming.map((post) => post.id),
        resultingCount: nextPosts.length,
      });
    }
    return nextPosts;
  };

  const loadPostsPage = async ({ append = false, refresh = false, background = false } = {}) => {
    if (!user || authLoading) return;
    if (isFetchingRef.current) {
      devLog("loadPostsPage skipped due to active request", { append, refresh, background });
      return;
    }

    if (append) {
      if (!hasMore || postsRef.current.length === 0) return;
      if (!background) setIsLoadingMore(true);
    } else {
      if (!background) setLoading(true);
    }

    const requestId = ++currentRequestId.current;
    isFetchingRef.current = true;

    try {
      const oldestCursor = append ? postsRef.current[postsRef.current.length - 1]?.created_at : undefined;
      const newestCursor = refresh && postsRef.current.length > 0 ? postsRef.current[0]?.created_at : undefined;
      const records = refresh
        ? await fetchPostsFromSupabase({ limit: PAGE_SIZE, after: newestCursor })
        : await fetchPostsFromSupabase({ limit: PAGE_SIZE, before: oldestCursor });
      let withMeta = await mapRecords(Array.isArray(records) ? (records as PostRecord[]) : [], user?.id);

      // Attach comments for posts so persisted comments show after refresh/load.
      try {
        withMeta = await hydratePostComments(withMeta);
        // Normalize comment records into the UI-friendly `Comment` shape expected by PostCard
        withMeta = withMeta.map((post) => {
          const rawComments = (post as any).comments as any[] | undefined;
          const mappedComments = Array.isArray(rawComments)
            ? rawComments.map((c) => ({
                id: c.id,
                user: { id: c.author_id ?? c.user_id ?? "", username: c.profiles?.username ?? c.author_id ?? c.user_id ?? "", avatar: c.profiles?.profile_pic ?? undefined },
                text: c.text ?? undefined,
                voice: c.voice_url ?? c.voice ?? undefined,
                likes: Number(c.likes ?? 0),
              }))
            : [];

          return {
            ...post,
            comments: mappedComments,
            comments_count: mappedComments.length,
          } as typeof post;
        });
      } catch (e) {
        devLog("hydratePostComments failed", e);
      }

      if (!isMountedRef.current || currentRequestId.current !== requestId) {
        devLog("loadPostsPage ignored stale response", requestId);
        return;
      }

      if (refresh) {
        const nextPosts = postsRef.current.length === 0 ? withMeta : prependNewPosts(withMeta);
        syncPosts(nextPosts);
        setLastFetchTime(Date.now());
        devLog("loadPostsPage refresh applied", { count: nextPosts.length, source: background ? "background" : "refresh" });
      } else if (append) {
        const nextPosts = mergePostsById(withMeta, postsRef.current, false);
        syncPosts(nextPosts);
        devLog("loadPostsPage append applied", { appendCount: withMeta.length, totalCount: nextPosts.length });
      } else {
        syncPosts(withMeta);
        setLastFetchTime(Date.now());
        devLog("loadPostsPage replace applied", { count: withMeta.length });
      }

      if (append) {
        setHasMore(withMeta.length === PAGE_SIZE);
      }
    } catch (err) {
      console.error("FeedProvider: failed to load posts", err);
    } finally {
      if (currentRequestId.current === requestId) {
        isFetchingRef.current = false;
      }
      if (!background) setLoading(false);
      if (!background) setIsLoadingMore(false);
    }
  }; 

  const fetchIfNeeded = async (force = false) => {
    if (!force) return;
    try {
      await loadPostsPage({ refresh: true, background: true });
    } catch (err) {
      console.error("FeedProvider: failed to refetch posts", err);
    }
  }; 

  // Fetch the first page once when provider mounts, but let cached posts render immediately.
  useEffect(() => {
    if (!skipCachedFeed) {
      const cachedFeed = readCachedFeed();
      const isFresh = Boolean(cachedFeed && Date.now() - cachedFeed.cachedAt < FEED_CACHE_TTL_MS);
      if (cachedFeed && cachedFeed.posts.length > 0) {
        syncPosts(cachedFeed.posts);
        setLastFetchTime(Date.now());
      }

      // Only load remote posts once auth is established.
      if (!authLoading && user) {
        void loadPostsPage({ append: false, refresh: isFresh ? false : true, background: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]); 

  // Listen for manual refresh events dispatched from other UI (e.g. Navbar)
  useEffect(() => {
    const handler = () => void fetchIfNeeded(true);
    window.addEventListener("metoyou:refreshFeed", handler as EventListener);
    return () => window.removeEventListener("metoyou:refreshFeed", handler as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (loading || isLoadingMore || !hasMore) return;
      const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - LOAD_MORE_THRESHOLD;
      if (nearBottom) {
        void loadPostsPage({ append: true, refresh: false });
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loading, isLoadingMore, hasMore]);

  const handleProfileRefresh = () => {
    setPosts([]);
    setLastFetchTime(null);
    try {
      window.localStorage.removeItem(FEED_CACHE_KEY);
    } catch {
      // ignore
    }
    void loadPostsPage({ append: false, refresh: true, background: false });
  };

  useEffect(() => {
    window.addEventListener("metoyou:profile-refresh", handleProfileRefresh as EventListener);
    return () => window.removeEventListener("metoyou:profile-refresh", handleProfileRefresh as EventListener);
  }, [handleProfileRefresh]);

  // Refresh feed when the user returns to the tab or focuses the window,
  // but do it silently and not more often than every 30s.
  useEffect(() => {
    let lastTrigger = 0;
    const maybeRefresh = () => {
      const now = Date.now();
      if (lastFetchTime && now - lastFetchTime < 30_000) return;
      if (now - lastTrigger < 10_000) return;
      lastTrigger = now;
      void loadPostsPage({ refresh: true, background: true });
    };

    const onFocus = () => maybeRefresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") maybeRefresh();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastFetchTime]);

  // setPosts wrapper keeps both local state and query cache in sync
  const dedupePosts = (candidate: Post[]) => {
    const map = new Map<string, Post>();
    const order: string[] = [];

    for (const post of candidate) {
      const postId = normalizeId(post.id);
      if (map.has(postId)) {
        map.set(postId, { ...map.get(postId)!, ...post });
        if (isDev) {
          devLog("dedupePosts merged duplicate", postId, post);
        }
      } else {
        map.set(postId, post);
        order.push(postId);
      }
    }

    return order.map((id) => map.get(id)!);
  };

  const setPosts = (updater: SetStateAction<Post[]>) => {
    setPostsState((prev) => {
      const next = typeof updater === "function" ? (updater as any)(prev) : updater;
      const deduped = dedupePosts(next);
      // Dev-only tracing for text-only posts: detect added/removed/updated
      if (isDev) {
        const prevTextOnly = prev.filter((p) => p.text && !p.image && !p.video && !p.audio).map((p) => normalizeId(p.id));
        const nextTextOnly = deduped.filter((p) => p.text && !p.image && !p.video && !p.audio).map((p) => normalizeId(p.id));
        const removed = prevTextOnly.filter((id) => !nextTextOnly.includes(id));
        const added = nextTextOnly.filter((id) => !prevTextOnly.includes(id));
        const remained = nextTextOnly.filter((id) => prevTextOnly.includes(id));
        if (added.length) devLog("text-posts added", added);
        if (removed.length) devLog("text-posts removed", removed);
        if (remained.length) devLog("text-posts still-present", remained.length);
      }

      try {
        queryClient.setQueryData(["feed"], deduped);
      } catch (e) {}
      return deduped;
    });
  };

  const value: FeedContextValue = {
    posts,
    setPosts,
    loading: loading || isLoadingMore,
    refreshPosts: fetchIfNeeded,
    lastFetchTime,
    savedScrollY,
    setSavedScrollY: (y: number) => setSavedScrollY(y),
    selectedPostId,
    setSelectedPostId,
  };

  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>;
}

export default FeedContext;
