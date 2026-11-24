import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  ActivityIndicator,
  Alert,
  AccessibilityInfo,
  Easing,
  Image,
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Archive, Ban, Mail, Pin, Trash2, X } from "lucide-react-native";
import Svg, { Defs, Ellipse, Path, RadialGradient, Stop } from "react-native-svg";
import NativeBlurBackdrop from "./NativeBlurBackdrop";
import type { MessageThread } from "../../types/message";
import { formatDisplayDate } from "../../lib/time";
import { useNativeAuth } from "../contexts/NativeAuthProvider";
import { useNativeEntitlement } from "../contexts/NativeEntitlementProvider";
import { NATIVE_THEME_COLORS, NATIVE_TYPE_SCALE, useNativeTheme } from "../contexts/NativeThemeProvider";
import {
  clearNativeConversationActions,
  fetchNativeConversationActions,
  setNativeConversationAction,
  type NativeConversationActionField,
} from "../lib/conversationActions";
import { fetchNativeMessageThreads } from "../lib/messages";
import { blockNativeUser } from "../lib/posts";
import { nativeConversationActionsQueryKey, nativeMessageThreadsQueryKey } from "../lib/queryKeys";
import { nativeMessageThreadsCacheKey } from "../lib/nativeAccountStorage";
import { NATIVE_OFFLINE_MESSAGE } from "../lib/networkStatus";
import { nativeSupabase } from "../lib/supabase";
import { NativeConversationRowsSkeleton } from "./NativeScreenSkeletons";
import NativeConfirmDialog from "./NativeConfirmDialog";
import NativeStories from "./NativeStories";
import NativeGlassSurface, { NATIVE_LIQUID_GLASS_PRESSED } from "./NativeGlassSurface";

const BOTTOM_BAR_HIDE_DELAY_MS = 10_000;

type ThreadConfirmation = {
  type: "delete" | "block";
  thread: MessageThread;
};

