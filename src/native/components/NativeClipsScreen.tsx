import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewToken,
} from "react-native";
import { File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library/legacy";
import { LinearGradient } from "expo-linear-gradient";
import { BlurTargetView } from "expo-blur";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import { useNativeAuth } from "../contexts/NativeAuthProvider";
import { useNativeEntitlement } from "../contexts/NativeEntitlementProvider";
import { NATIVE_THEME_COLORS, useNativeTheme } from "../contexts/NativeThemeProvider";
import {
  fetchNativeClipById,
  fetchNativeClipsPage,
  hydrateNativeClipLikes,
  NATIVE_CLIPS_PAGE_SIZE,
  repostNativeClip,
  type NativeClip,
} from "../lib/clips";
import {
  blockNativeUser,
  deleteNativePost,
  reportNativePost,
  toggleNativePostLike,
} from "../lib/posts";
import NativeBlurBackdrop, { NativeBlurTargetContext } from "./NativeBlurBackdrop";
import NativeClipCard from "./NativeClipCard";
import NativeCommentsSheet from "./NativeCommentsSheet";
import NativeConfirmDialog from "./NativeConfirmDialog";
import { NativeVerticalMediaSkeleton } from "./NativeScreenSkeletons";
import NativeSurfaceDock, { NATIVE_SURFACE_DOCK_HEIGHT, useNativeSurfaceDockVisibility } from "./NativeSurfaceDock";

const REPORT_REASONS = [
  "Bullying or abuse",
  "Adult Content",
  "Fraud or Scam",
  "I don't just wanna see this",
] as const;

type Confirmation = { type: "delete" | "block"; clip: NativeClip } | null;

export default function NativeClipsScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const blurTargetRef = useRef<View | null>(null);
  const { session } = useNativeAuth();
  const { entitlement, refresh: refreshEntitlement } = useNativeEntitlement();
  const { theme, setTheme } = useNativeTheme();
  const darkTheme = theme === "dark";
  const userId = session?.user.id;
  const params = useLocalSearchParams<{ postId?: string | string[]; showComments?: string | string[] }>();
  const requestedPostId = Array.isArray(params.postId) ? params.postId[0] : params.postId;
  const requestedShowComments =
    (Array.isArray(params.showComments) ? params.showComments[0] : params.showComments) === "1";
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const listRef = useRef<FlatList<NativeClip>>(null);
  const requestGeneration = useRef(0);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);
  const likingClipIds = useRef(new Set<string>());
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 75 }).current;
  const [pageHeight, setPageHeight] = useState(
    Math.max(1, window.height - insets.top - insets.bottom - NATIVE_SURFACE_DOCK_HEIGHT),
  );
  const [clips, setClips] = useState<NativeClip[]>([]);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const isVibesPro = entitlement.status === "vibesPro";
  const [commentsClipId, setCommentsClipId] = useState<string | null>(
    () => requestedPostId && requestedShowComments ? requestedPostId : null,
  );
  const [menuClip, setMenuClip] = useState<NativeClip | null>(null);
  const [reportClip, setReportClip] = useState<NativeClip | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [blockedAuthorIds, setBlockedAuthorIds] = useState<Set<string>>(() => new Set());
  const { visible: dockVisible, onScroll: handleDockScroll } = useNativeSurfaceDockVisibility();

  const loadFirstPage = useCallback(async (refresh = false) => {
    if (!userId || !isVibesPro || requestedPostId) return;
    const generation = ++requestGeneration.current;
    loadingMoreRef.current = false;
    hasMoreRef.current = true;
    setHasMore(true);
    setLoadingMore(false);
    setFeedError(null);
    setInitialLoading(!refresh);
    setRefreshing(refresh);
    try {
      const rows = await fetchNativeClipsPage();
      if (requestGeneration.current !== generation) return;
      const hydrated = await hydrateNativeClipLikes(rows, userId);
      if (requestGeneration.current !== generation) return;
      setClips(hydrated);
      setActiveClipId(hydrated[0]?.id ?? null);
      const nextHasMore = rows.length === NATIVE_CLIPS_PAGE_SIZE;
      hasMoreRef.current = nextHasMore;
      setHasMore(nextHasMore);
    } catch (cause) {
      if (requestGeneration.current === generation) {
        setFeedError(cause instanceof Error ? cause.message : "Unable to load Clips right now.");
      }
    } finally {
      if (requestGeneration.current === generation) {
        setInitialLoading(false);
        setRefreshing(false);
      }
    }
  }, [isVibesPro, requestedPostId, userId]);

  useEffect(() => {
    if (isVibesPro && !requestedPostId) void loadFirstPage();
    else if (!requestedPostId) {
      setClips([]);
      setInitialLoading(false);
    }
    return () => {
      requestGeneration.current += 1;
    };
  }, [isVibesPro, loadFirstPage, requestedPostId]);

  useEffect(() => {
    if (!requestedPostId || !userId) return;
    let active = true;
    setInitialLoading(true);
    setFeedError(null);
    void (async () => {
      try {
        const clip = await fetchNativeClipById(requestedPostId);
        if (!clip) throw new Error("Unable to find this Clip.");
        const [hydrated] = await hydrateNativeClipLikes([clip], userId);
        if (!active) return;
        setClips([hydrated ?? clip]);
        setActiveClipId(clip.id);
        if (requestedShowComments) setCommentsClipId(clip.id);
      } catch (cause) {
        if (active) {
          setFeedError(cause instanceof Error ? cause.message : "Unable to load this Clip.");
        }
      } finally {
        if (active) setInitialLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [requestedPostId, requestedShowComments, userId]);

  const loadMore = useCallback(async () => {
    if (!userId || !hasMoreRef.current || loadingMoreRef.current || clips.length === 0) return;
    const generation = requestGeneration.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setFeedError(null);
    try {
      const rows = await fetchNativeClipsPage(clips[clips.length - 1].created_at);
      if (requestGeneration.current !== generation) return;
      const hydrated = await hydrateNativeClipLikes(rows, userId);
      if (requestGeneration.current !== generation) return;
      setClips((current) => {
        const seen = new Set(current.map((clip) => clip.id));
        return [...current, ...hydrated.filter((clip) => !seen.has(clip.id))];
      });
      const nextHasMore = rows.length === NATIVE_CLIPS_PAGE_SIZE;
      hasMoreRef.current = nextHasMore;
      setHasMore(nextHasMore);
    } catch (cause) {
      setFeedError(cause instanceof Error ? cause.message : "Unable to load more Clips.");
    } finally {
      if (requestGeneration.current === generation) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [clips, userId]);

  const handleViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<NativeClip>[] }) => {
      const active = viewableItems.find((token) => token.isViewable)?.item;
      if (active) setActiveClipId(active.id);
    },
  ).current;

  const updateClip = (clipId: string, update: Partial<NativeClip>) => {
    setClips((current) =>
      current.map((clip) => clip.id === clipId ? { ...clip, ...update } : clip),
    );
  };

  const toggleLike = async (clip: NativeClip) => {
    if (!userId || likingClipIds.current.has(clip.id)) return;
    likingClipIds.current.add(clip.id);
    const previousLiked = clip.liked;
    const previousLikesCount = clip.likes_count;
    updateClip(clip.id, {
      liked: !previousLiked,
      likes_count: Math.max(0, previousLikesCount + (previousLiked ? -1 : 1)),
    });
    try {
      const result = await toggleNativePostLike(clip.id, userId);
      updateClip(clip.id, { liked: result.liked, likes_count: result.likesCount });
    } catch (cause) {
      updateClip(clip.id, { liked: previousLiked, likes_count: previousLikesCount });
      Alert.alert("Could not update like", cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      likingClipIds.current.delete(clip.id);
    }
  };

  const confirmAction = async () => {
    if (!confirmation) return;
    const { type, clip } = confirmation;
    if (type === "delete") {
      await deleteNativePost(clip.id);
      setClips((current) => current.filter((item) => item.id !== clip.id));
      if (activeClipId === clip.id) {
        const index = clips.findIndex((item) => item.id === clip.id);
        const nextClip = clips[index + 1] ?? clips[index - 1];
        setActiveClipId(nextClip?.id ?? null);
      }
    } else {
      await blockNativeUser(clip.author_id);
      setBlockedAuthorIds((current) => new Set(current).add(clip.author_id));
      setClips((current) => current.filter((item) => item.author_id !== clip.author_id));
      setActiveClipId((current) =>
        clips.find((item) => item.id === current && item.author_id !== clip.author_id)?.id ??
        clips.find((item) => item.author_id !== clip.author_id)?.id ?? null,
      );
    }
    setConfirmation(null);
    setMenuClip(null);
  };

  const saveClipToDevice = async (clip: NativeClip) => {
    const permission = await MediaLibrary.requestPermissionsAsync(true, ["video"]);
    if (!permission.granted) {
      throw new Error("Allow MeToYou to save videos to your device.");
    }
    const file = await File.downloadFileAsync(
      clip.video_url,
      new File(Paths.cache, `metoyou-clip-${clip.id}.mp4`),
      { idempotent: true },
    );
    await MediaLibrary.createAssetAsync(file.uri);
    Alert.alert("Clip saved", "The video is now in your device's media library.");
  };

  const shareClip = async (clip: NativeClip) => {
    await Share.share({
      title: `${clip.username}'s Clip`,
      message: [clip.text, clip.video_url].filter(Boolean).join("\n\n"),
    });
  };

  const runClipAction = async (action: () => Promise<void>) => {
    setActionError(null);
    try {
      await action();
      setMenuClip(null);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "That action could not be completed.");
    }
  };

  const submitReport = async (reason: string) => {
    if (!reportClip) return;
    setReportBusy(true);
    try {
      await reportNativePost({
        postId: reportClip.id,
        authorId: reportClip.author_id,
        reason,
      });
      setReportClip(null);
      Alert.alert("Report sent", "Thanks for helping keep MeToYou safe.");
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "The report could not be submitted.");
    } finally {
      setReportBusy(false);
    }
  };

  const visibleClips = clips.filter((clip) => !blockedAuthorIds.has(clip.author_id));

  return (
    <LinearGradient
      colors={NATIVE_THEME_COLORS[theme].background}
      style={styles.root}
    >
      <NativeBlurTargetContext.Provider value={blurTargetRef}>
      <SafeAreaView
        edges={["top", "bottom"]}
        style={styles.safeArea}
      >
        <BlurTargetView ref={blurTargetRef} style={styles.safeArea}>
        {entitlement.status === "loading" || entitlement.status === "unknown" ? (
          <View style={styles.center}>
            <ActivityIndicator color="#0284c7" size="large" />
            <Text style={styles.statusText}>Checking your VibesPro access…</Text>
          </View>
        ) : entitlement.status === "error" ? (
          <View style={styles.center}>
            <Text style={styles.errorTitle}>Couldn’t check access</Text>
            <Text style={styles.statusText}>{entitlement.error.message}</Text>
            <Pressable onPress={() => void refreshEntitlement()} style={styles.retryButton}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
            <Pressable onPress={() => router.navigate("/(app)/(tabs)")} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Back to Feed</Text>
            </Pressable>
          </View>
        ) : entitlement.status === "free" ? (
          <View style={styles.center}>
            <Text style={styles.lockEmoji}>🔒</Text>
            <Text style={styles.gateTitle}>Clips are a VibesPro space</Text>
            <Text style={styles.statusText}>VibesPro access is required to watch Clips.</Text>
            <Pressable onPress={() => router.navigate("/(app)/(tabs)")} style={styles.retryButton}>
              <Text style={styles.retryText}>Back to Feed</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <FlatList
              data={visibleClips}
              extraData={[activeClipId, commentsClipId, menuClip?.id, reportClip?.id, confirmation?.clip.id]}
              getItemLayout={(_, index) => ({ length: pageHeight, offset: pageHeight * index, index })}
              keyExtractor={(clip) => clip.id}
              onEndReached={hasMore && !requestedPostId ? () => void loadMore() : undefined}
              onEndReachedThreshold={0.4}
              onLayout={(event) => setPageHeight(event.nativeEvent.layout.height)}
              onScroll={handleDockScroll}
              scrollEventThrottle={100}
              onViewableItemsChanged={handleViewableItemsChanged}
              pagingEnabled
              refreshControl={requestedPostId ? undefined : (
                <RefreshControl
                  colors={["#0284c7"]}
                  onRefresh={() => void loadFirstPage(true)}
                  refreshing={refreshing}
                  tintColor="#0284c7"
                />
              )}
              ref={listRef}
              renderItem={({ item }) => (
                <NativeClipCard
                  active={isFocused && activeClipId === item.id}
                  clip={item}
                  height={pageHeight}
                  onActions={() => {
                    setActionError(null);
                    setMenuClip(item);
                  }}
                  onComments={() => setCommentsClipId(item.id)}
                  onLike={() => void toggleLike(item)}
                  onProfile={() => router.push({
                    pathname: "/(app)/profile/[username]",
                    params: { username: item.username },
                  })}
                  paused={
                    commentsClipId === item.id ||
                    menuClip?.id === item.id ||
                    reportClip?.id === item.id ||
                    confirmation?.clip.id === item.id
                  }
                />
              )}
              showsVerticalScrollIndicator={false}
              style={styles.list}
              viewabilityConfig={viewabilityConfig}
              windowSize={3}
              initialNumToRender={1}
              maxToRenderPerBatch={2}
              removeClippedSubviews={false}
              ListEmptyComponent={
                initialLoading ? (
                  <NativeVerticalMediaSkeleton height={pageHeight} />
                ) : feedError ? (
                  <View style={[styles.center, { height: pageHeight }]}>
                    <Text style={styles.errorTitle}>Clips didn’t load</Text>
                    <Text style={styles.statusText}>{feedError}</Text>
                    <Pressable onPress={() => void loadFirstPage()} style={styles.retryButton}>
                      <Text style={styles.retryText}>Try again</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={[styles.center, { height: pageHeight }]}>
                    <Text style={styles.lockEmoji}>🎬</Text>
                    <Text style={styles.gateTitle}>No Clips yet</Text>
                    <Text style={styles.statusText}>There aren’t any Clips to watch right now.</Text>
                  </View>
                )
              }
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.loadingFooter}>
                    <ActivityIndicator color="#0284c7" />
                    <Text style={styles.statusText}>Loading more Clips…</Text>
                  </View>
                ) : feedError && visibleClips.length > 0 ? (
                  <Pressable onPress={() => void loadMore()} style={styles.loadingFooter}>
                    <Text style={styles.errorTitle}>{feedError}</Text>
                    <Text style={styles.retryText}>Tap to retry</Text>
                  </Pressable>
                ) : null
              }
            />

            <View pointerEvents="box-none" style={styles.header}>
              <Pressable accessibilityLabel="Back to Feed" onPress={() => router.navigate("/(app)/(tabs)")} style={styles.headerButton}>
                <Text style={styles.headerButtonText}>‹</Text>
              </Pressable>
              <View style={styles.heading}>
                <Text style={styles.kicker}>VIBESPRO</Text>
                <Text style={[styles.title, darkTheme && styles.darkTitle]}>Clips</Text>
              </View>
              <Pressable accessibilityLabel="Toggle app theme" onPress={() => void setTheme(darkTheme ? "bluesky" : "dark")} style={styles.headerButton}>
                <Text style={styles.headerButtonText}>{darkTheme ? "☀" : "☾"}</Text>
              </Pressable>
            </View>

            {loadingMore ? (
              <ActivityIndicator color="#ffffff" size="small" style={styles.headerSpinner} />
            ) : null}
            <NativeSurfaceDock
              activeSurface="clips"
              onClipsPress={() => {
                if (requestedPostId) router.replace("/(app)/(tabs)/clips");
                else listRef.current?.scrollToOffset({ offset: 0, animated: true });
              }}
              onFeedPress={() => router.navigate("/(app)/(tabs)")}
              visible={dockVisible}
            />

            {commentsClipId ? (
              <NativeCommentsSheet
                onClose={() => setCommentsClipId(null)}
                onCountChange={(count) => {
                  const clip = clips.find((item) => item.id === commentsClipId);
                  if (clip) updateClip(clip.id, { comments_count: count });
                }}
                postId={commentsClipId}
                visible
              />
            ) : null}
          </>
        )}
        </BlurTargetView>
      </SafeAreaView>

      {menuClip ? (
        <View style={styles.modalRoot}>
          <NativeBlurBackdrop intensity={24} overlayColor="rgba(15,23,42,0.38)" />
          <Pressable onPress={() => setMenuClip(null)} style={StyleSheet.absoluteFill} />
          <View style={styles.actionMenu}>
            <View style={styles.actionHeader}>
              <Text style={styles.actionTitle}>Clip actions</Text>
              <Pressable accessibilityLabel="Close Clip actions" onPress={() => setMenuClip(null)}>
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>
            {actionError ? <Text style={styles.actionError}>{actionError}</Text> : null}
            <View style={styles.actionGrid}>
              <MenuButton label="Share" icon="↗" onPress={() => void runClipAction(() => shareClip(menuClip))} />
              <MenuButton label="Save to device" icon="⇩" onPress={() => void runClipAction(() => saveClipToDevice(menuClip))} />
              <MenuButton label="Repost to Feed" icon="↻" onPress={() => void runClipAction(() => repostNativeClip(menuClip, userId ?? ""))} />
              {menuClip.author_id === userId ? (
                <MenuButton danger label="Delete Clip" icon="⌫" onPress={() => {
                  setConfirmation({ type: "delete", clip: menuClip });
                  setMenuClip(null);
                }} />
              ) : (
                <>
                  <MenuButton label="Report" icon="⚑" onPress={() => {
                    setReportClip(menuClip);
                    setMenuClip(null);
                  }} />
                  <MenuButton danger label="Block author" icon="⊘" onPress={() => {
                    setConfirmation({ type: "block", clip: menuClip });
                    setMenuClip(null);
                  }} />
                </>
              )}
            </View>
          </View>
        </View>
      ) : null}

      {reportClip ? (
        <View style={styles.modalRoot}>
          <NativeBlurBackdrop intensity={28} overlayColor="rgba(15,23,42,0.4)" />
          <Pressable disabled={reportBusy} onPress={() => setReportClip(null)} style={StyleSheet.absoluteFill} />
          <View style={styles.reportCard}>
            <Text style={styles.actionTitle}>Help keep MeToYou safe</Text>
            <Text style={styles.reportDescription}>Why are you reporting this Clip?</Text>
            {REPORT_REASONS.map((reason) => (
              <Pressable
                key={reason}
                disabled={reportBusy}
                onPress={() => void submitReport(reason)}
                style={styles.reportChoice}
              >
                <Text style={styles.reportChoiceText}>{reason}</Text>
              </Pressable>
            ))}
            {actionError ? <Text style={styles.actionError}>{actionError}</Text> : null}
            {reportBusy ? <ActivityIndicator color="#0284c7" style={styles.reportSpinner} /> : null}
          </View>
        </View>
      ) : null}

      <NativeConfirmDialog
        confirmLabel={confirmation?.type === "delete" ? "Delete" : "Block"}
        destructive
        emoji={confirmation?.type === "delete" ? "🎬" : "🫶"}
        message={
          confirmation?.type === "delete"
            ? "This Clip will be removed for good. Are you sure?"
            : "Their Clips will no longer appear in your feed."
        }
        onCancel={() => setConfirmation(null)}
        onConfirm={confirmAction}
        title={confirmation?.type === "delete" ? "Delete this Clip?" : "Block this author?"}
        visible={confirmation !== null}
      />
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
  icon: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}
    >
      <Text style={[styles.menuIcon, danger && styles.danger]}>{icon}</Text>
      <Text style={[styles.menuLabel, danger && styles.danger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "transparent" },
  list: { flex: 1, marginBottom: NATIVE_SURFACE_DOCK_HEIGHT },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  statusText: { marginTop: 10, color: "#64748b", fontSize: 14, lineHeight: 21, textAlign: "center" },
  loadingText: { marginTop: 12, color: "#ffffff", fontSize: 14, fontWeight: "700" },
  errorTitle: { color: "#9f1239", fontSize: 17, fontWeight: "900", textAlign: "center" },
  retryButton: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 14, backgroundColor: "#0284c7" },
  retryText: { color: "#ffffff", fontSize: 13, fontWeight: "800", textAlign: "center" },
  secondaryButton: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10 },
  secondaryButtonText: { color: "#0369a1", fontSize: 13, fontWeight: "800" },
  lockEmoji: { fontSize: 42 },
  gateTitle: { marginTop: 12, color: "#0c4a6e", fontSize: 20, fontWeight: "900", textAlign: "center" },
  header: {
    position: "absolute",
    top: 8,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.48)",
    borderRadius: 15,
    backgroundColor: "rgba(15,23,42,0.42)",
  },
  headerButtonText: { color: "#ffffff", fontSize: 25, fontWeight: "800" },
  heading: { alignItems: "center" },
  kicker: { color: "#fde68a", fontSize: 9, fontWeight: "900", letterSpacing: 3 },
  title: { color: "#ffffff", fontSize: 25, fontWeight: "900", textShadowColor: "#000000", textShadowRadius: 9 },
  darkTitle: { color: "#fde68a" },
  headerSpinner: { position: "absolute", top: 59, right: 20, zIndex: 21 },
  loadingFooter: { alignItems: "center", gap: 8, padding: 20, backgroundColor: "#eff6ff" },
  modalRoot: { ...StyleSheet.absoluteFill, zIndex: 100, alignItems: "center", justifyContent: "center", padding: 20 },
  actionMenu: {
    width: "100%",
    maxWidth: 360,
    padding: 18,
    borderWidth: 1,
    borderColor: "#bae6fd",
    borderRadius: 26,
    backgroundColor: "#ffffff",
    shadowColor: "#075985",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  actionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  actionTitle: { color: "#0c4a6e", fontSize: 18, fontWeight: "900" },
  closeText: { color: "#64748b", fontSize: 27, lineHeight: 31 },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  menuButton: {
    width: "48%",
    minHeight: 76,
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 15,
    backgroundColor: "#f8fdff",
  },
  menuIcon: { color: "#0369a1", fontSize: 21, fontWeight: "900" },
  menuLabel: { color: "#334155", fontSize: 11, fontWeight: "800", textAlign: "center" },
  danger: { color: "#e11d48" },
  actionError: { marginBottom: 10, color: "#be123c", fontSize: 13, lineHeight: 19 },
  reportCard: {
    width: "100%",
    maxWidth: 370,
    padding: 20,
    borderWidth: 1,
    borderColor: "#bae6fd",
    borderRadius: 25,
    backgroundColor: "#ffffff",
  },
  reportDescription: { marginTop: 7, marginBottom: 14, color: "#64748b", fontSize: 13 },
  reportChoice: { minHeight: 47, justifyContent: "center", marginTop: 7, paddingHorizontal: 13, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 13, backgroundColor: "#f8fdff" },
  reportChoiceText: { color: "#334155", fontSize: 13, fontWeight: "700" },
  reportSpinner: { marginTop: 12 },
  pressed: { opacity: 0.75 },
});
