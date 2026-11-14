import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { NATIVE_THEME_COLORS, useNativeTheme } from "../contexts/NativeThemeProvider";

export default function NativeSkeleton({ style }: { style: StyleProp<ViewStyle> }) {
  const { theme } = useNativeTheme();
  const colors = NATIVE_THEME_COLORS[theme];

  return <View style={[styles.block, { backgroundColor: colors.control }, style]} />;
}

const styles = StyleSheet.create({
  block: {
    overflow: "hidden",
    borderRadius: 10,
  },
});
