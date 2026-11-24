import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Camera, CameraView } from "expo-camera";
import * as MediaLibrary from "expo-media-library/legacy";
import { Camera as CameraIcon, ImagePlus, Plus } from "lucide-react-native";
import { useNativeAuth } from "../contexts/NativeAuthProvider";
import { NATIVE_THEME_COLORS, useNativeTheme } from "../contexts/NativeThemeProvider";
import { publishNativeSurfacePost, type NativeShareAsset } from "../lib/surfacePosts";

type Page = "camera" | "gallery" | "editor";
type GalleryAsset = MediaLibrary.Asset;

const GALLERY_PAGE_SIZE = 80;

export default function NativeFlicksShareButton({
  onPublished,
}: {
  onPublished: () => void;
}) {
  const { session } = useNativeAuth();
  const { theme } = useNativeTheme();
  const colors = NATIVE_THEME_COLORS[theme];
  const { width, height } = useWindowDimensions();
  const cameraRef = useRef<CameraView>(null);
  const galleryLoadingRef = useRef(false);
  const currentPage = useRef<string | undefined>(undefined);
  const hasNextPage = useRef(true);
  const [visible, setVisible] = useState(false);
  const [page, setPage] = useState<Page>("camera");
  const [cameraReady, setCameraReady] = useState(false);
  const [asset, setAsset] = useState<NativeShareAsset | null>(null);
  const [galleryAssets, setGalleryAssets] = useState<GalleryAsset[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setVisible(false);
    setPage("camera");
    setCameraReady(false);
    setAsset(null);
    setGalleryAssets([]);
    setCaption("");
    setBusy(false);
  };

  const openCamera = async () => {
    try {
      const cameraPermission = await Camera.requestCameraPermissionsAsync();
      if (!cameraPermission.granted) {
        Alert.alert("Camera access needed", "Allow camera access to capture media for sharing.");
        return;
      }
      setPage("camera");
      setVisible(true);
    } catch (cause) {
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
      const permission = await MediaLibrary.requestPermissionsAsync(false, ["photo"]);
      if (!permission.granted) {
        throw new Error("Allow photo-library access to choose media from your Galerie.");
      }
      const result = await MediaLibrary.getAssetsAsync({
        after: append ? currentPage.current : undefined,
        first: GALLERY_PAGE_SIZE,
        mediaType: ["photo"],
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
      Alert.alert("Could not open Galerie", message);
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
      setAsset({
        uri: info.localUri ?? info.uri ?? galleryAsset.uri,
        type: "image",
        fileName: galleryAsset.filename,
        fileSize: null,
        width: galleryAsset.width,
        height: galleryAsset.height,
        duration: galleryAsset.duration,
      });
      setCaption("");
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
      setPage("editor");
    } catch (cause) {
      Alert.alert("Could not take photo", cause instanceof Error ? cause.message : "Please try again.");
    }
  };

  const publish = async () => {
    if (!asset || !session?.user.id || busy) return;
    setBusy(true);
    try {
      await publishNativeSurfacePost({
        authorId: session.user.id,
        asset,
        surface: "flicks",
        text: caption,
      });
      setVisible(false);
      setAsset(null);
      setCaption("");
      onPublished();
      Alert.alert("Flick shared", "Your Flick is now live.");
    } catch (cause) {
      Alert.alert(
        "Could not share Flick",
        cause instanceof Error ? cause.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const overlayFrame = getContainedFrame(width, height, 1080, 1920);

  return (
    <>
      <Pressable
        accessibilityLabel="Share a Flick"
        accessibilityRole="button"
        onPress={() => void openCamera()}
        style={({ pressed }) => [styles.plusButton, pressed && styles.pressed]}
      >
        <Plus color={colors.text} size={24} strokeWidth={2.5} />
      </Pressable>
      <Modal
        animationType="slide"
        onRequestClose={() => {
          if (busy) return;
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
                mode="picture"
                onCameraReady={() => setCameraReady(true)}
                onMountError={(event) => Alert.alert("Camera error", event.message)}
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                videoQuality="720p"
              />
              <View style={styles.cameraTop}>
                <Pressable accessibilityLabel="Close camera" onPress={reset} style={styles.iconButton}>
                  <Text style={styles.backText}>×</Text>
                </Pressable>
                <Text style={styles.cameraTitle}>Take a Flick</Text>
                <View style={styles.iconButton} />
              </View>
              <View style={styles.cameraBottom}>
                <Pressable accessibilityRole="button" onPress={() => void openGallery()} style={styles.galleryButton}>
                  <ImagePlus color="#ffffff" size={20} />
                  <Text style={styles.galleryButtonText}>Galerie</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="Take photo"
                  disabled={!cameraReady}
                  onPress={() => void onCapturePhoto()}
                  style={[styles.captureButton, !cameraReady && styles.disabled]}
                />
                <View style={styles.captureHint}>
                  <Text style={styles.cameraHint}>Take photo</Text>
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
                  <Text style={styles.galleryEmptyText}>No photos found.</Text>
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
                      accessibilityLabel={`Select photo ${item.filename}`}
                      onPress={() => void selectGalleryAsset(item)}
                      style={({ pressed }) => [styles.galleryTile, pressed && styles.pressed]}
                    >
                      <Image resizeMode="cover" source={{ uri: item.uri }} style={StyleSheet.absoluteFill} />
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
          ) : page === "editor" && asset ? (
            <>
              <View style={[styles.preview, { height }]}>
                <View
                  style={[
                    styles.editorCanvas,
                    {
                      left: overlayFrame.x,
                      top: overlayFrame.y,
                      width: overlayFrame.width,
                      height: overlayFrame.height,
                    },
                  ]}
                >
                  <Image resizeMode="contain" source={{ uri: asset.uri }} style={StyleSheet.absoluteFill} />
                </View>
                <View style={styles.editorTop}>
                  <Pressable accessibilityLabel="Back to camera" disabled={busy} onPress={() => {
                    setPage("camera");
                    setAsset(null);
                  }} style={styles.iconButton}>
                    <CameraIcon color="#ffffff" size={21} />
                  </Pressable>
                  <Text style={styles.cameraTitle}>Share your Flick</Text>
                  <Pressable accessibilityLabel="Close editor" disabled={busy} onPress={reset} style={styles.iconButton}>
                    <Text style={styles.backText}>×</Text>
                  </Pressable>
                </View>
                <View style={styles.editorControls}>
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
                      <Text style={styles.galleryButtonText}>Camera</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => void publish()}
                      style={[styles.publishButton, styles.editorActionButton, { backgroundColor: colors.accent }, busy && styles.disabled]}
                    >
                      {busy ? (
                        <ActivityIndicator color={colors.accentText} size="small" />
                      ) : (
                        <Text style={[styles.publishText, { color: colors.accentText }]}>Share Flick</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              </View>
            </>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

function getContainedFrame(
  containerWidth: number,
  containerHeight: number,
  sourceWidth: number,
  sourceHeight: number,
) {
  const width = Math.max(1, containerWidth);
  const height = Math.max(1, containerHeight);
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return { x: 0, y: 0, width, height };
  }
  const sourceRatio = sourceWidth / sourceHeight;
  const containerRatio = width / height;
  if (sourceRatio > containerRatio) {
    const frameHeight = width / sourceRatio;
    return { x: 0, y: (height - frameHeight) / 2, width, height: frameHeight };
  }
  const frameWidth = height * sourceRatio;
  return { x: (width - frameWidth) / 2, y: 0, width: frameWidth, height };
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
    zIndex: 20,
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 54,
  },
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
  captureHint: { minWidth: 95, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  cameraHint: { color: "#ffffff", fontSize: 11, fontWeight: "700", textAlign: "center" },
  galleryLoader: { flex: 1 },
  galleryEmpty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  galleryEmptyText: { color: "#ffffff", fontSize: 15, textAlign: "center" },
  galleryRetry: { marginTop: 15, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18, backgroundColor: "#0284c7" },
  galleryGrid: { paddingHorizontal: 2, paddingBottom: 100 },
  galleryTile: { width: "33.333%", aspectRatio: 1, padding: 1, overflow: "hidden", backgroundColor: "#172033" },
  galleryFooter: { padding: 18 },
  galleryCameraButton: { position: "absolute", right: 20, bottom: 32, minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 20, borderRadius: 26, backgroundColor: "#0284c7", elevation: 8 },
  preview: { width: "100%", justifyContent: "flex-end", overflow: "hidden", backgroundColor: "#020617" },
  editorCanvas: { position: "absolute", overflow: "hidden", backgroundColor: "#000000" },
  editorControls: { position: "absolute", zIndex: 20, left: 0, right: 0, bottom: 0, gap: 11, paddingHorizontal: 15, paddingTop: 22, paddingBottom: 30, backgroundColor: "rgba(2,6,23,0.8)" },
  captionInput: { minHeight: 48, maxHeight: 96, paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", borderRadius: 14, color: "#ffffff", fontSize: 15, backgroundColor: "rgba(255,255,255,0.12)" },
  editorActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 5 },
  editorActionButton: { flex: 1, minWidth: 0, minHeight: 46 },
  publishButton: { minHeight: 46, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, borderRadius: 23 },
  publishText: { fontSize: 13, fontWeight: "900" },
  disabled: { opacity: 0.55 },
});
