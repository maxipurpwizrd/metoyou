import { nativeSupabase } from "./supabase";

export const NATIVE_TRACKS_PAGE_SIZE = 8;

export type NativeTrack = {
  id: string;
  author_id: string;
  username: string;
  profile_pic: string | null;
  text: string | null;
  image_url: string | null;
  image_original_url: string | null;
  video_url: string | null;
  audio_url: string;
  duration_ms: number | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
  liked: boolean;
};

export async function fetchNativeTracksPage(before?: string): Promise<NativeTrack[]> {
  const { data, error } = await nativeSupabase.rpc("get_surface_posts", {
    p_surface: "tracks",
    p_limit: NATIVE_TRACKS_PAGE_SIZE,
    p_before: before ?? null,
  });
  if (error) throw error;

  return ((data ?? []) as Omit<NativeTrack, "liked">[]).map((track) => ({
    ...track,
    liked: false,
  }));
}

export async function hydrateNativeTrackLikes(tracks: NativeTrack[], userId: string) {
  if (tracks.length === 0) return tracks;
  const { data, error } = await nativeSupabase
    .from("post_likes")
    .select("post_id")
    .eq("user_id", userId)
    .in("post_id", tracks.map((track) => track.id));
  if (error) throw error;

  const likedIds = new Set((data ?? []).map((like) => like.post_id));
  return tracks.map((track) => ({ ...track, liked: likedIds.has(track.id) }));
}

export async function fetchNativeTrackById(postId: string): Promise<NativeTrack | null> {
  const { data, error } = await nativeSupabase
    .from("posts")
    .select("id, author_id, text, image_url, image_original_url, video_url, audio_url, created_at, likes_count, comments_count")
    .eq("id", postId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.audio_url) return null;

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
    duration_ms: null,
    liked: false,
  };
}
