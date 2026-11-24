import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fileBytes: vi.fn(),
  from: vi.fn(),
  getPublicUrl: vi.fn(),
  getUser: vi.fn(),
  insert: vi.fn(),
  manipulate: vi.fn(),
  remove: vi.fn(),
  storageFrom: vi.fn(),
  upload: vi.fn(),
  uploadRenderedClip: vi.fn(),
}));

vi.mock("expo-file-system", () => ({
  File: class {
    async bytes() {
      return mocks.fileBytes();
    }
  },
}));

vi.mock("expo-image-manipulator", () => ({
  manipulateAsync: mocks.manipulate,
  SaveFormat: { JPEG: "jpeg" },
}));

vi.mock("./clipUpload", () => ({
  MAX_CLIP_UPLOAD_BYTES: 100 * 1024 * 1024,
  uploadRenderedClip: mocks.uploadRenderedClip,
}));

vi.mock("./supabase", () => ({
  nativeSupabase: {
    auth: { getUser: mocks.getUser },
    from: mocks.from,
    storage: { from: mocks.storageFrom },
  },
}));

import { publishNativeSurfacePost } from "./surfacePosts";

function flickInput() {
  return {
    authorId: "flicks-user",
    asset: {
      uri: "file:///source/photo.jpg",
      type: "image" as const,
      fileName: "photo.jpg",
      fileSize: null,
      width: 1200,
      height: 1600,
      duration: 0,
    },
    surface: "flicks" as const,
    text: "A caption",
  };
}

function clipInput(overrides: Record<string, unknown> = {}) {
  return {
    authorId: "flicks-user",
    asset: {
      uri: "file:///source/clip.mov",
      type: "video" as const,
      fileName: "clip.mov",
      fileSize: 1024,
      width: 1080,
      height: 1920,
      duration: 12_000,
      mimeType: "video/quicktime",
      ...overrides,
    },
    surface: "clips" as const,
    text: "",
    clipUploadJobId: "job-1",
  };
}

describe("Flick publishing upload cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "flicks-user" } }, error: null });
    mocks.manipulate.mockResolvedValue({ uri: "file:///optimized/photo.jpg" });
    mocks.fileBytes.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mocks.upload.mockResolvedValue({ error: null });
    mocks.remove.mockResolvedValue({ error: null });
    mocks.uploadRenderedClip.mockResolvedValue({ sizeBytes: 4, cleanup: vi.fn() });
    mocks.getPublicUrl.mockReturnValue({ data: { publicUrl: "https://example.test/photo.jpg" } });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.storageFrom.mockReturnValue({
      getPublicUrl: mocks.getPublicUrl,
      remove: mocks.remove,
      upload: mocks.upload,
    });
    mocks.from.mockReturnValue({ insert: mocks.insert });
  });

  it("removes uploaded photo media when creating the post fails", async () => {
    const postError = new Error("Post creation failed");
    mocks.insert.mockResolvedValue({ error: postError });

    await expect(publishNativeSurfacePost(flickInput())).rejects.toBe(postError);

    expect(mocks.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^flicks-user\/\d+-[a-z0-9]+\.jpg$/),
      new Uint8Array([1, 2, 3]),
      { contentType: "image/jpeg", upsert: false },
    );
    expect(mocks.remove).toHaveBeenCalledWith([
      expect.stringMatching(/^flicks-user\/\d+-[a-z0-9]+\.jpg$/),
    ]);
  });

  it("uploads the optimized image and creates a Flick post with the existing media contract", async () => {
    await publishNativeSurfacePost(flickInput());

    expect(mocks.manipulate).toHaveBeenCalledWith(
      "file:///source/photo.jpg",
      [{ resize: { width: 1200 } }],
      { compress: 0.88, format: "jpeg" },
    );
    expect(mocks.storageFrom).toHaveBeenCalledWith("posts-images");
    expect(mocks.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^flicks-user\/\d+-[a-z0-9]+\.jpg$/),
      new Uint8Array([1, 2, 3]),
      { contentType: "image/jpeg", upsert: false },
    );
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      author_id: "flicks-user",
      text: "A caption",
      image_url: "https://example.test/photo.jpg",
      image_original_url: "https://example.test/photo.jpg",
      video_url: null,
      audio_url: null,
      media_type: "image",
      highlighted: false,
    }));
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("does not attempt remote cleanup when the photo upload itself fails", async () => {
    mocks.upload.mockResolvedValue({ error: new Error("Upload failed") });

    await expect(publishNativeSurfacePost(flickInput())).rejects.toThrow("Upload failed");

    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("uploads the selected original Clip and creates the existing video post contract", async () => {
    await publishNativeSurfacePost(clipInput());

    expect(mocks.uploadRenderedClip).toHaveBeenCalledWith(expect.objectContaining({
      renderedUri: "file:///source/clip.mov",
      jobId: "job-1",
      objectPath: "flicks-user/clip-job-1.mov",
      contentType: "video/quicktime",
    }));
    expect(mocks.storageFrom).toHaveBeenCalledWith("posts-videos");
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      author_id: "flicks-user",
      text: null,
      image_url: null,
      image_original_url: null,
      video_url: "https://example.test/photo.jpg",
      audio_url: null,
      media_type: "video",
      highlighted: false,
    }));
  });

  it("rejects a non-video Clip and a video over the 20-second limit", async () => {
    await expect(publishNativeSurfacePost(clipInput({ type: "image" })))
      .rejects.toThrow("Choose a video");
    await expect(publishNativeSurfacePost(clipInput({ duration: 20_001 })))
      .rejects.toThrow("20 seconds or shorter");

    expect(mocks.uploadRenderedClip).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("rejects a video over the 100 MiB limit before uploading", async () => {
    await expect(publishNativeSurfacePost(
      clipInput({ fileSize: 100 * 1024 * 1024 + 1 }),
    )).rejects.toThrow("100 MiB or smaller");

    expect(mocks.uploadRenderedClip).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("keeps the selected video and upload identity available for retry", async () => {
    mocks.uploadRenderedClip
      .mockRejectedValueOnce(new Error("Upload interrupted"))
      .mockResolvedValueOnce({ sizeBytes: 4, cleanup: vi.fn() });
    const input = { ...clipInput(), text: "Retry this Clip" };

    await expect(publishNativeSurfacePost(input)).rejects.toThrow("Upload interrupted");
    await publishNativeSurfacePost(input);

    expect(mocks.uploadRenderedClip).toHaveBeenCalledTimes(2);
    expect(mocks.uploadRenderedClip.mock.calls[0][0]).toMatchObject({
      renderedUri: "file:///source/clip.mov",
      jobId: "job-1",
      objectPath: "flicks-user/clip-job-1.mov",
    });
    expect(mocks.uploadRenderedClip.mock.calls[1][0]).toMatchObject({
      renderedUri: "file:///source/clip.mov",
      jobId: "job-1",
      objectPath: "flicks-user/clip-job-1.mov",
    });
    expect(mocks.insert).toHaveBeenCalledOnce();
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ text: "Retry this Clip" }));
  });
});
