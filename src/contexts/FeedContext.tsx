import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getProfile } from "../utils/profileStorage";
import { fetchPostsFromSupabase, type PostRecord } from "../lib/postApi";
import { getComments } from "../lib/commentApi";
import { getPostLikes } from "../lib/likeApi";

type User = {
  id: string;
  username: string;
  avatar?: string;
};

type Comment = {
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

type FeedContextValue = {
  posts: Post[];
  setPosts: (updater: React.SetStateAction<Post[]>) => void;
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
  const [posts, setPostsState] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(null);
  const [savedScrollY, setSavedScrollY] = useState<number>(0);
  const [selectedPostId, setSelectedPostId] = useState<string | number | null>(null);
  const queryClient = useQueryClient();

  const mapRecords = async (records: PostRecord[]) => {
    const profile = getProfile();
    const mapped = (records || []).map((r: PostRecord) => ({
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

    const withMeta = await Promise.all(
      mapped.map(async (p) => {
        try {
          const [commentsData, likesData] = await Promise.all([
            getComments(String(p.id)),
            getPostLikes(String(p.id)),
          ] as any);

          const commentsMapped = (commentsData || []).map((c: any) => ({
            id: c.id,
            user: { id: c.author_id, username: c.profiles?.username ?? c.author_id },
            text: c.text ?? "",
            likes: 0,
          }));

          const likesCount = (likesData || []).length;

          return {
            ...p,
            comments: commentsMapped,
            likes: likesCount,
            likes_count: likesCount,
            liked: profile ? Boolean((likesData || []).some((l: any) => l.user_id === profile.id)) : false,
          } as Post;
        } catch (e) {
          return p;
        }
      })
    );

    return withMeta;
  };
  // Use react-query to fetch feed; keep local state in sync with query cache
  const { data: queryData, isFetching, refetch } = useQuery({
    queryKey: ["feed"],
    queryFn: async () => {
      const records = await fetchPostsFromSupabase({ limit: 50 });
      const withMeta = await mapRecords(records || []);
      return withMeta;
    },
    staleTime: 5 * 60 * 1000,
    cacheTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (queryData) {
      setPostsState(queryData);
      setLastFetchTime(Date.now());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryData]);

  const fetchIfNeeded = async (force = false) => {
    if (!force) return; // react-query handles staleness; only force triggers a refetch
    try {
      await refetch();
    } catch (err) {
      console.error("FeedProvider: failed to refetch posts", err);
    }
  };

  // Fetch once when provider mounts if empty
  useEffect(() => {
    // no-op: react-query fetch runs automatically on mount
    // keep for compatibility
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for manual refresh events dispatched from other UI (e.g. Navbar)
  useEffect(() => {
    const handler = () => fetchIfNeeded(true);
    window.addEventListener("metoyou:refreshFeed", handler as EventListener);
    return () => window.removeEventListener("metoyou:refreshFeed", handler as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // setPosts wrapper keeps both local state and query cache in sync
  const setPosts = (updater: React.SetStateAction<Post[]>) => {
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
    loading: isFetching,
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
