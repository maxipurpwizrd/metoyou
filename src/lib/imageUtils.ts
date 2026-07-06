export async function optimizeImageFile(file: File, maxWidth = 1200, quality = 0.8): Promise<Blob> {
  // Create an ImageBitmap for efficient resizing
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, maxWidth / bitmap.width);
  const width = Math.round(bitmap.width * ratio);
  const height = Math.round(bitmap.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");

  ctx.drawImage(bitmap, 0, 0, width, height);

  // Prefer WebP when available, fallback to JPEG
  const tryMimeTypes = ["image/webp", "image/jpeg"];

  for (const mime of tryMimeTypes) {
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), mime, quality)
      );
      if (blob && blob.size > 0) return blob;
    } catch (e) {
      // ignore and try next mime
    }
  }

  // Last resort: return original file as blob
  return file.slice(0, file.size, file.type);
}

export function mimeToExtension(mime: string) {
  switch (mime) {
    case "image/webp":
      return "webp";
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    default:
      return "bin";
  }
}
