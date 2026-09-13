import { getUserPrefs } from "./userPrefs";

let messageAudio: HTMLAudioElement | null = null;
let lastPlayedAt = 0;
let unlockInstalled = false;

function getMessageAudio() {
  messageAudio ??= new Audio("/Messagetone.mp3");
  messageAudio.preload = "auto";
  return messageAudio;
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

if (typeof window !== "undefined" && !unlockInstalled) {
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
  if (typeof window === "undefined" || getUserPrefs().messageSound === false) return;

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
