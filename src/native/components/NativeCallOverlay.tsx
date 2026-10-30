import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Mic, MicOff, PhoneOff, Volume2, VolumeX, Video, VideoOff } from "lucide-react-native";
import { RTCView, type MediaStream } from "react-native-webrtc";
import { SafeAreaView } from "react-native-safe-area-context";
import type { CallSession, CallType } from "../../types/call";
import { useNativeTheme } from "../contexts/NativeThemeProvider";

export type NativeIncomingCall = {
  conversationId: string;
  senderId: string;
  senderName: string;
  callType: CallType;
  callId?: string;
  invitationId?: string;
  expiresAt?: string;
  sdp: { type: "offer"; sdp: string };
};

type Props = {
  incomingCall: NativeIncomingCall | null;
  session: CallSession | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isCameraOff: boolean;
  isSpeakerOn: boolean;
  error: string | null;
  onAccept: () => void;
  onDecline: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleSpeaker: () => void;
};

function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function NativeCallOverlay({
  incomingCall,
  session,
  localStream,
  remoteStream,
  isMuted,
  isCameraOff,
  isSpeakerOn,
  error,
  onAccept,
  onDecline,
  onEnd,
  onToggleMute,
  onToggleCamera,
  onToggleSpeaker,
}: Props) {
  const { theme } = useNativeTheme();
  const isBlueSky = theme === "bluesky";
  const [duration, setDuration] = useState(0);
  const visible = Boolean(incomingCall || session);
  const isIncoming = Boolean(incomingCall && !session);
  const activeSession = session;
  const callerName = incomingCall?.senderName ?? activeSession?.remoteUsername ?? "MeToYou user";
  const callType = incomingCall?.callType ?? activeSession?.callType ?? "audio";
  const remoteVideoActive = Boolean(remoteStream?.getVideoTracks().some((track) => track.enabled));

  useEffect(() => {
    if (activeSession?.status !== "connected") {
      setDuration(0);
      return;
    }
    const startedAt = Date.now();
    const timer = setInterval(() => setDuration(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [activeSession?.status]);

  return (
    <Modal
      animationType="fade"
      onRequestClose={isIncoming ? onDecline : onEnd}
      statusBarTranslucent
      visible={visible}
    >
      <View style={[styles.root, isBlueSky && styles.blueSkyRoot]}>
        {callType === "video" && remoteVideoActive && remoteStream ? (
          <RTCView objectFit="cover" streamURL={remoteStream.toURL()} style={StyleSheet.absoluteFill} />
        ) : null}
        <LinearGradient
          colors={callType === "video" && remoteVideoActive
            ? ["rgba(2,6,23,0.38)", "rgba(2,6,23,0.12)", "rgba(2,6,23,0.82)"]
            : isBlueSky ? ["#061a3a", "#0b3b78", "#125baa"] : ["#020617", "#082f49", "#020617"]}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
          <View style={styles.content}>
            {callType === "video" && localStream?.getVideoTracks().length && !isCameraOff ? (
              <View style={styles.localVideo}>
                <RTCView
                  mirror
                  objectFit="cover"
                  streamURL={localStream.toURL()}
                  style={StyleSheet.absoluteFill}
                  zOrder={1}
                />
              </View>
            ) : null}
            {callType === "video" && remoteVideoActive ? (
              <View style={styles.videoCallDetails}>
                <Text style={styles.callType}>{isIncoming ? "INCOMING VIDEO CALL" : callerName}</Text>
                <Text style={styles.status}>
                  {isIncoming
                    ? callerName
                    : activeSession?.status === "connected"
                      ? formatDuration(duration)
                      : "Calling…"}
                </Text>
              </View>
            ) : (
              <View style={styles.callerBlock}>
                <View style={[styles.avatar, activeSession?.status === "connected" && styles.connectedAvatar]}>
                  <Text style={styles.avatarText}>{callerName.slice(0, 1).toUpperCase()}</Text>
                </View>
                <Text style={styles.callType}>{isIncoming ? "INCOMING CALL" : callType === "video" ? "VIDEO CALL" : "AUDIO CALL"}</Text>
                <Text style={styles.name}>{callerName}</Text>
                <Text style={styles.status}>
                  {isIncoming
                    ? `${callType === "video" ? "Video" : "Audio"} call`
                    : activeSession?.status === "connected"
                      ? formatDuration(duration)
                      : "Calling…"}
                </Text>
              </View>
            )}
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            {isIncoming ? (
              <View style={styles.incomingActions}>
                <Pressable accessibilityLabel="Decline call" onPress={onDecline} style={[styles.callButton, styles.declineButton]}>
                  <PhoneOff color="#ffffff" size={24} />
                  <Text style={styles.buttonLabel}>Decline</Text>
                </Pressable>
                <Pressable accessibilityLabel="Accept call" onPress={onAccept} style={[styles.callButton, styles.acceptButton]}>
                  {callType === "video" ? <Video color="#ffffff" size={24} /> : <Mic color="#ffffff" size={24} />}
                  <Text style={styles.buttonLabel}>Accept</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.activeActions}>
                <Pressable accessibilityLabel={isMuted ? "Unmute microphone" : "Mute microphone"} onPress={onToggleMute} style={[styles.controlButton, isBlueSky && styles.blueSkyControl, isMuted && styles.selectedControl]}>
                  {isMuted ? <MicOff color="#ffffff" size={23} /> : <Mic color="#ffffff" size={23} />}
                  <Text style={styles.buttonLabel}>{isMuted ? "Unmute" : "Mute"}</Text>
                </Pressable>
                <Pressable accessibilityLabel={isSpeakerOn ? "Use earpiece" : "Use speaker"} onPress={onToggleSpeaker} style={[styles.controlButton, isBlueSky && styles.blueSkyControl, isSpeakerOn && styles.selectedControl]}>
                  {isSpeakerOn ? <Volume2 color="#ffffff" size={23} /> : <VolumeX color="#ffffff" size={23} />}
                  <Text style={styles.buttonLabel}>{isSpeakerOn ? "Speaker" : "Earpiece"}</Text>
                </Pressable>
                {callType === "video" ? (
                  <Pressable accessibilityLabel={isCameraOff ? "Turn camera on" : "Turn camera off"} onPress={onToggleCamera} style={[styles.controlButton, isBlueSky && styles.blueSkyControl, isCameraOff && styles.selectedControl]}>
                    {isCameraOff ? <VideoOff color="#ffffff" size={23} /> : <Video color="#ffffff" size={23} />}
                    <Text style={styles.buttonLabel}>{isCameraOff ? "Camera off" : "Camera"}</Text>
                  </Pressable>
                ) : null}
                <Pressable accessibilityLabel="End call" onPress={onEnd} style={[styles.controlButton, styles.declineButton]}>
                  <PhoneOff color="#ffffff" size={23} />
                  <Text style={styles.buttonLabel}>End</Text>
                </Pressable>
              </View>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#020617" },
  blueSkyRoot: { backgroundColor: "#061a3a" },
  safeArea: { flex: 1 },
  content: { flex: 1, justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, paddingTop: 40, paddingBottom: 28 },
  localVideo: { position: "absolute", top: 18, right: 18, zIndex: 2, width: 104, height: 150, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.55)", borderRadius: 18, backgroundColor: "#0f172a" },
  callerBlock: { flex: 1, justifyContent: "center", alignItems: "center" },
  videoCallDetails: { width: "100%", alignItems: "center", paddingTop: 8 },
  avatar: { width: 116, height: 116, alignItems: "center", justifyContent: "center", marginBottom: 26, borderWidth: 3, borderColor: "rgba(103,232,249,0.65)", borderRadius: 58, backgroundColor: "#0e7490" },
  connectedAvatar: { borderColor: "#34d399" },
  avatarText: { color: "#ffffff", fontSize: 42, fontWeight: "900" },
  callType: { color: "rgba(207,250,254,0.72)", fontSize: 11, fontWeight: "800", letterSpacing: 2.2 },
  name: { marginTop: 10, color: "#ffffff", fontSize: 29, fontWeight: "900", textAlign: "center" },
  status: { marginTop: 10, color: "rgba(255,255,255,0.7)", fontSize: 15, fontVariant: ["tabular-nums"] },
  error: { marginBottom: 14, color: "#fecdd3", fontSize: 12, textAlign: "center" },
  incomingActions: { width: "100%", flexDirection: "row", justifyContent: "center", gap: 40, paddingBottom: 14 },
  activeActions: { width: "100%", flexDirection: "row", justifyContent: "center", flexWrap: "wrap", gap: 18 },
  callButton: { minWidth: 104, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 22 },
  controlButton: { width: 72, minHeight: 78, alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.13)" },
  blueSkyControl: { backgroundColor: "rgba(84,184,255,0.24)" },
  acceptButton: { backgroundColor: "#059669" },
  declineButton: { backgroundColor: "#e11d48" },
  selectedControl: { backgroundColor: "#475569" },
  buttonLabel: { color: "#ffffff", fontSize: 11, fontWeight: "700" },
});
