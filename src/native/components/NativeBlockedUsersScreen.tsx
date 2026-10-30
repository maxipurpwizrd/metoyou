import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { nativeSupabase } from "../lib/supabase";
import { useNativeAuth } from "../contexts/NativeAuthProvider";
import { NATIVE_THEME_COLORS, useNativeTheme } from "../contexts/NativeThemeProvider";
import { NativePeopleRowsSkeleton } from "./NativeScreenSkeletons";

type BlockedUser = { id: string; username: string; profile_pic: string | null };

export default function NativeBlockedUsersScreen() {
  const router = useRouter();
  const { session } = useNativeAuth();
  const { theme } = useNativeTheme();
  const isBlueSky = theme === "bluesky";
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await nativeSupabase.rpc("get_my_blocked_users");
      if (queryError) throw queryError;
      setUsers((data ?? []).map((user: { id: string; username: string | null; profile_pic: string | null }) => ({
        id: user.id,
        username: user.username ?? `User ${user.id.slice(0, 8)}`,
        profile_pic: user.profile_pic ?? null,
      })));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load blocked accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const unblock = async (userId: string) => {
    if (!session?.user.id || busyUserId) return;
    setBusyUserId(userId);
    try {
      const { error: queryError } = await nativeSupabase
        .from("user_blocks")
        .delete()
        .eq("blocker_user_id", session.user.id)
        .eq("blocked_user_id", userId);
      if (queryError) throw queryError;
      setUsers((current) => current.filter((user) => user.id !== userId));
    } catch (cause) {
      Alert.alert("Could not unblock account", cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <LinearGradient colors={NATIVE_THEME_COLORS[theme].background} style={styles.root}>
      <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
        <View style={[styles.header, isBlueSky && styles.blueSkyHeader]}>
          <Pressable
            accessibilityLabel="Go back"
            onPress={() => router.replace("/(app)/settings")}
            style={[styles.backButton, isBlueSky && styles.blueSkyControl]}
          >
            <Text style={[styles.backText, isBlueSky && styles.blueSkyText]}>‹</Text>
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.overline, isBlueSky && styles.blueSkyMuted]}>PRIVACY</Text>
            <Text style={[styles.title, isBlueSky && styles.blueSkyText]}>Blocked users</Text>
          </View>
          <View style={styles.spacer} />
        </View>
        {loading && users.length === 0 ? (
          <NativePeopleRowsSkeleton blocked count={5} />
        ) : error && users.length === 0 ? (
          <View style={styles.center}>
            <Text style={[styles.errorText, isBlueSky && styles.blueSkyText]}>{error}</Text>
            <Pressable onPress={() => void loadUsers()} style={styles.retryButton}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : users.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyIcon}>⊘</Text>
            <Text style={[styles.emptyTitle, isBlueSky && styles.blueSkyText]}>No blocked users</Text>
            <Text style={[styles.emptyText, isBlueSky && styles.blueSkyMuted]}>Accounts you block will appear here.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {error ? (
              <Pressable accessibilityRole="button" onPress={() => void loadUsers()}>
                <Text style={[styles.errorText, isBlueSky && styles.blueSkyText]}>{error} · Tap to retry</Text>
              </Pressable>
            ) : null}
            {users.map((user) => (
              <View key={user.id} style={[styles.userRow, isBlueSky && styles.blueSkyCard]}>
                {user.profile_pic ? (
                  <Image source={{ uri: user.profile_pic }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={[styles.avatarText, isBlueSky && styles.blueSkyText]}>{user.username.slice(0, 1).toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.userDetails}>
                  <Text numberOfLines={1} style={[styles.username, isBlueSky && styles.blueSkyText]}>{user.username}</Text>
                  <Text style={[styles.blockedHint, isBlueSky && styles.blueSkyMuted]}>Blocked account</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  disabled={busyUserId !== null}
                  onPress={() => void unblock(user.id)}
                  style={[styles.unblockButton, busyUserId !== null && styles.disabled]}
                >
                  {busyUserId === user.id
                    ? <ActivityIndicator color="#0369a1" size="small" />
                    : <Text style={styles.unblockText}>Unblock</Text>}
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  blueSkyHeader: { borderBottomColor: "#3478bd", backgroundColor: "rgba(6,26,58,0.94)" },
  blueSkyControl: { borderColor: "#3478bd", backgroundColor: "#155192" },
  blueSkyCard: { borderColor: "#3478bd", backgroundColor: "#0b2d5b" },
  blueSkyText: { color: "#ffffff" },
  blueSkyMuted: { color: "rgba(255,255,255,0.78)" },
  safeArea: { flex: 1 },
  header: { minHeight: 68, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: "rgba(186,230,253,0.62)" },
  backButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "rgba(255,255,255,0.74)" },
  backText: { color: "#0369a1", fontSize: 34, lineHeight: 38 },
  headerCopy: { flex: 1, alignItems: "center" },
  overline: { color: "#64748b", fontSize: 9, fontWeight: "800", letterSpacing: 2 },
  title: { color: "#082f49", fontSize: 18, fontWeight: "900" },
  spacer: { width: 42 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 9, padding: 24 },
  errorText: { color: "#be123c", fontSize: 14, textAlign: "center" },
  retryButton: { marginTop: 5, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 14, backgroundColor: "#0284c7" },
  retryText: { color: "#ffffff", fontWeight: "800" },
  emptyIcon: { color: "#0284c7", fontSize: 38 },
  emptyTitle: { color: "#0c4a6e", fontSize: 17, fontWeight: "900" },
  emptyText: { color: "#64748b", fontSize: 13 },
  content: { gap: 10, padding: 14 },
  userRow: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 11, padding: 11, borderWidth: 1, borderColor: "rgba(255,255,255,0.84)", borderRadius: 21, backgroundColor: "rgba(255,255,255,0.77)" },
  avatar: { width: 44, height: 44, borderRadius: 24 },
  avatarFallback: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 24, backgroundColor: "#bae6fd" },
  avatarText: { color: "#0369a1", fontSize: 18, fontWeight: "900" },
  userDetails: { flex: 1, gap: 3 },
  username: { color: "#0f172a", fontSize: 14, fontWeight: "800" },
  blockedHint: { color: "#64748b", fontSize: 11 },
  unblockButton: { minWidth: 76, minHeight: 38, alignItems: "center", justifyContent: "center", paddingHorizontal: 11, borderWidth: 1, borderColor: "#bae6fd", borderRadius: 13, backgroundColor: "#f0f9ff" },
  unblockText: { color: "#0369a1", fontSize: 12, fontWeight: "800" },
  disabled: { opacity: 0.6 },
});
