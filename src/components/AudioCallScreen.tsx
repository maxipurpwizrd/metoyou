import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Phone, Volume2, Volume, Loader } from 'lucide-react';
import type { CallSession } from '../types/call';

interface AudioCallScreenProps {
  session: CallSession;
  isRemoteAudioActive: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onEndCall: () => void;
}

export default function AudioCallScreen({
  session,
  isRemoteAudioActive,
  isMuted,
  onToggleMute,
  onEndCall,
}: AudioCallScreenProps) {
  const [callDuration, setCallDuration] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'poor' | 'disconnected'>('connected');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  // Call timer
  useEffect(() => {
    if (!session.startTime) return;
    
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const start = new Date(session.startTime!).getTime();
      const duration = Math.floor((now - start) / 1000);
      setCallDuration(duration);
    }, 1000);

    return () => clearInterval(interval);
  }, [session.startTime]);

  // Audio visualizer animation
  useEffect(() => {
    if (!canvasRef.current || !isRemoteAudioActive) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bars = 6;
    const barWidth = canvas.width / (bars * 2);

    const drawBars = () => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = 'rgba(139, 92, 246, 0.8)';
      
      for (let i = 0; i < bars; i++) {
        const height = Math.random() * (canvas.height * 0.6) + canvas.height * 0.2;
        const x = i * barWidth * 2 + barWidth * 0.25;
        const y = (canvas.height - height) / 2;
        ctx.fillRect(x, y, barWidth, height);
      }

      animationRef.current = requestAnimationFrame(drawBars);
    };

    animationRef.current = requestAnimationFrame(drawBars);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRemoteAudioActive]);

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connecting':
        return 'text-blue-400';
      case 'connected':
        return 'text-green-400';
      case 'poor':
        return 'text-yellow-400';
      case 'disconnected':
        return 'text-red-400';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return 'Connected';
      case 'poor':
        return 'Poor connection';
      case 'disconnected':
        return 'Disconnected';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-linear-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Background blur effect */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500 blur-[120px]"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-500 blur-[120px]"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full gap-8 p-6">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-purple-400/50 shadow-lg">
            {session.remoteAvatarUrl ? (
              <img
                src={session.remoteAvatarUrl}
                alt={session.remoteUsername}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-linear-to-br from-purple-400 to-blue-500 flex items-center justify-center text-white text-3xl font-bold">
                {session.remoteUsername?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            {isRemoteAudioActive && (
              <div className="absolute inset-0 border-4 border-green-400 rounded-full animate-pulse"></div>
            )}
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white text-center">{session.remoteUsername || 'User'}</h2>
            <p className={`text-sm text-center mt-1 ${getStatusColor()}`}>{getStatusText()}</p>
          </div>
        </div>

        {/* Audio Visualizer */}
        {isRemoteAudioActive && (
          <div className="w-full max-w-xs">
            <canvas
              ref={canvasRef}
              width={300}
              height={80}
              className="w-full h-20 rounded-lg bg-white/5 border border-white/10"
            />
          </div>
        )}

        {/* Call Duration */}
        <div className="text-4xl font-bold text-white font-mono">
          {formatDuration(callDuration)}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          {/* Mute Button */}
          <button
            onClick={onToggleMute}
            className={`p-4 rounded-full transition-all transform hover:scale-110 ${
              isMuted
                ? 'bg-red-500/80 hover:bg-red-600 shadow-lg shadow-red-500/50'
                : 'bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <MicOff className="w-6 h-6 text-white" />
            ) : (
              <Mic className="w-6 h-6 text-white" />
            )}
          </button>

          {/* Speaker Button */}
          <button
            className="p-4 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 transition-all transform hover:scale-110"
            title="Speaker"
          >
            <Volume2 className="w-6 h-6 text-white" />
          </button>

          {/* End Call Button */}
          <button
            onClick={onEndCall}
            className="p-4 rounded-full bg-red-500/80 hover:bg-red-600 transition-all transform hover:scale-110 shadow-lg shadow-red-500/50"
            title="End call"
          >
            <Phone className="w-6 h-6 text-white transform rotate-135" />
          </button>

          {/* Connection Quality Indicator */}
          <button
            className="p-4 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 transition-all transform hover:scale-110"
            title="Connection quality"
          >
            {connectionStatus === 'connecting' ? (
              <Loader className="w-6 h-6 text-white animate-spin" />
            ) : (
              <Volume className="w-6 h-6 text-white" />
            )}
          </button>
        </div>

        {/* Calling indicator (for ringing state) */}
        {session.status === 'ringing' && (
          <div className="flex items-center gap-2 text-white/70">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
            <span className="text-sm">Ringing...</span>
          </div>
        )}
      </div>
    </div>
  );
}
