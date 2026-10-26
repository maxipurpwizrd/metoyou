import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Constants from "expo-constants";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library/legacy";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import { LinearGradient } from "expo-linear-gradient";
import { BlurTargetView } from "expo-blur";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  CloudSun,
  Disc3,
  Download,
  Flag,
  ListMusic,
  ListOrdered,
  MessageCircle,
  MoonStar,
  Pause,
  Play,
  Repeat1,
  Share2,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
} from "lucide-react-native";
import { useNativeAuth } from "../contexts/NativeAuthProvider";
import { useNativeEntitlement } from "../contexts/NativeEntitlementProvider";
import { NATIVE_THEME_COLORS, useNativeTheme } from "../contexts/NativeThemeProvider";
import {
  fetchNativeTrackById,
  fetchNativeTracksPage,
  hydrateNativeTrackLikes,
  NATIVE_TRACKS_PAGE_SIZE,
  type NativeTrack,
} from "../lib/tracks";
import { deleteNativePost, reportNativePost, toggleNativePostLike } from "../lib/posts";
import NativeBlurBackdrop, { NativeBlurTargetContext } from "./NativeBlurBackdrop";
import NativeCommentsSheet from "./NativeCommentsSheet";
import NativeConfirmDialog from "./NativeConfirmDialog";
import { NativeTrackPlayerSkeleton, NativeTrackRowsSkeleton } from "./NativeScreenSkeletons";
import NativeSurfaceDock from "./NativeSurfaceDock";

const REPORT_REASONS = [
  "Bullying or abuse",
  "Adult Content",
  "Fraud or Scam",
  "I don't just wanna see this",
] as const;

type PlaylistTab = "device" | "vibespro";
type DeviceTrack = NativeTrack & { assetId?: string };
type PlayMode = "list" | "single" | "random";

const PLAY_MODE_LABELS: Record<PlayMode, string> = {
  list: "List play",
  single: "Single loop",
  random: "Random loop",
};

