import { Mic, Video } from 'lucide-react';
import { useLanguage } from "../contexts/LanguageContext";

interface CallControlsProps {
  conversationId: string;
  remoteUserId: string;
  remoteUsername?: string;
  remoteAvatarUrl?: string;
  onStartAudioCall: () => void;
  onStartVideoCall: () => void;
  disabled?: boolean;
}

export default function CallControls({
  onStartAudioCall,
  onStartVideoCall,
  disabled = false,
}: CallControlsProps) {
  const { t } = useLanguage();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onStartAudioCall}
        disabled={disabled}
        className="p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 transition-all transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
        title={t("calls.startAudio")}
      >
        <Mic className="w-5 h-5 text-white" />
      </button>

      <button
        onClick={onStartVideoCall}
        disabled={disabled}
        className="p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 transition-all transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
        title={t("calls.startVideo")}
      >
        <Video className="w-5 h-5 text-white" />
      </button>
    </div>
  );
}
