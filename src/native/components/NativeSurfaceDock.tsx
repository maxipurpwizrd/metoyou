import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Animated, Pressable, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useRouter } from "expo-router";
import { Gamepad2, Home, Image, Music2, ShoppingBag, Video } from "lucide-react-native";
import { NATIVE_THEME_COLORS, useNativeTheme } from "../contexts/NativeThemeProvider";

export const NATIVE_SURFACE_DOCK_HEIGHT = 61;

export function useNativeSurfaceDockVisibility(enabled = false, bottomInset = 0) {
  const [visible, setVisible] = useState(true);
  const lastOffsetY = useRef(0);
  const translation = useRef(0);
  const scrollTranslation = useRef(new Animated.Value(0)).current;
  const hideDistance = NATIVE_SURFACE_DOCK_HEIGHT + bottomInset + 16;
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!enabled) return;
    const offsetY = Math.max(0, event.nativeEvent.contentOffset.y);
    const delta = offsetY - lastOffsetY.current;
    translation.current = offsetY <= 12
      ? 0
      : Math.max(0, Math.min(hideDistance, translation.current + delta));
    scrollTranslation.setValue(translation.current);
    setVisible(translation.current < hideDistance);
    lastOffsetY.current = offsetY;
  }, [enabled, hideDistance, scrollTranslation]);

  return { visible, onScroll, scrollTranslation };
}

const SURFACES = [
  { key: "feed", label: "Tweets / Feed", Icon: Home },
  { key: "flicks", label: "Flicks", Icon: Image },
  { key: "clips", label: "Clips", Icon: Video },
  { key: "tracks", label: "Tracks", Icon: Music2 },
  { key: "market", label: "Market, coming soon", Icon: ShoppingBag },
  { key: "gaming", label: "Gaming, coming soon", Icon: Gamepad2 },
] as const;

export default function NativeSurfaceDock({
  visible = true,
  onFeedPress,
  onFlicksPress,
  onClipsPress,
  onTracksPress,
  bottomInset = 0,
  activeSurface = "feed",
  scrollTranslation,
}: {
  visible?: boolean;
  bottomInset?: number;
  scrollTranslation?: Animated.Value;
  onFeedPress: () => void;
  onFlicksPress?: () => void;
  onClipsPress?: () => void;
  onTracksPress?: () => void;
  activeSurface?: "feed" | "flicks" | "clips" | "tracks";
}) {
  const router = useRouter();
  const { theme, isVibesPro } = useNativeTheme();
  const colors = NATIVE_THEME_COLORS[theme];
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (scrollTranslation) return;
    const animation = Animated.timing(translateY, {
      toValue: visible ? 0 : NATIVE_SURFACE_DOCK_HEIGHT + bottomInset + 16,
      duration: 220,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [bottomInset, scrollTranslation, translateY, visible]);

  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={[styles.position, { paddingBottom: 0, transform: [{ translateY: scrollTranslation ?? translateY }] }]}
    >
      <View style={[styles.dock, {
        backgroundColor: theme === "bluesky" ? colors.control : colors.surface,
        borderColor: colors.border,
        paddingBottom: Math.max(6, bottomInset + 4),
      }]}>
        {SURFACES.map((surface) => {
          const Icon = surface.Icon;
          const active = surface.key === activeSurface;
          return (
            <Pressable
              key={surface.key}
              accessibilityLabel={surface.label}
              accessibilityRole="button"
              onPress={() => {
                switch (surface.key) {
                  case "feed": onFeedPress(); break;
                  case "flicks":
                    if (onFlicksPress) onFlicksPress();
                    else router.navigate("/(app)/(tabs)/flicks");
                    break;
                  case "clips":
                    if (onClipsPress) onClipsPress();
                    else router.navigate("/(app)/(tabs)/clips");
                    break;
                  case "tracks":
                    if (onTracksPress) onTracksPress();
                    else router.navigate("/(app)/(tabs)/tracks");
                    break;
                  case "market": Alert.alert("Market", "Coming soon."); break;
                  case "gaming": Alert.alert("Gaming", "Coming soon."); break;
                }
              }}
              style={({ pressed }) => [
                styles.item,
                active && [styles.activeItem, { backgroundColor: theme === "bluesky" ? colors.accent : isVibesPro ? "#fbbf24" : "#ffffff" }],
                pressed && styles.pressed,
              ]}
            >
              <Icon color={active ? (theme === "bluesky" ? colors.text : isVibesPro ? "#451a03" : "#0f172a") : colors.muted} size={20} strokeWidth={2} />
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
    bottom: 0,
  },
  dock: {
    width: "100%",
    minHeight: NATIVE_SURFACE_DOCK_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 4,
    paddingTop: 6,
    borderTopWidth: 1,
  },
  item: {
    flex: 1,
    minWidth: 0,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  activeItem: { backgroundColor: "#ffffff" },
  pressed: { opacity: 0.76 },
});
