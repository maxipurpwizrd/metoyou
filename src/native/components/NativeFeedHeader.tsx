import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { UserRound } from "lucide-react-native";
import { useNativeTheme } from "../contexts/NativeThemeProvider";

const VIBES_PRO_BRAND_COLORS = ["#7C5CFF", "#00D4FF", "#D4AF37", "#FF5CC8"];

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
}: {
  onFeedPress: () => void;
  isVibesPro?: boolean;
}) {
  const router = useRouter();
  const { theme } = useNativeTheme();
  const isBlueSky = theme === "bluesky";

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
        active && (isBlueSky ? styles.blueSkyNavButtonActive : isVibesPro ? styles.vibesProNavButtonActive : styles.navButtonActive),
        pressed && styles.pressed,
      ]}
    >
      {icon === null ? (
        <UserRound
          color={isBlueSky ? "#ffffff" : isVibesPro ? "rgba(255,255,255,0.75)" : "#0f172a"}
          size={21}
          strokeWidth={2.5}
        />
      ) : (
        <Text style={[styles.navIcon, (isVibesPro || isBlueSky) && styles.vibesProNavIcon]}>{icon}</Text>
      )}
    </Pressable>
  );

  return (
    <>
      <LinearGradient
        colors={isBlueSky ? ["#061a3a", "#0b3b78", "#125baa"] : isVibesPro ? ["#0B0B0B", "#101016", "#0B0B0B"] : ["#e0f2fe", "#ffffff", "#cffafe"]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={[styles.header, isVibesPro && !isBlueSky && styles.vibesProHeader, isBlueSky && styles.blueSkyHeader]}
      >
        {isVibesPro ? (
          <VibesProBrand />
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
      </LinearGradient>

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
  vibesProLetter: { flex: 0, letterSpacing: -0.5 },
  navigation: { flexDirection: "row", alignItems: "center", gap: 1 },
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
  pressed: { opacity: 0.78 },
});
