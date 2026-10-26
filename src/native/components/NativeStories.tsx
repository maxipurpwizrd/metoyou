import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import NativeBlurBackdrop from "./NativeBlurBackdrop";
import NativeConfirmDialog from "./NativeConfirmDialog";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNativeAuth } from "../contexts/NativeAuthProvider";
import { useNativeTheme } from "../contexts/NativeThemeProvider";
import { createNativeStory, deleteNativeStory, fetchNativeStories, type NativeStory } from "../lib/stories";
import { nativeStoriesQueryKey } from "../lib/queryKeys";

const SAVED_STORIES_KEY = "metoyou-saved-stories";
const STORY_DURATIONS = [2, 4, 8, 12, 24];
const EMPTY_STORIES: NativeStory[] = [];

function getTimeLeft(expiresAt: string) {
  const hours = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 3_600_000));
  return hours > 0 ? `${hours}h left` : "Ending soon";
}

export default function NativeStories({
  isVibesPro = false,
  messagesList = false,
}: {
  isVibesPro?: boolean;
  messagesList?: boolean;
}) {
  const { session } = useNativeAuth();
  const { theme } = useNativeTheme();
  const isBlueSky = theme === "bluesky";
  const authorId = session?.user.id;
  const username =
    typeof session?.user.user_metadata.username === "string"
      ? session.user.user_metadata.username
      : session?.user.email?.split("@")[0] ?? "MeToYou member";
  const profilePic =
    typeof session?.user.user_metadata.avatar_url === "string"
      ? session.user.user_metadata.avatar_url
      : null;
  const queryClient = useQueryClient();
  const storiesQuery = useQuery({
    queryKey: nativeStoriesQueryKey(authorId ?? ""),
    queryFn: fetchNativeStories,
    enabled: Boolean(authorId),
    staleTime: 20_000,
  });
  const stories = (storiesQuery.data ?? EMPTY_STORIES).filter(
    (story) => new Date(story.expires_at).getTime() > Date.now(),
  );
  const loading = storiesQuery.isPending;
  const loadError = storiesQuery.error?.message ?? null;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [storyToDelete, setStoryToDelete] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [duration, setDuration] = useState(24);
  const [image, setImage] = useState<{
    uri: string;
    base64: string;
    originalBase64: string;
    originalMimeType: string;
  } | null>(null);
  const [savedStoryIds, setSavedStoryIds] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const selectedStory = selectedIndex === null ? null : stories[selectedIndex] ?? null;
  const isOwner = Boolean(selectedStory && selectedStory.author_id === authorId);

  useEffect(() => {
    void AsyncStorage.getItem(SAVED_STORIES_KEY)
      .then((raw) => {
        if (!raw) return;
        const ids: unknown = JSON.parse(raw);
        if (Array.isArray(ids) && ids.every((id) => typeof id === "string")) {
          setSavedStoryIds(new Set(ids));
        }
      })
      .catch((cause: unknown) => {
        Alert.alert(
          "Saved stories unavailable",
          cause instanceof Error ? cause.message : "Saved stories could not be loaded.",
        );
      });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!authorId) return;
      queryClient.setQueryData<NativeStory[]>(
        nativeStoriesQueryKey(authorId),
        (current) => current?.filter(
          (story) => new Date(story.expires_at).getTime() > Date.now(),
        ),
      );
    }, 60_000);
    return () => clearInterval(interval);
  }, [authorId, queryClient]);

  useEffect(() => {
    if (!selectedStory || selectedIndex === null) return;
    setProgress(0);
    const durationMs = selectedStory.story_type === "voice" ? 3000 : 5000;
    const tickMs = 100;
    const interval = setInterval(() => {
      setProgress((current) => Math.min(100, current + (tickMs / durationMs) * 100));
    }, tickMs);
    const timeout = setTimeout(() => {
      if (selectedIndex < stories.length - 1) {
        setSelectedIndex(selectedIndex + 1);
      } else if (stories.length > 1) {
        setSelectedIndex(0);
      } else {
        setSelectedIndex(null);
      }
    }, durationMs);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [selectedIndex, selectedStory, stories.length]);

  const openComposer = () => {
    setComposerError(null);
    setText("");
    setImage(null);
    setDuration(24);
    setComposerOpen(true);
  };

  const choosePhoto = async () => {
    setComposerError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setComposerError("Allow photo-library access to add a story photo.");
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
      if (!asset?.base64) {
        setComposerError("The selected image could not be read.");
        return;
      }
      if (asset.fileSize !== undefined && asset.fileSize > 5 * 1024 * 1024) {
        setComposerError("Image must be less than 5MB.");
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
        setComposerError("This image could not be compressed below 300KB. Please choose another image.");
        return;
      }
      setImage({
        uri: optimized.uri,
        base64: optimized.base64,
        originalBase64: asset.base64,
        originalMimeType: asset.mimeType ?? "image/jpeg",
      });
    } catch (cause) {
      setComposerError(cause instanceof Error ? cause.message : "Unable to select that photo.");
    }
  };

  const publishStory = async () => {
    if (!authorId || busy || (!text.trim() && !image)) return;
    setBusy(true);
    setComposerError(null);
    try {
      const story = await createNativeStory({
        authorId,
        username,
        profilePic,
        text,
        imageBase64: image?.base64,
        originalImageBase64: image?.originalBase64,
        originalImageMimeType: image?.originalMimeType,
        durationHours: duration,
      });
      if (authorId) {
        const key = nativeStoriesQueryKey(authorId);
        queryClient.setQueryData<NativeStory[]>(key, (current) => [
          story,
          ...(current ?? []).filter((item) => item.id !== story.id),
        ]);
        void queryClient.invalidateQueries({ queryKey: key });
      }
      setComposerOpen(false);
    } catch (cause) {
      setComposerError(cause instanceof Error ? cause.message : "Unable to publish this story.");
    } finally {
      setBusy(false);
    }
  };

  const saveStory = async () => {
    if (!selectedStory) return;
    const next = new Set(savedStoryIds).add(selectedStory.id);
    await AsyncStorage.setItem(SAVED_STORIES_KEY, JSON.stringify([...next]));
    setSavedStoryIds(next);
    setMenuOpen(false);
    Alert.alert("Story saved", "This story is saved on this device.");
  };

  const shareStory = async () => {
    if (!selectedStory) return;
    await Share.share({
      title: `${selectedStory.author_username}'s story`,
      message: [selectedStory.text, selectedStory.image_url].filter(Boolean).join("\n") ||
        `A MeToYou story by ${selectedStory.author_username}`,
    });
    setMenuOpen(false);
  };

  const deleteStory = () => {
    if (!selectedStory || !authorId) return;
    setMenuOpen(false);
    setStoryToDelete(selectedStory.id);
  };

  const confirmDeleteStory = async () => {
    if (!storyToDelete || !authorId) return;
    const storyId = storyToDelete;
    await deleteNativeStory(storyId, authorId);
    if (authorId) {
      const key = nativeStoriesQueryKey(authorId);
      queryClient.setQueryData<NativeStory[]>(
        key,
        (current) => current?.filter((story) => story.id !== storyId),
      );
      void queryClient.invalidateQueries({ queryKey: key });
    }
    setSelectedIndex(null);
    setMenuOpen(false);
    setStoryToDelete(null);
  };

  const menuActions = useMemo(
    () => [
      { label: "Share story", action: () => void shareStory() },
      {
        label: savedStoryIds.has(selectedStory?.id ?? "") ? "Saved on this device" : "Save story",
        action: () => void saveStory(),
      },
      ...(isOwner ? [{ label: "Delete story", action: deleteStory }] : []),
    ],
    [isOwner, savedStoryIds, selectedStory],
  );

  const goPrevious = () => {
    if (selectedIndex === null || stories.length < 2) return;
    setSelectedIndex((selectedIndex - 1 + stories.length) % stories.length);
  };
  const goNext = () => {
    if (selectedIndex === null || stories.length < 2) {
      setSelectedIndex(null);
      return;
    }
    setSelectedIndex((selectedIndex + 1) % stories.length);
  };

  return (
    <>
      <View style={styles.section}>
        <ScrollView
          contentContainerStyle={styles.storyStrip}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <Pressable
            accessibilityLabel="Create a story"
            accessibilityRole="button"
            onPress={openComposer}
            style={({ pressed }) => [
              styles.addStory,
              isVibesPro && styles.vibesProAddStory,
              isBlueSky && styles.blueSkyAddStory,
              messagesList && styles.messagesListStoryTile,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.addIcon, isVibesPro && styles.vibesProAddIcon, isBlueSky && styles.blueSkyText]}>+</Text>
            <Text style={[styles.addLabel, isVibesPro && styles.vibesProAddLabel, isBlueSky && styles.blueSkyText]}>Your Story</Text>
          </Pressable>
          {loading && stories.length === 0
            ? Array.from({ length: 4 }, (_, index) => (
                <View
                  key={index}
                  style={[
                    styles.skeleton,
                    isVibesPro && styles.vibesProSkeleton,
                    isBlueSky && styles.blueSkyStoryTile,
                    messagesList && styles.messagesListStoryTile,
                  ]}
                />
              ))
            : stories.map((story, index) => (
                <Pressable
                  accessibilityLabel={`View ${story.author_username}'s story`}
                  accessibilityRole="button"
                  key={story.id}
                  onPress={() => setSelectedIndex(index)}
                  style={({ pressed }) => [
                    styles.storyCard,
                    isVibesPro && styles.vibesProStoryCard,
                    isBlueSky && styles.blueSkyStoryTile,
                    messagesList && styles.messagesListStoryTile,
                    pressed && styles.pressed,
                  ]}
                >
                  {story.image_url ? (
                    <Image resizeMode="cover" source={{ uri: story.image_url }} style={styles.storyImage} />
                  ) : (
                    <LinearGradient
                      colors={
                        isBlueSky
                          ? ["#061a3a", "#0b3b78", "#125baa"]
                          : isVibesPro
                          ? ["#7C5CFF", "#00D4FF", "#D4AF37"]
                          : ["#38bdf8", "#06b6d4", "#2563eb"]
                      }
                      end={{ x: 1, y: 1 }}
                      start={{ x: 0, y: 0 }}
                      style={styles.storyTextPreview}
                    >
                      <Text numberOfLines={4} style={styles.storyPreviewText}>
                        {story.text || (story.voice_url ? "Audio story" : "Text story")}
                      </Text>
                    </LinearGradient>
                  )}
                  <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.72)"]}
                    locations={[0.35, 1]}
                    style={styles.storyShade}
                  />
                  {story.author_profile_pic ? (
                    <Image
                      source={{ uri: story.author_profile_pic }}
                      style={styles.storyAvatar}
                    />
                  ) : (
                    <View style={styles.storyAvatarFallback}>
                      <Text style={styles.storyAvatarInitial}>
                        {story.author_username.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.storyCaption}>
                    <Text numberOfLines={1} style={styles.storyAuthor}>
                      {story.author_username}
                    </Text>
                    <Text style={styles.storyExpiry}>{getTimeLeft(story.expires_at)}</Text>
                  </View>
                </Pressable>
              ))}
        </ScrollView>
        {loadError ? (
          <View style={styles.errorRow}>
            <Text
              numberOfLines={2}
              style={[styles.errorText, isVibesPro && styles.vibesProMutedText]}
            >
              {loadError}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => void storiesQuery.refetch()}>
              <Text style={[styles.retryText, isVibesPro && styles.vibesProRetryText]}>Retry</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setSelectedIndex(null)}
        statusBarTranslucent
        visible={selectedStory !== null}
      >
        {selectedStory ? (
          <SafeAreaView edges={["top", "bottom"]} style={[styles.viewer, isBlueSky && styles.blueSkyViewer]}>
            <View style={styles.progressRow}>
              {stories.map((story, index) => (
                <View key={story.id} style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: index < (selectedIndex ?? 0) ? "100%" : index === selectedIndex ? `${progress}%` : "0%" },
                    ]}
                  />
                </View>
              ))}
            </View>
            <View style={styles.viewerHeader}>
              <View style={styles.viewerAuthor}>
                {selectedStory.author_profile_pic ? (
                  <Image source={{ uri: selectedStory.author_profile_pic }} style={styles.viewerAvatar} />
                ) : (
                  <View style={styles.viewerAvatarFallback}>
                    <Text style={styles.storyAvatarInitial}>
                      {selectedStory.author_username.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View>
                  <Text style={styles.viewerName}>{selectedStory.author_username}</Text>
                  <Text style={styles.viewerExpiry}>{getTimeLeft(selectedStory.expires_at)}</Text>
                </View>
              </View>
              <View style={styles.viewerActions}>
                <Pressable accessibilityLabel="Story options" onPress={() => setMenuOpen(true)} style={styles.viewerIconButton}>
                  <Text style={styles.viewerIcon}>•••</Text>
                </Pressable>
                <Pressable accessibilityLabel="Close story" onPress={() => setSelectedIndex(null)} style={styles.viewerIconButton}>
                  <Text style={styles.viewerIcon}>×</Text>
                </Pressable>
              </View>
            </View>
            {selectedStory.image_url ? (
              <Image
                resizeMode="contain"
                source={{ uri: selectedStory.image_original_url || selectedStory.image_url }}
                style={styles.viewerImage}
              />
            ) : (
              <LinearGradient
                colors={["#0ea5e9", "#06b6d4", "#2563eb"]}
                end={{ x: 1, y: 1 }}
                start={{ x: 0, y: 0 }}
                style={styles.viewerTextBackground}
              >
                <Text style={styles.viewerText}>
                  {selectedStory.text || "Audio story playback is coming in a later native update."}
                </Text>
              </LinearGradient>
            )}
            <View pointerEvents="box-none" style={styles.tapNavigation}>
              <Pressable accessibilityLabel="Previous story" onPress={goPrevious} style={styles.tapHalf} />
              <Pressable accessibilityLabel="Next story" onPress={goNext} style={styles.tapHalf} />
            </View>
            <Modal
              animationType="fade"
              onRequestClose={() => setMenuOpen(false)}
              transparent
              visible={menuOpen}
            >
              <View style={styles.menuBackdrop}>
                <NativeBlurBackdrop intensity={18} overlayColor="rgba(2,6,23,0.25)" />
                <Pressable onPress={() => setMenuOpen(false)} style={StyleSheet.absoluteFill} />
                <View style={[styles.menuCard, isBlueSky && styles.blueSkyMenuCard]}>
                  {menuActions.map((item) => (
                    <Pressable key={item.label} onPress={item.action} style={styles.menuAction}>
                      <Text style={[styles.menuActionText, item.label === "Delete story" && styles.deleteText]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </Modal>
          </SafeAreaView>
        ) : null}
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={() => {
          if (!busy) setComposerOpen(false);
        }}
        transparent
        visible={composerOpen}
      >
        <SafeAreaView style={styles.composerRoot}>
          <NativeBlurBackdrop intensity={60} overlayColor="rgba(2,32,54,0.42)" />
          <Pressable onPress={() => !busy && setComposerOpen(false)} style={styles.composerBackdrop} />
          <View style={[styles.composerCard, isVibesPro && styles.vibesProComposerCard, isBlueSky && styles.blueSkyComposerCard]}>
            <View style={styles.composerTitleRow}>
              <View>
                <Text style={[styles.composerTitle, (isVibesPro || isBlueSky) && styles.vibesProText]}>
                  Create a story
                </Text>
                <Text style={[styles.composerSubtitle, (isVibesPro || isBlueSky) && styles.vibesProMutedText]}>
                  Share text or a photo for a little while.
                </Text>
              </View>
              <Pressable accessibilityLabel="Close story composer" disabled={busy} onPress={() => setComposerOpen(false)}>
                <Text style={[styles.composerClose, (isVibesPro || isBlueSky) && styles.vibesProMutedText]}>×</Text>
              </Pressable>
            </View>
            {image ? (
              <View style={styles.photoPreviewWrap}>
                <Image source={{ uri: image.uri }} style={styles.photoPreview} />
                <Pressable accessibilityLabel="Remove story photo" onPress={() => setImage(null)} style={styles.removePhoto}>
                  <Text style={styles.removePhotoText}>×</Text>
                </Pressable>
              </View>
            ) : null}
            <TextInput
              accessibilityLabel="Story text"
              editable={!busy}
              multiline
              onChangeText={(value) => {
                setText(value);
                setComposerError(null);
              }}
              placeholder="Write something to share…"
              placeholderTextColor={isVibesPro || isBlueSky ? "#dbeafe" : "#64748b"}
              style={[styles.storyInput, isVibesPro && styles.vibesProStoryInput, isBlueSky && styles.blueSkyStoryInput]}
              value={text}
            />
            <View style={styles.durationRow}>
              <Text style={[styles.durationLabel, isVibesPro && styles.vibesProMutedText]}>
                Visible for
              </Text>
              {STORY_DURATIONS.map((hours) => (
                <Pressable
                  accessibilityRole="button"
                  key={hours}
                  onPress={() => setDuration(hours)}
                  style={[
                    styles.durationChoice,
                    isVibesPro && styles.vibesProDurationChoice,
                    duration === hours &&
                      (isVibesPro ? styles.vibesProDurationSelected : styles.durationSelected),
                  ]}
                >
                  <Text
                    style={[
                      styles.durationText,
                      isVibesPro && styles.vibesProMutedText,
                      duration === hours &&
                        (isVibesPro ? styles.vibesProDurationTextSelected : styles.durationTextSelected),
                    ]}
                  >
                    {hours}h
                  </Text>
                </Pressable>
              ))}
            </View>
            {composerError ? <Text accessibilityRole="alert" style={styles.errorText}>{composerError}</Text> : null}
            <View style={styles.composerButtons}>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => void choosePhoto()}
                style={[styles.photoButton, isVibesPro && styles.vibesProPhotoButton]}
              >
                <Text style={[styles.photoButtonText, isVibesPro && styles.vibesProText]}>
                  Add photo
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={busy || (!text.trim() && !image)}
                onPress={() => void publishStory()}
                style={[
                  styles.publishButton,
                  isVibesPro && styles.vibesProPublishButton,
                  (busy || (!text.trim() && !image)) && styles.disabled,
                ]}
              >
                {busy ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.publishText}>Share Story</Text>}
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
      <NativeConfirmDialog
        confirmLabel="Delete"
        destructive
        emoji="🫧"
        message="This story will disappear for good. Ready to let it go?"
        onCancel={() => setStoryToDelete(null)}
        onConfirm={confirmDeleteStory}
        title="Delete this story?"
        visible={storyToDelete !== null}
      />
    </>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 10, paddingBottom: 2 },
  storyStrip: { gap: 10, paddingHorizontal: 12, paddingBottom: 14 },
  addStory: {
    width: 104,
    height: 152,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.78)",
    shadowColor: "#0c4a6e",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  vibesProAddStory: {
    borderWidth: 2,
    borderColor: "rgba(212,175,55,0.35)",
    borderRadius: 20,
    backgroundColor: "#111111",
    shadowColor: "#D4AF37",
    shadowOpacity: 0.2,
  },
  blueSkyAddStory: { borderColor: "#3478bd", backgroundColor: "#0b2d5b" },
  blueSkyText: { color: "#ffffff" },
  blueSkyStoryTile: { borderColor: "#54b8ff", backgroundColor: "#104078" },
  messagesListStoryTile: { width: 96, height: 96, borderRadius: 24 },
  addIcon: { color: "#0284c7", fontSize: 34, fontWeight: "300", lineHeight: 38 },
  vibesProAddIcon: { color: "#D4AF37" },
  addLabel: { color: "#0369a1", fontSize: 11, fontWeight: "800" },
  vibesProAddLabel: { color: "#ffffff" },
  skeleton: { width: 104, height: 152, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.55)" },
  vibesProSkeleton: { borderRadius: 20, backgroundColor: "#181818" },
  storyCard: {
    width: 104,
    height: 152,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#38bdf8",
    borderRadius: 21,
    backgroundColor: "#0f172a",
  },
  vibesProStoryCard: {
    borderWidth: 2,
    borderColor: "rgba(212,175,55,0.7)",
    borderRadius: 20,
    shadowColor: "#D4AF37",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },
  storyImage: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
  storyTextPreview: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", padding: 10 },
  storyPreviewText: { color: "#ffffff", fontSize: 12, fontWeight: "700", lineHeight: 16 },
  storyShade: { ...StyleSheet.absoluteFill },
  storyAvatar: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 27,
    height: 27,
    borderWidth: 1.5,
    borderColor: "#ffffff",
    borderRadius: 14,
  },
  storyAvatarFallback: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 27,
    height: 27,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#ffffff",
    borderRadius: 14,
    backgroundColor: "#0284c7",
  },
  storyAvatarInitial: { color: "#ffffff", fontSize: 13, fontWeight: "900" },
  storyCaption: { position: "absolute", left: 8, right: 8, bottom: 8 },
  storyAuthor: { color: "#ffffff", fontSize: 11, fontWeight: "800" },
  storyExpiry: { marginTop: 2, color: "rgba(255,255,255,0.82)", fontSize: 9 },
  errorRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingHorizontal: 15 },
  errorText: { flex: 1, color: "#be123c", fontSize: 12, lineHeight: 18 },
  retryText: { color: "#0284c7", fontSize: 13, fontWeight: "800" },
  vibesProRetryText: { color: "#00D4FF" },
  vibesProMutedText: { color: "#d6d6d6" },
  vibesProText: { color: "#ffffff" },
  viewer: { flex: 1, backgroundColor: "#020617" },
  blueSkyViewer: { backgroundColor: "#061a3a" },
  progressRow: { zIndex: 2, flexDirection: "row", gap: 4, paddingHorizontal: 10, paddingTop: 4 },
  progressTrack: { flex: 1, height: 3, overflow: "hidden", borderRadius: 3, backgroundColor: "rgba(255,255,255,0.25)" },
  progressFill: { height: "100%", backgroundColor: "#ffffff" },
  viewerHeader: {
    position: "absolute",
    zIndex: 3,
    top: 22,
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  viewerAuthor: { flexDirection: "row", alignItems: "center", gap: 9 },
  viewerAvatar: { width: 36, height: 36, borderWidth: 1, borderColor: "#ffffff", borderRadius: 18 },
  viewerAvatarFallback: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#ffffff", borderRadius: 18, backgroundColor: "#0284c7" },
  viewerName: { color: "#ffffff", fontSize: 14, fontWeight: "800" },
  viewerExpiry: { marginTop: 2, color: "rgba(255,255,255,0.75)", fontSize: 11 },
  viewerActions: { flexDirection: "row", gap: 8 },
  viewerIconButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: "rgba(15,23,42,0.38)" },
  viewerIcon: { color: "#ffffff", fontSize: 24, fontWeight: "700", lineHeight: 27 },
  viewerImage: { width: "100%", height: "100%", backgroundColor: "#020617" },
  viewerTextBackground: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  viewerText: { color: "#ffffff", fontSize: 27, fontWeight: "700", lineHeight: 38, textAlign: "center", textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 4, textShadowOffset: { width: 1, height: 1 } },
  tapNavigation: { ...StyleSheet.absoluteFill, zIndex: 1, flexDirection: "row" },
  tapHalf: { flex: 1 },
  menuBackdrop: { flex: 1, alignItems: "flex-end", justifyContent: "flex-start", paddingTop: 78, paddingHorizontal: 14 },
  menuCard: { width: 210, overflow: "hidden", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 17, backgroundColor: "#ffffff" },
  blueSkyMenuCard: { borderColor: "#3478bd", backgroundColor: "#0b2d5b" },
  menuAction: { minHeight: 48, justifyContent: "center", paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e2e8f0" },
  menuActionText: { color: "#0f172a", fontSize: 14, fontWeight: "700" },
  deleteText: { color: "#e11d48" },
  composerRoot: { flex: 1, justifyContent: "center", padding: 18 },
  composerBackdrop: { ...StyleSheet.absoluteFill },
  composerCard: { maxHeight: "92%", padding: 20, borderWidth: 1, borderColor: "#dbeafe", borderRadius: 27, backgroundColor: "#f8fdff", elevation: 12 },
  vibesProComposerCard: { borderColor: "rgba(212,175,55,0.35)", backgroundColor: "#111111" },
  blueSkyComposerCard: { borderColor: "#3478bd", backgroundColor: "#0b2d5b" },
  composerTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  composerTitle: { color: "#082f49", fontSize: 22, fontWeight: "900" },
  composerSubtitle: { marginTop: 4, color: "#64748b", fontSize: 12 },
  composerClose: { color: "#475569", fontSize: 30, lineHeight: 34 },
  photoPreviewWrap: { height: 160, overflow: "hidden", marginBottom: 12, borderRadius: 17, backgroundColor: "#e0f2fe" },
  photoPreview: { width: "100%", height: "100%", resizeMode: "cover" },
  removePhoto: { position: "absolute", top: 8, right: 8, width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#e11d48" },
  removePhotoText: { color: "#ffffff", fontSize: 21, fontWeight: "800", lineHeight: 24 },
  storyInput: { minHeight: 126, maxHeight: 250, padding: 14, borderWidth: 1, borderColor: "#dbeafe", borderRadius: 17, color: "#334155", backgroundColor: "#ffffff", fontSize: 16, lineHeight: 23, textAlignVertical: "top" },
  vibesProStoryInput: { borderColor: "rgba(212,175,55,0.3)", color: "#ffffff", backgroundColor: "#202024" },
  blueSkyStoryInput: { borderColor: "#3478bd", color: "#ffffff", backgroundColor: "#104078" },
  durationRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 },
  durationLabel: { marginRight: "auto", color: "#475569", fontSize: 12, fontWeight: "700" },
  durationChoice: { minWidth: 35, alignItems: "center", paddingVertical: 7, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, backgroundColor: "#ffffff" },
  vibesProDurationChoice: { borderColor: "#52525b", backgroundColor: "#202024" },
  durationSelected: { borderColor: "#0284c7", backgroundColor: "#e0f2fe" },
  vibesProDurationSelected: { borderColor: "#7C5CFF", backgroundColor: "rgba(124,92,255,0.2)" },
  durationText: { color: "#64748b", fontSize: 11, fontWeight: "700" },
  durationTextSelected: { color: "#0369a1" },
  vibesProDurationTextSelected: { color: "#ffffff" },
  composerButtons: { flexDirection: "row", justifyContent: "space-between", gap: 10, marginTop: 16 },
  photoButton: { minHeight: 46, justifyContent: "center", paddingHorizontal: 15, borderRadius: 14, backgroundColor: "#e0f2fe" },
  vibesProPhotoButton: { backgroundColor: "#27272a" },
  photoButtonText: { color: "#0369a1", fontSize: 13, fontWeight: "800" },
  publishButton: { minHeight: 46, minWidth: 125, alignItems: "center", justifyContent: "center", paddingHorizontal: 15, borderRadius: 14, backgroundColor: "#0ea5e9" },
  vibesProPublishButton: { backgroundColor: "#7C5CFF" },
  publishText: { color: "#ffffff", fontSize: 13, fontWeight: "900" },
  disabled: { opacity: 0.48 },
  pressed: { opacity: 0.78 },
});
