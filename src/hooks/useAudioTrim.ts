import { useCallback, useRef, useState } from "react";

export function useAudioTrim() {
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [audioTrimStart, setAudioTrimStart] = useState(0);
  const [audioTrimEnd, setAudioTrimEnd] = useState(35);
  const audioChunksRef = useRef<Blob[]>([]);
  const [audioSelectionError, setAudioSelectionError] = useState<string | null>(null);

  const getAudioDuration = useCallback(async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) throw new Error("Audio playback is not supported in this browser");

    const audioContext = new AudioContextCtor();
    try {
      const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      return decoded.duration;
    } finally {
      await audioContext.close();
    }
  }, []);

  const createTrimmedAudioBlob = useCallback(async (file: File, start: number, end: number) => {
    const arrayBuffer = await file.arrayBuffer();
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) throw new Error("Audio playback is not supported in this browser");

    const audioContext = new AudioContextCtor();
    try {
      const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      const safeStart = Math.max(0, Math.min(start, decoded.duration));
      const safeEnd = Math.max(safeStart + 0.1, Math.min(end, decoded.duration));
      const duration = safeEnd - safeStart;

      const offlineContext = new OfflineAudioContext(decoded.numberOfChannels, Math.max(1, Math.floor(duration * decoded.sampleRate)), decoded.sampleRate);
      const source = offlineContext.createBufferSource();
      source.buffer = decoded;
      source.connect(offlineContext.destination);
      source.start(0, safeStart, duration);
      const rendered = await offlineContext.startRendering();

      const wavBuffer = new ArrayBuffer(44 + rendered.length * rendered.numberOfChannels * 2);
      const view = new DataView(wavBuffer);
      const writeString = (offset: number, value: string) => {
        for (let i = 0; i < value.length; i += 1) {
          view.setUint8(offset + i, value.charCodeAt(i));
        }
      };

      writeString(0, "RIFF");
      view.setUint32(4, 36 + rendered.length * rendered.numberOfChannels * 2, true);
      writeString(8, "WAVE");
      writeString(12, "fmt ");
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, rendered.numberOfChannels, true);
      view.setUint32(24, rendered.sampleRate, true);
      view.setUint32(28, rendered.sampleRate * rendered.numberOfChannels * 2, true);
      view.setUint16(32, rendered.numberOfChannels * 2, true);
      view.setUint16(34, 16, true);
      writeString(36, "data");
      view.setUint32(40, rendered.length * rendered.numberOfChannels * 2, true);

      let offset = 44;
      for (let i = 0; i < rendered.length; i += 1) {
        for (let channel = 0; channel < rendered.numberOfChannels; channel += 1) {
          const sample = Math.max(-1, Math.min(1, rendered.getChannelData(channel)[i]));
          view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
          offset += 2;
        }
      }

      return new Blob([wavBuffer], { type: "audio/wav" });
    } finally {
      await audioContext.close();
    }
  }, []);

  const handleAudioSelection = useCallback(async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      setAudioSelectionError("Audio files must be smaller than 20MB.");
      return null;
    }

    try {
      setAudioSelectionError(null);
      const duration = await getAudioDuration(file);
      setAudioDuration(duration);
      setAudioTrimStart(0);
      setAudioTrimEnd(Math.min(35, Math.ceil(duration)));
      return file;
    } catch (err) {
      console.error("Failed to process audio", err);
      setAudioSelectionError("Unable to read audio file.");
      return null;
    }
  }, [getAudioDuration]);

  return {
    audioDuration,
    audioTrimStart,
    audioTrimEnd,
    setAudioTrimStart,
    setAudioTrimEnd,
    audioChunksRef,
    audioSelectionError,
    setAudioSelectionError,
    getAudioDuration,
    createTrimmedAudioBlob,
    handleAudioSelection,
  };
}
