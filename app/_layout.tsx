import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NativeAuthProvider } from "../src/native/contexts/NativeAuthProvider";
import { NativeThemeProvider } from "../src/native/contexts/NativeThemeProvider";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <NativeAuthProvider>
        <NativeThemeProvider>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }} />
        </NativeThemeProvider>
      </NativeAuthProvider>
    </SafeAreaProvider>
  );
}