import { useCallback, useEffect, useRef, useState } from "react";
import {
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useNativeEntitlement } from "../contexts/NativeEntitlementProvider";
import { NATIVE_THEME_COLORS, useNativeTheme } from "../contexts/NativeThemeProvider";
import { searchNativeUsersByUsername, type NativeSearchUser } from "../lib/search";
import { NativeSearchRowsSkeleton } from "./NativeScreenSkeletons";

export default function NativeSearchScreen() {
  const router = useRouter();
  const { entitlement, refresh: refreshEntitlement } = useNativeEntitlement();
  const { theme } = useNativeTheme();
  const isBlueSky = theme === "bluesky";
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<NativeSearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const requestId = useRef(0);
  const isVibesPro = entitlement.status === "vibesPro";

  const runSearch = useCallback(async (value: string, currentRequest: number) => {
    const normalizedQuery = value.trim();
    if (!normalizedQuery) {
      setUsers([]);
      setHasSearched(false);
      setSearchError(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    setSearchError(null);
    try {
      const results = await searchNativeUsersByUsername(normalizedQuery);
      if (requestId.current !== currentRequest) return;
      setUsers(results);
      setHasSearched(true);
    } catch (cause) {
      if (requestId.current !== currentRequest) return;
      setSearchError(cause instanceof Error ? cause.message : "Search failed. Please try again.");
      setHasSearched(true);
    } finally {
      if (requestId.current === currentRequest) setSearching(false);
    }
  }, []);

  useEffect(() => {
    const currentRequest = ++requestId.current;
    const timer = setTimeout(() => void runSearch(query, currentRequest), 300);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  const openProfile = (username: string) => {
    Keyboard.dismiss();
    router.push({
      pathname: "/(app)/profile/[username]",
      params: { username },
    });
  };

  return (
    <LinearGradient
      colors={isBlueSky ? NATIVE_THEME_COLORS.bluesky.background : isVibesPro ? NATIVE_THEME_COLORS.dark.background : ["#d9f3ff", "#eefaff", "#ffffff"]}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={styles.root}
    >
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <View style={[styles.header, isVibesPro && styles.vibesProHeader, isBlueSky && styles.blueSkyHeader]}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            onPress={() => router.canGoBack() ? router.back() : router.navigate("/(app)/(tabs)")}
            style={[styles.backButton, isVibesPro && styles.vibesProBackButton]}
          >
            <Text style={[styles.backText, isVibesPro && styles.vibesProText]}>‹</Text>
          </Pressable>
          <Text style={[styles.title, isVibesPro && styles.vibesProText, isBlueSky && styles.blueSkyText]}>Search</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {entitlement.status === "error" ? (
            <View style={[styles.messageCard, isVibesPro && styles.vibesProCard, isBlueSky && styles.blueSkyCard]}>
              <Text style={[styles.messageText, isBlueSky && styles.blueSkyText]}>
                VibesPro appearance could not be checked.
              </Text>
              <Pressable accessibilityRole="button" onPress={() => void refreshEntitlement()} style={styles.retryButton}>
                <Text style={styles.retryText}>Retry account status</Text>
              </Pressable>
            </View>
          ) : null}
          <TextInput
            accessibilityLabel="Search people by username"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            onSubmitEditing={() => {
              const currentRequest = ++requestId.current;
              void runSearch(query, currentRequest);
            }}
            placeholder="Search by username..."
            placeholderTextColor={isBlueSky || isVibesPro ? "rgba(255,255,255,0.6)" : "#64748b"}
            returnKeyType="search"
            style={[styles.searchInput, isVibesPro && styles.vibesProSearchInput, isBlueSky && styles.blueSkyInput]}
            value={query}
          />

          {!hasSearched ? (
            <View style={[styles.messageCard, isVibesPro && styles.vibesProCard, isBlueSky && styles.blueSkyCard]}>
              <Text style={[styles.messageText, isVibesPro && styles.vibesProMutedText, isBlueSky && styles.blueSkyMuted]}>
                Search for people by their username
              </Text>
            </View>
          ) : searchError && users.length === 0 ? (
            <View style={[styles.messageCard, isVibesPro && styles.vibesProCard, isBlueSky && styles.blueSkyCard]}>
              <Text accessibilityRole="alert" style={[styles.errorText, isBlueSky && styles.blueSkyText]}>{searchError}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  const currentRequest = ++requestId.current;
                  void runSearch(query, currentRequest);
                }}
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : searching && users.length === 0 ? (
            <NativeSearchRowsSkeleton count={4} />
          ) : users.length === 0 ? (
            <View style={[styles.messageCard, isVibesPro && styles.vibesProCard, isBlueSky && styles.blueSkyCard]}>
              <Text style={[styles.messageText, isVibesPro && styles.vibesProMutedText, isBlueSky && styles.blueSkyMuted]}>
                No people found
              </Text>
            </View>
          ) : (
            <View>
              <Text style={[styles.resultsTitle, isVibesPro && styles.vibesProText, isBlueSky && styles.blueSkyText]}>
                👥 {users.length} {users.length === 1 ? "person" : "people"}
                {searching ? " · Updating" : ""}
              </Text>
              {searchError ? <Text accessibilityRole="alert" style={styles.errorText}>{searchError}</Text> : null}
              <View style={styles.resultsList}>
                {users.map((user) => (
                  <Pressable
                    accessibilityLabel={`Open ${user.username}'s profile`}
                    accessibilityRole="button"
                    key={user.id}
                    onPress={() => openProfile(user.username)}
                    style={({ pressed }) => [
                      styles.userCard,
                      isVibesPro && styles.vibesProCard,
                      isBlueSky && styles.blueSkyCard,
                      pressed && styles.pressed,
                    ]}
                  >
                    {user.profile_pic ? (
                      <Image
                        source={{ uri: user.profile_pic }}
                        style={[styles.avatar, isVibesPro && styles.vibesProAvatar]}
                      />
                    ) : (
                      <LinearGradient
                        colors={isVibesPro ? ["#D4AF37", "#F0C75E"] : ["#38bdf8", "#06b6d4", "#2563eb"]}
                        style={styles.avatarFallback}
                      >
                        <Text style={styles.avatarInitial}>{user.username.slice(0, 1).toUpperCase()}</Text>
                      </LinearGradient>
                    )}
                    <View style={styles.userDetails}>
                      <Text numberOfLines={1} style={[styles.username, isVibesPro && styles.vibesProText, isBlueSky && styles.blueSkyText]}>
                        {user.username}
                      </Text>
                      <Text numberOfLines={1} style={[styles.handle, isVibesPro && styles.vibesProMutedText, isBlueSky && styles.blueSkyMuted]}>
                        @{user.username.toLowerCase()}
                      </Text>
                    </View>
                    <Text style={[styles.chevron, isVibesPro && styles.vibesProMutedText]}>›</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },
  statusScreen: { flex: 1, justifyContent: "center", backgroundColor: "#effaff" },
  blueSkyStatusScreen: { backgroundColor: "#061a3a" },
  vibesProStatusScreen: { backgroundColor: "#0B0B0B" },
  statusContent: { alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  statusText: { color: "#be123c", fontSize: 14, lineHeight: 20, textAlign: "center" },
  header: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(186,230,253,0.62)",
  },
  blueSkyHeader: { borderBottomColor: "#3478bd", backgroundColor: "rgba(6,26,58,0.94)" },
  blueSkyText: { color: "#ffffff" },
  blueSkyMuted: { color: "rgba(255,255,255,0.78)" },
  blueSkyCard: { borderColor: "#3478bd", backgroundColor: "#0b2d5b" },
  blueSkyInput: { borderColor: "#3478bd", backgroundColor: "#0b2d5b", color: "#ffffff" },
  vibesProHeader: { borderBottomColor: "rgba(255,255,255,0.08)" },
  backButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.74)",
  },
  vibesProBackButton: { backgroundColor: "#181818" },
  backText: { color: "#0369a1", fontSize: 34, lineHeight: 38 },
  title: { color: "#082f49", fontSize: 19, fontWeight: "900" },
  vibesProText: { color: "#ffffff" },
  headerSpacer: { width: 42 },
  content: { gap: 18, padding: 18, paddingBottom: 36 },
  searchInput: {
    minHeight: 54,
    paddingHorizontal: 17,
    borderWidth: 2,
    borderColor: "#7dd3fc",
    borderRadius: 24,
    color: "#0f172a",
    backgroundColor: "rgba(255,255,255,0.72)",
    fontSize: 15,
  },
  vibesProSearchInput: {
    borderColor: "rgba(212,175,55,0.4)",
    color: "#ffffff",
    backgroundColor: "#181818",
  },
  messageCard: {
    minHeight: 86,
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  vibesProCard: { borderColor: "rgba(212,175,55,0.2)", backgroundColor: "#181818" },
  messageText: { color: "#475569", fontSize: 14, textAlign: "center" },
  vibesProMutedText: { color: "rgba(255,255,255,0.7)" },
  loadingState: { alignItems: "center", gap: 10, padding: 24 },
  resultsTitle: { marginBottom: 13, color: "#0f172a", fontSize: 19, fontWeight: "900" },
  resultsList: { gap: 10 },
  userCard: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  avatar: { width: 44, height: 44, borderRadius: 20 },
  vibesProAvatar: { borderWidth: 2, borderColor: "rgba(212,175,55,0.3)" },
  avatarFallback: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  avatarInitial: { color: "#ffffff", fontSize: 15, fontWeight: "900" },
  userDetails: { flex: 1, minWidth: 0 },
  username: { color: "#0f172a", fontSize: 14, fontWeight: "800" },
  handle: { marginTop: 4, color: "#64748b", fontSize: 11 },
  chevron: { color: "#64748b", fontSize: 26, lineHeight: 30 },
  errorText: { color: "#be123c", fontSize: 14, textAlign: "center" },
  retryButton: { marginTop: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, backgroundColor: "#0284c7" },
  retryText: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
  pressed: { opacity: 0.76 },
});
