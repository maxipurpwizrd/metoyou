import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NativeClipShareButton from "./NativeClipShareButton";

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  launchPicker: vi.fn(),
  onPublished: vi.fn(),
  playerPause: vi.fn(),
  playerReplace: vi.fn(),
  publish: vi.fn(),
  discardUpload: vi.fn(),
  requestPermission: vi.fn(),
}));

vi.mock("react-native", async () => {
  const React = await import("react");
  return {
    ActivityIndicator: () => React.createElement("span", null, "Loading"),
    Alert: { alert: mocks.alert },
    Modal: ({ children, visible, onRequestClose }: any) => visible
      ? React.createElement(
        "div",
        null,
        React.createElement("button", { onClick: onRequestClose }, "Close composer"),
        children,
      )
      : null,
    Pressable: ({ accessibilityLabel, children, disabled, onPress }: any) => React.createElement(
      "button",
      { "aria-label": accessibilityLabel, disabled, onClick: onPress },
      children,
    ),
    StyleSheet: { absoluteFill: {}, create: (styles: unknown) => styles },
    Text: ({ accessibilityRole, children }: any) => React.createElement(
      accessibilityRole === "alert" ? "div" : "span",
      accessibilityRole === "alert" ? { role: "alert" } : null,
      children,
    ),
    TextInput: ({ accessibilityLabel, editable, onChangeText, value }: any) => React.createElement(
      "textarea",
      {
        "aria-label": accessibilityLabel,
        disabled: !editable,
        onChange: (event: { currentTarget: { value: string } }) => onChangeText(event.currentTarget.value),
        value,
      },
    ),
    VideoView: () => React.createElement("video"),
    View: ({ children }: any) => React.createElement("div", null, children),
  };
});

vi.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: mocks.launchPicker,
  requestMediaLibraryPermissionsAsync: mocks.requestPermission,
}));

vi.mock("expo-video", () => ({
  VideoView: () => null,
  useVideoPlayer: () => ({
    addListener: () => ({ remove: vi.fn() }),
    duration: 10,
    pause: mocks.playerPause,
    playing: false,
    replace: mocks.playerReplace,
  }),
}));

vi.mock("lucide-react-native", async () => {
  const React = await import("react");
  return { Plus: () => React.createElement("span", null, "+") };
});

vi.mock("../contexts/NativeAuthProvider", () => ({
  useNativeAuth: () => ({ session: { user: { id: "clips-user" } } }),
}));

vi.mock("../contexts/NativeThemeProvider", () => ({
  NATIVE_THEME_COLORS: {
    dark: { text: "#fff", accent: "#fff", accentText: "#000" },
  },
  useNativeTheme: () => ({ theme: "dark" }),
}));

vi.mock("../lib/surfacePosts", () => ({
  publishNativeSurfacePost: mocks.publish,
}));

vi.mock("../lib/clipUpload", () => ({
  discardStagedClipUpload: mocks.discardUpload,
}));

function selectedVideo(overrides: Record<string, unknown> = {}) {
  return {
    uri: "file:///videos/clip.mp4",
    type: "video/mp4",
    fileName: "clip.mp4",
    fileSize: 1024,
    width: 1080,
    height: 1920,
    duration: 12_000,
    ...overrides,
  };
}

async function openComposer(video = selectedVideo()) {
  mocks.launchPicker.mockResolvedValue({ canceled: false, assets: [video] });
  fireEvent.click(screen.getByRole("button", { name: "Create a Clip" }));
  await screen.findByRole("textbox", { name: "Add a caption" });
}

