import { supabase } from "./supabase";

export type CommentRecord = {
  id: string;
  post_id: string;
  author_id: string;
  text?: string | null;
  created_at: string;
  profiles?: { username?: string; profile_pic?: string } | null;
};

export async function addComment(postId: string, authorId: string, text?: string | null) {
  try {
    const insert = {
      post_id: postId,
      author_id: authorId,
      text: text ?? null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("comments")
      .insert(insert)
      .select("id, post_id, author_id, text, created_at, profiles!comments_author_id_fkey(  username,  profile_pic)")
      .maybeSingle();

    if (error) throw error;
    return (data as CommentRecord) ?? null;
  } catch (e) {
    console.error("addComment error", e);
    return null;
  }
}

export async function getComments(postId: string) {
  try {
    const { data, error } = await supabase
      .from("comments")
      .select("id, post_id, author_id, text, created_at, profiles!comments_author_id_fkey(  username,  profile_pic)")
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
      .select("id, post_id, author_id, text, created_at, profiles!comments_author_id_fkey(  username,  profile_pic)")
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
