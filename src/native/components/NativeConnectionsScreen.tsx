import { useState } from "react";
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNativeTheme, NATIVE_THEME_COLORS } from "../contexts/NativeThemeProvider";
import { fetchNativeConnections, type NativeConnectionTab } from "../lib/profile";
import { nativeProfileConnectionsQueryKey } from "../lib/queryKeys";
import { NativePeopleRowsSkeleton } from "./NativeScreenSkeletons";

const CONNECTION_TABS: Array<{ id: NativeConnectionTab; label: string }> = [
  { id: "friends", label: "Friends" },
  { id: "following", label: "Following" },
  { id: "followers", label: "Followers" },
];

const EMPTY_COPY: Record<NativeConnectionTab, string> = {
  friends: "No mutual friends yet.",
  following: "Not following anyone yet.",
  followers: "No followers yet.",
};

export default function NativeConnectionsScreen() {
  const params = useLocalSearchParams<{ profileId?: string | string[]; username?: string | string[] }>();
  const profileId = Array.isArray(params.profileId) ? params.profileId[0] : params.profileId;
  const username = Array.isArray(params.username) ? params.username[0] : params.username;
  const [tab, setTab] = useState<NativeConnectionTab>("followers");
  const router = useRouter();
  const { theme } = useNativeTheme();
  const isBlueSky = theme === "bluesky";
  const query = useQuery({
    queryKey: nativeProfileConnectionsQueryKey(profileId ?? "", tab),
    queryFn: () => fetchNativeConnections(profileId!, tab),
    enabled: Boolean(profileId),
    staleTime: 30_000,
  });
  const connections = query.data ?? [];
  const backgroundColors = NATIVE_THEME_COLORS[theme].background;

  return (
    <LinearGradient colors={backgroundColors} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} style={styles.root}>
      <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
        <View style={[styles.header, isBlueSky && styles.blueSkyHeader]}>
          <Pressable accessibilityLabel="Back to profile" accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Followers</Text>
            {username ? <Text numberOfLines={1} style={styles.subtitle}>@{username}</Text> : null}
          </View>
        </View>

        <View style={[styles.tabs, isBlueSky && styles.blueSkyTabs]}>
          {CONNECTION_TABS.map((item) => {
            const active = tab === item.id;
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                key={item.id}
                onPress={() => setTab(item.id)}
                style={[styles.tab, active && styles.activeTab, isBlueSky && active && styles.blueSkyActiveTab]}
              >
                <Text style={[styles.tabText, active && styles.activeTabText]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {query.isError && !query.data ? (
          <View style={styles.state}>
            <Text accessibilityRole="alert" style={styles.errorText}>{query.error.message}</Text>
            <Pressable accessibilityRole="button" onPress={() => void query.refetch()} style={styles.retryButton}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : query.isPending && !query.data ? (
          <NativePeopleRowsSkeleton count={5} />
        ) : (
          <ScrollView
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                onRefresh={() => void query.refetch()}
                refreshing={query.isRefetching}
                tintColor="#ffffff"
              />
            }
          >
            {query.isError ? <Text accessibilityRole="alert" style={styles.errorText}>{query.error.message}</Text> : null}
            {connections.length ? connections.map((connection) => (
              <Pressable
                accessibilityLabel={`Open @${connection.username}'s profile`}
                accessibilityRole="button"
                key={connection.id}
                onPress={() => router.push({
                  pathname: "/profile/[username]",
                  params: { username: connection.username },
                })}
                style={({ pressed }) => [styles.connectionRow, isBlueSky && styles.blueSkyRow, pressed && styles.pressed]}
              >
                {connection.profile_pic ? (
                  <Image source={{ uri: connection.profile_pic }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback, isBlueSky && styles.blueSkyAvatar]}>
                    <Text style={styles.avatarInitial}>{connection.username.slice(0, 1).toUpperCase()}</Text>
                  </View>
                )}
                <Text numberOfLines={1} style={styles.username}>@{connection.username}</Text>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            )) : (
              <View style={styles.state}>
                <Text style={styles.emptyTitle}>{EMPTY_COPY[tab]}</Text>
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },
  header: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#29313d", backgroundColor: "rgba(13,18,27,0.88)" },
  blueSkyHeader: { borderBottomColor: "#3478bd", backgroundColor: "rgba(6,26,58,0.94)" },
  backButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#353b46", borderRadius: 14, backgroundColor: "#151a22" },
  backText: { color: "#ffffff", fontSize: 32, lineHeight: 36 },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { color: "#ffffff", fontSize: 18, fontWeight: "900" },
  subtitle: { marginTop: 2, color: "rgba(255,255,255,0.62)", fontSize: 12 },
  tabs: { flexDirection: "row", gap: 4, marginHorizontal: 14, marginTop: 14, padding: 4, borderWidth: 1, borderColor: "#29313d", borderRadius: 14, backgroundColor: "#10141b" },
  blueSkyTabs: { borderColor: "#3478bd", backgroundColor: "#0b2d5b" },
  tab: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", paddingHorizontal: 5, borderRadius: 10 },
  activeTab: { backgroundColor: "#0284c7" },
  blueSkyActiveTab: { backgroundColor: "#155192" },
  tabText: { color: "rgba(255,255,255,0.68)", fontSize: 12, fontWeight: "800" },
  activeTabText: { color: "#ffffff" },
  list: { flexGrow: 1, padding: 14, gap: 8 },
  connectionRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: "#2e3540", borderRadius: 14, backgroundColor: "#171c25" },
  blueSkyRow: { borderColor: "#3478bd", backgroundColor: "#0b2d5b" },
  pressed: { opacity: 0.72 },
  avatar: { width: 44, height: 44, borderRadius: 15 },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#155e75" },
  blueSkyAvatar: { backgroundColor: "#155192" },
  avatarInitial: { color: "#ffffff", fontSize: 17, fontWeight: "900" },
  username: { flex: 1, color: "#ffffff", fontSize: 14, fontWeight: "800" },
  chevron: { color: "rgba(255,255,255,0.6)", fontSize: 24 },
  state: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emptyTitle: { color: "rgba(255,255,255,0.72)", fontSize: 14, textAlign: "center" },
  errorText: { color: "#fda4af", fontSize: 13, textAlign: "center" },
  retryButton: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 11, backgroundColor: "#303743" },
  retryText: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
});