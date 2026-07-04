import { supabase } from "./supabase";

export type PostLikeRecord = {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
};

export async function likePost(postId: string, userId: string) {
  try {
    const insert = {
      post_id: postId,
      user_id: userId,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from("post_likes").insert(insert).select("id, post_id, user_id, created_at").maybeSingle();
    if (error) throw error;

    // Optionally update posts.likes_count using a count query
    return (data as PostLikeRecord) ?? null;
  } catch (e) {
    console.error("likePost error", e);
    return null;
  }
}

export async function unlikePost(postId: string, userId: string) {
  try {
    const { error } = await supabase
      .from("post_likes")
      .delete()
      .match({ post_id: postId, user_id: userId });

    if (error) throw error;
    return true;
  } catch (e) {
    console.error("unlikePost error", e);
    return false;
  }
}

export async function hasUserLiked(postId: string, userId: string) {
  try {
    const { data, error } = await supabase
      .from("post_likes")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return Boolean(data);
  } catch (e) {
    console.error("hasUserLiked error", e);
    return false;
  }
}

export async function getPostLikes(postId: string) {
  try {
    const { data, error } = await supabase
      .from("post_likes")
      .select("user_id")
      .eq("post_id", postId);

    if (error) throw error;
    return (data as { user_id: string }[]) ?? [];
  } catch (e) {
    console.error("getPostLikes error", e);
    return [] as { user_id: string }[];
  }
}
