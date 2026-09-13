import { useRef, useCallback } from "react";
import { createPeerConnection, attachLocalStreamToPeerConnection } from "../lib/webrtc";

export function usePeerCall() {
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pendingIceCandidatesRef = useRef<any[]>([]);

  const createAndAttach = useCallback((localStream: MediaStream | null, handlers: {
    onIceCandidate?: (candidate: any) => void;
    onTrack?: (event: RTCTrackEvent) => void;
    onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  }) => {
    if (!localStream) return null;
    const pc = createPeerConnection();
    peerConnectionRef.current = pc;

    attachLocalStreamToPeerConnection(pc, localStream);

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      try {
        handlers.onIceCandidate?.(event.candidate.toJSON());
      } catch (err) {
        console.warn("usePeerCall onicecandidate handler error", err);
      }
    };

    pc.ontrack = (event) => {
      try {
        handlers.onTrack?.(event);
      } catch (err) {
        console.warn("usePeerCall ontrack handler error", err);
      }
    };

    pc.onconnectionstatechange = () => {
      try {
        handlers.onConnectionStateChange?.(pc.connectionState);
      } catch (err) {
        console.warn("usePeerCall connectionstate handler error", err);
      }
    };

    return pc;
  }, []);

  const setRemoteDescription = useCallback(async (sdp: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) return;
    try {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
      // flush any pending candidates
      while (pendingIceCandidatesRef.current.length > 0) {
        const cand = pendingIceCandidatesRef.current.shift();
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(cand));
        } catch (err) {
          console.warn("usePeerCall addIceCandidate failed while flushing", err);
        }
      }
    } catch (err) {
      console.warn("usePeerCall setRemoteDescription failed", err);
      throw err;
    }
  }, []);

  const addIceCandidate = useCallback(async (candidate: any) => {
    if (!candidate) return;
    if (!peerConnectionRef.current) {
      pendingIceCandidatesRef.current.push(candidate);
      return;
    }
    try {
      await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      // queue if it cannot be added yet
      pendingIceCandidatesRef.current.push(candidate);
      console.warn("usePeerCall addIceCandidate queued", err);
    }
  }, []);

  const createOffer = useCallback(async () => {
    if (!peerConnectionRef.current) throw new Error("PeerConnection not initialized");
    return peerConnectionRef.current.createOffer();
  }, []);

  const createAnswer = useCallback(async () => {
    if (!peerConnectionRef.current) throw new Error("PeerConnection not initialized");
    return peerConnectionRef.current.createAnswer();
  }, []);

  const setLocalDescription = useCallback(async (desc: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) throw new Error("PeerConnection not initialized");
    return peerConnectionRef.current.setLocalDescription(desc as any);
  }, []);

  const close = useCallback(() => {
    const pc = peerConnectionRef.current;
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      try {
        pc.close();
      } catch (err) {
        console.warn("usePeerCall close error", err);
      }
      peerConnectionRef.current = null;
    }
    pendingIceCandidatesRef.current = [];
  }, []);

  return {
    peerConnectionRef,
    createAndAttach,
    setRemoteDescription,
    addIceCandidate,
    createOffer,
    createAnswer,
    setLocalDescription,
    close,
  };
}

export default usePeerCall;
