import { useContext, type ReactNode } from "react";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { NativeBlurTargetContext } from "./NativeBlurBackdrop";

export const NATIVE_LIQUID_GLASS_PRESSED = {
  opacity: 0.94,
  transform: [{ scale: 0.97 }],
  backgroundColor: "rgba(238,242,244,0.13)",
  borderColor: "rgba(245,248,249,0.55)",
} as const;

export const NATIVE_LIQUID_GLASS_POPUP_SURFACE = {
  backgroundColor: "rgba(30,32,34,0.74)",
  borderColor: "rgba(235,240,242,0.58)",
} as const;

type Props = {
  children: ReactNode;
  enabled: boolean;
  blurEnabled?: boolean;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  overlayColor?: string;
  gradientColors?: readonly [string, string, ...string[]];
};

export default function NativeGlassSurface({
  children,
  enabled,
  blurEnabled = Platform.OS !== "android",
  style,
  intensity = 48,
  overlayColor = "rgba(235,240,242,0.08)",
  gradientColors,
}: Props) {
  const blurTarget = useContext(NativeBlurTargetContext);
  const blurMethod = Platform.OS === "android" && blurTarget
    ? "dimezisBlurViewSdk31Plus"
    : "none";

  return (
    <View
      style={[
        style,
        (enabled || gradientColors) && styles.clippedSurface,
        enabled && styles.liquidGlassSurface,
      ]}
    >
      {enabled ? (
        <>
          {blurEnabled ? (
            <BlurView
              blurTarget={blurTarget ?? undefined}
              blurMethod={blurMethod}
              intensity={intensity}
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
              tint={Platform.OS === "ios" ? "systemUltraThinMaterialDark" : "dark"}
            />
          ) : null}
          {gradientColors ? (
            <LinearGradient
              colors={gradientColors}
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor }]} />
          )}
          <LinearGradient
            colors={[
              "rgba(255,255,255,0.11)",
              "rgba(235,240,242,0.018)",
              "rgba(255,255,255,0.055)",
            ]}
            end={{ x: 1, y: 1 }}
            pointerEvents="none"
            start={{ x: 0, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={styles.glassGlimmerBand} />
          <View pointerEvents="none" style={[styles.glint, styles.glintTopRight]} />
          <View pointerEvents="none" style={[styles.glint, styles.glintLowerLeft]} />
        </>
      ) : gradientColors ? (
        <LinearGradient
          colors={gradientColors}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  clippedSurface: {
    overflow: "hidden",
  },
  liquidGlassSurface: {
    shadowColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  glassGlimmerBand: {
    position: "absolute",
    top: 0,
    left: 18,
    right: 18,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.42)",
  },
  glint: {
    position: "absolute",
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.8)",
    shadowColor: "#ffffff",
    shadowOpacity: 0.45,
    shadowRadius: 5,
    elevation: 1,
  },
  glintTopRight: { top: 10, right: 14 },
  glintLowerLeft: { bottom: 12, left: 16, opacity: 0.52, width: 2, height: 2 },
});
