import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  ActivityIndicator,
  Alert,
  AccessibilityInfo,
  Easing,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Archive, Ban, Mail, Pin, Trash2, X } from "lucide-react-native";
import NativeBlurBackdrop from "./NativeBlurBackdrop";
import type { MessageThread } from "../../types/message";
import { formatDisplayDate } from "../../lib/time";
import { useNativeAuth } from "../contexts/NativeAuthProvider";
import { useNativeEntitlement } from "../contexts/NativeEntitlementProvider";
import { NATIVE_THEME_COLORS, useNativeTheme } from "../contexts/NativeThemeProvider";
import {
  clearNativeConversationActions,
  fetchNativeConversationActions,
  setNativeConversationAction,
  type NativeConversationActionField,
} from "../lib/conversationActions";
import { fetchNativeMessageThreads } from "../lib/messages";
import { blockNativeUser } from "../lib/posts";
import { nativeConversationActionsQueryKey, nativeMessageThreadsQueryKey } from "../lib/queryKeys";
import { nativeSupabase } from "../lib/supabase";
import { NativeConversationRowsSkeleton } from "./NativeScreenSkeletons";
import NativeStories from "./NativeStories";

const BOTTOM_BAR_HIDE_DELAY_MS = 10_000;

function getThreadsCacheKey(userId: string) {
  return `metoyou-threads:${userId}`;
}

function parseCachedThreads(raw: string): MessageThread[] {
  const parsed: unknown = JSON.parse(raw);
  if (
    !Array.isArray(parsed) ||
    !parsed.every((thread) =>
      thread &&
      typeof thread.conversationId === "string" &&
      typeof thread.otherId === "string" &&
      typeof thread.otherUsername === "string"
    )
  ) {
    throw new Error("Saved conversations are invalid. Refresh to load them again.");
  }
  return parsed as MessageThread[];
}

function sortThreads(threads: MessageThread[]) {
  return [...threads].sort((left, right) => {
    const leftTime = left.lastTime ? new Date(left.lastTime).getTime() : 0;
    const rightTime = right.lastTime ? new Date(right.lastTime).getTime() : 0;
    return rightTime - leftTime;
  });
}

