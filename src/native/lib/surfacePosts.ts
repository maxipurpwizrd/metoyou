import { File } from "expo-file-system";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import {
  uploadRenderedClip,
} from "./clipUpload";
import { getClipVideoValidationError } from "./clipMediaPolicy";
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
  mimeType?: string | null;
};

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

function getExtension(name: string | null | undefined, mimeType: string, fallback: string) {
  const fromName = name?.match(/\.([a-z0-9]{1,10})$/i)?.[1];
  const normalizedMimeType = mimeType.split(/[;+]/)[0]?.toLowerCase();
  const knownExtensions: Record<string, string> = {
    "video/quicktime": "mov",
    "video/3gpp": "3gp",
    "video/webm": "webm",
    "video/x-matroska": "mkv",
    "image/jpeg": "jpg",
  };
  const fromMime =
    knownExtensions[normalizedMimeType] ??
    normalizedMimeType?.split("/")[1];
  return (fromName || fromMime || fallback).toLowerCase().replace(/[^a-z0-9]/g, "") || fallback;
}

export async function publishNativeSurfacePost(input: {
  authorId: string;
  asset: NativeShareAsset;
  surface: Surface;
  text: string;
  renderedUri?: string;
  clipUploadJobId?: string;
  uploadSignal?: AbortSignal;
  onUploadProgress?: (bytesSent: number, bytesTotal: number) => void;
}) {
  const { data: authData, error: authError } = await nativeSupabase.auth.getUser();
  if (authError) throw authError;
  if (authData.user?.id !== input.authorId) {
    throw new Error("Authentication is required to share media.");
  }

  const isClip = input.surface === "clips";
  const assetMimeType = input.asset.mimeType?.split(";")[0]?.trim().toLowerCase();
  const originalMimeType = input.asset.type === "video"
    ? assetMimeType?.startsWith("video/")
      ? assetMimeType
      : input.asset.fileName?.toLowerCase().endsWith(".mov")
        ? "video/quicktime"
        : "video/mp4"
    : "image/jpeg";
  let uploadUri = input.renderedUri ?? input.asset.uri;
  let mimeType = originalMimeType;
  let extension = getExtension(input.asset.fileName, mimeType, isClip ? "mp4" : "jpg");

  if (isClip) {
    const validationError = getClipVideoValidationError({
      type: input.asset.type,
      durationMs: input.asset.duration,
      fileSize: input.asset.fileSize,
    });
    if (validationError) throw new Error(validationError);
    if (!input.clipUploadJobId) throw new Error("The Clip upload could not be started. Try again.");
    if (input.renderedUri) {
      mimeType = "video/mp4";
      extension = "mp4";
    }
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
  const bucket = isClip ? "posts-videos" : "posts-images";
  const path = isClip
    ? `${input.authorId}/clip-${input.clipUploadJobId}.${extension}`
    : `${input.authorId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const storage = nativeSupabase.storage.from(bucket);
  let uploaded = false;
  let cleanupStagedClip: (() => void) | null = null;
  const cleanupStage = () => {
    try {
      cleanupStagedClip?.();
    } catch (cause) {
      console.warn("Could not remove the staged Clip after upload.", cause);
    }
  };

  try {
    if (isClip) {
      const clipUploadJobId = input.clipUploadJobId;
      if (!clipUploadJobId) throw new Error("Render the Clip again before uploading it.");
      const stagedUpload = await uploadRenderedClip({
        renderedUri: uploadUri,
        jobId: clipUploadJobId,
        objectPath: path,
        contentType: mimeType,
        signal: input.uploadSignal,
        onProgress: input.onUploadProgress,
      });
      cleanupStagedClip = stagedUpload.cleanup;
      uploaded = true;
    } else {
      const file = new File(uploadUri);
      const bytes = await file.bytes();
      if (bytes.byteLength === 0) throw new Error("The selected media file is empty.");
      if (bytes.byteLength > MAX_IMAGE_BYTES) {
        throw new Error("Photos must be 15 MB or smaller.");
      }
      const { error: uploadError } = await storage.upload(path, bytes, {
        contentType: mimeType,
        upsert: false,
      });
      if (uploadError) throw uploadError;
      uploaded = true;
    }

    const mediaUrl = storage.getPublicUrl(path).data.publicUrl;
    if (!mediaUrl) throw new Error("The uploaded media URL could not be created.");

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
    if (postError) throw postError;
  } catch (cause) {
    let cleanupErrorMessage: string | null = null;
    if (uploaded) {
      try {
        const { error: cleanupError } = await storage.remove([path]);
        cleanupErrorMessage = cleanupError?.message ?? null;
      } catch (cleanupCause) {
        cleanupErrorMessage = cleanupCause instanceof Error
          ? cleanupCause.message
          : "The uploaded media could not be removed.";
      }
    }
    if (uploaded) cleanupStage();
    if (cleanupErrorMessage) {
      const reason = cause instanceof Error ? cause.message : "The post could not be shared.";
      throw new Error(`${reason} The uploaded media could not be removed: ${cleanupErrorMessage}`);
    }
    throw cause;
  }

  cleanupStage();
}
