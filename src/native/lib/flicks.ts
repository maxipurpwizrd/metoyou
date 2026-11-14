import { nativeSupabase } from "./supabase";

export const NATIVE_FLICKS_PAGE_SIZE = 7;

export type NativeFlick = {
  id: string;
  author_id: string;
  username: string;
  profile_pic: string | null;
  text: string | null;
  image_url: string;
  image_original_url: string | null;
  video_url: string | null;
  audio_url: string | null;
  duration_ms: number | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
  liked: boolean;
};

export async function fetchNativeFlicksPage(before?: string): Promise<NativeFlick[]> {
  const { data, error } = await nativeSupabase.rpc("get_surface_posts", {
    p_surface: "flicks",
    p_limit: NATIVE_FLICKS_PAGE_SIZE,
    p_before: before ?? null,
  });
  if (error) throw error;

  return ((data ?? []) as Omit<NativeFlick, "liked">[]).map((flick) => ({
    ...flick,
    liked: false,
  }));
}

export async function hydrateNativeFlickLikes(flicks: NativeFlick[], userId: string) {
  if (flicks.length === 0) return flicks;

  const postIds = [...new Set(flicks.map((flick) => flick.id))];

  const [likedResult, likeCountsResult, commentCountsResult] = await Promise.all([
    nativeSupabase
      .from("post_likes")
      .select("post_id")
      .eq("user_id", userId)
      .in("post_id", postIds),
    Promise.all(
      postIds.map(async (postId) => {
        const { count, error } = await nativeSupabase
          .from("post_likes")
          .select("id", { count: "exact", head: true })
          .eq("post_id", postId);
        if (error) {
          console.warn("Could not refresh the Flick like count.", error);
          return { postId, count: null as number | null };
        }
        return { postId, count: count ?? 0 };
      }),
    ),
    Promise.all(
      postIds.map(async (postId) => {
        const { count, error } = await nativeSupabase
          .from("comments")
          .select("id", { count: "exact", head: true })
          .eq("post_id", postId);
        if (error) {
          console.warn("Could not refresh the Flick comment count.", error);
          return { postId, count: null as number | null };
        }
        return { postId, count: count ?? 0 };
      }),
    ),
  ]);

  if (likedResult.error) throw likedResult.error;

  const likedIds = new Set((likedResult.data ?? []).map((like) => like.post_id));
  const likeCounts = new Map((likeCountsResult as Array<{ postId: string; count: number | null }>).map((entry) => [entry.postId, entry.count ?? 0]));
  const commentCounts = new Map((commentCountsResult as Array<{ postId: string; count: number | null }>).map((entry) => [entry.postId, entry.count ?? 0]));

  return flicks.map((flick) => ({
    ...flick,
    liked: likedIds.has(flick.id),
    likes_count: likeCounts.get(flick.id) ?? flick.likes_count,
    comments_count: commentCounts.get(flick.id) ?? flick.comments_count,
  }));
}

export async function fetchNativeFlickById(postId: string): Promise<NativeFlick | null> {
  const { data, error } = await nativeSupabase
    .from("posts")
    .select("id, author_id, text, image_url, image_original_url, video_url, audio_url, created_at, likes_count, comments_count")
    .eq("id", postId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const imageUrl = data.image_url ?? data.image_original_url;
  if (!imageUrl) return null;

  const { data: profile, error: profileError } = await nativeSupabase
    .from("public_profiles")
    .select("username, profile_pic")
    .eq("id", data.author_id)
    .maybeSingle();
  if (profileError) throw profileError;

  return {
    ...data,
    username: profile?.username ?? "User",
    profile_pic: profile?.profile_pic ?? null,
    image_url: imageUrl,
    duration_ms: null,
    liked: false,
  };
}

export async function repostNativeFlick(flick: NativeFlick, authorId: string) {
  const { data: authData, error: authError } = await nativeSupabase.auth.getUser();
  if (authError) throw authError;
  if (authData.user?.id !== authorId) {
    throw new Error("Authentication is required to repost a Flick.");
  }

  const { error } = await nativeSupabase.from("posts").insert({
    author_id: authorId,
    text: flick.text,
    image_url: flick.image_url,
    image_original_url: flick.image_original_url,
    video_url: null,
    audio_url: null,
    media_type: "image",
    highlighted: false,
    created_at: new Date().toISOString(),
  });
  if (error) throw error;
}
