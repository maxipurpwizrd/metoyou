import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useNativeAuth } from "../contexts/NativeAuthProvider";
import { NATIVE_THEME_COLORS, useNativeTheme } from "../contexts/NativeThemeProvider";
import {
  deleteAllNativeNotifications,
  deleteNativeNotification,
  fetchNativeNotificationPost,
  fetchNativeNotifications,
  markNativeNotificationsRead,
  subscribeToNativeNotifications,
  type NativeNotification,
} from "../lib/notifications";
import NativeConfirmDialog from "./NativeConfirmDialog";
import { NativeNotificationRowsSkeleton } from "./NativeScreenSkeletons";

type NotificationGroup = NativeNotification & {
  notificationIds: string[];
  count: number;
  profileUsername: string;
  actorNames: string[];
};

function joinActorNames(names: string[]) {
  if (names.length < 2) return names[0] ?? "Someone";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} others`;
}

function groupNotifications(notifications: NativeNotification[]): NotificationGroup[] {
  const grouped = new Map<string, NotificationGroup>();
  for (const notification of notifications) {
    const key = `${notification.type}:${notification.postId ?? ""}:${notification.message}`;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        ...notification,
        notificationIds: [notification.id],
        count: 1,
        profileUsername: notification.user,
        actorNames: [notification.user],
      });
      continue;
    }
    const actors = Array.from(new Set([...existing.actorNames, notification.user]));
    grouped.set(key, {
      ...existing,
      notificationIds: [...existing.notificationIds, notification.id],
      count: existing.count + 1,
      user: joinActorNames(actors),
      actorNames: actors,
      avatar: existing.avatar ?? notification.avatar,
      read: existing.read && notification.read,
      timestamp:
        Date.parse(existing.timestamp) >= Date.parse(notification.timestamp)
          ? existing.timestamp
          : notification.timestamp,
    });
  }
  return [...grouped.values()].sort(
    (left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp),
  );
}

function relativeTime(timestamp: string) {
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return "Just now";
  const minutes = Math.floor((Date.now() - parsed) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function notificationEmoji(type: string) {
  switch (type) {
    case "like": return "❤️";
    case "comment": return "💬";
    case "view": return "👀";
    case "follow": return "👤";
    case "follow_back": return "🤝";
    default: return "📢";
  }
}

export default function NativeNotificationsScreen() {
  const router = useRouter();
  const { session } = useNativeAuth();
  const { theme, isVibesPro } = useNativeTheme();
  const isBlueSky = theme === "bluesky";
  const userId = session?.user.id;
  const [notifications, setNotifications] = useState<NativeNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<"all" | NotificationGroup | null>(null);
  const requestGeneration = useRef(0);

  const loadNotifications = useCallback(async (markRead = false, isRefresh = false) => {
    if (!userId) return;
    const generation = ++requestGeneration.current;
    setError(null);
    setRefreshing(isRefresh);
    if (!isRefresh) setLoading(true);
    try {
      const results = await fetchNativeNotifications(userId);
      if (requestGeneration.current !== generation) return;
      if (markRead) {
        setNotifications(results);
        await markNativeNotificationsRead(userId);
        if (requestGeneration.current !== generation) return;
        setNotifications(results.map((item) => ({ ...item, read: true })));
      } else {
        setNotifications(results);
      }
    } catch (cause) {
      if (requestGeneration.current === generation) {
        setError(cause instanceof Error ? cause.message : "Notifications could not be loaded.");
      }
    } finally {
      if (requestGeneration.current === generation) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void loadNotifications(true);
    const channel = subscribeToNativeNotifications(userId, () => {
      void loadNotifications();
    });
    return () => {
      requestGeneration.current += 1;
      void channel.unsubscribe();
    };
  }, [loadNotifications, userId]);

  const openNotification = async (notification: NotificationGroup) => {
    if (notification.type === "follow" || notification.type === "follow_back") {
      if (notification.actorId) {
        router.push({
          pathname: "/(app)/profile/[username]",
          params: { username: notification.profileUsername },
        });
      } else {
        Alert.alert("Profile unavailable", "This account could not be opened.");
      }
      return;
    }
    if (!notification.postId) {
      if (notification.actorId) {
        router.push({
          pathname: "/(app)/profile/[username]",
          params: { username: notification.profileUsername },
        });
      }
      return;
    }

    try {
      const post = await fetchNativeNotificationPost(notification.postId);
      if (!post) throw new Error("The post could not be found.");
      const params = { postId: notification.postId, ...(notification.type === "comment" ? { showComments: "1" } : {}) };
      if (post.video_url) router.push({ pathname: "/(app)/(tabs)/clips", params });
      else if (post.audio_url) router.push({ pathname: "/(app)/(tabs)/tracks", params });
      else if (post.image_url || post.image_original_url) {
        router.push({
          pathname: "/(app)/(tabs)/flicks",
          params: { ...params, image: post.image_original_url ?? post.image_url ?? "" },
        });
      } else router.push({ pathname: "/(app)/(tabs)", params });
    } catch (cause) {
      Alert.alert(
        "Post unavailable",
        cause instanceof Error ? cause.message : "This post could not be opened.",
      );
    }
  };

  const confirmDelete = async () => {
    if (!userId || !confirmation || busy) return;
    setBusy(true);
    try {
      if (confirmation === "all") {
        await deleteAllNativeNotifications(userId);
        setNotifications([]);
      } else {
        await Promise.all(
          confirmation.notificationIds.map((id) => deleteNativeNotification(userId, id)),
        );
        const deletedIds = new Set(confirmation.notificationIds);
        setNotifications((current) => current.filter((item) => !deletedIds.has(item.id)));
      }
      setConfirmation(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient
      colors={isBlueSky ? NATIVE_THEME_COLORS.bluesky.background : isVibesPro ? NATIVE_THEME_COLORS.dark.background : ["#d9f3ff", "#eefaff", "#ffffff"]}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={styles.root}
    >
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <View style={[styles.header, isVibesPro && styles.vibesProHeader, isBlueSky && styles.blueSkyHeader]}>
          <Pressable
            accessibilityLabel="Go back"
            onPress={() => router.canGoBack() ? router.back() : router.navigate("/(app)/(tabs)")}
            style={[styles.headerButton, isVibesPro && styles.vibesProButton, isBlueSky && styles.blueSkyButton]}
          >
            <Text style={[styles.backIcon, isVibesPro && styles.vibesProText, isBlueSky && styles.blueSkyText]}>‹</Text>
          </Pressable>
          <View style={styles.heading}>
            <Text style={[styles.eyebrow, isVibesPro && styles.vibesProGold, isBlueSky && styles.blueSkyAccentText]}>ACTIVITY</Text>
            <Text style={[styles.title, isVibesPro && styles.vibesProText, isBlueSky && styles.blueSkyText]}>Notifications</Text>
          </View>
          <Pressable
            accessibilityLabel="Delete all notifications"
            disabled={notifications.length === 0}
            onPress={() => setConfirmation("all")}
            style={[styles.headerButton, isVibesPro && styles.vibesProButton, isBlueSky && styles.blueSkyButton, notifications.length === 0 && styles.disabled]}
          >
            <Text style={[styles.deleteAllIcon, isVibesPro && styles.vibesProText, isBlueSky && styles.blueSkyText]}>⌫</Text>
          </Pressable>
        </View>
        {loading && notifications.length === 0 ? (
          <NativeNotificationRowsSkeleton count={5} />
        ) : error && notifications.length === 0 ? (
          <View style={styles.center}>
            <Text style={[styles.bodyText, isVibesPro && styles.vibesProBodyText]}>{error}</Text>
            <Pressable onPress={() => void loadNotifications(true)} style={styles.retryButton}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={[styles.emptyTitle, isVibesPro && styles.vibesProText, isBlueSky && styles.blueSkyText]}>No notifications yet</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={
              <RefreshControl
                colors={[isBlueSky ? "#54b8ff" : isVibesPro ? "#D4AF37" : "#0284c7"]}
                onRefresh={() => void loadNotifications(false, true)}
                refreshing={refreshing}
                tintColor={isBlueSky ? "#54b8ff" : isVibesPro ? "#D4AF37" : "#0284c7"}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {error ? <Text style={styles.inlineError}>{error}</Text> : null}
            {groupNotifications(notifications).map((item) => (
              <View
                key={item.notificationIds.join("-")}
                style={[
                  styles.notificationCard,
                  isVibesPro && styles.vibesProCard,
                  isBlueSky && styles.blueSkyCard,
                  !item.read && (isBlueSky ? styles.blueSkyUnread : isVibesPro ? styles.vibesProUnread : styles.unread),
                ]}
              >
                <Pressable
                  accessibilityLabel={`${item.user}: ${item.message}`}
                  accessibilityRole="button"
                  onPress={() => void openNotification(item)}
                  style={styles.notificationBody}
                >
                  {item.avatar ? (
                    <Image source={{ uri: item.avatar }} style={[styles.avatar, isVibesPro && styles.vibesProAvatar, isBlueSky && styles.blueSkyAvatar]} />
                  ) : (
                    <LinearGradient
                      colors={isBlueSky ? ["#54b8ff", "#155192", "#0b2d5b"] : isVibesPro ? ["#D4AF37", "#F0C75E"] : ["#38bdf8", "#06b6d4", "#2563eb"]}
                      style={[styles.avatar, isVibesPro && styles.vibesProAvatar, isBlueSky && styles.blueSkyAvatar]}
                    >
                      <Text style={styles.avatarInitial}>{item.user.slice(0, 1).toUpperCase()}</Text>
                    </LinearGradient>
                  )}
                  <View style={styles.notificationText}>
                    <Text style={[styles.greeting, isVibesPro && styles.vibesProText, isBlueSky && styles.blueSkyText]}>
                      Hey {session?.user.user_metadata.username ?? "there"}
                    </Text>
                    <View style={styles.actorLine}>
                      <Text numberOfLines={1} style={[styles.actorName, isVibesPro && styles.vibesProGold, isBlueSky && styles.blueSkyAccentText]}>
                        {item.user}
                      </Text>
                      {!item.read ? (
                        <View style={[styles.unreadDot, isVibesPro && styles.vibesProUnreadDot, isBlueSky && styles.blueSkyUnreadDot]} />
                      ) : null}
                    </View>
                    <View style={styles.messageRow}>
                      <Text style={styles.emoji}>{notificationEmoji(item.type)}</Text>
                      <Text style={[styles.bodyText, isVibesPro && styles.vibesProBodyText, isBlueSky && styles.blueSkyText]}>
                        {item.message}
                      </Text>
                    </View>
                    <Text style={[styles.time, isVibesPro && styles.vibesProMutedText, isBlueSky && styles.blueSkyMuted]}>
                      {relativeTime(item.timestamp)}
                    </Text>
                  </View>
                </Pressable>
                <Pressable
                  accessibilityLabel={`Delete notification from ${item.user}`}
                  accessibilityRole="button"
                  onPress={() => setConfirmation(item)}
                  style={[styles.deleteButton, isVibesPro && styles.vibesProButton, isBlueSky && styles.blueSkyButton]}
                >
                  <Text style={[styles.deleteIcon, isVibesPro && styles.vibesProText, isBlueSky && styles.blueSkyText]}>×</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
      <NativeConfirmDialog
        confirmLabel={confirmation === "all" ? "Delete all" : "Delete"}
        destructive
        emoji="🗑️"
        message={
          confirmation === "all"
            ? "This will permanently remove all your notifications."
            : `Delete ${confirmation?.count ?? 1} notification${confirmation?.count === 1 ? "" : "s"}?`
        }
        onCancel={() => !busy && setConfirmation(null)}
        onConfirm={confirmDelete}
        title={confirmation === "all" ? "Delete all notifications?" : "Delete notification?"}
        vibesPro={isVibesPro}
        visible={confirmation !== null}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  blueSkyStatusScreen: { backgroundColor: "#061a3a" },
  blueSkyText: { color: "#ffffff" },
  blueSkyMuted: { color: "rgba(255,255,255,0.78)" },
  blueSkyAccentText: { color: "#54b8ff" },
  blueSkyCard: { borderColor: "#3478bd", backgroundColor: "#0b2d5b" },
  blueSkyHeader: { borderBottomColor: "#3478bd", backgroundColor: "rgba(6,26,58,0.94)" },
  blueSkyButton: { backgroundColor: "#155192" },
  blueSkyAvatar: { borderColor: "#54b8ff" },
  blueSkyUnread: { borderColor: "#54b8ff", backgroundColor: "#104078" },
  blueSkyUnreadDot: { backgroundColor: "#54b8ff" },
  safeArea: { flex: 1 },
  statusScreen: { flex: 1, justifyContent: "center", backgroundColor: "#effaff" },
  vibesProStatusScreen: { backgroundColor: "#0B0B0B" },
  statusContent: { alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  header: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(186,230,253,0.6)",
  },
  vibesProHeader: { borderBottomColor: "rgba(255,255,255,0.08)" },
  headerButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  vibesProButton: { backgroundColor: "#252525" },
  backIcon: { color: "#0369a1", fontSize: 35, lineHeight: 39 },
  deleteAllIcon: { color: "#0f172a", fontSize: 24, fontWeight: "800" },
  heading: { alignItems: "center" },
  eyebrow: { color: "#0284c7", fontSize: 9, fontWeight: "900", letterSpacing: 2.4 },
  vibesProGold: { color: "#D4AF37" },
  title: { color: "#0c1d2d", fontSize: 20, fontWeight: "900" },
  vibesProText: { color: "#ffffff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  content: { gap: 12, padding: 15, paddingBottom: 34 },
  notificationCard: {
    position: "relative",
    minHeight: 108,
    padding: 15,
    paddingRight: 52,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.38)",
  },
  vibesProCard: { borderColor: "rgba(212,175,55,0.2)", backgroundColor: "#181818" },
  unread: { borderColor: "rgba(14,165,233,0.55)", backgroundColor: "rgba(240,249,255,0.56)" },
  vibesProUnread: { borderColor: "#D4AF37" },
  notificationBody: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  avatar: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 17 },
  vibesProAvatar: { borderWidth: 2, borderColor: "rgba(212,175,55,0.35)" },
  avatarInitial: { color: "#ffffff", fontSize: 15, fontWeight: "900" },
  notificationText: { flex: 1, minWidth: 0 },
  greeting: { marginBottom: 5, color: "#0f172a", fontSize: 12, fontWeight: "700" },
  actorLine: { flexDirection: "row", alignItems: "center", gap: 7 },
  actorName: { flexShrink: 1, color: "#0369a1", fontSize: 14, fontWeight: "900" },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#0ea5e9" },
  vibesProUnreadDot: { backgroundColor: "#D4AF37" },
  messageRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 6 },
  emoji: { fontSize: 19 },
  bodyText: { flex: 1, color: "#334155", fontSize: 13, lineHeight: 19 },
  vibesProBodyText: { color: "rgba(255,255,255,0.8)" },
  time: { marginTop: 8, color: "#64748b", fontSize: 10, textAlign: "right" },
  vibesProMutedText: { color: "rgba(255,255,255,0.5)" },
  deleteButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.8)",
  },
  deleteIcon: { color: "#475569", fontSize: 24, lineHeight: 27 },
  emptyIcon: { fontSize: 38 },
  emptyTitle: { color: "#0f172a", fontSize: 17, fontWeight: "800" },
  retryButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, backgroundColor: "#0284c7" },
  retryText: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
  inlineError: { color: "#be123c", fontSize: 12, textAlign: "center" },
  disabled: { opacity: 0.45 },
});
