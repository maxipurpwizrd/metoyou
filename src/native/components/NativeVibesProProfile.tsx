import { useEffect, useRef, useState, type ComponentRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import * as ExpoLinking from "expo-linking";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { nativeSupabase } from "../lib/supabase";
import { useRouter } from "expo-router";
import { MessageCircle } from "lucide-react-native";
import type { NativeProfile } from "../lib/profile";
import type { PostRecord } from "../../types/post";
import NativeBlurBackdrop from "./NativeBlurBackdrop";
import NativeConfirmDialog from "./NativeConfirmDialog";
import NativeSkeleton from "./NativeSkeleton";
import { NativeProfilePostsSkeleton } from "./NativeScreenSkeletons";
import { useNativeTheme } from "../contexts/NativeThemeProvider";

const REPORT_REASONS = [
  "Spam",
  "Harassment",
  "Impersonation",
  "Inappropriate content",
  "Scam/Fraud",
  "Other",
];

function NativeRangeControl({
  label,
  minimum,
  maximum,
  step,
  value,
  onChange,
  isBlueSky = false,
}: {
  label: string;
  minimum: number;
  maximum: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  isBlueSky?: boolean;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const ratio = (value - minimum) / (maximum - minimum);
  const updateValue = (locationX: number) => {
    if (trackWidth === 0) return;
    const boundedRatio = Math.max(0, Math.min(1, locationX / trackWidth));
    const rawValue = minimum + boundedRatio * (maximum - minimum);
    const steppedValue = minimum + Math.round((rawValue - minimum) / step) * step;
    onChange(Number(steppedValue.toFixed(2)));
  };

  return (
    <View style={styles.rangeControl}>
      <View style={styles.rangeLabelRow}>
        <Text style={[styles.controlLabel, isBlueSky && styles.blueSkyText]}>{label}</Text>
        <Text style={styles.rangeValue}>{value.toFixed(step < 1 ? 1 : 0)}</Text>
      </View>
      <View
        accessibilityLabel={label}
        accessibilityValue={{ min: minimum, max: maximum, now: value }}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) => updateValue(event.nativeEvent.locationX)}
        onResponderMove={(event) => updateValue(event.nativeEvent.locationX)}
        onStartShouldSetResponder={() => true}
        style={styles.rangeTrack}
      >
        <View style={[styles.rangeFill, isBlueSky && styles.blueSkyRangeFill, { width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }]} />
        <View style={[styles.rangeThumb, isBlueSky && styles.blueSkyRangeThumb, { left: `${Math.max(0, Math.min(1, ratio)) * 100}%` }]} />
      </View>
    </View>
  );
}

function decodeBase64(value: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const binaryLength = Math.floor((value.length * 3) / 4) -
    (value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0);
  const bytes = new Uint8Array(binaryLength);
  let byteIndex = 0;
  for (let index = 0; index < value.length; index += 4) {
    const first = alphabet.indexOf(value[index]);
    const second = alphabet.indexOf(value[index + 1]);
    const third = alphabet.indexOf(value[index + 2]);
    const fourth = alphabet.indexOf(value[index + 3]);
    const combined = (first << 18) | (second << 12) | ((third & 63) << 6) | (fourth & 63);
    if (byteIndex < binaryLength) bytes[byteIndex++] = (combined >> 16) & 255;
    if (byteIndex < binaryLength) bytes[byteIndex++] = (combined >> 8) & 255;
    if (byteIndex < binaryLength) bytes[byteIndex++] = combined & 255;
  }
  return bytes;
}

type Props = {
  profile: NativeProfile;
  posts: Array<PostRecord & { liked?: boolean }>;
  followerCount: number;
  followerCountLoading: boolean;
  postsLoading: boolean;
  viewerId: string;
  isFollowing: boolean;
  isFollowedBy: boolean;
  followLoading: boolean;
  onFollow: () => void;
  onProfileUpdated: (profile: NativeProfile) => void;
  onOpenPost: (post: PostRecord) => void;
  onBack: () => void;
};

