import { useRef } from "react";
import { BlurTargetView } from "expo-blur";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import NativeBlurBackdrop, { NativeBlurTargetContext, type NativeBlurTargetRef } from "../src/native/components/NativeBlurBackdrop";
import { NativeAuthProvider } from "../src/native/contexts/NativeAuthProvider";
import { NativeEntitlementProvider } from "../src/native/contexts/NativeEntitlementProvider";
import { NativeMusicProvider } from "../src/native/contexts/NativeMusicProvider";
import { NativeQueryProvider } from "../src/native/contexts/NativeQueryProvider";
import { NativeThemeProvider } from "../src/native/contexts/NativeThemeProvider";
import NativeOfflinePrompt from "../src/native/components/NativeOfflinePrompt";
import NativeSystemNavigationBar from "../src/native/components/NativeSystemNavigationBar";

export default function RootLayout() {
  const blurTargetRef = useRef<NativeBlurTargetRef>(null);

  return (
    <SafeAreaProvider>
      <NativeAuthProvider>
        <NativeQueryProvider>
          <NativeMusicProvider>
            <NativeEntitlementProvider>
              <NativeThemeProvider>
                <StatusBar style="auto" />
                <NativeBlurTargetContext.Provider value={blurTargetRef}>
                  <BlurTargetView ref={blurTargetRef} style={{ flex: 1 }}>
                    <Stack screenOptions={{ headerShown: false }} />
                    <NativeSystemNavigationBar />
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