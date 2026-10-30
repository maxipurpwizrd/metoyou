import InCallManager from "react-native-incall-manager";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Alert } from "react-native";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { CallSession, CallType } from "../../types/call";
import { useNativeAuth } from "./NativeAuthProvider";
import { NativeCallContext } from "./NativeCallContext";
import NativeCallOverlay, { type NativeIncomingCall } from "../components/NativeCallOverlay";
import { fetchNativeCallParticipantNames, updateNativeCallHistory } from "../lib/calls";
import {
  appendServerCallSignal,
  acceptServerCallInvitation,
  createServerCallInvitation,
  getServerCallInvitation,
  recoverServerCallInvitation,
  transitionServerCallInvitation,
} from "../lib/callInvitationClient";
import { nativeSupabase } from "../lib/supabase";
import {
  MediaStream,
  MediaStreamTrack,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
} from "react-native-webrtc";

type CallDescription = { type: "offer" | "answer"; sdp: string };
type CallIceCandidate = {
  candidate: string;
  sdpMLineIndex?: number | null;
  sdpMid?: string | null;
  usernameFragment?: string | null;
};
type PendingRealtimeSignal = {
  conversationId: string;
  event: string;
  payload: Record<string, unknown>;
};
type CallChannelEntry = { channel: RealtimeChannel; ready: Promise<RealtimeChannel> };
type NativeIceCandidateEvent = { candidate: RTCIceCandidate | null };
type NativeTrackEvent = { streams: MediaStream[]; track: MediaStreamTrack };
type NativePeerConnectionEvents = {
  addEventListener(type: "icecandidate", listener: (event: NativeIceCandidateEvent) => void): void;
  addEventListener(type: "track", listener: (event: NativeTrackEvent) => void): void;
  addEventListener(type: "connectionstatechange", listener: () => void): void;
};

type StartCallInput = {
  conversationId: string;
  recipientId: string;
  recipientName: string;
  callType: CallType;
};

const ICE_SERVERS = [{ urls: ["stun:stun.l.google.com:19302"] }];

function isCallDescription(value: unknown): value is CallDescription {
  if (!value || typeof value !== "object") return false;
  const description = value as Partial<CallDescription>;
  return (description.type === "offer" || description.type === "answer") && typeof description.sdp === "string";
}

function isCallIceCandidate(value: unknown): value is CallIceCandidate {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CallIceCandidate>;
  return typeof candidate.candidate === "string";
}

