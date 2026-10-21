import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Home, Image, Music2, Video } from "lucide-react-native";
import { NATIVE_THEME_COLORS, useNativeTheme } from "../contexts/NativeThemeProvider";

const DOCK_HIDE_DELAY_MS = 6000;
const SCROLL_PAUSE_DELAY_MS = 180;

export function useNativeSurfaceDockVisibility() {
  const [visible, setVisible] = useState(true);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (showTimer.current) clearTimeout(showTimer.current);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    showTimer.current = null;
    hideTimer.current = null;
  }, []);

  const onScroll = useCallback(() => {
    clearTimers();
    setVisible(false);
    showTimer.current = setTimeout(() => {
      setVisible(true);
      hideTimer.current = setTimeout(() => {
        setVisible(false);
        hideTimer.current = null;
      }, DOCK_HIDE_DELAY_MS);
      showTimer.current = null;
    }, SCROLL_PAUSE_DELAY_MS);
  }, [clearTimers]);

  useEffect(() => {
    hideTimer.current = setTimeout(() => {
      setVisible(false);
      hideTimer.current = null;
    }, DOCK_HIDE_DELAY_MS);
    return clearTimers;
  }, [clearTimers]);

  return { visible, onScroll };
}

const SURFACES = [
  { key: "feed", label: "Tweets / Feed", Icon: Home },
  { key: "flicks", label: "Flicks", Icon: Image },
  { key: "clips", label: "Clips", Icon: Video },
  { key: "tracks", label: "Tracks", Icon: Music2 },
] as const;

export default function NativeSurfaceDock({
  visible,
  onFeedPress,
  onFlicksPress,
  onClipsPress,
  onTracksPress,
  activeSurface = "feed",
}: {
  visible: boolean;
  onFeedPress: () => void;
  onFlicksPress?: () => void;
  onClipsPress?: () => void;
  onTracksPress?: () => void;
  activeSurface?: "feed" | "flicks" | "clips" | "tracks";
}) {
  const router = useRouter();
  const { theme } = useNativeTheme();
  const colors = NATIVE_THEME_COLORS[theme];
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(visible ? 0 : 26)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: visible ? 0 : 26,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, visible]);

  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={[styles.position, { opacity, transform: [{ translateY }] }]}
    >
      <View style={[styles.dock, { backgroundColor: theme === "bluesky" ? colors.control : "rgba(2,6,23,0.83)", borderColor: theme === "bluesky" ? colors.accent : "rgba(255,255,255,0.35)" }]}>
        {SURFACES.map((surface) => {
          const Icon = surface.Icon;
          const active = surface.key === activeSurface;
          return (
            <Pressable
              key={surface.key}
              accessibilityLabel={surface.label}
              accessibilityRole="button"
              onPress={() => {
                if (active) {
                  if (surface.key === "feed") onFeedPress();
                  else if (surface.key === "flicks") onFlicksPress?.();
                  else if (surface.key === "clips") onClipsPress?.();
                  else onTracksPress?.();
                  return;
                }
                if (surface.key === "feed") {
                  onFeedPress();
                  return;
                }
                if (surface.key === "clips") {
                  if (onClipsPress) onClipsPress();
                  else router.push("/(app)/clips");
                  return;
                }
                if (surface.key === "flicks") {
                  if (onFlicksPress) onFlicksPress();
                  else router.push("/(app)/flicks");
                  return;
                }
                if (surface.key === "tracks") {
                  if (onTracksPress) onTracksPress();
                  else router.push("/(app)/tracks");
                  return;
                }
              }}
              style={({ pressed }) => [
                styles.item,
                active && [styles.activeItem, { backgroundColor: theme === "bluesky" ? "#54b8ff" : "#ffffff" }],
                pressed && styles.pressed,
              ]}
            >
              <Icon color={active ? (theme === "bluesky" ? colors.text : "#0f172a") : colors.muted} size={20} strokeWidth={2} />
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  position: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 12,
    alignItems: "center",
  },
  dock: {
    maxWidth: "92%",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    padding: 7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    borderRadius: 999,
    backgroundColor: "rgba(2,6,23,0.83)",
    shadowColor: "#020617",
    shadowOpacity: 0.26,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  item: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
  },
  activeItem: { backgroundColor: "#ffffff" },
  pressed: { opacity: 0.76 },
});
