import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { supabase } from "../lib/supabase";

interface UseChatAttachmentsOptions {
  conversationId: string | null;
  userId: string | null;
}

export function useChatAttachments({ conversationId, userId }: UseChatAttachmentsOptions) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<number | null>(null);

  const uploadFileWithProgress = useCallback(async (file: File, path: string, onProgress: (value: number) => void) => {
    let uploadBlob: Blob | File = file;
    try {
      if (file.type.startsWith("image/")) {
        const { optimizeImageFile } = await import("../lib/imageUtils");
        uploadBlob = await optimizeImageFile(file, 1200, 0.8);
      }
    } catch (e) {
      console.warn("Image optimization failed, uploading original file", e);
      uploadBlob = file;
    }

    const { data: signedData, error: signError } = await supabase.storage.from("messages").createSignedUploadUrl(path);
    if (signError || !signedData?.signedUrl) {
      throw signError ?? new Error("Failed to create signed upload URL");
    }

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", signedData.signedUrl);
      if (uploadBlob && (uploadBlob as Blob).type) {
        xhr.setRequestHeader("Content-Type", (uploadBlob as Blob).type);
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(100);
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.send(uploadBlob);
    });
  }, []);

  const handleAttachmentClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    if (!conversationId || !userId) {
      alert("Conversation not ready");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (!file.type.startsWith("image/")) {
      setSelectedFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setSelectedFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [conversationId, userId]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaStreamRef.current = stream;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        try {
          const url = URL.createObjectURL(blob);
          setAudioPreviewUrl(url);
        } catch (err) {
          console.warn("audio preview creation failed", err);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecordingDuration(0);
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
      }
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
      setIsRecording(true);
    } catch (err) {
      console.error(err);
      alert("Microphone access denied");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    mediaRecorderRef.current?.stop();
    try {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    } catch (err) {
      console.warn("stopping audio stream failed", err);
    }
    mediaStreamRef.current = null;
    setIsRecording(false);
  }, []);

  const clearRecording = useCallback(() => {
    if (audioPreviewUrl) {
      try {
        URL.revokeObjectURL(audioPreviewUrl);
      } catch (err) {
        console.warn("audio preview cleanup failed", err);
      }
    }
    setAudioPreviewUrl(null);
    setAudioBlob(null);
    setRecordingDuration(0);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [audioPreviewUrl]);

  const togglePlayPreview = useCallback(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    if (isPlaying) {
      audioEl.pause();
    } else {
      audioEl.play().catch(() => {});
    }
  }, [isPlaying]);

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    audioEl.addEventListener("play", onPlay);
    audioEl.addEventListener("pause", onPause);
    audioEl.addEventListener("ended", onEnded);
    return () => {
      audioEl.removeEventListener("play", onPlay);
      audioEl.removeEventListener("pause", onPause);
      audioEl.removeEventListener("ended", onEnded);
    };
  }, []);

  useEffect(() => {
    const url = audioPreviewUrl;
    const canvas = waveRef.current;
    if (!url || !canvas) return;

    let audioCtx: AudioContext | null = null;
    let cancelled = false;

    fetch(url)
      .then((response) => response.arrayBuffer())
      .then((arrayBuffer) => {
        if (cancelled) return;
        const AudioContextConstructor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextConstructor) {
          return;
        }
        audioCtx = new AudioContextConstructor();
        return audioCtx.decodeAudioData(arrayBuffer);
      })
      .then((audioBuffer) => {
        if (cancelled || !audioBuffer) return;
        const rawData = audioBuffer.getChannelData(0);
        const canvasCtx = canvas.getContext("2d");
        if (!canvasCtx) return;
        const width = (canvas.width = Math.max(200, canvas.clientWidth));
        const height = (canvas.height = 40);
        canvasCtx.clearRect(0, 0, width, height);
        canvasCtx.fillStyle = "rgba(255,255,255,0.12)";
        const blockSize = Math.floor(rawData.length / width) || 1;
        for (let i = 0; i < width; i++) {
          let sum = 0;
          const start = i * blockSize;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(rawData[start + j] || 0);
          }
          const avg = sum / blockSize;
          const barHeight = Math.min(height, avg * height * 10);
          const y = (height - barHeight) / 2;
          canvasCtx.fillRect(i, y, 1, barHeight);
        }
      })
      .catch((err) => {
        console.warn("waveform err", err);
      })
      .finally(() => {
        if (audioCtx) {
          try {
            audioCtx.close();
          } catch (err) {
            console.warn("waveform cleanup failed", err);
          }
        }
      });

    return () => {
      cancelled = true;
      if (audioCtx) {
        try {
          audioCtx.close();
        } catch (err) {
          console.warn("waveform cleanup failed", err);
        }
      }
    };
  }, [audioPreviewUrl]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      if (audioPreviewUrl) {
        try {
          URL.revokeObjectURL(audioPreviewUrl);
        } catch (err) {
          console.warn("audio preview cleanup failed", err);
        }
      }
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
      }
      mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [audioPreviewUrl]);

  return {
    selectedFile,
    setSelectedFile,
    previewUrl,
    setPreviewUrl,
    uploadProgress,
    setUploadProgress,
    isRecording,
    recordingDuration,
    audioBlob,
    setAudioBlob,
    audioPreviewUrl,
    setAudioPreviewUrl,
    isPlaying,
    fileInputRef,
    waveRef,
    audioRef,
    uploadFileWithProgress,
    handleAttachmentClick,
    handleFileSelect,
    startRecording,
    stopRecording,
    clearRecording,
    togglePlayPreview,
  };
}
