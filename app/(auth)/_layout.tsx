import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect, Stack } from "expo-router";
import { useNativeAuth } from "../../src/native/contexts/NativeAuthProvider";

export default function AuthLayout() {
  const { status, loading } = useNativeAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#0284c7" />
      </View>
    );
  }

  if (status === "authenticated" || status === "offlineDeferred") return <Redirect href="/(app)/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false, animation: "fade" }} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e8f8ff",
  },
});