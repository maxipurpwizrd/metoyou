import { supabase } from "./supabase";
import { uploadAudioToSupabase } from "./postApi";

export type CommentRecord = {
  id: string;
  post_id: string;
  author_id: string;
  text?: string | null;
  voice_url?: string | null;
  created_at: string;
  profiles?: { username?: string; profile_pic?: string } | null;
};

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

export async function addComment(postId: string, authorId: string, text?: string | null, voiceUrl?: string | null) {
  try {
    const persistedVoiceUrl = voiceUrl ? await uploadAudioToSupabase(voiceUrl, authorId) : undefined;

    const insert = {
      post_id: postId,
      author_id: authorId,
      text: text ?? null,
      voice_url: persistedVoiceUrl ?? null,
      created_at: new Date().toISOString(),
    };

    const select = "id, post_id, author_id, text, voice_url, created_at, profiles!comments_author_id_fkey(  username,  profile_pic)";
    const { data, error } = await supabase
      .from("comments")
      .insert(insert)
      .select(select)
      .maybeSingle();

    if (error) throw error;
    return (data as CommentRecord) ?? null;
  } catch (e) {
    try {
      const fallbackInsert = {
        post_id: postId,
        author_id: authorId,
        text: text ?? null,
        created_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from("comments")
        .insert(fallbackInsert)
        .select("id, post_id, author_id, text, voice_url, created_at, profiles!comments_author_id_fkey(  username,  profile_pic)")
        .maybeSingle();
      if (error) throw error;
      await createCommentNotification(postId, authorId);
      return (data as CommentRecord) ?? null;
    } catch (fallbackErr) {
      console.error("addComment error", fallbackErr);
      return null;
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
    return (data as CommentRecord[]) ?? [];
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
    return true;
  } catch (e) {
    console.error("deleteComment error", e);
    return false;
  }
}
