import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

export type ClipRenderOptions = {
  jobId: string;
  sourceUri: string;
  sourceType: "image" | "video";
  trimStartMs: number;
  trimEndMs: number;
  text: string;
  textColor: string;
  backgroundColor?: string;
  x: number;
  y: number;
};

export type ClipRenderResult = {
  jobId: string;
  uri: string;
  durationMs: number;
  width: number;
  height: number;
  format: "mp4";
  videoCodec: "H.264";
  hasAudio: boolean;
  sizeBytes: number;
};

export type ClipRenderProgress = {
  jobId: string;
  progress: number;
};

type ClipRendererNative = {
  render(options: ClipRenderOptions): Promise<ClipRenderResult>;
  cancel(jobId: string): Promise<void>;
  deleteOutput(uri: string): Promise<void>;
  addListener(
    eventName: "onExportProgress",
    listener: (event: ClipRenderProgress) => void
  ): NativeSubscription;
};

type NativeSubscription = { remove(): void };

function getNativeRenderer(): ClipRendererNative {
  if (Platform.OS !== "android") {
    throw new Error("Video rendering is currently implemented for Android only.");
  }
  const renderer =
    requireOptionalNativeModule<ClipRendererNative>("MeToYouClipRenderer");
  if (!renderer) {
    throw new Error(
      "The native renderer is unavailable. Rebuild and install the Android development client."
    );
  }
  return renderer;
}

export function renderClip(options: ClipRenderOptions): Promise<ClipRenderResult> {
  return getNativeRenderer().render(options);
}

export function cancelClipRender(jobId: string): Promise<void> {
  return getNativeRenderer().cancel(jobId);
}

export function deleteClipRenderOutput(uri: string): Promise<void> {
  return getNativeRenderer().deleteOutput(uri);
}

export function addClipRenderProgressListener(
  listener: (event: ClipRenderProgress) => void
): NativeSubscription {
  return getNativeRenderer().addListener("onExportProgress", listener);
}
