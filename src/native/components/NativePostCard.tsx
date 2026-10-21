import { useEffect, useRef, useState } from "react";
import {
  Animated,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import * as ExpoLinking from "expo-linking";
import NativeBlurBackdrop from "./NativeBlurBackdrop";
import type { PostRecord } from "../../types/post";
import { getRelativeTime } from "../../lib/time";
import { isVibesProEnabled } from "../../lib/vibesPro";
import NativeCommentsSheet from "./NativeCommentsSheet";
import NativePostActionsMenu from "./NativePostActionsMenu";

type Props = {
  post: PostRecord;
  isOwner: boolean;
  isLiked: boolean;
  isSaved: boolean;
  onToggleLike: (post: PostRecord) => Promise<{ liked: boolean; likesCount: number }>;
  onCommentCountChange: (postId: string, count: number) => void;
  onSave: (postId: string) => Promise<void>;
  onEdit: (postId: string, text: string) => Promise<void>;
  onDelete: (postId: string) => Promise<void>;
  onHighlight: (postId: string) => Promise<void>;
  onReport: (post: PostRecord, reason: string) => Promise<void>;
  onBlock: (post: PostRecord) => Promise<void>;
  initialCommentsOpen?: boolean;
};

function sparkleStyle(value: Animated.Value) {
  return {
    opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.16, 1] }),
    transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1.25] }) }],
  };
}

