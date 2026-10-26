import { useCallback, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { PhoneCall, Video } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatDisplayDateTime } from "../../lib/time";
import { useNativeAuth } from "../contexts/NativeAuthProvider";
import { useNativeCalls } from "../contexts/NativeCallContext";
import { NATIVE_THEME_COLORS, useNativeTheme } from "../contexts/NativeThemeProvider";
import {
  fetchNativeCallHistoryPage,
  fetchNativeCallParticipantNames,
  type CallHistoryStatus,
  type NativeCallHistoryCursor,
} from "../lib/calls";
import { resolveNativeConversation } from "../lib/chat";
import { nativeCallHistoryQueryKey, nativeCallParticipantProfilesQueryKey } from "../lib/queryKeys";
import NativeSkeleton from "./NativeSkeleton";
import { NativeCallHistoryRowsSkeleton } from "./NativeScreenSkeletons";

type CallTarget = { id: string; username: string };

function statusLabel(status: CallHistoryStatus) {
  switch (status) {
    case "completed": return "Completed";
    case "missed": return "Missed";
    case "declined": return "Declined";
    case "failed": return "Failed";
    case "connected": return "Connected";
    case "ringing": return "Ringing";
  }
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return "";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function NativeCallHistoryScreen() {
  const router = useRouter();
  const { session } = useNativeAuth();
  const { startCall } = useNativeCalls();
  const { theme } = useNativeTheme();
  const isBlueSky = theme === "bluesky";
  const userId = session?.user.id;
  const [pendingTarget, setPendingTarget] = useState<CallTarget | null>(null);
  const callsQuery = useInfiniteQuery({
    queryKey: nativeCallHistoryQueryKey(userId ?? ""),
    queryFn: ({ pageParam }) => fetchNativeCallHistoryPage(userId!, pageParam),
    enabled: Boolean(userId),
    initialPageParam: undefined as NativeCallHistoryCursor | undefined,
    getNextPageParam: (lastPage) => {
      const oldestRecord = lastPage.records.at(-1);
      return lastPage.hasMore && oldestRecord
        ? { createdAt: oldestRecord.created_at, id: oldestRecord.id }
        : undefined;
    },
    staleTime: 15_000,
  });
  const calls = callsQuery.data?.pages.flatMap((page) => page.records) ?? [];
  const participantIds = useMemo(
    () => [...new Set(calls.map((call) =>
      call.caller_id === userId ? call.recipient_id : call.caller_id
    ))].sort(),
    [calls, userId],
  );
  const participantProfilesQuery = useQuery({
    queryKey: nativeCallParticipantProfilesQueryKey(userId ?? "", participantIds),
    queryFn: () => fetchNativeCallParticipantNames(participantIds),
    enabled: Boolean(userId && participantIds.length),
    staleTime: 5 * 60_000,
  });
  const usernames = participantProfilesQuery.data ?? {};
  const loading = callsQuery.isPending;
  const refreshing = callsQuery.isRefetching || participantProfilesQuery.isRefetching;
  const error = callsQuery.error?.message ?? participantProfilesQuery.error?.message ?? null;

  const loadCalls = useCallback(async () => {
    await Promise.all([callsQuery.refetch(), participantProfilesQuery.refetch()]);
  }, [callsQuery.refetch, participantProfilesQuery.refetch]);

  const redial = async (callType: "audio" | "video") => {
    if (!pendingTarget) return;
    if (Constants.appOwnership === "expo") {
      setPendingTarget(null);
      Alert.alert(
        "Development build required",
        "Audio and video calls need the MeToYou development build. Expo Go does not include the native WebRTC module.",
      );
      return;
    }
    const target = pendingTarget;
    setPendingTarget(null);
    try {
      const conversation = await resolveNativeConversation(target.id);
      await startCall({
        conversationId: conversation.id,
        recipientId: target.id,
        recipientName: target.username,
        callType,
      });
    } catch (cause) {
      Alert.alert(
        "Call could not start",
        cause instanceof Error ? cause.message : "Check your connection and try again.",
      );
    }
  };

  return (
    <LinearGradient colors={NATIVE_THEME_COLORS[theme].background} style={styles.root}>
      <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
        <View style={[styles.header, isBlueSky && styles.blueSkyHeader]}>
          <Pressable
            accessibilityLabel="Back to messages"
            accessibilityRole="button"
            onPress={() => router.replace("/(app)/(tabs)/messages")}
            style={[styles.backButton, isBlueSky && styles.blueSkyControl]}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>CONNECTIONS</Text>
            <Text style={styles.title}>Call history</Text>
            <Text style={styles.subtitle}>Your recent calls</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <NativeCallHistoryRowsSkeleton count={5} />
        ) : error && calls.length === 0 ? (
          <View style={styles.stateCard}>
            <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => void loadCalls()} style={styles.retryButton}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : calls.length === 0 ? (
          <View style={styles.stateCard}>
            <PhoneCall color="#ffffff" size={36} />
            <Text style={styles.emptyTitle}>No calls yet</Text>
            <Text style={styles.stateText}>Completed and missed calls will appear here.</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                colors={["#ffffff"]}
                onRefresh={() => void loadCalls()}
                refreshing={refreshing}
                tintColor="#ffffff"
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {error ? (
              <View style={styles.stateCard}>
                <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
                <Pressable onPress={() => void loadCalls()} style={styles.retryButton}>
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              </View>
            ) : null}
            {calls.map((call) => {
              const otherId = call.caller_id === userId ? call.recipient_id : call.caller_id;
              const isOutgoing = call.caller_id === userId;
              const username = usernames[otherId];
              return (
                <Pressable
                  accessibilityLabel={`Call ${username}, ${isOutgoing ? "outgoing" : "incoming"}, ${statusLabel(call.status)}`}
                  accessibilityRole="button"
                  key={call.id}
                  onPress={() => setPendingTarget({ id: otherId, username })}
                  style={({ pressed }) => [styles.callCard, isBlueSky && styles.blueSkyCard, pressed && styles.pressed]}
                >
                  <View style={[styles.callIcon, isBlueSky && styles.blueSkyControl]}>
                    {call.call_type === "video"
                      ? <Video color="#ffffff" size={20} />
                      : <PhoneCall color="#ffffff" size={20} />}
                  </View>
                  <View style={styles.callCopy}>
                    {participantProfilesQuery.isPending && !participantProfilesQuery.data ? (
                      <NativeSkeleton style={styles.usernameSkeleton} />
                    ) : (
                      <Text numberOfLines={1} style={styles.username}>{username ?? "MeToYou user"}</Text>
                    )}
                    <Text numberOfLines={1} style={styles.callMeta}>
                      {isOutgoing ? "Outgoing" : "Incoming"} · {statusLabel(call.status)}
                    </Text>
                  </View>
                  <View style={styles.callTime}>
                    <Text numberOfLines={1} style={styles.timestamp}>{formatDisplayDateTime(call.created_at)}</Text>
                    {call.duration_seconds !== null
                      ? <Text style={styles.duration}>{formatDuration(call.duration_seconds)}</Text>
                      : null}
                  </View>
                </Pressable>
              );
            })}
            {callsQuery.hasNextPage ? (
              <Pressable
                accessibilityRole="button"
                disabled={callsQuery.isFetchingNextPage}
                onPress={() => void callsQuery.fetchNextPage()}
                style={styles.retryButton}
              >
                {callsQuery.isFetchingNextPage
                  ? <ActivityIndicator color="#ffffff" />
                  : <Text style={styles.retryText}>Load older calls</Text>}
              </Pressable>
            ) : null}
          </ScrollView>
        )}

        <Modal animationType="fade" onRequestClose={() => setPendingTarget(null)} transparent visible={Boolean(pendingTarget)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, isBlueSky && styles.blueSkyModal]}>
              <Text style={styles.modalOverline}>CALL AGAIN</Text>
              <Text style={styles.modalTitle}>Choose a call type</Text>
              <Text style={styles.modalSubtitle}>{pendingTarget?.username}</Text>
              <Pressable onPress={() => void redial("audio")} style={[styles.primaryModalButton, isBlueSky && styles.blueSkyControl]}>
                <PhoneCall color="#ffffff" size={19} />
                <Text style={styles.primaryModalText}>Start audio call</Text>
              </Pressable>
              <Pressable onPress={() => void redial("video")} style={[styles.secondaryModalButton, isBlueSky && styles.blueSkyCard]}>
                <Video color="#ffffff" size={19} />
                <Text style={styles.secondaryModalText}>Start video call</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setPendingTarget(null)} style={styles.cancelButton}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },
  header: { minHeight: 68, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: "#252a33", backgroundColor: "rgba(5,7,11,0.92)" },
  blueSkyHeader: { borderBottomColor: "#3478bd", backgroundColor: "rgba(6,26,58,0.94)" },
  backButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#353b46", borderRadius: 15, backgroundColor: "#151a22" },
  blueSkyControl: { borderColor: "#3478bd", backgroundColor: "#155192" },
  backText: { color: "#ffffff", fontSize: 34, lineHeight: 38 },
  eyebrow: { color: "#ffffff", fontSize: 9, fontWeight: "800", letterSpacing: 2 },
  headerCopy: { flex: 1 },
  title: { color: "#ffffff", fontSize: 19, fontWeight: "900" },
  subtitle: { color: "#ffffff", fontSize: 12, marginTop: 2 },
  headerSpacer: { width: 42 },
  list: { gap: 12, padding: 14, paddingTop: 16, paddingBottom: 30 },
  callCard: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: "#2e3540", borderRadius: 20, backgroundColor: "#171c25" },
  blueSkyCard: { borderColor: "#3478bd", backgroundColor: "#0b2d5b" },
  pressed: { opacity: 0.7, backgroundColor: "#252b35" },
  callIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#252b35" },
  callCopy: { flex: 1, minWidth: 0 },
  username: { color: "#ffffff", fontSize: 14, fontWeight: "800" },
  usernameSkeleton: { width: "60%", height: 14 },
  callMeta: { color: "#ffffff", fontSize: 11, marginTop: 3 },
  callTime: { alignItems: "flex-end", maxWidth: "40%" },
  timestamp: { color: "#ffffff", fontSize: 10 },
  duration: { color: "#ffffff", fontSize: 11, marginTop: 4 },
  stateCard: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 28 },
  stateText: { color: "#ffffff", fontSize: 13, textAlign: "center" },
  errorText: { color: "#fda4af", fontSize: 14, textAlign: "center" },
  retryButton: { alignSelf: "center", marginTop: 9, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: "#303743" },
  retryText: { color: "#ffffff", fontSize: 14, fontWeight: "800" },
  emptyTitle: { color: "#ffffff", fontSize: 17, fontWeight: "800" },
  modalBackdrop: { flex: 1, justifyContent: "center", padding: 22, backgroundColor: "rgba(0,0,0,0.78)" },
  modalCard: { width: "100%", maxWidth: 420, alignSelf: "center", gap: 12, padding: 20, borderWidth: 1, borderColor: "#353b46", borderRadius: 27, backgroundColor: "#10141b" },
  blueSkyModal: { borderColor: "#3478bd", backgroundColor: "#0b2d5b" },
  modalOverline: { color: "#ffffff", fontSize: 9, fontWeight: "900", letterSpacing: 2 },
  modalTitle: { marginTop: 4, color: "#ffffff", fontSize: 22, fontWeight: "900", textAlign: "center" },
  modalSubtitle: { color: "#ffffff", fontSize: 13, textAlign: "center", marginBottom: 4 },
  primaryModalButton: { minHeight: 47, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderWidth: 1, borderColor: "#555d69", borderRadius: 15, backgroundColor: "#303743" },
  primaryModalText: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
  secondaryModalButton: { minHeight: 47, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderWidth: 1, borderColor: "#555d69", borderRadius: 15, backgroundColor: "#303743" },
  secondaryModalText: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
  cancelButton: { minHeight: 46, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#454b55", borderRadius: 15, backgroundColor: "#171c25" },
  cancelText: { color: "#ffffff", fontWeight: "800" },
});
