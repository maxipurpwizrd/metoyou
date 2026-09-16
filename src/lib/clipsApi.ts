import { supabase } from "./supabase";

export type ClipRecord = {
  id: string;
  author_id: string;
  username: string;
  profile_pic: string | null;
  text: string | null;
  image_url: string | null;
  image_original_url: string | null;
  video_url: string;
  audio_url: string | null;
  duration_ms: number | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
};

export async function fetchClipsPage(limit = 8, before?: string | null): Promise<ClipRecord[]> {
  const { data, error } = await supabase.rpc("get_surface_posts", {
    p_surface: "clips",
    p_limit: limit,
    p_before: before ?? null,
  });

  if (error) throw error;
  return (data ?? []) as ClipRecord[];
}