export default function NativeVibesProProfile({
  profile,
  posts,
  followerCount,
  followerCountLoading,
  postsLoading,
  viewerId,
  isFollowing,
  isFollowedBy,
  followLoading,
  onFollow,
  onProfileUpdated,
  onOpenPost,
  onBack,
}: Props) {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme } = useNativeTheme();
  const isBlueSky = theme === "bluesky";
  const carouselRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const isOwnProfile = profile.id === viewerId;
  const [menuOpen, setMenuOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [accountStatus, setAccountStatus] = useState<{
    account_status: string;
    reason: string | null;
    effective_at: string | null;
    appeal_id: string | null;
    appeal_status: string | null;
  } | null>(null);
  const [appealDetails, setAppealDetails] = useState("");
  const [appealBusy, setAppealBusy] = useState(false);
  const [appealMessage, setAppealMessage] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [problemOpen, setProblemOpen] = useState(false);
  const [problemDescription, setProblemDescription] = useState("");
  const [problemBusy, setProblemBusy] = useState(false);
  const [problemMessage, setProblemMessage] = useState<string | null>(null);
  const [blockConfirmation, setBlockConfirmation] = useState(false);
  const [unfollowConfirmation, setUnfollowConfirmation] = useState(false);
  const [portraitConfirmation, setPortraitConfirmation] = useState(false);
  const [cropChoiceOpen, setCropChoiceOpen] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropAsset, setCropAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffsetX, setCropOffsetX] = useState(0);
  const [cropOffsetY, setCropOffsetY] = useState(0);
  const [portraitBusy, setPortraitBusy] = useState(false);
  const [activePost, setActivePost] = useState(0);
  const portraitUrl = profile.vibes_pro_portrait ?? profile.profile_pic ?? null;
  const cardWidth = Math.min(Math.round(width * 0.56), 240);
  const followLabel = isFollowing && isFollowedBy
    ? "Friend"
    : isFollowing
      ? "Following"
      : isFollowedBy
        ? "Follow back"
        : "Follow";

  useEffect(() => {
    if (!statusOpen) return;
    let active = true;
    setStatusLoading(true);
    setStatusError(null);
    void (async () => {
        try {
          const { data, error } = await nativeSupabase.rpc("get_my_moderation_status");
          if (error) throw error;
          const row = Array.isArray(data) ? data[0] : data;
          if (!active) return;
          setAccountStatus({
            account_status: row?.account_status ?? "normal",
            reason: row?.reason ?? null,
            effective_at: row?.effective_at ?? null,
            appeal_id: row?.appeal_id ?? null,
            appeal_status: row?.appeal_status ?? null,
          });
        } catch (cause) {
          if (active) setStatusError(cause instanceof Error ? cause.message : "Could not load profile status.");
        } finally {
          if (active) setStatusLoading(false);
        }
    })();
    return () => {
        active = false;
    };
  }, [statusOpen]);

  const shareProfile = async () => {
    try {
      await Share.share({
        title: `${profile.username}'s profile`,
        message: `Check out @${profile.username} on MeToYou.`,
        url: ExpoLinking.createURL(`/profile/${encodeURIComponent(profile.username)}`),
      });
    } catch (cause) {
      Alert.alert(
        "Could not share profile",
        cause instanceof Error ? cause.message : "Please try again.",
      );
    }
  };

  const selectPortrait = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Photo access needed", "Allow photo access to choose a VibesPro portrait.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
      });
      if (result.canceled) return;
      setCropAsset(result.assets[0]);
      setCropChoiceOpen(true);
    } catch (cause) {
      Alert.alert(
        "Could not select portrait",
        cause instanceof Error ? cause.message : "Please try again.",
      );
    }
  };

  const uploadPortrait = async (crop: boolean) => {
    if (!cropAsset?.uri || portraitBusy) return;
    setPortraitBusy(true);
    try {
      const width = cropAsset.width;
      const height = cropAsset.height;
      const resizeWidth = crop ? 1000 : Math.min(1200, width);
      const cropSize = Math.max(1, Math.floor(Math.min(width, height) / cropZoom));
      const cropOriginX = Math.round(Math.max(0, Math.min(width - cropSize, (width - cropSize) / 2 + cropOffsetX)));
      const cropOriginY = Math.round(Math.max(0, Math.min(height - cropSize, (height - cropSize) / 2 + cropOffsetY)));
      const actions = crop
        ? [
            {
              crop: {
                originX: cropOriginX,
                originY: cropOriginY,
                width: cropSize,
                height: cropSize,
              },
            },
            { resize: { width: resizeWidth, height: resizeWidth } },
          ]
        : [{ resize: { width: resizeWidth } }];
      const optimized = await manipulateAsync(cropAsset.uri, actions, {
        base64: true,
        compress: crop ? 0.92 : 0.8,
        format: SaveFormat.JPEG,
      });
      if (!optimized.base64) throw new Error("The selected portrait could not be processed.");

      const path = `${profile.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const storage = nativeSupabase.storage.from("profile-pictures");
      const { error: uploadError } = await storage.upload(path, decodeBase64(optimized.base64), {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const url = storage.getPublicUrl(path).data.publicUrl;
      const update = {
        vibes_pro_portrait: url,
        profile_pic: profile.profile_pic ?? url,
      };
      const { error: profileError } = await nativeSupabase
        .from("profiles")
        .update(update)
        .eq("id", profile.id);
      if (profileError) throw profileError;

      onProfileUpdated({ ...profile, ...update });
      setCropAsset(null);
      setCropOpen(false);
      setCropChoiceOpen(false);
      setPortraitConfirmation(false);
      setCropZoom(1);
      setCropOffsetX(0);
      setCropOffsetY(0);
    } catch (cause) {
      Alert.alert(
        "VibesPro portrait upload failed",
        cause instanceof Error ? cause.message : "Please try again.",
      );
    } finally {
      setPortraitBusy(false);
    }
  };

  const submitReport = async () => {
    setReportBusy(true);
    try {
      const { error } = await nativeSupabase.from("reports").insert({
        reporter_user_id: viewerId,
        reported_user_id: profile.id,
        reported_post_id: null,
        reason: reportReason,
        details: reportDetails.trim() || null,
        status: "pending",
      });
      if (error) throw error;
      setReportSubmitted(true);
    } catch (cause) {
      Alert.alert(
        "Could not submit report",
        cause instanceof Error ? cause.message : "Please try again.",
      );
    } finally {
      setReportBusy(false);
    }
  };

  const submitProblem = async () => {
    if (!problemDescription.trim()) return;
    setProblemBusy(true);
    setProblemMessage(null);
    try {
      const { error } = await nativeSupabase.from("support_tickets").insert({
        user_id: viewerId,
        category: "profile",
        description: problemDescription.trim(),
        status: "open",
        technical_context: {
          app_version: "native",
          platform: Platform.OS,
          route: `/profile/${profile.username}`,
          timestamp: new Date().toISOString(),
        },
      });
      if (error) throw error;
      setProblemDescription("");
      setProblemMessage("Thanks. Your report was sent.");
    } catch (cause) {
      setProblemMessage(cause instanceof Error ? cause.message : "Could not send your report.");
    } finally {
      setProblemBusy(false);
    }
  };

  const blockUser = async () => {
    const { error } = await nativeSupabase.from("user_blocks").insert({
      blocker_user_id: viewerId,
      blocked_user_id: profile.id,
    });
    if (error && error.code !== "23505") throw error;
    Alert.alert("User blocked", "Their profile and posts will no longer be shown.", [
      { text: "Back", onPress: onBack },
    ]);
  };

  const submitAppeal = async () => {
    if (!accountStatus?.appeal_id || !appealDetails.trim()) return;
    setAppealBusy(true);
    setAppealMessage(null);
    try {
      const { error } = await nativeSupabase
        .from("moderation_appeals")
        .update({ details: appealDetails.trim() })
        .eq("id", accountStatus.appeal_id);
      if (error) throw error;
      setAppealMessage("Your appeal was submitted.");
    } catch (cause) {
      setAppealMessage(cause instanceof Error ? cause.message : "Could not submit your appeal.");
    } finally {
      setAppealBusy(false);
    }
  };

  const onCarouselScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / (cardWidth + 12));
    setActivePost(Math.max(0, Math.min(posts.length - 1, index)));
  };

  const handleFollowPress = () => {
    if (isFollowing && isFollowedBy) {
      setUnfollowConfirmation(true);
      return;
    }
    onFollow();
  };

  const menuActions: Array<{
    icon: string;
    label: string;
    action: () => void;
    disabled?: boolean;
    danger?: boolean;
  }> = isOwnProfile
    ? [
        { icon: "◉", label: "Profile status", action: () => setStatusOpen(true) },
        { icon: "↗", label: "Share", action: () => void shareProfile() },
        { icon: "✦", label: "Upgrade", disabled: true, action: () => undefined },
        { icon: "⚑", label: "Report a problem", action: () => { setProblemMessage(null); setProblemOpen(true); } },
      ]
    : [
        { icon: "↗", label: "Share", action: () => void shareProfile() },
        { icon: "⚑", label: "Report", action: () => { setReportSubmitted(false); setReportOpen(true); } },
        { icon: "⊘", label: "Block", danger: true, action: () => setBlockConfirmation(true) },
      ];

  return (
    <View style={[styles.root, isBlueSky && styles.blueSkyRoot]}>
      <SafeAreaView edges={["top", "bottom"]} style={[styles.safeArea, isBlueSky && styles.blueSkyRoot]}>
        <View style={[styles.hero, isBlueSky && styles.blueSkyHero, { height: Math.round((height - insets.top - insets.bottom) * 0.58) }]}>
          {!portraitUrl && isBlueSky ? (
            <LinearGradient colors={["#061a3a", "#0b3b78", "#125baa"]} style={StyleSheet.absoluteFill} />
          ) : !portraitUrl ? (
            <ImageBackground
              source={require("../../components/VibesPro/assets/throne-template.webp")}
              resizeMode="cover"
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <Image source={{ uri: portraitUrl }} style={styles.portraitFrame} resizeMode="cover" />
          )}
          <LinearGradient
            colors={portraitUrl
              ? ["rgba(0,0,0,0.18)", "rgba(0,0,0,0.22)", "rgba(0,0,0,0.72)"]
              : ["rgba(0,0,0,0.2)", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.72)"]}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={[styles.frameOuter, isBlueSky && styles.blueSkyFrameOuter]} />
          <View pointerEvents="none" style={[styles.frameInner, isBlueSky && styles.blueSkyFrameInner]} />

          <View style={styles.topBar}>
            <Pressable accessibilityLabel="Go back" onPress={onBack} style={[styles.heroButton, isBlueSky && styles.blueSkyFollowButton]}>
              <Text style={styles.heroButtonText}>←</Text>
            </Pressable>
            {isOwnProfile ? (
              <Pressable
                accessibilityLabel="Profile actions"
                onPress={() => setMenuOpen(true)}
                style={[styles.centerMenuButton, isBlueSky && styles.blueSkyFollowButton]}
              >
                <View style={styles.menuGridIcon}>
                  {Array.from({ length: 4 }, (_, index) => <View key={index} style={[styles.menuGridCell, isBlueSky && styles.blueSkyGridCell]} />)}
                </View>
              </Pressable>
            ) : null}
            <View style={styles.topActions}>
              {isOwnProfile ? (
                <Pressable
                  accessibilityLabel="Open settings"
                  onPress={() => router.push("/(app)/settings")}
                  style={[styles.heroButton, isBlueSky && styles.blueSkyFollowButton]}
                >
                  <Text style={styles.heroButtonText}>⚙</Text>
                </Pressable>
              ) : (
                <Pressable
                  accessibilityLabel="Profile actions"
                  onPress={() => setMenuOpen(true)}
                  style={[styles.heroButton, isBlueSky && styles.blueSkyFollowButton]}
                >
                  <View style={styles.menuGridIcon}>
                    {Array.from({ length: 4 }, (_, index) => <View key={index} style={[styles.menuGridCell, isBlueSky && styles.blueSkyGridCell]} />)}
                  </View>
                </Pressable>
              )}
            </View>
          </View>

          {isOwnProfile ? (
            <Pressable
              accessibilityLabel="Change VibesPro portrait"
              disabled={portraitBusy}
              onPress={() => setPortraitConfirmation(true)}
              style={[styles.cameraButton, isBlueSky && styles.blueSkyFollowButton]}
            >
              {portraitBusy
                ? <ActivityIndicator color={isBlueSky ? "#ffffff" : "#fde68a"} />
                : <Text style={styles.cameraText}>📷</Text>}
            </Pressable>
          ) : null}

          <View style={styles.heroDetails}>
            <Text style={[styles.badge, isBlueSky && styles.blueSkyBadge]}>Vibes Pro</Text>
            <Text numberOfLines={1} style={[styles.username, isBlueSky && styles.blueSkyUsername]}>{profile.username}</Text>
            {!isOwnProfile ? (
              <View style={styles.onlinePill}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>Online</Text>
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({
                pathname: "/profile/followers",
                params: { profileId: profile.id, username: profile.username },
              })}
              style={[styles.followersButton, isBlueSky && styles.blueSkyFollowButton]}
            >
              {followerCountLoading ? (
                <NativeSkeleton style={styles.followersCountSkeleton} />
              ) : (
                <Text style={styles.followersButtonText}>{followerCount} Followers</Text>
              )}
            </Pressable>
            {!isOwnProfile ? (
              <View style={styles.publicActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Message ${profile.username}`}
                  onPress={() => router.push({
                    pathname: "/messages/[recipientId]",
                    params: { recipientId: profile.id },
                  })}
                  style={[styles.messageButton, isBlueSky && styles.blueSkyFollowButton]}
                >
                  <MessageCircle color="#ffffff" size={16} />
                  <Text style={styles.messageText}>Message</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={followLoading}
                  onPress={handleFollowPress}
                  style={[styles.followButton, isBlueSky && styles.blueSkyFollowButton, followLoading && styles.disabled]}
                >
                  {followLoading
                    ? <ActivityIndicator color={isBlueSky ? "#ffffff" : "#451a03"} />
                    : <Text style={[styles.followText, isBlueSky && styles.blueSkyText]}>{followLabel}</Text>}
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>

        <View style={[styles.postsPanel, isBlueSky && styles.blueSkyPanel]}>
          <Text style={[styles.postsHeading, isBlueSky && styles.blueSkyText]}>VIBES</Text>
          {postsLoading ? <NativeProfilePostsSkeleton carousel /> : posts.length === 0 ? (
            <View style={styles.emptyPosts}>
              <Text style={[styles.emptyPostsText, isBlueSky && styles.blueSkyText]}>No Vibes to show yet.</Text>
            </View>
          ) : (
            <>
              <ScrollView
                ref={carouselRef}
                horizontal
                contentContainerStyle={styles.carouselContent}
                decelerationRate="fast"
                onMomentumScrollEnd={onCarouselScroll}
                showsHorizontalScrollIndicator={false}
                snapToInterval={cardWidth + 12}
              >
                {posts.map((post, index) => {
                  const media = post.image_url;
                  const highlighted = Boolean(post.highlighted);
                  return (
                    <Pressable
                      key={post.id}
                      accessibilityRole="button"
                      disabled={!media}
                      onPress={() => media && onOpenPost(post)}
                      style={[styles.postCard, { width: cardWidth, height: Math.min(Math.round(height * 0.24), 210) }]}
                    >
                      {media ? (
                        <Image source={{ uri: media }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                      ) : (
                        <View style={styles.textPost}>
                          <Text numberOfLines={5} style={styles.textPostText}>{post.text || "A Vibe to remember"}</Text>
                        </View>
                      )}
                      <View style={styles.postShade} />
                      <View style={styles.postStats}>
                        <Text style={styles.postStat}>❤️ {post.likes_count ?? 0}</Text>
                        <Text style={styles.postStat}>💬 {post.comments_count ?? 0}</Text>
                        <Text style={[styles.postBadge, isBlueSky && styles.blueSkyAccentText]}>{highlighted ? "Highlight" : "Snapshot"}</Text>
                      </View>
                      {index === activePost ? <View style={[styles.activePostIndicator, isBlueSky && styles.blueSkyActiveDot]} /> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
              <ScrollView
                horizontal
                contentContainerStyle={[styles.carouselDots, { minWidth: width - 56 }]}
                showsHorizontalScrollIndicator={false}
              >
                {posts.map((post, index) => (
                  <Pressable
                    key={post.id}
                    accessibilityLabel={`Go to post ${index + 1}`}
                    onPress={() => {
                      carouselRef.current?.scrollTo({ x: index * (cardWidth + 12), animated: true });
                      setActivePost(index);
                    }}
                    style={[styles.dot, isBlueSky && styles.blueSkyDot, index === activePost && (isBlueSky ? styles.blueSkyActiveDot : styles.activeDot)]}
                  />
                ))}
              </ScrollView>
              <Text style={[styles.premiumCaption, isBlueSky && styles.blueSkyText]}>✦  VIBESPRO MEMBER  ✦</Text>
              <Text style={[styles.carouselHint, isBlueSky && styles.blueSkyMuted]}>{isOwnProfile ? "Your brightest moments" : "Premium member"}</Text>
            </>
          )}
        </View>
      </SafeAreaView>

      <Modal animationType="fade" onRequestClose={() => setMenuOpen(false)} transparent visible={menuOpen}>
        <View style={styles.modalBackdrop}>
          <NativeBlurBackdrop intensity={18} overlayColor="rgba(2,6,23,0.38)" />
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} />
          <View style={[styles.menuCard, isBlueSky && styles.blueSkyPanel]}>
            <View style={[styles.modalHeadingRow, isBlueSky && styles.blueSkyPanel]}>
              <Text style={[styles.modalTitle, isBlueSky && styles.blueSkyText]}>Profile actions</Text>
              <Pressable onPress={() => setMenuOpen(false)}><Text style={[styles.closeText, isBlueSky && styles.blueSkyText]}>×</Text></Pressable>
            </View>
            <View style={styles.menuActionGrid}>
              {menuActions.map((action) => (
                <Pressable
                  key={action.label}
                  disabled={Boolean(action.disabled)}
                  onPress={() => {
                    setMenuOpen(false);
                    action.action();
                  }}
                  style={[
                    styles.menuActionTile,
                    isBlueSky && styles.blueSkyActionTile,
                    action.danger && styles.menuDangerTile,
                    action.disabled && styles.disabled,
                  ]}
                >
                  <Text style={[styles.menuIcon, isBlueSky && styles.blueSkyText, action.danger && styles.dangerText]}>{action.icon}</Text>
                  <Text style={[styles.menuLabel, isBlueSky && styles.blueSkyText, action.danger && styles.dangerText]}>{action.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" onRequestClose={() => setProblemOpen(false)} transparent visible={problemOpen}>
        <View style={styles.modalBackdrop}>
          <NativeBlurBackdrop intensity={18} overlayColor="rgba(2,6,23,0.38)" />
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setProblemOpen(false)} />
          <View style={[styles.reportCard, isBlueSky && styles.blueSkyPanel]}>
            <View style={[styles.modalHeadingRow, isBlueSky && styles.blueSkyPanel]}>
              <Text style={[styles.modalTitle, isBlueSky && styles.blueSkyText]}>Report a problem</Text>
              <Pressable onPress={() => setProblemOpen(false)}><Text style={[styles.closeText, isBlueSky && styles.blueSkyText]}>×</Text></Pressable>
            </View>
            <Text style={[styles.problemCategory, isBlueSky && styles.blueSkyMuted]}>Category · Profile</Text>
            <TextInput
              multiline
              onChangeText={setProblemDescription}
              placeholder="Describe the problem"
              placeholderTextColor="#94a3b8"
              style={[styles.detailsInput, styles.problemInput, isBlueSky && styles.blueSkyInput]}
              value={problemDescription}
            />
            {problemMessage ? <Text style={[styles.problemMessage, isBlueSky && styles.blueSkyText]}>{problemMessage}</Text> : null}
            <Pressable
              disabled={problemBusy || !problemDescription.trim()}
              onPress={() => void submitProblem()}
              style={[styles.submitReport, isBlueSky && styles.blueSkyFollowButton, (problemBusy || !problemDescription.trim()) && styles.disabled]}
            >
              {problemBusy ? <ActivityIndicator color={isBlueSky ? "#ffffff" : "#451a03"} /> : <Text style={[styles.submitReportText, isBlueSky && styles.blueSkyText]}>Send report</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" onRequestClose={() => setStatusOpen(false)} transparent visible={statusOpen}>
        <View style={styles.modalBackdrop}>
          <NativeBlurBackdrop intensity={18} overlayColor="rgba(2,6,23,0.38)" />
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setStatusOpen(false)} />
          <View style={[styles.statusCard, isBlueSky && styles.blueSkyPanel]}>
            <View style={[styles.modalHeadingRow, isBlueSky && styles.blueSkyPanel]}>
              <Text style={[styles.modalTitle, isBlueSky && styles.blueSkyText]}>Profile status</Text>
              <Pressable onPress={() => setStatusOpen(false)}><Text style={[styles.closeText, isBlueSky && styles.blueSkyText]}>×</Text></Pressable>
            </View>
            {statusLoading ? (
              <ActivityIndicator color={isBlueSky ? "#54b8ff" : "#fbbf24"} style={styles.statusLoading} />
            ) : statusError ? (
              <Text style={[styles.statusError, isBlueSky && styles.blueSkyText]}>{statusError}</Text>
            ) : accountStatus ? (
              <>
                <View style={[styles.statusSummary, isBlueSky && styles.blueSkyStatusSummary, accountStatus.account_status === "normal" && styles.statusNormal]}>
                  <Text style={[styles.statusTitle, isBlueSky && styles.blueSkyText]}>
                    {accountStatus.account_status === "normal"
                      ? "Your account is in good standing"
                      : `Account status: ${accountStatus.account_status}`}
                  </Text>
                  {accountStatus.reason ? <Text style={[styles.statusReason, isBlueSky && styles.blueSkyMuted]}>{accountStatus.reason}</Text> : null}
                  {accountStatus.effective_at
                    ? <Text style={[styles.statusReason, isBlueSky && styles.blueSkyMuted]}>{new Date(accountStatus.effective_at).toLocaleDateString()}</Text>
                    : null}
                </View>
                {accountStatus.appeal_id ? (
                  <View style={styles.appealSection}>
                    <Text style={[styles.appealStatus, isBlueSky && styles.blueSkyText]}>Appeal status: {accountStatus.appeal_status ?? "available"}</Text>
                    {!accountStatus.appeal_status || accountStatus.appeal_status === "pending" ? (
                      <>
                        <TextInput
                          multiline
                          onChangeText={setAppealDetails}
                          placeholder="Explain your appeal"
                          placeholderTextColor="#94a3b8"
                          style={[styles.detailsInput, isBlueSky && styles.blueSkyInput]}
                          value={appealDetails}
                        />
                        <Pressable
                          disabled={appealBusy || !appealDetails.trim()}
                          onPress={() => void submitAppeal()}
                          style={[styles.submitReport, isBlueSky && styles.blueSkyFollowButton, (!appealDetails.trim() || appealBusy) && styles.disabled]}
                        >
                          {appealBusy
                            ? <ActivityIndicator color={isBlueSky ? "#ffffff" : "#451a03"} />
                            : <Text style={[styles.submitReportText, isBlueSky && styles.blueSkyText]}>Submit appeal</Text>}
                        </Pressable>
                      </>
                    ) : null}
                    {appealMessage ? <Text style={[styles.statusReason, isBlueSky && styles.blueSkyMuted]}>{appealMessage}</Text> : null}
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        </View>
      </Modal>


      <Modal
        animationType="fade"
        onRequestClose={() => setReportOpen(false)}
        transparent
        visible={reportOpen}
      >
        <View style={styles.modalBackdrop}>
          <NativeBlurBackdrop intensity={18} overlayColor="rgba(2,6,23,0.38)" />
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setReportOpen(false)} />
          <View style={[styles.reportCard, isBlueSky && styles.blueSkyPanel]}>
            <View style={[styles.modalHeadingRow, isBlueSky && styles.blueSkyPanel]}>
              <Text style={[styles.modalTitle, isBlueSky && styles.blueSkyText]}>{reportSubmitted ? "Report submitted" : "Report profile"}</Text>
              <Pressable onPress={() => setReportOpen(false)}><Text style={[styles.closeText, isBlueSky && styles.blueSkyText]}>×</Text></Pressable>
            </View>
            {reportSubmitted ? (
              <Text style={[styles.reportSuccess, isBlueSky && styles.blueSkyText]}>Our moderation team will review your report.</Text>
            ) : (
              <>
              <Text style={[styles.modalSubtitle, isBlueSky && styles.blueSkyMuted]}>Choose a reason</Text>
                <View style={styles.reasonList}>
                  {REPORT_REASONS.map((reason) => (
                    <Pressable key={reason} onPress={() => setReportReason(reason)} style={styles.reasonRow}>
                    <Text style={[styles.reasonChoice, reportReason === reason && styles.selectedReason, isBlueSky && styles.blueSkyText]}>
                        {reportReason === reason ? "● " : "○ "}{reason}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  multiline
                  onChangeText={setReportDetails}
                  placeholder="Additional details (optional)"
                  placeholderTextColor="#94a3b8"
                  style={[styles.detailsInput, isBlueSky && styles.blueSkyInput]}
                  value={reportDetails}
                />
                <Pressable disabled={reportBusy} onPress={() => void submitReport()} style={[styles.submitReport, isBlueSky && styles.blueSkyFollowButton]}>
                  {reportBusy
                    ? <ActivityIndicator color={isBlueSky ? "#ffffff" : "#451a03"} />
                    : <Text style={[styles.submitReportText, isBlueSky && styles.blueSkyText]}>Send report</Text>}
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      <NativeConfirmDialog
        confirmLabel="Unfollow"
        emoji="💔"
        message={`${profile.username} is your friend. Would you like to unfollow them?`}
        onCancel={() => setUnfollowConfirmation(false)}
        onConfirm={async () => {
          setUnfollowConfirmation(false);
          await onFollow();
        }}
        title="Unfollow your friend?"
        visible={unfollowConfirmation}
      />

      <NativeConfirmDialog
        confirmLabel="Yes, change"
        emoji="👑"
        message="Choose a new VibesPro portrait for your profile?"
        onCancel={() => setPortraitConfirmation(false)}
        onConfirm={async () => {
          setPortraitConfirmation(false);
          await selectPortrait();
        }}
        title="Update portrait"
        visible={portraitConfirmation}
      />

      <Modal animationType="fade" onRequestClose={() => setCropChoiceOpen(false)} transparent visible={cropChoiceOpen}>
        <View style={styles.modalBackdrop}>
          <NativeBlurBackdrop intensity={18} overlayColor="rgba(2,6,23,0.38)" />
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCropChoiceOpen(false)} />
          <View style={[styles.cropChoice, isBlueSky && styles.blueSkyPanel]}>
            <Text style={[styles.cropChoiceTitle, isBlueSky && styles.blueSkyText]}>Would you like to crop your portrait?</Text>
            <View style={styles.cropChoiceButtons}>
              <Pressable
                onPress={() => {
                  setCropChoiceOpen(false);
                  void uploadPortrait(false);
                }}
                style={styles.secondaryAction}
              >
                <Text style={styles.secondaryActionText}>No crop</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setCropChoiceOpen(false);
                  setCropOpen(true);
                }}
                style={[styles.goldAction, isBlueSky && styles.blueSkyFollowButton]}
              >
                <Text style={[styles.goldActionText, isBlueSky && styles.blueSkyText]}>Crop photo</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={() => setCropOpen(false)}
        statusBarTranslucent
        visible={cropOpen}
      >
        <SafeAreaView style={[styles.cropScreen, isBlueSky && styles.blueSkyCropScreen]}>
          <View style={[styles.cropHeader, isBlueSky && styles.blueSkyCropHeader]}>
            <View>
              <Text style={[styles.cropOverline, isBlueSky && styles.blueSkyText]}>PORTRAIT PREVIEW</Text>
              <Text style={styles.cropTitle}>Adjust your crop</Text>
            </View>
            <Pressable onPress={() => { setCropOpen(false); setCropAsset(null); }}>
              <Text style={[styles.cropCancel, isBlueSky && styles.blueSkyText]}>Cancel</Text>
            </Pressable>
          </View>
          <View style={styles.cropPreviewArea}>
            {cropAsset ? (
              <Image
                source={{ uri: cropAsset.uri }}
                resizeMode="cover"
                style={[
                  styles.cropPreviewImage,
                  { transform: [{ scale: cropZoom }, { translateX: cropOffsetX }, { translateY: cropOffsetY }] },
                ]}
              />
            ) : null}
            <View
              pointerEvents="none"
              style={[
                styles.cropCircle,
                { width: Math.min(width * 0.72, height * 0.42), height: Math.min(width * 0.72, height * 0.42) },
              ]}
            />
          </View>
          <View style={[styles.cropControls, isBlueSky && styles.blueSkyCropControls]}>
            <NativeRangeControl
              isBlueSky={isBlueSky}
              label="ZOOM"
              maximum={3}
              minimum={1}
              onChange={setCropZoom}
              step={0.1}
              value={cropZoom}
            />
            <View style={styles.cropMovement}>
              <NativeRangeControl
                isBlueSky={isBlueSky}
                label="MOVE X"
                maximum={120}
                minimum={-120}
                onChange={setCropOffsetX}
                step={1}
                value={cropOffsetX}
              />
              <NativeRangeControl
                isBlueSky={isBlueSky}
                label="MOVE Y"
                maximum={120}
                minimum={-120}
                onChange={setCropOffsetY}
                step={1}
                value={cropOffsetY}
              />
            </View>
            <View style={styles.moveControls}>
              <Pressable onPress={() => { setCropOffsetX(0); setCropOffsetY(0); }} style={[styles.centerButton, isBlueSky && styles.blueSkyCenterButton]}><Text style={styles.nudgeText}>Center</Text></Pressable>
            </View>
            <View style={styles.cropFooter}>
              <Pressable onPress={() => { setCropOpen(false); setCropAsset(null); }} style={styles.secondaryAction}>
                <Text style={styles.secondaryActionText}>Discard</Text>
              </Pressable>
              <Pressable disabled={portraitBusy} onPress={() => void uploadPortrait(true)} style={[styles.goldAction, isBlueSky && styles.blueSkyFollowButton]}>
                {portraitBusy ? <ActivityIndicator color={isBlueSky ? "#ffffff" : "#451a03"} /> : <Text style={[styles.goldActionText, isBlueSky && styles.blueSkyText]}>Use portrait</Text>}
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      <NativeConfirmDialog
        confirmLabel="Block"
        destructive
        emoji="🚫"
        message={`Block @${profile.username}? Their profile and posts will no longer be shown.`}
        onCancel={() => setBlockConfirmation(false)}
        onConfirm={blockUser}
        title="Block this user?"
        visible={blockConfirmation}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050509" },
  blueSkyRoot: { backgroundColor: "#061a3a" },
  safeArea: { flex: 1 },
  hero: { position: "relative", overflow: "hidden", backgroundColor: "#0b0b0b" },
  blueSkyHero: { backgroundColor: "#0b3b78" },
  portraitFrame: { ...StyleSheet.absoluteFill, margin: 20, borderRadius: 28 },
  frameOuter: { ...StyleSheet.absoluteFill, margin: 8, borderWidth: 1, borderColor: "rgba(253,230,138,0.58)", borderRadius: 32 },
  blueSkyFrameOuter: { borderColor: "#ffffff" },
  frameInner: { ...StyleSheet.absoluteFill, margin: 20, borderWidth: 1, borderColor: "rgba(245,158,11,0.28)", borderRadius: 28 },
  blueSkyFrameInner: { borderColor: "rgba(255,255,255,0.82)" },
  topBar: { position: "absolute", top: 12, left: 16, right: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topActions: { flexDirection: "row", gap: 10 },
  centerMenuButton: { position: "absolute", left: "50%", marginLeft: -21, width: 42, height: 42, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", borderRadius: 24, backgroundColor: "rgba(0,0,0,0.38)" },
  heroButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", borderRadius: 24, backgroundColor: "rgba(0,0,0,0.38)" },
  heroButtonText: { color: "#ffffff", fontSize: 19, fontWeight: "800" },
  cameraButton: { position: "absolute", top: "43%", left: "44%", width: 52, height: 52, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", borderRadius: 28, backgroundColor: "rgba(0,0,0,0.58)" },
  cameraText: { fontSize: 22 },
  heroDetails: { position: "absolute", left: 18, right: 18, bottom: 14, alignItems: "center", gap: 7 },
  badge: { overflow: "hidden", paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.24)", borderRadius: 99, color: "#fde68a", backgroundColor: "rgba(0,0,0,0.48)", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  blueSkyBadge: { borderColor: "#54b8ff", color: "#ffffff", backgroundColor: "rgba(11,59,120,0.88)" },
  username: { color: "#ffd700", fontSize: 30, fontWeight: "900", textShadowColor: "#7c2d12", textShadowRadius: 10 },
  blueSkyUsername: { color: "#ffffff", textShadowColor: "#155192" },
  onlinePill: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", borderRadius: 99, backgroundColor: "rgba(0,0,0,0.38)" },
  onlineDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#34d399" },
  onlineText: { color: "rgba(255,255,255,0.88)", fontSize: 12 },
  followersButton: { minHeight: 34, justifyContent: "center", paddingHorizontal: 13, borderWidth: 1, borderColor: "rgba(253,230,138,0.48)", borderRadius: 99, backgroundColor: "rgba(0,0,0,0.42)" },
  followersButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
    followersCountSkeleton: { width: 80, height: 12, borderRadius: 7 },
  publicActions: { flexDirection: "row", gap: 10, marginTop: 2 },
  messageButton: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)", borderRadius: 99, backgroundColor: "rgba(0,0,0,0.48)" },
  messageText: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
  followButton: { minWidth: 100, minHeight: 38, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, borderRadius: 99, backgroundColor: "#fbbf24" },
  followText: { color: "#451a03", fontSize: 13, fontWeight: "900" },
  postsPanel: { flex: 1, minHeight: 0, marginHorizontal: 14, marginTop: 12, marginBottom: 12, paddingTop: 11, paddingBottom: 10, overflow: "hidden", borderWidth: 1, borderColor: "rgba(251,191,36,0.24)", borderRadius: 30, backgroundColor: "#08080d" },
  blueSkyPanel: { borderColor: "#3478bd", backgroundColor: "#0b2d5b" },
  blueSkyText: { color: "#ffffff" },
  blueSkyMuted: { color: "rgba(255,255,255,0.78)" },
  blueSkyAccentText: { color: "#54b8ff" },
  blueSkyFollowButton: { borderColor: "#54b8ff", backgroundColor: "#155192" },
  blueSkyInput: { borderColor: "#3478bd", color: "#ffffff", backgroundColor: "#104078" },
  blueSkyGridCell: { backgroundColor: "#ffffff" },
  blueSkyActionTile: { borderColor: "#3478bd", backgroundColor: "#104078" },
  blueSkyStatusSummary: { backgroundColor: "#104078" },
  blueSkyHommieRow: { borderBottomColor: "rgba(84,184,255,0.3)" },
  postsHeading: { marginBottom: 8, color: "rgba(255,255,255,0.52)", fontSize: 10, letterSpacing: 3, textAlign: "center" },
  emptyPosts: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyPostsText: { color: "rgba(255,255,255,0.66)", fontSize: 14 },
  carouselContent: { alignItems: "center", gap: 12, paddingHorizontal: 14, paddingBottom: 5 },
  postCard: { position: "relative", overflow: "hidden", justifyContent: "flex-end", borderWidth: 1, borderColor: "rgba(217,119,6,0.35)", borderRadius: 18, backgroundColor: "#111827" },
  textPost: { flex: 1, alignItems: "center", justifyContent: "center", padding: 14 },
  textPostText: { color: "rgba(255,255,255,0.8)", fontSize: 13, textAlign: "center" },
  postShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.18)" },
  postStats: { zIndex: 1, flexDirection: "row", alignItems: "center", gap: 7, padding: 8 },
  postStat: { overflow: "hidden", paddingHorizontal: 7, paddingVertical: 4, borderRadius: 99, color: "#ffffff", backgroundColor: "rgba(255,255,255,0.14)", fontSize: 10, fontWeight: "700" },
  postBadge: { marginLeft: "auto", color: "#fcd34d", fontSize: 9, fontWeight: "800" },
  activePostIndicator: { position: "absolute", top: 0, left: 0, right: 0, height: 2, backgroundColor: "#fbbf24" },
  carouselDots: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 7, paddingHorizontal: 14 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.3)" },
  activeDot: { backgroundColor: "#fbbf24" },
  blueSkyDot: { backgroundColor: "rgba(255,255,255,0.38)" },
  blueSkyActiveDot: { backgroundColor: "#54b8ff" },
  premiumCaption: { marginTop: 8, color: "#fcd34d", fontSize: 10, fontWeight: "700", letterSpacing: 2, textAlign: "center" },
  carouselHint: { marginTop: 3, color: "rgba(255,255,255,0.58)", fontSize: 10, textAlign: "center" },
  modalBackdrop: { flex: 1, justifyContent: "center", padding: 22, backgroundColor: "rgba(0,0,0,0.76)" },
  menuCard: { width: "100%", maxWidth: 390, padding: 16, borderWidth: 1, borderColor: "rgba(253,230,138,0.3)", borderRadius: 26, backgroundColor: "rgba(2,6,23,0.98)", elevation: 12 },
  modalHeadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, padding: 10, borderWidth: 1, borderColor: "rgba(253,230,138,0.2)", borderRadius: 18, backgroundColor: "rgba(251,191,36,0.1)" },
  modalTitle: { color: "#fff3b0", fontSize: 18, fontWeight: "900" },
  modalSubtitle: { marginTop: 3, color: "rgba(254,243,199,0.7)", fontSize: 12 },
  closeText: { color: "#fde68a", fontSize: 28, lineHeight: 31 },
  menuGridIcon: { width: 23, height: 23, flexDirection: "row", flexWrap: "wrap", gap: 3 },
  menuGridCell: { width: 9, height: 9, borderRadius: 2, backgroundColor: "#fde68a" },
  menuActionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  menuActionTile: { width: "48%", minHeight: 82, flexGrow: 1, alignItems: "center", justifyContent: "center", gap: 7, padding: 10, borderWidth: 1, borderColor: "rgba(253,230,138,0.26)", borderRadius: 16, backgroundColor: "rgba(255,255,255,0.06)" },
  menuDangerTile: { borderColor: "rgba(251,113,133,0.42)", backgroundColor: "rgba(159,18,57,0.12)" },
  menuIcon: { color: "#fde68a", fontSize: 23, fontWeight: "800" },
  menuLabel: { color: "#fff3b0", fontSize: 12, fontWeight: "700", textAlign: "center" },
  disabled: { opacity: 0.55 },
  dangerText: { color: "#fda4af" },
  hommiesCard: { maxHeight: "78%", padding: 14, borderWidth: 1, borderColor: "rgba(253,230,138,0.36)", borderRadius: 28, backgroundColor: "#080b14" },
  searchInput: { marginTop: 14, paddingHorizontal: 13, paddingVertical: 11, borderWidth: 1, borderColor: "rgba(253,230,138,0.26)", borderRadius: 15, color: "#fff3b0", backgroundColor: "rgba(0,0,0,0.35)" },
  hommiesList: { marginTop: 10 },
  emptyHommies: { paddingVertical: 24, color: "rgba(254,243,199,0.7)", fontSize: 13, textAlign: "center" },
  hommieRow: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(253,230,138,0.15)" },
  hommieAvatar: { width: 40, height: 40, borderRadius: 22 },
  hommieFallback: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: "#fbbf24" },
  hommieInitial: { color: "#451a03", fontWeight: "900" },
  hommieName: { color: "#fff3b0", fontSize: 14, fontWeight: "800" },
  hommieLabel: { marginTop: 2, color: "rgba(254,243,199,0.62)", fontSize: 11 },
  reportCard: { maxHeight: "90%", padding: 16, borderRadius: 25, backgroundColor: "#ffffff" },
  statusCard: { maxHeight: "88%", padding: 15, borderWidth: 1, borderColor: "rgba(253,230,138,0.34)", borderRadius: 26, backgroundColor: "#080b14" },
  statusLoading: { marginVertical: 30 },
  statusError: { padding: 20, color: "#fda4af", fontSize: 13 },
  statusSummary: { marginTop: 14, padding: 15, borderRadius: 17, backgroundColor: "rgba(251,191,36,0.12)" },
  statusNormal: { backgroundColor: "rgba(16,185,129,0.14)" },
  statusTitle: { color: "#fff3b0", fontSize: 15, fontWeight: "800" },
  statusReason: { marginTop: 8, color: "rgba(254,243,199,0.75)", fontSize: 13, lineHeight: 19 },
  appealSection: { marginTop: 14 },
  appealStatus: { color: "#fff3b0", fontSize: 13, fontWeight: "800" },
  reasonList: { marginTop: 8 },
  reasonRow: { paddingVertical: 6 },
  reasonChoice: { color: "#475569", fontSize: 13 },
  selectedReason: { color: "#0369a1", fontWeight: "800" },
  detailsInput: { minHeight: 86, marginTop: 12, padding: 12, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 14, color: "#0f172a", textAlignVertical: "top" },
  submitReport: { minHeight: 45, alignItems: "center", justifyContent: "center", marginTop: 12, borderRadius: 14, backgroundColor: "#fbbf24" },
  submitReportText: { color: "#451a03", fontWeight: "900" },
  reportSuccess: { paddingVertical: 25, color: "#047857", fontSize: 14, fontWeight: "700", textAlign: "center" },
  problemCategory: { marginTop: 13, color: "#475569", fontSize: 13, fontWeight: "700" },
  problemInput: { minHeight: 130 },
  problemMessage: { marginTop: 8, color: "#047857", fontSize: 13, fontWeight: "700" },
  cropChoice: { position: "absolute", left: 20, right: 20, top: "45%", zIndex: 10, padding: 18, borderWidth: 1, borderColor: "rgba(253,230,138,0.4)", borderRadius: 22, backgroundColor: "#080b14" },
  cropChoiceTitle: { color: "#fff3b0", fontSize: 17, fontWeight: "800", textAlign: "center" },
  cropChoiceButtons: { flexDirection: "row", justifyContent: "center", gap: 10, marginTop: 16 },
  secondaryAction: { minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.28)", borderRadius: 99 },
  secondaryActionText: { color: "#ffffff", fontWeight: "700" },
  goldAction: { minHeight: 44, minWidth: 112, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, borderRadius: 99, backgroundColor: "#fbbf24" },
  goldActionText: { color: "#451a03", fontWeight: "900" },
  cropScreen: { flex: 1, backgroundColor: "#050509" },
  blueSkyCropScreen: { backgroundColor: "#061a3a" },
  cropHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" },
  blueSkyCropHeader: { borderBottomColor: "rgba(255,255,255,0.35)" },
  cropOverline: { color: "#fde68a", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  cropTitle: { marginTop: 3, color: "#ffffff", fontSize: 18, fontWeight: "800" },
  cropCancel: { padding: 8, color: "rgba(255,255,255,0.8)" },
  cropPreviewArea: { flex: 1, overflow: "hidden", alignItems: "center", justifyContent: "center", margin: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", borderRadius: 27, backgroundColor: "#111827" },
  cropPreviewImage: { width: "100%", height: "100%" },
  cropCircle: { position: "absolute", borderWidth: 2, borderColor: "rgba(255,255,255,0.9)", borderRadius: 1000 },
  cropControls: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 18, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", backgroundColor: "#080b14" },
  blueSkyCropControls: { borderTopColor: "rgba(255,255,255,0.35)", backgroundColor: "#0b2d5b" },
  controlLabel: { marginTop: 7, color: "#fde68a", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  cropMovement: { flexDirection: "row", gap: 14 },
  rangeControl: { flex: 1, marginTop: 7 },
  rangeLabelRow: { flexDirection: "row", justifyContent: "space-between" },
  rangeValue: { color: "#ffffff", fontSize: 11 },
  rangeTrack: { height: 28, justifyContent: "center", marginTop: 4 },
  rangeFill: { position: "absolute", left: 0, width: "50%", height: 4, borderRadius: 2, backgroundColor: "#fbbf24" },
  blueSkyRangeFill: { backgroundColor: "#ffffff" },
  rangeThumb: { position: "absolute", top: 7, width: 14, height: 14, marginLeft: -7, borderWidth: 2, borderColor: "#451a03", borderRadius: 7, backgroundColor: "#fbbf24" },
  blueSkyRangeThumb: { borderColor: "#ffffff", backgroundColor: "#54b8ff" },
  nudgeText: { color: "#ffffff", fontSize: 15, fontWeight: "800" },
  moveControls: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 2 },
  centerButton: { minHeight: 34, justifyContent: "center", paddingHorizontal: 10, borderRadius: 12, backgroundColor: "rgba(251,191,36,0.2)" },
  blueSkyCenterButton: { backgroundColor: "#155192" },
  cropFooter: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 13 },
});
