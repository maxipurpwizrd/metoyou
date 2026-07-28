const DEFAULT_ICE_SERVERS = [{ urls: ["stun:stun.l.google.com:19302"] }];

export function createPeerConnection(iceServers = DEFAULT_ICE_SERVERS): RTCPeerConnection {
  if (typeof window === "undefined" || typeof window.RTCPeerConnection === "undefined") {
    throw new Error("WebRTC is not supported in this browser");
  }

  return new window.RTCPeerConnection({ iceServers });
}

export function attachLocalStreamToPeerConnection(peerConnection: RTCPeerConnection, stream: MediaStream) {
  stream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, stream);
  });
}

export async function startCamera() {
  if (!navigator?.mediaDevices?.getUserMedia) {
    throw new Error("Camera not supported");
  }
  return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
}

export async function stopCamera(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export async function shareMicrophone() {
  if (!navigator?.mediaDevices?.getUserMedia) {
    throw new Error("Microphone not supported");
  }
  return navigator.mediaDevices.getUserMedia({ audio: true });
}

export async function recordSession() {
  return null;
}
