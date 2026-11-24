import { describe, expect, it } from "vitest";
import {
  getClipVideoValidationError,
  MAX_CLIP_DURATION_MS,
  MAX_CLIP_VIDEO_BYTES,
} from "./clipMediaPolicy";

describe("shared Clips media policies", () => {
  it("keeps the existing video size and duration limits", () => {
    expect(MAX_CLIP_VIDEO_BYTES).toBe(100 * 1024 * 1024);
    expect(MAX_CLIP_DURATION_MS).toBe(20_000);
  });

  it("validates video type, duration, and optional source size", () => {
    expect(getClipVideoValidationError({
      type: "image",
      durationMs: 1_000,
      fileSize: 1,
    })).toBe("Choose a video to post a Clip.");
    expect(getClipVideoValidationError({
      type: "video",
      durationMs: 0,
      fileSize: 1,
    })).toContain("duration could not be determined");
    expect(getClipVideoValidationError({
      type: "video",
      durationMs: MAX_CLIP_DURATION_MS + 1,
      fileSize: 1,
    })).toContain("20 seconds or shorter");
    expect(getClipVideoValidationError({
      type: "video",
      durationMs: 1_000,
      fileSize: MAX_CLIP_VIDEO_BYTES + 1,
    })).toContain("100 MiB");
    expect(getClipVideoValidationError({
      type: "video",
      durationMs: MAX_CLIP_DURATION_MS,
      fileSize: null,
    })).toBeNull();
  });
});
