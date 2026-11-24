import { useRef } from "react";
import { BlurTargetView } from "expo-blur";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import NativeBlurBackdrop, { NativeBlurTargetContext, type NativeBlurTargetRef } from "../src/native/components/NativeBlurBackdrop";
import { NativeAuthProvider } from "../src/native/contexts/NativeAuthProvider";
import { NativeEntitlementProvider } from "../src/native/contexts/NativeEntitlementProvider";
import { NativeMusicProvider } from "../src/native/contexts/NativeMusicProvider";
import { NativeQueryProvider } from "../src/native/contexts/NativeQueryProvider";
import { NativeThemeProvider } from "../src/native/contexts/NativeThemeProvider";
import { useNativeTheme } from "../src/native/contexts/NativeThemeProvider";
import NativeOfflinePrompt from "../src/native/components/NativeOfflinePrompt";
import NativeSystemNavigationBar from "../src/native/components/NativeSystemNavigationBar";
import NativeLiquidGlassTouchLayer from "../src/native/components/NativeLiquidGlassTouchLayer";

function NativeThemeWallpaper() {
  const { theme } = useNativeTheme();
  if (theme !== "liquidGlass") return null;

  return (
    <Image
      accessible={false}
      pointerEvents="none"
      resizeMode="cover"
      source={require("../src/assets/liquid-glass-wallpaper.jpg")}
      style={StyleSheet.absoluteFill}
    />
  );
}

function NativeStatusBar() {
  const { theme } = useNativeTheme();
  const style = theme === "white" || theme === "standard" ? "dark" : "light";
  return <StatusBar style={style} />;
}

export default function RootLayout() {
  const blurTargetRef = useRef<NativeBlurTargetRef>(null);

  return (
    <SafeAreaProvider>
      <NativeAuthProvider>
        <NativeQueryProvider>
          <NativeMusicProvider>
            <NativeEntitlementProvider>
              <NativeThemeProvider>
                <NativeStatusBar />
                <NativeBlurTargetContext.Provider value={blurTargetRef}>
                  <BlurTargetView ref={blurTargetRef} style={{ flex: 1 }}>
                    <NativeLiquidGlassTouchLayer>
                      <NativeThemeWallpaper />
                      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }} />
                      <NativeSystemNavigationBar />
                    </NativeLiquidGlassTouchLayer>
                  </BlurTargetView>
                  <NativeOfflinePrompt />
                </NativeBlurTargetContext.Provider>
              </NativeThemeProvider>
            </NativeEntitlementProvider>
          </NativeMusicProvider>
        </NativeQueryProvider>
      </NativeAuthProvider>
    </SafeAreaProvider>
  );
}