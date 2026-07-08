export const MAX_IMAGE_WIDTH = 1080;
export const MAX_IMAGE_SIZE_BYTES = 300 * 1024;
export const TARGET_AUDIO_BITRATE_BPS = 64 * 1024;
export const MAX_AUDIO_SIZE_BYTES = 5 * 1024 * 1024;

export async function optimizeImageFile(
  file: File,
  maxWidth = MAX_IMAGE_WIDTH,
  quality = 0.8,
  targetSizeBytes = MAX_IMAGE_SIZE_BYTES
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, maxWidth / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context not available");
  }

  ctx.drawImage(bitmap, 0, 0, width, height);

  const mimeCandidates = ["image/webp", "image/jpeg"] as const;
  const qualityCandidates = [quality, 0.8, 0.75, 0.7, 0.65, 0.6];

  let bestBlob: Blob | null = null;

  for (const mimeType of mimeCandidates) {
    for (const candidateQuality of qualityCandidates) {
      const blob = await canvasToBlob(canvas, mimeType, candidateQuality);
      if (!blob || blob.size === 0) continue;

      if (!bestBlob || blob.size < bestBlob.size) {
        bestBlob = blob;
      }

      if (blob.size <= targetSizeBytes) {
        return blob;
      }
    }
  }

  if (bestBlob) {
    if (bestBlob.size <= targetSizeBytes) {
      return bestBlob;
    }

    const fallbackBlob = file.slice(0, file.size, file.type || "image/jpeg");
    if (fallbackBlob.size <= targetSizeBytes) {
      return fallbackBlob;
    }

    throw new Error(`Image is still larger than ${Math.round(targetSizeBytes / 1024)}KB after compression`);
  }

  const fallbackBlob = file.slice(0, file.size, file.type || "image/jpeg");
  if (fallbackBlob.size <= targetSizeBytes) {
    return fallbackBlob;
  }

  throw new Error(`Image is still larger than ${Math.round(targetSizeBytes / 1024)}KB after compression`);
}

export function getSupportedAudioRecorderOptions() {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return { mimeType: undefined as string | undefined, audioBitsPerSecond: TARGET_AUDIO_BITRATE_BPS };
  }

  const preferredMimeTypes = [
    "audio/webm;codecs=opus",
    "audio/ogg;codecs=opus",
    "audio/webm",
  ];

  for (const mimeType of preferredMimeTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return { mimeType, audioBitsPerSecond: TARGET_AUDIO_BITRATE_BPS };
    }
  }

  return { mimeType: undefined as string | undefined, audioBitsPerSecond: TARGET_AUDIO_BITRATE_BPS };
}

export async function optimizeVoiceNote(file: Blob, maxSizeBytes = MAX_AUDIO_SIZE_BYTES): Promise<Blob> {
  if (file.size <= maxSizeBytes) {
    return file;
  }

  throw new Error(`Voice note is larger than ${Math.round(maxSizeBytes / 1024)}KB after compression`);
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}
