import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { useNativeAuth } from "../src/native/contexts/NativeAuthProvider";

export default function IndexRoute() {
  const { session, loading } = useNativeAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#0284c7" />
      </View>
    );
  }

  return <Redirect href={session ? "/(app)/(tabs)" : "/(auth)/login"} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: "#e8f8ff",
    alignItems: "center",
    justifyContent: "center",
  },
});