export default function NativeMessagesScreen({ folder = "messages" }: { folder?: "messages" | "spam" } = {}) {
  const router = useRouter();
  const { session } = useNativeAuth();
  const { entitlement, refresh: refreshEntitlement } = useNativeEntitlement();
  const { theme } = useNativeTheme();
  const isBlueSky = theme === "bluesky";
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const [cachedThreadsUserId, setCachedThreadsUserId] = useState<string | null>(null);
  const [cacheError, setCacheError] = useState<string | null>(null);
  const showSpam = folder === "spam";
  const threadsQueryKey = nativeMessageThreadsQueryKey(userId ?? "");
  const actionsQueryKey = nativeConversationActionsQueryKey(userId ?? "");
  const threadsQuery = useQuery({
    queryKey: threadsQueryKey,
    queryFn: async () => sortThreads(await fetchNativeMessageThreads(userId!)),
    enabled: Boolean(userId && cachedThreadsUserId === userId),
    staleTime: 20_000,
  });
  const actionsQuery = useQuery({
    queryKey: actionsQueryKey,
    queryFn: () => fetchNativeConversationActions(userId!),
    enabled: Boolean(userId),
  });
  const threads = threadsQuery.data ?? [];
  const actions = actionsQuery.data;
  const pinnedIds = actions?.pinnedIds ?? [];
  const archivedIds = actions?.archivedIds ?? [];
  const unreadIds = actions?.unreadIds ?? [];
  const deletedIds = actions?.deletedIds ?? [];
  const visibleThreads = threads
    .filter((thread) => (showSpam ? thread.isSpam : !thread.isSpam) &&
      !archivedIds.includes(thread.conversationId) &&
      !deletedIds.includes(thread.conversationId))
    .sort((left, right) => {
      const pinOrder = Number(pinnedIds.includes(right.conversationId)) - Number(pinnedIds.includes(left.conversationId));
      if (pinOrder) return pinOrder;
      const leftTime = left.lastTime ? new Date(left.lastTime).getTime() : 0;
      const rightTime = right.lastTime ? new Date(right.lastTime).getTime() : 0;
      return rightTime - leftTime;
    });
  const loading = Boolean(userId && !threadsQuery.data && (
    cachedThreadsUserId !== userId || threadsQuery.isPending || actionsQuery.isPending
  ));
  const refreshing = threadsQuery.isRefetching;
  const error = threadsQuery.isError
    ? threadsQuery.error.message
    : actionsQuery.isError
      ? actionsQuery.error.message
      : cacheError;
  const isVibesPro = entitlement.status === "vibesPro";
  const [bottomBarVisible, setBottomBarVisible] = useState(true);
  const bottomBarTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomBarOpacity = useRef(new Animated.Value(1)).current;
  const bottomBarOffset = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const callPhoneLift = useRef(new Animated.Value(2)).current;
  const callPhoneRotation = useRef(new Animated.Value(0)).current;
  const callArrowOpacity = useRef(new Animated.Value(0)).current;
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const selectedIsPinned = Boolean(selectedThread && pinnedIds.includes(selectedThread.conversationId));
  const selectedIsUnread = Boolean(selectedThread && unreadIds.includes(selectedThread.conversationId));
  const selectedIsArchived = Boolean(selectedThread && archivedIds.includes(selectedThread.conversationId));
  const actionIconColor = isBlueSky ? "#ffffff" : isVibesPro ? "#451a03" : "#334155";

  useFocusEffect(useCallback(() => {
    if (!userId) return;
    const invalidateThreads = () => {
      void queryClient.invalidateQueries({ queryKey: nativeMessageThreadsQueryKey(userId), exact: true });
    };
    const channel = nativeSupabase
      .channel(`native-inbox-updates:${userId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "followers",
        filter: `follower_id=eq.${userId}`,
      }, invalidateThreads)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "followers",
        filter: `following_id=eq.${userId}`,
      }, invalidateThreads)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "conversations",
        filter: `user_1=eq.${userId}`,
      }, invalidateThreads)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "conversations",
        filter: `user_2=eq.${userId}`,
      }, invalidateThreads)
      .subscribe();
    return () => { void nativeSupabase.removeChannel(channel); };
  }, [queryClient, userId]));

  useFocusEffect(useCallback(() => {
    if (userId && cachedThreadsUserId === userId) void threadsQuery.refetch();
  }, [cachedThreadsUserId, threadsQuery.refetch, userId]));

  useEffect(() => {
    let isMounted = true;
    const motionSubscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (isMounted) setReduceMotion(enabled);
    });

    return () => {
      isMounted = false;
      motionSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion === null) return;
    if (reduceMotion) {
      callPhoneLift.setValue(2);
      callPhoneRotation.setValue(0);
      callArrowOpacity.setValue(0);
      return;
    }

    const phoneMotion = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(callPhoneLift, { toValue: -2, duration: 288, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(callPhoneRotation, { toValue: -9, duration: 288, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(callPhoneLift, { toValue: -5, duration: 144, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(callPhoneRotation, { toValue: 10, duration: 144, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(callPhoneLift, { toValue: -6, duration: 144, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(callPhoneRotation, { toValue: -10, duration: 144, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(callPhoneLift, { toValue: -4, duration: 144, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(callPhoneRotation, { toValue: 8, duration: 144, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(callPhoneLift, { toValue: 1, duration: 192, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(callPhoneRotation, { toValue: -4, duration: 192, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(callPhoneLift, { toValue: 2, duration: 192, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(callPhoneRotation, { toValue: 0, duration: 192, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.delay(1296),
      ]),
    );
    const arrowMotion = Animated.loop(
      Animated.sequence([
        Animated.timing(callArrowOpacity, { toValue: 1, duration: 630, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(360),
        Animated.timing(callArrowOpacity, { toValue: 0, duration: 270, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(540),
      ]),
    );
    phoneMotion.start();
    arrowMotion.start();

    return () => {
      phoneMotion.stop();
      arrowMotion.stop();
    };
  }, [callArrowOpacity, callPhoneLift, callPhoneRotation, reduceMotion]);

  const revealBottomBar = useCallback(() => {
    if (!isVibesPro) return;
    setBottomBarVisible(true);
    if (bottomBarTimer.current) clearTimeout(bottomBarTimer.current);
    bottomBarTimer.current = setTimeout(() => {
      setBottomBarVisible(false);
      bottomBarTimer.current = null;
    }, BOTTOM_BAR_HIDE_DELAY_MS);
  }, [isVibesPro]);

  useEffect(() => {
    setBottomBarVisible(!isVibesPro);
    if (bottomBarTimer.current) {
      clearTimeout(bottomBarTimer.current);
      bottomBarTimer.current = null;
    }
  }, [isVibesPro]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(bottomBarOpacity, {
        toValue: bottomBarVisible ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(bottomBarOffset, {
        toValue: bottomBarVisible ? 0 : 24,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [bottomBarOffset, bottomBarOpacity, bottomBarVisible]);

  useEffect(() => () => {
    if (bottomBarTimer.current) clearTimeout(bottomBarTimer.current);
  }, []);

  useEffect(() => {
    if (!userId) {
      setCachedThreadsUserId(null);
      setCacheError(null);
      return;
    }
    let active = true;
    setCachedThreadsUserId(null);
    setCacheError(null);
    void (async () => {
      try {
        const cached = await AsyncStorage.getItem(getThreadsCacheKey(userId));
        if (!active) return;
        if (cached) {
          const parsed = sortThreads(parseCachedThreads(cached));
          if (queryClient.getQueryData<MessageThread[]>(threadsQueryKey) === undefined) {
            queryClient.setQueryData<MessageThread[]>(threadsQueryKey, parsed, { updatedAt: 0 });
          }
        }
      } catch (cause) {
        if (active) {
          setCacheError(cause instanceof Error ? cause.message : "Saved conversations could not be read.");
        }
      } finally {
        if (active) setCachedThreadsUserId(userId);
      }
    })();
    return () => {
      active = false;
    };
  }, [queryClient, userId]);

  useEffect(() => {
    if (!userId || cachedThreadsUserId !== userId || !threadsQuery.data) return;
    setCacheError(null);
    void AsyncStorage.setItem(getThreadsCacheKey(userId), JSON.stringify(threadsQuery.data))
      .catch((cause: unknown) => console.warn("Could not persist saved conversations.", cause));
  }, [cachedThreadsUserId, threadsQuery.data, userId]);

  const loadThreads = useCallback(async () => {
    if (!userId || cachedThreadsUserId !== userId) return;
    await threadsQuery.refetch();
  }, [cachedThreadsUserId, threadsQuery.refetch, userId]);

  const updateConversationAction = async (field: NativeConversationActionField, enabled: boolean) => {
    if (!userId || !selectedThread || actionBusy) return;
    setActionBusy(true);
    try {
      const next = await setNativeConversationAction(userId, field, selectedThread.conversationId, enabled);
      queryClient.setQueryData(actionsQueryKey, next);
      setSelectedThread(null);
    } catch (cause) {
      Alert.alert("Could not update conversation", cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setActionBusy(false);
    }
  };

  const openThread = async (thread: MessageThread) => {
    if (userId && unreadIds.includes(thread.conversationId)) {
      try {
        const next = await clearNativeConversationActions(userId, thread.conversationId);
        queryClient.setQueryData(actionsQueryKey, next);
      } catch (cause) {
        Alert.alert("Could not mark conversation as read", cause instanceof Error ? cause.message : "Please try again.");
      }
    }
    router.push({ pathname: "/messages/[recipientId]", params: { recipientId: thread.otherId } });
  };

  const confirmDeleteThread = () => {
    const thread = selectedThread;
    if (!userId || !thread) return;
    setSelectedThread(null);
    Alert.alert("Delete conversation?", "This removes the conversation from your list on this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void setNativeConversationAction(userId, "deletedIds", thread.conversationId, true)
            .then((next) => queryClient.setQueryData(actionsQueryKey, next))
            .catch((cause: unknown) => Alert.alert("Could not delete conversation", cause instanceof Error ? cause.message : "Please try again."));
        },
      },
    ]);
  };

  const confirmBlockThread = () => {
    const thread = selectedThread;
    if (!userId || !thread) return;
    setSelectedThread(null);
    Alert.alert(`Block @${thread.otherUsername}?`, "They will no longer be able to contact you.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: () => {
          void blockNativeUser(thread.otherId)
            .then(() => setNativeConversationAction(userId, "deletedIds", thread.conversationId, true))
            .then((next) => queryClient.setQueryData(actionsQueryKey, next))
            .catch((cause: unknown) => Alert.alert("Could not block user", cause instanceof Error ? cause.message : "Please try again."));
        },
      },
    ]);
  };

  const colors = NATIVE_THEME_COLORS[theme].background;

  return (
    <LinearGradient colors={colors} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} style={styles.root}>
      <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
        <View style={[styles.header, isVibesPro && styles.vibesProHeader, isBlueSky && styles.blueSkyHeader]}>
          <Pressable
            accessibilityLabel={showSpam ? "Back to messages" : "Back to feed"}
            accessibilityRole="button"
            onPress={() => showSpam ? router.replace("/messages") : router.navigate("/")}
            style={[styles.backButton, isVibesPro && styles.vibesProBackButton]}
          >
            <Text style={[styles.backText, isVibesPro && styles.vibesProText]}>‹</Text>
          </Pressable>
          <Text style={[styles.title, isVibesPro && styles.vibesProText]}>{showSpam ? "Spam" : "Messages"}</Text>
          <Pressable
            accessibilityLabel="Message settings"
            accessibilityRole="button"
            onPress={() => Alert.alert("Message settings", "Message settings are coming soon.")}
            style={[styles.settingsButton, isVibesPro && styles.vibesProBackButton]}
          >
            <Text style={[styles.settingsText, isVibesPro && styles.vibesProText]}>⚙</Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={[styles.content, styles.contentWithBottomBar]}
          onScroll={revealBottomBar}
          onTouchStart={revealBottomBar}
          refreshControl={
            <RefreshControl
              onRefresh={() => void loadThreads()}
              refreshing={refreshing}
              tintColor="#ffffff"
            />
          }
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={100}
        >
          {!showSpam && entitlement.status === "free" ? (
            <View style={styles.intro}>
              <Text style={styles.brand}>MeToYou 💎✨</Text>
              <Text style={styles.subtitle}>Your conversations, all in one place.</Text>
              <View style={styles.badges}>
                <Text style={styles.badge}>MESSAGES</Text>
                <Text style={styles.badgeAlt}>YOUR PEOPLE</Text>
              </View>
            </View>
          ) : !showSpam && entitlement.status === "vibesPro" ? (
            <>
              <NativeStories isVibesPro messagesList />
              <View style={[styles.searchCard, styles.premiumCard]}>
                <Text style={styles.searchPlaceholder}>Search messages</Text>
              </View>
            </>
          ) : !showSpam ? (
            <View style={styles.stateCard}>
              {entitlement.status === "error" ? (
                <>
                  <Text style={styles.error}>{entitlement.error.message}</Text>
                  <Pressable accessibilityRole="button" onPress={() => void refreshEntitlement()} style={styles.retryButton}>
                    <Text style={styles.retryText}>Retry account status</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <ActivityIndicator color="#ffffff" />
                  <Text style={styles.stateText}>Checking account features…</Text>
                </>
              )}
            </View>
          ) : null}

          {showSpam ? (
            <View style={[styles.spamNotice, isVibesPro && styles.premiumCard, isBlueSky && styles.blueSkyCard]}>
              <Text style={[styles.spamNoticeTitle, isVibesPro && styles.vibesProText]}>Message requests</Text>
              <Text style={[styles.spamNoticeText, isVibesPro && styles.premiumMuted]}>
                Messages from people you do not follow mutually stay here. Reply or follow them back to move the conversation to Messages.
              </Text>
            </View>
          ) : null}

          {error && !loading ? (
            <View style={[styles.stateCard, isVibesPro && styles.premiumCard]}>
              <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
              <Pressable accessibilityRole="button" onPress={() => void loadThreads()} style={styles.retryButton}>
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : null}
          {loading ? (
            <NativeConversationRowsSkeleton count={5} />
          ) : error && visibleThreads.length === 0 ? null : visibleThreads.length === 0 ? (
            <View style={[styles.stateCard, isVibesPro && styles.premiumCard]}>
              <Text style={[styles.emptyText, isVibesPro && styles.vibesProText]}>{showSpam ? "No spam messages." : "No messages yet."}</Text>
            </View>
          ) : (
            <View style={styles.threadList}>
              {visibleThreads.map((thread) => (
                <Pressable
                  accessibilityLabel={`Conversation with ${thread.otherUsername}`}
                  accessibilityRole="button"
                  key={thread.conversationId}
                  onPress={() => void openThread(thread)}
                  onLongPress={() => setSelectedThread(thread)}
                  style={({ pressed }) => [styles.threadCard, isBlueSky && styles.blueSkyCard, pressed && styles.pressed]}
                >
                  <View style={[styles.avatar, isVibesPro && styles.premiumAvatar]}>
                    <Text style={styles.avatarText}>{thread.otherUsername.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View style={styles.threadCopy}>
                      <Text numberOfLines={1} style={[styles.username, isVibesPro && styles.vibesProText]}>
                        {pinnedIds.includes(thread.conversationId) ? "📌 " : ""}
                        {unreadIds.includes(thread.conversationId) ? "● " : ""}
                      {thread.otherUsername}
                    </Text>
                    {showSpam ? <Text style={styles.spamThreadLabel}>Message request</Text> : null}
                    <Text numberOfLines={1} style={[styles.lastMessage, isVibesPro && styles.premiumMuted]}>
                      {thread.lastText || "No messages"}
                    </Text>
                  </View>
                  {thread.lastTime ? (
                    <Text style={[styles.timestamp, isVibesPro && styles.premiumFaint]}>
                      {formatDisplayDate(thread.lastTime)}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
        <Animated.View
          pointerEvents={bottomBarVisible ? "auto" : "none"}
          style={[
            styles.bottomBarPosition,
            { opacity: bottomBarOpacity, transform: [{ translateY: bottomBarOffset }] },
          ]}
        >
          <View style={[styles.bottomBar, isVibesPro && styles.vibesProBottomBar]}>
            <Pressable
              accessibilityLabel={showSpam ? "Back to messages" : "Open spam messages"}
              accessibilityRole="button"
              onPress={() => showSpam ? router.replace("/messages") : router.push("/messages/spam")}
              onPressIn={revealBottomBar}
              style={({ pressed }) => [styles.bottomBarAction, styles.bottomBarLeft, pressed && styles.pressed]}
            >
              <Text style={[styles.navigationText, isVibesPro && styles.vibesProText]}>{showSpam ? "Messages" : "Spam"}</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Call history"
              accessibilityRole="button"
              onPress={() => router.push("/(app)/calls")}
              onPressIn={revealBottomBar}
              style={({ pressed }) => [styles.callAction, isVibesPro && styles.vibesProCallAction, pressed && styles.pressed]}
            >
              <Text style={[styles.callPhoneGlyph, isVibesPro && styles.vibesProText]}>☎</Text>
              <Animated.Text
                style={[
                  styles.callArrow,
                  isVibesPro && styles.vibesProText,
                  { opacity: callArrowOpacity },
                ]}
              >
                →
              </Animated.Text>
              <Animated.Text
                style={[
                  styles.callMobileGlyph,
                  isVibesPro && styles.vibesProText,
                  {
                    transform: [
                      { translateY: callPhoneLift },
                      {
                        rotate: callPhoneRotation.interpolate({
                          inputRange: [-10, 10],
                          outputRange: ["-10deg", "10deg"],
                        }),
                      },
                    ],
                  },
                ]}
              >
                📱
              </Animated.Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Archived messages"
              accessibilityRole="button"
              onPress={() => router.push("/messages/archived")}
              onPressIn={revealBottomBar}
              style={({ pressed }) => [styles.bottomBarAction, styles.bottomBarRight, pressed && styles.pressed]}
            >
              <Text style={[styles.navigationText, isVibesPro && styles.vibesProText]}>Archived</Text>
            </Pressable>
          </View>
        </Animated.View>
      </SafeAreaView>
      <Modal animationType="fade" onRequestClose={() => setSelectedThread(null)} transparent visible={Boolean(selectedThread)}>
        <NativeBlurBackdrop intensity={18} overlayColor="rgba(0,0,0,0.35)" />
        <Pressable accessibilityRole="button" onPress={() => setSelectedThread(null)} style={styles.actionBackdrop}>
          <Pressable onPress={(event) => event.stopPropagation()} style={[styles.actionMenuCard, isVibesPro && styles.premiumActionMenu, isBlueSky && styles.blueSkyActionMenu]}>
            <View style={styles.actionTitleRow}>
              <View style={styles.actionHeadingCopy}>
                <Text style={[styles.actionTitle, isBlueSky && styles.blueSkyActionText]}>Conversation actions</Text>
                <Text style={[styles.actionSubtitle, isBlueSky && styles.blueSkyActionSubtitle]}>@{selectedThread?.otherUsername}</Text>
              </View>
              <Pressable accessibilityLabel="Close conversation actions" accessibilityRole="button" disabled={actionBusy} onPress={() => setSelectedThread(null)} style={styles.actionClose}>
                <X color={isBlueSky ? "#ffffff" : "#0c4a6e"} size={20} />
              </Pressable>
            </View>
            <View style={styles.actionGrid}>
              <Pressable accessibilityRole="button" disabled={actionBusy} onPress={() => void updateConversationAction("pinnedIds", !selectedIsPinned)} style={({ pressed }) => [styles.actionButton, isVibesPro && styles.premiumActionButton, isBlueSky && styles.blueSkyActionButton, pressed && styles.actionPressed]}>
                <Pin color={actionIconColor} size={22} />
                <Text style={[styles.actionButtonText, isVibesPro && styles.premiumActionText, isBlueSky && styles.blueSkyActionText]}>{selectedIsPinned ? "Unpin" : "Pin"}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={actionBusy} onPress={() => void updateConversationAction("unreadIds", !selectedIsUnread)} style={({ pressed }) => [styles.actionButton, isVibesPro && styles.premiumActionButton, isBlueSky && styles.blueSkyActionButton, pressed && styles.actionPressed]}>
                <Mail color={actionIconColor} size={22} />
                <Text style={[styles.actionButtonText, isVibesPro && styles.premiumActionText, isBlueSky && styles.blueSkyActionText]}>{selectedIsUnread ? "Mark read" : "Mark as unread"}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={actionBusy} onPress={confirmDeleteThread} style={({ pressed }) => [styles.actionButton, styles.dangerActionButton, pressed && styles.actionPressed]}>
                <Trash2 color="#be123c" size={22} />
                <Text style={[styles.actionButtonText, styles.dangerText]}>Delete</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={actionBusy} onPress={() => void updateConversationAction("archivedIds", !selectedIsArchived)} style={({ pressed }) => [styles.actionButton, isVibesPro && styles.premiumActionButton, isBlueSky && styles.blueSkyActionButton, pressed && styles.actionPressed]}>
                <Archive color={actionIconColor} size={22} />
                <Text style={[styles.actionButtonText, isVibesPro && styles.premiumActionText, isBlueSky && styles.blueSkyActionText]}>{selectedIsArchived ? "Unarchive" : "Archive"}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={actionBusy} onPress={confirmBlockThread} style={({ pressed }) => [styles.actionButton, styles.dangerActionButton, pressed && styles.actionPressed]}>
                <Ban color="#be123c" size={22} />
                <Text style={[styles.actionButtonText, styles.dangerText]}>Block</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#252a33",
    backgroundColor: "rgba(5,7,11,0.92)",
  },
  blueSkyHeader: { borderBottomColor: "#3478bd", backgroundColor: "rgba(6,26,58,0.94)" },
  vibesProHeader: { borderBottomColor: "#252a33" },
  backButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#353b46", borderRadius: 15, backgroundColor: "#151a22" },
  vibesProBackButton: { backgroundColor: "#151a22" },
  backText: { color: "#ffffff", fontSize: 34, lineHeight: 38 },
  title: { color: "#ffffff", fontSize: 19, fontWeight: "900" },
  settingsButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#353b46", borderRadius: 15, backgroundColor: "#151a22" },
  settingsText: { color: "#ffffff", fontSize: 22 },
  content: { width: "100%", maxWidth: 640, alignSelf: "center", padding: 14, paddingBottom: 32, gap: 14 },
  contentWithBottomBar: { paddingBottom: 112 },
  intro: { alignItems: "center", paddingTop: 4, paddingBottom: 8 },
  brand: { color: "#ffffff", fontSize: 24, fontWeight: "900", textAlign: "center" },
  subtitle: { color: "#ffffff", fontSize: 13, lineHeight: 20, marginTop: 7 },
  badges: { flexDirection: "row", gap: 8, marginTop: 14 },
  badge: { overflow: "hidden", color: "#ffffff", fontSize: 10, fontWeight: "800", letterSpacing: 1, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 15, backgroundColor: "#303743" },
  badgeAlt: { overflow: "hidden", color: "#ffffff", fontSize: 10, fontWeight: "800", letterSpacing: 1, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: "#454b55", borderRadius: 15, backgroundColor: "#171c25" },
  premiumCard: { borderWidth: 1, borderColor: "#292f39", borderRadius: 24, backgroundColor: "#10141b" },
  blueSkyCard: { borderColor: "#3478bd", backgroundColor: "#0b2d5b" },
  searchCard: { paddingHorizontal: 14, paddingVertical: 12 },
  searchPlaceholder: { color: "rgba(255,255,255,0.5)", fontSize: 14 },
  spamNotice: { gap: 5, padding: 14, borderWidth: 1, borderColor: "#b45309", borderRadius: 16, backgroundColor: "#23190d" },
  spamNoticeTitle: { color: "#fbbf24", fontSize: 14, fontWeight: "900" },
  spamNoticeText: { color: "#ffffff", fontSize: 12, lineHeight: 18 },
  vibesProText: { color: "#ffffff" },
  stateCard: { alignItems: "center", justifyContent: "center", gap: 10, padding: 24, borderWidth: 1, borderColor: "#292f39", borderRadius: 24, backgroundColor: "#10141b" },
  stateText: { color: "#ffffff", fontSize: 13 },
  premiumMuted: { color: "rgba(255,255,255,0.62)" },
  themeWarning: { color: "#fda4af", fontSize: 12, lineHeight: 18 },
  error: { color: "#fda4af", fontSize: 14, lineHeight: 20, textAlign: "center" },
  retryButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: "#303743" },
  retryText: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
  emptyText: { color: "#ffffff", fontSize: 16, fontWeight: "800" },
  threadList: { gap: 8 },
  threadCard: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: "#2e3540", borderRadius: 20, backgroundColor: "#171c25" },
  avatar: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#252b35" },
  premiumAvatar: { backgroundColor: "#252b35" },
  avatarText: { color: "#ffffff", fontSize: 17, fontWeight: "900" },
  threadCopy: { flex: 1, minWidth: 0 },
  username: { color: "#ffffff", fontSize: 14, fontWeight: "800" },
  spamThreadLabel: { marginTop: 3, color: "#fbbf24", fontSize: 10, fontWeight: "800" },
  lastMessage: { marginTop: 4, color: "rgba(255,255,255,0.75)", fontSize: 12 },
  timestamp: { color: "#ffffff", fontSize: 10 },
  premiumFaint: { color: "rgba(255,255,255,0.62)" },
  bottomBarPosition: { position: "absolute", right: 0, bottom: 0, left: 0, alignItems: "center", paddingHorizontal: 24, paddingBottom: 4 },
  bottomBar: { width: "100%", maxWidth: 576, minHeight: 64, flexDirection: "row", alignItems: "stretch", borderWidth: 1, borderColor: "#292f39", borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden", backgroundColor: "#10141b", shadowColor: "#000000", shadowOpacity: 0.28, shadowRadius: 16, shadowOffset: { width: 0, height: -5 }, elevation: 12 },
  vibesProBottomBar: { borderColor: "#292f39", backgroundColor: "#10141b" },
  bottomBarAction: { flex: 1, justifyContent: "center", paddingHorizontal: 12, paddingVertical: 14 },
  bottomBarLeft: { alignItems: "flex-start", borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: "#292f39", paddingLeft: 24 },
  bottomBarRight: { alignItems: "center" },
  navigationText: { color: "#ffffff", fontSize: 11, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" },
  callAction: { width: 112, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 10, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: "#292f39" },
  vibesProCallAction: { borderRightColor: "#292f39" },
  callPhoneGlyph: { color: "#ffffff", fontSize: 20 },
  callArrow: { color: "#ffffff", fontSize: 16 },
  callMobileGlyph: { color: "#ffffff", fontSize: 20 },
  pressed: { opacity: 0.7, backgroundColor: "#252b35" },
  actionBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  actionMenuCard: { width: "100%", maxWidth: 390, padding: 16, borderWidth: 1, borderColor: "#dbeafe", borderRadius: 24, backgroundColor: "#ffffff", shadowColor: "#020617", shadowOpacity: 0.24, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  premiumActionMenu: { borderColor: "#bae6fd", backgroundColor: "#ffffff" },
  blueSkyActionMenu: { borderColor: "#3478bd", backgroundColor: "#0b2d5b" },
  actionTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  actionHeadingCopy: { flex: 1, gap: 3 },
  actionTitle: { color: "#0c4a6e", fontSize: 18, fontWeight: "900" },
  actionSubtitle: { color: "#64748b", fontSize: 12 },
  blueSkyActionSubtitle: { color: "rgba(255,255,255,0.7)" },
  actionClose: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionButton: { width: "48%", minHeight: 82, flexGrow: 1, alignItems: "center", justifyContent: "center", gap: 7, padding: 10, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 16, backgroundColor: "#ffffff" },
  premiumActionButton: { borderColor: "#d97706", backgroundColor: "#fcd34d" },
  blueSkyActionButton: { borderColor: "#3478bd", backgroundColor: "#155192" },
  actionButtonText: { color: "#334155", fontSize: 12, fontWeight: "700", textAlign: "center" },
  premiumActionText: { color: "#451a03" },
  blueSkyActionText: { color: "#ffffff" },
  dangerActionButton: { borderColor: "#fecdd3" },
  dangerText: { color: "#be123c" },
  actionPressed: { opacity: 0.78 },
});
