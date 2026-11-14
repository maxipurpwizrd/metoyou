export type StoryLike = {
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

export type GroupedStory = {
  author_id: string;
  author_username: string;
  author_profile_pic: string | null;
  count: number;
  stories: StoryLike[];
};

export function groupNativeStoriesByAuthor<T extends StoryLike>(stories: T[]): GroupedStory[] {
  const groups = new Map<string, GroupedStory>();

  for (const story of [...stories].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())) {
    const existing = groups.get(story.author_id);
    if (!existing) {
      groups.set(story.author_id, {
        author_id: story.author_id,
        author_username: story.author_username,
        author_profile_pic: story.author_profile_pic,
        count: 1,
        stories: [story],
      });
      continue;
    }

    existing.stories.push(story);
    existing.count = existing.stories.length;
    if (new Date(story.created_at).getTime() > new Date(existing.stories[0].created_at).getTime()) {
      existing.stories.sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
    }
  }

  return [...groups.values()].sort(
    (left, right) => new Date(right.stories[0].created_at).getTime() - new Date(left.stories[0].created_at).getTime(),
  );
}
