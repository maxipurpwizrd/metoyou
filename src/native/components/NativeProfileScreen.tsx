import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MessageCircle } from "lucide-react-native";
import { nativeSupabase } from "../lib/supabase";
import {
  fetchNativeFollowInfo,
  fetchNativeProfileById,
  fetchNativeProfileByUsername,
  fetchNativeProfilePosts,
  setNativeFollow,
  type NativeProfile,
} from "../lib/profile";
import {
  nativeChatConversationQueryKey,
  nativeFollowInfoQueryKey,
  nativeMessageThreadsQueryKey,
  nativeProfilePostsQueryKey,
  nativeProfileQueryKey,
} from "../lib/queryKeys";
import {
  blockNativeUser,
  deleteNativePost,
  reportNativePost,
  toggleNativePostLike,
  updateNativePostText,
} from "../lib/posts";
import { useNativeAuth } from "../contexts/NativeAuthProvider";
import { useNativeEntitlement } from "../contexts/NativeEntitlementProvider";
import { NATIVE_THEME_COLORS, useNativeTheme } from "../contexts/NativeThemeProvider";
import type { PostRecord } from "../../types/post";
import NativeConfirmDialog from "./NativeConfirmDialog";
import NativePostCard from "./NativePostCard";
import NativeSkeleton from "./NativeSkeleton";
import { NativeProfilePostsSkeleton, NativeProfileSkeleton } from "./NativeScreenSkeletons";
import NativeSurfaceDock from "./NativeSurfaceDock";
import NativeVibesProProfile from "./NativeVibesProProfile";

const SAVED_POSTS_KEY = "metoyou-saved-posts";

function isVibesPro(profile: NativeProfile | null) {
  return Boolean(profile?.is_vibes_pro ?? profile?.is_vibespro ?? profile?.vibes_pro);
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

function ProfileMenuTile({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.profileMenuTile, pressed && styles.disabled]}
    >
      <Text style={styles.profileMenuIcon}>{icon}</Text>
      <Text style={styles.profileMenuLabel}>{label}</Text>
    </Pressable>
  );
}