function WizrdSmokeShape() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 80 100">
      <Defs>
        <RadialGradient id="wizrdSmokeGradient" cx="50%" cy="45%" r="58%">
          <Stop offset="0%" stopColor="#c5cbd1" stopOpacity="0.78" />
          <Stop offset="58%" stopColor="#858d96" stopOpacity="0.52" />
          <Stop offset="100%" stopColor="#59616b" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Path
        d="M15 88c-9-3-10-14-2-20-8-10-3-22 9-25-3-12 7-22 18-18 5-12 21-13 27-2 11-1 18 11 12 20 10 9 7 23-5 27 3 10-6 18-16 16-9 9-21 7-27 0-5 5-11 5-16 2Z"
        fill="url(#wizrdSmokeGradient)"
      />
      <Ellipse cx="25" cy="59" rx="19" ry="20" fill="url(#wizrdSmokeGradient)" opacity="0.58" />
      <Ellipse cx="54" cy="55" rx="22" ry="24" fill="url(#wizrdSmokeGradient)" opacity="0.62" />
    </Svg>
  );
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
  const insets = useSafeAreaInsets();
  const { session, cacheUserId, status } = useNativeAuth();
  const { entitlement, refresh: refreshEntitlement } = useNativeEntitlement();
  const { theme } = useNativeTheme();
  const isBlueSky = theme === "bluesky";
  const isLiquidGlass = theme === "liquidGlass";
  const userId = session?.user.id;
  const cacheOwnerId = cacheUserId;
  const queryClient = useQueryClient();
  const [cachedThreadsUserId, setCachedThreadsUserId] = useState<string | null>(null);
  const [cacheError, setCacheError] = useState<string | null>(null);
  const showSpam = folder === "spam";
  const threadsQueryKey = nativeMessageThreadsQueryKey(cacheOwnerId ?? "");
  const actionsQueryKey = nativeConversationActionsQueryKey(cacheOwnerId ?? "");
  const threadsQuery = useQuery({
    queryKey: threadsQueryKey,
    queryFn: async () => sortThreads(await fetchNativeMessageThreads(userId!)),
    enabled: Boolean(userId && cacheOwnerId && cachedThreadsUserId === cacheOwnerId),
    staleTime: 20_000,
  });
  const actionsQuery = useQuery({
    queryKey: actionsQueryKey,
    queryFn: () => fetchNativeConversationActions(userId!),
    enabled: Boolean(userId && cacheOwnerId),
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
  const loading = Boolean(cacheOwnerId && !threadsQuery.data && (
    cachedThreadsUserId !== cacheOwnerId ||
    threadsQuery.isPending ||
    Boolean(userId && actionsQuery.isPending)
  ));
  const refreshing = threadsQuery.isRefetching;
  const error = threadsQuery.isError
    ? threadsQuery.error.message
    : actionsQuery.isError
      ? actionsQuery.error.message
      : cacheError ?? (status === "offlineDeferred" && !threadsQuery.data ? NATIVE_OFFLINE_MESSAGE : null);
  const isVibesPro = entitlement.status === "vibesPro";
  const [bottomBarVisible, setBottomBarVisible] = useState(true);
  const bottomBarTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomBarOpacity = useRef(new Animated.Value(1)).current;
  const bottomBarOffset = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const wizrdSmokeLeft = useRef(new Animated.Value(0)).current;
  const wizrdSmokeCenter = useRef(new Animated.Value(0)).current;
  const wizrdSmokeRight = useRef(new Animated.Value(0)).current;
  const callPhoneLift = useRef(new Animated.Value(2)).current;
  const callPhoneRotation = useRef(new Animated.Value(0)).current;
  const callArrowOpacity = useRef(new Animated.Value(0)).current;
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const [threadConfirmation, setThreadConfirmation] = useState<ThreadConfirmation | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const selectedIsPinned = Boolean(selectedThread && pinnedIds.includes(selectedThread.conversationId));
  const selectedIsUnread = Boolean(selectedThread && unreadIds.includes(selectedThread.conversationId));
  const selectedIsArchived = Boolean(selectedThread && archivedIds.includes(selectedThread.conversationId));
  const actionIconColor = NATIVE_THEME_COLORS[theme].text;

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
    if (reduceMotion !== false) {
      wizrdSmokeLeft.setValue(0);
      wizrdSmokeCenter.setValue(0);
      wizrdSmokeRight.setValue(0);
      return;
    }

    const smokeAnimations = [
      { value: wizrdSmokeLeft, delay: 0, duration: 1900 },
      { value: wizrdSmokeCenter, delay: 620, duration: 2200 },
      { value: wizrdSmokeRight, delay: 1280, duration: 2000 },
    ].map(({ value, delay, duration }) => Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(value, { toValue: 1, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    ));

    smokeAnimations.forEach((animation) => animation.start());
    return () => {
      smokeAnimations.forEach((animation) => animation.stop());
    };
  }, [reduceMotion, wizrdSmokeCenter, wizrdSmokeLeft, wizrdSmokeRight]);

  useEffect(() => {
    if (!cacheOwnerId) {
      setCachedThreadsUserId(null);
      setCacheError(null);
      return;
    }
    let active = true;
    setCachedThreadsUserId(null);
    setCacheError(null);
    void (async () => {
      try {
        const cached = await AsyncStorage.getItem(nativeMessageThreadsCacheKey(cacheOwnerId));
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
        if (active) setCachedThreadsUserId(cacheOwnerId);
      }
    })();
    return () => {
      active = false;
    };
  }, [cacheOwnerId, queryClient, threadsQueryKey]);

  useEffect(() => {
    if (!cacheOwnerId || cachedThreadsUserId !== cacheOwnerId || !threadsQuery.data) return;
    setCacheError(null);
    void AsyncStorage.setItem(nativeMessageThreadsCacheKey(cacheOwnerId), JSON.stringify(threadsQuery.data))
      .catch((cause: unknown) => console.warn("Could not persist saved conversations.", cause));
  }, [cacheOwnerId, cachedThreadsUserId, threadsQuery.data]);

  const loadThreads = useCallback(async () => {
    if (!userId || !cacheOwnerId || cachedThreadsUserId !== cacheOwnerId) return;
    await threadsQuery.refetch();
  }, [cacheOwnerId, cachedThreadsUserId, threadsQuery.refetch, userId]);

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
    setThreadConfirmation({ type: "delete", thread });
  };

  const confirmBlockThread = () => {
    const thread = selectedThread;
    if (!userId || !thread) return;
    setSelectedThread(null);
    setThreadConfirmation({ type: "block", thread });
  };

  const colors = NATIVE_THEME_COLORS[theme];

  return (
    <LinearGradient colors={colors.background} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} style={styles.root}>
      <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
        <NativeGlassSurface enabled={isLiquidGlass} style={[styles.header, isVibesPro && styles.vibesProHeader, isBlueSky && styles.blueSkyHeader, { backgroundColor: isLiquidGlass ? "transparent" : colors.surface, borderBottomColor: colors.border }]}>
          <Pressable
            accessibilityLabel={showSpam ? "Back to messages" : "Back to feed"}
            accessibilityRole="button"
            onPress={() => showSpam ? router.replace("/messages") : router.navigate("/")}
            style={[styles.backButton, isVibesPro && styles.vibesProBackButton, { backgroundColor: colors.control, borderColor: colors.border }]}
          >
            <Text style={[styles.backText, isVibesPro && styles.vibesProText, { color: colors.text }]}>‹</Text>
          </Pressable>
          <Text style={[styles.title, isVibesPro && styles.vibesProText, { color: colors.text }]}>{showSpam ? "Spam" : "Messages"}</Text>
          <Pressable
            accessibilityLabel="Message settings"
            accessibilityRole="button"
            onPress={() => Alert.alert("Message settings", "Message settings are coming soon.")}
            style={[styles.settingsButton, isVibesPro && styles.vibesProBackButton, { backgroundColor: colors.control, borderColor: colors.border }]}
          >
            <Text style={[styles.settingsText, isVibesPro && styles.vibesProText, { color: colors.text }]}>⚙</Text>
          </Pressable>
        </NativeGlassSurface>
        <ScrollView
          contentContainerStyle={[styles.content, styles.contentWithBottomBar, { paddingBottom: 112 + insets.bottom }]}
          onScroll={revealBottomBar}
          onTouchStart={revealBottomBar}
          refreshControl={
            <RefreshControl
              onRefresh={() => void loadThreads()}
              refreshing={refreshing}
              tintColor={colors.accent}
            />
          }
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={100}
        >
          {!showSpam && entitlement.status === "free" ? (
            <View style={styles.intro}>
              <Text style={[styles.brand, { color: colors.text }]}>MeToYou 💎✨</Text>
              <Text style={[styles.subtitle, { color: colors.muted }]}>Your conversations, all in one place.</Text>
              <View style={styles.badges}>
                <Text style={[styles.badge, { color: colors.accentText, backgroundColor: colors.accent }]}>MESSAGES</Text>
                <Text style={[styles.badgeAlt, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}>YOUR PEOPLE</Text>
              </View>
            </View>
          ) : !showSpam && entitlement.status === "vibesPro" ? (
            <>
              <NativeStories isVibesPro messagesList />
              <View style={[styles.searchCard, styles.premiumCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.searchPlaceholder, { color: colors.muted }]}>Search messages</Text>
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
                  <ActivityIndicator color={colors.accent} />
                  <Text style={[styles.stateText, { color: colors.muted }]}>Checking account features…</Text>
                </>
              )}
            </View>
          ) : null}

          {showSpam ? (
            <View style={[styles.spamNotice, isVibesPro && styles.premiumCard, isBlueSky && styles.blueSkyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.spamNoticeTitle, isVibesPro && styles.vibesProText, { color: colors.text }]}>Message requests</Text>
              <Text style={[styles.spamNoticeText, isVibesPro && styles.premiumMuted, { color: colors.muted }]}>
                Messages from people you do not follow mutually stay here. Reply or follow them back to move the conversation to Messages.
              </Text>
            </View>
          ) : null}

          {error && !loading ? (
            <View style={[styles.stateCard, isVibesPro && styles.premiumCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text accessibilityRole="alert" style={[styles.error, { color: colors.text }]}>{error}</Text>
              <Pressable accessibilityRole="button" onPress={() => void loadThreads()} style={[styles.retryButton, { backgroundColor: colors.accent }]}>
                <Text style={[styles.retryText, { color: colors.accentText }]}>Try again</Text>
              </Pressable>
            </View>
          ) : null}
          {loading ? (
            <NativeConversationRowsSkeleton count={5} />
          ) : error && visibleThreads.length === 0 ? null : visibleThreads.length === 0 ? (
            <View style={[styles.stateCard, isVibesPro && styles.premiumCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.emptyText, isVibesPro && styles.vibesProText, { color: colors.text }]}>{showSpam ? "No spam messages." : "No messages yet."}</Text>
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
                  style={({ pressed }) => [
                    styles.threadCard,
                    isBlueSky && styles.blueSkyCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    pressed && (isLiquidGlass ? NATIVE_LIQUID_GLASS_PRESSED : styles.pressed),
                  ]}
                >
                  <View style={[styles.avatar, isVibesPro && styles.premiumAvatar, { backgroundColor: colors.control, borderColor: colors.border }]}>
                    <Text style={[styles.avatarText, { color: colors.text }]}>{thread.otherUsername.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View style={styles.threadCopy}>
                      <Text numberOfLines={1} style={[styles.username, isVibesPro && styles.vibesProText, { color: colors.text }]}>
                        {pinnedIds.includes(thread.conversationId) ? "📌 " : ""}
                        {unreadIds.includes(thread.conversationId) ? "● " : ""}
                      {thread.otherUsername}
                    </Text>
                    {showSpam ? <Text style={styles.spamThreadLabel}>Message request</Text> : null}
                    <Text numberOfLines={1} style={[styles.lastMessage, isVibesPro && styles.premiumMuted, { color: colors.muted }]}>
                      {thread.lastText || "No messages"}
                    </Text>
                  </View>
                  {thread.lastTime ? (
                    <Text style={[styles.timestamp, isVibesPro && styles.premiumFaint, { color: colors.muted }]}>
                      {formatDisplayDate(thread.lastTime)}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
        {!showSpam ? (
          <>
            <View
              pointerEvents="none"
              style={[styles.wizrdAnimationLayer, { bottom: Math.max(insets.bottom, 8) + 72 }]}
            >
              {reduceMotion === false ? (
                <>
                  <Animated.View
                    style={[
                      styles.wizrdSmoke,
                      styles.wizrdSmokeLeft,
                      {
                        opacity: wizrdSmokeLeft.interpolate({ inputRange: [0, 0.3, 0.7, 1], outputRange: [0, 0.72, 0.55, 0] }),
                        transform: [
                          { translateY: wizrdSmokeLeft.interpolate({ inputRange: [0, 1], outputRange: [0, -78] }) },
                          { translateX: wizrdSmokeLeft.interpolate({ inputRange: [0, 1], outputRange: [0, -16] }) },
                          { scale: wizrdSmokeLeft.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1.5] }) },
                        ],
                      },
                    ]}
                  >
                    <WizrdSmokeShape />
                  </Animated.View>
                  <Animated.View
                    style={[
                      styles.wizrdSmoke,
                      styles.wizrdSmokeCenter,
                      {
                        opacity: wizrdSmokeCenter.interpolate({ inputRange: [0, 0.3, 0.7, 1], outputRange: [0, 0.68, 0.52, 0] }),
                        transform: [
                          { translateY: wizrdSmokeCenter.interpolate({ inputRange: [0, 1], outputRange: [0, -92] }) },
                          { translateX: wizrdSmokeCenter.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }) },
                          { scale: wizrdSmokeCenter.interpolate({ inputRange: [0, 1], outputRange: [0.66, 1.62] }) },
                        ],
                      },
                    ]}
                  >
                    <WizrdSmokeShape />
                  </Animated.View>
                  <Animated.View
                    style={[
                      styles.wizrdSmoke,
                      styles.wizrdSmokeRight,
                      {
                        opacity: wizrdSmokeRight.interpolate({ inputRange: [0, 0.3, 0.7, 1], outputRange: [0, 0.7, 0.54, 0] }),
                        transform: [
                          { translateY: wizrdSmokeRight.interpolate({ inputRange: [0, 1], outputRange: [0, -72] }) },
                          { translateX: wizrdSmokeRight.interpolate({ inputRange: [0, 1], outputRange: [0, 18] }) },
                          { scale: wizrdSmokeRight.interpolate({ inputRange: [0, 1], outputRange: [0.74, 1.48] }) },
                        ],
                      },
                    ]}
                  >
                    <WizrdSmokeShape />
                  </Animated.View>
                </>
              ) : null}
            </View>
            <Pressable
              accessibilityLabel="Ask WiZrd"
              accessibilityRole="button"
              onPress={() => router.push("/messages/wizrd")}
              style={({ pressed }) => [styles.wizrdLauncher, { bottom: Math.max(insets.bottom, 8) + 72 }, pressed && styles.wizrdLauncherPressed]}
            >
              <Image
                accessibilityLabel="WiZrd icon"
                resizeMode="cover"
                source={require("../../assets/wizrd-icon.png")}
                style={styles.wizrdLauncherImage}
              />
            </Pressable>
          </>
        ) : null}
        <Animated.View
          pointerEvents={bottomBarVisible ? "auto" : "none"}
          style={[
            styles.bottomBarPosition,
            { bottom: Math.max(insets.bottom, 8) },
            { opacity: bottomBarOpacity, transform: [{ translateY: bottomBarOffset }] },
          ]}
        >
          <NativeGlassSurface enabled={isLiquidGlass} style={[styles.bottomBar, isVibesPro && styles.vibesProBottomBar, { backgroundColor: isLiquidGlass ? "transparent" : colors.surface, borderColor: colors.border }]}>
            <Pressable
              accessibilityLabel={showSpam ? "Back to messages" : "Open spam messages"}
              accessibilityRole="button"
              onPress={() => showSpam ? router.replace("/messages") : router.push("/messages/spam")}
              onPressIn={revealBottomBar}
              style={({ pressed }) => [
                styles.bottomBarAction,
                styles.bottomBarLeft,
                pressed && (isLiquidGlass ? NATIVE_LIQUID_GLASS_PRESSED : styles.pressed),
              ]}
            >
              <Text style={[styles.navigationText, isVibesPro && styles.vibesProText, { color: colors.text }]}>{showSpam ? "Messages" : "Spam"}</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Call history"
              accessibilityRole="button"
              onPress={() => router.push("/(app)/calls")}
              onPressIn={revealBottomBar}
              style={({ pressed }) => [
                styles.callAction,
                isVibesPro && styles.vibesProCallAction,
                pressed && (isLiquidGlass ? NATIVE_LIQUID_GLASS_PRESSED : styles.pressed),
              ]}
            >
              <Text style={[styles.callPhoneGlyph, isVibesPro && styles.vibesProText, { color: colors.text }]}>☎</Text>
              <Animated.Text
                style={[
                  styles.callArrow,
                  isVibesPro && styles.vibesProText,
                  { color: colors.text },
                  { opacity: callArrowOpacity },
                ]}
              >
                →
              </Animated.Text>
              <Animated.Text
                style={[
                  styles.callMobileGlyph,
                  isVibesPro && styles.vibesProText,
                  { color: colors.text },
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
              style={({ pressed }) => [
                styles.bottomBarAction,
                styles.bottomBarRight,
                pressed && (isLiquidGlass ? NATIVE_LIQUID_GLASS_PRESSED : styles.pressed),
              ]}
            >
              <Text style={[styles.navigationText, isVibesPro && styles.vibesProText, { color: colors.text }]}>Archived</Text>
            </Pressable>
          </NativeGlassSurface>
        </Animated.View>
      </SafeAreaView>
      <Modal animationType="fade" onRequestClose={() => setSelectedThread(null)} transparent visible={Boolean(selectedThread)}>
        <NativeBlurBackdrop intensity={18} overlayColor="rgba(0,0,0,0.35)" />
        <Pressable accessibilityRole="button" onPress={() => setSelectedThread(null)} style={styles.actionBackdrop}>
          <Pressable onPress={(event) => event.stopPropagation()} style={[styles.actionMenuCard, isVibesPro && styles.premiumActionMenu, isBlueSky && styles.blueSkyActionMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.actionTitleRow}>
              <View style={styles.actionHeadingCopy}>
                <Text style={[styles.actionTitle, isBlueSky && styles.blueSkyActionText, { color: colors.text }]}>Conversation actions</Text>
                <Text style={[styles.actionSubtitle, isBlueSky && styles.blueSkyActionSubtitle, { color: colors.muted }]}>@{selectedThread?.otherUsername}</Text>
              </View>
              <Pressable accessibilityLabel="Close conversation actions" accessibilityRole="button" disabled={actionBusy} onPress={() => setSelectedThread(null)} style={styles.actionClose}>
                <X color={colors.text} size={20} />
              </Pressable>
            </View>
            <View style={styles.actionGrid}>
              <Pressable accessibilityRole="button" disabled={actionBusy} onPress={() => void updateConversationAction("pinnedIds", !selectedIsPinned)} style={({ pressed }) => [styles.actionButton, isVibesPro && styles.premiumActionButton, isBlueSky && styles.blueSkyActionButton, { backgroundColor: colors.raised, borderColor: colors.border }, pressed && (isLiquidGlass ? NATIVE_LIQUID_GLASS_PRESSED : styles.actionPressed)]}>
                <Pin color={actionIconColor} size={22} />
                <Text style={[styles.actionButtonText, isVibesPro && styles.premiumActionText, isBlueSky && styles.blueSkyActionText]}>{selectedIsPinned ? "Unpin" : "Pin"}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={actionBusy} onPress={() => void updateConversationAction("unreadIds", !selectedIsUnread)} style={({ pressed }) => [styles.actionButton, isVibesPro && styles.premiumActionButton, isBlueSky && styles.blueSkyActionButton, { backgroundColor: colors.raised, borderColor: colors.border }, pressed && (isLiquidGlass ? NATIVE_LIQUID_GLASS_PRESSED : styles.actionPressed)]}>
                <Mail color={actionIconColor} size={22} />
                <Text style={[styles.actionButtonText, isVibesPro && styles.premiumActionText, isBlueSky && styles.blueSkyActionText]}>{selectedIsUnread ? "Mark read" : "Mark as unread"}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={actionBusy} onPress={confirmDeleteThread} style={({ pressed }) => [styles.actionButton, styles.dangerActionButton, pressed && (isLiquidGlass ? NATIVE_LIQUID_GLASS_PRESSED : styles.actionPressed)]}>
                <Trash2 color="#ffffff" size={22} />
                <Text style={[styles.actionButtonText, styles.dangerText]}>Delete</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={actionBusy} onPress={() => void updateConversationAction("archivedIds", !selectedIsArchived)} style={({ pressed }) => [styles.actionButton, isVibesPro && styles.premiumActionButton, isBlueSky && styles.blueSkyActionButton, { backgroundColor: colors.raised, borderColor: colors.border }, pressed && (isLiquidGlass ? NATIVE_LIQUID_GLASS_PRESSED : styles.actionPressed)]}>
                <Archive color={actionIconColor} size={22} />
                <Text style={[styles.actionButtonText, isVibesPro && styles.premiumActionText, isBlueSky && styles.blueSkyActionText]}>{selectedIsArchived ? "Unarchive" : "Archive"}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={actionBusy} onPress={confirmBlockThread} style={({ pressed }) => [styles.actionButton, styles.dangerActionButton, pressed && (isLiquidGlass ? NATIVE_LIQUID_GLASS_PRESSED : styles.actionPressed)]}>
                <Ban color="#ffffff" size={22} />
                <Text style={[styles.actionButtonText, styles.dangerText]}>Block</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <NativeConfirmDialog
        confirmLabel={threadConfirmation?.type === "delete" ? "Delete" : "Block"}
        destructive
        emoji={threadConfirmation?.type === "delete" ? "🗑️" : "🚫"}
        message={threadConfirmation?.type === "delete"
          ? "This removes the conversation from your list on this device."
          : `They will no longer be able to contact you. Block @${threadConfirmation?.thread.otherUsername ?? "this user"}?`}
        onCancel={() => setThreadConfirmation(null)}
        onConfirm={async () => {
          if (!userId || !threadConfirmation) throw new Error("This action is no longer available.");
          const { thread, type } = threadConfirmation;
          if (type === "block") await blockNativeUser(thread.otherId);
          const next = await setNativeConversationAction(userId, "deletedIds", thread.conversationId, true);
          queryClient.setQueryData(actionsQueryKey, next);
        }}
        title={threadConfirmation?.type === "delete" ? "Delete conversation?" : `Block @${threadConfirmation?.thread.otherUsername ?? "user"}?`}
        visible={threadConfirmation !== null}
      />
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
  title: { ...NATIVE_TYPE_SCALE.screenTitle, color: "#ffffff" },
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
  wizrdAnimationLayer: { position: "absolute", right: 0, width: 100, height: 150, zIndex: 1 },
  wizrdSmoke: { position: "absolute", width: 88, height: 110 },
  wizrdSmokeLeft: { left: -7, bottom: -12 },
  wizrdSmokeCenter: { left: 6, bottom: -18 },
  wizrdSmokeRight: { left: 19, bottom: -14 },
  wizrdLauncher: { position: "absolute", right: 18, width: 64, height: 64, borderRadius: 32, zIndex: 2, elevation: 10, shadowColor: "#4f46e5", shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  wizrdLauncherImage: { width: 64, height: 64, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.8)", borderRadius: 32 },
  wizrdLauncherPressed: { opacity: 0.82, transform: [{ scale: 0.97 }] },
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
  dangerActionButton: { borderColor: "#f87171", backgroundColor: "#dc2626" },
  dangerText: { color: "#ffffff" },
  actionPressed: { opacity: 0.78 },
});
