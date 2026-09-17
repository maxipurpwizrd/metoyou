import { supabase } from "./supabase";

export type FlickRecord = {
  id: string;
  author_id: string;
  username: string;
  profile_pic: string | null;
  text: string | null;
  image_url: string;
  image_original_url: string | null;
  video_url: string | null;
  audio_url: string | null;
  duration_ms: number | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
  liked?: boolean;
};

export async function fetchFlicksPage(limit = 8, before?: string | null): Promise<FlickRecord[]> {
  const { data, error } = await supabase.rpc("get_surface_posts", {
    p_surface: "flicks",
    p_limit: limit,
    p_before: before ?? null,
  });

  if (error) throw error;
  return (data ?? []) as FlickRecord[];
}
