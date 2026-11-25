import { describe, expect, it } from "vitest";
import { clipUrl, flickUrl, postUrl, profileUrl } from "./contentLinks";

describe("canonical content links", () => {
  it("uses the canonical host and exact post and surface IDs", () => {
    expect(postUrl("post-id")).toBe("https://metoyouvibes.com/posts/post-id");
    expect(clipUrl("clip-id")).toBe("https://metoyouvibes.com/clips/clip-id");
    expect(flickUrl("flick-id")).toBe("https://metoyouvibes.com/flicks/flick-id");
  });

  it("encodes profile usernames as a single route segment", () => {
    expect(profileUrl("user/name")).toBe("https://metoyouvibes.com/profiles/user%2Fname");
  });
});
