import { supabase } from "./supabase";
import { mimeToExtension } from "./imageUtils";

export const AUDIO_STORAGE_BUCKET = "post-audio";
export const IMAGE_STORAGE_BUCKET = "posts-images";

export type PostRecord = {
  id: string;
  author_id: string;
  text?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  audio_url?: string | null;
  media_type?: string | null;
  likes_count?: number;
  comments_count?: number;
  highlighted?: boolean;
  created_at: string;
  profiles?: {
    username?: string;
    profile_pic?: string;
    is_vibes_pro?: boolean | null;
  } | null;
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
    onUploadProgress: (event: { loaded: number; total?: number | null }) => {
      const percent = event.total ? Math.round((event.loaded / event.total) * 100) : 100;
      onProgress?.(percent);
    },
  } as never);

  if (error) throw error;

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

export async function uploadAudioToSupabase(audio: string, authorId: string, onProgress?: (percent: number) => void) {
  if (!audio) return undefined;

  if (audio.startsWith("http://") || audio.startsWith("https://")) {
    return audio;
  }

  const response = await fetch(audio);
  const blob = await response.blob();
  const mimeType = blob.type || inferAudioMimeType(audio);
  const extension = inferAudioExtension(mimeType);
  return uploadBlobToSupabase(blob, AUDIO_STORAGE_BUCKET, authorId, extension, mimeType, onProgress);
}

/**
 * Save a post to the `posts` table.
 * If `id` is provided in the payload, this will upsert the post.
 */
export async function savePostToSupabase(payload: {
  author_id: string;
  text?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  audio_url?: string | null;
  media_type?: string | null;
  highlighted?: boolean;
}) {
  try {
    const insert = {
      author_id: payload.author_id,
      text: payload.text ?? null,
      image_url: payload.image_url ?? null,
      video_url: payload.video_url ?? null,
      audio_url: payload.audio_url ?? null,
      media_type: payload.media_type ?? null,
      highlighted: payload.highlighted ?? false,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("posts")
      .insert(insert)
      .select(
        `id, author_id, text, image_url, video_url, audio_url, media_type, likes_count, comments_count, highlighted, created_at`
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
}) {
  try {
    const limit = options?.limit ?? 50;

    let builder = supabase
      .from("posts")
      .select(
        `id, author_id, text, image_url, video_url, audio_url, media_type, likes_count, comments_count, highlighted, created_at, profiles(username, profile_pic, is_vibes_pro)`
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
    return data ?? [];
  } catch (e) {
    console.error("fetchPostsFromSupabase error", e);
    return [] as PostRecord[];
  }
}

/**
 * Delete a post by id from the `posts` table.
 * Returns true on success.
 */
export async function deletePostFromSupabase(postId: string) {
  try {
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("deletePostFromSupabase error", e);
    return false;
  }
}