describe("NativeClipShareButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requestPermission.mockResolvedValue({ granted: true });
    mocks.launchPicker.mockResolvedValue({ canceled: true, assets: [] });
    mocks.publish.mockResolvedValue(undefined);
    mocks.discardUpload.mockResolvedValue(undefined);
  });

  it("requests video-only library access and leaves the composer closed on cancellation", async () => {
    render(<NativeClipShareButton onPublished={mocks.onPublished} />);
    fireEvent.click(screen.getByRole("button", { name: "Create a Clip" }));

    await waitFor(() => expect(mocks.launchPicker).toHaveBeenCalledWith(expect.objectContaining({
      mediaTypes: ["videos"],
      allowsEditing: false,
      allowsMultipleSelection: false,
      selectionLimit: 1,
    })));
    expect(mocks.requestPermission).toHaveBeenCalledOnce();
    expect(screen.queryByRole("textbox", { name: "Add a caption" })).toBeNull();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("shows a clear limit error for a video longer than 20 seconds", async () => {
    render(<NativeClipShareButton onPublished={mocks.onPublished} />);
    await openComposer(selectedVideo({ duration: 20_001 }));

    expect(screen.getByText(/Clips must be 20 seconds or shorter/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Post Clip" }).hasAttribute("disabled")).toBe(true);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("shows the existing 100 MiB source-size error before publishing", async () => {
    render(<NativeClipShareButton onPublished={mocks.onPublished} />);
    await openComposer(selectedVideo({ fileSize: 100 * 1024 * 1024 + 1 }));

    expect(screen.getByText(/Videos must be 100 MiB or smaller/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Post Clip" }).hasAttribute("disabled")).toBe(true);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("allows an empty caption and publishes the original video", async () => {
    render(<NativeClipShareButton onPublished={mocks.onPublished} />);
    await openComposer();
    fireEvent.click(screen.getByRole("button", { name: "Post Clip" }));

    await waitFor(() => expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({
      authorId: "clips-user",
      asset: expect.objectContaining({ uri: "file:///videos/clip.mp4", type: "video" }),
      surface: "clips",
      text: "",
      clipUploadJobId: expect.stringMatching(/^clip-/),
      onUploadProgress: expect.any(Function),
    })));
    expect(mocks.onPublished).toHaveBeenCalledOnce();
    expect(mocks.alert).toHaveBeenCalledWith("Clip posted", "Your Clip is now live.");
    expect(screen.queryByRole("textbox", { name: "Add a caption" })).toBeNull();
  });

  it("retains the selected video and caption after upload failure for retry", async () => {
    mocks.publish
      .mockRejectedValueOnce(new Error("Upload failed"))
      .mockResolvedValueOnce(undefined);
    render(<NativeClipShareButton onPublished={mocks.onPublished} />);
    await openComposer();
    const caption = screen.getByRole("textbox", { name: "Add a caption" });
    fireEvent.change(caption, { target: { value: "A first Clip" } });

    fireEvent.click(screen.getByRole("button", { name: "Post Clip" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Upload failed");
    expect((screen.getByRole("textbox", { name: "Add a caption" }) as HTMLTextAreaElement).value).toBe("A first Clip");
    expect(screen.getByText("clip.mp4")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Post Clip" }));
    await waitFor(() => expect(mocks.publish).toHaveBeenCalledTimes(2));
    expect(mocks.publish.mock.calls[0][0]).toMatchObject({ text: "A first Clip" });
    expect(mocks.publish.mock.calls[1][0]).toMatchObject({ text: "A first Clip" });
    expect(mocks.publish.mock.calls[1][0].clipUploadJobId).toBe(mocks.publish.mock.calls[0][0].clipUploadJobId);
    expect(mocks.onPublished).toHaveBeenCalledOnce();
  });

  it("prevents concurrent duplicate submissions", async () => {
    let finishPublish: (() => void) | undefined;
    mocks.publish.mockImplementation(() => new Promise<void>((resolve) => {
      finishPublish = resolve;
    }));
    render(<NativeClipShareButton onPublished={mocks.onPublished} />);
    await openComposer();

    const postButton = screen.getByRole("button", { name: "Post Clip" });
    fireEvent.click(postButton);
    fireEvent.click(postButton);
    expect(mocks.publish).toHaveBeenCalledOnce();

    finishPublish?.();
    await waitFor(() => expect(mocks.onPublished).toHaveBeenCalledOnce());
  });

  it("shows a permission error when media-library access is denied", async () => {
    mocks.requestPermission.mockResolvedValue({ granted: false });
    render(<NativeClipShareButton onPublished={mocks.onPublished} />);
    fireEvent.click(screen.getByRole("button", { name: "Create a Clip" }));

    await waitFor(() => expect(mocks.alert).toHaveBeenCalledWith(
      "Video access needed",
      expect.stringContaining("Allow photo and video access"),
    ));
    expect(mocks.launchPicker).not.toHaveBeenCalled();
  });
});
