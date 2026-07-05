import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type SetStateAction } from "react";
import { useQueryClient } from '@tanstack/react-query';
import { fetchPostsFromSupabase, type PostRecord } from "../lib/postApi";

export type User = {
  id: string;
  username: string;
  avatar?: string;
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

const readCachedFeed = (): Post[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(FEED_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeCachedFeed = (posts: Post[]) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(FEED_CACHE_KEY, JSON.stringify(posts.slice(0, 30)));
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
  const [posts, setPostsState] = useState<Post[]>(() => readCachedFeed());
  const [loading, setLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(null);
  const [savedScrollY, setSavedScrollY] = useState<number>(0);
  const [selectedPostId, setSelectedPostId] = useState<string | number | null>(null);
  const queryClient = useQueryClient();
  const postsRef = useRef<Post[]>([]);

  useEffect(() => {
    postsRef.current = posts;
    writeCachedFeed(posts);
  }, [posts]);

  const mapRecords = async (records: PostRecord[] | null | undefined) => {
    const safeRecords = Array.isArray(records) ? records : [];

    return safeRecords.map((r: PostRecord) => ({
      id: r.id,
      author: { id: r.author_id, username: r.profiles?.username ?? r.author_id },
      authorId: r.author_id,
      author_id: r.author_id,
      time: new Date(r.created_at).toLocaleString(),
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
  };
  const syncPosts = (nextPosts: Post[]) => {
    setPostsState(nextPosts);
    queryClient.setQueryData(["feed"], nextPosts);
    postsRef.current = nextPosts;
  };

  const mergePostsById = (incoming: Post[], existing: Post[]) => {
    const seen = new Set<string | number>();
    const merged: Post[] = [];

    for (const post of [...incoming, ...existing]) {
      if (seen.has(post.id)) continue;
      seen.add(post.id);
      merged.push(post);
    }

    return merged;
  };

  const loadPostsPage = async ({ append = false, refresh = false } = {}) => {
    if (loading || isLoadingMore) return;

    if (append) {
      if (!hasMore || postsRef.current.length === 0) return;
      setIsLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const oldestCursor = append ? postsRef.current[postsRef.current.length - 1]?.created_at : undefined;
      const newestCursor = refresh && postsRef.current.length > 0 ? postsRef.current[0]?.created_at : undefined;
      const records = refresh
        ? await fetchPostsFromSupabase({ limit: PAGE_SIZE, after: newestCursor })
        : await fetchPostsFromSupabase({ limit: PAGE_SIZE, before: oldestCursor });
      const withMeta = await mapRecords(Array.isArray(records) ? (records as PostRecord[]) : []);

      if (refresh) {
        const nextPosts = withMeta.length > 0 ? mergePostsById(withMeta, postsRef.current) : postsRef.current;
        syncPosts(nextPosts);
      } else if (append) {
        const nextPosts = [...postsRef.current, ...withMeta];
        syncPosts(nextPosts);
      } else {
        syncPosts(withMeta);
        setLastFetchTime(Date.now());
      }

      if (!refresh) {
        setHasMore(withMeta.length === PAGE_SIZE);
      }
    } catch (err) {
      console.error("FeedProvider: failed to load posts", err);
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  };

  const fetchIfNeeded = async (force = false) => {
    if (!force) return;
    try {
      await loadPostsPage({ refresh: true });
    } catch (err) {
      console.error("FeedProvider: failed to refetch posts", err);
    }
  };

  // Fetch the first page once when provider mounts, but let cached posts render immediately.
  useEffect(() => {
    const cachedPosts = readCachedFeed();
    if (cachedPosts.length > 0) {
      syncPosts(cachedPosts);
      setLastFetchTime(Date.now());
    }

    void loadPostsPage({ append: false, refresh: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // setPosts wrapper keeps both local state and query cache in sync
  const setPosts = (updater: SetStateAction<Post[]>) => {
    setPostsState((prev) => {
      const next = typeof updater === "function" ? (updater as any)(prev) : updater;
      try {
        queryClient.setQueryData(["feed"], next);
      } catch (e) {}
      return next;
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
