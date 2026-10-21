import { useCallback, useEffect, useRef, useState } from "react";
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
import { BlurTargetView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import NativeBlurBackdrop, { NativeBlurTargetContext } from "./NativeBlurBackdrop";
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
import NativeSurfaceDock, { useNativeSurfaceDockVisibility } from "./NativeSurfaceDock";
import NativeStories from "./NativeStories";

const SAVED_POSTS_KEY = "metoyou-saved-posts";

function mergeUniquePosts(current: PostRecord[], incoming: PostRecord[]) {
  const ids = new Set(current.map((post) => post.id));
  return [...current, ...incoming.filter((post) => !ids.has(post.id))];
}

export default function NativeFeedScreen() {
  const blurTargetRef = useRef<View | null>(null);
  const params = useLocalSearchParams<{ postId?: string | string[]; showComments?: string | string[] }>();
  const requestedPostId = Array.isArray(params.postId) ? params.postId[0] : params.postId;
  const requestedShowComments =
    (Array.isArray(params.showComments) ? params.showComments[0] : params.showComments) === "1";
  const { session } = useNativeAuth();
  const { theme, isVibesPro } = useNativeTheme();
  const isBlueSky = theme === "bluesky";
  const userId = session?.user.id;
  const username =
    typeof session?.user.user_metadata.username === "string"
      ? session.user.user_metadata.username
      : session?.user.email?.split("@")[0] ?? "MeToYou member";
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [paginationError, setPaginationError] = useState<string | null>(null);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(() => new Set());
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(() => new Set());
  const [blockedPostAuthorIds, setBlockedPostAuthorIds] = useState<Set<string>>(() => new Set());
  const [focusedPostId, setFocusedPostId] = useState<string | null>(null);
  const { visible: dockVisible, onScroll: handleDockScroll } = useNativeSurfaceDockVisibility();
  const requestGeneration = useRef(0);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);
  const cursorRef = useRef<NativeFeedCursor | undefined>(undefined);
  const listRef = useRef<FlatList<PostRecord>>(null);

  const loadFirstPage = useCallback(
    async (isRefresh = false) => {
      if (!userId || requestedPostId) return;
      const generation = ++requestGeneration.current;
      loadingMoreRef.current = false;
      setLoadingMore(false);
      setPaginationError(null);
      setFeedError(null);
      if (isRefresh) setFocusedPostId(null);
      setInitialLoading(!isRefresh);
      setRefreshing(isRefresh);

      try {
        const page = await fetchNativeFeedPage();
        if (requestGeneration.current !== generation) return;
        setPosts(page);
        cursorRef.current = page.length
          ? { createdAt: page[page.length - 1].created_at, id: page[page.length - 1].id }
          : undefined;
        const nextHasMore = page.length === NATIVE_FEED_PAGE_SIZE;
        hasMoreRef.current = nextHasMore;
        setHasMore(nextHasMore);
        try {
          setLikedPostIds(await getNativeLikedPostIds(userId, page.map((post) => post.id)));
        } catch (cause) {
          Alert.alert(
            "Like status unavailable",
            cause instanceof Error ? cause.message : "Post likes could not be loaded.",
          );
        }
      } catch (cause) {
        if (requestGeneration.current !== generation) return;
        setFeedError(
          cause instanceof Error
            ? cause.message
            : "Unable to load the Feed. Check your connection and try again.",
        );
      } finally {
        if (requestGeneration.current === generation) {
          setInitialLoading(false);
          setRefreshing(false);
        }
      }
    },
    [requestedPostId, userId],
  );

  useEffect(() => {
    void loadFirstPage();
    return () => {
      requestGeneration.current += 1;
    };
  }, [loadFirstPage]);

  useEffect(() => {
    if (!requestedPostId) return;
    let active = true;
    void fetchNativeFeedPostById(requestedPostId)
      .then(async (post) => {
        if (!active) return;
        if (!post) throw new Error("This post could not be found.");
        const likedIds = userId ? await getNativeLikedPostIds(userId, [post.id]) : new Set<string>();
        if (!active) return;
        if (likedIds.size > 0) {
          setLikedPostIds((current) => new Set([...current, ...likedIds]));
        }
        setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)]);
        setFocusedPostId(post.id);
      })
      .catch((cause: unknown) => {
        if (active) {
          setFeedError(
            cause instanceof Error ? cause.message : "This post could not be opened.",
          );
          setInitialLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [requestedPostId, userId]);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(SAVED_POSTS_KEY)
      .then((raw) => {
        if (!active || !raw) return;
        const ids = JSON.parse(raw) as unknown;
        if (Array.isArray(ids) && ids.every((id) => typeof id === "string")) {
          setSavedPostIds(new Set(ids));
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
  }, []);

  const loadMorePosts = useCallback(async () => {
    if (!userId || !hasMoreRef.current || loadingMoreRef.current || !cursorRef.current) return;
    const generation = requestGeneration.current;
    const cursor = cursorRef.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setPaginationError(null);

    try {
      const page = await fetchNativeFeedPage(cursor);
      if (requestGeneration.current !== generation) return;
      setPosts((current) => mergeUniquePosts(current, page));
      if (page.length > 0) {
        const lastPost = page[page.length - 1];
        cursorRef.current = { createdAt: lastPost.created_at, id: lastPost.id };
        try {
          const nextLikedIds = await getNativeLikedPostIds(userId, page.map((post) => post.id));
          if (requestGeneration.current === generation) {
            setLikedPostIds((current) => new Set([...current, ...nextLikedIds]));
          }
        } catch (cause) {
          Alert.alert(
            "Like status unavailable",
            cause instanceof Error ? cause.message : "Post likes could not be loaded.",
          );
        }
      }
      const nextHasMore = page.length === NATIVE_FEED_PAGE_SIZE;
      hasMoreRef.current = nextHasMore;
      setHasMore(nextHasMore);
    } catch (cause) {
      if (requestGeneration.current !== generation) return;
      setPaginationError(
        cause instanceof Error
          ? cause.message
          : "Unable to load more posts. Check your connection and retry.",
      );
    } finally {
      if (requestGeneration.current === generation) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [userId]);

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
        vibes_pro: Boolean(session?.user.user_metadata.vibes_pro),
      },
    };
    if (post.content_kind === "text" || post.content_kind === "image") {
      setPosts((current) => [withAuthor, ...current.filter((item) => item.id !== post.id)]);
    } else {
      await loadFirstPage(true);
    }
  };

  const savePost = async (postId: string) => {
    const next = new Set(savedPostIds);
    if (!next.has(postId)) next.add(postId);
    await AsyncStorage.setItem(SAVED_POSTS_KEY, JSON.stringify([...next]));
    setSavedPostIds(next);
  };

  const deletePost = async (postId: string) => {
    await deleteNativePost(postId);
    setPosts((current) => current.filter((post) => post.id !== postId));
    setFocusedPostId(null);
  };

  const shareFeed = () => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    void loadFirstPage(true);
  };

  const visiblePosts = requestedPostId
    ? []
    : posts.filter((post) => !blockedPostAuthorIds.has(post.author_id));
  const focusedPost = posts.find((post) => post.id === focusedPostId) ?? null;

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
        setPosts((current) =>
          current.map((post) => post.id === postId ? { ...post, comments_count: count } : post),
        )
      }
      onDelete={deletePost}
      onEdit={async (postId, text) => {
        await updateNativePostText(postId, text);
        setPosts((current) =>
          current.map((post) => post.id === postId ? { ...post, text } : post),
        );
      }}
      onHighlight={async (postId) => {
        setPosts((current) =>
          current.map((post) =>
            post.id === postId ? { ...post, highlighted: !post.highlighted } : post,
          ),
        );
      }}
      onReport={async (post, reason) => {
        await reportNativePost({ postId: post.id, authorId: post.author_id, reason });
        Alert.alert("Report submitted", "Our moderation team will review it.");
      }}
      onSave={savePost}
      onToggleLike={async (post) => {
        if (!userId) throw new Error("Sign in to like a post.");
        const result = await toggleNativePostLike(post.id, userId);
        setLikedPostIds((current) => {
          const next = new Set(current);
          if (result.liked) next.add(post.id);
          else next.delete(post.id);
          return next;
        });
        setPosts((current) =>
          current.map((entry) =>
            entry.id === post.id ? { ...entry, likes_count: result.likesCount } : entry,
          ),
        );
        return result;
      }}
      initialCommentsOpen={requestedPostId === item.id && requestedShowComments}
      post={item}
    />
  );

  const renderEmptyState = () => {
    if (initialLoading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator color={isVibesPro ? "#7C5CFF" : "#0284c7"} size="large" />
          <Text style={[styles.stateTitle, isVibesPro && styles.vibesProStateTitle, isBlueSky && styles.blueSkyText]}>
            Loading your Feed
          </Text>
          <Text style={[styles.stateText, isVibesPro && styles.vibesProStateText, isBlueSky && styles.blueSkyMuted]}>
            Fetching the latest posts for you.
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
            onPress={() => void loadFirstPage()}
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
            : styles.emptyListContent
        }
        data={visiblePosts}
        keyExtractor={(post) => post.id}
        onEndReached={() => void loadMorePosts()}
        onEndReachedThreshold={0.45}
        onScroll={handleDockScroll}
        scrollEventThrottle={100}
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
          <View>
            <NativeStories isVibesPro={isVibesPro} />
            <NativeCreatePost authorName={username} isVibesPro={isVibesPro} onPublish={publishPost} />
          </View>
        }
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={
          paginationError ? (
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
          ) : loadingMore ? (
            <View style={styles.loadingFooter}>
              <ActivityIndicator color={isVibesPro ? "#7C5CFF" : "#0284c7"} />
              <Text style={[styles.stateText, isVibesPro && styles.vibesProStateText, isBlueSky && styles.blueSkyMuted]}>
                Loading more posts…
              </Text>
            </View>
          ) : null
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
              onFeedPress={shareFeed}
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
  loadingFooter: { alignItems: "center", gap: 8, paddingVertical: 20 },
  pressed: { opacity: 0.82 },
});
