import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  ActivityIndicator,
  Alert,
  AccessibilityInfo,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { MessageThread } from "../../types/message";
import { formatDisplayDate } from "../../lib/time";
import { useNativeAuth } from "../contexts/NativeAuthProvider";
import { NATIVE_THEME_COLORS, useNativeTheme } from "../contexts/NativeThemeProvider";
import { fetchNativeMessageThreads } from "../lib/messages";
import { fetchNativeVibesProStatus } from "../lib/profile";
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

export default function NativeMessagesScreen() {
  const router = useRouter();
  const { session } = useNativeAuth();
  const { theme } = useNativeTheme();
  const isBlueSky = theme === "bluesky";
  const userId = session?.user.id;
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [isVibesPro, setIsVibesPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [themeError, setThemeError] = useState<string | null>(null);
  const [bottomBarVisible, setBottomBarVisible] = useState(true);
  const bottomBarTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomBarOpacity = useRef(new Animated.Value(1)).current;
  const bottomBarOffset = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const callPhoneLift = useRef(new Animated.Value(2)).current;
  const callPhoneRotation = useRef(new Animated.Value(0)).current;
  const callArrowOpacity = useRef(new Animated.Value(0)).current;

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

  const loadThreads = useCallback(async (refresh = false) => {
    if (!userId) {
      setThreads([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setError(null);
    if (refresh) setRefreshing(true);
    try {
      if (!refresh) {
        try {
          const cached = await AsyncStorage.getItem(getThreadsCacheKey(userId));
          if (cached) {
            setThreads(sortThreads(parseCachedThreads(cached)));
            setLoading(false);
          }
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "Saved conversations could not be read.");
        }
      }
      const remote = sortThreads(await fetchNativeMessageThreads(userId));
      setThreads(remote);
      await AsyncStorage.setItem(getThreadsCacheKey(userId), JSON.stringify(remote));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Messages could not be loaded. Try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void fetchNativeVibesProStatus(userId)
      .then((status) => {
        if (active) setIsVibesPro(status);
      })
      .catch((cause: unknown) => {
        if (active) setThemeError(cause instanceof Error ? cause.message : "Account appearance could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const colors = NATIVE_THEME_COLORS[theme].background;

  return (
    <LinearGradient colors={colors} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} style={styles.root}>
      <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
        <View style={[styles.header, isVibesPro && styles.vibesProHeader, isBlueSky && styles.blueSkyHeader]}>
          <Pressable
            accessibilityLabel="Back to feed"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={[styles.backButton, isVibesPro && styles.vibesProBackButton]}
          >
            <Text style={[styles.backText, isVibesPro && styles.vibesProText]}>‹</Text>
          </Pressable>
          <Text style={[styles.title, isVibesPro && styles.vibesProText]}>Messages</Text>
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
              onRefresh={() => void loadThreads(true)}
              refreshing={refreshing}
              tintColor="#ffffff"
            />
          }
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={100}
        >
          {!isVibesPro ? (
            <View style={styles.intro}>
              <Text style={styles.brand}>MeToYou 💎✨</Text>
              <Text style={styles.subtitle}>Your conversations, all in one place.</Text>
              <View style={styles.badges}>
                <Text style={styles.badge}>MESSAGES</Text>
                <Text style={styles.badgeAlt}>YOUR PEOPLE</Text>
              </View>
            </View>
          ) : (
            <>
              <NativeStories isVibesPro messagesList />
              <View style={[styles.searchCard, styles.premiumCard]}>
                <Text style={styles.searchPlaceholder}>Search messages</Text>
              </View>
            </>
          )}

          {themeError ? <Text style={styles.themeWarning}>{themeError}</Text> : null}
          {error ? (
            <View style={[styles.stateCard, isVibesPro && styles.premiumCard]}>
              <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
              <Pressable accessibilityRole="button" onPress={() => void loadThreads()} style={styles.retryButton}>
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : null}
          {loading ? (
            <View style={[styles.stateCard, isVibesPro && styles.premiumCard]}>
              <ActivityIndicator color="#ffffff" />
              <Text style={[styles.stateText, isVibesPro && styles.premiumMuted]}>Loading messages…</Text>
            </View>
          ) : threads.length === 0 ? (
            <View style={[styles.stateCard, isVibesPro && styles.premiumCard]}>
              <Text style={[styles.emptyText, isVibesPro && styles.vibesProText]}>No messages yet.</Text>
            </View>
          ) : (
            <View style={styles.threadList}>
              {threads.map((thread) => (
                <Pressable
                  accessibilityLabel={`Conversation with ${thread.otherUsername}`}
                  accessibilityRole="button"
                  key={thread.conversationId}
                  onPress={() => router.push({
                    pathname: "/(app)/messages/[recipientId]",
                    params: { recipientId: thread.otherId },
                  })}
                  style={({ pressed }) => [styles.threadCard, isBlueSky && styles.blueSkyCard, pressed && styles.pressed]}
                >
                  <View style={[styles.avatar, isVibesPro && styles.premiumAvatar]}>
                    <Text style={styles.avatarText}>{thread.otherUsername.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View style={styles.threadCopy}>
                    <Text numberOfLines={1} style={[styles.username, isVibesPro && styles.vibesProText]}>
                      {thread.otherUsername}
                    </Text>
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
              accessibilityLabel="Spam messages"
              accessibilityRole="button"
              onPress={() => Alert.alert("Spam messages", "The Spam page is not part of this phase.")}
              onPressIn={revealBottomBar}
              style={({ pressed }) => [styles.bottomBarAction, styles.bottomBarLeft, pressed && styles.pressed]}
            >
              <Text style={[styles.navigationText, isVibesPro && styles.vibesProText]}>Spam</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Call history"
              accessibilityRole="button"
              onPress={() => router.push("../calls")}
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
              onPress={() => Alert.alert("Archived messages", "The Archive page is not part of this phase.")}
              onPressIn={revealBottomBar}
              style={({ pressed }) => [styles.bottomBarAction, styles.bottomBarRight, pressed && styles.pressed]}
            >
              <Text style={[styles.navigationText, isVibesPro && styles.vibesProText]}>Archived</Text>
            </Pressable>
          </View>
        </Animated.View>
      </SafeAreaView>
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
});