export default function NativeProfileScreen() {
  const params = useLocalSearchParams<{ username?: string | string[] }>();
  const routeUsername = Array.isArray(params.username) ? params.username[0] : params.username;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useNativeAuth();
  const { entitlement, refresh: refreshEntitlement } = useNativeEntitlement();
  const { theme } = useNativeTheme();
  const isBlueSky = theme === "bluesky";
  const viewerId = session?.user.id;
  const queryClient = useQueryClient();
  const ownUsername = typeof session?.user.user_metadata.username === "string"
    ? session.user.user_metadata.username
    : "";
  const viewingSelf = !routeUsername || routeUsername.toLowerCase() === "me" ||
    routeUsername.toLowerCase() === ownUsername.toLowerCase();
  const profileKey = viewingSelf ? "self" : `username:${routeUsername}`;
  const profileQueryKey = nativeProfileQueryKey(viewerId ?? "", profileKey);
  const profileQuery = useQuery({
    queryKey: profileQueryKey,
    queryFn: () => viewingSelf
      ? fetchNativeProfileById(viewerId!)
      : fetchNativeProfileByUsername(routeUsername!),
    enabled: Boolean(viewerId),
    staleTime: 60_000,
  });
  const profile = profileQuery.data ?? null;
  const profilePostsQueryKey = nativeProfilePostsQueryKey(viewerId ?? "", profile?.id ?? "");
  const profilePostsQuery = useQuery({
    queryKey: profilePostsQueryKey,
    queryFn: () => fetchNativeProfilePosts(profile!.id, viewerId!, profile),
    enabled: Boolean(viewerId && profile?.id),
    staleTime: 30_000,
  });
  const followInfoQueryKey = nativeFollowInfoQueryKey(viewerId ?? "", profile?.id ?? "");
  const followInfoQuery = useQuery({
    queryKey: followInfoQueryKey,
    queryFn: () => fetchNativeFollowInfo(viewerId!, profile!.id),
    enabled: Boolean(viewerId && profile?.id),
    staleTime: 15_000,
  });
  const posts = profilePostsQuery.data ?? [];
  const followInfo = followInfoQuery.data;
  const isFollowing = profile?.id !== viewerId && Boolean(followInfo?.isFollowing);
  const isFollowedBy = profile?.id !== viewerId && Boolean(followInfo?.isFollowedBy);
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(() => new Set());
  const [followLoading, setFollowLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editBio, setEditBio] = useState("");
  const [editInterests, setEditInterests] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [unfollowConfirmation, setUnfollowConfirmation] = useState(false);
  const loading = profileQuery.isPending && !profile;
  const postsLoading = Boolean(profile && profilePostsQuery.isPending && !profilePostsQuery.data);
  const followInfoLoading = Boolean(profile && followInfoQuery.isPending && !followInfoQuery.data);
  const error = profileQuery.isError && !profileQuery.data
    ? profileQuery.error.message
    : profilePostsQuery.isError && !profilePostsQuery.data
      ? profilePostsQuery.error.message
      : followInfoQuery.isError && !followInfoQuery.data
        ? followInfoQuery.error.message
        : null;
  const updateProfileCache = useCallback((next: NativeProfile) => {
    queryClient.setQueryData<NativeProfile | null>(profileQueryKey, next);
  }, [profileQueryKey, queryClient]);
  const updatePostsCache = useCallback((update: Array<PostRecord & { liked?: boolean }> | ((current: Array<PostRecord & { liked?: boolean }>) => Array<PostRecord & { liked?: boolean }>)) => {
    queryClient.setQueryData<Array<PostRecord & { liked?: boolean }>>(
      profilePostsQueryKey,
      (current = []) => typeof update === "function" ? update(current) : update,
    );
  }, [profilePostsQueryKey, queryClient]);
  const isOwnProfile = !routeUsername || profile?.id === viewerId;
  const ownEntitlementLoading = isOwnProfile &&
    (entitlement.status === "loading" || entitlement.status === "unknown");
  const ownEntitlementError = isOwnProfile && entitlement.status === "error";
  const vibesPro = isOwnProfile ? entitlement.status === "vibesPro" : isVibesPro(profile);
  const displayPhoto = profile?.vibes_pro_portrait ?? profile?.profile_pic ?? null;
  const snapshotsCount = posts.filter((post) => Boolean(post.image_url)).length;
  const bio = profile?.bio?.trim() ?? "";
  const interests = useMemo(
    () => (Array.isArray(profile?.interests) ? profile.interests.filter(Boolean) : []),
    [profile?.interests],
  );
  const followLabel = isFollowing && isFollowedBy
    ? "Friend"
    : isFollowing
      ? "Following"
      : isFollowedBy
        ? "Follow back"
        : "Follow";

  const refreshProfile = useCallback(async () => {
    await Promise.all([
      profileQuery.refetch(),
      profilePostsQuery.refetch(),
      followInfoQuery.refetch(),
    ]);
  }, [followInfoQuery.refetch, profilePostsQuery.refetch, profileQuery.refetch]);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(SAVED_POSTS_KEY)
      .then((raw) => {
        if (!active || !raw) return;
        const ids: unknown = JSON.parse(raw);
        if (Array.isArray(ids) && ids.every((id) => typeof id === "string")) {
          setSavedPostIds(new Set(ids));
        }
      })
      .catch((cause: unknown) => {
        Alert.alert("Saved posts unavailable", cause instanceof Error ? cause.message : "Could not read saved posts.");
      });
    return () => {
      active = false;
    };
  }, []);

  const savePost = async (postId: string) => {
    const next = new Set(savedPostIds).add(postId);
    await AsyncStorage.setItem(SAVED_POSTS_KEY, JSON.stringify([...next]));
    setSavedPostIds(next);
  };

  const toggleFollow = async () => {
    if (!viewerId || !profile || isOwnProfile || followLoading) return;
    if (isFollowing && isFollowedBy) {
      setUnfollowConfirmation(true);
      return;
    }
    await updateFollowStatus();
  };

  const updateFollowStatus = async () => {
    if (!viewerId || !profile) return;
    setFollowLoading(true);
    try {
      await setNativeFollow(viewerId, profile.id, !isFollowing);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: followInfoQueryKey, exact: true }),
        queryClient.invalidateQueries({ queryKey: nativeMessageThreadsQueryKey(viewerId), exact: true }),
        queryClient.invalidateQueries({ queryKey: nativeChatConversationQueryKey(viewerId, profile.id), exact: true }),
      ]);
    } catch (cause) {
      Alert.alert("Could not update following", cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setFollowLoading(false);
      setUnfollowConfirmation(false);
    }
  };

  const editProfile = () => {
    setEditBio(profile?.bio ?? "");
    setEditInterests(interests.join(", "));
    setEditOpen(true);
  };

  const saveProfile = async () => {
    if (!profile || !isOwnProfile) return;
    setSavingEdit(true);
    try {
      const nextInterests = editInterests.split(",").map((interest) => interest.trim()).filter(Boolean);
      const { error: updateError } = await nativeSupabase
        .from("profiles")
        .update({ bio: editBio.trim(), interests: nextInterests })
        .eq("id", profile.id);
      if (updateError) throw updateError;
      updateProfileCache({ ...profile, bio: editBio.trim(), interests: nextInterests });
      setEditOpen(false);
    } catch (cause) {
      Alert.alert("Could not save profile", cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setSavingEdit(false);
    }
  };

  const changeProfilePhoto = async () => {
    if (!profile || !isOwnProfile || photoLoading) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Photo access needed", "Allow photo access to choose a profile picture.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.82,
        base64: true,
      });
      if (result.canceled) return;
      const image = result.assets[0];
      if (!image.base64) throw new Error("The selected image could not be read.");
      setPhotoLoading(true);
      const extension = image.mimeType?.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "jpg";
      const path = `${profile.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
      const storage = nativeSupabase.storage.from("profile-pictures");
      const { error: uploadError } = await storage.upload(path, decodeBase64(image.base64), {
        contentType: image.mimeType ?? "image/jpeg",
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const url = storage.getPublicUrl(path).data.publicUrl;
      const update = vibesPro
        ? { profile_pic: url, vibes_pro_portrait: url }
        : { profile_pic: url };
      const { error: profileError } = await nativeSupabase.from("profiles").update(update).eq("id", profile.id);
      if (profileError) throw profileError;
      updateProfileCache({ ...profile, ...update });
    } catch (cause) {
      Alert.alert("Could not update profile picture", cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setPhotoLoading(false);
    }
  };

  const shareProfile = async () => {
    if (!profile) return;
    try {
      await Share.share({
        title: `${profile.username}'s profile`,
        message: `Check out @${profile.username} on MeToYou.`,
      });
    } catch (cause) {
      Alert.alert("Could not share profile", cause instanceof Error ? cause.message : "Please try again.");
    }
  };

  const runProfileMenuAction = (action: () => void) => {
    setProfileMenuOpen(false);
    action();
  };

  const likePost = async (post: PostRecord) => {
    if (!viewerId) throw new Error("Sign in to like a post.");
    const result = await toggleNativePostLike(post.id, viewerId);
    updatePostsCache((current) => current.map((item) =>
      item.id === post.id ? { ...item, likes_count: result.likesCount, liked: result.liked } : item,
    ));
    return result;
  };

  const updateHighlight = async (postId: string) => {
    const post = posts.find((item) => item.id === postId);
    if (!post) return;
    const highlighted = !post.highlighted;
    const { error: updateError } = await nativeSupabase
      .from("posts")
      .update({ highlighted })
      .eq("id", postId);
    if (updateError) throw updateError;
    updatePostsCache((current) => current.map((item) => item.id === postId ? { ...item, highlighted } : item));
  };

  const renderPost = (post: PostRecord & { liked?: boolean }) => (
    <NativePostCard
      isLiked={Boolean(post.liked)}
      isOwner={post.author_id === viewerId}
      isSaved={savedPostIds.has(post.id)}
      onBlock={async (item) => {
        await blockNativeUser(item.author_id);
        Alert.alert("User blocked", "Their profile and posts will no longer be shown.", [
          { text: "Back to Feed", onPress: () => router.navigate("/(app)/(tabs)") },
        ]);
      }}
      onCommentCountChange={(postId, count) => {
        updatePostsCache((current) => current.map((item) => item.id === postId ? { ...item, comments_count: count } : item));
      }}
      onDelete={async (postId) => {
        await deleteNativePost(postId);
        updatePostsCache((current) => current.filter((item) => item.id !== postId));
      }}
      onEdit={async (postId, text) => {
        await updateNativePostText(postId, text);
        updatePostsCache((current) => current.map((item) => item.id === postId ? { ...item, text } : item));
      }}
      onHighlight={updateHighlight}
      onReport={async (item, reason) => {
        await reportNativePost({ postId: item.id, authorId: item.author_id, reason });
        Alert.alert("Report submitted", "Our moderation team will review it.");
      }}
      onSave={savePost}
      onToggleLike={likePost}
      post={post}
    />
  );

  if (!loading && !error && profile && vibesPro && viewerId) {
    return (
      <NativeVibesProProfile
        followLoading={followLoading}
        followerCount={followInfo?.followerCount ?? 0}
        followerCountLoading={followInfoLoading}
        isFollowedBy={isFollowedBy}
        isFollowing={isFollowing}
        onBack={() => router.navigate("/(app)/(tabs)")}
        onFollow={() => void toggleFollow()}
        onOpenPost={(post) => {
          if (!post.image_url) return;
          router.push({
            pathname: "/(app)/(tabs)/flicks",
            params: { image: post.image_url, postId: post.id },
          });
        }}
        onProfileUpdated={updateProfileCache}
        postsLoading={postsLoading}
        posts={posts}
        profile={profile}
        viewerId={viewerId}
      />
    );
  }

  const content = (
    <LinearGradient
      colors={isBlueSky ? NATIVE_THEME_COLORS.bluesky.background : vibesPro ? NATIVE_THEME_COLORS.dark.background : ["#d9f3ff", "#eefaff", "#ffffff"]}
      style={styles.root}
    >
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <View style={[styles.header, isBlueSky && styles.blueSkyHeader]}>
          <Pressable
            accessibilityLabel="Go back"
            onPress={() => isOwnProfile
              ? router.navigate("/(app)/(tabs)")
              : router.canGoBack() ? router.back() : router.navigate("/(app)/(tabs)")}
            style={styles.headerButton}
          >
            <Text style={[styles.backText, isBlueSky && styles.blueSkyText]}>‹</Text>
          </Pressable>
          <Text style={[styles.headerTitle, vibesPro && styles.goldText, isBlueSky && styles.blueSkyText]}>Profile</Text>
          <View style={styles.headerSpacer} />
        </View>

        {loading || ownEntitlementLoading ? (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <NativeProfileSkeleton />
          </ScrollView>
        ) : ownEntitlementError ? (
          <View style={styles.center}>
            <Text style={styles.error}>VibesPro status could not be checked: {entitlement.error.message}</Text>
            <Pressable onPress={() => void refreshEntitlement()} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Retry account status</Text>
            </Pressable>
          </View>
        ) : error && !profile ? (
          <View style={styles.center}>
            <Text style={styles.error}>{error}</Text>
            <Pressable onPress={() => void refreshProfile()} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : profile ? (
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) + 100 }]}
            showsVerticalScrollIndicator={false}
          >
            {error ? (
              <View style={styles.center}>
                <Text style={styles.error}>{error}</Text>
                <Pressable onPress={() => void refreshProfile()} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Retry</Text>
                </Pressable>
              </View>
            ) : null}
            <LinearGradient
              colors={isBlueSky ? ["#0b2d5b", "#104078"] : vibesPro ? ["#fcd34d", "#f59e0b", "#d97706"] : ["rgba(255,255,255,0.96)", "rgba(240,249,255,0.94)"]}
              style={[styles.profileCard, vibesPro && styles.premiumCard, isBlueSky && styles.blueSkyCard]}
            >
              <View
                style={[
                  styles.profileCardActions,
                  isOwnProfile ? styles.profileCardActionsOwn : styles.profileCardActionsPublic,
                ]}
              >
                <Pressable
                  accessibilityLabel="Profile menu"
                  accessibilityRole="button"
                  onPress={() => setProfileMenuOpen(true)}
                  style={styles.cardMenuButton}
                >
                  <View style={styles.menuGridIcon}>
                    {Array.from({ length: 4 }, (_, index) => (
                      <View key={index} style={styles.menuGridCell} />
                    ))}
                  </View>
                </Pressable>
                {isOwnProfile ? (
                  <Pressable
                    accessibilityLabel="Open settings"
                    accessibilityRole="button"
                    onPress={() => router.push("/(app)/settings")}
                    style={styles.settingsButton}
                  >
                    <Text style={styles.settingsIcon}>⚙</Text>
                    <Text style={styles.settingsButtonText}>Settings</Text>
                  </Pressable>
                ) : null}
              </View>
              <Pressable
                accessibilityLabel={isOwnProfile ? "Change profile picture" : `${profile.username}'s profile picture`}
                disabled={!isOwnProfile || photoLoading}
                onPress={() => void changeProfilePhoto()}
                style={[styles.avatarRing, vibesPro && styles.avatarRingGold]}
              >
                {displayPhoto ? (
                  <Image source={{ uri: displayPhoto }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarInitial}>{profile.username.slice(0, 1).toUpperCase()}</Text>
                  </View>
                )}
                {photoLoading ? (
                  <View style={styles.avatarLoading}><ActivityIndicator color="#ffffff" /></View>
                ) : null}
              </Pressable>
              {isOwnProfile ? (
                <Text style={[styles.photoHint, vibesPro && styles.premiumSubtext]}>Tap photo to update</Text>
              ) : null}
              <Text style={[styles.username, vibesPro && styles.premiumText, isBlueSky && styles.blueSkyText]}>@{profile.username}</Text>
              {vibesPro ? <Text style={styles.vibesBadge}>👑 VibesPro</Text> : null}
              {profile.email && isOwnProfile ? <Text style={[styles.email, vibesPro && styles.premiumSubtext]}>{profile.email}</Text> : null}
              {bio ? <Text style={[styles.bio, vibesPro && styles.premiumText, isBlueSky && styles.blueSkyText]}>{bio}</Text> : null}
              {interests.length ? (
                <View style={styles.interests}>
                  {interests.map((interest) => <Text key={interest} style={styles.interest}>{interest}</Text>)}
                </View>
              ) : null}

              {!isOwnProfile ? (
                <View style={styles.profileActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Message ${profile.username}`}
                    onPress={() => router.push({
                      pathname: "/messages/[recipientId]",
                      params: { recipientId: profile.id },
                    })}
                    style={styles.messageButton}
                  >
                    <MessageCircle color="#0369a1" size={17} />
                    <Text style={styles.messageButtonText}>Message</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={followLoading}
                    onPress={() => void toggleFollow()}
                    style={[styles.primaryButton, followLoading && styles.disabled]}
                  >
                    {followLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>{followLabel}</Text>}
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={editProfile} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Edit profile</Text>
                </Pressable>
              )}

              <View style={styles.stats}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push({
                    pathname: "/profile/followers",
                    params: { profileId: profile.id, username: profile.username },
                  })}
                  style={styles.stat}
                >
                  {followInfoLoading ? <NativeSkeleton style={styles.statSkeleton} /> : (
                    <Text style={[styles.statValue, vibesPro && styles.premiumText]}>
                      {followInfoQuery.isError && !followInfo ? "—" : followInfo?.followerCount ?? 0}
                    </Text>
                  )}
                  <Text style={[styles.statLabel, vibesPro && styles.premiumSubtext]}>Followers</Text>
                </Pressable>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, vibesPro && styles.premiumText]}>{snapshotsCount}</Text>
                  <Text style={[styles.statLabel, vibesPro && styles.premiumSubtext]}>Snapshots</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, vibesPro && styles.premiumText]}>{posts.length}</Text>
                  <Text style={[styles.statLabel, vibesPro && styles.premiumSubtext]}>Vibes</Text>
                </View>
              </View>
            </LinearGradient>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, vibesPro && styles.goldText]}>Highlights</Text>
              {postsLoading ? <NativeProfilePostsSkeleton /> : posts.some((post) => post.highlighted) ? (
                posts.filter((post) => post.highlighted).map((post) => (
                  <View key={`highlight-${post.id}`} style={[styles.highlightCard, vibesPro && styles.highlightCardGold]}>
                    {post.image_url ? <Image source={{ uri: post.image_url }} style={styles.highlightImage} /> : null}
                    <Text numberOfLines={3} style={[styles.highlightText, vibesPro && styles.premiumText]}>
                      {post.text || "A highlighted snapshot"}
                    </Text>
                  </View>
                ))
              ) : posts.length === 0 && !profilePostsQuery.isError ? (
                <Text style={[styles.emptyText, vibesPro && styles.darkSubtext]}>No highlights yet.</Text>
              ) : null}
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, vibesPro && styles.goldText]}>
                {isOwnProfile ? "My Snapshots" : "Snapshots"}
              </Text>
              {postsLoading ? <NativeProfilePostsSkeleton /> : posts.length === 0 && !profilePostsQuery.isError ? (
                <Text style={[styles.emptyText, vibesPro && styles.darkSubtext]}>No posts to show yet.</Text>
              ) : posts.map((post) => <View key={post.id} style={styles.postWrap}>{renderPost(post)}</View>)}
            </View>
          </ScrollView>
        ) : null}
      </SafeAreaView>

      <NativeSurfaceDock
        activeSurface="feed"
        bottomInset={insets.bottom}
        onClipsPress={() => router.navigate("/(app)/(tabs)/clips")}
        onFeedPress={() => router.navigate("/(app)/(tabs)")}
        onFlicksPress={() => router.navigate("/(app)/(tabs)/flicks")}
        onTracksPress={() => router.navigate("/(app)/(tabs)/tracks")}
        visible
      />

      <Modal
        animationType="fade"
        onRequestClose={() => setProfileMenuOpen(false)}
        transparent
        visible={profileMenuOpen}
      >
        <Pressable onPress={() => setProfileMenuOpen(false)} style={styles.menuBackdrop}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.profileMenuCard}>
            <View style={styles.menuHeading}>
              <View>
                <Text style={styles.menuTitle}>Profile menu</Text>
                <Text style={styles.menuSubtitle}>@{profile?.username}</Text>
              </View>
              <Pressable
                accessibilityLabel="Close profile menu"
                onPress={() => setProfileMenuOpen(false)}
                style={styles.menuCloseButton}
              >
                <Text style={styles.menuCloseText}>×</Text>
              </Pressable>
            </View>
            <View style={styles.menuTiles}>
              {isOwnProfile ? (
                <>
                  <ProfileMenuTile
                    icon="✎"
                    label="Edit profile"
                    onPress={() => runProfileMenuAction(editProfile)}
                  />
                  <ProfileMenuTile
                    icon="↗"
                    label="Share profile"
                    onPress={() => runProfileMenuAction(() => void shareProfile())}
                  />
                  <ProfileMenuTile
                    icon="⚙"
                    label="Settings"
                    onPress={() => runProfileMenuAction(() => router.push("/(app)/settings"))}
                  />
                  <ProfileMenuTile
                    icon="⊘"
                    label="Blocked users"
                    onPress={() => runProfileMenuAction(() => router.push("/(app)/settings/blocked-users"))}
                  />
                </>
              ) : (
                <>
                  <ProfileMenuTile
                    icon="↗"
                    label="Share profile"
                    onPress={() => runProfileMenuAction(() => void shareProfile())}
                  />
                  <ProfileMenuTile
                    icon={isFollowing ? "✓" : "+"}
                    label={followLabel}
                    onPress={() => runProfileMenuAction(() => void toggleFollow())}
                  />
                  <ProfileMenuTile
                    icon="♡"
                    label="Followers"
                    onPress={() => runProfileMenuAction(() => router.push({
                      pathname: "/profile/followers",
                      params: { profileId: profile!.id, username: profile!.username },
                    }))}
                  />
                </>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal animationType="fade" onRequestClose={() => setEditOpen(false)} transparent visible={editOpen}>
        <View style={styles.modalBackdrop}>
          <View style={styles.editCard}>
            <Text style={styles.editTitle}>Edit profile</Text>
            <Text style={styles.inputLabel}>About me</Text>
            <TextInput
              multiline
              onChangeText={setEditBio}
              placeholder="Tell people a little about you"
              style={[styles.textInput, styles.bioInput]}
              value={editBio}
            />
            <Text style={styles.inputLabel}>Interests</Text>
            <TextInput
              onChangeText={setEditInterests}
              placeholder="Music, art, travel"
              style={styles.textInput}
              value={editInterests}
            />
            <Text style={styles.inputHint}>Separate interests with commas.</Text>
            <View style={styles.editActions}>
              <Pressable disabled={savingEdit} onPress={() => setEditOpen(false)} style={styles.cancelButton}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable disabled={savingEdit} onPress={() => void saveProfile()} style={styles.primaryButton}>
                {savingEdit ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>Save changes</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <NativeConfirmDialog
        confirmLabel="Unfollow"
        emoji="💔"
        message={`${profile?.username ?? "This person"} is your friend. Would you like to unfollow them?`}
        onCancel={() => setUnfollowConfirmation(false)}
        onConfirm={updateFollowStatus}
        title="Unfollow your friend?"
        visible={unfollowConfirmation}
      />
    </LinearGradient>
  );

  return content;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  blueSkyHeader: { borderBottomColor: "#3478bd", backgroundColor: "rgba(6,26,58,0.94)" },
  blueSkyCard: { borderColor: "#3478bd", backgroundColor: "#0b2d5b" },
  blueSkyText: { color: "#ffffff" },
  safeArea: { flex: 1 },
  header: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14 },
  headerButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "rgba(255,255,255,0.72)" },
  headerSpacer: { width: 42 },
  backText: { color: "#0369a1", fontSize: 36, lineHeight: 39 },
  headerTitle: { color: "#082f49", fontSize: 17, fontWeight: "900" },
  shareIcon: { color: "#0369a1", fontSize: 22, fontWeight: "800" },
  settingsIcon: { color: "#0369a1", fontSize: 20, fontWeight: "800" },
  menuGridIcon: { width: 20, height: 20, flexDirection: "row", flexWrap: "wrap", gap: 3 },
  menuGridCell: { width: 8, height: 8, borderRadius: 2, backgroundColor: "#0369a1" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  error: { color: "#be123c", fontSize: 15, textAlign: "center" },
  content: { padding: 16, gap: 18 },
  profileCard: { alignItems: "center", padding: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.9)", borderRadius: 28, backgroundColor: "rgba(255,255,255,0.9)", elevation: 4 },
  premiumCard: { borderColor: "#b45309" },
  profileCardActions: { alignSelf: "stretch", flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 18 },
  profileCardActionsOwn: { justifyContent: "space-between" },
  profileCardActionsPublic: { justifyContent: "flex-end" },
  cardMenuButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.8)", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.55)" },
  settingsButton: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.8)", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.48)" },
  settingsButtonText: { color: "#0f172a", fontSize: 12, fontWeight: "800" },
  avatarRing: { width: 106, height: 106, padding: 4, borderRadius: 53, backgroundColor: "#0ea5e9" },
  avatarRingGold: { backgroundColor: "#92400e" },
  avatar: { width: "100%", height: "100%", borderRadius: 50 },
  avatarFallback: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 50, backgroundColor: "#38bdf8" },
  avatarInitial: { color: "#ffffff", fontSize: 42, fontWeight: "900" },
  avatarLoading: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", borderRadius: 54, backgroundColor: "rgba(15,23,42,0.5)" },
  photoHint: { marginTop: 5, color: "#64748b", fontSize: 10 },
  username: { marginTop: 12, color: "#0f172a", fontSize: 22, fontWeight: "900" },
  email: { marginTop: 4, color: "#64748b", fontSize: 12 },
  bio: { marginTop: 12, color: "#334155", fontSize: 14, lineHeight: 21, textAlign: "center" },
  vibesBadge: { marginTop: 8, overflow: "hidden", paddingHorizontal: 11, paddingVertical: 5, borderRadius: 99, color: "#451a03", backgroundColor: "#ffe27a", fontSize: 11, fontWeight: "900" },
  premiumText: { color: "#451a03" },
  premiumSubtext: { color: "#713f12" },
  goldText: { color: "#fde68a" },
  darkSubtext: { color: "#94a3b8" },
  interests: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 7, marginTop: 14 },
  interest: { overflow: "hidden", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99, color: "#0369a1", backgroundColor: "#e0f2fe", fontSize: 11, fontWeight: "700" },
  profileActions: { alignSelf: "stretch", flexDirection: "row", justifyContent: "center", gap: 9, marginTop: 18 },
  messageButton: { minHeight: 44, minWidth: 118, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 16, borderWidth: 1, borderColor: "#bae6fd", borderRadius: 14, backgroundColor: "#ffffff" },
  messageButtonText: { color: "#0369a1", fontSize: 13, fontWeight: "800" },
  primaryButton: { minHeight: 44, minWidth: 118, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, borderRadius: 14, backgroundColor: "#0284c7" },
  primaryButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
  secondaryButton: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 15, paddingHorizontal: 18, borderWidth: 1, borderColor: "#bae6fd", borderRadius: 14, backgroundColor: "#ffffff" },
  secondaryButtonText: { color: "#0369a1", fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.6 },
  stats: { flexDirection: "row", justifyContent: "space-around", alignSelf: "stretch", marginTop: 22, paddingTop: 18, borderTopWidth: 1, borderTopColor: "rgba(15,23,42,0.1)" },
  stat: { minWidth: 74, alignItems: "center" },
  statValue: { color: "#0f172a", fontSize: 19, fontWeight: "900" },
  statSkeleton: { width: 42, height: 22, borderRadius: 8 },
  statLabel: { marginTop: 4, color: "#64748b", fontSize: 11, fontWeight: "700" },
  section: { gap: 10 },
  sectionTitle: { color: "#0c4a6e", fontSize: 20, fontWeight: "900" },
  highlightCard: { overflow: "hidden", borderWidth: 1, borderColor: "#dbeafe", borderRadius: 18, backgroundColor: "#ffffff" },
  highlightCardGold: { borderColor: "#fbbf24", backgroundColor: "#fef3c7" },
  highlightImage: { width: "100%", height: 150 },
  highlightText: { padding: 12, color: "#334155", fontSize: 13, lineHeight: 18 },
  emptyText: { paddingVertical: 18, color: "#64748b", fontSize: 13, textAlign: "center" },
  postWrap: { marginBottom: 4 },
  modalBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: "rgba(15,23,42,0.42)" },
  menuBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 22, backgroundColor: "rgba(15,23,42,0.48)" },
  profileMenuCard: { width: "100%", maxWidth: 390, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.85)", borderRadius: 26, backgroundColor: "#f8fdff", elevation: 14 },
  menuHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, padding: 10, borderWidth: 1, borderColor: "#dbeafe", borderRadius: 17, backgroundColor: "#effaff" },
  menuTitle: { color: "#082f49", fontSize: 17, fontWeight: "900" },
  menuSubtitle: { marginTop: 3, color: "#64748b", fontSize: 11 },
  menuCloseButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: "#ffffff" },
  menuCloseText: { color: "#0369a1", fontSize: 25, lineHeight: 28 },
  menuTiles: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  profileMenuTile: { width: "48%", minHeight: 82, flexGrow: 1, alignItems: "center", justifyContent: "center", gap: 7, padding: 10, borderWidth: 1, borderColor: "#dbeafe", borderRadius: 17, backgroundColor: "#ffffff" },
  profileMenuIcon: { color: "#0284c7", fontSize: 23, fontWeight: "800" },
  profileMenuLabel: { color: "#0c4a6e", fontSize: 12, fontWeight: "800", textAlign: "center" },
  editCard: { width: "100%", maxWidth: 440, padding: 20, borderWidth: 1, borderColor: "#dbeafe", borderRadius: 24, backgroundColor: "#ffffff" },
  editTitle: { color: "#0c4a6e", fontSize: 18, fontWeight: "900" },
  inputLabel: { marginTop: 16, marginBottom: 6, color: "#334155", fontSize: 12, fontWeight: "800" },
  textInput: { minHeight: 45, paddingHorizontal: 12, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 12, color: "#0f172a", backgroundColor: "#f8fafc" },
  bioInput: { minHeight: 95, paddingTop: 11, textAlignVertical: "top" },
  inputHint: { marginTop: 5, color: "#64748b", fontSize: 10 },
  editActions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 10, marginTop: 20 },
  cancelButton: { minHeight: 42, justifyContent: "center", paddingHorizontal: 12 },
  cancelText: { color: "#64748b", fontSize: 13, fontWeight: "700" },
  hommiesCard: { width: "100%", maxWidth: 420, maxHeight: "70%", padding: 18, borderRadius: 24, backgroundColor: "#ffffff" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  modalClose: { color: "#64748b", fontSize: 25 },
  hommieRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e2e8f0" },
  hommieAvatar: { width: 38, height: 38, borderRadius: 19 },
  hommieAvatarFallback: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: "#0ea5e9" },
  hommieInitial: { color: "#ffffff", fontSize: 16, fontWeight: "800" },
  hommieName: { color: "#0f172a", fontSize: 13, fontWeight: "800" },
});
