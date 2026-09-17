import { useEffect, useRef, useState } from "react";

const MAX_RECORDING_SECONDS = 15;

export function useVoiceCommentRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const voiceUrlRef = useRef<string | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const clearVoiceUrl = () => {
    if (voiceUrlRef.current) {
      URL.revokeObjectURL(voiceUrlRef.current);
      voiceUrlRef.current = null;
    }
    setVoiceUrl(null);
    setRecordingDuration(0);
  };

  const stopRecording = () => {
    if (!recorderRef.current || recorderRef.current.state === "inactive") return;

    recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    clearTimer();
    setIsRecording(false);
  };

  const startRecording = async () => {
    if (isRecording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      clearVoiceUrl();
      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || "audio/webm" });
        const nextUrl = URL.createObjectURL(blob);
        voiceUrlRef.current = nextUrl;
        setVoiceUrl(nextUrl);
      };

      recorder.start();
      setRecordingDuration(0);
      setIsRecording(true);
      timerRef.current = window.setInterval(() => {
        setRecordingDuration((current) => {
          if (current + 1 >= MAX_RECORDING_SECONDS) stopRecording();
          return current + 1;
        });
      }, 1000);
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setIsRecording(false);
      window.alert("Microphone access denied.");
    }
  };

  useEffect(() => () => {
    clearTimer();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (voiceUrlRef.current) URL.revokeObjectURL(voiceUrlRef.current);
  }, []);

  return {
    isRecording,
    recordingDuration,
    voiceUrl,
    startRecording,
    stopRecording,
    clearVoiceUrl,
  };
}