import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect, Stack } from "expo-router";
import { useNativeAuth } from "../../src/native/contexts/NativeAuthProvider";
import { NativeCallProvider } from "../../src/native/contexts/NativeCallProvider";
import { NativePresenceProvider } from "../../src/native/contexts/NativePresenceProvider";

export default function AuthenticatedLayout() {
  const { session, loading } = useNativeAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#0284c7" />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;
  return (
    <NativePresenceProvider>
      <NativeCallProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </NativeCallProvider>
    </NativePresenceProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e8f8ff",
  },
});