import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { MessageCircle } from "lucide-react-native";
import type { NativeClip } from "../lib/clips";

type Props = {
  clip: NativeClip;
  height: number;
  active: boolean;
  paused: boolean;
  onLike: () => void;
  onComments: () => void;
  onActions: () => void;
  onProfile: () => void;
};

export default function NativeClipCard({
  clip,
  height,
  active,
  paused,
  onLike,
  onComments,
  onActions,
  onProfile,
}: Props) {
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const player = useVideoPlayer(clip.video_url, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = false;
  });

  useEffect(() => {
    const playingSubscription = player.addListener("playingChange", ({ isPlaying }) => {
      setPlaying(isPlaying);
    });
    const statusSubscription = player.addListener("statusChange", ({ status, error }) => {
      if (status === "error") setPlaybackError(error?.message ?? "This Clip could not be played.");
      else setPlaybackError(null);
    });
    const sourceSubscription = player.addListener("sourceLoad", ({ availableVideoTracks }) => {
      const size = availableVideoTracks[0]?.size;
      if (size?.width && size.height) {
        setOrientation(size.width > size.height ? "landscape" : "portrait");
      }
    });
    return () => {
      playingSubscription.remove();
      statusSubscription.remove();
      sourceSubscription.remove();
    };
  }, [player]);

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    if (active && !paused) {
      player.play();
    } else {
      player.pause();
    }
  }, [active, paused, player]);

  const togglePlayback = () => {
    if (player.playing) player.pause();
    else player.play();
  };

  return (
    <View style={[styles.card, { height }]}>
      {clip.image_url ? (
        <Image
          source={{ uri: clip.image_url }}
          style={styles.poster}
          resizeMode="cover"
        />
      ) : null}
      <VideoView
        contentFit={orientation === "portrait" ? "cover" : "contain"}
        nativeControls={false}
        player={player}
        style={styles.video}
        surfaceType="textureView"
      />
      <Pressable
        accessibilityLabel={playing ? "Pause Clip" : "Play Clip"}
        accessibilityRole="button"
        onPress={togglePlayback}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.shade} />
      {playbackError ? (
        <View pointerEvents="none" style={styles.playbackErrorWrap}>
          <Text style={styles.playbackError}>{playbackError}</Text>
        </View>
      ) : !playing && active ? (
        <View pointerEvents="none" style={styles.playIconWrap}>
          <Text style={styles.playIcon}>▶</Text>
        </View>
      ) : null}

      <View pointerEvents="box-none" style={styles.overlay}>
        <View style={styles.captionArea}>
          <Pressable accessibilityRole="link" onPress={onProfile}>
            <Text style={styles.username}>@{clip.username}</Text>
          </Pressable>
          {clip.text ? (
            <View style={[styles.caption, captionExpanded && styles.expandedCaption]}>
              <Text
                numberOfLines={captionExpanded ? undefined : 3}
                style={styles.captionText}
              >
                {clip.text}
              </Text>
              {clip.text.length > 120 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={captionExpanded ? "Show less caption" : "Show more caption"}
                  onPress={() => setCaptionExpanded((expanded) => !expanded)}
                  style={styles.captionToggle}
                >
                  <Text style={styles.captionToggleText}>{captionExpanded ? "See less" : "See more"}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Pressable accessibilityLabel={clip.liked ? "Unlike Clip" : "Like Clip"} onPress={onLike} style={styles.action}>
            <Text style={styles.likeIcon}>{clip.liked ? "❤️" : "🤍"}</Text>
          </Pressable>
          <Text style={styles.count}>{clip.likes_count}</Text>
          <Pressable accessibilityLabel="Open Clip comments" onPress={onComments} style={styles.action}>
              <MessageCircle color="#ffffff" size={26} />
          </Pressable>
          <Text style={styles.count}>{clip.comments_count}</Text>
          <Pressable accessibilityLabel="More Clip actions" onPress={onActions} style={styles.action}>
            <View style={styles.gridIcon}>
              <View style={styles.gridDot} />
              <View style={styles.gridDot} />
              <View style={styles.gridDot} />
              <View style={styles.gridDot} />
            </View>
          </Pressable>
          <Pressable
            accessibilityLabel={muted ? "Unmute Clip" : "Mute Clip"}
            onPress={() => setMuted((value) => !value)}
            style={styles.action}
          >
            <Text style={styles.actionIcon}>{muted ? "🔇" : "🔊"}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "relative",
    width: "100%",
    overflow: "hidden",
    backgroundColor: "#020617",
  },
  poster: { ...StyleSheet.absoluteFill },
  video: { ...StyleSheet.absoluteFill },
  shade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  playIconWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  playIcon: {
    overflow: "hidden",
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderRadius: 40,
    color: "#ffffff",
    backgroundColor: "rgba(15,23,42,0.52)",
    fontSize: 27,
  },
  playbackErrorWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  playbackError: {
    padding: 14,
    borderRadius: 14,
    overflow: "hidden",
    color: "#ffffff",
    backgroundColor: "rgba(127,29,29,0.85)",
    textAlign: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 14,
    paddingHorizontal: 18,
    paddingTop: 74,
    paddingBottom: 38,
  },
  captionArea: { flex: 1, minWidth: 0 },
  username: { color: "#ffffff", fontSize: 16, fontWeight: "900", textShadowColor: "#000000", textShadowRadius: 8 },
  caption: { maxHeight: 76, marginTop: 8 },
  expandedCaption: {
    maxHeight: 160,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 14,
    backgroundColor: "rgba(2,6,23,0.88)",
  },
  captionText: { color: "rgba(255,255,255,0.92)", fontSize: 14, lineHeight: 20 },
  captionToggle: { alignSelf: "flex-start", paddingVertical: 5 },
  captionToggleText: { color: "#bae6fd", fontSize: 12, fontWeight: "800", textDecorationLine: "underline" },
  actions: { alignItems: "center", gap: 3, paddingBottom: 4 },
  action: { minWidth: 42, minHeight: 42, alignItems: "center", justifyContent: "center" },
  likeIcon: { fontSize: 27 },
  actionIcon: { color: "#ffffff", fontSize: 24, fontWeight: "700", textShadowColor: "#000000", textShadowRadius: 8 },
  count: { marginBottom: 5, color: "rgba(255,255,255,0.9)", fontSize: 11, fontWeight: "700" },
  gridIcon: { width: 22, height: 22, flexDirection: "row", flexWrap: "wrap", gap: 3 },
  gridDot: { width: 9, height: 9, borderRadius: 2, backgroundColor: "#ffffff" },
});
