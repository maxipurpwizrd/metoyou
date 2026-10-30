import { createContext, useContext, type ComponentRef, type RefObject } from "react";
import { BlurView } from "expo-blur";
import { StyleSheet, View } from "react-native";

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

  return (
    <>
      <BlurView
        blurTarget={blurTarget ?? undefined}
        blurMethod="dimezisBlurView"
        intensity={intensity}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        tint="dark"
      />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor }]}
      />
    </>
  );
}
