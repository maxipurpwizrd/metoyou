import { StyleSheet, View } from "react-native";
import { useNativeTheme } from "../contexts/NativeThemeProvider";
import NativeSkeleton from "./NativeSkeleton";

export function NativeFeedPostSkeleton({
  compact = false,
  showMedia = true,
}: {
  compact?: boolean;
  showMedia?: boolean;
}) {
  const { theme, isVibesPro } = useNativeTheme();
  const surface = theme === "bluesky" ? "#0b2d5b" : isVibesPro ? "#101010" : "rgba(255,255,255,0.72)";
  const border = theme === "bluesky" ? "#3478bd" : isVibesPro ? "#765c22" : "rgba(148,163,184,0.22)";

  return (
    <View style={[styles.post, compact && styles.compactPost, { backgroundColor: surface, borderColor: border }]}>
      <View style={styles.authorRow}>
        <NativeSkeleton style={styles.avatar} />
        <View style={styles.authorText}>
          <NativeSkeleton style={styles.name} />
          <NativeSkeleton style={styles.timestamp} />
        </View>
      </View>
      <View style={styles.captionLines}>
        <NativeSkeleton style={styles.caption} />
        <NativeSkeleton style={styles.captionSecond} />
      </View>
      {showMedia ? <NativeSkeleton style={[styles.media, compact && styles.compactMedia]} /> : null}
      <View style={styles.actions}>
        <NativeSkeleton style={styles.action} />
        <NativeSkeleton style={styles.action} />
      </View>
    </View>
  );
}

export default function NativeFeedSkeleton() {
  const { theme, isVibesPro } = useNativeTheme();
  const surface = theme === "bluesky" ? "#0b2d5b" : isVibesPro ? "#101010" : "rgba(255,255,255,0.72)";
  const border = theme === "bluesky" ? "#3478bd" : isVibesPro ? "#765c22" : "rgba(148,163,184,0.22)";

  return (
    <View style={styles.container}>
      <View style={styles.stories}>
        {Array.from({ length: 4 }, (_, index) => (
          <NativeSkeleton key={index} style={styles.story} />
        ))}
      </View>
      <View style={[styles.composer, { backgroundColor: surface, borderColor: border }]}>
        <NativeSkeleton style={styles.composerAvatar} />
        <View style={styles.composerContent}>
          <NativeSkeleton style={styles.composerLine} />
          <NativeSkeleton style={styles.composerMedia} />
        </View>
      </View>
      {Array.from({ length: 3 }, (_, index) => (
        <NativeFeedPostSkeleton key={index} showMedia={index !== 1} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 24 },
  stories: { flexDirection: "row", gap: 10, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 14 },
  story: { width: 96, height: 138, borderRadius: 20 },
  composer: { flexDirection: "row", gap: 12, marginHorizontal: 12, marginBottom: 12, padding: 14, borderWidth: 1, borderRadius: 20 },
  composerAvatar: { width: 40, height: 40, borderRadius: 20 },
  composerContent: { flex: 1, gap: 12 },
  composerLine: { width: "78%", height: 18, borderRadius: 9 },
  composerMedia: { width: 92, height: 26, borderRadius: 13 },
  post: { marginHorizontal: 12, marginBottom: 12, padding: 15, borderWidth: 1, borderRadius: 20 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  authorText: { flex: 1, gap: 7 },
  name: { width: "42%", height: 13 },
  timestamp: { width: "25%", height: 10 },
  caption: { width: "88%", height: 15, marginTop: 16 },
  captionLines: { gap: 8 },
  captionSecond: { width: "62%", height: 15 },
  media: { width: "100%", height: 180, marginTop: 12, borderRadius: 16 },
  actions: { flexDirection: "row", gap: 20, marginTop: 16 },
  action: { width: 62, height: 14, borderRadius: 7 },
  compactPost: { marginBottom: 8, padding: 13 },
  compactMedia: { height: 148 },
});
