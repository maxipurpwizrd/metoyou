import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useNativeTheme } from "../contexts/NativeThemeProvider";

export default function NativeSkeleton({ style }: { style: StyleProp<ViewStyle> }) {
  const { theme, isVibesPro } = useNativeTheme();
  const backgroundColor = theme === "bluesky"
    ? "#1c4b80"
    : isVibesPro
      ? "#242424"
      : "#d6eaf4";

  return <View style={[styles.block, { backgroundColor }, style]} />;
}

const styles = StyleSheet.create({
  block: {
    overflow: "hidden",
    borderRadius: 10,
  },
});
