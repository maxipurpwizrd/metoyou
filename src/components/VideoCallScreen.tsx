import { useState, useEffect, type RefObject } from 'react';
import { Mic, MicOff, Phone, Volume2, Video, VideoOff, Loader } from 'lucide-react';
import type { CallSession } from '../types/call';

interface VideoCallScreenProps {
  session: CallSession;
  localVideoRef: RefObject<HTMLVideoElement | null>;
  remoteVideoRef: RefObject<HTMLVideoElement | null>;
  isRemoteVideoActive: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onEndCall: () => void;
}

export default function VideoCallScreen({
  session,
  localVideoRef,
  remoteVideoRef,
  isRemoteVideoActive,
  isMuted,
  isCameraOff,
  onToggleMute,
  onToggleCamera,
  onEndCall,
}: VideoCallScreenProps) {
  const [callDuration, setCallDuration] = useState(0);
  const [connectionStatus] = useState<'connecting' | 'connected' | 'poor' | 'disconnected'>('connected');

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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black">
      {/* Remote Video (Background) */}
      <div className="absolute inset-0 bg-black overflow-hidden">
        {isRemoteVideoActive ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-slate-900 to-slate-800">
            <div className="flex flex-col items-center gap-4">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-purple-400/50 shadow-lg">
                {session.remoteAvatarUrl ? (
                  <img
                    src={session.remoteAvatarUrl}
                    alt={session.remoteUsername}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-linear-to-br from-purple-400 to-blue-500 flex items-center justify-center text-white text-4xl font-bold">
                    {session.remoteUsername?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
              </div>
              <p className="text-white text-lg font-semibold">{session.remoteUsername || 'User'}</p>
              <p className={`text-sm ${getStatusColor()}`}>{getStatusText()}</p>
            </div>
          </div>
        )}
      </div>

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-linear-to-t from-black via-transparent to-transparent pointer-events-none"></div>

      {/* Local Video (Picture-in-Picture) */}
      {!isCameraOff && (
        <div className="absolute bottom-24 right-6 w-28 h-40 rounded-lg overflow-hidden border-2 border-white/20 shadow-lg hover:shadow-xl transition-shadow">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform scale-x-[-1]"
          />
        </div>
      )}

      {/* Camera off indicator */}
      {isCameraOff && (
        <div className="absolute bottom-24 right-6 w-28 h-40 rounded-lg overflow-hidden border-2 border-white/20 shadow-lg bg-black flex items-center justify-center">
          <VideoOff className="w-8 h-8 text-white/50" />
        </div>
      )}

      {/* Top info bar */}
      <div className="absolute top-6 left-0 right-0 flex items-center justify-center z-20">
        <div className="text-center">
          <p className={`text-sm font-semibold ${getStatusColor()}`}>{getStatusText()}</p>
          <p className="text-3xl font-bold text-white font-mono mt-1">{formatDuration(callDuration)}</p>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-4 z-20">
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

        {/* Camera Button */}
        <button
          onClick={onToggleCamera}
          className={`p-4 rounded-full transition-all transform hover:scale-110 ${
            isCameraOff
              ? 'bg-red-500/80 hover:bg-red-600 shadow-lg shadow-red-500/50'
              : 'bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20'
          }`}
          title={isCameraOff ? 'Turn on camera' : 'Turn off camera'}
        >
          {isCameraOff ? (
            <VideoOff className="w-6 h-6 text-white" />
          ) : (
            <Video className="w-6 h-6 text-white" />
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
            <Volume2 className="w-6 h-6 text-white" />
          )}
        </button>
      </div>

      {/* Calling indicator (for ringing state) */}
      {session.status === 'ringing' && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 flex items-center gap-2 text-white/70">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
          <span className="text-sm">Ringing...</span>
        </div>
      )}
    </div>
  );
}
