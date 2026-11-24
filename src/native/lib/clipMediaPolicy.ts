export const MAX_CLIP_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_CLIP_DURATION_MS = 20_000;

export type ClipVideoMetadata = Readonly<{
  type: "image" | "video";
  durationMs: number;
  fileSize: number | null;
}>;

export function getClipVideoValidationError(asset: ClipVideoMetadata): string | null {
  if (asset.type !== "video") return "Choose a video to post a Clip.";
  if (!Number.isFinite(asset.durationMs) || asset.durationMs <= 0) {
    return "The video duration could not be determined. Choose another video.";
  }
  if (asset.durationMs > MAX_CLIP_DURATION_MS) {
    return "Clips must be 20 seconds or shorter. Choose a shorter video.";
  }
  if (
    asset.fileSize !== null &&
    (!Number.isSafeInteger(asset.fileSize) || asset.fileSize <= 0)
  ) {
    return "The video file size could not be determined. Choose another video.";
  }
  if (asset.fileSize !== null && asset.fileSize > MAX_CLIP_VIDEO_BYTES) {
    return "Videos must be 100 MiB or smaller.";
  }
  return null;
}