function errorMessage(cause: unknown, fallback: string) {
  if (cause instanceof Error) return cause.message;
  if (cause && typeof cause === "object" && "message" in cause && typeof cause.message === "string") {
    return cause.message;
  }
  return fallback;
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function NativeTracksScreen() {
  const router = useRouter();
  const { session } = useNativeAuth();
  const { entitlement, refresh: refreshEntitlement } = useNativeEntitlement();
  const { theme, setTheme } = useNativeTheme();
  const isBlueSky = theme === "bluesky";
  const userId = session?.user.id;
  const params = useLocalSearchParams<{ postId?: string | string[]; showComments?: string | string[]; openDeviceFiles?: string | string[] }>();
  const requestedPostId = Array.isArray(params.postId) ? params.postId[0] : params.postId;
  const requestedShowComments = (Array.isArray(params.showComments) ? params.showComments[0] : params.showComments) === "1";
  const requestedDeviceFiles = (Array.isArray(params.openDeviceFiles) ? params.openDeviceFiles[0] : params.openDeviceFiles) === "1";
  const insets = useSafeAreaInsets();
  const blurTargetRef = useRef<View | null>(null);
  const progressWidth = useRef(0);
  const autoplayNext = useRef(false);
  const finishedTrackId = useRef<string | null>(null);
  const likingTrackIds = useRef(new Set<string>());
  const deviceLoadInFlight = useRef(false);
  const [tracks, setTracks] = useState<NativeTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playMode, setPlayMode] = useState<PlayMode>("list");
  const [focusedTrack, setFocusedTrack] = useState<NativeTrack | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [focusedLoading, setFocusedLoading] = useState(Boolean(requestedPostId));
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const hasVibesPro = entitlement.status === "vibesPro";
  const accessLoading = entitlement.status === "loading" || entitlement.status === "unknown";
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [playlistTab, setPlaylistTab] = useState<PlaylistTab>("device");
  const [trackSource, setTrackSource] = useState<PlaylistTab>("vibespro");
  const [deviceTracks, setDeviceTracks] = useState<DeviceTrack[]>([]);
  const [deviceIndex, setDeviceIndex] = useState(0);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [devicePermission, setDevicePermission] = useState<"unknown" | "granted" | "denied">("unknown");
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [commentsTrackId, setCommentsTrackId] = useState<string | null>(
    () => requestedPostId && requestedShowComments ? requestedPostId : null,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [progressLayout, setProgressLayout] = useState(0);

  const currentTrack = requestedPostId
    ? focusedTrack
    : trackSource === "device"
      ? deviceTracks[deviceIndex]
      : tracks[currentIndex];
  const player = useAudioPlayer(currentTrack?.audio_url ?? null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const duration = status.duration || (currentTrack?.duration_ms ? currentTrack.duration_ms / 1000 : 0);
  const progress = duration > 0 ? Math.min(status.currentTime / duration, 1) : 0;
  const isDark = theme === "dark";
  const isDeviceTrack = !requestedPostId && trackSource === "device";

  const loadDeviceTracks = async (append = false): Promise<DeviceTrack[]> => {
    if (deviceLoadInFlight.current) return [];
    deviceLoadInFlight.current = true;
    setDeviceLoading(true);
    setDeviceError(null);
    try {
      if (Platform.OS === "android") {
        if (Constants.appOwnership === "expo") {
          throw new Error("Automatic audio-library access requires an Android development build; Expo Go does not include the required audio permission.");
        }
        const permission = devicePermission !== "granted"
          ? await MediaLibrary.requestPermissionsAsync(false, ["audio"])
          : await MediaLibrary.getPermissionsAsync(false, ["audio"]);
        if (!permission.granted) {
          setDevicePermission("denied");
          return [];
        }
        setDevicePermission("granted");

        const assets: MediaLibrary.Asset[] = [];
        let after: string | undefined;
        let hasNextPage = true;
        while (hasNextPage) {
          const page = await MediaLibrary.getAssetsAsync({
            after,
            first: 100,
            mediaType: "audio",
            sortBy: [["creationTime", false]],
          });
          assets.push(...page.assets.filter((asset) => /\.mp3$/i.test(asset.filename)));
          after = page.endCursor;
          hasNextPage = page.hasNextPage && Boolean(after);
        }
        const foundTracks: DeviceTrack[] = assets.map((asset) => ({
          id: `device:${asset.id}`,
          assetId: asset.id,
          author_id: "device",
          username: "On this device",
          profile_pic: null,
          text: asset.filename.replace(/\.mp3$/i, ""),
          image_url: null,
          image_original_url: null,
          video_url: null,
          audio_url: asset.uri,
          duration_ms: asset.duration > 0 ? asset.duration * 1000 : null,
          created_at: new Date(asset.creationTime).toISOString(),
          likes_count: 0,
          comments_count: 0,
          liked: false,
        }));
        setDeviceTracks(foundTracks);
        return foundTracks;
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/mpeg",
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return [];

      const pickedTracks: DeviceTrack[] = result.assets
        .filter((asset) => /\.mp3$/i.test(asset.name))
        .map((asset) => ({
          id: `device:${asset.uri}`,
          author_id: "device",
          username: "On this device",
          profile_pic: null,
          text: asset.name.replace(/\.[^.]+$/, ""),
          image_url: null,
          image_original_url: null,
          video_url: null,
          audio_url: asset.uri,
          duration_ms: null,
          created_at: new Date().toISOString(),
          likes_count: 0,
          comments_count: 0,
          liked: false,
        }));
      setDeviceTracks((current) => {
        if (!append) return pickedTracks;
        const existing = new Set(current.map((track) => track.id));
        return [...current, ...pickedTracks.filter((track) => !existing.has(track.id))];
      });
      return pickedTracks;
    } catch (cause) {
      setDeviceError(errorMessage(
        cause,
        Platform.OS === "android"
          ? "Unable to load MP3 files from your device."
          : "Unable to choose MP3 files from your device.",
      ));
      return [];
    } finally {
      deviceLoadInFlight.current = false;
      setDeviceLoading(false);
    }
  };

  const selectDeviceTrack = (index: number) => {
    const track = deviceTracks[index];
    void (async () => {
      try {
        const assetInfo = track?.assetId
          ? await MediaLibrary.getAssetInfoAsync(track.assetId, { shouldDownloadFromNetwork: false })
          : null;
        const playableUri = assetInfo?.localUri ?? assetInfo?.uri ?? track?.audio_url;
        if (!playableUri) throw new Error("This MP3 file is not available for playback.");
        setDeviceError(null);
        setDeviceTracks((current) =>
          current.map((item) => item.id === track.id ? { ...item, audio_url: playableUri } : item),
        );
        setTrackSource("device");
        setDeviceIndex(index);
        autoplayNext.current = true;
        setPlaylistOpen(false);
      } catch (cause) {
        setDeviceError(errorMessage(cause, "This MP3 file could not be opened."));
      }
    })();
  };

  const openPlaylist = () => {
    const initialTab = trackSource === "vibespro" && entitlement.status === "free" ? "device" : trackSource;
    setPlaylistTab(initialTab);
    setPlaylistOpen(true);
    if (initialTab === "device") void loadDeviceTracks();
  };

  useEffect(() => {
    if (!requestedDeviceFiles || requestedPostId) return;
    setTrackSource("device");
    setPlaylistTab("device");
    setPlaylistOpen(true);
    void loadDeviceTracks();
    router.setParams({ openDeviceFiles: undefined });
  }, [requestedDeviceFiles, requestedPostId, router]);

  const loadFirstPage = useCallback(async () => {
    if (!userId || !hasVibesPro || requestedPostId) return;
    setInitialLoading(true);
    setFeedError(null);
    try {
      const rows = await fetchNativeTracksPage();
      const hydrated = await hydrateNativeTrackLikes(rows, userId);
      setTracks(hydrated);
      setCurrentIndex(0);
      setHasMore(rows.length === NATIVE_TRACKS_PAGE_SIZE);
    } catch (cause) {
      setFeedError(errorMessage(cause, "Unable to load Tracks right now."));
    } finally {
      setInitialLoading(false);
    }
  }, [hasVibesPro, requestedPostId, userId]);

  useEffect(() => {
    if (hasVibesPro && !requestedPostId) void loadFirstPage();
    else if (!requestedPostId) {
      setTracks([]);
      setInitialLoading(false);
    }
  }, [hasVibesPro, loadFirstPage, requestedPostId]);

  useEffect(() => {
    if (!requestedPostId) {
      setFocusedTrack(null);
      setFocusedLoading(false);
      return;
    }
    let active = true;
    setFocusedTrack(null);
    setFocusedLoading(true);
    setFeedError(null);
    void (async () => {
      try {
        const track = await fetchNativeTrackById(requestedPostId);
        if (!track) throw new Error("Unable to find this Track.");
        const [hydrated] = userId ? await hydrateNativeTrackLikes([track], userId) : [track];
        if (active) setFocusedTrack(hydrated ?? track);
      } catch (cause) {
        if (active) setFeedError(errorMessage(cause, "Unable to load this Track right now."));
      } finally {
        if (active) setFocusedLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [requestedPostId, userId]);

  useEffect(() => {
    if (requestedPostId && requestedShowComments) setCommentsTrackId(requestedPostId);
  }, [requestedPostId, requestedShowComments]);

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true })
      .catch((cause: unknown) => setActionError(errorMessage(cause, "Audio playback could not be initialized.")));
  }, []);

  useEffect(() => {
    if (status.playbackState === "error") setAudioError("This Track could not be played.");
    else if (status.isLoaded) setAudioError(null);
  }, [currentTrack?.id, status.isLoaded, status.playbackState]);

  useEffect(() => {
    if (!autoplayNext.current || !currentTrack || !status.isLoaded) return;
    autoplayNext.current = false;
    player.play();
  }, [currentTrack?.id, player, status.isLoaded]);

  const loadMore = async () => {
    if (!userId || !hasMore || loadingMore || tracks.length === 0) return [];
    setLoadingMore(true);
    try {
      const rows = await fetchNativeTracksPage(tracks[tracks.length - 1].created_at);
      const hydrated = await hydrateNativeTrackLikes(rows, userId);
      const seen = new Set(tracks.map((track) => track.id));
      const added = hydrated.filter((track) => !seen.has(track.id));
      setTracks((current) => {
        const currentIds = new Set(current.map((track) => track.id));
        return [...current, ...hydrated.filter((track) => !currentIds.has(track.id))];
      });
      setHasMore(rows.length === NATIVE_TRACKS_PAGE_SIZE);
      return added;
    } catch (cause) {
      setFeedError(errorMessage(cause, "Unable to load more Tracks."));
      return [];
    } finally {
      setLoadingMore(false);
    }
  };

  const nextTrack = async (naturalFinish = false) => {
    if (requestedPostId) {
      player.pause();
      return;
    }

    const playlist = trackSource === "device" ? deviceTracks : tracks;
    const index = trackSource === "device" ? deviceIndex : currentIndex;
    const moveTo = (nextIndex: number) => {
      autoplayNext.current = true;
      if (trackSource === "device") setDeviceIndex(nextIndex);
      else setCurrentIndex(nextIndex);
    };

    if (naturalFinish && playMode === "single") {
      void player.seekTo(0);
      player.play();
      return;
    }

    if (playMode === "random" && playlist.length > 0) {
      if (playlist.length === 1) {
        void player.seekTo(0);
        player.play();
        return;
      }
      const candidates = playlist
        .map((_, candidateIndex) => candidateIndex)
        .filter((candidateIndex) => candidateIndex !== index);
      moveTo(candidates[Math.floor(Math.random() * candidates.length)]);
      return;
    }

    if (index < playlist.length - 1) {
      moveTo(index + 1);
      return;
    }

    if (trackSource === "device") {
      player.pause();
      void player.seekTo(0);
      return;
    }

    if (hasMore) {
      const added = await loadMore();
      if (added.length > 0) {
        if (playMode === "random") {
          const nextTracks = [...tracks, ...added];
          const candidates = nextTracks
            .map((_, candidateIndex) => candidateIndex)
            .filter((candidateIndex) => candidateIndex !== index);
          moveTo(candidates[Math.floor(Math.random() * candidates.length)]);
        } else {
          moveTo(tracks.length);
        }
        return;
      }
    }

    player.pause();
    void player.seekTo(0);
  };

  const cyclePlayMode = () => {
    setPlayMode((mode) => mode === "list" ? "single" : mode === "single" ? "random" : "list");
  };

  useEffect(() => {
    if (!status.didJustFinish) {
      finishedTrackId.current = null;
      return;
    }
    if (!currentTrack || finishedTrackId.current === currentTrack.id) return;
    finishedTrackId.current = currentTrack.id;
    void nextTrack(true);
  }, [status.didJustFinish]);

  const previousTrack = () => {
    if (status.currentTime > 3) {
      void player.seekTo(0);
      return;
    }
    if (trackSource === "device") {
      if (deviceIndex > 0) {
        autoplayNext.current = true;
        setDeviceIndex((index) => index - 1);
      } else {
        void player.seekTo(0);
      }
      return;
    }
    if (!requestedPostId && currentIndex > 0) {
      autoplayNext.current = true;
      setCurrentIndex((index) => index - 1);
    } else {
      void player.seekTo(0);
    }
  };

  const toggleLike = async () => {
    if (!userId || !currentTrack || isDeviceTrack || likingTrackIds.current.has(currentTrack.id)) return;
    const trackId = currentTrack.id;
    const previousLiked = currentTrack.liked;
    const previousLikesCount = currentTrack.likes_count;
    likingTrackIds.current.add(trackId);
    const updateTrack = (track: NativeTrack) =>
      track.id === trackId ? {
        ...track,
        liked: !previousLiked,
        likes_count: Math.max(0, previousLikesCount + (previousLiked ? -1 : 1)),
      } : track;
    setTracks((current) => current.map(updateTrack));
    setFocusedTrack((track) => track ? updateTrack(track) : track);
    try {
      const result = await toggleNativePostLike(trackId, userId);
      const reconcileTrack = (track: NativeTrack) =>
        track.id === trackId ? { ...track, liked: result.liked, likes_count: result.likesCount } : track;
      setTracks((current) => current.map(reconcileTrack));
      setFocusedTrack((track) => track ? reconcileTrack(track) : track);
    } catch (cause) {
      const restoreTrack = (track: NativeTrack) =>
        track.id === trackId ? { ...track, liked: previousLiked, likes_count: previousLikesCount } : track;
      setTracks((current) => current.map(restoreTrack));
      setFocusedTrack((track) => track ? restoreTrack(track) : track);
      setActionError(errorMessage(cause, "Unable to update this Track right now."));
    } finally {
      likingTrackIds.current.delete(trackId);
    }
  };

  const saveTrack = async () => {
    if (!currentTrack) return;
    const permission = await MediaLibrary.requestPermissionsAsync(true, ["audio"]);
    if (!permission.granted) throw new Error("Allow MeToYou to save audio to your device.");
    const safeName = (currentTrack.text?.trim() || "track")
      .replace(/[<>:"/\\|?*]/g, "")
      .replace(/\s+/g, "-")
      .toLowerCase();
    const extension = currentTrack.audio_url.split("?")[0].split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "mp3";
    const file = await File.downloadFileAsync(
      currentTrack.audio_url,
      new File(Paths.cache, `${safeName}.${extension}`),
      { idempotent: true },
    );
    await MediaLibrary.createAssetAsync(file.uri);
    setMenuOpen(false);
  };

  const shareTrack = async () => {
    if (!currentTrack) return;
    await Share.share({
      title: "MeToYou Track",
      message: `${currentTrack.text?.trim() || "Untitled Track"} — @${currentTrack.username}\n\n${currentTrack.audio_url}`,
    });
    setMenuOpen(false);
  };

  const submitReport = async (reason: string) => {
    if (!currentTrack) return;
    setReportBusy(true);
    setActionError(null);
    try {
      await reportNativePost({ postId: currentTrack.id, authorId: currentTrack.author_id, reason });
      setReportOpen(false);
      setMenuOpen(false);
      Alert.alert("Report sent", "Thanks for helping keep MeToYou safe.");
    } catch (cause) {
      setActionError(errorMessage(cause, "The report could not be submitted."));
      throw cause;
    } finally {
      setReportBusy(false);
    }
  };

  const deleteTrack = async () => {
    if (!currentTrack || isDeviceTrack || currentTrack.author_id !== userId) return;
    setDeleteBusy(true);
    try {
      await deleteNativePost(currentTrack.id);
      player.pause();
      setConfirmationVisible(false);
      setMenuOpen(false);
      if (requestedPostId) {
        setFocusedTrack(null);
        router.replace("/(app)/(tabs)/tracks");
      } else {
        const remaining = tracks.filter((track) => track.id !== currentTrack.id);
        setTracks(remaining);
        setCurrentIndex(Math.min(currentIndex, Math.max(remaining.length - 1, 0)));
      }
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleProgressPress = (locationX: number) => {
    if (duration <= 0 || progressWidth.current <= 0) return;
    void player.seekTo(Math.max(0, Math.min(locationX / progressWidth.current, 1)) * duration);
  };

  const shownTrack = currentTrack;
  const busy = accessLoading || (hasVibesPro && (requestedPostId
    ? focusedLoading && !focusedTrack
    : initialLoading && tracks.length === 0));

  return (
    <LinearGradient
      colors={NATIVE_THEME_COLORS[theme].background}
      style={styles.root}
    >
      <NativeBlurTargetContext.Provider value={blurTargetRef}>
        <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
          <BlurTargetView ref={blurTargetRef} style={styles.safeArea}>
            <View style={styles.header}>
              <Pressable accessibilityLabel="Back to Feed" onPress={() => router.navigate("/(app)/(tabs)")} style={styles.headerButton}>
                <Text style={styles.backText}>‹</Text>
              </Pressable>
              <View style={styles.heading}>
                <Text style={[styles.kicker, isDark && styles.darkKicker, isBlueSky && styles.blueSkyText]}>VIBESPRO</Text>
                <Text style={[styles.title, isDark && styles.darkTitle, isBlueSky && styles.blueSkyText]}>Tracks</Text>
              </View>
              <View style={styles.themeButtons}>
                <Pressable accessibilityLabel="Blue Sky theme" onPress={() => setTheme("bluesky")} style={[styles.themeButton, theme === "bluesky" && styles.activeBlue]}>
                  <CloudSun color={theme === "bluesky" ? "#ffffff" : "#0369a1"} size={19} />
                </Pressable>
                <Pressable accessibilityLabel="Dark Gold theme" onPress={() => setTheme("dark")} style={[styles.themeButton, theme === "dark" && styles.activeGold]}>
                  <MoonStar color={theme === "dark" ? "#0f172a" : "#a16207"} size={19} />
                </Pressable>
              </View>
            </View>

            {busy ? (
              accessLoading ? (
                <View style={styles.center}>
                  <ActivityIndicator color="#0284c7" size="large" />
                  <Text style={styles.statusText}>Checking your VibesPro access…</Text>
                </View>
              ) : <NativeTrackPlayerSkeleton />
            ) : entitlement.status === "error" ? (
              <View style={styles.center}>
                <Text style={styles.errorTitle}>Couldn’t check access</Text>
                <Text style={styles.statusText}>{entitlement.error.message}</Text>
                <Pressable onPress={() => void refreshEntitlement()} style={styles.retryButton}>
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
                <Pressable onPress={() => router.navigate("/(app)/(tabs)")} style={styles.backToFeed}>
                  <Text style={styles.backToFeedText}>Back to Feed</Text>
                </Pressable>
              </View>
            ) : requestedPostId && entitlement.status === "free" ? (
              <View style={styles.center}>
                <Text style={styles.lockEmoji}>🔒</Text>
                <Text style={styles.emptyTitle}>Tracks are a VibesPro space</Text>
                <Text style={styles.statusText}>VibesPro access is required to listen to Tracks.</Text>
                <Pressable onPress={() => router.navigate("/(app)/(tabs)")} style={styles.retryButton}>
                  <Text style={styles.retryText}>Back to Feed</Text>
                </Pressable>
              </View>
            ) : feedError && !shownTrack && (requestedPostId || trackSource === "vibespro") ? (
              <View style={styles.center}>
                <Text style={styles.errorTitle}>Tracks didn’t load</Text>
                <Text style={styles.statusText}>{feedError}</Text>
                <Pressable onPress={() => requestedPostId ? router.replace("/(app)/(tabs)/tracks") : void loadFirstPage()} style={styles.retryButton}>
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              </View>
            ) : !shownTrack ? (
              <View style={styles.center}>
                <Disc3 color={isDark ? "#fcd34d" : "#0ea5e9"} size={54} />
                <Text style={[styles.emptyTitle, isDark && styles.darkTitle]}>Ready for some music?</Text>
                <Text style={styles.statusText}>Choose audio from your device or explore VibesPro Tracks.</Text>
                <Pressable accessibilityRole="button" onPress={openPlaylist} style={styles.retryButton}>
                  <Text style={styles.retryText}>Open track list</Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView
                contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) + 88 }]}
                showsVerticalScrollIndicator={false}
              >
                <View style={[styles.playerCard, isDark && styles.darkCard, isBlueSky && styles.blueSkyCard]}>
                  <View style={styles.cover}>
                    {shownTrack.image_url ? (
                      <Image resizeMode="cover" source={{ uri: shownTrack.image_url }} style={StyleSheet.absoluteFill} />
                    ) : (
                      <LinearGradient
                        colors={isDark ? ["#451a03", "#0f172a", "#000000"] : ["#0284c7", "#06b6d4", "#1d4ed8"]}
                        style={styles.coverFallback}
                      >
                        <Disc3 color={isDark ? "#fcd34d" : "#ffffff"} size={190} />
                      </LinearGradient>
                    )}
                    {!isDeviceTrack ? (
                      <Pressable accessibilityLabel="Track actions" onPress={() => {
                        setActionError(null);
                        setMenuOpen(true);
                      }} style={styles.coverMenuButton}>
                        <Text style={styles.coverMenuText}>•••</Text>
                      </Pressable>
                    ) : null}
                  </View>

                  {isDeviceTrack ? (
                    <Text style={[styles.artist, isDark && styles.darkArtist, styles.artistButton]}>On your device</Text>
                  ) : (
                    <Pressable
                      accessibilityRole="link"
                      onPress={() => router.push({ pathname: "/(app)/profile/[username]", params: { username: shownTrack.username } })}
                      style={styles.artistButton}
                    >
                      <Text style={[styles.artist, isDark && styles.darkArtist]}>@{shownTrack.username}</Text>
                    </Pressable>
                  )}
                  <Text numberOfLines={2} style={[styles.trackTitle, isDark && styles.darkTitle, isBlueSky && styles.blueSkyText]}>
                    {shownTrack.text?.trim() || "Untitled Track"}
                  </Text>

                  <View style={styles.progressSection}>
                    <Pressable
                      accessibilityLabel="Seek in track"
                      accessibilityRole="adjustable"
                      onLayout={(event) => {
                        progressWidth.current = event.nativeEvent.layout.width;
                        setProgressLayout(event.nativeEvent.layout.width);
                      }}
                      onPress={(event) => handleProgressPress(event.nativeEvent.locationX)}
                      style={styles.progressTrack}
                    >
                      <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                      <View style={[styles.progressThumb, { left: Math.max(0, progress * (progressLayout - 12)) }]} />
                    </Pressable>
                    <View style={styles.timeRow}>
                      <Text style={styles.timeText}>{formatTime(status.currentTime)}</Text>
                      <Text style={styles.timeText}>{formatTime(duration)}</Text>
                    </View>
                  </View>

                  <View style={styles.transport}>
                    {!requestedPostId ? (
                      <Pressable
                        accessibilityHint="Tap to cycle between list play, single loop, and random loop."
                        accessibilityLabel={`Playback mode: ${PLAY_MODE_LABELS[playMode]}`}
                        accessibilityRole="button"
                        onPress={cyclePlayMode}
                        style={[styles.transportButton, isDark && styles.darkTransportButton]}
                      >
                        {playMode === "list" ? (
                          <ListOrdered color={isDark ? "#fde68a" : "#0369a1"} size={20} />
                        ) : playMode === "single" ? (
                          <Repeat1 color={isDark ? "#fde68a" : "#0369a1"} size={20} />
                        ) : (
                          <Shuffle color={isDark ? "#fde68a" : "#0369a1"} size={20} />
                        )}
                      </Pressable>
                    ) : null}
                    {!requestedPostId ? (
                      <Pressable accessibilityLabel="Previous Track" onPress={previousTrack} style={[styles.transportButton, isDark && styles.darkTransportButton]}>
                        <SkipBack color={isDark ? "#fde68a" : "#0369a1"} size={21} />
                      </Pressable>
                    ) : null}
                    <Pressable
                      accessibilityLabel={status.playing ? "Pause Track" : "Play Track"}
                      onPress={() => {
                        setActionError(null);
                        setAudioError(null);
                        try {
                          if (status.playing) player.pause();
                          else player.play();
                        } catch (cause) {
                          setAudioError(errorMessage(cause, "This Track could not be played."));
                        }
                      }}
                      style={[styles.playButton, isDark && styles.darkPlayButton]}
                    >
                      {status.playing ? <Pause color={isDark ? "#0f172a" : "#ffffff"} fill={isDark ? "#0f172a" : "#ffffff"} size={24} /> : <Play color={isDark ? "#0f172a" : "#ffffff"} fill={isDark ? "#0f172a" : "#ffffff"} size={24} />}
                    </Pressable>
                    {!requestedPostId ? (
                      <Pressable accessibilityLabel="Next Track" onPress={() => void nextTrack()} style={[styles.transportButton, isDark && styles.darkTransportButton]}>
                        <SkipForward color={isDark ? "#fde68a" : "#0369a1"} size={21} />
                      </Pressable>
                    ) : null}
                    {!requestedPostId ? (
                      <Pressable
                        accessibilityLabel="Open music list"
                        accessibilityRole="button"
                        onPress={openPlaylist}
                        style={[styles.transportButton, isDark && styles.darkTransportButton]}
                      >
                        <ListMusic color={isDark ? "#fde68a" : "#0369a1"} size={21} />
                      </Pressable>
                    ) : null}
                  </View>

                  {!status.isLoaded && !feedError ? <Text style={styles.audioStatus}>Preparing audio…</Text> : null}
                  {audioError ? <Text style={styles.actionError}>{audioError}</Text> : null}
                  {feedError ? <Text style={styles.actionError}>{feedError}</Text> : null}
                  {actionError ? <Text style={styles.actionError}>{actionError}</Text> : null}
                  {status.isBuffering ? <ActivityIndicator color={isDark ? "#fbbf24" : "#0284c7"} style={styles.buffering} /> : null}

                  {!isDeviceTrack ? (
                    <View style={[styles.engagement, isDark && styles.darkEngagement]}>
                      <Pressable accessibilityLabel={shownTrack.liked ? "Unlike Track" : "Like Track"} onPress={() => void toggleLike()} style={styles.engagementButton}>
                        <Text style={styles.likeIcon}>{shownTrack.liked ? "❤️" : "🤍"}</Text>
                        <Text style={[styles.engagementCount, isDark && styles.darkText]}>{shownTrack.likes_count}</Text>
                      </Pressable>
                      <Pressable accessibilityLabel="Track comments" onPress={() => setCommentsTrackId(shownTrack.id)} style={styles.engagementButton}>
                        <MessageCircle color={isDark ? "#fde68a" : "#0369a1"} size={21} />
                        <Text style={[styles.engagementCount, isDark && styles.darkText]}>{shownTrack.comments_count}</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>

                {!requestedPostId && hasMore ? (
                  <Pressable disabled={loadingMore} onPress={() => void loadMore()} style={styles.loadMoreButton}>
                    {loadingMore ? <ActivityIndicator color="#ffffff" size="small" /> : <Text style={styles.loadMoreText}>Load more Tracks</Text>}
                  </Pressable>
                ) : null}
              </ScrollView>
            )}

            <NativeSurfaceDock
              activeSurface="tracks"
              onClipsPress={() => router.navigate("/(app)/(tabs)/clips")}
              onFeedPress={() => router.navigate("/(app)/(tabs)")}
              onFlicksPress={() => router.navigate("/(app)/(tabs)/flicks")}
              onTracksPress={() => {
                if (requestedPostId) {
                  router.replace("/(app)/(tabs)/tracks");
                } else {
                  player.pause();
                  setCurrentIndex(0);
                }
              }}
              visible
            />

            {commentsTrackId && hasVibesPro && !accessLoading ? (
              <NativeCommentsSheet
                onClose={() => setCommentsTrackId(null)}
                onCountChange={(count) => {
                  setTracks((current) => current.map((track) => track.id === commentsTrackId ? { ...track, comments_count: count } : track));
                  setFocusedTrack((track) => track?.id === commentsTrackId ? { ...track, comments_count: count } : track);
                }}
                postId={commentsTrackId}
                visible
              />
            ) : null}
          </BlurTargetView>
        </SafeAreaView>

        {menuOpen && shownTrack ? (
          <View style={styles.modalRoot}>
            <NativeBlurBackdrop intensity={24} overlayColor="rgba(15,23,42,0.38)" />
            <Pressable onPress={() => setMenuOpen(false)} style={StyleSheet.absoluteFill} />
            <View style={styles.actionMenu}>
              <View style={styles.actionHeader}>
                <Text style={styles.menuTitle}>Track actions</Text>
                <Pressable accessibilityLabel="Close Track actions" onPress={() => setMenuOpen(false)}>
                  <Text style={styles.closeText}>×</Text>
                </Pressable>
              </View>
              {actionError ? <Text style={styles.actionError}>{actionError}</Text> : null}
              <View style={styles.actionGrid}>
                <MenuButton icon={<Share2 color="#0369a1" size={22} />} label="Share" onPress={() => {
                  void shareTrack().catch((cause: unknown) => setActionError(errorMessage(cause, "Unable to share this Track.")));
                }} />
                <MenuButton icon={<Download color="#0369a1" size={22} />} label="Save" onPress={() => {
                  void saveTrack().catch((cause: unknown) => setActionError(errorMessage(cause, "Unable to save this Track.")));
                }} />
                {shownTrack.author_id !== userId ? (
                  <MenuButton icon={<Flag color="#0369a1" size={22} />} label="Report" onPress={() => {
                    setMenuOpen(false);
                    setReportOpen(true);
                  }} />
                ) : (
                  <MenuButton danger icon={<Trash2 color="#e11d48" size={22} />} label="Delete" onPress={() => {
                    setMenuOpen(false);
                    setConfirmationVisible(true);
                  }} />
                )}
              </View>
            </View>
          </View>
        ) : null}

        <Modal
          animationType="slide"
          onRequestClose={() => setPlaylistOpen(false)}
          statusBarTranslucent={false}
          transparent={false}
          visible={playlistOpen}
        >
          <LinearGradient
            colors={NATIVE_THEME_COLORS[theme].background}
            style={styles.playlistScreen}
          >
            <SafeAreaView accessibilityViewIsModal edges={["top", "bottom"]} style={styles.playlistSafeArea}>
              <View style={styles.playlistHeader}>
                <View>
                  <Text style={[styles.playlistKicker, isDark && styles.darkKicker]}>YOUR MUSIC</Text>
                  <Text style={[styles.playlistTitle, isDark && styles.darkTitle]}>Music library</Text>
                  <Text style={[styles.playlistSubtitle, isDark && styles.darkSubtext]}>
                    {playlistTab === "device"
                      ? `${deviceTracks.length} device ${deviceTracks.length === 1 ? "file" : "files"}`
                      : accessLoading
                        ? "Checking VibesPro access"
                        : entitlement.status === "error"
                          ? "Access unavailable"
                          : entitlement.status === "free"
                            ? "VibesPro access required"
                            : `${tracks.length} VibesPro ${tracks.length === 1 ? "Track" : "Tracks"}`}
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel="Close track list"
                  accessibilityRole="button"
                  onPress={() => setPlaylistOpen(false)}
                  style={[styles.playlistClose, isDark && styles.playlistCloseDark]}
                >
                  <Text style={[styles.closeText, isDark && styles.darkText]}>×</Text>
                </Pressable>
              </View>
              <View style={styles.playlistTabs}>
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: playlistTab === "device" }}
                  onPress={() => {
                    setPlaylistTab("device");
                    void loadDeviceTracks();
                  }}
                  style={[
                    styles.playlistTab,
                    playlistTab === "device" && styles.playlistTabActive,
                    isDark && playlistTab === "device" && styles.playlistTabActiveDark,
                  ]}
                >
                  <Text style={[
                    styles.playlistTabText,
                    isDark && styles.darkSubtext,
                    playlistTab === "device" && styles.playlistTabTextActive,
                    isDark && playlistTab === "device" && styles.playlistTabTextActiveDark,
                  ]}>
                    Device Files
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: playlistTab === "vibespro" }}
                  onPress={() => setPlaylistTab("vibespro")}
                  style={[
                    styles.playlistTab,
                    playlistTab === "vibespro" && styles.playlistTabActive,
                    isDark && playlistTab === "vibespro" && styles.playlistTabActiveDark,
                  ]}
                >
                  <Text style={[
                    styles.playlistTabText,
                    isDark && styles.darkSubtext,
                    playlistTab === "vibespro" && styles.playlistTabTextActive,
                    isDark && playlistTab === "vibespro" && styles.playlistTabTextActiveDark,
                  ]}>
                    VibesPro Tracks
                  </Text>
                </Pressable>
              </View>
              <ScrollView
                contentContainerStyle={styles.playlistItems}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                style={styles.playlistScroll}
              >
                {playlistTab === "device" ? (
                  <>
                    {Platform.OS === "ios" ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={deviceLoading}
                        onPress={() => void loadDeviceTracks(deviceTracks.length > 0)}
                        style={styles.playlistPermissionButton}
                      >
                        {deviceLoading ? (
                          <ActivityIndicator color="#ffffff" />
                        ) : (
                          <Text style={styles.retryText}>Browse MP3 files</Text>
                        )}
                      </Pressable>
                    ) : null}
                    {deviceLoading && deviceTracks.length === 0 ? (
                      <View style={styles.playlistMessage}>
                        <ActivityIndicator color={isDark ? "#fbbf24" : "#0284c7"} size="large" />
                        <Text style={[styles.playlistMessageText, isDark && styles.darkSubtext]}>Scanning device for MP3 files…</Text>
                      </View>
                    ) : null}
                    {devicePermission === "denied" ? (
                      <View style={styles.playlistMessage}>
                        <Text style={styles.playlistError}>Audio access is turned off. Allow it in device settings to list MP3 files.</Text>
                        <Pressable onPress={() => void Linking.openSettings()} style={styles.playlistPermissionButton}>
                          <Text style={styles.retryText}>Open device settings</Text>
                        </Pressable>
                        <Pressable onPress={() => void loadDeviceTracks()} style={styles.playlistPermissionRetry}>
                          <Text style={[styles.playlistLoadMoreText, isDark && styles.darkText]}>Try again</Text>
                        </Pressable>
                      </View>
                    ) : null}
                    {deviceError ? (
                      <View style={styles.playlistMessage}>
                        <Text style={styles.playlistError}>{deviceError}</Text>
                      </View>
                    ) : null}
                    {deviceTracks.map((track, index) => {
                      const selected = isDeviceTrack && index === deviceIndex;
                      return (
                        <Pressable
                          accessibilityLabel={`${selected ? "Currently selected: " : ""}${track.text || "Audio file"}`}
                          accessibilityRole="button"
                          key={track.id}
                          onPress={() => selectDeviceTrack(index)}
                          style={({ pressed }) => [
                            styles.playlistItem,
                            isDark && styles.playlistDarkItem,
                            selected && (isDark ? styles.playlistSelectedDark : styles.playlistSelected),
                            pressed && styles.pressed,
                          ]}
                        >
                          <View style={[styles.playlistNumber, selected && styles.playlistNumberSelected]}>
                            {selected && status.playing ? (
                              <Pause color="#ffffff" size={14} />
                            ) : selected ? (
                              <Play color="#ffffff" fill="#ffffff" size={14} />
                            ) : (
                              <Text style={styles.playlistNumberText}>{index + 1}</Text>
                            )}
                          </View>
                          <View style={styles.playlistTrackText}>
                            <Text numberOfLines={1} style={[styles.playlistTrackTitle, isDark && styles.darkText, selected && styles.playlistSelectedText]}>
                              {track.text || "Audio file"}
                            </Text>
                            <Text numberOfLines={1} style={[styles.playlistArtist, isDark && styles.darkSubtext, selected && styles.playlistSelectedSubtext]}>
                              On this device
                            </Text>
                          </View>
                          {selected ? <Text style={styles.playingLabel}>{status.playing ? "PLAYING" : "SELECTED"}</Text> : null}
                        </Pressable>
                      );
                    })}
                    {deviceTracks.length === 0 &&
                    !deviceLoading &&
                    !deviceError &&
                    devicePermission !== "denied" ? (
                      <View style={styles.playlistMessage}>
                        <Text style={styles.lockEmoji}>🎵</Text>
                        <Text style={[styles.playlistMessageTitle, isDark && styles.darkTitle]}>
                          {Platform.OS === "android" ? "No MP3 files found" : "Choose music from your device"}
                        </Text>
                        <Text style={[styles.playlistMessageText, isDark && styles.darkSubtext]}>
                          {Platform.OS === "android"
                            ? "MP3 files saved in your device’s music library will appear here."
                            : "Select MP3 files from this device using the system file picker."}
                        </Text>
                      </View>
                    ) : null}
                  </>
                ) : accessLoading ? (
                  <View style={styles.playlistMessage}>
                    <ActivityIndicator color={isDark ? "#fbbf24" : "#0284c7"} size="large" />
                    <Text style={[styles.playlistMessageText, isDark && styles.darkSubtext]}>Checking VibesPro access…</Text>
                  </View>
                ) : entitlement.status === "error" ? (
                  <View style={styles.playlistMessage}>
                    <Text style={styles.playlistError}>{entitlement.error.message}</Text>
                    <Pressable onPress={() => void refreshEntitlement()} style={styles.playlistPermissionButton}>
                      <Text style={styles.retryText}>Try again</Text>
                    </Pressable>
                  </View>
                ) : entitlement.status === "free" ? (
                  <View style={styles.playlistMessage}>
                    <Text style={styles.lockEmoji}>🔒</Text>
                    <Text style={[styles.playlistMessageTitle, isDark && styles.darkTitle]}>VibesPro Tracks</Text>
                    <Text style={[styles.playlistMessageText, isDark && styles.darkSubtext]}>
                      This tab is for VibesPro members. Device Files are available to everyone.
                    </Text>
                  </View>
                ) : initialLoading && tracks.length === 0 ? (
                  <NativeTrackRowsSkeleton count={5} />
                ) : feedError && tracks.length === 0 ? (
                  <View style={styles.playlistMessage}>
                    <Text style={styles.playlistError}>{feedError}</Text>
                    <Pressable onPress={() => void loadFirstPage()} style={styles.playlistPermissionButton}>
                      <Text style={styles.retryText}>Try again</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    {tracks.map((track, index) => {
                      const selected = !isDeviceTrack && index === currentIndex;
                      return (
                        <Pressable
                          accessibilityLabel={`${selected ? "Currently selected: " : ""}${track.text?.trim() || "Untitled Track"} by ${track.username}`}
                          accessibilityRole="button"
                          key={track.id}
                          onPress={() => {
                            setPlaylistOpen(false);
                            setTrackSource("vibespro");
                            if (selected) {
                              player.play();
                              return;
                            }
                            autoplayNext.current = true;
                            setCurrentIndex(index);
                          }}
                          style={({ pressed }) => [
                            styles.playlistItem,
                            isDark && styles.playlistDarkItem,
                            selected && (isDark ? styles.playlistSelectedDark : styles.playlistSelected),
                            pressed && styles.pressed,
                          ]}
                        >
                          <View style={[styles.playlistNumber, selected && styles.playlistNumberSelected]}>
                            {selected && status.playing ? (
                              <Pause color="#ffffff" size={14} />
                            ) : selected ? (
                              <Play color="#ffffff" fill="#ffffff" size={14} />
                            ) : (
                              <Text style={styles.playlistNumberText}>{index + 1}</Text>
                            )}
                          </View>
                          <View style={styles.playlistTrackText}>
                            <Text numberOfLines={1} style={[styles.playlistTrackTitle, isDark && styles.darkText, selected && styles.playlistSelectedText]}>
                              {track.text?.trim() || "Untitled Track"}
                            </Text>
                            <Text numberOfLines={1} style={[styles.playlistArtist, isDark && styles.darkSubtext, selected && styles.playlistSelectedSubtext]}>
                              @{track.username}
                            </Text>
                          </View>
                          {selected ? <Text style={styles.playingLabel}>{status.playing ? "PLAYING" : "SELECTED"}</Text> : null}
                        </Pressable>
                      );
                    })}
                    {tracks.length === 0 ? (
                      <View style={styles.playlistMessage}>
                        <Text style={styles.lockEmoji}>🎵</Text>
                        <Text style={[styles.playlistMessageTitle, isDark && styles.darkTitle]}>No VibesPro Tracks yet</Text>
                      </View>
                    ) : null}
                    {hasMore ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={loadingMore}
                        onPress={() => void loadMore()}
                        style={[styles.playlistLoadMore, isDark && styles.playlistDarkItem]}
                      >
                        {loadingMore ? (
                          <ActivityIndicator color={isDark ? "#fbbf24" : "#0284c7"} />
                        ) : (
                          <Text style={[styles.playlistLoadMoreText, isDark && styles.darkText]}>Load more Tracks</Text>
                        )}
                      </Pressable>
                    ) : null}
                    {feedError ? <Text style={styles.playlistError}>{feedError}</Text> : null}
                  </>
                )}
              </ScrollView>
            </SafeAreaView>
          </LinearGradient>
        </Modal>

        {reportOpen ? (
          <View style={styles.modalRoot}>
            <NativeBlurBackdrop intensity={28} overlayColor="rgba(15,23,42,0.4)" />
            <Pressable disabled={reportBusy} onPress={() => setReportOpen(false)} style={StyleSheet.absoluteFill} />
            <View style={styles.reportCard}>
              <Text style={styles.menuTitle}>Help keep MeToYou safe</Text>
              <Text style={styles.reportDescription}>Why are you reporting this Track?</Text>
              {REPORT_REASONS.map((reason) => (
                <Pressable key={reason} disabled={reportBusy} onPress={() => void submitReport(reason)} style={styles.reportChoice}>
                  <Text style={styles.reportChoiceText}>{reason}</Text>
                </Pressable>
              ))}
              {actionError ? <Text style={styles.actionError}>{actionError}</Text> : null}
              {reportBusy ? <ActivityIndicator color="#0284c7" style={styles.buffering} /> : null}
            </View>
          </View>
        ) : null}

        <NativeConfirmDialog
          confirmLabel="Delete"
          destructive
          emoji="🎵"
          message={`“${shownTrack?.text?.trim() || "Untitled Track"}” will be removed for good. Are you sure?`}
          onCancel={() => setConfirmationVisible(false)}
          onConfirm={deleteTrack}
          title="Delete this Track?"
          visible={confirmationVisible}
        />
        {deleteBusy ? <ActivityIndicator color="#0284c7" style={styles.deleteSpinner} /> : null}
      </NativeBlurTargetContext.Provider>
    </LinearGradient>
  );
}

