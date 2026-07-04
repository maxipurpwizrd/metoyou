export async function createPeerConnection() {
  console.log("createPeerConnection");
  return null;
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
  console.log("recordSession");
  return null;
}