function createIdempotencyKey(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function NativeCallProviderImpl({ children }: { children: ReactNode }) {
  const { session } = useNativeAuth();
  const userId = session?.user.id;
  const displayName = typeof session?.user.user_metadata?.username === "string"
    ? session.user.user_metadata.username
    : session?.user.email ?? "MeToYou user";
  const channelsRef = useRef(new Map<string, CallChannelEntry>());
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<CallIceCandidate[]>([]);
  const callHistoryIdRef = useRef<string | null>(null);
  const callStartedAtRef = useRef<Date | null>(null);
  const targetUserIdRef = useRef<string | null>(null);
  const targetConversationIdRef = useRef<string | null>(null);
  const isInitiatorRef = useRef(false);
  const invitationIdRef = useRef<string | null>(null);
  const invitationStatusRef = useRef<"ringing" | "accepted" | null>(null);
  const invitationExpiresAtRef = useRef<string | null>(null);
  const pendingOutgoingIceRef = useRef<PendingRealtimeSignal[]>([]);
  const incomingCandidateKeysRef = useRef(new Set<string>());
  const recoveringInvitationIdsRef = useRef(new Set<string>());
  const dismissedInvitationIdsRef = useRef(new Set<string>());
  const acceptingInvitationRef = useRef(false);
  const sessionRef = useRef<CallSession | null>(null);
  const incomingCallRef = useRef<NativeIncomingCall | null>(null);
  const isMutedRef = useRef(false);
  const [incomingCall, setIncomingCall] = useState<NativeIncomingCall | null>(null);
  const [callSession, setCallSession] = useState<CallSession | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);

  const updateSession = useCallback((next: CallSession | null) => {
    sessionRef.current = next;
    setCallSession(next);
  }, []);

  const updateIncomingCall = useCallback((next: NativeIncomingCall | null) => {
    incomingCallRef.current = next;
    setIncomingCall(next);
  }, []);

  const sendSignal = useCallback(async (
    conversationId: string,
    event: string,
    payload: Record<string, unknown>,
  ) => {
    const entry = channelsRef.current.get(conversationId);
    if (!entry) throw new Error("The call connection is not ready. Try again.");
    const channel = await entry.ready;
    const result = await channel.send({ type: "broadcast", event, payload });
    if (result !== "ok") throw new Error("The call signal could not be sent.");
  }, []);

  const sendCallSignal = useCallback(async (
    conversationId: string,
    event: string,
    payload: Record<string, unknown>,
  ) => {
    const invitationId = invitationIdRef.current;
    if (event === "call-ice-candidate") {
      if (!invitationId || (!isInitiatorRef.current && invitationStatusRef.current !== "accepted")) {
        if (invitationId || isInitiatorRef.current) {
          pendingOutgoingIceRef.current.push({ conversationId, event, payload });
          return;
        }
        await sendSignal(conversationId, event, payload);
        return;
      }
      if (!isCallIceCandidate(payload.candidate)) {
        throw new Error("The call network candidate is invalid.");
      }
      await appendServerCallSignal(
        invitationId,
        "ice",
        payload.candidate,
        `ice:${createIdempotencyKey()}`,
      );
    } else if ((event === "call-offer" || event === "call-answer") && payload.renegotiation === true) {
      if (!invitationId) {
        await sendSignal(conversationId, event, payload);
        return;
      }
      if (!isCallDescription(payload.sdp)) {
        throw new Error("The call renegotiation description is invalid.");
      }
      if (event === "call-offer") {
        await appendServerCallSignal(
          invitationId,
          "renegotiation-offer",
          { type: "offer", sdp: payload.sdp.sdp, renegotiation: true },
          `renegotiation:${createIdempotencyKey()}`,
        );
      } else {
        await appendServerCallSignal(
          invitationId,
          "renegotiation-answer",
          { type: "answer", sdp: payload.sdp.sdp, renegotiation: true },
          `renegotiation:${createIdempotencyKey()}`,
        );
      }
    }
    await sendSignal(conversationId, event, payload);
  }, [sendSignal]);

  const flushPendingOutgoingIce = useCallback(async () => {
    while (pendingOutgoingIceRef.current.length > 0) {
      const signal = pendingOutgoingIceRef.current[0];
      await sendCallSignal(signal.conversationId, signal.event, signal.payload);
      pendingOutgoingIceRef.current.shift();
    }
  }, [sendCallSignal]);

  const stopMedia = useCallback(() => {
    const peerConnection = peerConnectionRef.current;
    if (peerConnection) {
      peerConnection.close();
      peerConnectionRef.current = null;
    }
    for (const stream of [localStreamRef.current, remoteStreamRef.current]) {
      stream?.getTracks().forEach((track) => track.stop());
    }
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    pendingCandidatesRef.current = [];
    pendingOutgoingIceRef.current = [];
    incomingCandidateKeysRef.current.clear();
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsCameraOff(false);
    setIsSpeakerOn(false);
    try {
      InCallManager.stop();
      InCallManager.setKeepScreenOn(false);
    } catch (cause) {
      console.warn("Could not restore call audio routing.", cause);
    }
  }, []);

  const clearCall = useCallback(() => {
    stopMedia();
    callHistoryIdRef.current = null;
    callStartedAtRef.current = null;
    targetUserIdRef.current = null;
    targetConversationIdRef.current = null;
    isInitiatorRef.current = false;
    invitationIdRef.current = null;
    invitationStatusRef.current = null;
    invitationExpiresAtRef.current = null;
    updateSession(null);
    updateIncomingCall(null);
  }, [stopMedia, updateIncomingCall, updateSession]);

  const updateHistoryForEnd = useCallback((status: "completed" | "missed" | "failed" | "declined") => {
    const endedAt = new Date();
    const startedAt = callStartedAtRef.current;
    const connected = sessionRef.current?.status === "connected";
    void updateNativeCallHistory(callHistoryIdRef.current, {
      status,
      ended_at: endedAt.toISOString(),
      duration_seconds: connected && startedAt
        ? Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000))
        : 0,
    }, [userId ?? "", targetUserIdRef.current ?? ""]);
  }, [userId]);

  const addPendingCandidates = useCallback(async (peerConnection: RTCPeerConnection) => {
    const candidates = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    for (const candidate of candidates) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }, []);

  const queueIncomingCandidate = useCallback((candidate: CallIceCandidate) => {
    const key = JSON.stringify(candidate);
    if (incomingCandidateKeysRef.current.has(key)) return;
    incomingCandidateKeysRef.current.add(key);
    const peerConnection = peerConnectionRef.current;
    if (!peerConnection || !peerConnection.remoteDescription) {
      pendingCandidatesRef.current.push(candidate);
      return;
    }
    void peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch((cause: unknown) => {
      console.warn("Could not add a recovered call network candidate.", cause);
    });
  }, []);

  const createPeerConnection = useCallback((conversationId: string, remoteUserId: string) => {
    const peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const eventTarget = peerConnection as RTCPeerConnection & NativePeerConnectionEvents;
    peerConnectionRef.current = peerConnection;
    eventTarget.addEventListener("icecandidate", (event) => {
      if (!event.candidate || !userId) return;
      void sendCallSignal(conversationId, "call-ice-candidate", {
        senderId: userId,
        recipientId: remoteUserId,
        candidate: event.candidate.toJSON(),
      }).catch((cause: unknown) => setCallError(cause instanceof Error ? cause.message : "A network candidate could not be sent."));
    });
    eventTarget.addEventListener("track", (event) => {
      const stream = event.streams[0] ?? remoteStreamRef.current ?? new MediaStream();
      if (!stream.getTracks().some((track) => track.id === event.track.id)) stream.addTrack(event.track);
      remoteStreamRef.current = stream;
      setRemoteStream(stream);
    });
    eventTarget.addEventListener("connectionstatechange", () => {
      if (peerConnection.connectionState === "connected") {
        const current = sessionRef.current;
        if (!current) return;
        const connected = { ...current, status: "connected" as const, startTime: current.startTime ?? new Date() };
        updateSession(connected);
        callStartedAtRef.current ??= connected.startTime ?? new Date();
        void updateNativeCallHistory(callHistoryIdRef.current, {
          status: "connected",
          answered_at: new Date().toISOString(),
        }, [userId ?? "", targetUserIdRef.current ?? ""]);
      } else if (peerConnection.connectionState === "failed") {
        setCallError("The call connection failed. Check your network and try again.");
        const invitationId = invitationIdRef.current;
        if (invitationId) {
          const transition = invitationStatusRef.current === "accepted"
            ? "end"
            : isInitiatorRef.current ? "cancel" : "decline";
          void transitionServerCallInvitation(
            invitationId,
            transition,
            `connection-failed:${invitationId}`,
          ).catch((cause: unknown) => console.warn("Could not transition the failed native call.", cause));
        }
        updateHistoryForEnd("failed");
        clearCall();
      }
    });
    return peerConnection;
  }, [clearCall, sendCallSignal, updateHistoryForEnd, updateSession, userId]);

  const captureLocalMedia = useCallback(async (callType: CallType) => {
    return mediaDevices.getUserMedia({ audio: true, video: callType === "video" });
  }, []);

  const ensureCallChannel = useCallback((conversationId: string) => {
    const existing = channelsRef.current.get(conversationId);
    if (existing) return existing.ready;
    if (!userId) return Promise.reject(new Error("Sign in before placing a call."));

    const channel = nativeSupabase.channel(`calls:${conversationId}`);
    let resolveReady: (channel: RealtimeChannel) => void;
    let rejectReady: (error: Error) => void;
    let settled = false;
    const ready = new Promise<RealtimeChannel>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    const entry = { channel, ready };
    channelsRef.current.set(conversationId, entry);

    channel.on("broadcast", { event: "call-offer" }, async ({ payload }) => {
      const offer = payload as {
        senderId?: string;
        recipientId?: string;
        senderName?: string;
        callType?: CallType;
        callId?: string;
        invitationId?: string;
        expiresAt?: string;
        renegotiation?: boolean;
        sdp?: unknown;
      };
      if (!offer.senderId || offer.recipientId !== userId || !isCallDescription(offer.sdp)) return;
      if (offer.invitationId && dismissedInvitationIdsRef.current.has(offer.invitationId)) return;

      const peerConnection = peerConnectionRef.current;
      if (offer.renegotiation) {
        if (
          !peerConnection ||
          targetUserIdRef.current !== offer.senderId ||
          targetConversationIdRef.current !== conversationId
        ) return;
        try {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(offer.sdp));
          await addPendingCandidates(peerConnection);
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          await sendCallSignal(conversationId, "call-answer", {
            senderId: userId,
            recipientId: offer.senderId,
            callType: offer.callType ?? "audio",
            callId: offer.callId,
            renegotiation: true,
            sdp: answer,
          });
        } catch (cause) {
          setCallError(cause instanceof Error ? cause.message : "Call media could not be negotiated.");
        }
        return;
      }

      if ((sessionRef.current && sessionRef.current.status !== "ended") || incomingCallRef.current) return;
      if (
        offer.sdp.type !== "offer" ||
        (offer.callType !== "audio" && offer.callType !== "video")
      ) return;
      targetUserIdRef.current = offer.senderId;
      targetConversationIdRef.current = conversationId;
      callHistoryIdRef.current = offer.callId ?? null;
      invitationIdRef.current = offer.invitationId ?? null;
      invitationStatusRef.current = offer.invitationId ? "ringing" : null;
      invitationExpiresAtRef.current = offer.expiresAt ?? null;
      updateIncomingCall({
        conversationId,
        senderId: offer.senderId,
        senderName: offer.senderName ?? "MeToYou user",
        callType: offer.callType,
        callId: offer.callId,
        invitationId: offer.invitationId,
        expiresAt: offer.expiresAt,
        sdp: { type: "offer", sdp: offer.sdp.sdp },
      });
    });

    channel.on("broadcast", { event: "call-answer" }, async ({ payload }) => {
      const answer = payload as {
        senderId?: string;
        recipientId?: string;
        callId?: string;
        renegotiation?: boolean;
        sdp?: unknown;
      };
      if (
        !answer.senderId ||
        answer.recipientId !== userId ||
        answer.senderId !== targetUserIdRef.current ||
        conversationId !== targetConversationIdRef.current ||
        !isCallDescription(answer.sdp)
      ) return;
      const peerConnection = peerConnectionRef.current;
      if (!peerConnection) return;

      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer.sdp));
        await addPendingCandidates(peerConnection);
        if (answer.renegotiation) {
          const current = sessionRef.current;
          if (current) {
            const startedAt = current.startTime ?? new Date();
            callStartedAtRef.current ??= startedAt;
            updateSession({ ...current, status: "connected", startTime: startedAt });
          }
          return;
        }

        invitationStatusRef.current = "accepted";
        const current = sessionRef.current;
        if (current) {
          const startedAt = current.startTime ?? new Date();
          callStartedAtRef.current ??= startedAt;
          updateSession({ ...current, status: "connected", startTime: startedAt });
        }
        if (!isInitiatorRef.current) return;

        const microphone = await mediaDevices.getUserMedia({ audio: true, video: false });
        const audioTrack = microphone.getAudioTracks()[0];
        if (!audioTrack) throw new Error("Microphone access was not granted.");
        audioTrack.enabled = !isMutedRef.current;
        const existingTracks = localStreamRef.current?.getTracks() ?? [];
        const combinedStream = new MediaStream([...existingTracks, audioTrack]);
        const audioTransceiver = peerConnection.getTransceivers().find(
          (transceiver) => transceiver.receiver.track?.kind === "audio" && !transceiver.sender.track,
        );
        if (audioTransceiver) {
          await audioTransceiver.sender.replaceTrack(audioTrack);
          audioTransceiver.direction = "sendrecv";
        } else {
          peerConnection.addTrack(audioTrack, combinedStream);
        }
        localStreamRef.current = combinedStream;
        setLocalStream(combinedStream);
        const renegotiationOffer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(renegotiationOffer);
        await sendCallSignal(conversationId, "call-offer", {
          senderId: userId,
          recipientId: answer.senderId,
          callType: sessionRef.current?.callType ?? "audio",
          callId: answer.callId ?? callHistoryIdRef.current,
          renegotiation: true,
          sdp: renegotiationOffer,
        });
      } catch (cause) {
        setCallError(cause instanceof Error ? cause.message : "The call could not be answered.");
        updateHistoryForEnd("failed");
        clearCall();
      }
    });

    channel.on("broadcast", { event: "call-ice-candidate" }, async ({ payload }) => {
      const signal = payload as {
        senderId?: string;
        recipientId?: string;
        candidate?: unknown;
      };
      if (
        !signal.senderId ||
        signal.recipientId !== userId ||
        signal.senderId !== targetUserIdRef.current ||
        conversationId !== targetConversationIdRef.current ||
        !isCallIceCandidate(signal.candidate)
      ) return;
      queueIncomingCandidate(signal.candidate);
    });

    channel.on("broadcast", { event: "call-hangup" }, ({ payload }) => {
      const signal = payload as { senderId?: string; recipientId?: string };
      if (
        signal.recipientId !== userId ||
        signal.senderId !== targetUserIdRef.current ||
        conversationId !== targetConversationIdRef.current
      ) return;
      if (sessionRef.current) {
        if (!invitationIdRef.current) {
          updateHistoryForEnd(sessionRef.current.status === "connected" ? "completed" : "missed");
        }
        clearCall();
      } else if (incomingCallRef.current?.senderId === signal.senderId) {
        if (incomingCallRef.current.invitationId) {
          dismissedInvitationIdsRef.current.add(incomingCallRef.current.invitationId);
        } else {
          void updateNativeCallHistory(incomingCallRef.current.callId ?? null, {
            status: "missed",
            ended_at: new Date().toISOString(),
            duration_seconds: 0,
          }, [userId, signal.senderId ?? ""]);
        }
        updateIncomingCall(null);
        targetUserIdRef.current = null;
        targetConversationIdRef.current = null;
        callHistoryIdRef.current = null;
        invitationIdRef.current = null;
        invitationStatusRef.current = null;
        invitationExpiresAtRef.current = null;
      }
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED" && !settled) {
        settled = true;
        resolveReady(channel);
      } else if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") && !settled) {
        settled = true;
        const error = new Error(`Call connection ${status.toLowerCase().replace("_", " ")}.`);
        rejectReady(error);
        channelsRef.current.delete(conversationId);
      }
    });
    return ready;
  }, [
    addPendingCandidates,
    clearCall,
    queueIncomingCandidate,
    sendCallSignal,
    updateHistoryForEnd,
    updateIncomingCall,
    updateSession,
    userId,
  ]);

  const handleIncomingInvitation = useCallback(async (invitationId: string) => {
    if (!userId || dismissedInvitationIdsRef.current.has(invitationId)
      || recoveringInvitationIdsRef.current.has(invitationId)) return;
    if (sessionRef.current || (incomingCallRef.current
      && incomingCallRef.current.invitationId !== invitationId)) return;

    recoveringInvitationIdsRef.current.add(invitationId);
    try {
      const recovered = await recoverServerCallInvitation(invitationId);
      const invitation = recovered.invitation;
      const expiryTime = Date.parse(invitation.expires_at);
      if (invitation.callee_id !== userId || invitation.status !== "ringing"
        || !Number.isFinite(expiryTime) || expiryTime <= Date.now()
        || (invitation.call_type !== "audio" && invitation.call_type !== "video")) return;

      const initialOffer = recovered.signals.find((signal) =>
        signal.sender_id === invitation.caller_id
        && signal.event_type === "offer"
        && isCallDescription(signal.payload)
        && signal.payload.type === "offer"
        && !("renegotiation" in signal.payload),
      );
      if (!initialOffer || !isCallDescription(initialOffer.payload)) {
        throw new Error("The incoming call has no valid initial offer.");
      }

      await ensureCallChannel(invitation.conversation_id);
      if (dismissedInvitationIdsRef.current.has(invitationId)) return;
      for (const signal of recovered.signals) {
        if (signal.sender_id === invitation.caller_id
          && signal.event_type === "ice"
          && isCallIceCandidate(signal.payload)) {
          queueIncomingCandidate(signal.payload);
        }
      }
      if (sessionRef.current) return;
      if (incomingCallRef.current) {
        if (incomingCallRef.current.invitationId === invitationId) return;
        return;
      }

      const participantNames = await fetchNativeCallParticipantNames([invitation.caller_id]);
      if (dismissedInvitationIdsRef.current.has(invitationId)
        || sessionRef.current || incomingCallRef.current) return;

      invitationIdRef.current = invitation.id;
      invitationStatusRef.current = "ringing";
      invitationExpiresAtRef.current = invitation.expires_at;
      targetUserIdRef.current = invitation.caller_id;
      targetConversationIdRef.current = invitation.conversation_id;
      callHistoryIdRef.current = invitation.call_history_id;
      updateIncomingCall({
        conversationId: invitation.conversation_id,
        senderId: invitation.caller_id,
        senderName: participantNames[invitation.caller_id] ?? "MeToYou user",
        callType: invitation.call_type,
        callId: invitation.call_history_id,
        invitationId: invitation.id,
        expiresAt: invitation.expires_at,
        sdp: { type: "offer", sdp: initialOffer.payload.sdp },
      });
    } catch (cause) {
      console.warn("Could not recover the incoming native call.", cause);
      const message = cause instanceof Error ? cause.message : "The incoming call could not be recovered.";
      setCallError(message);
      Alert.alert("Incoming call unavailable", message);
    } finally {
      recoveringInvitationIdsRef.current.delete(invitationId);
    }
  }, [ensureCallChannel, queueIncomingCandidate, updateIncomingCall, userId]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    let receivedSubscription: { remove: () => void } | null = null;
    let responseSubscription: { remove: () => void } | null = null;

    const handleNotificationData = (data: unknown) => {
      if (!isRecord(data) || data.type !== "native_call_invitation"
        || typeof data.invitationId !== "string") return;
      void handleIncomingInvitation(data.invitationId);
    };

    void import("expo-notifications").then(async (Notifications) => {
      if (!active) return;
      receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
        handleNotificationData(notification.request.content.data);
      });
      responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
        handleNotificationData(response.notification.request.content.data);
      });
      const lastResponse = await Notifications.getLastNotificationResponseAsync();
      if (active && lastResponse) handleNotificationData(lastResponse.notification.request.content.data);
    }).catch((cause: unknown) => {
      if (active) console.warn("Could not subscribe to native call notifications.", cause);
    });

    return () => {
      active = false;
      receivedSubscription?.remove();
      responseSubscription?.remove();
    };
  }, [handleIncomingInvitation, userId]);

  useEffect(() => {
    const invitationId = invitationIdRef.current;
    const expiresAt = invitationExpiresAtRef.current;
    if (!invitationId || !expiresAt || invitationStatusRef.current !== "ringing") return;
    const expiryTime = Date.parse(expiresAt);
    if (!Number.isFinite(expiryTime)) return;
    const timer = setTimeout(() => {
      void (async () => {
        if (invitationIdRef.current !== invitationId
          || invitationStatusRef.current !== "ringing") return;
        try {
          const current = await getServerCallInvitation(invitationId);
          if (current.invitation.status === "accepted") {
            invitationStatusRef.current = "accepted";
            return;
          }
          if (current.invitation.status !== "ringing") {
            dismissedInvitationIdsRef.current.add(invitationId);
            if (sessionRef.current) {
              clearCall();
            } else {
              updateIncomingCall(null);
              targetUserIdRef.current = null;
              targetConversationIdRef.current = null;
              callHistoryIdRef.current = null;
              invitationIdRef.current = null;
              invitationStatusRef.current = null;
              invitationExpiresAtRef.current = null;
              pendingCandidatesRef.current = [];
              incomingCandidateKeysRef.current.clear();
            }
            return;
          }
          await transitionServerCallInvitation(
            invitationId,
            "expire",
            `expire:${invitationId}`,
          );
        } catch (cause) {
          console.warn("Could not expire the native call invitation.", cause);
          return;
        }

        if (invitationIdRef.current !== invitationId) return;
        const remoteUserId = targetUserIdRef.current;
        const conversationId = targetConversationIdRef.current;
        if (remoteUserId && conversationId && userId) {
          await sendSignal(conversationId, "call-hangup", {
            senderId: userId,
            recipientId: remoteUserId,
          }).catch((cause: unknown) => console.warn("Could not notify the other participant that the call expired.", cause));
        }
        dismissedInvitationIdsRef.current.add(invitationId);
        if (sessionRef.current) {
          updateHistoryForEnd("missed");
          clearCall();
        } else {
          void updateNativeCallHistory(callHistoryIdRef.current, {
            status: "missed",
            ended_at: new Date().toISOString(),
            duration_seconds: 0,
          }, [userId ?? "", remoteUserId ?? ""]);
          updateIncomingCall(null);
          targetUserIdRef.current = null;
          targetConversationIdRef.current = null;
          callHistoryIdRef.current = null;
          invitationIdRef.current = null;
          invitationStatusRef.current = null;
          invitationExpiresAtRef.current = null;
          pendingCandidatesRef.current = [];
          incomingCandidateKeysRef.current.clear();
        }
      })();
    }, Math.max(0, expiryTime - Date.now() + 500));
    return () => clearTimeout(timer);
  }, [
    callSession,
    clearCall,
    incomingCall,
    sendSignal,
    updateHistoryForEnd,
    updateIncomingCall,
    userId,
  ]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void Promise.resolve(nativeSupabase
      .from("conversations")
      .select("id")
      .or(`user_1.eq.${userId},user_2.eq.${userId}`)
      .then(async ({ data, error }) => {
        if (error) throw error;
        const conversationIds = (data ?? []).map((conversation) => conversation.id);
        for (const conversationId of conversationIds) {
          if (!active) return;
          try {
            await ensureCallChannel(conversationId);
          } catch (cause) {
            if (active) console.warn(`Could not listen for calls in ${conversationId}.`, cause);
          }
        }
      }))
      .catch((cause: unknown) => {
        if (active) console.error("Could not load conversations for incoming calls.", cause);
      });

    return () => {
      active = false;
      for (const { channel } of channelsRef.current.values()) {
        void nativeSupabase.removeChannel(channel);
      }
      channelsRef.current.clear();
      const invitationId = invitationIdRef.current;
      if (invitationId) {
        const transition = invitationStatusRef.current === "accepted"
          ? "end"
          : isInitiatorRef.current ? "cancel" : "decline";
        void transitionServerCallInvitation(
          invitationId,
          transition,
          `provider-cleanup:${invitationId}`,
        ).catch((cause: unknown) => console.warn("Could not close the native call during provider cleanup.", cause));
      } else if (sessionRef.current) {
        updateHistoryForEnd("failed");
      }
      clearCall();
    };
  }, [clearCall, ensureCallChannel, updateHistoryForEnd, userId]);

  const startCall = useCallback(async (input: StartCallInput) => {
    if (!userId) throw new Error("Sign in before placing a call.");
    if (sessionRef.current || incomingCallRef.current) {
      Alert.alert("Call in progress", "Finish the current call before starting another.");
      return;
    }
    setCallError(null);
    setIsMuted(false);
    isMutedRef.current = false;
    await ensureCallChannel(input.conversationId);
    const peerConnection = createPeerConnection(input.conversationId, input.recipientId);
    targetUserIdRef.current = input.recipientId;
    targetConversationIdRef.current = input.conversationId;
    isInitiatorRef.current = true;
    invitationIdRef.current = null;
    invitationStatusRef.current = null;
    invitationExpiresAtRef.current = null;

    updateSession({
      id: `call-${Date.now()}`,
      conversationId: input.conversationId,
      callType: input.callType,
      status: "ringing",
      remoteUserId: input.recipientId,
      remoteUsername: input.recipientName,
    });

    let cameraStream: MediaStream | null = null;
    if (input.callType === "video") {
      try {
        cameraStream = await mediaDevices.getUserMedia({ audio: false, video: true });
        localStreamRef.current = cameraStream;
        setLocalStream(cameraStream);
        const videoTrack = cameraStream.getVideoTracks()[0];
        if (videoTrack) peerConnection.addTransceiver(videoTrack, { direction: "sendrecv" });
      } catch (cause) {
        setCallError(cause instanceof Error ? "Camera unavailable. The call will continue without local video." : "Camera unavailable.");
        peerConnection.addTransceiver("video", { direction: "recvonly" });
      }
    }
    peerConnection.addTransceiver("audio", { direction: "recvonly" });

    setIsMuted(false);
    isMutedRef.current = false;
    setIsCameraOff(input.callType === "video" && !cameraStream);
    setIsSpeakerOn(false);
    try {
      InCallManager.start({ media: input.callType });
      InCallManager.setKeepScreenOn(true);
      InCallManager.setForceSpeakerphoneOn(false);
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      const offerSdp = peerConnection.localDescription?.sdp ?? offer.sdp;
      if (!offerSdp) throw new Error("The call offer could not be created.");
      const idempotencyKey = createIdempotencyKey();
      const { invitation } = await createServerCallInvitation({
        conversationId: input.conversationId,
        calleeId: input.recipientId,
        callType: input.callType,
        offer: { type: "offer", sdp: offerSdp },
        idempotencyKey,
      });
      invitationIdRef.current = invitation.id;
      invitationStatusRef.current = "ringing";
      invitationExpiresAtRef.current = invitation.expiresAt;
      callHistoryIdRef.current = invitation.callHistoryId;
      updateSession({
        id: invitation.callHistoryId,
        conversationId: input.conversationId,
        callType: input.callType,
        status: "ringing",
        remoteUserId: input.recipientId,
        remoteUsername: input.recipientName,
      });
      await sendSignal(input.conversationId, "call-offer", {
        senderId: userId,
        recipientId: input.recipientId,
        senderName: displayName,
        callType: input.callType,
        callId: invitation.callHistoryId,
        invitationId: invitation.id,
        expiresAt: invitation.expiresAt,
        renegotiation: false,
        sdp: { type: "offer", sdp: offerSdp },
      });
      await flushPendingOutgoingIce();
    } catch (cause) {
      setCallError(cause instanceof Error ? cause.message : "The call could not be started.");
      const invitationId = invitationIdRef.current;
      if (invitationId) {
        await transitionServerCallInvitation(
          invitationId,
          "cancel",
          `start-failed:${invitationId}`,
        ).catch((transitionError: unknown) => {
          console.warn("Could not cancel the failed native call invitation.", transitionError);
        });
      }
      updateHistoryForEnd("failed");
      clearCall();
      throw cause;
    }
  }, [
    clearCall,
    createPeerConnection,
    displayName,
    ensureCallChannel,
    flushPendingOutgoingIce,
    sendSignal,
    updateHistoryForEnd,
    updateSession,
    userId,
  ]);

  const acceptCall = useCallback(async () => {
    const offer = incomingCallRef.current;
    if (!offer || !userId || acceptingInvitationRef.current) return;
    acceptingInvitationRef.current = true;
    setCallError(null);
    setIsMuted(false);
    isMutedRef.current = false;
    targetUserIdRef.current = offer.senderId;
    targetConversationIdRef.current = offer.conversationId;
    callHistoryIdRef.current = offer.callId ?? null;
    invitationIdRef.current = offer.invitationId ?? null;
    invitationStatusRef.current = offer.invitationId ? "ringing" : null;
    invitationExpiresAtRef.current = offer.expiresAt ?? null;
    callStartedAtRef.current = new Date();
    isInitiatorRef.current = false;

    let stream: MediaStream;
    try {
      stream = await captureLocalMedia(offer.callType);
    } catch (cause) {
      if (offer.callType !== "video") {
        setCallError(cause instanceof Error ? cause.message : "Microphone access is required for calls.");
        acceptingInvitationRef.current = false;
        return;
      }
      try {
        stream = await captureLocalMedia("audio");
        setIsCameraOff(true);
        setCallError("Camera unavailable. Joining with audio only.");
      } catch (audioCause) {
        setCallError(audioCause instanceof Error ? audioCause.message : "Microphone access is required for calls.");
        acceptingInvitationRef.current = false;
        return;
      }
    }

    try {
      await ensureCallChannel(offer.conversationId);
      const peerConnection = createPeerConnection(offer.conversationId, offer.senderId);
      localStreamRef.current = stream;
      setLocalStream(stream);
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer.sdp));
      for (const track of stream.getTracks()) {
        const transceiver = peerConnection.getTransceivers().find(
          (candidate) => candidate.receiver.track?.kind === track.kind && !candidate.sender.track,
        );
        if (transceiver) {
          await transceiver.sender.replaceTrack(track);
          transceiver.direction = "sendrecv";
        } else {
          peerConnection.addTrack(track, stream);
        }
      }
      await addPendingCandidates(peerConnection);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      const answerSdp = peerConnection.localDescription?.sdp ?? answer.sdp;
      if (!answerSdp) throw new Error("The call answer could not be created.");
      InCallManager.start({ media: offer.callType });
      InCallManager.setKeepScreenOn(true);
      InCallManager.setForceSpeakerphoneOn(false);
      updateSession({
        id: offer.callId ?? `call-${Date.now()}`,
        conversationId: offer.conversationId,
        callType: offer.callType,
        status: "ringing",
        startTime: new Date(),
        remoteUserId: offer.senderId,
        remoteUsername: offer.senderName,
      });
      if (offer.invitationId) {
        await acceptServerCallInvitation(
          offer.invitationId,
          { type: "answer", sdp: answerSdp },
          `accept:${offer.invitationId}`,
        );
        invitationStatusRef.current = "accepted";
        await flushPendingOutgoingIce();
      }
      await sendSignal(offer.conversationId, "call-answer", {
        senderId: userId,
        recipientId: offer.senderId,
        callType: offer.callType,
        callId: offer.callId,
        invitationId: offer.invitationId,
        renegotiation: false,
        sdp: { type: "answer", sdp: answerSdp },
      });
      const acceptedSession = sessionRef.current;
      if (acceptedSession) {
        const startedAt = acceptedSession.startTime ?? new Date();
        callStartedAtRef.current ??= startedAt;
        updateSession({ ...acceptedSession, status: "connected", startTime: startedAt });
      }
      updateIncomingCall(null);
    } catch (cause) {
      setCallError(cause instanceof Error ? cause.message : "The call could not be accepted.");
      await sendSignal(offer.conversationId, "call-hangup", {
        senderId: userId,
        recipientId: offer.senderId,
      }).catch((signalError: unknown) => console.warn("Could not decline the failed call.", signalError));
      if (offer.invitationId) {
        let transition: "decline" | "end" | null =
          invitationStatusRef.current === "accepted" ? "end" : "decline";
        try {
          const current = await getServerCallInvitation(offer.invitationId);
          transition = current.invitation.status === "accepted"
            ? "end"
            : current.invitation.status === "ringing" ? "decline" : null;
        } catch (lookupError) {
          console.warn("Could not read the native call state after acceptance failed.", lookupError);
        }
        if (transition) {
          await transitionServerCallInvitation(
            offer.invitationId,
            transition,
            `failed-accept:${offer.invitationId}`,
          ).catch((transitionError: unknown) => {
            console.warn("Could not transition the failed native call acceptance.", transitionError);
          });
        }
      }
      updateHistoryForEnd("failed");
      clearCall();
    } finally {
      acceptingInvitationRef.current = false;
    }
  }, [
    addPendingCandidates,
    captureLocalMedia,
    clearCall,
    createPeerConnection,
    ensureCallChannel,
    flushPendingOutgoingIce,
    sendSignal,
    updateHistoryForEnd,
    updateIncomingCall,
    updateSession,
    userId,
  ]);

  const declineCall = useCallback(async () => {
    const offer = incomingCallRef.current;
    if (!offer || !userId) return;
    if (offer.invitationId) {
      try {
        await transitionServerCallInvitation(
          offer.invitationId,
          "decline",
          `decline:${offer.invitationId}`,
        );
      } catch (cause) {
        setCallError(cause instanceof Error ? cause.message : "The call could not be declined on the server.");
        console.warn("Could not transition the declined native call.", cause);
      }
      dismissedInvitationIdsRef.current.add(offer.invitationId);
    }
    try {
      await sendSignal(offer.conversationId, "call-hangup", {
        senderId: userId,
        recipientId: offer.senderId,
      });
    } catch (cause) {
      setCallError(cause instanceof Error ? cause.message : "The call could not be declined.");
    }
    void updateNativeCallHistory(offer.callId ?? null, {
      status: "declined",
      ended_at: new Date().toISOString(),
      duration_seconds: 0,
    }, [userId, offer.senderId]);
    updateIncomingCall(null);
    targetUserIdRef.current = null;
    targetConversationIdRef.current = null;
    callHistoryIdRef.current = null;
    invitationIdRef.current = null;
    invitationStatusRef.current = null;
    invitationExpiresAtRef.current = null;
    pendingCandidatesRef.current = [];
    incomingCandidateKeysRef.current.clear();
  }, [sendSignal, updateIncomingCall, userId]);

  const endCall = useCallback(async () => {
    const activeSession = sessionRef.current;
    if (!activeSession || !userId) return;
    const invitationId = invitationIdRef.current;
    if (invitationId) {
      try {
        const current = await getServerCallInvitation(invitationId);
        const transition = current.invitation.status === "accepted"
          ? "end"
          : current.invitation.status === "ringing"
            ? isInitiatorRef.current ? "cancel" : "decline"
            : null;
        if (transition) {
          invitationStatusRef.current = current.invitation.status === "accepted" ? "accepted" : "ringing";
          await transitionServerCallInvitation(
            invitationId,
            transition,
            `${transition}:${invitationId}`,
          );
        }
      } catch (cause) {
        setCallError(cause instanceof Error ? cause.message : "The call could not be ended on the server.");
        console.warn("Could not transition the ended native call.", cause);
      }
    }
    try {
      await sendSignal(activeSession.conversationId, "call-hangup", {
        senderId: userId,
        recipientId: activeSession.remoteUserId,
      });
    } catch (cause) {
      setCallError(cause instanceof Error ? cause.message : "The call could not be ended for the other person.");
    }
    updateHistoryForEnd(activeSession.status === "connected" ? "completed" : "missed");
    clearCall();
  }, [clearCall, sendSignal, updateHistoryForEnd, userId]);

  const toggleMute = useCallback(() => {
    const muted = !isMuted;
    setIsMuted(muted);
    isMutedRef.current = muted;
    localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !muted; });
  }, [isMuted]);

  const toggleCamera = useCallback(() => {
    const cameraOff = !isCameraOff;
    setIsCameraOff(cameraOff);
    localStreamRef.current?.getVideoTracks().forEach((track) => { track.enabled = !cameraOff; });
  }, [isCameraOff]);

  const toggleSpeaker = useCallback(() => {
    const speakerOn = !isSpeakerOn;
    setIsSpeakerOn(speakerOn);
    InCallManager.setForceSpeakerphoneOn(speakerOn);
  }, [isSpeakerOn]);

  const contextValue = useMemo(() => ({ startCall }), [startCall]);

  return (
    <NativeCallContext.Provider value={contextValue}>
      {children}
      <NativeCallOverlay
        error={callError}
        incomingCall={incomingCall}
        isCameraOff={isCameraOff}
        isMuted={isMuted}
        isSpeakerOn={isSpeakerOn}
        localStream={localStream}
        onAccept={() => void acceptCall()}
        onDecline={() => void declineCall()}
        onEnd={() => void endCall()}
        onToggleCamera={toggleCamera}
        onToggleMute={toggleMute}
        onToggleSpeaker={toggleSpeaker}
        remoteStream={remoteStream}
        session={callSession}
      />
    </NativeCallContext.Provider>
  );
}
