import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { VideoView, useVideoPlayer } from "expo-video";
import {
  addClipRenderProgressListener,
  cancelClipRender,
  deleteClipRenderOutput,
  renderClip,
  type ClipRenderProgress,
  type ClipRenderResult,
} from "../../src/native/lib/clipRenderer";

const TEXT_COLORS = ["#FFFFFF", "#FFE600", "#FF4D6D", "#00D6A3"];
const BACKGROUND_COLORS = [
  { label: "None", value: undefined },
  { label: "Black", value: "#000000" },
  { label: "Blue", value: "#174EA6" },
];

export default function ClipRendererDevelopmentScreen() {
  if (!__DEV__) return null;
  return <ClipRendererDevelopmentScreenContent />;
}

function ClipRendererDevelopmentScreenContent() {
  const { width: windowWidth } = useWindowDimensions();
  const [sourceUri, setSourceUri] = useState<string | null>(null);
  const [sourceAspectRatio, setSourceAspectRatio] = useState(9 / 16);
  const [trimStart, setTrimStart] = useState("0");
  const [trimEnd, setTrimEnd] = useState("20000");
  const [text, setText] = useState("MeToYou Clip");
  const [textColor, setTextColor] = useState(TEXT_COLORS[0]);
  const [backgroundColor, setBackgroundColor] = useState<string | undefined>();
  const [position, setPosition] = useState({ x: 0.5, y: 0.78 });
  const [progress, setProgress] = useState<number | null>(null);
  const [rendered, setRendered] = useState<ClipRenderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const isRenderingRef = useRef(false);
  const aspectRatio = rendered
    ? rendered.width / rendered.height
    : sourceAspectRatio;
  const previewWidth = Math.min(windowWidth - 32, 520, 420 * aspectRatio);
  const previewHeight = previewWidth / aspectRatio;
  const inputPlayer = useVideoPlayer(null);
  const outputPlayer = useVideoPlayer(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (isRenderingRef.current) {
        cancelClipRender("clip-renderer-poc").catch((cause: unknown) => {
          console.error("Could not cancel clip rendering after leaving the test screen.", cause);
        });
      }
    };
  }, []);

  useEffect(() => {
    if (!sourceUri) return;
    inputPlayer.replaceAsync(sourceUri).catch((cause: unknown) => {
      if (isMountedRef.current) {
        setError(cause instanceof Error ? cause.message : "Could not load the selected video.");
      }
    });
  }, [inputPlayer, sourceUri]);

  useEffect(() => {
    if (!rendered) return;
    outputPlayer.replaceAsync(rendered.uri).catch((cause: unknown) => {
      if (isMountedRef.current) {
        setError(cause instanceof Error ? cause.message : "Could not load the exported video.");
      }
    });
    return () => {
      outputPlayer.pause();
      deleteClipRenderOutput(rendered.uri).catch((cause: unknown) => {
        console.error("Could not remove temporary clip-render output.", cause);
      });
    };
  }, [outputPlayer, rendered]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    try {
      const subscription = addClipRenderProgressListener((event: ClipRenderProgress) => {
        if (event.jobId === "clip-renderer-poc" && isMountedRef.current) {
          setProgress(event.progress);
        }
      });
      return () => subscription.remove();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Native video rendering is unavailable.");
    }
  }, []);

  async function selectVideo() {
    setError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Gallery permission is required to select a video.");
        return;
      }
      const selection = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        selectionLimit: 1,
        quality: 1,
      });
      if (selection.canceled) return;
      const asset = selection.assets[0];
      setSourceUri(asset.uri);
      if (asset.width > 0 && asset.height > 0) {
        setSourceAspectRatio(asset.width / asset.height);
      }
      setRendered(null);
      setTrimStart("0");
      const duration = asset.duration && asset.duration > 0 ? asset.duration : 20_000;
      setTrimEnd(String(Math.min(duration, 20_000)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open the video gallery.");
    }
  }

  async function startRender() {
    const startMs = Number(trimStart);
    const endMs = Number(trimEnd);
    if (!sourceUri) {
      setError("Select a video before rendering.");
      return;
    }
    if (
      !Number.isInteger(startMs) ||
      !Number.isInteger(endMs) ||
      startMs < 0 ||
      endMs <= startMs ||
      endMs - startMs > 20_000
    ) {
      setError("Enter valid trim points with a duration of 1–20,000 milliseconds.");
      return;
    }

    setError(null);
    setRendered(null);
    isRenderingRef.current = true;
    setProgress(0);
    try {
      const result = await renderClip({
        jobId: "clip-renderer-poc",
        sourceUri,
        sourceType: "video",
        trimStartMs: startMs,
        trimEndMs: endMs,
        text,
        textColor,
        backgroundColor,
        x: position.x,
        y: position.y,
      });
      if (isMountedRef.current) setRendered(result);
    } catch (cause) {
      if (isMountedRef.current) {
        setError(cause instanceof Error ? cause.message : "Video rendering failed.");
      }
    } finally {
      isRenderingRef.current = false;
      if (isMountedRef.current) setProgress(null);
    }
  }

  async function cancelRender() {
    try {
      await cancelClipRender("clip-renderer-poc");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not cancel video rendering.");
    }
  }

  function moveText(dx: number, dy: number) {
    setPosition((current) => ({
      x: Math.max(0.08, Math.min(0.92, current.x + dx)),
      y: Math.max(0.08, Math.min(0.92, current.y + dy)),
    }));
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Clip Renderer POC (Android)</Text>
      <Text style={styles.note}>
        Development-only experiment. Trim positions are in milliseconds; the selected source is never modified.
      </Text>
      {Platform.OS !== "android" ? (
        <Text style={styles.error}>Native video rendering is not implemented on this platform.</Text>
      ) : null}

      <ActionButton label="Select Video" onPress={selectVideo} />
      {sourceUri ? (
        <View style={[styles.previewFrame, { width: previewWidth, height: previewHeight }]}>
          <VideoView
            player={inputPlayer}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            nativeControls
          />
          <View
            pointerEvents="none"
            style={[
              styles.textOverlayPreview,
              {
                width: previewWidth * 0.88,
                left: Math.max(0, Math.min(previewWidth * 0.12, position.x * previewWidth - previewWidth * 0.44)),
                top: Math.max(0, Math.min(previewHeight - 36, position.y * previewHeight - 18)),
                backgroundColor,
              },
            ]}
          >
            <Text style={[styles.overlayPreviewText, { color: textColor }]}>{text}</Text>
          </View>
        </View>
      ) : (
        <Text style={styles.placeholder}>Select a video to preview it here.</Text>
      )}

      <Field label="Trim Start (ms)" value={trimStart} onChangeText={setTrimStart} />
      <Field label="Trim End (ms)" value={trimEnd} onChangeText={setTrimEnd} />
      <Field label="Text Overlay" value={text} onChangeText={setText} />

      <Text style={styles.label}>Text Color</Text>
      <View style={styles.options}>
        {TEXT_COLORS.map((color) => (
          <Pressable
            key={color}
            accessibilityRole="button"
            accessibilityLabel={`Text color ${color}`}
            onPress={() => setTextColor(color)}
            style={[
              styles.colorOption,
              { backgroundColor: color },
              textColor === color && styles.selectedOption,
            ]}
          />
        ))}
      </View>

      <Text style={styles.label}>Text Background</Text>
      <View style={styles.options}>
        {BACKGROUND_COLORS.map((option) => (
          <Pressable
            key={option.label}
            accessibilityRole="button"
            onPress={() => setBackgroundColor(option.value)}
            style={[
              styles.backgroundOption,
              backgroundColor === option.value && styles.selectedOption,
            ]}
          >
            <Text style={styles.buttonText}>{option.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>
        Text Position ({position.x.toFixed(2)}, {position.y.toFixed(2)})
      </Text>
      <View style={styles.positionControls}>
        <ActionButton label="Up" onPress={() => moveText(0, -0.05)} />
        <ActionButton label="Left" onPress={() => moveText(-0.05, 0)} />
        <ActionButton label="Right" onPress={() => moveText(0.05, 0)} />
        <ActionButton label="Down" onPress={() => moveText(0, 0.05)} />
      </View>

      {progress === null ? (
        <ActionButton label="Render Video" onPress={startRender} disabled={!sourceUri} />
      ) : (
        <View style={styles.progressRow}>
          <ActivityIndicator />
          <Text style={styles.progressText}>Rendering: {progress}%</Text>
          <ActionButton label="Cancel" onPress={cancelRender} />
        </View>
      )}

      {rendered ? (
        <>
          <Text style={styles.sectionTitle}>Exported Video Preview</Text>
          <VideoView
            player={outputPlayer}
            style={[styles.video, { width: previewWidth, height: previewHeight }]}
            contentFit="contain"
            nativeControls
          />
          <Text style={styles.sectionTitle}>Output Information</Text>
          <Text style={styles.outputInfo}>
            {`${rendered.format.toUpperCase()} · ${rendered.videoCodec}\n` +
              `${rendered.width} × ${rendered.height} · ${(rendered.durationMs / 1000).toFixed(2)} s\n` +
              `${(rendered.sizeBytes / (1024 * 1024)).toFixed(2)} MiB · ` +
              `Audio: ${rendered.hasAudio ? "preserved" : "none in source"}`}
          </Text>
        </>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        keyboardType={label.includes("(ms)") ? "number-pad" : "default"}
        style={styles.input}
      />
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled && styles.disabledButton]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 12,
    padding: 16,
    paddingBottom: 48,
  },
  title: { color: "#171717", fontSize: 22, fontWeight: "700" },
  note: { color: "#555", textAlign: "center" },
  video: { backgroundColor: "#111", borderRadius: 10 },
  previewFrame: { position: "relative", overflow: "hidden", backgroundColor: "#111", borderRadius: 10 },
  textOverlayPreview: { position: "absolute", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5 },
  overlayPreviewText: { fontWeight: "700", textAlign: "center" },
  placeholder: {
    width: "100%",
    padding: 40,
    backgroundColor: "#eee",
    color: "#555",
    textAlign: "center",
  },
  field: { width: "100%", gap: 6 },
  label: { alignSelf: "flex-start", color: "#333", fontWeight: "600" },
  input: {
    minHeight: 44,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#aaa",
    borderRadius: 6,
    color: "#111",
    backgroundColor: "#fff",
  },
  options: { flexDirection: "row", alignSelf: "stretch", gap: 8 },
  colorOption: { width: 40, height: 36, borderRadius: 6, borderWidth: 1, borderColor: "#555" },
  backgroundOption: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#444", borderRadius: 6 },
  selectedOption: { borderWidth: 3, borderColor: "#2684ff" },
  button: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: "#1d5fc4",
  },
  disabledButton: { backgroundColor: "#999" },
  buttonText: { color: "#fff", fontWeight: "600" },
  positionControls: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  progressRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  progressText: { color: "#333" },
  sectionTitle: { alignSelf: "flex-start", color: "#171717", fontSize: 18, fontWeight: "700" },
  outputInfo: { alignSelf: "stretch", color: "#333", lineHeight: 22 },
  error: { alignSelf: "stretch", color: "#b00020", fontWeight: "600" },
});
