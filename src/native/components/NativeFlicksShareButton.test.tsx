import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NativeFlicksShareButton from "./NativeFlicksShareButton";

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  getAssetInfo: vi.fn(),
  getAssets: vi.fn(),
  onPublished: vi.fn(),
  publish: vi.fn(),
  requestCameraPermission: vi.fn(),
  requestMediaPermission: vi.fn(),
  takePicture: vi.fn(),
}));

vi.mock("react-native", async () => {
  const React = await import("react");
  return {
    ActivityIndicator: () => React.createElement("span", null, "Loading"),
    Alert: { alert: mocks.alert },
    FlatList: ({ data, renderItem, onEndReached }: any) => React.createElement(
      "div",
      null,
      ...data.map((item: any) => React.createElement(
        React.Fragment,
        { key: item.id },
        renderItem({ item }),
      )),
      React.createElement("button", { onClick: onEndReached }, "Load more"),
    ),
    Image: ({ source }: any) => React.createElement("img", { src: source?.uri }),
    Modal: ({ children, visible, onRequestClose }: any) => visible
      ? React.createElement(
        "div",
        null,
        React.createElement("button", { onClick: onRequestClose }, "Modal back"),
        children,
      )
      : null,
    Pressable: ({ accessibilityLabel, children, disabled, onPress }: any) => React.createElement(
      "button",
      {
        "aria-label": accessibilityLabel,
        disabled,
        onClick: onPress,
      },
      children,
    ),
    StyleSheet: { absoluteFill: {}, create: (styles: unknown) => styles },
    Text: ({ children }: any) => React.createElement("span", null, children),
    TextInput: ({ accessibilityLabel, editable, maxLength, onChangeText, value }: any) => React.createElement(
      "input",
      {
        "aria-label": accessibilityLabel,
        disabled: !editable,
        maxLength,
        onChange: (event: { currentTarget: { value: string } }) => onChangeText(event.currentTarget.value),
        value,
      },
    ),
    View: ({ children }: any) => React.createElement("div", null, children),
    useWindowDimensions: () => ({ width: 390, height: 844 }),
  };
});

vi.mock("expo-camera", async () => {
  const React = await import("react");
  const CameraView = React.forwardRef((props: any, ref) => {
    React.useImperativeHandle(ref, () => ({ takePictureAsync: mocks.takePicture }));
    return React.createElement("button", { onClick: props.onCameraReady }, "Camera ready");
  });
  return {
    Camera: { requestCameraPermissionsAsync: mocks.requestCameraPermission },
    CameraView,
  };
});

vi.mock("expo-media-library/legacy", () => ({
  getAssetInfoAsync: mocks.getAssetInfo,
  getAssetsAsync: mocks.getAssets,
  requestPermissionsAsync: mocks.requestMediaPermission,
}));

vi.mock("lucide-react-native", async () => {
  const React = await import("react");
  const Icon = () => React.createElement("span");
  return { Camera: Icon, ImagePlus: Icon, Plus: Icon };
});

vi.mock("../contexts/NativeAuthProvider", () => ({
  useNativeAuth: () => ({ session: { user: { id: "flicks-user" } } }),
}));

vi.mock("../contexts/NativeThemeProvider", () => ({
  NATIVE_THEME_COLORS: {
    dark: { text: "#fff", accent: "#000", accentText: "#fff" },
  },
  useNativeTheme: () => ({ theme: "dark" }),
}));

vi.mock("../lib/surfacePosts", () => ({
  publishNativeSurfacePost: mocks.publish,
}));

function photo(id: string, filename: string) {
  return {
    id,
    filename,
    uri: `ph://${id}`,
    mediaType: "photo",
    width: 1200,
    height: 1600,
    duration: 0,
  };
}

async function openGallery() {
  fireEvent.click(screen.getByRole("button", { name: "Share a Flick" }));
  await screen.findByRole("button", { name: "Camera ready" });
  fireEvent.click(screen.getByRole("button", { name: "Galerie" }));
}

