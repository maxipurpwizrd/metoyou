import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import * as ImagePicker from "expo-image-picker";
import { Plus } from "lucide-react-native";
import { useNativeAuth } from "../contexts/NativeAuthProvider";
import { NATIVE_THEME_COLORS, useNativeTheme } from "../contexts/NativeThemeProvider";
import { getClipVideoValidationError } from "../lib/clipMediaPolicy";
import { discardStagedClipUpload } from "../lib/clipUpload";
import { publishNativeSurfacePost, type NativeShareAsset } from "../lib/surfacePosts";

type Props = {
  onPublished: () => void;
};

function createUploadJobId(): string {
  return `clip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function discardUpload(jobId: string | null) {
  if (!jobId) return;
  void discardStagedClipUpload(jobId).catch((cause: unknown) => {
    console.warn("Could not remove the canceled Clip upload staging files.", cause);
  });
}

export default function NativeClipShareButton({ onPublished }: Props) {
  const { session } = useNativeAuth();
  const { theme } = useNativeTheme();
  const colors = NATIVE_THEME_COLORS[theme];
  const player = useVideoPlayer(null, (videoPlayer) => {
    videoPlayer.loop = false;
  });
  const [asset, setAsset] = useState<NativeShareAsset | null>(null);
  const [caption, setCaption] = useState("");
  const [uploadJobId, setUploadJobId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const pickerBusyRef = useRef(false);
  const publishBusyRef = useRef(false);
  const selectedAssetRef = useRef<NativeShareAsset | null>(null);

  const updateSelectedAsset = useCallback((next: NativeShareAsset) => {
    selectedAssetRef.current = next;
    setAsset(next);
  }, []);

  useEffect(() => {
    const updateDuration = () => {
      const selected = selectedAssetRef.current;
      const measuredDuration = Math.round(player.duration * 1_000);
      if (
        !selected ||
        selected.duration > 0 ||
        !Number.isFinite(measuredDuration) ||
        measuredDuration <= 0
      ) {
        return;
      }
      updateSelectedAsset({ ...selected, duration: measuredDuration });
    };
    const sourceSubscription = player.addListener("sourceLoad", updateDuration);
    const statusSubscription = player.addListener("statusChange", ({ status, error: playbackError }) => {
      if (status === "readyToPlay") {
        updateDuration();
        setPlayerError(null);
      } else if (status === "error") {
        setPlayerError(playbackError?.message ?? "This video cannot be previewed on this device.");
      }
    });
    return () => {
      sourceSubscription.remove();
      statusSubscription.remove();
    };
  }, [player, updateSelectedAsset]);

  const chooseVideo = useCallback(async () => {
    if (pickerBusyRef.current || publishBusyRef.current) return;
    pickerBusyRef.current = true;
    setError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Video access needed",
          "Allow photo and video access to choose a Clip from your device.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        allowsEditing: false,
        allowsMultipleSelection: false,
        selectionLimit: 1,
      });
      if (result.canceled) return;

      const selected = result.assets[0];
      if (!selected?.uri) {
        Alert.alert("Could not choose video", "The selected video could not be opened. Please try another.");
        return;
      }
      const nextAsset: NativeShareAsset = {
        uri: selected.uri,
        type: "video",
        fileName: selected.fileName?.trim() || null,
        fileSize: selected.fileSize ?? null,
        width: selected.width,
        height: selected.height,
        duration: selected.duration ?? 0,
        mimeType: selected.mimeType ?? null,
      };
      discardUpload(uploadJobId);
      updateSelectedAsset(nextAsset);
      setCaption("");
      setUploadJobId(createUploadJobId());
      setUploadProgress(null);
      setPlayerError(null);
      player.pause();
      player.replace(selected.uri);
      setVisible(true);
    } catch (cause) {
      Alert.alert(
        "Could not choose video",
        cause instanceof Error ? cause.message : "Please check media-library access and try again.",
      );
    } finally {
      pickerBusyRef.current = false;
    }
  }, [player, updateSelectedAsset, uploadJobId]);

  const closeComposer = useCallback(() => {
    if (publishBusyRef.current) return;
    player.pause();
    discardUpload(uploadJobId);
    setVisible(false);
    setAsset(null);
    selectedAssetRef.current = null;
    setCaption("");
    setUploadJobId(null);
    setError(null);
    setPlayerError(null);
    setUploadProgress(null);
  }, [player, uploadJobId]);

  const validationError = asset
    ? getClipVideoValidationError({
        type: asset.type,
        durationMs: asset.duration,
        fileSize: asset.fileSize,
      })
    : null;

  const publish = useCallback(async () => {
    const selected = selectedAssetRef.current;
    const authorId = session?.user.id;
    if (publishBusyRef.current) return;
    if (!selected || !authorId || !uploadJobId) {
      setError("Choose a video and sign in before posting a Clip.");
      return;
    }
    const invalidMedia = getClipVideoValidationError({
      type: selected.type,
      durationMs: selected.duration,
      fileSize: selected.fileSize,
    });
    if (invalidMedia) {
      setError(invalidMedia);
      return;
    }
    if (playerError) {
      setError("This video cannot be previewed on this device. Choose another video.");
      return;
    }

    publishBusyRef.current = true;
    setBusy(true);
    setError(null);
    setUploadProgress(0);
    try {
      await publishNativeSurfacePost({
        authorId,
        asset: selected,
        surface: "clips",
        text: caption,
        clipUploadJobId: uploadJobId,
        onUploadProgress: (bytesSent, bytesTotal) => {
          if (bytesTotal > 0) {
            setUploadProgress(Math.min(100, Math.floor((bytesSent / bytesTotal) * 100)));
          }
        },
      });
      player.pause();
      setVisible(false);
      setAsset(null);
      selectedAssetRef.current = null;
      setCaption("");
      setUploadJobId(null);
      setUploadProgress(null);
      onPublished();
      Alert.alert("Clip posted", "Your Clip is now live.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The Clip could not be posted. Try again.");
    } finally {
      publishBusyRef.current = false;
      setBusy(false);
    }
  }, [caption, onPublished, player, playerError, session?.user.id, uploadJobId]);

  const canPost = !!asset && !validationError && !playerError && !!session?.user.id && !busy;

  return (
    <>
      <Pressable
        accessibilityLabel="Create a Clip"
        accessibilityRole="button"
        disabled={pickerBusyRef.current || busy}
        onPress={() => void chooseVideo()}
        style={({ pressed }) => [styles.plusButton, pressed && styles.pressed]}
      >
        <Plus color={colors.text} size={24} strokeWidth={2.5} />
      </Pressable>

      <Modal
        animationType="slide"
        onRequestClose={closeComposer}
        presentationStyle="fullScreen"
        statusBarTranslucent
        visible={visible}
      >
        <View style={styles.root}>
          <View style={styles.header}>
            <Pressable
              accessibilityLabel="Cancel Clip"
              accessibilityRole="button"
              disabled={busy}
              onPress={closeComposer}
              style={styles.closeButton}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
            <View style={styles.headerTitle}>
              <Text style={styles.kicker}>METOYOU · CLIPS</Text>
              <Text style={styles.title}>New Clip</Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.content}>
            <View style={styles.previewFrame}>
              {asset ? (
                <VideoView
                  contentFit="contain"
                  nativeControls
                  player={player}
                  style={StyleSheet.absoluteFill}
                  surfaceType="textureView"
                />
              ) : null}
            </View>

            <Text numberOfLines={1} style={styles.fileName}>
              {asset?.fileName || "Selected video"}
            </Text>
            {asset ? (
              <Text style={styles.mediaInfo}>
                {asset.width > 0 && asset.height > 0 ? `${asset.width} × ${asset.height}` : "Video"}
                {asset.duration > 0 ? `  ·  ${(asset.duration / 1_000).toFixed(1)} sec` : "  ·  Reading duration…"}
                {asset.fileSize !== null ? `  ·  ${(asset.fileSize / (1024 * 1024)).toFixed(1)} MiB` : ""}
              </Text>
            ) : null}
            {validationError ? <Text style={styles.errorText}>{validationError}</Text> : null}
            {playerError ? <Text style={styles.errorText}>{playerError}</Text> : null}

            <Text style={styles.captionLabel}>CAPTION <Text style={styles.optionalLabel}>· OPTIONAL</Text></Text>
            <TextInput
              accessibilityLabel="Add a caption"
              editable={!busy}
              maxLength={500}
              multiline
              onChangeText={setCaption}
              placeholder="Say something about this Clip…"
              placeholderTextColor="#91a0b4"
              style={styles.captionInput}
              textAlignVertical="top"
              value={caption}
            />
            {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
            {busy && uploadProgress !== null ? (
              <View accessibilityLiveRegion="polite" style={styles.progressRow}>
                <ActivityIndicator color="#dce9f8" size="small" />
                <Text style={styles.progressText}>Uploading your Clip… {uploadProgress}%</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              disabled={!canPost}
              onPress={() => void publish()}
              style={[styles.postButton, { backgroundColor: colors.accent }, !canPost && styles.disabled]}
            >
              {busy ? (
                <ActivityIndicator color={colors.accentText} size="small" />
              ) : (
                <Text style={[styles.postText, { color: colors.accentText }]}>Post Clip</Text>
              )}
            </Pressable>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => void chooseVideo()} style={styles.replaceButton}>
              <Text style={styles.replaceText}>Choose another video</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  plusButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    borderRadius: 15,
    backgroundColor: "rgba(15,23,42,0.42)",
  },
  pressed: { opacity: 0.75 },
  root: { flex: 1, backgroundColor: "#070b12" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 15,
  },
  closeButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  closeText: { color: "#ffffff", fontSize: 28, fontWeight: "500", lineHeight: 31 },
  headerTitle: { alignItems: "center" },
  kicker: { color: "#96a6bc", fontSize: 9, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 3, color: "#ffffff", fontSize: 19, fontWeight: "900" },
  headerSpacer: { width: 42 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 6 },
  previewFrame: {
    width: "100%",
    maxHeight: "66%",
    aspectRatio: 9 / 16,
    alignSelf: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 20,
    backgroundColor: "#000000",
  },
  fileName: { marginTop: 14, color: "#f4f7fb", fontSize: 14, fontWeight: "800" },
  mediaInfo: { marginTop: 5, color: "#9ba9bc", fontSize: 11 },
  captionLabel: { marginTop: 20, marginBottom: 8, color: "#dce5f1", fontSize: 10, fontWeight: "900", letterSpacing: 1.3 },
  optionalLabel: { color: "#7f8ea3", fontSize: 9, fontWeight: "700" },
  captionInput: {
    minHeight: 82,
    maxHeight: 150,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 14,
    color: "#ffffff",
    fontSize: 14,
    backgroundColor: "#111925",
  },
  errorText: { marginTop: 9, color: "#fda4af", fontSize: 12, lineHeight: 17 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 12 },
  progressText: { color: "#dce5f1", fontSize: 12, fontWeight: "700" },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 },
  postButton: { minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 16 },
  postText: { fontSize: 14, fontWeight: "900" },
  disabled: { opacity: 0.48 },
  replaceButton: { minHeight: 42, alignItems: "center", justifyContent: "center", marginTop: 4 },
  replaceText: { color: "#9fb0c6", fontSize: 12, fontWeight: "700" },
});
