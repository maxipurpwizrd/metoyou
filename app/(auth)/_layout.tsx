import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect, Stack } from "expo-router";
import { useNativeAuth } from "../../src/native/contexts/NativeAuthProvider";

export default function AuthLayout() {
  const { session, loading } = useNativeAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#0284c7" />
      </View>
    );
  }

  if (session) return <Redirect href="/(app)" />;
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