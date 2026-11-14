import { createContext, useContext, type ComponentRef, type RefObject } from "react";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";
import { useNativeTheme } from "../contexts/NativeThemeProvider";

export type NativeBlurTargetRef = ComponentRef<typeof View>;

export const NativeBlurTargetContext = createContext<RefObject<NativeBlurTargetRef | null> | null>(null);

export default function NativeBlurBackdrop({
  intensity,
  overlayColor,
}: {
  intensity: number;
  overlayColor: string;
}) {
  const blurTarget = useContext(NativeBlurTargetContext);
  const { theme } = useNativeTheme();
  const blurMethod = Platform.OS === "android" && blurTarget
    ? "dimezisBlurViewSdk31Plus"
    : "none";
  const resolvedOverlayColor = overlayColor;

  return (
    <>
      <BlurView
        blurTarget={blurTarget ?? undefined}
        blurMethod={blurMethod}
        intensity={intensity}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        tint={Platform.OS === "ios" ? "systemUltraThinMaterialDark" : "dark"}
      />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: resolvedOverlayColor }]}
      />
    </>
  );
}
