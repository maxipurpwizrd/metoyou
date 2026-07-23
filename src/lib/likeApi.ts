import { supabase } from "./supabase";

export type PostLikeRecord = {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
};

async function syncPostLikeCount(postId: string, delta: number) {
  try {
    const { data: postData, error: postFetchError } = await supabase
      .from("posts")
      .select("likes_count")
      .eq("id", postId)
      .maybeSingle();

    if (postFetchError) throw postFetchError;

    const currentCount = Number(postData?.likes_count ?? 0);
    const nextCount = Math.max(0, currentCount + delta);
    const { error: updateError } = await supabase
      .from("posts")
      .update({ likes_count: nextCount })
      .eq("id", postId);

    if (updateError) throw updateError;
  } catch (e) {
    console.warn("syncPostLikeCount skipped", e);
  }
}

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

    const { data, error } = await supabase
      .from("post_likes")
      .insert(insert)
      .select("id, post_id, user_id, created_at")
      .maybeSingle();
    if (error) throw error;

    await syncPostLikeCount(postId, 1);

    const { data: postData, error: postError } = await supabase
      .from("posts")
      .select("author_id")
      .eq("id", postId)
      .maybeSingle();
    if (postError) throw postError;

    const authorId = postData?.author_id;
    if (authorId && authorId !== userId) {
      const { data: actorData, error: actorError } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", userId)
        .maybeSingle();
      if (!actorError && actorData?.username) {
        const createdAt = new Date().toISOString();
        const notificationData = {
          type: "like",
          message: "liked your post",
          user_id: authorId,
          created_at: createdAt,
          is_read: false,
        };

        const { error: notificationError } = await supabase.from("notifications").insert(notificationData);
        if (notificationError) {
          console.warn("Like notification skipped", notificationError.message);
        }
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
    await syncPostLikeCount(postId, -1);
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

async function getPostLikeMetrics(postId: string, userId?: string) {
  try {
    const { data, error } = await supabase
      .from("post_likes")
      .select("id, user_id")
      .eq("post_id", postId);

    if (error) throw error;

    const likes = (data as { id: string; user_id: string }[]) ?? [];
    const liked = Boolean(userId && likes.some((like) => like.user_id === userId));

    return {
      liked,
      likesCount: likes.length,
    };
  } catch (e) {
    console.error("getPostLikeMetrics error", e);
    return {
      liked: false,
      likesCount: 0,
    };
  }
}

export async function hydratePostLikeState<T extends { id: string | number }>(posts: T[], userId?: string) {
  const existingLikes = posts.reduce((acc, post) => {
    const maybePost = post as Partial<{ likes?: number; likes_count?: number }>;
    const count = Number(maybePost.likes ?? maybePost.likes_count ?? 0);
    acc[String(post.id)] = count;
    return acc;
  }, {} as Record<string, number>);

  if (!userId) {
    return posts.map((post) => ({
      ...post,
      liked: false,
      likes: existingLikes[String(post.id)] ?? 0,
      likes_count: existingLikes[String(post.id)] ?? 0,
    })) as Array<T & { liked: boolean; likes: number; likes_count: number }>;
  }

  const results = await Promise.all(
    posts.map(async (post) => {
      const { liked, likesCount } = await getPostLikeMetrics(String(post.id), userId);
      const fallbackCount = existingLikes[String(post.id)] ?? 0;
      const resolvedCount = likesCount > 0 ? likesCount : fallbackCount;

      return {
        ...post,
        liked,
        likes: resolvedCount,
        likes_count: resolvedCount,
      } as T & { liked: boolean; likes: number; likes_count: number };
    })
  );

  return results;
}
