import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  useQueries,
  type InfiniteData,
} from "@tanstack/react-query";
import { BlurTargetView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import NativeBlurBackdrop, { NativeBlurTargetContext, type NativeBlurTargetRef } from "./NativeBlurBackdrop";
import type { PostRecord } from "../../types/post";
import { useNativeAuth } from "../contexts/NativeAuthProvider";
import { NATIVE_THEME_COLORS, useNativeTheme } from "../contexts/NativeThemeProvider";
import {
  fetchNativeFeedPostById,
  fetchNativeFeedPage,
  NATIVE_FEED_PAGE_SIZE,
  type NativeFeedCursor,
} from "../lib/feed";
import {
  nativeFeedLikesQueryKey,
  nativeFeedPostQueryKey,
  nativeFeedQueryKey,
} from "../lib/queryKeys";
import { nativeSavedPostsCacheKey } from "../lib/nativeAccountStorage";
import { NATIVE_OFFLINE_MESSAGE } from "../lib/networkStatus";
import {
  blockNativeUser,
  createNativePost,
  deleteNativePost,
  getNativeLikedPostIds,
  reportNativePost,
  toggleNativePostLike,
  updateNativePostText,
} from "../lib/posts";
import NativeCreatePost, { type NativeSelectedImage } from "./NativeCreatePost";
import NativeFeedHeader from "./NativeFeedHeader";
import NativePostCard from "./NativePostCard";
import NativeFeedSkeleton, { NativeFeedPostSkeleton } from "./NativeFeedSkeleton";
import NativeSurfaceDock, { useNativeSurfaceDockVisibility } from "./NativeSurfaceDock";
import NativeStories from "./NativeStories";

const MINIMUM_PAGINATION_SKELETON_MS = 250;

export default function NativeFeedScreen() {
  const blurTargetRef = useRef<NativeBlurTargetRef>(null);
  const params = useLocalSearchParams<{ postId?: string | string[]; showComments?: string | string[] }>();
  const requestedPostId = Array.isArray(params.postId) ? params.postId[0] : params.postId;
  const requestedShowComments =
    (Array.isArray(params.showComments) ? params.showComments[0] : params.showComments) === "1";
  const { session, cacheUserId, status } = useNativeAuth();
  const { theme, isVibesPro } = useNativeTheme();
  const isBlueSky = theme === "bluesky";
  const userId = session?.user.id;
  const cacheOwnerId = cacheUserId;
  const username =
    typeof session?.user.user_metadata.username === "string"
      ? session.user.user_metadata.username
      : session?.user.email?.split("@")[0] ?? "MeToYou member";
  const insets = useSafeAreaInsets();
  const [paginationError, setPaginationError] = useState<string | null>(null);
  const [paginationPending, setPaginationPending] = useState(false);
  const [savedPostState, setSavedPostState] = useState<{ userId: string; ids: Set<string> } | null>(null);
  const savedPostIds = savedPostState?.userId === cacheOwnerId ? savedPostState.ids : new Set<string>();
  const [blockedPostAuthorIds, setBlockedPostAuthorIds] = useState<Set<string>>(() => new Set());
  const [focusedPostId, setFocusedPostId] = useState<string | null>(null);
  const {
    visible: dockVisible,
    onScroll: handleDockScroll,
    scrollTranslation: dockScrollTranslation,
  } = useNativeSurfaceDockVisibility(true, insets.bottom);
  const loadingMoreRef = useRef(false);
  const listRef = useRef<FlatList<PostRecord>>(null);
  const queryClient = useQueryClient();
  const feedQueryKey = nativeFeedQueryKey(cacheOwnerId ?? "");
  const feedQuery = useInfiniteQuery({
    queryKey: feedQueryKey,
    queryFn: ({ pageParam }) => fetchNativeFeedPage(pageParam),
    initialPageParam: undefined as NativeFeedCursor | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < NATIVE_FEED_PAGE_SIZE) return undefined;
      const lastPost = lastPage[lastPage.length - 1];
      return { createdAt: lastPost.created_at, id: lastPost.id };
    },
    enabled: Boolean(userId && !requestedPostId),
  });
  const posts = useMemo(() => feedQuery.data?.pages.flat() ?? [], [feedQuery.data?.pages]);
  const focusedPostQuery = useQuery({
    queryKey: nativeFeedPostQueryKey(cacheOwnerId ?? "", requestedPostId ?? ""),
    queryFn: () => fetchNativeFeedPostById(requestedPostId!),
    enabled: Boolean(userId && requestedPostId),
  });
  const focusedPostRecord = focusedPostQuery.data ?? null;
  const likeGroups = useMemo(
    () => [
      ...(feedQuery.data?.pages ?? []).map((page) => page.map((post) => post.id).sort()),
      ...(focusedPostRecord ? [[focusedPostRecord.id]] : []),
    ],
    [feedQuery.data?.pages, focusedPostRecord],
  );
  const likesQueries = useQueries({
    queries: likeGroups.map((postIds) => ({
      queryKey: nativeFeedLikesQueryKey(cacheOwnerId ?? "", postIds),
      queryFn: () => getNativeLikedPostIds(userId!, postIds),
      enabled: Boolean(userId && postIds.length),
    })),
  });
  const likedPostIds = new Set(likesQueries.flatMap((query) => [...(query.data ?? [])]));
  const likeError = likesQueries.find((query) => query.error)?.error;
  const initialLoading = requestedPostId
    ? focusedPostQuery.isPending && status !== "offlineDeferred"
    : feedQuery.isPending && !feedQuery.data && status !== "offlineDeferred";
  const feedError = requestedPostId
    ? focusedPostQuery.error?.message ??
      (status === "offlineDeferred" && !focusedPostQuery.data ? NATIVE_OFFLINE_MESSAGE : null)
    : feedQuery.isError && !feedQuery.data
      ? feedQuery.error.message
      : status === "offlineDeferred" && !feedQuery.data
        ? NATIVE_OFFLINE_MESSAGE
        : null;
  const loadingMore = paginationPending || feedQuery.isFetchingNextPage;
  const refreshing = feedQuery.isRefetching;
  const showFeedSkeleton = Boolean(userId && !requestedPostId && feedQuery.isPending && !feedQuery.data);

  const updateCachedPost = useCallback((postId: string, update: (post: PostRecord) => PostRecord) => {
    if (!userId) return;
    queryClient.setQueryData<InfiniteData<PostRecord[], NativeFeedCursor | undefined>>(
      nativeFeedQueryKey(userId),
      (current) => current && ({
        ...current,
        pages: current.pages.map((page) =>
          page.map((post) => post.id === postId ? update(post) : post),
        ),
      }),
    );
    if (requestedPostId) {
      queryClient.setQueryData<PostRecord | null>(
        nativeFeedPostQueryKey(userId, requestedPostId),
        (current) => current?.id === postId ? update(current) : current,
      );
    }
  }, [queryClient, requestedPostId, userId]);

  const loadFirstPage = useCallback(async (isRefresh = false) => {
    if (!userId || requestedPostId) return;
    setPaginationError(null);
    if (isRefresh) setFocusedPostId(null);
    await feedQuery.refetch();
  }, [feedQuery.refetch, requestedPostId, userId]);

  useEffect(() => {
    if (focusedPostRecord) setFocusedPostId(focusedPostRecord.id);
  }, [focusedPostRecord]);

  useEffect(() => {
    if (likeError) {
      Alert.alert(
        "Like status unavailable",
        likeError instanceof Error
          ? likeError.message
          : "Post likes could not be loaded.",
      );
    }
  }, [likeError]);

  useEffect(() => {
    if (!cacheOwnerId) {
      setSavedPostState(null);
      return;
    }
    let active = true;
    setSavedPostState({ userId: cacheOwnerId, ids: new Set() });
    void AsyncStorage.getItem(nativeSavedPostsCacheKey(cacheOwnerId))
      .then((raw) => {
        if (!active || !raw) return;
        const ids = JSON.parse(raw) as unknown;
        if (Array.isArray(ids) && ids.every((id) => typeof id === "string")) {
          setSavedPostState({ userId: cacheOwnerId, ids: new Set(ids) });
        }
      })
      .catch((cause: unknown) => {
        Alert.alert(
          "Saved posts unavailable",
          cause instanceof Error ? cause.message : "Saved posts could not be read.",
        );
      });
    return () => {
      active = false;
    };
  }, [cacheOwnerId]);

  const loadMorePosts = useCallback(async () => {
    if (!userId || !feedQuery.hasNextPage || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    const startedAt = Date.now();
    setPaginationPending(true);
    setPaginationError(null);
    try {
      const result = await feedQuery.fetchNextPage();
      if (result.isError) {
        throw result.error;
      }
    } catch (cause) {
      setPaginationError(
        cause instanceof Error
          ? cause.message
          : "Unable to load more posts. Check your connection and retry.",
      );
    } finally {
      const remainingSkeletonTime = MINIMUM_PAGINATION_SKELETON_MS - (Date.now() - startedAt);
      if (remainingSkeletonTime > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, remainingSkeletonTime));
      }
      loadingMoreRef.current = false;
      setPaginationPending(false);
    }
  }, [feedQuery.fetchNextPage, feedQuery.hasNextPage, userId]);

  const publishPost = async (text: string, image?: NativeSelectedImage) => {
    if (!userId) throw new Error("Sign in to publish a post.");
    const post = await createNativePost({
      authorId: userId,
      text,
      imageBase64: image?.base64,
      imageOriginalBase64: image?.originalBase64,
      imageOriginalMimeType: image?.originalMimeType,
    });
    const withAuthor: PostRecord = {
      ...post,
      profiles: {
        username,
        profile_pic:
          typeof session?.user.user_metadata.avatar_url === "string"
            ? session.user.user_metadata.avatar_url
            : null,
        vibes_pro: isVibesPro,
      },
    };
    if (post.content_kind === "text" || post.content_kind === "image") {
      queryClient.setQueryData<InfiniteData<PostRecord[], NativeFeedCursor | undefined>>(
        feedQueryKey,
        (current) => current
          ? {
              ...current,
              pages: [
                [withAuthor, ...current.pages[0].filter((item) => item.id !== post.id)],
                ...current.pages.slice(1),
              ],
            }
          : current,
      );
      void queryClient.invalidateQueries({ queryKey: feedQueryKey });
    } else {
      await loadFirstPage(true);
    }
  };

  const savePost = async (postId: string) => {
    if (!cacheOwnerId) return;
    const next = new Set(savedPostIds);
    if (!next.has(postId)) next.add(postId);
    await AsyncStorage.setItem(nativeSavedPostsCacheKey(cacheOwnerId), JSON.stringify([...next]));
    setSavedPostState({ userId: cacheOwnerId, ids: next });
  };

  const deletePost = async (postId: string) => {
    await deleteNativePost(postId);
    if (userId) {
      queryClient.setQueryData<InfiniteData<PostRecord[], NativeFeedCursor | undefined>>(
        feedQueryKey,
        (current) => current && ({
          ...current,
          pages: current.pages.map((page) => page.filter((post) => post.id !== postId)),
        }),
      );
      queryClient.setQueryData<PostRecord | null>(
        nativeFeedPostQueryKey(userId, postId),
        null,
      );
    }
    setFocusedPostId(null);
  };

  const shareFeed = () => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    setFocusedPostId(null);
  };

  const visiblePosts = useMemo(
    () => requestedPostId
      ? []
      : posts.filter((post) => !blockedPostAuthorIds.has(post.author_id)),
    [blockedPostAuthorIds, posts, requestedPostId],
  );
  const focusedPost = requestedPostId
    ? focusedPostRecord
    : posts.find((post) => post.id === focusedPostId) ?? null;

  const renderPostCard = (item: PostRecord) => (
    <NativePostCard
      isLiked={likedPostIds.has(item.id)}
      isOwner={item.author_id === userId}
      isSaved={savedPostIds.has(item.id)}
      onBlock={async (post) => {
        await blockNativeUser(post.author_id);
        setBlockedPostAuthorIds((current) => new Set(current).add(post.author_id));
        if (focusedPostId === post.id) setFocusedPostId(null);
      }}
      onCommentCountChange={(postId, count) =>
        updateCachedPost(postId, (post) => ({ ...post, comments_count: count }))
      }
      onDelete={deletePost}
      onEdit={async (postId, text) => {
        await updateNativePostText(postId, text);
        updateCachedPost(postId, (post) => ({ ...post, text }));
      }}
      onHighlight={async (postId) => {
        updateCachedPost(postId, (post) => ({ ...post, highlighted: !post.highlighted }));
      }}
      onReport={async (post, reason) => {
        await reportNativePost({ postId: post.id, authorId: post.author_id, reason });
        Alert.alert("Report submitted", "Our moderation team will review it.");
      }}
      onSave={savePost}
      onToggleLike={async (post) => {
        if (!userId) throw new Error("Sign in to like a post.");
        const result = await toggleNativePostLike(post.id, userId);
        const postIds = feedQuery.data?.pages.find((page) =>
          page.some((entry) => entry.id === post.id),
        )?.map((entry) => entry.id).sort() ?? [post.id];
        queryClient.setQueryData<Set<string>>(
          nativeFeedLikesQueryKey(userId, postIds),
          (current) => {
            const next = new Set(current ?? likedPostIds);
            if (result.liked) next.add(post.id);
            else next.delete(post.id);
            return next;
          },
        );
        updateCachedPost(post.id, (entry) => ({ ...entry, likes_count: result.likesCount }));
        return result;
      }}
      initialCommentsOpen={requestedPostId === item.id && requestedShowComments}
      post={item}
    />
  );

  const renderEmptyState = () => {
    if (showFeedSkeleton) {
      return <NativeFeedSkeleton />;
    }
    if (requestedPostId && initialLoading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator color={isVibesPro ? "#7C5CFF" : "#0284c7"} size="large" />
          <Text style={[styles.stateTitle, isVibesPro && styles.vibesProStateTitle, isBlueSky && styles.blueSkyText]}>
            Loading post
          </Text>
        </View>
      );
    }
    if (feedError) {
      return (
        <View style={styles.emptyState}>
          <Text style={[styles.stateTitle, isVibesPro && styles.vibesProStateTitle, isBlueSky && styles.blueSkyText]}>
            Couldn’t load the Feed
          </Text>
          <Text style={[styles.stateText, isVibesPro && styles.vibesProStateText, isBlueSky && styles.blueSkyMuted]}>{feedError}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void (requestedPostId ? focusedPostQuery.refetch() : loadFirstPage())}
            style={({ pressed }) => [
              styles.retryButton,
              (isVibesPro || isBlueSky) && styles.vibesProRetryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Text style={[styles.stateTitle, isVibesPro && styles.vibesProStateTitle, isBlueSky && styles.blueSkyText]}>
          Your Feed is quiet
        </Text>
        <Text style={[styles.stateText, isVibesPro && styles.vibesProStateText, isBlueSky && styles.blueSkyMuted]}>
          There aren’t any posts to show right now.
        </Text>
      </View>
    );
  };

  return (
    <LinearGradient
      colors={isBlueSky ? NATIVE_THEME_COLORS.bluesky.background : isVibesPro ? NATIVE_THEME_COLORS.dark.background : ["#d9f3ff", "#eefaff", "#ffffff"]}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={styles.safeArea}
    >
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <NativeBlurTargetContext.Provider value={blurTargetRef}>
          <BlurTargetView ref={blurTargetRef} style={styles.safeArea}>
            <NativeFeedHeader isVibesPro={isVibesPro} onFeedPress={shareFeed} />
        <FlatList
        contentContainerStyle={
          visiblePosts.length
            ? [styles.listContent, isVibesPro && styles.vibesProListContent, isBlueSky && styles.blueSkyListContent, { paddingBottom: 90 + insets.bottom }]
            : showFeedSkeleton
              ? styles.skeletonListContent
              : styles.emptyListContent
        }
        data={visiblePosts}
        keyExtractor={(post) => post.id}
        onEndReached={() => void loadMorePosts()}
        onEndReachedThreshold={0.45}
        onScroll={handleDockScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            colors={["#0284c7"]}
            onRefresh={() => void loadFirstPage(true)}
            refreshing={refreshing}
            tintColor="#0284c7"
          />
        }
        ref={listRef}
        ListHeaderComponent={
          showFeedSkeleton
            ? undefined
            : (
              <View>
                {feedQuery.isRefetching ? (
                  <View style={styles.refreshIndicator}>
                    <ActivityIndicator color={isVibesPro ? "#7C5CFF" : "#0284c7"} size="small" />
                    <Text style={[styles.refreshIndicatorText, isBlueSky && styles.blueSkyMuted]}>Refreshing</Text>
                  </View>
                ) : null}
                {feedQuery.isError && feedQuery.data && !feedQuery.isFetchNextPageError ? (
                  <View style={styles.refreshError}>
                    <Text style={styles.paginationErrorText}>Couldn’t refresh the Feed. Your saved posts are still available.</Text>
                    <Pressable accessibilityRole="button" onPress={() => void loadFirstPage()}>
                      <Text style={styles.retryText}>Retry</Text>
                    </Pressable>
                  </View>
                ) : null}
                <NativeStories isVibesPro={isVibesPro} />
                <NativeCreatePost authorName={username} isVibesPro={isVibesPro} onPublish={publishPost} />
              </View>
            )
        }
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.paginationSkeletons}>
              {Array.from({ length: 2 }, (_, index) => (
                <NativeFeedPostSkeleton
                  compact
                  key={index}
                  showMedia={index === 0}
                />
              ))}
            </View>
          ) : paginationError ? (
            <View style={styles.paginationError}>
              <Text style={styles.paginationErrorText}>{paginationError}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void loadMorePosts()}
                style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
              >
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : undefined
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open post by ${item.profiles?.username ?? "author"}`}
            onPress={() => setFocusedPostId(item.id)}
            style={styles.postPressable}
          >
            {renderPostCard(item)}
          </Pressable>
        )}
        showsVerticalScrollIndicator={false}
        />
            <NativeSurfaceDock
              bottomInset={insets.bottom}
              onFeedPress={shareFeed}
              scrollTranslation={dockScrollTranslation}
              visible={dockVisible}
            />
          </BlurTargetView>
          {focusedPost ? (
            <View style={styles.focusOverlay}>
              <NativeBlurBackdrop intensity={80} overlayColor="rgba(15,23,42,0.25)" />
              <Pressable
                accessibilityLabel="Close focused post"
                onPress={() => setFocusedPostId(null)}
                style={StyleSheet.absoluteFill}
              />
              <ScrollView
                contentContainerStyle={styles.focusCardContent}
                showsVerticalScrollIndicator={false}
                style={styles.focusCardScroll}
              >
                {renderPostCard(focusedPost)}
              </ScrollView>
            </View>
          ) : null}
        </NativeBlurTargetContext.Provider>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "transparent" },
  statusScreen: { flex: 1, justifyContent: "center", backgroundColor: "#effaff" },
  vibesProStatusScreen: { backgroundColor: "#0B0B0B" },
  blueSkyStatusScreen: { backgroundColor: "#0b2d5b" },
  statusContent: { alignItems: "center", justifyContent: "center", padding: 24 },
  statusTitle: { marginTop: 12, color: "#0c4a6e", fontSize: 17, fontWeight: "800", textAlign: "center" },
  vibesProStatusTitle: { color: "#ffffff" },
  statusText: { marginTop: 7, color: "#64748b", fontSize: 14, lineHeight: 20, textAlign: "center" },
  vibesProStatusText: { color: "#d6d6d6" },
  blueSkyText: { color: "#ffffff" },
  blueSkyMuted: { color: "rgba(255,255,255,0.78)" },
  postPressable: { flex: 1 },
  focusOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    elevation: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  focusCardScroll: {
    flexGrow: 0,
    width: "100%",
    maxHeight: "90%",
    transform: [{ scale: 1.02 }],
  },
  focusCardContent: { flexGrow: 1, justifyContent: "center", paddingVertical: 8 },
  listContent: { paddingTop: 0, paddingBottom: 20 },
  vibesProListContent: { backgroundColor: "#0B0B0B" },
  blueSkyListContent: { backgroundColor: "#0b2d5b" },
  emptyListContent: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 100 },
  skeletonListContent: { flexGrow: 1, paddingBottom: 90 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 50 },
  stateTitle: { marginTop: 12, color: "#0c4a6e", fontSize: 17, fontWeight: "800", textAlign: "center" },
  stateText: { marginTop: 7, color: "#64748b", fontSize: 14, lineHeight: 20, textAlign: "center" },
  vibesProStateTitle: { color: "#ffffff" },
  vibesProStateText: { color: "#d6d6d6" },
  retryButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    paddingHorizontal: 18,
    borderRadius: 13,
    backgroundColor: "#0284c7",
  },
  vibesProRetryButton: { backgroundColor: "#7C5CFF" },
  retryText: { color: "#ffffff", fontSize: 14, fontWeight: "800" },
  paginationError: { alignItems: "center", paddingVertical: 18, paddingHorizontal: 24 },
  paginationErrorText: { color: "#be123c", fontSize: 13, textAlign: "center" },
  refreshIndicator: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6, paddingHorizontal: 14, paddingTop: 6 },
  refreshIndicatorText: { color: "#64748b", fontSize: 11, fontWeight: "600" },
  refreshError: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginHorizontal: 12, marginTop: 8, padding: 10, borderRadius: 12, backgroundColor: "rgba(254,226,226,0.85)" },
  paginationSkeletons: { paddingTop: 8, paddingBottom: 12 },
  pressed: { opacity: 0.82 },
});
