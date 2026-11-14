import { getUserPrefs } from "./userPrefs";
import { Platform } from "react-native";

const MESSAGE_SOUND_URLS = ["/Messagestone.mp3", "/Messagetone.mp3"];
const CALL_SOUND_URLS = ["/Ringtone.mp3"];

export function getMessageSoundUrl() {
  return MESSAGE_SOUND_URLS[0];
}

export function getCallSoundUrl() {
  return CALL_SOUND_URLS[0];
}

let messageAudio: HTMLAudioElement | null = null;
let callAudio: HTMLAudioElement | null = null;
let lastPlayedAt = 0;
let unlockInstalled = false;

function hasBrowserAudio() {
  return Platform.OS === "web" && typeof window !== "undefined" && typeof Audio === "function";
}

function getMessageAudio() {
  messageAudio ??= new Audio(getMessageSoundUrl());
  messageAudio.preload = "auto";
  return messageAudio;
}

function getCallAudio() {
  callAudio ??= new Audio(getCallSoundUrl());
  callAudio.preload = "auto";
  callAudio.loop = true;
  return callAudio;
}

function unlockMessageAudio() {
  if (getUserPrefs().messageSound === false) return;

  const audio = getMessageAudio();
  audio.muted = true;
  void audio.play().then(() => {
    audio.pause();
    audio.currentTime = 0;
    audio.muted = false;
  }).catch(() => {
    audio.muted = false;
  });
}

if (
  Platform.OS === "web"
  && typeof window !== "undefined"
  && typeof window.addEventListener === "function"
  && typeof window.removeEventListener === "function"
  && typeof Audio === "function"
  && !unlockInstalled
) {
  unlockInstalled = true;
  const unlock = () => {
    unlockMessageAudio();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true, passive: true });
  window.addEventListener("keydown", unlock, { once: true });
}

export function playMessageNotificationSound() {
  if (!hasBrowserAudio() || getUserPrefs().messageSound === false) return;

  const now = Date.now();
  if (now - lastPlayedAt < 250) return;
  lastPlayedAt = now;

  try {
    const audio = getMessageAudio();
    audio.muted = false;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Browsers may block sound until the user interacts with the page.
    });
  } catch {
    // Keep notifications usable when audio is unavailable.
  }
}

export function playCallRingtone() {
  if (!hasBrowserAudio() || getUserPrefs().callSound === false) return;

  try {
    const audio = getCallAudio();
    audio.muted = false;
    audio.loop = true;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Browsers may block sound until the user interacts with the page.
    });
  } catch {
    // Keep calls usable when audio is unavailable.
  }
}

export function stopCallRingtone() {
  if (!hasBrowserAudio() || !callAudio) return;
  callAudio.pause();
  callAudio.currentTime = 0;
}
