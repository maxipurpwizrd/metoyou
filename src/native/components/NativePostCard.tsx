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
  Platform,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import * as ExpoLinking from "expo-linking";
import { ChevronDown, Focus } from "lucide-react-native";
import NativeBlurBackdrop from "./NativeBlurBackdrop";
import NativeGlassSurface, { NATIVE_LIQUID_GLASS_PRESSED } from "./NativeGlassSurface";
import type { PostRecord } from "../../types/post";
import { getRelativeTime } from "../../lib/time";
import { isVibesProEnabled } from "../../lib/vibesPro";
import { NATIVE_THEME_COLORS, useNativeTheme } from "../contexts/NativeThemeProvider";
import NativeCommentsSheet from "./NativeCommentsSheet";
import NativePostActionsMenu from "./NativePostActionsMenu";

export type NativePostcardTheme =
  | "bluesky"
  | "white"
  | "black"
  | "pink"
  | "purple"
  | "red"
  | "rainbow"
  | "liquidGlass";

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
  onOpen: () => void;
  classicMode?: boolean;
  photoMode?: boolean;
  postcardTheme?: NativePostcardTheme | null;
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
  onOpen,
  classicMode = false,
  photoMode = false,
  postcardTheme = null,
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
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);
  const [captionHasScrolled, setCaptionHasScrolled] = useState(false);
  const [captionScrollSize, setCaptionScrollSize] = useState({ contentHeight: 0, viewportHeight: 0 });
  const [classicCaptionExpanded, setClassicCaptionExpanded] = useState(false);
  const [classicCaptionHasMore, setClassicCaptionHasMore] = useState(false);
  const [commentCount, setCommentCount] = useState(post.comments_count ?? 0);
  const { width: screenWidth } = useWindowDimensions();
  const wideLayout = screenWidth >= 768;
  const captionLineHeight = wideLayout ? 25 : 22;
  const imageCaptionHeight = captionLineHeight * 5 + 22;
  const imagePostHeight = imageCaptionHeight + 9 + 36 * 2 + 8;
  const imageOnlyHeight = 360;
  const { theme: appTheme } = useNativeTheme();
  const appColors = NATIVE_THEME_COLORS[appTheme];
  const router = useRouter();
  const isVibesPro = isVibesProEnabled({
    is_vibes_pro: post.profiles?.is_vibes_pro ?? undefined,
    vibes_pro: post.profiles?.vibes_pro ?? undefined,
  });
  const username = post.profiles?.username || post.author_id;
  const avatar = post.profiles?.profile_pic;
  const text = post.text?.trim() ?? "";
  const classicCaptionLineLimit = post.image_url ? 6 : 20;
  const longText = text.length > 220 || text.split(/\r?\n/).length > 5;
  const usePhotoMode = photoMode && Boolean(post.image_url && text);
  const selectedPostcardTheme = appTheme === "liquidGlass"
    ? "liquidGlass"
    : classicMode ? null : postcardTheme ?? (appTheme === "dark" ? null : appTheme);
  const isLiquidGlass = selectedPostcardTheme === "liquidGlass";
  const palette = selectedPostcardTheme === "bluesky"
    ? {
        card: ["#0b3b78", "#125baa", "#0b2d5b"] as const,
        border: "#54b8ff",
        text: "#eff6ff",
        mutedText: "#bfdbfe",
        caption: "rgba(6,26,58,0.82)",
        captionText: "#eff6ff",
        control: "#164e8a",
        controlText: "#eff6ff",
        reading: "#082f62",
        readingText: "#eff6ff",
      }
    : selectedPostcardTheme === "white"
      ? {
          card: ["#ffffff", "#f8fafc", "#e2e8f0"] as const,
          border: "#cbd5e1",
          text: "#0f172a",
          mutedText: "#475569",
          caption: "rgba(255,255,255,0.9)",
          captionText: "#1e293b",
          control: "#f8fafc",
          controlText: "#0f172a",
          reading: "#ffffff",
          readingText: "#0f172a",
        }
      : selectedPostcardTheme === "black"
        ? {
            card: ["#262626", "#171717", "#09090b"] as const,
            border: "#52525b",
            text: "#fafafa",
            mutedText: "#d4d4d8",
            caption: "rgba(24,24,27,0.92)",
            captionText: "#fafafa",
            control: "#27272a",
            controlText: "#fafafa",
            reading: "#18181b",
            readingText: "#fafafa",
          }
        : selectedPostcardTheme === "pink"
          ? {
              card: ["#fbcfe8", "#ec4899", "#9d174d"] as const,
              border: "#f9a8d4",
              text: "#fff1f7",
              mutedText: "#fce7f3",
              caption: "rgba(80,7,36,0.84)",
              captionText: "#fff1f7",
              control: "#9d174d",
              controlText: "#fff1f7",
              reading: "#500724",
              readingText: "#fff1f7",
            }
          : selectedPostcardTheme === "purple"
            ? {
                card: ["#c4b5fd", "#7c3aed", "#3b0764"] as const,
                border: "#c4b5fd",
                text: "#f5f3ff",
                mutedText: "#ddd6fe",
                caption: "rgba(46,16,101,0.86)",
                captionText: "#f5f3ff",
                control: "#5b21b6",
                controlText: "#f5f3ff",
                reading: "#2e1065",
                readingText: "#f5f3ff",
              }
            : selectedPostcardTheme === "red"
              ? {
                  card: ["#fca5a5", "#dc2626", "#7f1d1d"] as const,
                  border: "#fca5a5",
                  text: "#fff1f2",
                  mutedText: "#fecdd3",
                  caption: "rgba(69,10,10,0.86)",
                  captionText: "#fff1f2",
                  control: "#991b1b",
                  controlText: "#fff1f2",
                  reading: "#450a0a",
                  readingText: "#fff1f2",
                }
              : selectedPostcardTheme === "rainbow"
                ? {
                    card: ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7"] as const,
                    border: "#f0abfc",
                    text: "#ffffff",
                    mutedText: "#f5f3ff",
                    caption: "rgba(24,24,27,0.84)",
                    captionText: "#ffffff",
                    control: "#27272a",
                    controlText: "#ffffff",
                    reading: "#18181b",
                    readingText: "#ffffff",
                  }
                : selectedPostcardTheme === "liquidGlass"
                  ? {
                      card: ["rgba(235,240,242,0.26)", "rgba(30,32,34,0.2)", "rgba(235,240,242,0.22)"] as const,
                      border: "rgba(235,240,242,0.55)",
                      text: "#ffffff",
                      mutedText: "rgba(241,244,245,0.76)",
                      caption: "rgba(30,32,34,0.5)",
                      captionText: "#ffffff",
                      control: "rgba(30,32,34,0.56)",
                      controlText: "#ffffff",
                      reading: "rgba(30,32,34,0.6)",
                      readingText: "#ffffff",
                    }
                  : null;
  const glitterColor = selectedPostcardTheme === "bluesky"
    ? "#bfdbfe"
    : selectedPostcardTheme === "white"
      ? "#60a5fa"
      : selectedPostcardTheme === "black"
        ? "#e4e4e7"
        : selectedPostcardTheme === "pink"
          ? "#fce7f3"
          : selectedPostcardTheme === "purple"
            ? "#ede9fe"
            : selectedPostcardTheme === "red"
              ? "#fee2e2"
              : selectedPostcardTheme === "rainbow"
                ? "#ffffff"
                : "#fff9d6";
  const glitterBeamColor = selectedPostcardTheme === "bluesky"
    ? "rgba(191,219,254,0.72)"
    : selectedPostcardTheme === "white"
      ? "rgba(96,165,250,0.5)"
      : selectedPostcardTheme === "black"
        ? "rgba(228,228,231,0.62)"
        : selectedPostcardTheme === "pink"
          ? "rgba(252,231,243,0.72)"
          : selectedPostcardTheme === "purple"
            ? "rgba(237,233,254,0.72)"
            : selectedPostcardTheme === "red"
              ? "rgba(254,226,226,0.72)"
              : selectedPostcardTheme === "rainbow"
                ? "rgba(255,255,255,0.82)"
                : "rgba(255,255,245,0.72)";

  useEffect(() => {
    setCaptionHasScrolled(false);
    setCaptionScrollSize({ contentHeight: 0, viewportHeight: 0 });
  }, [post.id, text]);

  useEffect(() => {
    setClassicCaptionExpanded(false);
    setClassicCaptionHasMore(false);
  }, [classicCaptionLineLimit, classicMode, post.id, screenWidth, text]);

  const captionScrollable = captionScrollSize.contentHeight > captionScrollSize.viewportHeight + 1;
  const updateCaptionViewport = (viewportHeight: number) => {
    setCaptionScrollSize((current) => ({ ...current, viewportHeight }));
  };
  const updateCaptionContent = (contentHeight: number) => {
    setCaptionScrollSize((current) => ({ ...current, contentHeight }));
  };

  useEffect(() => {
    setImageLoaded(false);
    setImageFailed(false);
  }, [post.image_url]);

  useEffect(() => {
    let active = true;
    if (!classicMode || !post.image_url) {
      setImageAspectRatio(1);
      return () => {
        active = false;
      };
    }

    setImageAspectRatio(null);
    Image.getSize(
      post.image_url,
      (width, height) => {
        if (active && width > 0 && height > 0) setImageAspectRatio(width / height);
      },
      () => {
        if (active) setImageAspectRatio(1);
      },
    );
    return () => {
      active = false;
    };
  }, [classicMode, post.image_url]);

  useEffect(() => {
    if (!isVibesPro || classicMode) return;

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
  }, [classicMode, isVibesPro, shimmerProgress, sparkleOne, sparkleTwo, sparkleThree]);

  useEffect(() => {
    setLiked(isLiked);
    setLikesCount(post.likes_count ?? 0);
  }, [isLiked, post.likes_count]);

  const toggleLike = async () => {
    if (likeBusy) return;
    const previousLiked = liked;
    const previousLikesCount = likesCount;
    const nextLiked = !previousLiked;
    setLiked(nextLiked);
    setLikesCount(Math.max(0, previousLikesCount + (nextLiked ? 1 : -1)));
    setLikeBusy(true);
    try {
      const result = await onToggleLike(post);
      setLiked(result.liked);
      setLikesCount(result.likesCount);
    } catch (cause) {
      setLiked(previousLiked);
      setLikesCount(previousLikesCount);
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
      <NativeGlassSurface
        enabled={isLiquidGlass}
        blurEnabled={Platform.OS !== "android"}
        gradientColors={classicMode
          ? undefined
          : palette?.card ?? (isVibesPro ? ["#ffd21f", "#f9a800", "#d97706"] : ["#ffffff", "#f0f9ff"])}
        style={[
          styles.card,
          classicMode
            ? [styles.classicCard, { backgroundColor: isLiquidGlass ? "transparent" : appColors.surface, borderColor: appColors.border }]
            : isLiquidGlass ? styles.liquidGlassCard : isVibesPro ? styles.goldenCard : styles.standardCard,
          palette && { borderColor: palette.border, shadowColor: palette.border },
        ]}
        overlayColor="rgba(235,240,242,0.1)"
      >
        {isVibesPro && !isLiquidGlass && !classicMode ? (
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
                colors={["rgba(255,255,255,0)", glitterBeamColor, "rgba(255,255,255,0)"]}
                end={{ x: 1, y: 0 }}
                start={{ x: 0, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
            <Animated.Text
              style={[
                styles.glitterSparkle,
                styles.sparkleTop,
                sparkleStyle(sparkleOne),
                { color: glitterColor, textShadowColor: glitterBeamColor },
              ]}
            >
              ✦
            </Animated.Text>
            <Animated.Text
              style={[
                styles.glitterSparkle,
                styles.sparkleMiddle,
                sparkleStyle(sparkleTwo),
                { color: glitterColor, textShadowColor: glitterBeamColor },
              ]}
            >
              ✧
            </Animated.Text>
            <Animated.Text
              style={[
                styles.glitterSparkle,
                styles.sparkleBottom,
                sparkleStyle(sparkleThree),
                { color: glitterColor, textShadowColor: glitterBeamColor },
              ]}
            >
              ✦
            </Animated.Text>
          </View>
        ) : null}
        <View style={styles.authorRow}>
          <Pressable accessibilityLabel={`View ${username}'s profile`} accessibilityRole="button" onPress={openAuthorProfile}>
            <View
              style={[
                styles.avatar,
                isVibesPro && !classicMode && styles.goldenAvatar,
                palette && { borderColor: palette.border, backgroundColor: palette.control },
              ]}
            >
              {avatar && !avatarFailed ? (
                <Image
                  accessibilityLabel={`${username}'s profile picture`}
                  onError={() => setAvatarFailed(true)}
                  source={{ uri: avatar }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={[
                  styles.avatarInitial,
                  isVibesPro && !classicMode && styles.goldenInitial,
                  palette && { color: palette.text },
                ]}>
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
                style={[
                  styles.username,
                  isVibesPro && !classicMode && styles.goldenText,
                  classicMode && { color: palette?.text ?? appColors.text },
                  palette && { color: palette.text },
                ]}
              >
                {username}
              </Text>
              {isVibesPro ? (
                <View
                  style={[
                    styles.vibesBadge,
                    palette && { borderColor: palette.border, backgroundColor: palette.control },
                  ]}
                >
                  <Text style={[styles.vibesBadgeText, palette && { color: palette.controlText }]}>👑 VibesPro</Text>
                </View>
              ) : null}
              <Text style={[
                styles.time,
                isVibesPro && !classicMode && styles.goldenTime,
                classicMode && { color: palette?.mutedText ?? appColors.muted },
                palette && { color: palette.mutedText },
              ]}>
                {getRelativeTime(post.created_at)}
              </Text>
            </View>
            {post.highlighted ? (
              <Text style={[
                styles.highlightBadge,
                isVibesPro && !classicMode && styles.goldenHighlight,
                classicMode && { color: palette?.text ?? appColors.accent },
                palette && { color: palette.text },
              ]}>
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

        {classicMode ? (
          <>
            {text ? (
              <View style={styles.classicCaptionContainer}>
                <Text
                  numberOfLines={classicCaptionExpanded ? undefined : classicCaptionLineLimit}
                  style={[styles.classicCaption, { color: palette?.text ?? appColors.text }]}
                >
                  {text}
                </Text>
                <Text
                  accessible={false}
                  onTextLayout={({ nativeEvent }) => {
                    const hasMore = nativeEvent.lines.length > classicCaptionLineLimit;
                    setClassicCaptionHasMore((current) => current === hasMore ? current : hasMore);
                  }}
                  pointerEvents="none"
                  style={[styles.classicCaption, styles.classicCaptionMeasure]}
                >
                  {text}
                </Text>
                {classicCaptionHasMore ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={classicCaptionExpanded ? "Show less post text" : "Show more post text"}
                    onPress={() => setClassicCaptionExpanded((expanded) => !expanded)}
                    style={styles.classicMoreButton}
                  >
                    <Text style={[styles.classicMoreText, { color: palette?.border ?? appColors.accent }]}>
                      {classicCaptionExpanded ? "Less" : "More"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {post.image_url ? (
              <View style={[
                styles.classicImageFrame,
                {
                  aspectRatio: imageAspectRatio ?? 4 / 3,
                  backgroundColor: palette?.control ?? appColors.control,
                },
              ]}>
                {!imageLoaded && !imageFailed ? (
                  <View style={styles.classicImageLoading}>
                    <ActivityIndicator color={palette?.border ?? appColors.accent} />
                  </View>
                ) : null}
                {imageFailed ? (
                  <Text style={[styles.imageError, { color: palette?.mutedText ?? appColors.muted }]}>
                    This image could not be loaded.
                  </Text>
                ) : imageAspectRatio !== null ? (
                  <Pressable
                    accessibilityLabel={`View full image posted by ${username}`}
                    accessibilityRole="button"
                    onPress={() => setImageOpen(true)}
                    style={styles.classicImagePressable}
                  >
                    <Image
                      accessibilityLabel={`Image posted by ${username}`}
                      onError={() => {
                        setImageLoaded(true);
                        setImageFailed(true);
                      }}
                      onLoad={({ nativeEvent }) => {
                        setImageLoaded(true);
                        const { width, height } = nativeEvent.source;
                        if (width > 0 && height > 0) setImageAspectRatio(width / height);
                      }}
                      resizeMode="contain"
                      source={{ uri: post.image_url }}
                      style={[styles.classicImage, { aspectRatio: imageAspectRatio }]}
                    />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <View style={styles.classicActions}>
              <Pressable
                accessibilityLabel={`${liked ? "Unlike" : "Like"} post, ${likesCount} likes`}
                accessibilityRole="button"
                disabled={likeBusy}
                onPress={() => void toggleLike()}
                style={({ pressed }) => [
                  styles.classicAction,
                  { backgroundColor: palette?.control ?? appColors.raised, borderColor: palette?.border ?? appColors.border },
                  pressed && (isLiquidGlass ? NATIVE_LIQUID_GLASS_PRESSED : styles.pressed),
                ]}
              >
                <Text style={[styles.classicActionText, { color: palette?.text ?? appColors.text }]}>
                  {liked ? "♥" : "♡"} {likesCount}
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel={`Open ${commentCount} comments`}
                accessibilityRole="button"
                onPress={() => setCommentsOpen(true)}
                style={({ pressed }) => [
                  styles.classicAction,
                  { backgroundColor: palette?.control ?? appColors.raised, borderColor: palette?.border ?? appColors.border },
                  pressed && (isLiquidGlass ? NATIVE_LIQUID_GLASS_PRESSED : styles.pressed),
                ]}
              >
                <Text style={[styles.classicActionText, { color: palette?.text ?? appColors.text }]}>
                  Comment {commentCount}
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Share post"
                accessibilityRole="button"
                onPress={() => void share()}
                style={({ pressed }) => [
                  styles.classicAction,
                  { backgroundColor: palette?.control ?? appColors.raised, borderColor: palette?.border ?? appColors.border },
                  pressed && (isLiquidGlass ? NATIVE_LIQUID_GLASS_PRESSED : styles.pressed),
                ]}
              >
                <Text style={[styles.classicActionText, { color: palette?.text ?? appColors.text }]}>Share</Text>
              </Pressable>
            </View>
          </>
        ) : post.image_url ? (
          <View
            style={[
              styles.imagePostLayout,
              wideLayout && styles.imagePostLayoutWide,
              (!text || usePhotoMode) && styles.imageOnlyPostLayout,
            ]}
          >
            <View
              style={[
                styles.imageFrame,
                {
                  width: wideLayout || !text || usePhotoMode ? "100%" : "45%",
                  ...(text && !usePhotoMode
                    ? { height: imagePostHeight }
                    : { height: imageOnlyHeight }),
                },
                isVibesPro && styles.goldenImageFrame,
                palette && { borderColor: palette.border, backgroundColor: palette.control },
              ]}
            >
              {!imageLoaded && !imageFailed ? (
                <View style={styles.imageLoading}>
                  <ActivityIndicator color={palette?.border ?? (isVibesPro ? "#a16207" : "#0284c7")} />
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
                    onLoad={() => setImageLoaded(true)}
                    resizeMode="cover"
                    source={{ uri: post.image_url }}
                    style={styles.postImage}
                  />
                </Pressable>
              )}
              {usePhotoMode ? (
                <Pressable
                  accessibilityLabel="Read photo caption"
                  accessibilityRole="button"
                  onPress={() => setReadingOpen(true)}
                  style={({ pressed }) => [
                    styles.photoReadIsland,
                    pressed && (isLiquidGlass ? NATIVE_LIQUID_GLASS_PRESSED : styles.pressed),
                  ]}
                >
                  <Text style={[styles.photoReadText, palette && { color: palette.controlText }]}>Read</Text>
                  <ChevronDown color={palette?.controlText ?? "#fcd34d"} size={15} strokeWidth={2.5} />
                </Pressable>
              ) : null}
            </View>

            <View
              style={[
                styles.imageDetails,
                text && !usePhotoMode && { height: imagePostHeight },
                (!text || usePhotoMode) && styles.imageOnlyDetails,
                wideLayout && styles.imageDetailsWide,
                usePhotoMode && styles.imageDetailsWide,
              ]}
            >
              {text && !usePhotoMode ? (
                <View
                  style={[
                    styles.captionFrame,
                    styles.imageCaptionFrame,
                    { height: imageCaptionHeight },
                    isVibesPro && styles.goldenCaptionFrame,
                    palette && { borderColor: palette.border, backgroundColor: palette.caption },
                  ]}
                >
                  <View style={styles.imageCaptionContent}>
                    <ScrollView
                      nestedScrollEnabled
                      scrollEnabled={captionScrollable}
                      onContentSizeChange={(_, height) => updateCaptionContent(height)}
                      onLayout={({ nativeEvent }) => updateCaptionViewport(nativeEvent.layout.height)}
                      onScroll={({ nativeEvent }) => {
                        if (nativeEvent.contentOffset.y > 4) setCaptionHasScrolled(true);
                      }}
                      scrollEventThrottle={16}
                      showsVerticalScrollIndicator
                      style={styles.imageCaptionScroll}
                    >
                      <Text style={[
                        styles.captionText,
                        wideLayout && styles.captionTextWide,
                        isVibesPro && styles.goldenCaptionText,
                        palette && { color: palette.captionText },
                      ]}>
                        {text}
                      </Text>
                    </ScrollView>
                    {longText && captionHasScrolled ? (
                      <View pointerEvents="box-none" style={styles.moreOverlay}>
                        <Pressable
                          accessibilityLabel="Read full post text"
                          accessibilityRole="button"
                          onPress={() => setReadingOpen(true)}
                          style={styles.moreButton}
                        >
                          <Text style={styles.moreText}>More</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : null}
              <View
                style={[
                  styles.imageInteractions,
                  (!text || usePhotoMode) && styles.imageOnlyInteractions,
                  (!text || usePhotoMode) && styles.separatedInteractions,
                ]}
              >
                <Pressable
                  accessibilityLabel={`${liked ? "Unlike" : "Like"} post, ${likesCount} likes`}
                  accessibilityRole="button"
                  disabled={likeBusy}
                  onPress={() => void toggleLike()}
                  style={({ pressed }) => [
                    styles.imageInteractionButton,
                    (!text || usePhotoMode) && styles.imageOnlyInteractionButton,
                    (!text || usePhotoMode) && styles.separatedInteractionButton,
                    isVibesPro && styles.goldenInteraction,
                    palette && { borderColor: palette.border, backgroundColor: palette.control },
                    pressed && (isLiquidGlass ? NATIVE_LIQUID_GLASS_PRESSED : styles.pressed),
                  ]}
                >
                  <Text style={[styles.interactionText, isVibesPro && styles.goldenInteractionText, palette && { color: palette.controlText }]}>
                    {liked ? "❤️" : "🤍"} {likesCount}{(!text || usePhotoMode) ? " likes" : ""}
                  </Text>
                </Pressable>
                {(!text || usePhotoMode) ? (
                  <Pressable
                    accessibilityLabel="Open post"
                    accessibilityRole="button"
                    onPress={onOpen}
                    style={({ pressed }) => [
                      styles.imageInteractionButton,
                      styles.imageOnlyInteractionButton,
                      styles.separatedInteractionButton,
                      isVibesPro && styles.goldenInteraction,
                      palette && { borderColor: palette.border, backgroundColor: palette.control },
                      pressed && (isLiquidGlass ? NATIVE_LIQUID_GLASS_PRESSED : styles.pressed),
                    ]}
                  >
                    <Focus color={palette?.controlText ?? (isVibesPro ? "#451a03" : "#0369a1")} size={19} strokeWidth={2.2} />
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityLabel={`Open ${commentCount} comments`}
                  accessibilityRole="button"
                  onPress={() => setCommentsOpen(true)}
                  style={({ pressed }) => [
                    styles.imageInteractionButton,
                    (!text || usePhotoMode) && styles.imageOnlyInteractionButton,
                    (!text || usePhotoMode) && styles.separatedInteractionButton,
                    isVibesPro && styles.goldenInteraction,
                    palette && { borderColor: palette.border, backgroundColor: palette.control },
                    pressed && (isLiquidGlass ? NATIVE_LIQUID_GLASS_PRESSED : styles.pressed),
                  ]}
                >
                  <Text style={[styles.interactionText, isVibesPro && styles.goldenInteractionText, palette && { color: palette.controlText }]}>
                    💬 {commentCount}{(!text || usePhotoMode) ? " comments" : ""}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : text ? (
          <>
            <View style={[
              styles.captionFrame,
              styles.textOnlyFrame,
              isVibesPro && styles.goldenCaptionFrame,
              palette && { borderColor: palette.border, backgroundColor: palette.caption },
            ]}>
              <ScrollView
                nestedScrollEnabled
                onContentSizeChange={(_, height) => updateCaptionContent(height)}
                onLayout={({ nativeEvent }) => updateCaptionViewport(nativeEvent.layout.height)}
                scrollEnabled={captionScrollable}
                showsVerticalScrollIndicator
                style={styles.textOnlyScroll}
              >
                <Text style={[
                  styles.captionText,
                  wideLayout && styles.captionTextWide,
                  isVibesPro && styles.goldenCaptionText,
                  palette && { color: palette.captionText },
                ]}>
                  {text}
                </Text>
              </ScrollView>
            </View>
            <View style={styles.separatedInteractions}>
              <Pressable
                accessibilityLabel={`${liked ? "Unlike" : "Like"} post, ${likesCount} likes`}
                accessibilityRole="button"
                disabled={likeBusy}
                onPress={() => void toggleLike()}
                style={({ pressed }) => [
                  styles.interactionButton,
                  styles.separatedInteractionButton,
                  isVibesPro && styles.goldenInteraction,
                  palette && { borderColor: palette.border, backgroundColor: palette.control },
                  pressed && (isLiquidGlass ? NATIVE_LIQUID_GLASS_PRESSED : styles.pressed),
                ]}
              >
                <Text style={[styles.interactionText, isVibesPro && styles.goldenInteractionText, palette && { color: palette.controlText }]}>
                  {liked ? "❤️" : "🤍"} {likesCount} likes
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Open post"
                accessibilityRole="button"
                onPress={onOpen}
                style={({ pressed }) => [
                  styles.interactionButton,
                  styles.separatedInteractionButton,
                  isVibesPro && styles.goldenInteraction,
                  palette && { borderColor: palette.border, backgroundColor: palette.control },
                  pressed && (isLiquidGlass ? NATIVE_LIQUID_GLASS_PRESSED : styles.pressed),
                ]}
              >
                <Focus color={palette?.controlText ?? (isVibesPro ? "#451a03" : "#0369a1")} size={19} strokeWidth={2.2} />
              </Pressable>
              <Pressable
                accessibilityLabel={`Open ${commentCount} comments`}
                accessibilityRole="button"
                onPress={() => setCommentsOpen(true)}
                style={({ pressed }) => [
                  styles.interactionButton,
                  styles.separatedInteractionButton,
                  isVibesPro && styles.goldenInteraction,
                  palette && { borderColor: palette.border, backgroundColor: palette.control },
                  pressed && (isLiquidGlass ? NATIVE_LIQUID_GLASS_PRESSED : styles.pressed),
                ]}
              >
                <Text style={[styles.interactionText, isVibesPro && styles.goldenInteractionText, palette && { color: palette.controlText }]}>
                  💬 {commentCount} comments
                </Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </NativeGlassSurface>

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
          <NativeBlurBackdrop
            intensity={80}
            overlayColor={isLiquidGlass ? "rgba(18,20,22,0.12)" : "rgba(15,23,42,0.25)"}
          />
          <Pressable
            accessibilityLabel="Close reading mode"
            onPress={() => setReadingOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <NativeGlassSurface
            enabled={isLiquidGlass}
            blurEnabled={Platform.OS !== "android"}
            style={[
              styles.readingCard,
              isVibesPro && styles.goldenReadingCard,
              palette && { borderColor: palette.border, backgroundColor: palette.reading },
            ]}
            overlayColor="rgba(235,240,242,0.12)"
          >
            <View style={styles.readingHeader}>
              <View style={styles.readingHeading}>
                <Text numberOfLines={1} style={[styles.readingAuthor, isVibesPro && styles.goldenText, palette && { color: palette.text }]}>{username}</Text>
                <Text style={[styles.readingTime, isVibesPro && styles.goldenTime, palette && { color: palette.mutedText }]}>{getRelativeTime(post.created_at)}</Text>
              </View>
              <View style={styles.readingActions}>
                <Pressable
                  accessibilityLabel="Copy post text"
                  accessibilityRole="button"
                  onPress={() => void copyPostText()}
                  style={[
                    styles.readingPhotoButton,
                    isVibesPro && styles.goldenPhotoButton,
                    palette && { borderColor: palette.border, backgroundColor: palette.control },
                  ]}
                >
                  <Text style={[styles.readingPhotoText, isVibesPro && styles.goldenText, palette && { color: palette.controlText }]}>Copy</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setReadingOpen(false)}
                  style={[
                    styles.readingPhotoButton,
                    isVibesPro && styles.goldenPhotoButton,
                    palette && { borderColor: palette.border, backgroundColor: palette.control },
                  ]}
                >
                  <Text style={[styles.readingPhotoText, isVibesPro && styles.goldenText, palette && { color: palette.controlText }]}>Show photo</Text>
                </Pressable>
              </View>
            </View>
            <ScrollView
              contentContainerStyle={styles.readingTextContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator
              style={[styles.readingTextScroll, palette && { backgroundColor: palette.control }]}
            >
              <Text style={[styles.readingText, isVibesPro && styles.goldenText, palette && { color: palette.readingText }]}>{text}</Text>
            </ScrollView>
          </NativeGlassSurface>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setImageOpen(false)}
        statusBarTranslucent
        transparent
        visible={imageOpen}
      >
        <View style={styles.imageViewer}>
          <NativeBlurBackdrop intensity={40} overlayColor="rgba(2,6,23,0.48)" />
          <Pressable accessibilityRole="button" onPress={() => setImageOpen(false)} style={StyleSheet.absoluteFill} />
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
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "relative",
    overflow: "hidden",
    marginHorizontal: 8,
    marginBottom: 8,
    padding: 19,
    borderRadius: 28,
    shadowColor: "#0c4a6e",
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  classicCard: {
    padding: 14,
    borderWidth: 1,
    borderRadius: 14,
    shadowColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  standardCard: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  liquidGlassCard: {
    borderWidth: 1,
    backgroundColor: "transparent",
    shadowColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
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
  classicCaption: {
    fontSize: 15,
    lineHeight: 22,
  },
  classicCaptionContainer: { position: "relative", marginBottom: 12 },
  classicCaptionMeasure: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    marginBottom: 0,
    opacity: 0,
  },
  classicMoreButton: { alignSelf: "flex-start", marginTop: 4, paddingVertical: 2 },
  classicMoreText: { fontSize: 13, fontWeight: "700" },
  classicImageFrame: {
    width: "100%",
    position: "relative",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderRadius: 12,
  },
  classicImagePressable: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  classicImage: { width: "100%", height: "100%" },
  classicImageLoading: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  classicActions: { flexDirection: "row", gap: 8 },
  classicAction: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1,
    borderRadius: 10,
  },
  classicActionText: { fontSize: 12, fontWeight: "700", textAlign: "center" },
  goldenHighlight: { color: "#451a03" },
  imagePostLayout: { flexDirection: "row", alignItems: "stretch", gap: 10 },
  imagePostLayoutWide: { flexDirection: "column", gap: 12 },
  imageDetails: { width: "55%", justifyContent: "space-between", minHeight: 136 },
  imageDetailsWide: { width: "100%" },
  imageOnlyPostLayout: { flexDirection: "column", gap: 0 },
  imageOnlyDetails: { width: "100%", minHeight: 0 },
  imageFrame: {
    position: "relative",
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
  photoReadIsland: {
    position: "absolute",
    top: 10,
    alignSelf: "center",
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(252,211,77,0.65)",
    borderRadius: 999,
    backgroundColor: "rgba(17,17,20,0.9)",
  },
  photoReadText: { color: "#ffffff", fontSize: 11, fontWeight: "800" },
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
  imageCaptionFrame: { minHeight: 0, padding: 10, backgroundColor: "rgba(255,255,255,0.72)" },
  imageCaptionContent: { flex: 1, minHeight: 0, position: "relative" },
  imageCaptionScroll: { flex: 1, minHeight: 0 },
  moreOverlay: { position: "absolute", left: 0, bottom: 0, right: 0, alignItems: "flex-start" },
  textOnlyFrame: { minHeight: 80, maxHeight: 240 },
  textOnlyScroll: { maxHeight: 240 },
  captionText: { color: "#334155", fontSize: 15, fontWeight: "500", lineHeight: 22 },
  captionTextWide: { fontSize: 17, lineHeight: 25 },
  goldenCaptionText: { color: "#3b1b00" },
  moreButton: {
    alignSelf: "flex-start",
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
  imageOnlyInteractions: { flexDirection: "row", marginTop: 13 },
  imageOnlyInteractionButton: {
    flex: 1,
    minHeight: 42,
  },
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
  separatedInteractions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 13,
  },
  separatedInteractionButton: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
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
