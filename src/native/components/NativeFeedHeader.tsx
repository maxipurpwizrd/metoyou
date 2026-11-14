import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight, UserRound, X } from "lucide-react-native";
import { NATIVE_THEME_COLORS, useNativeTheme } from "../contexts/NativeThemeProvider";
import NativeGlassSurface, { NATIVE_LIQUID_GLASS_POPUP_SURFACE, NATIVE_LIQUID_GLASS_PRESSED } from "./NativeGlassSurface";
import type { NativePostcardTheme } from "./NativePostCard";

const VIBES_PRO_BRAND_COLORS = ["#7C5CFF", "#00D4FF", "#D4AF37", "#FF5CC8"];
export type NativeFeedStyle = "default" | "classic";

function getBrandColorStops(phase: number, colors: string[]) {
  const inputRange = [0];
  const outputRange = [colors[Math.floor(phase) % colors.length]];
  const finalBoundary = Math.floor(phase + colors.length);

  for (let boundary = Math.floor(phase) + 1; boundary <= finalBoundary; boundary += 1) {
    const progress = (boundary - phase) / colors.length;
    inputRange.push(progress);
    outputRange.push(colors[boundary % colors.length]);
  }

  return { inputRange, outputRange };
}

function VibesProBrand() {
  const progress = useRef(new Animated.Value(0)).current;
  const colors = VIBES_PRO_BRAND_COLORS;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 4800,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [progress]);

  return (
    <View accessibilityLabel="VibesPro" accessible style={styles.brandContainer}>
      {Array.from("VibesPro", (letter, index) => {
        const { inputRange, outputRange } = getBrandColorStops(
          (index / "VibesPro".length) * colors.length,
          colors,
        );
        const color = progress.interpolate({
          inputRange,
          outputRange,
          extrapolate: "clamp",
        });
        return (
          <Animated.Text
            key={`${letter}-${index}`}
            style={[
              styles.brand,
              styles.vibesProLetter,
              { color },
            ]}
          >
            {letter}
          </Animated.Text>
        );
      })}
    </View>
  );
}

