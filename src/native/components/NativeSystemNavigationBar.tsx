import { NavigationBar } from "expo-navigation-bar";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname } from "expo-router";
import { NATIVE_THEME_COLORS, useNativeTheme } from "../contexts/NativeThemeProvider";

const DARK_SURFACE_PATHS = new Set([
  "/calls",
  "/clips",
  "/flicks",
  "/games",
  "/messages",
  "/messages/archived",
  "/messages/spam",
  "/profile/followers",
  "/settings",
  "/settings/blocked-users",
  "/tracks",
]);

export default function NativeSystemNavigationBar() {
  const { bottom } = useSafeAreaInsets();
  const pathname = usePathname();
  const { theme, isVibesPro } = useNativeTheme();
  const isDarkSurface = DARK_SURFACE_PATHS.has(pathname) || pathname.startsWith("/messages/");
  const isLightSurface = !isVibesPro && !isDarkSurface;
  const isBlueSky = !isLightSurface && theme === "bluesky";
  const backgroundColor = isLightSurface
    ? "#ffffff"
    : isBlueSky
      ? NATIVE_THEME_COLORS.bluesky.background[0]
      : NATIVE_THEME_COLORS.dark.background[0];

  if (Platform.OS !== "android") return null;

  return (
    <>
      <NavigationBar style={isLightSurface ? "dark" : "light"} />
      <View
        pointerEvents="none"
        style={[styles.background, { backgroundColor, height: bottom }]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  background: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1000,
    elevation: 1000,
  },
});