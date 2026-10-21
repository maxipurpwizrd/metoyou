import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { LinearGradient } from "expo-linear-gradient";
import NativeBlurBackdrop from "./NativeBlurBackdrop";
import { NATIVE_THEME_COLORS, useNativeTheme } from "../contexts/NativeThemeProvider";

export type NativeSelectedImage = {
  uri: string;
  base64: string;
  originalBase64: string;
  originalMimeType: string;
};

export default function NativeCreatePost({
  authorName,
  isVibesPro = false,
  onPublish,
}: {
  authorName: string;
  isVibesPro?: boolean;
  onPublish: (text: string, image?: NativeSelectedImage) => Promise<void>;
}) {
  const { theme } = useNativeTheme();
  const isBlueSky = theme === "bluesky";
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [image, setImage] = useState<NativeSelectedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chooseImage = async () => {
    setError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Allow photo-library access to attach an image.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        base64: true,
        quality: 1,
        exif: false,
        selectionLimit: 1,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset) {
        setError("The selected image could not be read. Please choose another image.");
        return;
      }
      if (asset.fileSize !== undefined && asset.fileSize > 5 * 1024 * 1024) {
        setError("Image must be less than 5MB.");
        return;
      }
      let optimized: Awaited<ReturnType<typeof manipulateAsync>> | undefined;
      const initialWidth = Math.min(asset.width, 1080);
      for (let sizePass = 0; sizePass < 6; sizePass += 1) {
        const targetWidth = Math.max(320, Math.round(initialWidth * 0.85 ** sizePass));
        for (const compress of [0.8, 0.75, 0.7, 0.65, 0.6]) {
          const candidate = await manipulateAsync(
            asset.uri,
            [{ resize: { width: targetWidth } }],
            { base64: true, compress, format: SaveFormat.JPEG },
          );
          if (!candidate.base64) continue;
          optimized = candidate;
          if (Math.ceil(candidate.base64.length * 0.75) <= 300 * 1024) break;
        }
        if (optimized?.base64 && Math.ceil(optimized.base64.length * 0.75) <= 300 * 1024) break;
      }
      if (!optimized?.base64 || Math.ceil(optimized.base64.length * 0.75) > 300 * 1024) {
        setError("This image could not be compressed below 300KB. Please choose another image.");
        return;
      }
      setImage({
        uri: optimized.uri,
        base64: optimized.base64,
        originalBase64: asset.base64 ?? optimized.base64,
        originalMimeType: asset.mimeType ?? "image/jpeg",
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to open your photo library.");
    }
  };

  const publish = async () => {
    if ((!text.trim() && !image) || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onPublish(text, image ?? undefined);
      setText("");
      setImage(null);
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to publish this post. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setError(null);
          setOpen(true);
        }}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        <LinearGradient
          colors={isBlueSky ? NATIVE_THEME_COLORS.bluesky.background : isVibesPro ? ["#181818", "#101010"] : ["#ffffff", "#effaff"]}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={[styles.collapsed, isVibesPro && styles.vibesProCollapsed, isBlueSky && styles.blueSkyCollapsed]}
        >
          <View style={[styles.avatar, isVibesPro && styles.vibesProAvatar, isBlueSky && styles.blueSkyAvatar]}>
            <Text style={styles.avatarText}>{authorName.slice(0, 1).toUpperCase()}</Text>
          </View>
          <Text style={[styles.placeholder, isVibesPro && styles.vibesProPlaceholder, isBlueSky && styles.blueSkyPlaceholder]}>
            Drop your vibe 💬
          </Text>
        </LinearGradient>
      </Pressable>

      <Modal
        animationType="fade"
        onRequestClose={() => {
          if (!busy) setOpen(false);
        }}
        transparent
        visible={open}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalRoot}
        >
          <NativeBlurBackdrop intensity={52} overlayColor="rgba(0,0,0,0.4)" />
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => setOpen(false)}
            style={styles.backdrop}
          />
          <LinearGradient
            colors={isBlueSky ? NATIVE_THEME_COLORS.bluesky.background : isVibesPro ? ["#181818", "#101010"] : ["#f0f9ff", "#ffffff"]}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={[styles.composer, isVibesPro && styles.vibesProComposer, isBlueSky && styles.blueSkyComposer]}
          >
            <View style={styles.titleRow}>
              <Text style={[styles.title, (isVibesPro || isBlueSky) && styles.vibesProText]}>Create Post</Text>
              <Pressable
                accessibilityLabel="Close composer"
                accessibilityRole="button"
                disabled={busy}
                onPress={() => setOpen(false)}
                style={styles.closeButton}
              >
                <Text style={[styles.closeText, (isVibesPro || isBlueSky) && styles.vibesProMutedText]}>×</Text>
              </Pressable>
            </View>

            <View style={styles.authorRow}>
              <View style={[styles.avatar, isVibesPro && styles.vibesProAvatar, isBlueSky && styles.blueSkyAvatar]}>
                <Text style={styles.avatarText}>{authorName.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View>
                <Text style={[styles.authorName, (isVibesPro || isBlueSky) && styles.vibesProText]}>{authorName}</Text>
                <Text style={[styles.authorSubtext, (isVibesPro || isBlueSky) && styles.vibesProMutedText]}>
                  Posting to your feed
                </Text>
              </View>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={styles.editorScroll}
              contentContainerStyle={styles.editorContent}
            >
              {image ? (
                <View style={styles.previewWrap}>
                  <Image source={{ uri: image.uri }} style={styles.preview} />
                  <Pressable
                    accessibilityLabel="Remove image"
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => setImage(null)}
                    style={styles.removeImage}
                  >
                    <Text style={styles.removeImageText}>×</Text>
                  </Pressable>
                </View>
              ) : null}
              <TextInput
                accessibilityLabel="Post text"
                editable={!busy}
                multiline
                onChangeText={(value) => {
                  setText(value);
                  setError(null);
                }}
                placeholder="Drop your vibe 💬"
                placeholderTextColor={isVibesPro || isBlueSky ? "#dbeafe" : "#64748b"}
                textAlignVertical="top"
                style={[styles.textInput, isVibesPro && styles.vibesProTextInput, isBlueSky && styles.blueSkyTextInput]}
                value={text}
              />
            </ScrollView>

            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}

            <View style={styles.actionsRow}>
              <Pressable
                accessibilityLabel="Add an image"
                accessibilityRole="button"
                disabled={busy}
                onPress={() => void chooseImage()}
                style={({ pressed }) => [
                  styles.mediaButton,
                  isVibesPro && styles.vibesProActionButton,
                  isBlueSky && styles.blueSkyActionButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.mediaIcon}>📸</Text>
              </Pressable>
              <View style={styles.publishActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => setOpen(false)}
                  style={({ pressed }) => [
                    styles.cancelButton,
                    isVibesPro && styles.vibesProActionButton,
                    isBlueSky && styles.blueSkyActionButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.cancelText, (isVibesPro || isBlueSky) && styles.vibesProMutedText]}>Cancel</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy || (!text.trim() && !image)}
                  onPress={() => void publish()}
                  style={({ pressed }) => [
                    styles.publishButton,
                    isVibesPro && styles.vibesProPublishButton,
                    isBlueSky && styles.blueSkyPublishButton,
                    pressed && styles.pressed,
                    (busy || (!text.trim() && !image)) && styles.disabled,
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.publishText}>Post it 🔥</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </LinearGradient>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  collapsed: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 12,
    marginTop: 14,
    marginBottom: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.7)",
    shadowColor: "#0c4a6e",
    shadowOpacity: 0.12,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  vibesProCollapsed: {
    borderColor: "rgba(212,175,55,0.3)",
    backgroundColor: "#111111",
    shadowColor: "#7C5CFF",
  },
  blueSkyCollapsed: { borderColor: "#3478bd", backgroundColor: "#0b2d5b" },
  avatar: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#0ea5e9",
  },
  vibesProAvatar: { backgroundColor: "#7C5CFF" },
  blueSkyAvatar: { backgroundColor: "#155192" },
  avatarText: { color: "#ffffff", fontSize: 19, fontWeight: "900" },
  placeholder: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    overflow: "hidden",
    borderRadius: 16,
    color: "#475569",
    backgroundColor: "rgba(255,255,255,0.7)",
    fontSize: 15,
  },
  vibesProPlaceholder: {
    color: "#ffffff",
    backgroundColor: "#202024",
  },
  blueSkyPlaceholder: { color: "#ffffff", backgroundColor: "#104078" },
  modalRoot: { flex: 1, justifyContent: "center", padding: 18 },
  backdrop: { ...StyleSheet.absoluteFill },
  composer: {
    maxHeight: "90%",
    overflow: "hidden",
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.75)",
    borderRadius: 28,
    backgroundColor: "rgba(245,252,255,0.98)",
    shadowColor: "#082f49",
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  vibesProComposer: {
    borderColor: "rgba(212,175,55,0.35)",
    backgroundColor: "rgba(17,17,17,0.98)",
  },
  blueSkyComposer: { borderColor: "#3478bd", backgroundColor: "rgba(11,45,91,0.98)" },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: "#0f172a", fontSize: 23, fontWeight: "900" },
  vibesProText: { color: "#ffffff" },
  closeButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  closeText: { color: "#475569", fontSize: 30, lineHeight: 34 },
  vibesProMutedText: { color: "#d6d6d6" },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 11, marginTop: 12, marginBottom: 18 },
  authorName: { color: "#0f172a", fontSize: 15, fontWeight: "800" },
  authorSubtext: { marginTop: 3, color: "#64748b", fontSize: 12 },
  editorScroll: { flexGrow: 0, minHeight: 150 },
  editorContent: { gap: 12 },
  previewWrap: { width: 138, height: 138, position: "relative" },
  preview: { width: "100%", height: "100%", borderRadius: 17, backgroundColor: "#e0f2fe" },
  removeImage: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 27,
    height: 27,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#e11d48",
  },
  removeImageText: { color: "#ffffff", fontSize: 20, fontWeight: "800", lineHeight: 23 },
  textInput: {
    minHeight: 140,
    maxHeight: 290,
    padding: 15,
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 18,
    color: "#334155",
    backgroundColor: "rgba(255,255,255,0.84)",
    fontSize: 16,
    lineHeight: 23,
  },
  vibesProTextInput: {
    borderColor: "rgba(212,175,55,0.3)",
    color: "#ffffff",
    backgroundColor: "#202024",
  },
  blueSkyTextInput: { borderColor: "#3478bd", color: "#ffffff", backgroundColor: "#104078" },
  error: { marginTop: 9, color: "#be123c", fontSize: 13, lineHeight: 19 },
  actionsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  mediaButton: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: "#ffffff",
    elevation: 2,
  },
  vibesProActionButton: { backgroundColor: "#27272a" },
  blueSkyActionButton: { backgroundColor: "#155192" },
  mediaIcon: { fontSize: 22 },
  publishActions: { flexDirection: "row", alignItems: "center", gap: 9 },
  cancelButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 17,
    borderRadius: 15,
    backgroundColor: "#ffffff",
  },
  cancelText: { color: "#475569", fontSize: 14, fontWeight: "800" },
  publishButton: {
    minWidth: 118,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 17,
    borderRadius: 15,
    backgroundColor: "#0ea5e9",
  },
  vibesProPublishButton: { backgroundColor: "#7C5CFF" },
  blueSkyPublishButton: { backgroundColor: "#155192" },
  publishText: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.48 },
});