export default function NativeFeedHeader({
  onFeedPress,
  isVibesPro = false,
  feedStyle = "default",
  onFeedStyleChange,
  photoMode = false,
  onPhotoModeChange,
  postcardTheme = null,
  onPostcardThemeChange,
}: {
  onFeedPress: () => void;
  isVibesPro?: boolean;
  feedStyle?: NativeFeedStyle;
  onFeedStyleChange?: (style: NativeFeedStyle) => Promise<void>;
  photoMode?: boolean;
  onPhotoModeChange?: (enabled: boolean) => Promise<void>;
  postcardTheme?: NativePostcardTheme | null;
  onPostcardThemeChange?: (theme: NativePostcardTheme | null) => Promise<void>;
}) {
  const router = useRouter();
  const { theme } = useNativeTheme();
  const colors = NATIVE_THEME_COLORS[theme];
  const isBlueSky = theme === "bluesky";
  const isLiquidGlass = theme === "liquidGlass";
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const [showFeedStyles, setShowFeedStyles] = useState(false);
  const [showPostcardStyles, setShowPostcardStyles] = useState(false);
  const [showPostcardThemes, setShowPostcardThemes] = useState(false);

  const closeStyleMenu = () => {
    setStyleMenuOpen(false);
    setShowFeedStyles(false);
    setShowPostcardStyles(false);
    setShowPostcardThemes(false);
  };

  const selectPhotoMode = async (enabled: boolean) => {
    if (!onPhotoModeChange) return;
    try {
      await onPhotoModeChange(enabled);
      closeStyleMenu();
    } catch (cause) {
      Alert.alert(
        "Could not save Feed style",
        cause instanceof Error ? cause.message : "Please try again.",
      );
    }
  };

  const selectFeedStyle = async (style: NativeFeedStyle) => {
    if (!onFeedStyleChange) return;
    try {
      await onFeedStyleChange(style);
      closeStyleMenu();
    } catch (cause) {
      Alert.alert(
        "Could not save Feed style",
        cause instanceof Error ? cause.message : "Please try again.",
      );
    }
  };

  const selectPostcardTheme = async (theme: NativePostcardTheme | null) => {
    if (!onPostcardThemeChange) return;
    try {
      await onPostcardThemeChange(theme);
      closeStyleMenu();
    } catch (cause) {
      Alert.alert(
        "Could not save Postcard theme",
        cause instanceof Error ? cause.message : "Please try again.",
      );
    }
  };

  const postcardThemeLabel = postcardTheme === null
    ? "Default"
    : ({
        bluesky: "BlueSky",
        white: "White",
        black: "Black",
        pink: "Pink",
        purple: "Purple",
        red: "Red",
        rainbow: "Rainbow",
        liquidGlass: "Liquid Glass",
      } satisfies Record<NativePostcardTheme, string>)[postcardTheme];

  const navButton = (
    label: string,
    icon: string | null,
    onPress: () => void,
    active = false,
  ) => (
    <Pressable
      key={label}
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.navButton,
        isLiquidGlass && {
          backgroundColor: "rgba(255,255,255,0.82)",
          borderWidth: 0,
        },
        active && (isLiquidGlass
          ? { backgroundColor: "rgba(255,255,255,0.96)" }
          : isBlueSky
            ? styles.blueSkyNavButtonActive
            : isVibesPro
              ? styles.vibesProNavButtonActive
              : styles.navButtonActive),
        pressed && (isLiquidGlass ? NATIVE_LIQUID_GLASS_PRESSED : styles.pressed),
      ]}
    >
      {icon === null ? (
        <UserRound
          color={isLiquidGlass ? "#202325" : colors.text}
          size={21}
          strokeWidth={2.5}
        />
      ) : (
        <Text style={[styles.navIcon, (isVibesPro || isBlueSky) && styles.vibesProNavIcon, { color: colors.text }]}>{icon}</Text>
      )}
    </Pressable>
  );

  return (
    <>
      <NativeGlassSurface
        enabled={isLiquidGlass}
        blurEnabled={Platform.OS !== "android"}
        gradientColors={isLiquidGlass
          ? undefined
          : isVibesPro && theme === "dark" ? ["#0B0B0B", "#101016", "#0B0B0B"] : colors.background}
        style={[
          styles.header,
          isVibesPro && theme === "dark" && styles.vibesProHeader,
          isBlueSky && styles.blueSkyHeader,
          theme !== "dark" && { borderBottomColor: colors.border },
          isLiquidGlass && { backgroundColor: "transparent" },
        ]}
        overlayColor="rgba(235,240,242,0.1)"
      >
        {isVibesPro ? (
          <Pressable
            accessibilityLabel="VibesPro Feed styles"
            accessibilityRole="button"
            onPress={() => setStyleMenuOpen(true)}
            style={({ pressed }) => [
              styles.brandButton,
              pressed && (isLiquidGlass ? NATIVE_LIQUID_GLASS_PRESSED : styles.pressed),
            ]}
          >
            <VibesProBrand />
          </Pressable>
        ) : (
          <Text numberOfLines={1} style={[styles.brand, isBlueSky && styles.blueSkyBrand]}>
            {isVibesPro ? "VibesPro" : "MeToYou"}
          </Text>
        )}
        <View style={styles.navigation}>
          {isVibesPro ? (
            <>
              {navButton("Home", "🏠", onFeedPress, true)}
              {navButton("Search", "🔍", () => router.push("/(app)/search"))}
              {navButton("Messages", "💬", () => router.navigate("/(app)/(tabs)/messages"))}
              {navButton("Notifications", "🔔", () => router.push("/(app)/notifications"))}
              {navButton("Profile", null, () => router.navigate("/(app)/(tabs)/profile"))}
            </>
          ) : (
            <>
              {navButton("Search", "🔍", () => router.push("/(app)/search"))}
              {navButton("Feed", "🏠", onFeedPress, true)}
              {navButton("Profile", null, () => router.navigate("/(app)/(tabs)/profile"))}
              {navButton("Messages", "💬", () => router.navigate("/(app)/(tabs)/messages"))}
              {navButton("Notifications", "🔔", () => router.push("/(app)/notifications"))}
            </>
          )}
        </View>
      </NativeGlassSurface>

      <Modal
        animationType="fade"
        onRequestClose={closeStyleMenu}
        transparent
        visible={styleMenuOpen}
      >
        <View style={[styles.menuBackdrop, isLiquidGlass && { backgroundColor: "rgba(18,20,22,0.42)" }]}>
          <Pressable accessibilityLabel="Close Feed style menu" onPress={closeStyleMenu} style={StyleSheet.absoluteFill} />
          <NativeGlassSurface
            enabled={isLiquidGlass}
            style={[styles.styleMenu, { backgroundColor: colors.surface, borderColor: colors.border }, isLiquidGlass && NATIVE_LIQUID_GLASS_POPUP_SURFACE]}
          >
            <View style={styles.menuHeader}>
              {showFeedStyles || showPostcardStyles || showPostcardThemes ? (
                <Pressable
                  accessibilityLabel="Back to Feed styles"
                  onPress={() => {
                    if (showPostcardThemes) setShowPostcardThemes(false);
                    else if (showPostcardStyles) setShowPostcardStyles(false);
                    else setShowFeedStyles(false);
                  }}
                  style={[styles.menuIconButton, isLiquidGlass && styles.liquidGlassMenuButton]}
                >
                  <ChevronLeft color={isLiquidGlass ? "#202325" : colors.accent} size={20} />
                </Pressable>
              ) : null}
              <Text style={styles.menuTitle}>
                {showPostcardThemes
                  ? "Postcard Theme"
                  : showPostcardStyles
                    ? "Postcard Style"
                    : showFeedStyles ? "Feed Style" : "VibesPro"}
              </Text>
              <Pressable
                accessibilityLabel="Close Feed style menu"
                onPress={closeStyleMenu}
                style={[styles.menuIconButton, isLiquidGlass && styles.liquidGlassMenuButton]}
              >
                <X color={isLiquidGlass ? "#202325" : colors.muted} size={19} />
              </Pressable>
            </View>
            {showPostcardThemes ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: postcardTheme === null }}
                  onPress={() => void selectPostcardTheme(null)}
                  style={({ pressed }) => [
                    styles.menuOption,
                    postcardTheme === null && styles.menuOptionSelected,
                    pressed && (isLiquidGlass ? NATIVE_LIQUID_GLASS_PRESSED : styles.pressed),
                    postcardTheme === null && { backgroundColor: colors.control },
                  ]}
                >
                  <Text style={[styles.menuOptionText, { color: colors.text }, postcardTheme === null && { color: colors.accent }]}>
                    Default
                  </Text>
                  {postcardTheme === null ? <Text style={[styles.menuCheck, { color: colors.accent }]}>✓</Text> : null}
                </Pressable>
                {([
                  ["bluesky", "BlueSky", "#125baa"],
                  ["white", "White", "#ffffff"],
                  ["black", "Black", "#171717"],
                  ["pink", "Pink", "#ec4899"],
                  ["purple", "Purple", "#7c3aed"],
                  ["red", "Red", "#dc2626"],
                  ["rainbow", "Rainbow", "#a855f7"],
                ] as const).map(([theme, label, swatch]) => (
                  <Pressable
                    key={theme}
                    accessibilityRole="button"
                    accessibilityState={{ selected: postcardTheme === theme }}
                    onPress={() => void selectPostcardTheme(theme)}
                    style={({ pressed }) => [
                      styles.menuOption,
                      postcardTheme === theme && (isLiquidGlass
                        ? { backgroundColor: colors.raised }
                        : styles.menuOptionSelected),
                      pressed && (isLiquidGlass ? NATIVE_LIQUID_GLASS_PRESSED : styles.pressed),
                    ]}
                  >
                    <View style={styles.themeOptionLabel}>
                      {theme === "rainbow" ? (
                        <LinearGradient
                          colors={["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7"]}
                          end={{ x: 1, y: 1 }}
                          start={{ x: 0, y: 0 }}
                          style={styles.themeSwatch}
                        />
                      ) : (
                        <View style={[styles.themeSwatch, { backgroundColor: swatch }]} />
                      )}
                      <Text style={[
                        styles.menuOptionText,
                        postcardTheme === theme && (isLiquidGlass
                          ? { color: colors.accent }
                          : styles.menuOptionSelectedText),
                      ]}>
                        {label}
                      </Text>
                    </View>
                    {postcardTheme === theme ? <Text style={styles.menuCheck}>✓</Text> : null}
                  </Pressable>
                ))}
              </>
            ) : showFeedStyles ? (
              <>
                {([
                  ["default", "Default"],
                  ["classic", "Classic"],
                ] as const).map(([style, label]) => (
                  <Pressable
                    key={style}
                    accessibilityRole="button"
                    accessibilityState={{ selected: feedStyle === style }}
                    onPress={() => void selectFeedStyle(style)}
                    style={({ pressed }) => [
                      styles.menuOption,
                      feedStyle === style && (isLiquidGlass ? { backgroundColor: colors.raised } : styles.menuOptionSelected),
                      pressed && (isLiquidGlass ? NATIVE_LIQUID_GLASS_PRESSED : styles.pressed),
                    ]}
                  >
                    <Text style={[
                      styles.menuOptionText,
                      { color: colors.text },
                      feedStyle === style && (isLiquidGlass ? { color: colors.accent } : styles.menuOptionSelectedText),
                    ]}>
                      {label}
                    </Text>
                    {feedStyle === style ? <Text style={[styles.menuCheck, isLiquidGlass && { color: colors.accent }]}>✓</Text> : null}
                  </Pressable>
                ))}
              </>
            ) : showPostcardStyles ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: !photoMode }}
                  onPress={() => void selectPhotoMode(false)}
                  style={({ pressed }) => [
                    styles.menuOption,
                    !photoMode && (isLiquidGlass ? { backgroundColor: colors.raised } : styles.menuOptionSelected),
                    pressed && (isLiquidGlass ? NATIVE_LIQUID_GLASS_PRESSED : styles.pressed),
                  ]}
                >
                  <Text style={[styles.menuOptionText, !photoMode && (isLiquidGlass ? { color: colors.accent } : styles.menuOptionSelectedText)]}>Default</Text>
                  {!photoMode ? <Text style={[styles.menuCheck, isLiquidGlass && { color: colors.accent }]}>✓</Text> : null}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: photoMode }}
                  onPress={() => void selectPhotoMode(true)}
                  style={({ pressed }) => [
                    styles.menuOption,
                    photoMode && (isLiquidGlass ? { backgroundColor: colors.raised } : styles.menuOptionSelected),
                    pressed && (isLiquidGlass ? NATIVE_LIQUID_GLASS_PRESSED : styles.pressed),
                  ]}
                >
                  <Text style={[styles.menuOptionText, photoMode && (isLiquidGlass ? { color: colors.accent } : styles.menuOptionSelectedText)]}>Photo Mode</Text>
                  {photoMode ? <Text style={[styles.menuCheck, isLiquidGlass && { color: colors.accent }]}>✓</Text> : null}
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowFeedStyles(true)}
                  style={({ pressed }) => [
                    styles.menuCategory,
                    pressed && (isLiquidGlass ? NATIVE_LIQUID_GLASS_PRESSED : styles.pressed),
                  ]}
                >
                  <View style={styles.menuCategoryText}>
                    <Text style={[styles.menuOptionText, { color: colors.text }]}>Feed Style</Text>
                    <Text style={[styles.menuCategoryValue, { color: colors.muted }]}>
                      {feedStyle === "classic" ? "Classic" : "Default"}
                    </Text>
                  </View>
                  <ChevronRight color={colors.accent} size={20} />
                </Pressable>
                {([
                  ["postcardStyle", "Postcard Style", photoMode ? "Photo Mode" : "Default"],
                  ["postcardTheme", "Postcard Theme", postcardThemeLabel],
                ] as const).map(([key, label, value]) => {
                  const disabled = feedStyle === "classic";
                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      accessibilityState={{ disabled }}
                      disabled={disabled}
                      onPress={() => {
                        if (key === "postcardStyle") setShowPostcardStyles(true);
                        else setShowPostcardThemes(true);
                      }}
                      style={({ pressed }) => [
                        styles.menuCategory,
                        disabled && styles.menuCategoryDisabled,
                        pressed && !disabled && (isLiquidGlass ? NATIVE_LIQUID_GLASS_PRESSED : styles.pressed),
                      ]}
                    >
                      <View style={styles.menuCategoryText}>
                        <Text style={[styles.menuOptionText, { color: disabled ? colors.muted : colors.text }]}>
                          {label}
                        </Text>
                        <Text style={[styles.menuCategoryValue, { color: colors.muted }]}>{value}</Text>
                      </View>
                      <ChevronRight color={colors.muted} size={20} />
                    </Pressable>
                  );
                })}
              </>
            )}
          </NativeGlassSurface>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(186,230,253,0.7)",
    backgroundColor: "#effaff",
  },
  vibesProHeader: {
    borderBottomColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#0B0B0B",
  },
  blueSkyHeader: { borderBottomColor: "#3478bd" },
  brand: {
    flex: 1,
    color: "#0284c7",
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  blueSkyBrand: { color: "#ffffff" },
  brandContainer: { flex: 1, flexDirection: "row", alignItems: "center" },
  brandButton: { flex: 1, minHeight: 44, justifyContent: "center" },
  vibesProLetter: { flex: 0, letterSpacing: -0.5 },
  navigation: { flexDirection: "row", alignItems: "center", gap: 6 },
  navButton: {
    width: 36,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  navButtonActive: { backgroundColor: "rgba(14,165,233,0.14)" },
  vibesProNavButtonActive: { backgroundColor: "rgba(124,92,255,0.2)" },
  blueSkyNavButtonActive: { backgroundColor: "rgba(84,184,255,0.32)" },
  navIcon: { color: "#0f172a", fontSize: 21, lineHeight: 27, textAlign: "center" },
  vibesProNavIcon: { color: "rgba(255,255,255,0.75)" },
  menuBackdrop: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "rgba(2,6,23,0.58)" },
  styleMenu: { width: "100%", maxWidth: 360, alignSelf: "center", padding: 14, borderWidth: 1, borderColor: "rgba(212,175,55,0.4)", borderRadius: 22, backgroundColor: "#111114" },
  menuHeader: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  menuTitle: { flex: 1, color: "#ffffff", fontSize: 17, fontWeight: "800" },
  menuIconButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: "#25252b" },
  liquidGlassMenuButton: { backgroundColor: "rgba(255,255,255,0.9)" },
  menuOption: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 13, borderRadius: 13 },
  menuCategory: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 13,
    borderRadius: 13,
  },
  menuCategoryText: { flex: 1, gap: 3 },
  menuCategoryValue: { fontSize: 12, fontWeight: "600" },
  menuCategoryDisabled: { opacity: 0.3 },
  menuOptionSelected: { backgroundColor: "rgba(212,175,55,0.16)" },
  menuOptionText: { color: "#e7e5e4", fontSize: 14, fontWeight: "700" },
  menuOptionSelectedText: { color: "#fcd34d" },
  menuCheck: { color: "#fcd34d", fontSize: 17, fontWeight: "900" },
  themeOptionLabel: { flexDirection: "row", alignItems: "center", gap: 10 },
  themeSwatch: { width: 20, height: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.5)", borderRadius: 10 },
  pressed: { opacity: 0.78 },
});
