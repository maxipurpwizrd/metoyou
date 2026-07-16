import { supabase } from "./supabase";
import { uploadAudioToSupabase, uploadImageToSupabase } from "./postApi";

export type StoryType = "text" | "photo" | "voice";

export type StoryRecord = {
  id: string;
  author_id: string;
  author_username: string;
  author_profile_pic?: string | null;
  text?: string | null;
  image_url?: string | null;
  voice_url?: string | null;
  story_type: StoryType;
  duration_hours: number;
  expires_at: string;
  reactions?: Record<string, string[]> | null;
  created_at?: string;
};

export async function createStoryToSupabase(input: {
  authorId: string;
  username: string;
  profilePic?: string | null;
  text?: string;
  image?: string;
  voice?: string;
  storyType: StoryType;
  durationHours: number;
}): Promise<StoryRecord | null> {
  try {
    let imageUrl: string | null = null;
    let voiceUrl: string | null = null;

    if (input.image) {
      imageUrl = (await uploadImageToSupabase(input.image, input.authorId)) ?? null;
    }

    if (input.voice) {
      voiceUrl = (await uploadAudioToSupabase(input.voice, input.authorId)) ?? null;
    }

    const expiresAt = new Date(Date.now() + input.durationHours * 60 * 60 * 1000).toISOString();

    const payload = {
      author_id: input.authorId,
      author_username: input.username,
      author_profile_pic: input.profilePic ?? null,
      text: input.text?.trim() ? input.text.trim() : null,
      image_url: imageUrl ?? null,
      voice_url: voiceUrl ?? null,
      story_type: input.storyType,
      duration_hours: input.durationHours,
      expires_at: expiresAt,
      reactions: {},
    };

    const { data, error } = await supabase
      .from("stories")
      .insert(payload)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    return data as StoryRecord | null;
  } catch (error) {
    console.error("createStoryToSupabase error", error);
    return null;
  }
}

export async function fetchStoriesFromSupabase(): Promise<StoryRecord[]> {
  try {
    const { data, error } = await supabase
      .from("stories")
      .select("*")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as StoryRecord[];
  } catch (error) {
    console.error("fetchStoriesFromSupabase error", error);
    return [];
  }
}

export async function updateStoryReactionsInSupabase(storyId: string, reactions: Record<string, string[]>) {
  try {
    const { error } = await supabase.from("stories").update({ reactions }).eq("id", storyId);
    if (error) throw error;
  } catch (error) {
    console.error("updateStoryReactionsInSupabase error", error);
  }
}

export async function deleteStoryFromSupabase(storyId: string) {
  try {
    const { error } = await supabase.from("stories").delete().eq("id", storyId);
    if (error) throw error;
  } catch (error) {
    console.error("deleteStoryFromSupabase error", error);
  }
}

export function subscribeToStories(onChange: (stories: StoryRecord[]) => void) {
  const channel = supabase.channel("stories-realtime");

  channel.on(
    "postgres_changes",
    { event: "*", schema: "public", table: "stories" },
    async () => {
      const stories = await fetchStoriesFromSupabase();
      onChange(stories);
    }
  );

  channel.subscribe();

  return channel;
}