export default function NativePostCard({
  post,
  isOwner,
  isLiked,
  isSaved,
  onToggleLike,
  onCommentCountChange,
  onSave,
  onEdit,
  onDelete,
  onHighlight,
  onReport,
  onBlock,
  initialCommentsOpen = false,
}: Props) {
  const shimmerProgress = useRef(new Animated.Value(0)).current;
  const sparkleOne = useRef(new Animated.Value(0)).current;
  const sparkleTwo = useRef(new Animated.Value(0)).current;
  const sparkleThree = useRef(new Animated.Value(0)).current;
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes_count ?? 0);
  const [liked, setLiked] = useState(isLiked);
  const [commentsOpen, setCommentsOpen] = useState(initialCommentsOpen);
  const [readingOpen, setReadingOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [imageAspect, setImageAspect] = useState<number | null>(null);
  const [commentCount, setCommentCount] = useState(post.comments_count ?? 0);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const wideLayout = screenWidth >= 768;
  const router = useRouter();
  const isVibesPro = isVibesProEnabled({
    is_vibes_pro: post.profiles?.is_vibes_pro ?? undefined,
    vibes_pro: post.profiles?.vibes_pro ?? undefined,
  });
  const username = post.profiles?.username || post.author_id;
  const avatar = post.profiles?.profile_pic;
  const text = post.text?.trim() ?? "";
  const longText = text.length > 220 || text.split(/\r?\n/).length > 5;
  const previewText = longText
    ? text.length > 220
      ? `${text.slice(0, 220).trimEnd()}…`
      : `${text.split(/\r?\n/).slice(0, 7).join("\n")}…`
    : text;

  useEffect(() => {
    setImageLoaded(false);
    setImageFailed(false);
    setImageAspect(null);
  }, [post.image_url]);

  useEffect(() => {
    if (!isVibesPro) return;

    const shimmer = Animated.loop(
      Animated.timing(shimmerProgress, {
        toValue: 1,
        duration: 3200,
        useNativeDriver: true,
      }),
    );
    const sparkles = [
      { value: sparkleOne, delay: 0 },
      { value: sparkleTwo, delay: 650 },
      { value: sparkleThree, delay: 1300 },
    ].map(({ value, delay }) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, { toValue: 1, duration: 380, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.12, duration: 900, useNativeDriver: true }),
          Animated.delay(850),
        ]),
      ),
    );

    shimmer.start();
    sparkles.forEach((animation) => animation.start());
    return () => {
      shimmer.stop();
      sparkles.forEach((animation) => animation.stop());
    };
  }, [isVibesPro, shimmerProgress, sparkleOne, sparkleTwo, sparkleThree]);

  useEffect(() => {
    setLiked(isLiked);
    setLikesCount(post.likes_count ?? 0);
  }, [isLiked, post.likes_count]);

  const toggleLike = async () => {
    if (likeBusy) return;
    setLikeBusy(true);
    try {
      const result = await onToggleLike(post);
      setLiked(result.liked);
      setLikesCount(result.likesCount);
    } catch (cause) {
      Alert.alert("Could not update like", cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setLikeBusy(false);
    }
  };

  const share = async () => {
    const feedUrl = ExpoLinking.createURL("");
    const message = [text, post.image_url, feedUrl].filter(Boolean).join("\n\n");
    await Share.share({
      title: `${username}'s post`,
      message: message || "Check out this MeToYou post.",
      url: feedUrl,
    });
  };

  const copyPostText = async () => {
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert("Copied", "Post text copied to your clipboard.");
    } catch (cause) {
      Alert.alert(
        "Could not copy text",
        cause instanceof Error ? cause.message : "Please try again.",
      );
    }
  };

  const openAuthorProfile = () => {
    router.push({
      pathname: "/(app)/profile/[username]",
      params: { username },
    });
  };

  const runAction = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (cause) {
      Alert.alert("Action failed", cause instanceof Error ? cause.message : "Please try again.");
      throw cause;
    }
  };

  return (
    <>
      <LinearGradient
        colors={isVibesPro ? ["#ffd21f", "#f9a800", "#d97706"] : ["#ffffff", "#f0f9ff"]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={[styles.card, isVibesPro ? styles.goldenCard : styles.standardCard]}
      >
        {isVibesPro ? (
          <View pointerEvents="none" style={styles.glitterOverlay}>
            <Animated.View
              style={[
                styles.shimmerBeam,
                {
                  transform: [
                    {
                      translateX: shimmerProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-230, 520],
                      }),
                    },
                    { rotate: "18deg" },
                  ],
                },
              ]}
            >
              <LinearGradient
                colors={["rgba(255,255,255,0)", "rgba(255,255,245,0.72)", "rgba(255,255,255,0)"]}
                end={{ x: 1, y: 0 }}
                start={{ x: 0, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
            <Animated.Text style={[styles.glitterSparkle, styles.sparkleTop, sparkleStyle(sparkleOne)]}>
              ✦
            </Animated.Text>
            <Animated.Text style={[styles.glitterSparkle, styles.sparkleMiddle, sparkleStyle(sparkleTwo)]}>
              ✧
            </Animated.Text>
            <Animated.Text style={[styles.glitterSparkle, styles.sparkleBottom, sparkleStyle(sparkleThree)]}>
              ✦
            </Animated.Text>
          </View>
        ) : null}
        <View style={styles.authorRow}>
          <Pressable accessibilityLabel={`View ${username}'s profile`} accessibilityRole="button" onPress={openAuthorProfile}>
            <View style={[styles.avatar, isVibesPro && styles.goldenAvatar]}>
              {avatar && !avatarFailed ? (
                <Image
                  accessibilityLabel={`${username}'s profile picture`}
                  onError={() => setAvatarFailed(true)}
                  source={{ uri: avatar }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={[styles.avatarInitial, isVibesPro && styles.goldenInitial]}>
                  {username.slice(0, 1).toUpperCase()}
                </Text>
              )}
            </View>
          </Pressable>

          <View style={styles.authorDetails}>
            <View style={styles.authorMeta}>
              <Text
                accessibilityRole="link"
                numberOfLines={1}
                onPress={openAuthorProfile}
                style={[styles.username, isVibesPro && styles.goldenText]}
              >
                {username}
              </Text>
              {isVibesPro ? (
                <View style={styles.vibesBadge}>
                  <Text style={styles.vibesBadgeText}>👑 VibesPro</Text>
                </View>
              ) : null}
              <Text style={[styles.time, isVibesPro && styles.goldenTime]}>
                {getRelativeTime(post.created_at)}
              </Text>
            </View>
            {post.highlighted ? (
              <Text style={[styles.highlightBadge, isVibesPro && styles.goldenHighlight]}>
                ✨ Highlight
              </Text>
            ) : null}
          </View>

          <NativePostActionsMenu
            highlighted={Boolean(post.highlighted)}
            initialText={text}
            isOwner={isOwner}
            isSaved={isSaved}
            isVibesPro={isVibesPro}
            onBlock={() => runAction(() => onBlock(post))}
            onDelete={() => runAction(() => onDelete(post.id))}
            onEdit={(nextText) => runAction(() => onEdit(post.id, nextText))}
            onHighlight={() => runAction(() => onHighlight(post.id))}
            onReport={(reason) => runAction(() => onReport(post, reason))}
            onSave={() => runAction(() => onSave(post.id))}
            onShare={share}
          />
        </View>

        {post.image_url ? (
          <View style={[styles.imagePostLayout, wideLayout && styles.imagePostLayoutWide]}>
            <View
              style={[
                styles.imageFrame,
                {
                  width: wideLayout ? "100%" : "45%",
                  aspectRatio: imageAspect ?? 4 / 3,
                  maxHeight: screenHeight * 0.7,
                },
                isVibesPro && styles.goldenImageFrame,
              ]}
            >
              {!imageLoaded && !imageFailed ? (
                <View style={styles.imageLoading}>
                  <ActivityIndicator color={isVibesPro ? "#a16207" : "#0284c7"} />
                </View>
              ) : null}
              {imageFailed ? (
                <Text style={styles.imageError}>This image could not be loaded.</Text>
              ) : (
                <Pressable
                  accessibilityLabel={`View full image posted by ${username}`}
                  accessibilityRole="button"
                  onPress={() => setImageOpen(true)}
                  style={styles.postImagePressable}
                >
                  <Image
                    accessibilityLabel={`Image posted by ${username}`}
                    onError={() => {
                      setImageLoaded(true);
                      setImageFailed(true);
                    }}
                    onLoad={(event) => {
                      const { width: imageWidth, height: imageHeight } = event.nativeEvent.source;
                      setImageLoaded(true);
                      if (imageWidth > 0 && imageHeight > 0) setImageAspect(imageWidth / imageHeight);
                    }}
                    resizeMode="contain"
                    source={{ uri: post.image_url }}
                    style={styles.postImage}
                  />
                </Pressable>
              )}
            </View>

            <View style={[styles.imageDetails, wideLayout && styles.imageDetailsWide]}>
              {text ? (
                <View style={[styles.captionFrame, styles.imageCaptionFrame, isVibesPro && styles.goldenCaptionFrame]}>
                  <ScrollView
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                    style={[styles.imageCaptionScroll, wideLayout && styles.imageCaptionScrollWide]}
                  >
                    <Text style={[styles.captionText, wideLayout && styles.captionTextWide, isVibesPro && styles.goldenCaptionText]}>
                      {longText ? previewText : text}
                    </Text>
                    {longText ? (
                      <Pressable
                        accessibilityLabel="Read full post text"
                        accessibilityRole="button"
                        onPress={() => setReadingOpen(true)}
                        style={styles.moreButton}
                      >
                        <Text style={styles.moreText}>More</Text>
                      </Pressable>
                    ) : null}
                  </ScrollView>
                </View>
              ) : null}
              <View style={styles.imageInteractions}>
                <Pressable
                  accessibilityLabel={`${liked ? "Unlike" : "Like"} post, ${likesCount} likes`}
                  accessibilityRole="button"
                  disabled={likeBusy}
                  onPress={() => void toggleLike()}
                  style={({ pressed }) => [
                    styles.imageInteractionButton,
                    isVibesPro && styles.goldenInteraction,
                    pressed && styles.pressed,
                  ]}
                >
                  {likeBusy ? (
                    <ActivityIndicator color={isVibesPro ? "#78350f" : "#0284c7"} size="small" />
                  ) : (
                    <Text style={[styles.interactionText, isVibesPro && styles.goldenInteractionText]}>
                      {liked ? "❤️" : "🤍"} {likesCount}
                    </Text>
                  )}
                </Pressable>
                <Pressable
                  accessibilityLabel={`Open ${commentCount} comments`}
                  accessibilityRole="button"
                  onPress={() => setCommentsOpen(true)}
                  style={({ pressed }) => [
                    styles.imageInteractionButton,
                    isVibesPro && styles.goldenInteraction,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.interactionText, isVibesPro && styles.goldenInteractionText]}>
                    💬 {commentCount}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : text ? (
          <>
            <View style={[styles.captionFrame, styles.textOnlyFrame, isVibesPro && styles.goldenCaptionFrame]}>
              <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={styles.textOnlyScroll}>
                <Text style={[styles.captionText, wideLayout && styles.captionTextWide, isVibesPro && styles.goldenCaptionText]}>
                  {text}
                </Text>
              </ScrollView>
            </View>
            <View style={[styles.interactions, isVibesPro && styles.goldenInteractions]}>
              <Pressable
                accessibilityLabel={`${liked ? "Unlike" : "Like"} post, ${likesCount} likes`}
                accessibilityRole="button"
                disabled={likeBusy}
                onPress={() => void toggleLike()}
                style={({ pressed }) => [styles.interactionButton, isVibesPro && styles.goldenInteraction, pressed && styles.pressed]}
              >
                {likeBusy ? (
                  <ActivityIndicator color={isVibesPro ? "#78350f" : "#0284c7"} size="small" />
                ) : (
                  <Text style={[styles.interactionText, isVibesPro && styles.goldenInteractionText]}>
                    {liked ? "❤️" : "🤍"} {likesCount} likes
                  </Text>
                )}
              </Pressable>
              <Pressable
                accessibilityLabel={`Open ${commentCount} comments`}
                accessibilityRole="button"
                onPress={() => setCommentsOpen(true)}
                style={({ pressed }) => [styles.interactionButton, isVibesPro && styles.goldenInteraction, pressed && styles.pressed]}
              >
                <Text style={[styles.interactionText, isVibesPro && styles.goldenInteractionText]}>
                  💬 {commentCount} comments
                </Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </LinearGradient>

      <NativeCommentsSheet
        onClose={() => setCommentsOpen(false)}
        onCountChange={(count) => {
          setCommentCount(count);
          onCommentCountChange(post.id, count);
        }}
        postId={post.id}
        visible={commentsOpen}
      />

      <Modal animationType="fade" onRequestClose={() => setReadingOpen(false)} transparent visible={readingOpen}>
        <View style={styles.readingBackdrop}>
          <NativeBlurBackdrop intensity={80} overlayColor="rgba(15,23,42,0.25)" />
          <Pressable
            accessibilityLabel="Close reading mode"
            onPress={() => setReadingOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.readingCard, isVibesPro && styles.goldenReadingCard]}>
            <View style={styles.readingHeader}>
              <View style={styles.readingHeading}>
                <Text numberOfLines={1} style={[styles.readingAuthor, isVibesPro && styles.goldenText]}>{username}</Text>
                <Text style={[styles.readingTime, isVibesPro && styles.goldenTime]}>{getRelativeTime(post.created_at)}</Text>
              </View>
              <View style={styles.readingActions}>
                <Pressable
                  accessibilityLabel="Copy post text"
                  accessibilityRole="button"
                  onPress={() => void copyPostText()}
                  style={[styles.readingPhotoButton, isVibesPro && styles.goldenPhotoButton]}
                >
                  <Text style={[styles.readingPhotoText, isVibesPro && styles.goldenText]}>Copy</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => setReadingOpen(false)} style={[styles.readingPhotoButton, isVibesPro && styles.goldenPhotoButton]}>
                  <Text style={[styles.readingPhotoText, isVibesPro && styles.goldenText]}>Show photo</Text>
                </Pressable>
              </View>
            </View>
            <ScrollView
              contentContainerStyle={styles.readingTextContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator
              style={styles.readingTextScroll}
            >
              <Text style={[styles.readingText, isVibesPro && styles.goldenText]}>{text}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setImageOpen(false)}
        statusBarTranslucent
        transparent
        visible={imageOpen}
      >
        <Pressable accessibilityRole="button" onPress={() => setImageOpen(false)} style={styles.imageViewer}>
          <Pressable accessibilityRole="none" onPress={(event) => event.stopPropagation()} style={styles.imageViewerContent}>
            <Image
              accessibilityLabel={`Full image posted by ${username}`}
              resizeMode="contain"
              source={{ uri: post.image_original_url || post.image_url || undefined }}
              style={styles.fullPostImage}
            />
            <Pressable accessibilityLabel="Close image" onPress={() => setImageOpen(false)} style={styles.imageViewerClose}>
              <Text style={styles.imageViewerCloseText}>×</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "relative",
    overflow: "hidden",
    marginHorizontal: 8,
    marginBottom: 16,
    padding: 19,
    borderRadius: 28,
    shadowColor: "#0c4a6e",
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  standardCard: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  goldenCard: {
    borderWidth: 1.5,
    borderColor: "#b45309",
    backgroundColor: "#f5b21b",
    shadowColor: "#a16207",
    shadowOpacity: 0.26,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 9 },
    elevation: 8,
  },
  glitterOverlay: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
  },
  shimmerBeam: {
    position: "absolute",
    top: -120,
    left: 0,
    width: 100,
    height: 620,
  },
  glitterSparkle: {
    position: "absolute",
    color: "#fff9d6",
    fontSize: 18,
    fontWeight: "900",
    textShadowColor: "rgba(255,255,255,0.9)",
    textShadowRadius: 9,
  },
  sparkleTop: { top: "18%", right: "17%" },
  sparkleMiddle: { top: "52%", right: "42%", fontSize: 14 },
  sparkleBottom: { bottom: "15%", right: "23%" },
  authorRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  avatar: {
    width: 40,
    height: 40,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#0ea5e9",
  },
  goldenAvatar: { borderWidth: 2, borderColor: "#92400e", backgroundColor: "#ffd84d" },
  avatarImage: { width: "100%", height: "100%" },
  avatarInitial: { color: "#ffffff", fontSize: 17, fontWeight: "800" },
  goldenInitial: { color: "#451a03" },
  authorDetails: { flex: 1, minWidth: 0, marginLeft: 11 },
  authorMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  username: { flexShrink: 1, color: "#1e293b", fontSize: 14, fontWeight: "800" },
  goldenText: { color: "#3b1b00" },
  vibesBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#92400e",
    borderRadius: 999,
    backgroundColor: "#ffe27a",
  },
  vibesBadgeText: { color: "#451a03", fontSize: 9, fontWeight: "900" },
  time: { flexShrink: 0, color: "#64748b", fontSize: 10 },
  goldenTime: { color: "#78350f" },
  highlightBadge: {
    alignSelf: "flex-start",
    marginTop: 5,
    color: "#a16207",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  goldenHighlight: { color: "#451a03" },
  imagePostLayout: { flexDirection: "row", alignItems: "stretch", gap: 10 },
  imagePostLayoutWide: { flexDirection: "column", gap: 12 },
  imageDetails: { width: "55%", justifyContent: "space-between", minHeight: 136 },
  imageDetailsWide: { width: "100%" },
  imageFrame: {
    flexShrink: 0,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    borderRadius: 17,
    backgroundColor: "#e0f2fe",
  },
  goldenImageFrame: { borderWidth: 1.5, borderColor: "#92400e", backgroundColor: "#ffd54a" },
  imageLoading: { ...StyleSheet.absoluteFill, zIndex: 1, alignItems: "center", justifyContent: "center" },
  imageError: { padding: 12, color: "#64748b", fontSize: 12, textAlign: "center" },
  postImage: { width: "100%", height: "100%" },
  postImagePressable: { width: "100%", height: "100%" },
  captionFrame: {
    minHeight: 90,
    maxHeight: 240,
    padding: 11,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  goldenCaptionFrame: {
    borderColor: "#a16207",
    backgroundColor: "#ffe17a",
  },
  imageCaptionFrame: { flex: 1, minHeight: 0, padding: 10, backgroundColor: "rgba(255,255,255,0.72)" },
  imageCaptionScroll: { maxHeight: 144 },
  imageCaptionScrollWide: { maxHeight: 240 },
  textOnlyFrame: { minHeight: 80, maxHeight: 240 },
  textOnlyScroll: { maxHeight: 240 },
  captionText: { color: "#334155", fontSize: 15, fontWeight: "500", lineHeight: 22 },
  captionTextWide: { fontSize: 17, lineHeight: 25 },
  goldenCaptionText: { color: "#3b1b00" },
  moreButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 11,
    paddingVertical: 5,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#1e293b",
  },
  moreText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  imageInteractions: { flexDirection: "column", gap: 8, marginTop: 9 },
  imageInteractionButton: {
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  interactions: {
    flexDirection: "row",
    marginTop: 13,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  goldenInteractions: { borderColor: "#92400e", backgroundColor: "#ffd34f" },
  interactionButton: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  goldenInteraction: { backgroundColor: "#ffd34f" },
  interactionText: { color: "#0369a1", fontSize: 11, fontWeight: "800", textAlign: "center" },
  goldenInteractionText: { color: "#451a03" },
  pressed: { opacity: 0.74 },
  readingBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  readingCard: {
    width: "100%",
    maxHeight: "90%",
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.97)",
    transform: [{ scale: 1.02 }],
  },
  goldenReadingCard: { borderColor: "#fcd34d", backgroundColor: "#fffbeb" },
  readingHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  readingHeading: { flex: 1, minWidth: 0 },
  readingActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  readingAuthor: { color: "#1e293b", fontSize: 14, fontWeight: "800" },
  readingTime: { marginTop: 3, color: "#64748b", fontSize: 11 },
  readingPhotoButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 999,
    backgroundColor: "#ffffff",
  },
  goldenPhotoButton: { borderColor: "#fbbf24", backgroundColor: "rgba(255,255,255,0.72)" },
  readingPhotoText: { color: "#475569", fontSize: 11, fontWeight: "700" },
  readingTextScroll: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 0,
    maxHeight: 256,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
  },
  readingTextContent: { padding: 14 },
  readingText: { color: "#334155", fontSize: 18, lineHeight: 28 },
  imageViewer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 12, backgroundColor: "rgba(2,6,23,0.96)" },
  imageViewerContent: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  fullPostImage: { width: "100%", height: "100%" },
  imageViewerClose: { position: "absolute", top: 28, right: 14, width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: "rgba(15,23,42,0.7)" },
  imageViewerCloseText: { color: "#ffffff", fontSize: 28, fontWeight: "700", lineHeight: 32 },
});
