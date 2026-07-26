import { useState, useEffect, useRef, useCallback } from 'react';

interface UseMediaStreamOptions {
  audio?: boolean;
  video?: boolean;
}

export function useMediaStream(options: UseMediaStreamOptions = { audio: true, video: false }) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  const startStream = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: options.audio ? { echoCancellation: true, noiseSuppression: true } : false,
        video: options.video ? { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } : false,
      });
      
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsLoading(false);
      return mediaStream;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to get media stream');
      setError(error);
      setIsLoading(false);
      throw error;
    }
  }, [options.audio, options.video]);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
      setStream(null);
    }
  }, []);

  const toggleAudio = useCallback((enabled: boolean) => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }, []);

  const toggleVideo = useCallback((enabled: boolean) => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }, []);

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  return {
    stream,
    error,
    isLoading,
    startStream,
    stopStream,
    toggleAudio,
    toggleVideo,
  };
}
