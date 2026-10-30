import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { useNativeAuth } from "../src/native/contexts/NativeAuthProvider";

export default function IndexRoute() {
  const { status, loading } = useNativeAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#0284c7" />
      </View>
    );
  }

  return <Redirect href={status === "authenticated" || status === "offlineDeferred" ? "/(app)/(tabs)" : "/(auth)/login"} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: "#e8f8ff",
    alignItems: "center",
    justifyContent: "center",
  },
});