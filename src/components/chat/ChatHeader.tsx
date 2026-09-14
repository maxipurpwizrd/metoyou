import { Link } from "react-router-dom";

interface ChatHeaderProps {
  recipientName: string;
  recipientId: string;
  typingUsers: string[];
  chatPresenceReady: boolean;
  isUserOnline: (userId: string) => boolean;
  isVibesPro: boolean;
  searchQuery: string;
  showSearchBar: boolean;
  onSearchChange: (value: string) => void;
  onAudioCall: () => void;
  onVideoCall: () => void;
  onNavigateToProfile: (name: string) => void;
}

export function ChatHeader({
  recipientName,
  recipientId,
  typingUsers,
  chatPresenceReady,
  isUserOnline,
  isVibesPro,
  searchQuery,
  showSearchBar,
  onSearchChange,
  onAudioCall,
  onVideoCall,
  onNavigateToProfile,
}: ChatHeaderProps) {
  const headerClassName = isVibesPro
    ? "fixed top-0 left-0 right-0 z-50 bg-[#111111]/95 p-3 md:p-6 border-b border-[#D4AF37]/20 shadow-[0_0_40px_rgba(212,175,55,0.12)]"
    : "fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-xl p-3 md:p-6 border-b border-white/70 shadow-[0_10px_35px_rgba(236,72,153,0.08)]";

  const headerCardClassName = isVibesPro
    ? "bg-[#181818]/90 backdrop-blur-3xl border border-[#D4AF37]/20 rounded-[28px] p-3 shadow-[0_0_24px_rgba(212,175,55,0.12)] flex flex-col gap-3"
    : "bg-white/80 backdrop-blur-3xl border border-white/80 rounded-[28px] p-3 shadow-[0_10px_40px_rgba(168,85,247,0.12)] flex flex-col gap-3";

  const headerSubtextClassName = isVibesPro ? "text-[#EBD39A]/70" : "text-slate-600";
  const panelClassName = isVibesPro
    ? "rounded-2xl border border-[#D4AF37]/20 bg-[#181818]/80 px-3 py-2 backdrop-blur-xl"
    : "rounded-2xl border border-sky-100 bg-white/90 px-3 py-2 backdrop-blur-xl shadow-sm";

  return (
    <div className={headerClassName}>
      <div className="max-w-xl mx-auto">
        <div className={headerCardClassName}>
          <div className="flex items-center gap-3">
            <Link
              to="/messages"
              className={`text-lg font-bold hover:scale-[1.05] transition ${isVibesPro ? "text-white" : "text-slate-800"}`}
            >
              ←
            </Link>

            <div className={`grid place-items-center w-10 h-10 rounded-[20px] ${isVibesPro ? "bg-linear-to-r from-[#D4AF37] to-[#F0C75E] text-[#111111]" : "bg-linear-to-r from-sky-500 via-cyan-400 to-blue-500 text-white"} font-bold text-sm`}>
              {recipientName.charAt(0)}
            </div>

            <div>
              <h2
                className={`font-semibold text-sm md:text-base cursor-pointer transition ${isVibesPro ? "text-[#F7E7B2] hover:text-[#FFD98A]" : "text-slate-800 hover:text-sky-600"}`}
                onClick={() => onNavigateToProfile(recipientName)}
              >
                {recipientName}
              </h2>

              <p className={`text-xs mt-1 ${headerSubtextClassName}`}>
                {typingUsers.includes(recipientId)
                  ? `${recipientName} is typing...`
                  : chatPresenceReady && isUserOnline(recipientId)
                    ? "🟢 Online"
                    : "⚫ Offline"}
              </p>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={onAudioCall}
                title="Audio call"
                className={`p-2 rounded-xl transition ${isVibesPro ? "bg-white/5 text-white hover:bg-white/10" : "bg-slate-900/10 text-slate-800 hover:bg-slate-900/20"}`}
              >
                📞
              </button>

              <button
                onClick={onVideoCall}
                title="Video call"
                className={`p-2 rounded-xl transition ${isVibesPro ? "bg-white/5 text-white hover:bg-white/10" : "bg-slate-900/10 text-slate-800 hover:bg-slate-900/20"}`}
              >
                🎥
              </button>
            </div>
          </div>

          <div className={`overflow-hidden transition-all duration-300 ${showSearchBar || searchQuery.trim() ? "max-h-12 opacity-100 mt-1" : "max-h-0 opacity-0 mt-0"}`}>
            <div className={panelClassName}>
              <input
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search this conversation"
                className={`w-full bg-transparent text-sm outline-none ${isVibesPro ? "text-[#F7E7B2] placeholder:text-[#E8C96F]/50 font-serif" : "text-white placeholder:text-white/50"}`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
