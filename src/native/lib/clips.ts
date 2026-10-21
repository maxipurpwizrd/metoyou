import { nativeSupabase } from "./supabase";

export const NATIVE_CLIPS_PAGE_SIZE = 8;

export type NativeClip = {
  id: string;
  author_id: string;
  username: string;
  profile_pic: string | null;
  text: string | null;
  image_url: string | null;
  video_url: string;
  created_at: string;
  likes_count: number;
  comments_count: number;
  liked: boolean;
};

export async function fetchNativeClipsPage(before?: string): Promise<NativeClip[]> {
  const { data, error } = await nativeSupabase.rpc("get_surface_posts", {
    p_surface: "clips",
    p_limit: NATIVE_CLIPS_PAGE_SIZE,
    p_before: before ?? null,
  });
  if (error) throw error;

  const rows = (data ?? []) as Omit<NativeClip, "liked">[];
  return rows.map((clip) => ({ ...clip, liked: false }));
}

export async function fetchNativeClipById(postId: string): Promise<NativeClip | null> {
  const { data, error } = await nativeSupabase
    .from("posts")
    .select("id, author_id, text, image_url, video_url, created_at, likes_count, comments_count")
    .eq("id", postId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.video_url) return null;

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
    liked: false,
  };
}

export async function hydrateNativeClipLikes(clips: NativeClip[], userId: string) {
  if (clips.length === 0) return clips;
  const { data, error } = await nativeSupabase
    .from("post_likes")
    .select("post_id")
    .eq("user_id", userId)
    .in("post_id", clips.map((clip) => clip.id));
  if (error) throw error;

  const likedIds = new Set((data ?? []).map((like) => like.post_id));
  return clips.map((clip) => ({ ...clip, liked: likedIds.has(clip.id) }));
}

export async function repostNativeClip(clip: NativeClip, authorId: string) {
  const { data: authData, error: authError } = await nativeSupabase.auth.getUser();
  if (authError) throw authError;
  if (authData.user?.id !== authorId) {
    throw new Error("Authentication is required to repost a Clip.");
  }

  const { error } = await nativeSupabase.from("posts").insert({
    author_id: authorId,
    text: clip.text,
    image_url: clip.image_url,
    image_original_url: null,
    video_url: clip.video_url,
    audio_url: null,
    media_type: null,
    highlighted: false,
    created_at: new Date().toISOString(),
  });
  if (error) throw error;
}
