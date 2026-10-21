import type { PostRecord } from "../../types/post";
import { nativeSupabase } from "./supabase";

export const NATIVE_FEED_PAGE_SIZE = 7;

export type NativeFeedCursor = {
  createdAt: string;
  id: string;
};

export async function fetchNativeFeedPage(
  cursor?: NativeFeedCursor,
): Promise<PostRecord[]> {
  let query = nativeSupabase
    .from("posts")
    .select(
      "id, author_id, text, image_url, image_original_url, content_kind, likes_count, comments_count, highlighted, created_at",
    )
    .in("content_kind", ["text", "image"])
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(NATIVE_FEED_PAGE_SIZE);

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  const posts = (data ?? []) as PostRecord[];
  const authorIds = Array.from(new Set(posts.map((post) => post.author_id).filter(Boolean)));
  if (authorIds.length === 0) return posts;

  const { data: profiles, error: profilesError } = await nativeSupabase
    .from("public_profiles")
    .select("id, username, profile_pic, vibes_pro")
    .in("id", authorIds);

  if (profilesError) throw profilesError;

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  return posts.map((post) => ({
    ...post,
    profiles: profileById.get(post.author_id) ?? null,
  }));
}

export async function fetchNativeFeedPostById(postId: string): Promise<PostRecord | null> {
  const { data, error } = await nativeSupabase
    .from("posts")
    .select(
      "id, author_id, text, image_url, image_original_url, video_url, audio_url, content_kind, likes_count, comments_count, highlighted, created_at",
    )
    .eq("id", postId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: profile, error: profileError } = await nativeSupabase
    .from("public_profiles")
    .select("id, username, profile_pic, vibes_pro")
    .eq("id", data.author_id)
    .maybeSingle();
  if (profileError) throw profileError;

  return {
    ...data,
    profiles: profile ?? null,
  } as PostRecord;
}
