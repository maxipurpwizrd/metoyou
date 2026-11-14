import { File } from "expo-file-system";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { nativeSupabase } from "./supabase";

type Surface = "clips" | "flicks";

export type NativeShareAsset = {
  uri: string;
  type: "image" | "video";
  fileName: string | null;
  fileSize: number | null;
  width: number;
  height: number;
  duration: number;
};

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

function getExtension(name: string | null | undefined, mimeType: string, fallback: string) {
  const fromName = name?.match(/\.([a-z0-9]{1,10})$/i)?.[1];
  const fromMime = mimeType.split("/")[1]?.split(/[;+]/)[0];
  return (fromName || fromMime || fallback).toLowerCase().replace(/[^a-z0-9]/g, "") || fallback;
}

function getVideoMimeType(extension: string) {
  switch (extension) {
    case "mov":
      return "video/quicktime";
    case "webm":
      return "video/webm";
    case "m4v":
      return "video/x-m4v";
    default:
      return "video/mp4";
  }
}

export async function publishNativeSurfacePost(input: {
  authorId: string;
  asset: NativeShareAsset;
  surface: Surface;
  text: string;
  renderedUri?: string;
}) {
  const { data: authData, error: authError } = await nativeSupabase.auth.getUser();
  if (authError) throw authError;
  if (authData.user?.id !== input.authorId) {
    throw new Error("Authentication is required to share media.");
  }

  const isClip = input.surface === "clips";
  const originalMimeType = input.asset.type === "video" ? "video/mp4" : "image/jpeg";
  let uploadUri = input.renderedUri ?? input.asset.uri;
  let mimeType = originalMimeType;
  let extension = getExtension(input.asset.fileName, mimeType, isClip ? "mp4" : "jpg");

  if (isClip) {
    if (input.asset.type !== "video" && !input.renderedUri) {
      throw new Error("A photo must be converted to a video before sharing it as a Clip.");
    }
    if (input.asset.type === "video" && !mimeType.startsWith("video/")) throw new Error("Choose a video to share a Clip.");
    if (input.asset.fileSize != null && input.asset.fileSize > MAX_VIDEO_BYTES) {
      throw new Error("Videos must be 100 MB or smaller.");
    }
    if (input.asset.type === "video") mimeType = getVideoMimeType(extension);
  } else {
    if (input.asset.type !== "image") throw new Error("Choose a photo to share a Flick.");
    if (input.asset.fileSize != null && input.asset.fileSize > MAX_IMAGE_BYTES) {
      throw new Error("Photos must be 15 MB or smaller.");
    }
    const optimized = await manipulateAsync(
      input.asset.uri,
      [{ resize: { width: Math.min(input.asset.width || 1920, 1920) } }],
      { compress: 0.88, format: SaveFormat.JPEG },
    );
    uploadUri = optimized.uri;
    mimeType = "image/jpeg";
    extension = "jpg";
  }
  if (input.renderedUri) {
    mimeType = "video/mp4";
    extension = "mp4";
  }

  const file = new File(uploadUri);
  const bytes = await file.bytes();
  const maxBytes = isClip ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (bytes.byteLength === 0) throw new Error("The selected media file is empty.");
  if (bytes.byteLength > maxBytes) {
    throw new Error(isClip ? "Videos must be 100 MB or smaller." : "Photos must be 15 MB or smaller.");
  }

  const bucket = isClip ? "posts-videos" : "posts-images";
  const path = `${input.authorId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const storage = nativeSupabase.storage.from(bucket);
  const { error: uploadError } = await storage.upload(path, bytes, {
    contentType: mimeType,
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const mediaUrl = storage.getPublicUrl(path).data.publicUrl;
  if (!mediaUrl) {
    const { error: cleanupError } = await storage.remove([path]);
    if (cleanupError) {
      throw new Error(`Could not create the media URL. The uploaded file could not be removed: ${cleanupError.message}`);
    }
    throw new Error("The uploaded media URL could not be created.");
  }

  const { error: postError } = await nativeSupabase.from("posts").insert({
    author_id: input.authorId,
    text: input.text.trim() || null,
    image_url: isClip ? null : mediaUrl,
    image_original_url: isClip ? null : mediaUrl,
    video_url: isClip ? mediaUrl : null,
    audio_url: null,
    media_type: isClip ? "video" : "image",
    highlighted: false,
    created_at: new Date().toISOString(),
  });
  if (postError) {
    const { error: cleanupError } = await storage.remove([path]);
    if (cleanupError) {
      throw new Error(`Could not share the post: ${postError.message}. The uploaded file could not be removed: ${cleanupError.message}`);
    }
    throw postError;
  }
}