function MenuButton({
  label,
  icon,
  danger = false,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}>
      {icon}
      <Text style={[styles.menuButtonText, danger && styles.danger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "transparent" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 15, paddingTop: 3, paddingBottom: 12 },
  headerButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.5)", borderRadius: 15, backgroundColor: "rgba(15,23,42,0.4)" },
  backText: { color: "#ffffff", fontSize: 25, fontWeight: "800" },
  heading: { alignItems: "center" },
  kicker: { color: "#0369a1", fontSize: 9, fontWeight: "900", letterSpacing: 3 },
  darkKicker: { color: "#fcd34d" },
  title: { color: "#0f172a", fontSize: 26, fontWeight: "900" },
  darkTitle: { color: "#fde68a" },
  blueSkyText: { color: "#ffffff" },
  themeButtons: { flexDirection: "row", gap: 5 },
  themeButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.6)", borderRadius: 13, backgroundColor: "rgba(255,255,255,0.85)" },
  activeBlue: { borderColor: "#0284c7", backgroundColor: "#0ea5e9" },
  activeGold: { borderColor: "#fcd34d", backgroundColor: "#fbbf24" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingBottom: 76 },
  statusText: { marginTop: 10, color: "#64748b", fontSize: 14, lineHeight: 21, textAlign: "center" },
  errorTitle: { color: "#9f1239", fontSize: 18, fontWeight: "900", textAlign: "center" },
  emptyTitle: { marginTop: 13, color: "#0c4a6e", fontSize: 20, fontWeight: "900", textAlign: "center" },
  lockEmoji: { fontSize: 42 },
  retryButton: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 14, backgroundColor: "#0284c7" },
  retryText: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
  backToFeed: { marginTop: 10, padding: 10 },
  backToFeedText: { color: "#0369a1", fontSize: 13, fontWeight: "800" },
  content: { alignItems: "center", paddingHorizontal: 16, paddingTop: 4 },
  playerCard: { width: "100%", maxWidth: 480, alignItems: "center", padding: 16, borderWidth: 1, borderColor: "#dbeafe", borderRadius: 28, backgroundColor: "rgba(255,255,255,0.92)", shadowColor: "#0c4a6e", shadowOpacity: 0.17, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  darkCard: { borderColor: "rgba(252,211,77,0.2)", backgroundColor: "#151515" },
  blueSkyCard: { borderColor: "#3478bd", backgroundColor: "#0b2d5b" },
  cover: { width: "100%", aspectRatio: 1, overflow: "hidden", alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: "#0f172a" },
  coverFallback: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  coverMenuButton: { position: "absolute", top: 12, right: 12, width: 42, height: 42, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", borderRadius: 21, backgroundColor: "rgba(2,6,23,0.62)" },
  coverMenuText: { color: "#ffffff", fontSize: 18, fontWeight: "900", letterSpacing: 1 },
  artistButton: { marginTop: 18 },
  artist: { color: "#0369a1", fontSize: 14, fontWeight: "800" },
  darkArtist: { color: "#fde68a" },
  trackTitle: { marginTop: 4, color: "#0f172a", fontSize: 23, fontWeight: "900", textAlign: "center" },
  progressSection: { alignSelf: "stretch", marginTop: 23 },
  progressTrack: { height: 14, justifyContent: "center", borderRadius: 10, backgroundColor: "#dbeafe" },
  progressFill: { height: 6, borderRadius: 5, backgroundColor: "#0ea5e9" },
  progressThumb: { position: "absolute", width: 12, height: 12, borderRadius: 6, backgroundColor: "#0369a1" },
  timeRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  timeText: { color: "#64748b", fontSize: 11, fontVariant: ["tabular-nums"] },
  transport: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16 },
  transportButton: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(3,105,161,0.25)", borderRadius: 23 },
  darkTransportButton: { borderColor: "rgba(252,211,77,0.3)" },
  playButton: { width: 62, height: 62, alignItems: "center", justifyContent: "center", borderRadius: 31, backgroundColor: "#0ea5e9" },
  darkPlayButton: { backgroundColor: "#fbbf24" },
  audioStatus: { marginTop: 8, color: "#64748b", fontSize: 11 },
  actionError: { marginTop: 10, color: "#be123c", fontSize: 12, lineHeight: 18, textAlign: "center" },
  buffering: { marginTop: 10 },
  engagement: { flexDirection: "row", alignSelf: "stretch", justifyContent: "space-between", marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: "rgba(15,23,42,0.1)" },
  darkEngagement: { borderTopColor: "rgba(255,255,255,0.12)" },
  engagementButton: { minWidth: 76, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 5 },
  likeIcon: { fontSize: 20 },
  engagementCount: { color: "#0369a1", fontSize: 14, fontWeight: "800" },
  darkText: { color: "#fde68a" },
  loadMoreButton: { minHeight: 46, minWidth: 180, alignItems: "center", justifyContent: "center", marginTop: 16, paddingHorizontal: 18, borderRadius: 24, backgroundColor: "#0f172a" },
  loadMoreText: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
  modalRoot: { ...StyleSheet.absoluteFill, zIndex: 100, alignItems: "center", justifyContent: "center", padding: 20 },
  actionMenu: { width: "100%", maxWidth: 360, padding: 18, borderWidth: 1, borderColor: "#bae6fd", borderRadius: 26, backgroundColor: "#ffffff", shadowColor: "#075985", shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  actionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  menuTitle: { color: "#0c4a6e", fontSize: 18, fontWeight: "900" },
  closeText: { color: "#64748b", fontSize: 27, lineHeight: 31 },
  playlistScreen: { flex: 1 },
  playlistSafeArea: { flex: 1, paddingHorizontal: 18 },
  playlistHeader: { minHeight: 88, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: "rgba(15,23,42,0.12)" },
  playlistClose: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#bae6fd", borderRadius: 16, backgroundColor: "rgba(255,255,255,0.8)" },
  playlistCloseDark: { borderColor: "rgba(252,211,77,0.35)", backgroundColor: "rgba(255,255,255,0.08)" },
  playlistKicker: { color: "#0284c7", fontSize: 9, fontWeight: "900", letterSpacing: 2 },
  playlistTitle: { marginTop: 3, color: "#0c4a6e", fontSize: 24, fontWeight: "900" },
  playlistSubtitle: { marginTop: 3, color: "#64748b", fontSize: 12 },
  playlistTabs: { flexDirection: "row", gap: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(15,23,42,0.08)" },
  playlistTab: { minHeight: 40, flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, borderWidth: 1, borderColor: "#bae6fd", borderRadius: 14, backgroundColor: "rgba(255,255,255,0.45)" },
  playlistTabActive: { borderColor: "#0284c7", backgroundColor: "#e0f2fe" },
  playlistTabActiveDark: { borderColor: "#fbbf24", backgroundColor: "rgba(251,191,36,0.14)" },
  playlistTabText: { color: "#64748b", fontSize: 12, fontWeight: "800", textAlign: "center" },
  playlistTabTextActive: { color: "#0369a1" },
  playlistTabTextActiveDark: { color: "#fde68a" },
  playlistScroll: { flex: 1 },
  playlistItems: { gap: 9, paddingTop: 15, paddingBottom: 24 },
  playlistMessage: { alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 22, paddingVertical: 28 },
  playlistMessageTitle: { color: "#0c4a6e", fontSize: 17, fontWeight: "900", textAlign: "center" },
  playlistMessageText: { color: "#64748b", fontSize: 13, lineHeight: 19, textAlign: "center" },
  playlistPermissionButton: { minHeight: 42, alignItems: "center", justifyContent: "center", marginTop: 4, paddingHorizontal: 16, borderRadius: 14, backgroundColor: "#0284c7" },
  playlistPermissionRetry: { minHeight: 40, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  playlistItem: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 15, backgroundColor: "#f8fdff" },
  playlistDarkItem: { borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.05)" },
  playlistSelected: { borderColor: "#7dd3fc", backgroundColor: "#e0f2fe" },
  playlistSelectedDark: { borderColor: "#fbbf24", backgroundColor: "rgba(251,191,36,0.12)" },
  playlistNumber: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#e2e8f0" },
  playlistNumberSelected: { backgroundColor: "#0284c7" },
  playlistNumberText: { color: "#475569", fontSize: 12, fontWeight: "800" },
  playlistTrackText: { flex: 1, minWidth: 0 },
  playlistTrackTitle: { color: "#0f172a", fontSize: 13, fontWeight: "800" },
  playlistArtist: { marginTop: 3, color: "#64748b", fontSize: 11 },
  playlistSelectedText: { color: "#0369a1" },
  playlistSelectedSubtext: { color: "#0284c7" },
  playingLabel: { color: "#0284c7", fontSize: 8, fontWeight: "900", letterSpacing: 0.7 },
  playlistLoadMore: { minHeight: 45, alignItems: "center", justifyContent: "center", marginTop: 2, borderWidth: 1, borderColor: "#bae6fd", borderRadius: 14, backgroundColor: "#f0f9ff" },
  playlistLoadMoreText: { color: "#0369a1", fontSize: 12, fontWeight: "800" },
  playlistError: { padding: 10, color: "#be123c", fontSize: 12, textAlign: "center" },
  darkSubtext: { color: "#94a3b8" },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  menuButton: { width: "48%", minHeight: 76, flexGrow: 1, alignItems: "center", justifyContent: "center", gap: 6, padding: 8, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 15, backgroundColor: "#f8fdff" },
  menuButtonText: { color: "#334155", fontSize: 11, fontWeight: "800", textAlign: "center" },
  danger: { color: "#e11d48" },
  reportCard: { width: "100%", maxWidth: 370, padding: 20, borderWidth: 1, borderColor: "#bae6fd", borderRadius: 25, backgroundColor: "#ffffff" },
  reportDescription: { marginTop: 7, marginBottom: 14, color: "#64748b", fontSize: 13 },
  reportChoice: { minHeight: 47, justifyContent: "center", marginTop: 7, paddingHorizontal: 13, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 13, backgroundColor: "#f8fdff" },
  reportChoiceText: { color: "#334155", fontSize: 13, fontWeight: "700" },
  deleteSpinner: { position: "absolute", bottom: 104, alignSelf: "center" },
  pressed: { opacity: 0.75 },
});
