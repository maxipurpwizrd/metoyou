import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library/legacy";
import { LinearGradient } from "expo-linear-gradient";
import { BlurTargetView } from "expo-blur";
import * as ExpoLinking from "expo-linking";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ban, CloudSun, Download, Flag, MessageCircle, MoonStar, Repeat2, Share2, Trash2 } from "lucide-react-native";
import { useNativeAuth } from "../contexts/NativeAuthProvider";
import { NATIVE_THEME_COLORS, useNativeTheme } from "../contexts/NativeThemeProvider";
import {
  fetchNativeFlickById,
  fetchNativeFlicksPage,
  hydrateNativeFlickLikes,
  NATIVE_FLICKS_PAGE_SIZE,
  repostNativeFlick,
  type NativeFlick,
} from "../lib/flicks";
import { blockNativeUser, deleteNativePost, reportNativePost, toggleNativePostLike } from "../lib/posts";
import NativeBlurBackdrop, { NativeBlurTargetContext } from "./NativeBlurBackdrop";
import NativeCommentsSheet from "./NativeCommentsSheet";
import NativeConfirmDialog from "./NativeConfirmDialog";
import NativeSurfaceDock, { useNativeSurfaceDockVisibility } from "./NativeSurfaceDock";

const REPORT_REASONS = [
  "Bullying or abuse",
  "Adult Content",
  "Fraud or Scam",
  "I don't just wanna see this",
] as const;

type Confirmation = { type: "delete" | "block"; flick: NativeFlick } | null;

function errorMessage(cause: unknown, fallback: string) {
  if (cause instanceof Error) return cause.message;
  if (cause && typeof cause === "object" && "message" in cause && typeof cause.message === "string") {
    return cause.message;
  }
  return fallback;
}

