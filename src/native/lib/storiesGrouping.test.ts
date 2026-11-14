import { describe, expect, it } from "vitest";
import { groupNativeStoriesByAuthor, type StoryLike } from "./storyGrouping";

const makeStory = (overrides: Partial<StoryLike>): StoryLike => ({
  id: "story-1",
  author_id: "u-1",
  author_username: "alice",
  author_profile_pic: null,
  text: "Hello",
  image_url: null,
  image_original_url: null,
  voice_url: null,
  story_type: "text",
  duration_hours: 24,
  expires_at: "2099-01-01T00:00:00.000Z",
  created_at: "2026-11-01T00:00:00.000Z",
  ...overrides,
});

describe("groupNativeStoriesByAuthor", () => {
  it("groups multiple stories from the same author into one story stack with a count", () => {
    const grouped = groupNativeStoriesByAuthor([
      makeStory({ id: "story-1", author_id: "u-1", author_username: "alice", created_at: "2026-11-01T00:00:00.000Z" }),
      makeStory({ id: "story-2", author_id: "u-1", author_username: "alice", created_at: "2026-11-02T00:00:00.000Z" }),
      makeStory({ id: "story-3", author_id: "u-2", author_username: "bob", created_at: "2026-11-03T00:00:00.000Z" }),
    ]);

    const aliceGroup = grouped.find((group) => group.author_id === "u-1");
    const bobGroup = grouped.find((group) => group.author_id === "u-2");

    expect(grouped).toHaveLength(2);
    expect(aliceGroup).toBeTruthy();
    expect(aliceGroup?.count).toBe(2);
    expect(aliceGroup?.stories).toHaveLength(2);
    expect(bobGroup).toBeTruthy();
    expect(bobGroup?.count).toBe(1);
  });
});