describe("NativeFlicksShareButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requestCameraPermission.mockResolvedValue({ granted: true });
    mocks.requestMediaPermission.mockResolvedValue({ granted: true });
    mocks.getAssets.mockResolvedValue({
      assets: [photo("newest", "newest.jpg"), photo("older", "older.jpg")],
      endCursor: "cursor-1",
      hasNextPage: false,
    });
    mocks.getAssetInfo.mockResolvedValue({ localUri: "file:///local/photo.jpg", uri: "ph://newest" });
    mocks.takePicture.mockResolvedValue({
      uri: "file:///captured/photo.jpg",
      width: 1080,
      height: 1920,
    });
    mocks.publish.mockResolvedValue(undefined);
  });

  it("captures a photo, enforces the caption limit, publishes, and resets on reopen", async () => {
    render(<NativeFlicksShareButton onPublished={mocks.onPublished} />);

    fireEvent.click(screen.getByRole("button", { name: "Share a Flick" }));
    await screen.findByRole("button", { name: "Camera ready" });
    fireEvent.click(screen.getByRole("button", { name: "Camera ready" }));
    fireEvent.click(screen.getByRole("button", { name: "Take photo" }));

    const caption = await screen.findByRole("textbox", { name: "Add a caption" });
    expect((caption as HTMLInputElement).maxLength).toBe(120);
    fireEvent.change(caption, { target: { value: "A nice photo" } });
    fireEvent.click(screen.getByRole("button", { name: "Share Flick" }));

    await waitFor(() => expect(mocks.publish).toHaveBeenCalledWith({
      authorId: "flicks-user",
      asset: {
        uri: "file:///captured/photo.jpg",
        type: "image",
        fileName: expect.stringMatching(/^metoyou-.*\.jpg$/),
        fileSize: null,
        width: 1080,
        height: 1920,
        duration: 0,
      },
      surface: "flicks",
      text: "A nice photo",
    }));
    expect(mocks.onPublished).toHaveBeenCalledOnce();
    expect(mocks.alert).toHaveBeenCalledWith("Flick shared", "Your Flick is now live.");
    await waitFor(() =>
      expect(screen.queryByRole("textbox", { name: "Add a caption" })).toBeNull(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Share a Flick" }));
    await screen.findByRole("button", { name: "Camera ready" });
    fireEvent.click(screen.getByRole("button", { name: "Camera ready" }));
    fireEvent.click(screen.getByRole("button", { name: "Take photo" }));
    expect((await screen.findByRole("textbox", { name: "Add a caption" }) as HTMLInputElement).value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Back to camera" }));
    fireEvent.click(screen.getByRole("button", { name: "Close camera" }));
    expect(screen.queryByRole("button", { name: "Camera ready" })).toBeNull();
  });

  it("uses photo-only, newest-first 80-item pages and resolves the local asset URI", async () => {
    mocks.getAssets
      .mockResolvedValueOnce({
        assets: [photo("newest", "newest.jpg"), photo("older", "older.jpg")],
        endCursor: "cursor-1",
        hasNextPage: true,
      })
      .mockResolvedValueOnce({
        assets: [photo("oldest", "oldest.jpg")],
        endCursor: "cursor-2",
        hasNextPage: false,
      });
    mocks.getAssetInfo.mockResolvedValue({
      localUri: "file:///local/newest.jpg",
      uri: "ph://newest",
    });
    render(<NativeFlicksShareButton onPublished={mocks.onPublished} />);

    await openGallery();
    await screen.findByRole("button", { name: "Select photo newest.jpg" });
    expect(mocks.requestMediaPermission).toHaveBeenCalledWith(false, ["photo"]);
    expect(mocks.getAssets).toHaveBeenNthCalledWith(1, {
      after: undefined,
      first: 80,
      mediaType: ["photo"],
      sortBy: [["creationTime", false]],
    });

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await screen.findByRole("button", { name: "Select photo oldest.jpg" });
    expect(mocks.getAssets).toHaveBeenNthCalledWith(2, {
      after: "cursor-1",
      first: 80,
      mediaType: ["photo"],
      sortBy: [["creationTime", false]],
    });
    const names = screen.getAllByRole("button")
      .map((button) => button.getAttribute("aria-label"))
      .filter((name) => name?.startsWith("Select photo "));
    expect(names).toEqual([
      "Select photo newest.jpg",
      "Select photo older.jpg",
      "Select photo oldest.jpg",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Select photo newest.jpg" }));
    await screen.findByRole("textbox", { name: "Add a caption" });
    expect(mocks.getAssetInfo).toHaveBeenCalledWith("newest", {
      shouldDownloadFromNetwork: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "Share Flick" }));
    await waitFor(() => expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({
      asset: expect.objectContaining({ uri: "file:///local/newest.jpg" }),
      surface: "flicks",
    })));
  });

  it("reports denied camera and gallery permissions without proceeding", async () => {
    mocks.requestCameraPermission.mockResolvedValue({ granted: false });
    render(<NativeFlicksShareButton onPublished={mocks.onPublished} />);

    fireEvent.click(screen.getByRole("button", { name: "Share a Flick" }));
    await waitFor(() => expect(mocks.alert).toHaveBeenCalledWith(
      "Camera access needed",
      "Allow camera access to capture media for sharing.",
    ));
    expect(screen.queryByRole("button", { name: "Camera ready" })).toBeNull();

    mocks.requestCameraPermission.mockResolvedValue({ granted: true });
    fireEvent.click(screen.getByRole("button", { name: "Share a Flick" }));
    await screen.findByRole("button", { name: "Camera ready" });
    mocks.requestMediaPermission.mockResolvedValue({ granted: false });
    fireEvent.click(screen.getByRole("button", { name: "Galerie" }));
    await waitFor(() => expect(mocks.alert).toHaveBeenCalledWith(
      "Could not open Galerie",
      "Allow photo-library access to choose media from your Galerie.",
    ));
    expect(mocks.getAssets).not.toHaveBeenCalled();
  });

  it("keeps the editor open and reports a publish failure", async () => {
    mocks.publish.mockRejectedValue(new Error("Upload failed"));
    render(<NativeFlicksShareButton onPublished={mocks.onPublished} />);

    await openGallery();
    fireEvent.click(await screen.findByRole("button", { name: "Select photo newest.jpg" }));
    fireEvent.click(await screen.findByRole("button", { name: "Share Flick" }));

    await waitFor(() => expect(mocks.alert).toHaveBeenCalledWith(
      "Could not share Flick",
      "Upload failed",
    ));
    expect(screen.getByRole("textbox", { name: "Add a caption" })).not.toBeNull();
    expect(mocks.onPublished).not.toHaveBeenCalled();
  });
});