export default function NativeFlicksScreen() {
  const router = useRouter();
  const { session } = useNativeAuth();
  const { theme, setTheme } = useNativeTheme();
  const userId = session?.user.id;
  const params = useLocalSearchParams<{
    postId?: string | string[];
    image?: string | string[];
    showComments?: string | string[];
  }>();
  const requestedPostId = Array.isArray(params.postId) ? params.postId[0] : params.postId;
  const requestedImage = Array.isArray(params.image) ? params.image[0] : params.image;
  const requestedShowComments =
    (Array.isArray(params.showComments) ? params.showComments[0] : params.showComments) === "1";
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const blurTargetRef = useRef<View | null>(null);
  const listRef = useRef<FlatList<NativeFlick>>(null);
  const requestGeneration = useRef(0);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);
  const likingFlickIds = useRef(new Set<string>());
  const [pageHeight, setPageHeight] = useState(Math.max(1, window.height - insets.top - insets.bottom));
  const [flicks, setFlicks] = useState<NativeFlick[]>([]);
  const [focusedFlick, setFocusedFlick] = useState<NativeFlick | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [focusedLoading, setFocusedLoading] = useState(Boolean(requestedPostId));
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [expandedCaptions, setExpandedCaptions] = useState<Set<string>>(new Set());
  const [commentsFlickId, setCommentsFlickId] = useState<string | null>(null);
  const [menuFlick, setMenuFlick] = useState<NativeFlick | null>(null);
  const [reportFlick, setReportFlick] = useState<NativeFlick | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const { visible: dockVisible, onScroll: handleDockScroll } = useNativeSurfaceDockVisibility();
  const [imageViewer, setImageViewer] = useState<string | null>(requestedImage ?? null);

  const loadFirstPage = useCallback(async (refresh = false) => {
    if (!userId || requestedPostId) return;
    const generation = ++requestGeneration.current;
    loadingMoreRef.current = false;
    hasMoreRef.current = true;
    setHasMore(true);
    setLoadingMore(false);
    setFeedError(null);
    setInitialLoading(!refresh);
    setRefreshing(refresh);
    try {
      const rows = await fetchNativeFlicksPage();
      if (requestGeneration.current !== generation) return;
      const hydrated = await hydrateNativeFlickLikes(rows, userId);
      if (requestGeneration.current !== generation) return;
      setFlicks(hydrated);
      const nextHasMore = rows.length === NATIVE_FLICKS_PAGE_SIZE;
      hasMoreRef.current = nextHasMore;
      setHasMore(nextHasMore);
    } catch (cause) {
      if (requestGeneration.current === generation) {
        setFeedError(errorMessage(cause, "Unable to load Flicks. Check your connection and try again."));
      }
    } finally {
      if (requestGeneration.current === generation) {
        setInitialLoading(false);
        setRefreshing(false);
      }
    }
  }, [requestedPostId, userId]);

  useEffect(() => {
    if (requestedPostId) {
      let active = true;
      setFocusedFlick(null);
      setFocusedLoading(true);
      setFeedError(null);
      void (async () => {
        try {
          const flick = await fetchNativeFlickById(requestedPostId);
          if (!flick) throw new Error("Unable to find this Flick.");
          const [hydrated] = userId ? await hydrateNativeFlickLikes([flick], userId) : [flick];
          if (active) {
            setFocusedFlick(hydrated ?? flick);
            if (requestedShowComments) setCommentsFlickId(flick.id);
          }
        } catch (cause) {
          if (active) setFeedError(errorMessage(cause, "Unable to load this Flick."));
        } finally {
          if (active) setFocusedLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }

    void loadFirstPage();
    return () => {
      requestGeneration.current += 1;
    };
  }, [loadFirstPage, requestedPostId, requestedShowComments, userId]);

  const loadMore = useCallback(async () => {
    if (!userId || requestedPostId || !hasMoreRef.current || loadingMoreRef.current || flicks.length === 0) return;
    const generation = requestGeneration.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setFeedError(null);
    try {
      const rows = await fetchNativeFlicksPage(flicks[flicks.length - 1].created_at);
      if (requestGeneration.current !== generation) return;
      const hydrated = await hydrateNativeFlickLikes(rows, userId);
      if (requestGeneration.current !== generation) return;
      setFlicks((current) => {
        const seen = new Set(current.map((flick) => flick.id));
        return [...current, ...hydrated.filter((flick) => !seen.has(flick.id))];
      });
      const nextHasMore = rows.length === NATIVE_FLICKS_PAGE_SIZE;
      hasMoreRef.current = nextHasMore;
      setHasMore(nextHasMore);
    } catch (cause) {
      if (requestGeneration.current === generation) {
        setFeedError(errorMessage(cause, "Unable to load more Flicks."));
      }
    } finally {
      if (requestGeneration.current === generation) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [flicks, requestedPostId, userId]);

  const updateFlick = useCallback((flickId: string, update: Partial<NativeFlick>) => {
    setFlicks((current) => current.map((flick) => flick.id === flickId ? { ...flick, ...update } : flick));
    setFocusedFlick((current) => current?.id === flickId ? { ...current, ...update } : current);
  }, []);

  const toggleLike = async (flick: NativeFlick) => {
    if (!userId || likingFlickIds.current.has(flick.id)) return;
    likingFlickIds.current.add(flick.id);
    try {
      const result = await toggleNativePostLike(flick.id, userId);
      updateFlick(flick.id, { liked: result.liked, likes_count: result.likesCount });
    } catch (cause) {
      setActionError(errorMessage(cause, "Unable to update this Flick right now."));
    } finally {
      likingFlickIds.current.delete(flick.id);
    }
  };

  const saveFlickToDevice = async (flick: NativeFlick) => {
    const permission = await MediaLibrary.requestPermissionsAsync(true, ["photo"]);
    if (!permission.granted) throw new Error("Allow MeToYou to save images to your device.");
    const imageUrl = flick.image_original_url ?? flick.image_url;
    const file = await File.downloadFileAsync(
      imageUrl,
      new File(Paths.cache, `metoyou-flick-${flick.id}.jpg`),
      { idempotent: true },
    );
    await MediaLibrary.createAssetAsync(file.uri);
    Alert.alert("Flick saved", "The image is now in your device's photo library.");
  };

  const shareFlick = async (flick: NativeFlick) => {
    const url = ExpoLinking.createURL("flicks", { queryParams: { postId: flick.id } });
    await Share.share({
      title: `${flick.username}'s Flick`,
      message: [flick.text, url].filter(Boolean).join("\n\n"),
    });
  };

  const runFlickAction = async (action: () => Promise<void>) => {
    setActionError(null);
    try {
      await action();
      setMenuFlick(null);
    } catch (cause) {
      setActionError(errorMessage(cause, "That action could not be completed."));
    }
  };

  const submitReport = async (reason: string) => {
    if (!reportFlick) return;
    setReportBusy(true);
    setActionError(null);
    try {
      await reportNativePost({ postId: reportFlick.id, authorId: reportFlick.author_id, reason });
      setReportFlick(null);
      Alert.alert("Report sent", "Thanks for helping keep MeToYou safe.");
    } catch (cause) {
      setActionError(errorMessage(cause, "The report could not be submitted."));
    } finally {
      setReportBusy(false);
    }
  };

  const confirmAction = async () => {
    if (!confirmation) return;
    const { type, flick } = confirmation;
    if (type === "delete") {
      await deleteNativePost(flick.id);
      setFlicks((current) => current.filter((item) => item.id !== flick.id));
      setFocusedFlick((current) => current?.id === flick.id ? null : current);
    } else {
      await blockNativeUser(flick.author_id);
      setFlicks((current) => current.filter((item) => item.author_id !== flick.author_id));
      setFocusedFlick((current) => current?.author_id === flick.author_id ? null : current);
    }
    setConfirmation(null);
    setMenuFlick(null);
  };

  const visibleFlicks = requestedPostId ? (focusedFlick ? [focusedFlick] : []) : flicks;
  const pageLoading = requestedPostId ? focusedLoading : initialLoading;

  if (requestedImage && !requestedPostId) {
    return (
      <View style={[styles.imageViewer, theme === "bluesky" && styles.imageViewerBlue]}>
        <Image resizeMode="contain" source={{ uri: requestedImage }} style={StyleSheet.absoluteFill} />
        <Pressable accessibilityLabel="Close image" onPress={() => router.back()} style={styles.viewerClose}>
          <Text style={styles.viewerCloseText}>‹</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={NATIVE_THEME_COLORS[theme].background}
      style={styles.root}
    >
      <NativeBlurTargetContext.Provider value={blurTargetRef}>
        <SafeAreaView
          edges={["top", "bottom"]}
          onLayout={(event) => setPageHeight(event.nativeEvent.layout.height)}
          style={styles.safeArea}
        >
          <BlurTargetView ref={blurTargetRef} style={styles.safeArea}>
            <FlatList
              data={visibleFlicks}
              extraData={[commentsFlickId, menuFlick?.id, reportFlick?.id, confirmation?.flick.id, expandedCaptions]}
              getItemLayout={(_, index) => ({ length: pageHeight, offset: pageHeight * index, index })}
              keyExtractor={(flick) => flick.id}
              onEndReached={hasMore && !requestedPostId ? () => void loadMore() : undefined}
              onEndReachedThreshold={0.4}
              onLayout={(event) => setPageHeight(event.nativeEvent.layout.height)}
              onScroll={handleDockScroll}
              scrollEventThrottle={100}
              pagingEnabled
              refreshControl={
                requestedPostId ? undefined : (
                  <RefreshControl
                    colors={["#0284c7"]}
                    onRefresh={() => void loadFirstPage(true)}
                    refreshing={refreshing}
                    tintColor="#0284c7"
                  />
                )
              }
              ref={listRef}
              style={styles.list}
              renderItem={({ item: flick }) => {
                const isExpanded = expandedCaptions.has(flick.id);
                const owner = flick.author_id === userId;
                return (
                  <View style={[styles.page, { height: pageHeight }]}>
                    <Pressable accessibilityLabel="View image full screen" onPress={() => setImageViewer(flick.image_original_url ?? flick.image_url)} style={StyleSheet.absoluteFill}>
                      <Image
                        accessibilityLabel={flick.text || `${flick.username}'s Flick`}
                        resizeMode="contain"
                        source={{ uri: flick.image_url }}
                        style={styles.photo}
                      />
                    </Pressable>
                    <LinearGradient
                      colors={["rgba(0,0,0,0.15)", "transparent", "rgba(0,0,0,0.78)"]}
                      locations={[0, 0.38, 1]}
                      pointerEvents="none"
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.pageContent}>
                      <View style={styles.caption}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => router.push({
                            pathname: "/(app)/profile/[username]",
                            params: { username: flick.username },
                          })}
                        >
                          <Text style={styles.username}>@{flick.username}</Text>
                        </Pressable>
                        {flick.text ? (
                          <Pressable
                            onPress={() => setExpandedCaptions((current) => {
                              const next = new Set(current);
                              if (next.has(flick.id)) next.delete(flick.id);
                              else next.add(flick.id);
                              return next;
                            })}
                          >
                            <Text numberOfLines={isExpanded ? 8 : 3} style={styles.captionText}>{flick.text}</Text>
                            {flick.text.length > 120 ? (
                              <Text style={styles.moreCaption}>{isExpanded ? "See less" : "See more"}</Text>
                            ) : null}
                          </Pressable>
                        ) : null}
                      </View>
                      <View style={styles.actions}>
                        <Pressable accessibilityLabel={flick.liked ? "Unlike Flick" : "Like Flick"} onPress={() => void toggleLike(flick)} style={styles.actionButton}>
                          <Text style={styles.likeIcon}>{flick.liked ? "❤️" : "🤍"}</Text>
                          <Text style={styles.actionCount}>{flick.likes_count}</Text>
                        </Pressable>
                        <Pressable accessibilityLabel="Comments" onPress={() => setCommentsFlickId(flick.id)} style={styles.actionButton}>
                          <MessageCircle color="#ffffff" size={26} />
                          <Text style={styles.actionCount}>{flick.comments_count}</Text>
                        </Pressable>
                        <Pressable accessibilityLabel="Flick actions" onPress={() => {
                          setActionError(null);
                          setMenuFlick(flick);
                        }} style={styles.actionButton}>
                          <View style={styles.gridIcon}>
                            <View style={styles.gridDot} />
                            <View style={styles.gridDot} />
                            <View style={styles.gridDot} />
                            <View style={styles.gridDot} />
                          </View>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              }}
              showsVerticalScrollIndicator={false}
              windowSize={3}
              initialNumToRender={1}
              maxToRenderPerBatch={2}
              removeClippedSubviews={false}
              ListEmptyComponent={
                <View style={[styles.emptyState, { height: pageHeight }]}>
                  {pageLoading ? (
                    <>
                      <ActivityIndicator color="#0284c7" size="large" />
                      <Text style={styles.statusText}>Finding your next Flick…</Text>
                    </>
                  ) : feedError ? (
                    <>
                      <Text style={styles.errorTitle}>Flicks didn’t load</Text>
                      <Text style={styles.statusText}>{feedError}</Text>
                      <Pressable onPress={() => requestedPostId ? router.replace("/(app)/flicks") : void loadFirstPage()} style={styles.retryButton}>
                        <Text style={styles.retryText}>Try again</Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Text style={styles.emptyEmoji}>🖼️</Text>
                      <Text style={styles.emptyTitle}>No Flicks yet</Text>
                      <Text style={styles.statusText}>There aren’t any Flicks to see right now.</Text>
                    </>
                  )}
                </View>
              }
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.loadingFooter}>
                    <ActivityIndicator color="#0284c7" />
                    <Text style={styles.statusText}>Loading more Flicks…</Text>
                  </View>
                ) : feedError && visibleFlicks.length > 0 ? (
                  <Pressable onPress={() => void loadMore()} style={styles.loadingFooter}>
                    <Text style={styles.errorTitle}>{feedError}</Text>
                    <Text style={styles.retryText}>Tap to retry</Text>
                  </Pressable>
                ) : null
              }
            />

            <View pointerEvents="box-none" style={styles.header}>
              <Pressable accessibilityLabel="Back to Feed" onPress={() => router.replace("/(app)")} style={styles.headerButton}>
                <Text style={styles.headerButtonText}>‹</Text>
              </Pressable>
              <View style={styles.heading}>
                <Text style={[styles.kicker, theme === "dark" && styles.darkKicker]}>VIBESPRO</Text>
                <Text style={[styles.title, theme === "dark" && styles.darkTitle, theme === "bluesky" && styles.blueSkyTitle]}>Flicks</Text>
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
            {loadingMore ? <ActivityIndicator color="#0284c7" style={styles.headerSpinner} /> : null}

            <NativeSurfaceDock
              activeSurface="flicks"
              onClipsPress={() => router.push("/(app)/clips")}
              onFeedPress={() => router.replace("/(app)")}
              onFlicksPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
              visible={dockVisible}
            />

            {commentsFlickId ? (
              <NativeCommentsSheet
                onClose={() => setCommentsFlickId(null)}
                onCountChange={(count) => updateFlick(commentsFlickId, { comments_count: count })}
                postId={commentsFlickId}
                visible
              />
            ) : null}
          </BlurTargetView>
        </SafeAreaView>

        {menuFlick ? (
          <View style={styles.modalRoot}>
            <NativeBlurBackdrop intensity={24} overlayColor="rgba(15,23,42,0.38)" />
            <Pressable onPress={() => setMenuFlick(null)} style={StyleSheet.absoluteFill} />
            <View style={styles.actionMenu}>
              <View style={styles.actionHeader}>
                <Text style={styles.actionTitle}>Flick actions</Text>
                <Pressable accessibilityLabel="Close Flick actions" onPress={() => setMenuFlick(null)}>
                  <Text style={styles.closeText}>×</Text>
                </Pressable>
              </View>
              {actionError ? <Text style={styles.actionError}>{actionError}</Text> : null}
              <View style={styles.actionGrid}>
                <MenuButton label="Share" icon={<Share2 color="#0369a1" size={22} />} onPress={() => void runFlickAction(() => shareFlick(menuFlick))} />
                <MenuButton label="Save to device" icon={<Download color="#0369a1" size={22} />} onPress={() => void runFlickAction(() => saveFlickToDevice(menuFlick))} />
                <MenuButton label="Repost to Feed" icon={<Repeat2 color="#0369a1" size={22} />} onPress={() => void runFlickAction(() => repostNativeFlick(menuFlick, userId ?? ""))} />
                {ownerAction(menuFlick, userId) ? (
                  <MenuButton danger label="Delete Flick" icon={<Trash2 color="#e11d48" size={22} />} onPress={() => {
                    setConfirmation({ type: "delete", flick: menuFlick });
                    setMenuFlick(null);
                  }} />
                ) : (
                  <>
                    <MenuButton label="Report" icon={<Flag color="#0369a1" size={22} />} onPress={() => {
                      setReportFlick(menuFlick);
                      setMenuFlick(null);
                    }} />
                    <MenuButton danger label="Block author" icon={<Ban color="#e11d48" size={22} />} onPress={() => {
                      setConfirmation({ type: "block", flick: menuFlick });
                      setMenuFlick(null);
                    }} />
                  </>
                )}
              </View>
            </View>
          </View>
        ) : null}

        {reportFlick ? (
          <View style={styles.modalRoot}>
            <NativeBlurBackdrop intensity={28} overlayColor="rgba(15,23,42,0.4)" />
            <Pressable disabled={reportBusy} onPress={() => setReportFlick(null)} style={StyleSheet.absoluteFill} />
            <View style={styles.reportCard}>
              <Text style={styles.actionTitle}>Help keep MeToYou safe</Text>
              <Text style={styles.reportDescription}>Why are you reporting this Flick?</Text>
              {REPORT_REASONS.map((reason) => (
                <Pressable key={reason} disabled={reportBusy} onPress={() => void submitReport(reason)} style={styles.reportChoice}>
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
          emoji={confirmation?.type === "delete" ? "🖼️" : "🫶"}
          message={confirmation?.type === "delete" ? "This Flick will be removed for good. Are you sure?" : "Their Flicks will no longer appear in your feed."}
          onCancel={() => setConfirmation(null)}
          onConfirm={confirmAction}
          title={confirmation?.type === "delete" ? "Delete this Flick?" : "Block this author?"}
          visible={confirmation !== null}
        />

        <Modal animationType="fade" onRequestClose={() => setImageViewer(null)} statusBarTranslucent transparent visible={imageViewer !== null}>
          <View style={styles.viewerRoot}>
            <Pressable accessibilityLabel="Close image viewer" onPress={() => setImageViewer(null)} style={StyleSheet.absoluteFill} />
            {imageViewer ? <Image resizeMode="contain" source={{ uri: imageViewer }} style={StyleSheet.absoluteFill} /> : null}
            <Pressable accessibilityLabel="Close image viewer" onPress={() => setImageViewer(null)} style={[styles.viewerClose, { top: insets.top + 10 }]}>
              <Text style={styles.viewerCloseText}>×</Text>
            </Pressable>
          </View>
        </Modal>
      </NativeBlurTargetContext.Provider>
    </LinearGradient>
  );
}

function ownerAction(flick: NativeFlick, userId: string | undefined) {
  return flick.author_id === userId;
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
      <Text style={[styles.menuLabel, danger && styles.danger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "transparent" },
  list: { flex: 1 },
  page: { position: "relative", width: "100%", overflow: "hidden", backgroundColor: "#020617" },
  photo: { width: "100%", height: "100%" },
  pageContent: { ...StyleSheet.absoluteFill, flexDirection: "row", alignItems: "flex-end", gap: 12, paddingHorizontal: 17, paddingBottom: 92 },
  caption: { flex: 1, paddingBottom: 3 },
  username: { color: "#ffffff", fontSize: 16, fontWeight: "900", textShadowColor: "#000000", textShadowRadius: 7 },
  captionText: { marginTop: 7, color: "rgba(255,255,255,0.94)", fontSize: 15, lineHeight: 21, textShadowColor: "#000000", textShadowRadius: 5 },
  moreCaption: { marginTop: 5, color: "#bae6fd", fontSize: 12, fontWeight: "800" },
  actions: { alignItems: "center", gap: 3, paddingBottom: 4 },
  actionButton: { minWidth: 42, minHeight: 42, alignItems: "center", justifyContent: "center" },
  likeIcon: { fontSize: 27 },
  actionCount: { marginBottom: 5, color: "rgba(255,255,255,0.9)", fontSize: 11, fontWeight: "700" },
  gridIcon: { width: 22, height: 22, flexDirection: "row", flexWrap: "wrap", gap: 3 },
  gridDot: { width: 9, height: 9, borderRadius: 2, backgroundColor: "#ffffff" },
  emptyState: { alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  emptyEmoji: { fontSize: 42 },
  emptyTitle: { marginTop: 11, color: "#0c4a6e", fontSize: 20, fontWeight: "900" },
  statusText: { marginTop: 10, color: "#64748b", fontSize: 14, lineHeight: 21, textAlign: "center" },
  errorTitle: { color: "#9f1239", fontSize: 17, fontWeight: "900", textAlign: "center" },
  retryButton: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 14, backgroundColor: "#0284c7" },
  retryText: { color: "#ffffff", fontSize: 13, fontWeight: "800", textAlign: "center" },
  loadingFooter: { alignItems: "center", gap: 8, padding: 20, backgroundColor: "#eff6ff" },
  header: { position: "absolute", top: 6, left: 0, right: 0, zIndex: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14 },
  headerButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.48)", borderRadius: 15, backgroundColor: "rgba(15,23,42,0.42)" },
  headerButtonText: { color: "#ffffff", fontSize: 25, fontWeight: "800" },
  heading: { alignItems: "center" },
  kicker: { color: "#0369a1", fontSize: 9, fontWeight: "900", letterSpacing: 3 },
  darkKicker: { color: "#fde68a" },
  title: { color: "#0f172a", fontSize: 25, fontWeight: "900", textShadowColor: "rgba(255,255,255,0.5)", textShadowRadius: 8 },
  darkTitle: { color: "#fde68a" },
  blueSkyTitle: { color: "#ffffff" },
  themeButtons: { flexDirection: "row", gap: 5 },
  themeButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.55)", borderRadius: 13, backgroundColor: "rgba(255,255,255,0.8)" },
  activeBlue: { backgroundColor: "#0ea5e9", borderColor: "#0284c7" },
  activeGold: { backgroundColor: "#fbbf24", borderColor: "#fcd34d" },
  headerSpinner: { position: "absolute", top: 55, right: 21, zIndex: 21 },
  modalRoot: { ...StyleSheet.absoluteFill, zIndex: 100, alignItems: "center", justifyContent: "center", padding: 20 },
  actionMenu: { width: "100%", maxWidth: 360, padding: 18, borderWidth: 1, borderColor: "#bae6fd", borderRadius: 26, backgroundColor: "#ffffff", shadowColor: "#075985", shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  actionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  actionTitle: { color: "#0c4a6e", fontSize: 18, fontWeight: "900" },
  closeText: { color: "#64748b", fontSize: 27, lineHeight: 31 },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  menuButton: { width: "48%", minHeight: 76, flexGrow: 1, alignItems: "center", justifyContent: "center", gap: 6, padding: 8, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 15, backgroundColor: "#f8fdff" },
  menuLabel: { color: "#334155", fontSize: 11, fontWeight: "800", textAlign: "center" },
  danger: { color: "#e11d48" },
  actionError: { marginBottom: 10, color: "#be123c", fontSize: 13, lineHeight: 19 },
  reportCard: { width: "100%", maxWidth: 370, padding: 20, borderWidth: 1, borderColor: "#bae6fd", borderRadius: 25, backgroundColor: "#ffffff" },
  reportDescription: { marginTop: 7, marginBottom: 14, color: "#64748b", fontSize: 13 },
  reportChoice: { minHeight: 47, justifyContent: "center", marginTop: 7, paddingHorizontal: 13, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 13, backgroundColor: "#f8fdff" },
  reportChoiceText: { color: "#334155", fontSize: 13, fontWeight: "700" },
  reportSpinner: { marginTop: 12 },
  pressed: { opacity: 0.75 },
  imageViewer: { flex: 1, backgroundColor: "#020617" },
  imageViewerBlue: { backgroundColor: "#e0f2fe" },
  viewerRoot: { flex: 1, backgroundColor: "#020617" },
  viewerClose: { position: "absolute", top: 16, left: 16, width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: "rgba(2,6,23,0.68)", zIndex: 2 },
  viewerCloseText: { color: "#ffffff", fontSize: 28, fontWeight: "800", lineHeight: 32 },
});
