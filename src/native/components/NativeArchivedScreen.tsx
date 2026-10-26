import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Archive, ArrowLeft } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatDisplayDate } from "../../lib/time";
import { useNativeAuth } from "../contexts/NativeAuthProvider";
import { useNativeTheme, NATIVE_THEME_COLORS } from "../contexts/NativeThemeProvider";
import { clearNativeConversationActions, fetchNativeConversationActions, setNativeConversationAction } from "../lib/conversationActions";
import { fetchNativeMessageThreads } from "../lib/messages";
import { nativeConversationActionsQueryKey, nativeMessageThreadsQueryKey } from "../lib/queryKeys";
import { NativeConversationRowsSkeleton } from "./NativeScreenSkeletons";

export default function NativeArchivedScreen() {
  const router = useRouter();
  const { session } = useNativeAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const { theme } = useNativeTheme();
  const isBlueSky = theme === "bluesky";
  const colors = NATIVE_THEME_COLORS[theme];
  const threadsQuery = useQuery({
    queryKey: nativeMessageThreadsQueryKey(userId ?? ""),
    queryFn: () => fetchNativeMessageThreads(userId!),
    enabled: Boolean(userId),
    staleTime: 20_000,
  });
  const actionsKey = nativeConversationActionsQueryKey(userId ?? "");
  const actionsQuery = useQuery({
    queryKey: actionsKey,
    queryFn: () => fetchNativeConversationActions(userId!),
    enabled: Boolean(userId),
  });
  const archivedIds = actionsQuery.data?.archivedIds ?? [];
  const archivedThreads = (threadsQuery.data ?? []).filter((thread) =>
    archivedIds.includes(thread.conversationId) && !actionsQuery.data?.deletedIds.includes(thread.conversationId),
  );
  const initialLoading = (threadsQuery.isPending && !threadsQuery.data) ||
    (actionsQuery.isPending && !actionsQuery.data);
  const initialError = (threadsQuery.isError && !threadsQuery.data) ||
    (actionsQuery.isError && !actionsQuery.data);

  const openThread = async (thread: (typeof archivedThreads)[number]) => {
    if (userId) {
      try {
        const next = await clearNativeConversationActions(userId, thread.conversationId);
        queryClient.setQueryData(actionsKey, next);
      } catch (cause) {
        Alert.alert("Could not mark conversation as read", cause instanceof Error ? cause.message : "Please try again.");
      }
    }
    router.push({ pathname: "/messages/[recipientId]", params: { recipientId: thread.otherId } });
  };

  const unarchiveThread = async (conversationId: string) => {
    if (!userId) return;
    try {
      const next = await setNativeConversationAction(userId, "archivedIds", conversationId, false);
      queryClient.setQueryData(actionsKey, next);
    } catch (cause) {
      Alert.alert("Could not unarchive conversation", cause instanceof Error ? cause.message : "Please try again.");
    }
  };

  return (
    <LinearGradient colors={colors.background} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} style={styles.root}>
      <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
          <Pressable
            accessibilityLabel="Back to messages"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={[styles.backButton, { borderColor: colors.border, backgroundColor: colors.raised }]}
          >
            <ArrowLeft color={colors.text} size={20} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>Archived</Text>
        </View>

        <View style={[styles.info, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Archive color={colors.accent} size={19} />
          <Text style={[styles.infoText, { color: colors.muted }]}>
            Archived chats stay here when new messages arrive.
          </Text>
        </View>

        {initialLoading ? (
          <NativeConversationRowsSkeleton count={5} />
        ) : initialError ? (
          <View style={styles.emptyState}>
            <Text style={styles.errorText}>{threadsQuery.error?.message ?? actionsQuery.error?.message ?? "Archived chats could not be loaded."}</Text>
            <Pressable accessibilityRole="button" onPress={() => {
              void threadsQuery.refetch();
              void actionsQuery.refetch();
            }} style={styles.retryButton}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : archivedThreads.length ? (
          <ScrollView contentContainerStyle={styles.list}>
            {threadsQuery.isError || actionsQuery.isError ? (
              <Text style={styles.errorText}>{threadsQuery.error?.message ?? actionsQuery.error?.message}</Text>
            ) : null}
            {archivedThreads.map((thread) => (
              <View key={thread.conversationId} style={[styles.threadRow, { borderColor: colors.border, backgroundColor: colors.raised }]}>
                <Pressable accessibilityRole="button" onPress={() => void openThread(thread)} style={styles.threadOpen}>
                  <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.control }]}>
                    <Text style={styles.avatarText}>{thread.otherUsername.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View style={styles.threadCopy}>
                    <Text numberOfLines={1} style={styles.threadName}>{thread.otherUsername}</Text>
                    <Text numberOfLines={1} style={[styles.preview, { color: colors.muted }]}>{thread.lastText || "No messages"}</Text>
                  </View>
                  {thread.lastTime ? <Text style={[styles.time, { color: colors.muted }]}>{formatDisplayDate(thread.lastTime)}</Text> : null}
                </Pressable>
                <Pressable
                  accessibilityLabel={`Unarchive conversation with ${thread.otherUsername}`}
                  accessibilityRole="button"
                  onPress={() => void unarchiveThread(thread.conversationId)}
                  style={styles.unarchiveButton}
                >
                  <Archive color={colors.accent} size={18} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyState}>
            {threadsQuery.isError || actionsQuery.isError ? (
              <Text style={styles.errorText}>{threadsQuery.error?.message ?? actionsQuery.error?.message}</Text>
            ) : null}
            <View style={[styles.iconFrame, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Archive color={isBlueSky ? "#54b8ff" : "#fbbf24"} size={30} strokeWidth={1.8} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No archived chats</Text>
            <Text style={[styles.emptyCopy, { color: colors.muted }]}>Chats you archive will appear here.</Text>
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },
  header: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, borderBottomWidth: 1 },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 13 },
  title: { fontSize: 18, fontWeight: "900" },
  info: { flexDirection: "row", alignItems: "center", gap: 11, marginHorizontal: 14, marginTop: 14, padding: 13, borderWidth: 1, borderRadius: 13 },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18 },
  list: { padding: 14, gap: 8 },
  threadRow: { minHeight: 68, flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 15 },
  threadOpen: { flex: 1, minWidth: 0, minHeight: 68, flexDirection: "row", alignItems: "center", gap: 11, paddingLeft: 10 },
  avatar: { width: 44, height: 44, borderRadius: 15 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#ffffff", fontSize: 17, fontWeight: "900" },
  threadCopy: { flex: 1, minWidth: 0 },
  threadName: { color: "#ffffff", fontSize: 14, fontWeight: "800" },
  preview: { marginTop: 4, fontSize: 12 },
  time: { marginHorizontal: 8, fontSize: 10 },
  unarchiveButton: { width: 44, minHeight: 66, alignItems: "center", justifyContent: "center" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingBottom: 50 },
  iconFrame: { width: 72, height: 72, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 24 },
  emptyTitle: { marginTop: 20, fontSize: 17, fontWeight: "900" },
  emptyCopy: { marginTop: 7, fontSize: 13, lineHeight: 19, textAlign: "center" },
  errorText: { color: "#fda4af", fontSize: 13, textAlign: "center" },
  retryButton: { alignSelf: "center", marginTop: 12, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 11, backgroundColor: "#303743" },
  retryText: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
});