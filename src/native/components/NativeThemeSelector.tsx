import { useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  NATIVE_THEME_COLORS,
  NATIVE_THEME_OPTIONS,
  NATIVE_TYPE_SCALE,
  useNativeTheme,
} from "../contexts/NativeThemeProvider";
import NativeGlassSurface, { NATIVE_LIQUID_GLASS_PRESSED } from "./NativeGlassSurface";
import { NATIVE_LIQUID_GLASS_POPUP_SURFACE } from "./NativeGlassSurface";

export default function NativeThemeSelector() {
  const { theme, setTheme, isVibesPro } = useNativeTheme();
  const colors = NATIVE_THEME_COLORS[theme];
  const isLiquidGlass = theme === "liquidGlass";
  const [visible, setVisible] = useState(false);

  const chooseTheme = async (value: (typeof NATIVE_THEME_OPTIONS)[number]["value"]) => {
    try {
      await setTheme(value);
      setVisible(false);
    } catch (cause) {
      Alert.alert(
        "Theme could not be saved",
        cause instanceof Error ? cause.message : "Please try again.",
      );
    }
  };

  return (
    <>
      <Pressable
        accessibilityLabel="Choose app theme"
        accessibilityRole="button"
        onPress={() => setVisible(true)}
        style={({ pressed }) => [
          styles.trigger,
          { borderColor: colors.border, backgroundColor: colors.surface },
          pressed && (isLiquidGlass ? NATIVE_LIQUID_GLASS_PRESSED : styles.pressed),
        ]}
      >
        <Text style={styles.triggerIcon}>🎨</Text>
      </Pressable>
      <Modal animationType="fade" onRequestClose={() => setVisible(false)} transparent visible={visible}>
        <View style={[styles.backdrop, isLiquidGlass && styles.liquidGlassBackdrop]}>
          <Pressable accessibilityLabel="Close theme chooser" onPress={() => setVisible(false)} style={StyleSheet.absoluteFill} />
          <NativeGlassSurface enabled={isLiquidGlass} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, isLiquidGlass && NATIVE_LIQUID_GLASS_POPUP_SURFACE]}>
            <Text style={[styles.title, { color: colors.text }]}>App theme</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              {isVibesPro ? "Choose a look for the whole app" : "Choose an app theme"}
            </Text>
            {NATIVE_THEME_OPTIONS.filter((option) => isVibesPro || option.value === "dark").map((option) => (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: theme === option.value }}
                onPress={() => void chooseTheme(option.value)}
                style={({ pressed }) => [
                  styles.option,
                  {
                    borderColor: theme === option.value ? colors.accent : colors.border,
                    backgroundColor: theme === option.value ? colors.control : colors.raised,
                  },
                  pressed && (isLiquidGlass ? NATIVE_LIQUID_GLASS_PRESSED : styles.pressed),
                ]}
              >
                <LinearGradient colors={option.swatch} style={styles.swatch} />
                <Text style={[styles.optionText, { color: colors.text }]}>{option.label}</Text>
                {theme === option.value ? <Text style={[styles.check, { color: colors.accent }]}>✓</Text> : null}
              </Pressable>
            ))}
          </NativeGlassSurface>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 14 },
  triggerIcon: { fontSize: 20 },
  backdrop: { flex: 1, justifyContent: "center", padding: 22, backgroundColor: "rgba(2,6,23,0.64)" },
  liquidGlassBackdrop: { backgroundColor: "rgba(18,20,22,0.42)" },
  card: { width: "100%", maxWidth: 380, maxHeight: "90%", alignSelf: "center", padding: 16, borderWidth: 1, borderRadius: 24 },
  title: { ...NATIVE_TYPE_SCALE.screenTitle },
  subtitle: { ...NATIVE_TYPE_SCALE.caption, marginTop: 4, marginBottom: 12 },
  option: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 11, marginTop: 6, paddingHorizontal: 10, borderWidth: 1, borderRadius: 14 },
  swatch: { width: 26, height: 26, borderWidth: 1, borderColor: "rgba(255,255,255,0.48)", borderRadius: 13 },
  optionText: { ...NATIVE_TYPE_SCALE.body, flex: 1, fontWeight: "700" },
  check: { fontSize: 16, fontWeight: "900" },
  pressed: { opacity: 0.78 },
});
