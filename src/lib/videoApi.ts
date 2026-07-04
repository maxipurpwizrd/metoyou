import { supabase } from "./supabase";

const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

export type UploadProgress = {
  loaded: number;
  total: number;
  percent: number;
};

export async function uploadVideo(
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<string | null> {
  try {
    // Validate file size
    if (file.size > MAX_VIDEO_SIZE) {
      alert(`Video must be less than ${MAX_VIDEO_SIZE / (1024 * 1024)}MB`);
      return null;
    }

    // Validate file type
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      alert("Please select a valid video file (mp4, webm, or mov)");
      return null;
    }

    // Generate unique filename
    const timestamp = Date.now();
    const userId = (await supabase.auth.getUser()).data?.user?.id || "anonymous";
    const filename = `${userId}/${timestamp}_${file.name}`;

    // Upload to Supabase Storage with progress tracking
    const { data, error } = await supabase.storage
      .from("posts-videos")
      .upload(filename, file, {
        contentType: file.type,
        onUploadProgress: (progress) => {
          if (onProgress) {
            const percent = (progress.loaded / progress.total) * 100;
            onProgress({
              loaded: progress.loaded,
              total: progress.total,
              percent,
            });
          }
        },
      });

    if (error) {
      console.error("Video upload error:", error);
      alert("Failed to upload video");
      return null;
    }

    if (!data) {
      alert("Failed to upload video");
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("posts-videos")
      .getPublicUrl(filename);

    return urlData.publicUrl;
  } catch (e) {
    console.error("uploadVideo error:", e);
    alert("Failed to upload video");
    return null;
  }
}

export async function deleteVideo(videoUrl: string): Promise<boolean> {
  try {
    // Extract filename from URL
    const urlParts = videoUrl.split("/");
    const filename = urlParts.slice(-2).join("/");

    const { error } = await supabase.storage
      .from("posts-videos")
      .remove([filename]);

    if (error) {
      console.error("Video delete error:", error);
      return false;
    }

    return true;
  } catch (e) {
    console.error("deleteVideo error:", e);
    return false;
  }
}
