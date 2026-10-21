import type { PostRecord } from "../../types/post";
import { nativeSupabase } from "./supabase";

const IMAGE_BUCKET = "posts-images";

function decodeBase64(value: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const binaryLength = Math.floor((value.length * 3) / 4) -
    (value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0);
  const bytes = new Uint8Array(binaryLength);
  let byteIndex = 0;

  for (let index = 0; index < value.length; index += 4) {
    const first = alphabet.indexOf(value[index]);
    const second = alphabet.indexOf(value[index + 1]);
    const third = alphabet.indexOf(value[index + 2]);
    const fourth = alphabet.indexOf(value[index + 3]);
    const combined = (first << 18) | (second << 12) | ((third & 63) << 6) | (fourth & 63);

    if (byteIndex < binaryLength) bytes[byteIndex++] = (combined >> 16) & 255;
    if (byteIndex < binaryLength) bytes[byteIndex++] = (combined >> 8) & 255;
    if (byteIndex < binaryLength) bytes[byteIndex++] = combined & 255;
  }

  return bytes;
}

export async function uploadNativeCommentAudio(input: {
  authorId: string;
  base64: string;
  mimeType: string;
}) {
  const extension =
    input.mimeType.split("/")[1]?.split(/[;+]/)[0]?.replace(/[^a-z0-9-]/gi, "") || "m4a";
  const path = `${input.authorId}/comments/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const { error } = await nativeSupabase.storage.from("post-audio").upload(
    path,
    decodeBase64(input.base64),
    { contentType: input.mimeType, upsert: false },
  );
  if (error) throw error;
  return nativeSupabase.storage.from("post-audio").getPublicUrl(path).data.publicUrl;
}

export async function createNativePost(input: {
  authorId: string;
  text: string;
  imageBase64?: string;
  imageOriginalBase64?: string;
  imageOriginalMimeType?: string;
}): Promise<PostRecord> {
  const { data: authData, error: authError } = await nativeSupabase.auth.getUser();
  if (authError) throw authError;
  if (authData.user?.id !== input.authorId) {
    throw new Error("Authentication is required to create a post.");
  }

  let imageUrl: string | null = null;
  let imageOriginalUrl: string | null = null;
  const storage = nativeSupabase.storage.from(IMAGE_BUCKET);
  const uploadedImagePaths: string[] = [];
  if (input.imageBase64) {
    const imagePath = `${input.authorId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const { error: uploadError } = await storage.upload(imagePath, decodeBase64(input.imageBase64), {
        contentType: "image/jpeg",
        upsert: false,
      });
    if (uploadError) throw uploadError;
    uploadedImagePaths.push(imagePath);
    imageUrl = storage.getPublicUrl(imagePath).data.publicUrl;

    const originalBase64 = input.imageOriginalBase64 ?? input.imageBase64;
    const originalMimeType = input.imageOriginalMimeType ?? "image/jpeg";
    if (originalBase64 === input.imageBase64) {
      imageOriginalUrl = imageUrl;
    } else {
      const extension =
        originalMimeType.split("/")[1]?.split(/[;+]/)[0]?.replace(/[^a-z0-9-]/gi, "") || "jpg";
      const originalPath = `${input.authorId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
      const { error: originalUploadError } = await storage.upload(
        originalPath,
        decodeBase64(originalBase64),
        { contentType: originalMimeType, upsert: false },
      );
      if (originalUploadError) {
        const { error: cleanupError } = await storage.remove(uploadedImagePaths);
        if (cleanupError) {
          throw new Error(
            `Could not upload the original image: ${originalUploadError.message}. The optimized upload could not be removed: ${cleanupError.message}`,
          );
        }
        throw originalUploadError;
      }
      uploadedImagePaths.push(originalPath);
      imageOriginalUrl = storage.getPublicUrl(originalPath).data.publicUrl;
    }
  }

  const { data, error } = await nativeSupabase
    .from("posts")
    .insert({
      author_id: input.authorId,
      text: input.text.trim() || null,
      image_url: imageUrl,
      image_original_url: imageOriginalUrl,
      video_url: null,
      audio_url: null,
      media_type: imageUrl ? "image" : null,
      highlighted: false,
      created_at: new Date().toISOString(),
    })
    .select(
      "id, author_id, text, image_url, image_original_url, content_kind, likes_count, comments_count, highlighted, created_at",
    )
    .single();

  if (error) {
    if (uploadedImagePaths.length > 0) {
      const { error: cleanupError } = await storage.remove(uploadedImagePaths);
      if (cleanupError) {
        throw new Error(
          `Could not create the post: ${error.message}. Its uploaded images could not be removed: ${cleanupError.message}`,
        );
      }
    }
    throw error;
  }
  return { ...data, profiles: null } as PostRecord;
}

export async function updateNativePostText(postId: string, text: string) {
  const { error } = await nativeSupabase
    .from("posts")
    .update({ text: text.trim() })
    .eq("id", postId);
  if (error) throw error;
}

export async function deleteNativePost(postId: string) {
  const { error } = await nativeSupabase.from("posts").delete().eq("id", postId);
  if (error) throw error;
}

export async function reportNativePost(input: {
  postId: string;
  authorId: string;
  reason: string;
}) {
  const { data: authData, error: authError } = await nativeSupabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Authentication is required to report this post.");

  const { error } = await nativeSupabase.from("reports").insert({
    reported_post_id: input.postId,
    reporter_user_id: authData.user.id,
    reported_user_id: input.authorId,
    reason: input.reason,
    status: "pending",
  });
  if (error) throw error;
}

export async function blockNativeUser(blockedUserId: string) {
  const { data: authData, error: authError } = await nativeSupabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Authentication is required to block a user.");

  const { error } = await nativeSupabase.from("user_blocks").insert({
    blocker_user_id: authData.user.id,
    blocked_user_id: blockedUserId,
  });
  if (error && error.code !== "23505") throw error;
}

export async function toggleNativePostLike(postId: string, userId: string) {
  const { data: existing, error: lookupError } = await nativeSupabase
    .from("post_likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existing) {
    const { error } = await nativeSupabase
      .from("post_likes")
      .delete()
      .match({ post_id: postId, user_id: userId });
    if (error) throw error;
  } else {
    const { error } = await nativeSupabase
      .from("post_likes")
      .insert({ post_id: postId, user_id: userId, created_at: new Date().toISOString() });
    if (error) throw error;
  }

  const { data: likes, error: likesError } = await nativeSupabase
    .from("post_likes")
    .select("user_id")
    .eq("post_id", postId);
  if (likesError) throw likesError;

  return {
    liked: (likes ?? []).some((like) => like.user_id === userId),
    likesCount: likes?.length ?? 0,
  };
}

export async function getNativeLikedPostIds(userId: string, postIds: string[]) {
  if (postIds.length === 0) return new Set<string>();
  const { data, error } = await nativeSupabase
    .from("post_likes")
    .select("post_id")
    .eq("user_id", userId)
    .in("post_id", postIds);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.post_id));
}
