import { supabase } from "./supabase";
import { uploadAudioToSupabase } from "./postApi";

export type CommentRecord = {
  id: string;
  post_id: string;
  author_id: string;
  text?: string | null;
  voice_url?: string | null;
  created_at: string;
  parent_comment_id?: string | null;
  reply_to_username?: string | null;
  reply_to_text?: string | null;
  profiles?: { username?: string; profile_pic?: string } | null;
  likes?: number;
  liked?: boolean;
};

type CommentLikeState = {
  liked: boolean;
  likes: number;
};

const COMMENT_LIKE_STORAGE_KEY = "metoyou-comment-like-state";
const COMMENT_REPLY_STORAGE_KEY_PREFIX = "metoyou-comment-replies:";

function readCommentLikeState() {
  if (typeof window === "undefined") return {} as Record<string, CommentLikeState>;

  try {
    const raw = window.localStorage.getItem(COMMENT_LIKE_STORAGE_KEY);
    if (!raw) return {} as Record<string, CommentLikeState>;
    return JSON.parse(raw) as Record<string, CommentLikeState>;
  } catch {
    return {} as Record<string, CommentLikeState>;
  }
}

function writeCommentLikeState(state: Record<string, CommentLikeState>) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(COMMENT_LIKE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage write failures
  }
}

