import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NativeAuthProvider } from "../src/native/contexts/NativeAuthProvider";
import { NativeEntitlementProvider } from "../src/native/contexts/NativeEntitlementProvider";
import { NativeQueryProvider } from "../src/native/contexts/NativeQueryProvider";
import { NativeThemeProvider } from "../src/native/contexts/NativeThemeProvider";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <NativeAuthProvider>
        <NativeQueryProvider>
          <NativeEntitlementProvider>
            <NativeThemeProvider>
              <StatusBar style="auto" />
              <Stack screenOptions={{ headerShown: false }} />
            </NativeThemeProvider>
          </NativeEntitlementProvider>
        </NativeQueryProvider>
      </NativeAuthProvider>
    </SafeAreaProvider>
  );
}