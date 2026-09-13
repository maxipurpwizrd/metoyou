import { supabase } from "./supabase";
import { mimeToExtension, optimizeImageFile } from "./imageUtils";
import { normalizeTimestamp } from "./time";
import type { PostMediaType, PostRecord } from "../types/post";
import type { RealtimeChannel } from "@supabase/supabase-js";

export const AUDIO_STORAGE_BUCKET = "post-audio";
export const IMAGE_STORAGE_BUCKET = "posts-images";

export type ImageUploadVariants = {
  optimizedUrl: string | null;
  originalUrl: string | null;
};

function inferAudioMimeType(audio: string) {
  if (audio.startsWith("data:")) {
    const match = audio.match(/^data:(.+);base64,/);
    return match?.[1] || "audio/webm";
  }

  return "audio/webm";
}

function inferAudioExtension(mimeType: string) {
  switch (mimeType) {
    case "audio/mpeg":
    case "audio/mp3":
      return "mp3";
    case "audio/wav":
      return "wav";
    case "audio/ogg":
      return "ogg";
    case "audio/webm":
      return "webm";
    default:
      return "bin";
  }
}

async function uploadBlobToSupabase(
  blob: Blob,
  bucket: string,
  authorId: string,
  extension: string,
  mimeType: string,
  onProgress?: (percent: number) => void
) {
  const filePath = `${authorId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

  const { error } = await supabase.storage.from(bucket).upload(filePath, blob, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) throw error;
  onProgress?.(100);

  const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return publicUrlData.publicUrl ?? null;
}

export async function uploadImageToSupabase(image: string, authorId: string, onProgress?: (percent: number) => void) {
  if (!image) return undefined;

  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }

  const response = await fetch(image);
  const blob = await response.blob();
  const mimeType = blob.type || "image/jpeg";
  const extension = mimeToExtension(mimeType);
  return uploadBlobToSupabase(blob, IMAGE_STORAGE_BUCKET, authorId, extension, mimeType, onProgress);
}

export async function uploadImageVariantsToSupabase(
  optimizedImage: string,
  originalImage: string | undefined,
  authorId: string,
  onProgress?: (percent: number) => void
): Promise<ImageUploadVariants> {
  const optimizedUrl = await uploadImageToSupabase(optimizedImage, authorId, (percent) => {
    onProgress?.(Math.round(percent * (originalImage ? 0.5 : 1)));
  });

  if (!originalImage || originalImage === optimizedImage) {
    onProgress?.(100);
    return { optimizedUrl: optimizedUrl ?? null, originalUrl: optimizedUrl ?? null };
  }

  const response = await fetch(originalImage);
  const blob = await response.blob();
  const mimeType = blob.type || "image/jpeg";
  const extension = mimeToExtension(mimeType);
  const originalUrl = await uploadBlobToSupabase(blob, IMAGE_STORAGE_BUCKET, authorId, extension, mimeType, (percent) => {
    onProgress?.(50 + Math.round(percent * 0.5));
  });

  return { optimizedUrl: optimizedUrl ?? null, originalUrl: originalUrl ?? null };
}

export async function uploadImageFileVariantsToSupabase(
  file: File,
  authorId: string
): Promise<ImageUploadVariants> {
  const optimized = await optimizeImageFile(file, 1080, 0.8, 300 * 1024);
  const optimizedUrl = await uploadBlobToSupabase(
    optimized,
    IMAGE_STORAGE_BUCKET,
    authorId,
    mimeToExtension(optimized.type || "image/jpeg"),
    optimized.type || "image/jpeg"
  );
  const originalUrl = await uploadBlobToSupabase(
    file,
    IMAGE_STORAGE_BUCKET,
    authorId,
    mimeToExtension(file.type || "image/jpeg"),
    file.type || "image/jpeg"
  );

  return { optimizedUrl: optimizedUrl ?? null, originalUrl: originalUrl ?? null };
}

export async function uploadAudioToSupabase(audio: string | Blob, authorId?: string, onProgress?: (percent: number) => void) {
  if (!audio) return undefined;

  if (typeof audio === "string") {
    if (audio.startsWith("http://") || audio.startsWith("https://")) {
      return audio;
    }

    const response = await fetch(audio);
    const blob = await response.blob();
    const mimeType = blob.type || inferAudioMimeType(audio);
    const extension = inferAudioExtension(mimeType);
    return uploadBlobToSupabase(blob, AUDIO_STORAGE_BUCKET, authorId ?? "anonymous", extension, mimeType, onProgress);
  }

  const blob = audio instanceof Blob ? audio : new Blob([audio]);
  const mimeType = blob.type || "audio/webm";
  const extension = inferAudioExtension(mimeType);
  return uploadBlobToSupabase(blob, AUDIO_STORAGE_BUCKET, authorId ?? "anonymous", extension, mimeType, onProgress);
}

/**
 * Save a post to the `posts` table.
 * If `id` is provided in the payload, this will upsert the post.
 */
export async function savePostToSupabase(payload: {
  author_id: string;
  text?: string | null;
  image_url?: string | null;
  image_original_url?: string | null;
  video_url?: string | null;
  audio_url?: string | null;
  media_type?: PostMediaType;
  highlighted?: boolean;
}): Promise<PostRecord | null> {
  try {
    const insert = {
      author_id: payload.author_id,
      text: payload.text ?? null,
      image_url: payload.image_url ?? null,
      image_original_url: payload.image_original_url ?? null,
      video_url: payload.video_url ?? null,
      audio_url: payload.audio_url ?? null,
      media_type: payload.media_type ?? null,
      highlighted: payload.highlighted ?? false,
      created_at: normalizeTimestamp(new Date()) ?? new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("posts")
      .insert(insert)
      .select(
        `id, author_id, text, image_url, image_original_url, video_url, audio_url, media_type, likes_count, comments_count, highlighted, created_at`
      )
      .maybeSingle();

    if (error) throw error;
    return data ?? null;
  } catch (e) {
    console.error("savePostToSupabase error", e);
    throw e;
  }
}

/**
 * Fetch posts from the `posts` table.
 * Options: limit (default 50), before (ISO timestamp to fetch older posts), author_id filter
 */
export async function fetchPostsFromSupabase(options?: {
  limit?: number;
  before?: string;
  after?: string;
  author_id?: string;
}): Promise<PostRecord[]> {
  try {
    const limit = options?.limit ?? 50;

    let builder = supabase
      .from("posts")
      .select(
        `id, author_id, text, image_url, image_original_url, video_url, audio_url, media_type, likes_count, comments_count, highlighted, created_at, profiles(username, profile_pic, is_vibes_pro)`
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (options?.before) {
      builder = builder.lt("created_at", options.before);
    }

    if (options?.after) {
      builder = builder.gt("created_at", options.after);
    }

    if (options?.author_id) {
      builder = builder.eq("author_id", options.author_id);
    }

    const { data, error } = await builder;
    if (error) throw error;

    const normalizedRows = (data ?? []).map((record) => ({
      ...record,
      profiles: Array.isArray(record.profiles)
        ? record.profiles[0] ?? null
        : record.profiles ?? null,
    }));

    return normalizedRows as PostRecord[];
  } catch (e) {
    console.error("fetchPostsFromSupabase error", e);
    return [] as PostRecord[];
  }
}

/**
 * Delete a post by id from the `posts` table.
 * Returns true on success.
 */
export async function updatePostInSupabase(postId: string, updates: { text?: string | null }): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("posts")
      .update({ text: updates.text ?? null })
      .eq("id", postId);

    if (error) throw error;
    return true;
  } catch (e) {
    console.error("updatePostInSupabase error", e);
    return false;
  }
}

export async function fetchPostByIdFromSupabase(postId: string): Promise<PostRecord | null> {
  try {
    const { data, error } = await supabase
      .from("posts")
      .select(
        `id, author_id, text, image_url, image_original_url, video_url, audio_url, media_type, likes_count, comments_count, highlighted, created_at, profiles(username, profile_pic, is_vibes_pro)`
      )
      .eq("id", postId)
      .maybeSingle();

    if (error) throw error;

    if (!data) return null;

    return {
      ...data,
      profiles: Array.isArray(data.profiles)
        ? data.profiles[0] ?? null
        : data.profiles ?? null,
    } as PostRecord;
  } catch (e) {
    console.error("fetchPostByIdFromSupabase error", e);
    return null;
  }
}

export function subscribeToNewPosts(onPost: (post: PostRecord) => void): RealtimeChannel {
  const channel = supabase.channel("feed-posts");

  channel.on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "posts" },
    async (payload) => {
      const postId = typeof payload.new?.id === "string" ? payload.new.id : null;
      if (!postId) return;

      const post = await fetchPostByIdFromSupabase(postId);
      if (post) onPost(post);
    }
  );

  channel.subscribe();
  return channel;
}

export async function deletePostFromSupabase(postId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("deletePostFromSupabase error", e);
    return false;
  }
}
