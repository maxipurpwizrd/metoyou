import { useCallback, useEffect, useRef, useState } from "react";
import { useConversationCall } from "./useConversationCall";
import { useMediaStream } from "./useMediaStream";
import usePeerCall from "./usePeerCall";
import type { CallSession } from "../types/call";

interface UseChatCallOptions {
  conversationId: string | null;
  userId: string | null;
  recipientId: string;
  recipientName: string;
  isUserOnline: (userId: string) => boolean;
  onSendError: (message: string) => void;
  onMissedCall: (callType: "audio" | "video", durationSeconds: number) => Promise<void>;
}

export function useChatCall({
  conversationId,
  userId,
  recipientId,
  recipientName,
  isUserOnline,
  onSendError,
  onMissedCall,
}: UseChatCallOptions) {
  const [activeCallSession, setActiveCallSession] = useState<CallSession | null>(null);
  const [incomingCallOffer, setIncomingCallOffer] = useState<{
    senderId: string;
    senderName: string;
    callType: "audio" | "video";
    sdp: RTCSessionDescriptionInit;
  } | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isRemoteAudioActive, setIsRemoteAudioActive] = useState(false);
  const [isRemoteVideoActive, setIsRemoteVideoActive] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteMediaStreamRef = useRef<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const activeCallTargetRef = useRef<string | null>(null);
  const callResponseTimeoutRef = useRef<number | null>(null);
  const outboundCallOfferTimestampRef = useRef<number | null>(null);
  const callRingingRef = useRef(false);
  const activeCallSessionRef = useRef<CallSession | null>(null);
  const incomingCallOfferRef = useRef<{
    senderId: string;
    senderName: string;
    callType: "audio" | "video";
    sdp: RTCSessionDescriptionInit;
  } | null>(null);
  const recipientNameRef = useRef(recipientName);

  const audioStream = useMediaStream({ audio: true, video: false });
  const videoStream = useMediaStream({ audio: true, video: true });
  const peerCall = usePeerCall();
  const { createAndAttach, setRemoteDescription, addIceCandidate, createOffer, createAnswer, setLocalDescription, close: closePeerConnection } = peerCall;

  const resetCallState = useCallback(() => {
    if (callResponseTimeoutRef.current) {
      window.clearTimeout(callResponseTimeoutRef.current);
      callResponseTimeoutRef.current = null;
    }

    outboundCallOfferTimestampRef.current = null;
    callRingingRef.current = false;
    setRemoteStream(null);
    setIsRemoteAudioActive(false);
    setIsRemoteVideoActive(false);
    setIsMuted(false);
    setIsCameraOff(false);

    try {
      closePeerConnection();
    } catch (err) {
      console.warn("resetCallState closePeerConnection failed", err);
    }

    activeCallTargetRef.current = null;
    setIncomingCallOffer(null);
  }, [closePeerConnection]);

  const cleanupLocalMedia = useCallback(() => {
    audioStream.stopStream();
    videoStream.stopStream();
  }, [audioStream, videoStream]);

  const { sendCallSignal } = useConversationCall({
    conversationId,
    userId,
    onOffer: async (eventPayload: any) => {
      if (activeCallSessionRef.current || incomingCallOfferRef.current || !eventPayload.sdp) {
        if (eventPayload.senderId && eventPayload.recipientId === userId) {
          await sendCallSignal("call-hangup", {
            senderId: userId,
            recipientId: eventPayload.senderId,
          });
        }
        return;
      }

      setIncomingCallOffer({
        senderId: eventPayload.senderId,
        senderName: eventPayload.senderName ?? recipientNameRef.current,
        callType: eventPayload.callType ?? "audio",
        sdp: eventPayload.sdp,
      });
    },
    onAnswer: async (eventPayload: any) => {
      if (!eventPayload?.sdp) return;
      try {
        await setRemoteDescription(eventPayload.sdp);
      } catch (err) {
        console.warn("onAnswer setRemoteDescription failed", err);
      }
    },
    onIceCandidate: async (eventPayload: any) => {
      if (!eventPayload?.candidate) return;
      try {
        await addIceCandidate(eventPayload.candidate);
      } catch (err) {
        console.warn("onIceCandidate addIceCandidate failed", err);
      }
    },
    onHangup: () => {
      resetCallState();
      setActiveCallSession(null);
      setIncomingCallOffer(null);
    },
  });

  useEffect(() => {
    recipientNameRef.current = recipientName;
  }, [recipientName]);

  useEffect(() => {
    activeCallSessionRef.current = activeCallSession;
  }, [activeCallSession]);

  useEffect(() => {
    incomingCallOfferRef.current = incomingCallOffer;
  }, [incomingCallOffer]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (!activeCallSession) {
      cleanupLocalMedia();
    }
  }, [activeCallSession, cleanupLocalMedia]);

  const handleAcceptIncomingCall = useCallback(async () => {
    if (!incomingCallOffer || !userId || !conversationId) return;

    const callType = incomingCallOffer.callType;
    const mediaStream = callType === "video" ? await videoStream.startStream() : await audioStream.startStream();
    localStreamRef.current = mediaStream;

    createAndAttach(mediaStream, {
      onIceCandidate: (candidate) => {
        void sendCallSignal("call-ice-candidate", {
          senderId: userId,
          recipientId: incomingCallOffer.senderId,
          candidate,
        });
      },
      onTrack: (event) => {
        const [incomingStream] = event.streams;
        if (!incomingStream) return;
        remoteMediaStreamRef.current = incomingStream;
        setRemoteStream(incomingStream);
        if (callType === "video") {
          setIsRemoteVideoActive(true);
        } else {
          setIsRemoteAudioActive(true);
        }
      },
      onConnectionStateChange: (state) => {
        if (state === "connected") {
          setActiveCallSession((current) =>
            current ? { ...current, status: "connected", startTime: current.startTime ?? new Date() } : current
          );
        }
      },
    });

    activeCallTargetRef.current = incomingCallOffer.senderId;
    setActiveCallSession({
      id: `call-${Date.now()}`,
      conversationId,
      callType,
      status: "ringing",
      startTime: undefined,
      remoteUserId: incomingCallOffer.senderId,
      remoteUsername: incomingCallOffer.senderName,
      remoteAvatarUrl: undefined,
    });
    setIsMuted(false);
    setIsCameraOff(callType === "video" ? false : isCameraOff);

    await setRemoteDescription(incomingCallOffer.sdp);
    const answer = await createAnswer();
    await setLocalDescription(answer);
    await sendCallSignal("call-answer", {
      senderId: userId,
      recipientId: incomingCallOffer.senderId,
      callType,
      sdp: answer,
    });

    setIncomingCallOffer(null);
  }, [addIceCandidate, audioStream, conversationId, createAndAttach, createAnswer, incomingCallOffer, isCameraOff, localStreamRef, sendCallSignal, setLocalDescription, setRemoteDescription, userId, videoStream]);

  const handleRejectIncomingCall = useCallback(async () => {
    if (!incomingCallOffer || !userId) return;
    await sendCallSignal("call-hangup", {
      senderId: userId,
      recipientId: incomingCallOffer.senderId,
    });
    setIncomingCallOffer(null);
  }, [incomingCallOffer, sendCallSignal, userId]);

  const startCall = useCallback(async (callType: "audio" | "video") => {
    if (!userId || !recipientId || !conversationId) return;

    const mediaStream = callType === "video" ? await videoStream.startStream() : await audioStream.startStream();
    localStreamRef.current = mediaStream;

    createAndAttach(mediaStream, {
      onIceCandidate: (candidate) => {
        void sendCallSignal("call-ice-candidate", {
          senderId: userId,
          recipientId,
          candidate,
        });
      },
      onTrack: (event) => {
        const [incomingStream] = event.streams;
        if (!incomingStream) return;
        remoteMediaStreamRef.current = incomingStream;
        setRemoteStream(incomingStream);
        if (callType === "video") {
          setIsRemoteVideoActive(true);
        } else {
          setIsRemoteAudioActive(true);
        }
      },
      onConnectionStateChange: (state) => {
        if (state === "connected") {
          if (callResponseTimeoutRef.current) {
            window.clearTimeout(callResponseTimeoutRef.current);
            callResponseTimeoutRef.current = null;
          }

          setActiveCallSession((current) =>
            current ? { ...current, status: "connected", startTime: current.startTime ?? new Date() } : current
          );
          callRingingRef.current = false;
          if (callType === "video") {
            setIsRemoteVideoActive(true);
          } else {
            setIsRemoteAudioActive(true);
          }
        }
      },
    });

    activeCallTargetRef.current = recipientId;
    const callSession: CallSession = {
      id: `call-${Date.now()}`,
      conversationId,
      callType,
      status: "ringing",
      startTime: undefined,
      remoteUserId: recipientId,
      remoteUsername: recipientName,
      remoteAvatarUrl: undefined,
    };

    setActiveCallSession(callSession);
    callRingingRef.current = true;
    setIsMuted(false);
    setIsCameraOff(callType === "video" ? false : isCameraOff);

    const offer = await createOffer();
    await setLocalDescription(offer);
    outboundCallOfferTimestampRef.current = Date.now();
    await sendCallSignal("call-offer", {
      senderId: userId,
      recipientId,
      callType,
      sdp: offer,
    });

    if (callResponseTimeoutRef.current) {
      window.clearTimeout(callResponseTimeoutRef.current);
    }

    callResponseTimeoutRef.current = window.setTimeout(async () => {
      if (activeCallTargetRef.current !== recipientId) return;
      if (!callRingingRef.current) return;

      const durationSeconds = Math.round(
        (Date.now() - (outboundCallOfferTimestampRef.current ?? Date.now())) / 1000
      );
      await onMissedCall(callType, durationSeconds);

      await sendCallSignal("call-hangup", {
        senderId: userId,
        recipientId,
      });
      cleanupLocalMedia();
      setActiveCallSession(null);
      resetCallState();
      onSendError("Call ended because the other user did not answer.");
    }, 145000);
  }, [activeCallTargetRef, audioStream, cleanupLocalMedia, conversationId, createAndAttach, createOffer, isCameraOff, isUserOnline, onMissedCall, onSendError, recipientId, recipientName, resetCallState, sendCallSignal, setLocalDescription, userId, videoStream]);

  const handleStartAudioCall = useCallback(() => startCall("audio"), [startCall]);
  const handleStartVideoCall = useCallback(() => startCall("video"), [startCall]);

  const handleToggleMute = useCallback(() => {
    setIsMuted((value) => {
      const newValue = !value;
      if (activeCallSession?.callType === "audio") {
        audioStream.toggleAudio(!newValue);
      } else if (activeCallSession?.callType === "video") {
        videoStream.toggleAudio(!newValue);
      }
      return newValue;
    });
  }, [activeCallSession, audioStream, videoStream]);

  const handleToggleCamera = useCallback(() => {
    setIsCameraOff((value) => {
      const newValue = !value;
      videoStream.toggleVideo(!newValue);
      return newValue;
    });
  }, [videoStream]);

  const handleEndCall = useCallback(async () => {
    if (callResponseTimeoutRef.current) {
      window.clearTimeout(callResponseTimeoutRef.current);
      callResponseTimeoutRef.current = null;
    }

    if (userId && activeCallTargetRef.current) {
      await sendCallSignal("call-hangup", {
        senderId: userId,
        recipientId: activeCallTargetRef.current,
      });
    }

    cleanupLocalMedia();
    setActiveCallSession(null);
    resetCallState();
  }, [cleanupLocalMedia, resetCallState, sendCallSignal, userId]);

  useEffect(() => {
    return () => {
      if (callResponseTimeoutRef.current) {
        window.clearTimeout(callResponseTimeoutRef.current);
      }
      cleanupLocalMedia();
      resetCallState();
    };
  }, [cleanupLocalMedia, resetCallState]);

  return {
    activeCallSession,
    incomingCallOffer,
    isMuted,
    isCameraOff,
    isRemoteAudioActive,
    isRemoteVideoActive,
    remoteStream,
    localVideoRef,
    remoteVideoRef,
    remoteMediaStreamRef,
    localStreamRef,
    setActiveCallSession,
    setIncomingCallOffer,
    setIsMuted,
    setIsCameraOff,
    setIsRemoteAudioActive,
    setIsRemoteVideoActive,
    setRemoteStream,
    handleAcceptIncomingCall,
    handleRejectIncomingCall,
    handleStartAudioCall,
    handleStartVideoCall,
    handleToggleMute,
    handleToggleCamera,
    handleEndCall,
    resetCallState,
    createOffer,
    createAnswer,
    setRemoteDescription,
    addIceCandidate,
    setLocalDescription,
    sendCallSignal,
    closePeerConnection,
    startCall,
  };
}
