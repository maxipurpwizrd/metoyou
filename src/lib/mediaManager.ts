let currentAudio: HTMLAudioElement | null = null;

export const MediaManager = {
  play: async (audioElement: HTMLAudioElement) => {
    if (!audioElement) return;

    if (currentAudio && currentAudio !== audioElement) {
      currentAudio.pause();
    }

    currentAudio = audioElement;

    try {
      await audioElement.play();
    } catch (error) {
      console.warn("MediaManager: unable to autoplay audio", error);
    }
  },

  stop: (audioElement: HTMLAudioElement | null) => {
    if (!audioElement) return;

    if (currentAudio === audioElement) {
      currentAudio.pause();
      currentAudio = null;
      return;
    }

    audioElement.pause();
  },
};
