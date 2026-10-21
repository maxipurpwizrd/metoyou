import { nativeSupabase } from "./supabase";

export type NativeStory = {
  id: string;
  author_id: string;
  author_username: string;
  author_profile_pic: string | null;
  text: string | null;
  image_url: string | null;
  image_original_url: string | null;
  voice_url: string | null;
  story_type: "text" | "photo" | "voice";
  duration_hours: number;
  expires_at: string;
  created_at: string;
};

function decodeBase64(value: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const byteLength =
    Math.floor((value.length * 3) / 4) -
    (value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0);
  const bytes = new Uint8Array(byteLength);
  let offset = 0;

  for (let index = 0; index < value.length; index += 4) {
    const first = alphabet.indexOf(value[index]);
    const second = alphabet.indexOf(value[index + 1]);
    const third = alphabet.indexOf(value[index + 2]);
    const fourth = alphabet.indexOf(value[index + 3]);
    const combined = (first << 18) | (second << 12) | ((third & 63) << 6) | (fourth & 63);
    if (offset < byteLength) bytes[offset++] = (combined >> 16) & 255;
    if (offset < byteLength) bytes[offset++] = (combined >> 8) & 255;
    if (offset < byteLength) bytes[offset++] = combined & 255;
  }

  return bytes;
}

export async function fetchNativeStories(): Promise<NativeStory[]> {
  const { data, error } = await nativeSupabase
    .from("stories")
    .select(
      "id, author_id, author_username, author_profile_pic, text, image_url, image_original_url, voice_url, story_type, duration_hours, expires_at, created_at",
    )
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as NativeStory[];
}

export async function createNativeStory(input: {
  authorId: string;
  username: string;
  profilePic: string | null;
  text: string;
  imageBase64?: string;
  originalImageBase64?: string;
  originalImageMimeType?: string;
  durationHours: number;
}): Promise<NativeStory> {
  const { data: authData, error: authError } = await nativeSupabase.auth.getUser();
  if (authError) throw authError;
  if (authData.user?.id !== input.authorId) {
    throw new Error("Authentication is required to create a story.");
  }
  if (!input.text.trim() && !input.imageBase64) {
    throw new Error("Add text or a photo to share a story.");
  }

  const storage = nativeSupabase.storage.from("posts-images");
  const uploadedPaths: string[] = [];
  let imageUrl: string | null = null;
  let imageOriginalUrl: string | null = null;

  if (input.imageBase64) {
    const basePath = `${input.authorId}/story-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimizedPath = `${basePath}-optimized.jpg`;
    const { error: optimizedError } = await storage.upload(
      optimizedPath,
      decodeBase64(input.imageBase64),
      { contentType: "image/jpeg", upsert: false },
    );
    if (optimizedError) throw optimizedError;
    uploadedPaths.push(optimizedPath);
    imageUrl = storage.getPublicUrl(optimizedPath).data.publicUrl;

    if (input.originalImageBase64 && input.originalImageBase64 !== input.imageBase64) {
      const originalMimeType = input.originalImageMimeType ?? "image/jpeg";
      const extension =
        originalMimeType.split("/")[1]?.split(/[;+]/)[0]?.replace(/[^a-z0-9-]/gi, "") || "jpg";
      const originalPath = `${basePath}-original.${extension}`;
      const { error: originalError } = await storage.upload(
        originalPath,
        decodeBase64(input.originalImageBase64),
        { contentType: originalMimeType, upsert: false },
      );
      if (originalError) {
        const { error: cleanupError } = await storage.remove(uploadedPaths);
        if (cleanupError) {
          throw new Error(
            `Could not upload the original story image: ${originalError.message}. The optimized image could not be removed: ${cleanupError.message}`,
          );
        }
        throw originalError;
      }
      uploadedPaths.push(originalPath);
      imageOriginalUrl = storage.getPublicUrl(originalPath).data.publicUrl;
    } else {
      imageOriginalUrl = imageUrl;
    }
  }

  const expiresAt = new Date(Date.now() + input.durationHours * 60 * 60 * 1000).toISOString();
  const { data, error } = await nativeSupabase
    .from("stories")
    .insert({
      author_id: input.authorId,
      author_username: input.username,
      author_profile_pic: input.profilePic,
      text: input.text.trim() || null,
      image_url: imageUrl,
      image_original_url: imageOriginalUrl,
      voice_url: null,
      story_type: imageUrl ? "photo" : "text",
      duration_hours: input.durationHours,
      expires_at: expiresAt,
      reactions: {},
    })
    .select(
      "id, author_id, author_username, author_profile_pic, text, image_url, image_original_url, voice_url, story_type, duration_hours, expires_at, created_at",
    )
    .single();

  if (error) {
    if (uploadedPaths.length > 0) {
      const { error: cleanupError } = await storage.remove(uploadedPaths);
      if (cleanupError) {
        throw new Error(
          `Could not create the story: ${error.message}. Its uploaded image could not be removed: ${cleanupError.message}`,
        );
      }
    }
    throw error;
  }

  return data as NativeStory;
}

export async function deleteNativeStory(storyId: string, authorId: string) {
  const { data: authData, error: authError } = await nativeSupabase.auth.getUser();
  if (authError) throw authError;
  if (authData.user?.id !== authorId) {
    throw new Error("Only the story author can delete this story.");
  }
  const { error } = await nativeSupabase
    .from("stories")
    .delete()
    .eq("id", storyId)
    .eq("author_id", authorId);
  if (error) throw error;
}