function readLocalComments(postId: string): CommentRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(`${COMMENT_REPLY_STORAGE_KEY_PREFIX}${postId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CommentRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalComments(postId: string, comments: CommentRecord[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(`${COMMENT_REPLY_STORAGE_KEY_PREFIX}${postId}`, JSON.stringify(comments));
  } catch {
    // ignore storage write failures
  }
}

async function syncPostCommentCount(postId: string, delta: number) {
  try {
    const { data: postData, error: postFetchError } = await supabase
      .from("posts")
      .select("comments_count")
      .eq("id", postId)
      .maybeSingle();

    if (postFetchError) throw postFetchError;

    const currentCount = Number(postData?.comments_count ?? 0);
    const nextCount = Math.max(0, currentCount + delta);
    const { error: updateError } = await supabase.from("posts").update({ comments_count: nextCount }).eq("id", postId);
    if (updateError) throw updateError;
  } catch {
    // ignore comment count sync failures
  }
}

async function createCommentNotification(postId: string, actorId: string) {
  try {
    const { data: postData, error: postError } = await supabase.from("posts").select("author_id").eq("id", postId).maybeSingle();
    if (postError) throw postError;

    const authorId = postData?.author_id;
    if (!authorId || authorId === actorId) return;

    const { data: actorData, error: actorError } = await supabase.from("profiles").select("username").eq("id", actorId).maybeSingle();
    if (actorError) throw actorError;
    if (!actorData?.username) return;

    const actorUsername = actorData.username;
    const createdAt = new Date().toISOString();
    await supabase.from("notifications").insert({
      type: "comment",
      message: `${actorUsername} commented on your post`,
      target_id: postId,
      actor_id: actorId,
      user_id: authorId,
      created_at: createdAt,
      is_read: false,
    });
  } catch (e) {
    console.error("createCommentNotification error", e);
  }
}

export async function addComment(
  postId: string,
  authorId: string,
  text?: string | null,
  voiceUrl?: string | null,
  options?: { parentCommentId?: string | number | null; replyToUsername?: string | null; replyToText?: string | null }
) {
  const parentCommentId = options?.parentCommentId ? String(options.parentCommentId) : null;
  const replyToUsername = options?.replyToUsername ?? null;
  const replyToText = options?.replyToText ?? null;
  const createdAt = new Date().toISOString();

  if (parentCommentId) {
    const localComment: CommentRecord = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      post_id: postId,
      author_id: authorId,
      text: text ?? null,
      voice_url: voiceUrl ?? null,
      created_at: createdAt,
      parent_comment_id: parentCommentId,
      reply_to_username: replyToUsername,
      reply_to_text: replyToText,
      profiles: { username: "You" },
      likes: 0,
      liked: false,
    };

    const existing = readLocalComments(postId);
    writeLocalComments(postId, [...existing, localComment]);
    await syncPostCommentCount(postId, 1);
    return localComment;
  }

  try {
    const persistedVoiceUrl = voiceUrl ? await uploadAudioToSupabase(voiceUrl, authorId) : undefined;

    const insert = {
      post_id: postId,
      author_id: authorId,
      text: text ?? null,
      voice_url: persistedVoiceUrl ?? null,
      created_at: createdAt,
    };

    const select = "id, post_id, author_id, text, voice_url, created_at, profiles!comments_author_id_fkey(  username,  profile_pic)";
    const { data, error } = await supabase
      .from("comments")
      .insert(insert)
      .select(select)
      .maybeSingle();

    if (error) throw error;
    await syncPostCommentCount(postId, 1);
    await createCommentNotification(postId, authorId);

    return {
      ...(data as CommentRecord),
      likes: 0,
      liked: false,
    } as CommentRecord;
  } catch (e) {
    try {
      const fallbackInsert = {
        post_id: postId,
        author_id: authorId,
        text: text ?? null,
        created_at: createdAt,
      };
      const { data, error } = await supabase
        .from("comments")
        .insert(fallbackInsert)
        .select("id, post_id, author_id, text, voice_url, created_at, profiles!comments_author_id_fkey(  username,  profile_pic)")
        .maybeSingle();
      if (error) throw error;
      await syncPostCommentCount(postId, 1);
      await createCommentNotification(postId, authorId);
      return {
        ...(data as CommentRecord),
        likes: 0,
        liked: false,
      } as CommentRecord;
    } catch (fallbackErr) {
      console.error("addComment error", fallbackErr);
      // Persist a local fallback comment so top-level comments survive reloads
      try {
        const localComment: CommentRecord = {
          id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          post_id: postId,
          author_id: authorId,
          text: text ?? null,
          voice_url: voiceUrl ?? null,
          created_at: createdAt,
          parent_comment_id: parentCommentId,
          reply_to_username: replyToUsername,
          reply_to_text: replyToText,
          profiles: { username: "You" },
          likes: 0,
          liked: false,
        };

        const existing = readLocalComments(postId);
        writeLocalComments(postId, [...existing, localComment]);
        try {
          await syncPostCommentCount(postId, 1);
        } catch {
          // ignore
        }
        try {
          await createCommentNotification(postId, authorId);
        } catch {
          // ignore
        }

        return localComment;
      } catch (finalErr) {
        console.error("addComment final fallback error", finalErr);
        return null;
      }
    }
  }
}

export async function getComments(postId: string) {
  try {
    const { data, error } = await supabase
      .from("comments")
      .select("id, post_id, author_id, text, voice_url, created_at, profiles!comments_author_id_fkey(  username,  profile_pic)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const dbComments = ((data as CommentRecord[]) ?? []).map((comment) => ({
      ...comment,
      likes: 0,
      liked: false,
    }));

    const localComments = readLocalComments(postId);
    const merged = [...dbComments, ...localComments.filter((comment) => !dbComments.some((dbComment) => dbComment.id === comment.id))];
    const withLikeState = merged.map((comment) => {
      const likeState = readCommentLikeState()[String(comment.id)] ?? { liked: false, likes: Number(comment.likes ?? 0) };
      return {
        ...comment,
        likes: Number(likeState.likes ?? comment.likes ?? 0),
        liked: Boolean(likeState.liked),
      } as CommentRecord;
    });

    return withLikeState.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  } catch (e) {
    console.error("getComments FULL error", JSON.stringify(e, null, 2));
    return [];
  }
}

export async function editComment(commentId: string, text?: string | null) {
  try {
    const { data, error } = await supabase
      .from("comments")
      .update({ text: text ?? null })
      .eq("id", commentId)
      .select("id, post_id, author_id, text, voice_url, created_at, profiles!comments_author_id_fkey(  username,  profile_pic)")
      .maybeSingle();

    if (error) throw error;
    return (data as CommentRecord) ?? null;
  } catch (e) {
    console.error("editComment error", e);
    return null;
  }
}

export async function deleteComment(commentId: string) {
  try {
    const { error } = await supabase.from("comments").delete().eq("id", commentId);
    if (error) throw error;

    if (typeof window !== "undefined") {
      const keys = Object.keys(window.localStorage).filter((key) => key.startsWith(`${COMMENT_REPLY_STORAGE_KEY_PREFIX}`));
      keys.forEach((key) => {
        const existing = JSON.parse(window.localStorage.getItem(key) ?? "[]") as CommentRecord[];
        const next = existing.filter((comment) => comment.id !== commentId);
        window.localStorage.setItem(key, JSON.stringify(next));
      });
    }

    return true;
  } catch (e) {
    console.error("deleteComment error", e);
    return false;
  }
}

export async function toggleCommentLike(commentId: string) {
  const state = readCommentLikeState();
  const current = state[String(commentId)] ?? { liked: false, likes: 0 };
  const nextLiked = !current.liked;
  const nextLikes = Math.max(0, current.likes + (nextLiked ? 1 : -1));
  const nextState = {
    ...state,
    [String(commentId)]: { liked: nextLiked, likes: nextLikes },
  };
  writeCommentLikeState(nextState);
  return { liked: nextLiked, likes: nextLikes };
}

export async function hydratePostComments<T extends { id: string | number; comments?: unknown; comments_count?: number }>(posts: T[]) {
  const results = await Promise.all(
    posts.map(async (post) => {
      const comments = await getComments(String(post.id));
      return {
        ...post,
        comments,
        comments_count: comments.length,
      } as T & { comments: CommentRecord[]; comments_count: number };
    })
  );

  return results;
}
