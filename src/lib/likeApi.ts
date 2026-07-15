import { supabase } from "./supabase";

export type PostLikeRecord = {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
};

export async function likePost(postId: string, userId: string) {
  try {
    const { data: existingLike, error: existingLikeError } = await supabase
      .from("post_likes")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingLikeError) throw existingLikeError;
    if (existingLike) return existingLike as PostLikeRecord;

    const insert = {
      post_id: postId,
      user_id: userId,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from("post_likes").insert(insert).select("id, post_id, user_id, created_at").maybeSingle();
    if (error) throw error;

    const { data: postData, error: postError } = await supabase.from("posts").select("author_id").eq("id", postId).maybeSingle();
    if (postError) throw postError;

    const authorId = postData?.author_id;
    if (authorId && authorId !== userId) {
      const { data: actorData, error: actorError } = await supabase.from("profiles").select("username").eq("id", userId).maybeSingle();
      if (!actorError && actorData?.username) {
        const actorUsername = actorData.username;
        const createdAt = new Date().toISOString();
        const notificationData = {
          type: "like",
          message: `${actorUsername} liked your post`,
          target_id: postId,
          actor_id: userId,
          user_id: authorId,
          created_at: createdAt,
          is_read: false,
        };

        const {
          data: { user },
        } = await supabase.auth.getUser();

        console.log("Current auth uid", user?.id);
        console.log("Notification insert payload", notificationData);

        await supabase.from("notifications").insert(notificationData);
      }
    }

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
