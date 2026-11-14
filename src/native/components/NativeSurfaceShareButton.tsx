import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Camera, CameraView } from "expo-camera";
import * as MediaLibrary from "expo-media-library/legacy";
import { File } from "expo-file-system";
import { VideoView, useVideoPlayer } from "expo-video";
import { Camera as CameraIcon, ImagePlus, Plus, RotateCcw, Video as VideoIcon } from "lucide-react-native";
import { useNativeAuth } from "../contexts/NativeAuthProvider";
import { NATIVE_THEME_COLORS, useNativeTheme } from "../contexts/NativeThemeProvider";
import {
  addClipRenderProgressListener,
  deleteClipRenderOutput,
  renderClip,
  type ClipRenderProgress,
  type ClipRenderResult,
} from "../lib/clipRenderer";
import { publishNativeSurfacePost, type NativeShareAsset } from "../lib/surfacePosts";

type Surface = "clips" | "flicks";
type Page = "camera" | "gallery" | "editor";
type GalleryAsset = MediaLibrary.Asset;

const GALLERY_PAGE_SIZE = 80;
const MAX_CLIP_DURATION_MS = 20_000;

export default function NativeSurfaceShareButton({
  surface,
  onPublished,
  onOpenChange,
}: {
  surface: Surface;
  onPublished: () => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const { session } = useNativeAuth();
  const { theme } = useNativeTheme();
  const colors = NATIVE_THEME_COLORS[theme];
  const { width, height } = useWindowDimensions();
  const isClip = surface === "clips";
  const cameraRef = useRef<CameraView>(null);
  const galleryLoadingRef = useRef(false);
  const currentPage = useRef<string | undefined>(undefined);
  const hasNextPage = useRef(true);
  const recordingDurationRef = useRef(0);
  const recordingActiveRef = useRef(false);
  const textPositionRef = useRef({ x: 0.5, y: 0.76 });
  const textDragOrigin = useRef({ x: 0.5, y: 0.76 });
  const [visible, setVisible] = useState(false);
  const [page, setPage] = useState<Page>("camera");
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [asset, setAsset] = useState<NativeShareAsset | null>(null);
  const [galleryAssets, setGalleryAssets] = useState<GalleryAsset[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [draftText, setDraftText] = useState("");
  const [textEditorVisible, setTextEditorVisible] = useState(false);
  const [textPosition, setTextPosition] = useState({ x: 0.5, y: 0.76 });
  const [busy, setBusy] = useState(false);
  const [renderProgress, setRenderProgress] = useState<number | null>(null);
  const player = useVideoPlayer(null, (videoPlayer) => {
    videoPlayer.loop = true;
  });

  const reset = () => {
    recordingActiveRef.current = false;
    if (recording) cameraRef.current?.stopRecording();
    player.pause();
    setVisible(false);
    setPage("camera");
    setCameraReady(false);
    setRecording(false);
    setAsset(null);
    setGalleryAssets([]);
    setCaption("");
    setDraftText("");
    setTextEditorVisible(false);
    textPositionRef.current = { x: 0.5, y: 0.76 };
    setTextPosition(textPositionRef.current);
    onOpenChange?.(false);
  };

  const openCamera = async () => {
    onOpenChange?.(true);
    try {
      const cameraPermission = await Camera.requestCameraPermissionsAsync();
      if (!cameraPermission.granted) {
        onOpenChange?.(false);
        Alert.alert("Camera access needed", "Allow camera access to capture media for sharing.");
        return;
      }
      if (isClip) {
        const microphonePermission = await Camera.requestMicrophonePermissionsAsync();
        if (!microphonePermission.granted) {
          onOpenChange?.(false);
          Alert.alert("Microphone access needed", "Allow microphone access to record a Clip with sound.");
          return;
        }
      }
      setPage("camera");
      setVisible(true);
    } catch (cause) {
      onOpenChange?.(false);
      Alert.alert(
        "Could not open camera",
        cause instanceof Error ? cause.message : "Please check camera permissions and try again.",
      );
    }
  };

  const openGallery = async (append = false) => {
    if (galleryLoadingRef.current) return;
    galleryLoadingRef.current = true;
    setGalleryLoading(true);
    setGalleryError(null);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(
        false,
        isClip ? ["photo", "video"] : ["photo"],
      );
      if (!permission.granted) {
        throw new Error("Allow photo-library access to choose media from your Galerie.");
      }
      const result = await MediaLibrary.getAssetsAsync({
        after: append ? currentPage.current : undefined,
        first: GALLERY_PAGE_SIZE,
        mediaType: isClip ? ["photo", "video"] : ["photo"],
        sortBy: [["creationTime", false]],
      });
      if (!append) currentPage.current = undefined;
      currentPage.current = result.endCursor;
      hasNextPage.current = result.hasNextPage;
      setGalleryAssets((current) => append ? [...current, ...result.assets] : result.assets);
      setPage("gallery");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not load Galerie.";
      setGalleryError(message);
      if (!append) Alert.alert("Could not open Galerie", message);
    } finally {
      galleryLoadingRef.current = false;
      setGalleryLoading(false);
    }
  };

  const selectGalleryAsset = async (galleryAsset: GalleryAsset) => {
    try {
      const info = await MediaLibrary.getAssetInfoAsync(galleryAsset.id, {
        shouldDownloadFromNetwork: true,
      });
      const uri = info.localUri ?? info.uri ?? galleryAsset.uri;
      const selected: NativeShareAsset = {
        uri,
        type: galleryAsset.mediaType === "video" ? "video" : "image",
        fileName: galleryAsset.filename,
        fileSize: null,
        width: galleryAsset.width,
        height: galleryAsset.height,
        duration: galleryAsset.duration,
      };
      setAsset(selected);
      setCaption("");
      setTextEditorVisible(false);
      setPage("editor");
    } catch (cause) {
      Alert.alert(
        "Could not load media",
        cause instanceof Error ? cause.message : "Please choose another file.",
      );
    }
  };

  const onCapturePhoto = async () => {
    if (!cameraReady || !cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (!photo?.uri) throw new Error("The camera did not return a photo.");
      setAsset({
        uri: photo.uri,
        type: "image",
        fileName: `metoyou-${Date.now()}.jpg`,
        fileSize: null,
        width: photo.width,
        height: photo.height,
        duration: 0,
      });
      setCaption("");
      setTextEditorVisible(false);
      setPage("editor");
    } catch (cause) {
      Alert.alert("Could not take photo", cause instanceof Error ? cause.message : "Please try again.");
    }
  };

  const onStartRecording = () => {
    if (!cameraReady || !cameraRef.current || recording) return;
    recordingDurationRef.current = 0;
    recordingActiveRef.current = true;
    setRecording(true);
    void cameraRef.current.recordAsync({ maxDuration: MAX_CLIP_DURATION_MS / 1000 })
      .then((result) => {
        if (!result?.uri || !recordingActiveRef.current) return;
        recordingActiveRef.current = false;
        void (async () => {
          const file = new File(result.uri);
          setAsset({
            uri: result.uri,
            type: "video",
            fileName: `metoyou-${Date.now()}.mp4`,
            fileSize: file.size,
            width: 0,
            height: 0,
            duration: recordingDurationRef.current || MAX_CLIP_DURATION_MS / 1000,
          });
          setCaption("");
          setTextEditorVisible(false);
          setRecording(false);
          setPage("editor");
        })();
      })
      .catch((cause: unknown) => {
        recordingActiveRef.current = false;
        setRecording(false);
        Alert.alert("Could not record video", cause instanceof Error ? cause.message : "Please try again.");
      });
  };

  const onStopRecording = () => {
    if (recording) cameraRef.current?.stopRecording();
  };

  const publish = async () => {
    if (!asset || !session?.user.id || busy) return;
    setBusy(true);
    let output: ClipRenderResult | null = null;
    let renderSubscription: { remove(): void } | null = null;
    try {
      if (isClip && (
        asset.type === "image" ||
        caption.trim() ||
        asset.duration > MAX_CLIP_DURATION_MS / 1000
      )) {
        const durationMs = asset.type === "image"
          ? 5_000
          : Math.min(Math.round(asset.duration * 1000) || MAX_CLIP_DURATION_MS, MAX_CLIP_DURATION_MS);
        const jobId = `surface-share-${Date.now()}`;
        renderSubscription = addClipRenderProgressListener((event: ClipRenderProgress) => {
          if (event.jobId === jobId) setRenderProgress(event.progress);
        });
        setRenderProgress(0);
        output = await renderClip({
          jobId,
          sourceUri: asset.uri,
          sourceType: asset.type,
          trimStartMs: 0,
          trimEndMs: durationMs,
          text: caption,
          textColor: "#FFFFFF",
          backgroundColor: "#66000000",
          x: textPosition.x,
          y: textPosition.y,
        });
      }
      await publishNativeSurfacePost({
        authorId: session.user.id,
        asset,
        surface,
        text: caption,
        renderedUri: output?.uri,
      });
      setVisible(false);
      setAsset(null);
      setCaption("");
      setTextEditorVisible(false);
      onOpenChange?.(false);
      onPublished();
      Alert.alert(isClip ? "Clip shared" : "Flick shared", `Your ${isClip ? "Clip" : "Flick"} is now live.`);
    } catch (cause) {
      Alert.alert(
        `Could not share ${isClip ? "Clip" : "Flick"}`,
        cause instanceof Error ? cause.message : "Please try again.",
      );
    } finally {
      renderSubscription?.remove();
      setRenderProgress(null);
      setBusy(false);
      if (output) {
        await deleteClipRenderOutput(output.uri).catch((cause: unknown) => {
          console.warn("Could not remove the temporary rendered Clip.", cause);
        });
      }
    }
  };

  useEffect(() => {
    player.pause();
    if (page !== "editor" || asset?.type !== "video") return;
    let active = true;
    void player.replaceAsync(asset.uri)
      .then(() => {
        if (active) player.play();
      })
      .catch((cause: unknown) => {
        if (active) {
          Alert.alert(
            "Could not preview video",
            cause instanceof Error ? cause.message : "The selected video could not be opened.",
          );
        }
      });
    return () => {
      active = false;
      player.pause();
    };
  }, [asset, page, player]);

  const textPanResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        textDragOrigin.current = textPositionRef.current;
      },
      onPanResponderMove: (_, gesture) => {
        const nextPosition = {
          x: Math.max(0.05, Math.min(0.95, textDragOrigin.current.x + gesture.dx / width)),
          y: Math.max(0.05, Math.min(0.95, textDragOrigin.current.y + gesture.dy / height)),
        };
        textPositionRef.current = nextPosition;
        setTextPosition(nextPosition);
      },
    }),
    [height, width],
  );

  const editorTitle = isClip ? "Create your Clip" : "Share your Flick";
  const previewHeight = height;

  return (
    <>
      <Pressable
        accessibilityLabel={`Share a ${isClip ? "Clip" : "Flick"}`}
        accessibilityRole="button"
        onPress={() => void openCamera()}
        style={({ pressed }) => [styles.plusButton, pressed && styles.pressed]}
      >
        <Plus color={colors.text} size={24} strokeWidth={2.5} />
      </Pressable>
      <Modal
        animationType="slide"
        onRequestClose={() => {
          if (page === "editor") {
            setPage("camera");
            setAsset(null);
            return;
          }
          reset();
        }}
        presentationStyle="fullScreen"
        statusBarTranslucent
        visible={visible}
      >
        <View style={[styles.root, { backgroundColor: "#020617" }]}>
          {page === "camera" ? (
            <>
              <CameraView
                active={visible}
                facing="back"
                mode={isClip ? "video" : "picture"}
                onCameraReady={() => setCameraReady(true)}
                onMountError={(event) => Alert.alert("Camera error", event.message)}
                onRecordingProgress={(event) => {
                  recordingDurationRef.current = event.duration;
                }}
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                videoQuality="720p"
              />
              <View style={styles.cameraTop}>
                <Pressable accessibilityLabel="Close camera" onPress={reset} style={styles.iconButton}>
                  <Text style={styles.backText}>×</Text>
                </Pressable>
                <Text style={styles.cameraTitle}>{isClip ? "Create a Clip" : "Take a Flick"}</Text>
                <View style={styles.iconButton} />
              </View>
              <View style={styles.cameraBottom}>
                <Pressable accessibilityRole="button" onPress={() => void openGallery()} style={styles.galleryButton}>
                  <ImagePlus color="#ffffff" size={20} />
                  <Text style={styles.galleryButtonText}>Galerie</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={isClip ? (recording ? "Stop recording" : "Start recording") : "Take photo"}
                  disabled={!cameraReady}
                  onPress={isClip ? (recording ? onStopRecording : onStartRecording) : () => void onCapturePhoto()}
                  style={[styles.captureButton, recording && styles.recordingButton, !cameraReady && styles.disabled]}
                >
                  {recording ? <View style={styles.stopIcon} /> : null}
                </Pressable>
                <View style={styles.captureHint}>
                  {recording ? <View style={styles.recordingIndicator} /> : null}
                  <Text style={styles.cameraHint}>{recording ? "Recording · tap to stop" : isClip ? "Tap to record" : "Take photo"}</Text>
                </View>
              </View>
            </>
          ) : page === "gallery" ? (
            <>
              <View style={styles.galleryHeader}>
                <Pressable accessibilityLabel="Back to camera" onPress={() => setPage("camera")} style={styles.iconButton}>
                  <CameraIcon color="#ffffff" size={22} />
                </Pressable>
                <Text style={styles.cameraTitle}>Galerie</Text>
                <Pressable accessibilityLabel="Close Galerie" onPress={reset} style={styles.iconButton}>
                  <Text style={styles.backText}>×</Text>
                </Pressable>
              </View>
              {galleryLoading && galleryAssets.length === 0 ? (
                <ActivityIndicator color="#ffffff" size="large" style={styles.galleryLoader} />
              ) : galleryError && galleryAssets.length === 0 ? (
                <View style={styles.galleryEmpty}>
                  <Text style={styles.galleryEmptyText}>{galleryError}</Text>
                  <Pressable onPress={() => void openGallery()} style={styles.galleryRetry}>
                    <Text style={styles.galleryButtonText}>Try again</Text>
                  </Pressable>
                </View>
              ) : galleryAssets.length === 0 ? (
                <View style={styles.galleryEmpty}>
                  <Text style={styles.galleryEmptyText}>No {isClip ? "photos or videos" : "photos"} found.</Text>
                </View>
              ) : (
                <FlatList
                  contentContainerStyle={styles.galleryGrid}
                  data={galleryAssets}
                  keyExtractor={(item) => item.id}
                  numColumns={3}
                  onEndReached={() => {
                    if (hasNextPage.current && !galleryLoadingRef.current) void openGallery(true);
                  }}
                  onEndReachedThreshold={0.6}
                  renderItem={({ item }) => (
                    <Pressable
                      accessibilityLabel={`Select ${item.mediaType === "video" ? "video" : "photo"} ${item.filename}`}
                      onPress={() => void selectGalleryAsset(item)}
                      style={({ pressed }) => [styles.galleryTile, pressed && styles.pressed]}
                    >
                      {item.mediaType === "photo" ? (
                        <Image resizeMode="cover" source={{ uri: item.uri }} style={StyleSheet.absoluteFill} />
                      ) : (
                        <View style={styles.videoTile}>
                          <VideoIcon color="#ffffff" size={29} />
                        </View>
                      )}
                      {item.mediaType === "video" ? <Text style={styles.videoDuration}>{formatDuration(item.duration)}</Text> : null}
                    </Pressable>
                  )}
                  ListFooterComponent={galleryLoading ? <ActivityIndicator color="#ffffff" style={styles.galleryFooter} /> : undefined}
                  showsVerticalScrollIndicator={false}
                />
              )}
              <Pressable accessibilityRole="button" onPress={() => setPage("camera")} style={styles.galleryCameraButton}>
                <CameraIcon color="#ffffff" size={20} />
                <Text style={styles.galleryButtonText}>Camera</Text>
              </Pressable>
            </>
          ) : asset ? (
            <>
              <View style={[styles.preview, { height: previewHeight }]}>
                {asset.type === "video" ? (
                  <VideoView contentFit="contain" nativeControls={false} player={player} style={StyleSheet.absoluteFill} />
                ) : (
                  <Image resizeMode="contain" source={{ uri: asset.uri }} style={StyleSheet.absoluteFill} />
                )}
                <View style={styles.editorTop}>
                  <Pressable accessibilityLabel="Back to camera" onPress={() => {
                    setPage("camera");
                    setAsset(null);
                  }} style={styles.iconButton}>
                    <CameraIcon color="#ffffff" size={21} />
                  </Pressable>
                  <Text style={styles.cameraTitle}>{editorTitle}</Text>
                  <View style={styles.editorTopActions}>
                    {isClip ? (
                      <Pressable
                        accessibilityLabel={caption ? "Edit Clip text" : "Add Clip text"}
                        onPress={() => {
                          setDraftText(caption);
                          setTextEditorVisible(true);
                        }}
                        style={styles.textToolButton}
                      >
                        <Text style={styles.textToolLabel}>Aa</Text>
                      </Pressable>
                    ) : null}
                    <Pressable accessibilityLabel="Close editor" onPress={reset} style={styles.iconButton}>
                      <Text style={styles.backText}>×</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.editorControls}>
                  {!isClip ? (
                    <TextInput
                      accessibilityLabel="Add a caption"
                      editable={!busy}
                      maxLength={120}
                      multiline
                      onChangeText={setCaption}
                      placeholder="Add a caption"
                      placeholderTextColor="rgba(255,255,255,0.65)"
                      style={styles.captionInput}
                      value={caption}
                    />
                  ) : null}
                  <View style={styles.editorActions}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => void openGallery()}
                      style={[styles.galleryButton, styles.editorActionButton]}
                    >
                      <ImagePlus color="#ffffff" size={19} />
                      <Text style={styles.galleryButtonText}>Galerie</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => setPage("camera")}
                      style={[styles.galleryButton, styles.editorActionButton]}
                    >
                      <RotateCcw color="#ffffff" size={19} />
                      <Text style={styles.galleryButtonText}>Camera</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => void publish()}
                      style={[styles.publishButton, styles.editorActionButton, { backgroundColor: colors.accent }, busy && styles.disabled]}
                    >
                      {busy ? (
                        <View style={styles.progressRow}>
                          <ActivityIndicator color={colors.accentText} size="small" />
                          {renderProgress !== null ? <Text style={[styles.progressText, { color: colors.accentText }]}>{renderProgress}%</Text> : null}
                        </View>
                      ) : (
                        <Text style={[styles.publishText, { color: colors.accentText }]}>Share {isClip ? "Clip" : "Flick"}</Text>
                      )}
                    </Pressable>
                  </View>
                  {isClip && asset.type === "video" && asset.duration > MAX_CLIP_DURATION_MS / 1000 ? (
                    <Text style={styles.durationNote}>Clips are limited to 20 seconds.</Text>
                  ) : null}
                </View>
              </View>
              {textEditorVisible ? (
                <View style={styles.textEditorOverlay}>
                  <Text style={styles.textEditorTitle}>Add text to your Clip</Text>
                  <TextInput
                    accessibilityLabel="Text to burn into Clip"
                    autoFocus
                    maxLength={120}
                    multiline
                    onChangeText={setDraftText}
                    placeholder="Type your text"
                    placeholderTextColor="rgba(255,255,255,0.55)"
                    style={styles.captionInput}
                    value={draftText}
                  />
                  <View style={styles.textEditorActions}>
                    <Pressable onPress={() => setTextEditorVisible(false)} style={styles.textEditorButton}>
                      <Text style={styles.galleryButtonText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setCaption(draftText);
                        setTextEditorVisible(false);
                      }}
                      style={[styles.textEditorButton, styles.textEditorSave]}
                    >
                      <Text style={styles.galleryButtonText}>Done</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
              {isClip && caption.trim() ? (
                <View
                  {...textPanResponder.panHandlers}
                  accessibilityHint="Drag to place text anywhere on the Clip."
                  accessibilityRole="adjustable"
                  accessibilityLabel="Move Clip text"
                  style={[
                    styles.textOverlay,
                    {
                      left: Math.max(0, Math.min(width * 0.14, textPosition.x * width - width * 0.43)),
                      top: Math.max(0, textPosition.y * height - 20),
                    },
                  ]}
                >
                  <Text style={styles.overlayText}>{caption}</Text>
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

function formatDuration(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
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
  cameraTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 54,
  },
  galleryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 54,
    paddingBottom: 15,
  },
  editorTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 54,
  },
  editorTopActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  textToolButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.32)", borderRadius: 21, backgroundColor: "rgba(2,6,23,0.52)" },
  textToolLabel: { color: "#ffffff", fontSize: 16, fontWeight: "900" },
  cameraTitle: { color: "#ffffff", fontSize: 17, fontWeight: "900", textShadowColor: "#000000", textShadowRadius: 8 },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.32)",
    borderRadius: 21,
    backgroundColor: "rgba(2,6,23,0.52)",
  },
  backText: { color: "#ffffff", fontSize: 28, fontWeight: "500", lineHeight: 31 },
  cameraBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 184,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 20,
    paddingBottom: 35,
    backgroundColor: "rgba(2,6,23,0.42)",
  },
  galleryButton: { minWidth: 88, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.5)", borderRadius: 24, backgroundColor: "rgba(2,6,23,0.48)" },
  galleryButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "800" },
  captureButton: { width: 76, height: 76, alignItems: "center", justifyContent: "center", borderWidth: 6, borderColor: "#ffffff", borderRadius: 38, backgroundColor: "#ef4444" },
  recordingButton: { borderColor: "#fecaca", backgroundColor: "#dc2626" },
  stopIcon: { width: 25, height: 25, borderRadius: 5, backgroundColor: "#ffffff" },
  captureHint: { minWidth: 95, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  cameraHint: { color: "#ffffff", fontSize: 11, fontWeight: "700", textAlign: "center" },
  recordingIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ef4444" },
  galleryLoader: { flex: 1 },
  galleryEmpty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  galleryEmptyText: { color: "#ffffff", fontSize: 15, textAlign: "center" },
  galleryRetry: { marginTop: 15, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18, backgroundColor: "#0284c7" },
  galleryGrid: { paddingHorizontal: 2, paddingBottom: 100 },
  galleryTile: { width: "33.333%", aspectRatio: 1, padding: 1, overflow: "hidden", backgroundColor: "#172033" },
  videoTile: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#1e293b" },
  videoDuration: { position: "absolute", right: 6, bottom: 5, color: "#ffffff", fontSize: 11, fontWeight: "800", textShadowColor: "#000000", textShadowRadius: 4 },
  galleryFooter: { padding: 18 },
  galleryCameraButton: { position: "absolute", right: 20, bottom: 32, minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 20, borderRadius: 26, backgroundColor: "#0284c7", elevation: 8 },
  preview: { width: "100%", justifyContent: "flex-end", overflow: "hidden", backgroundColor: "#020617" },
  textOverlay: { position: "absolute", zIndex: 10, width: "86%", alignItems: "center" },
  overlayText: { color: "#ffffff", fontSize: 28, fontWeight: "900", textAlign: "center", textShadowColor: "rgba(0,0,0,0.9)", textShadowRadius: 8, backgroundColor: "rgba(0,0,0,0.4)", paddingHorizontal: 9, paddingVertical: 4 },
  editorControls: { position: "absolute", left: 0, right: 0, bottom: 0, gap: 11, paddingHorizontal: 15, paddingTop: 22, paddingBottom: 30, backgroundColor: "rgba(2,6,23,0.8)" },
  captionInput: { minHeight: 48, maxHeight: 96, paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", borderRadius: 14, color: "#ffffff", fontSize: 15, backgroundColor: "rgba(255,255,255,0.12)" },
  textEditorOverlay: { position: "absolute", top: "38%", left: 20, right: 20, zIndex: 30, gap: 12, padding: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", borderRadius: 20, backgroundColor: "rgba(2,6,23,0.94)" },
  textEditorTitle: { color: "#ffffff", fontSize: 17, fontWeight: "900" },
  textEditorActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  textEditorButton: { minWidth: 84, minHeight: 40, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)", borderRadius: 20 },
  textEditorSave: { backgroundColor: "#0284c7", borderColor: "#0284c7" },
  editorActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 5 },
  editorActionButton: { flex: 1, minWidth: 0, minHeight: 46 },
  publishButton: { minHeight: 46, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, borderRadius: 23 },
  publishText: { fontSize: 13, fontWeight: "900" },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  progressText: { fontSize: 12, fontWeight: "800" },
  durationNote: { color: "rgba(255,255,255,0.72)", fontSize: 11, textAlign: "center" },
  disabled: { opacity: 0.55 },
});
