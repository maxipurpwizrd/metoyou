import { Mic, Paperclip, Play, Pause, Send, Smile, Square, X } from "lucide-react";
import type { ChangeEvent, RefObject } from "react";

interface ChatComposerProps {
  isVibesPro: boolean;
  sendError: string | null;
  inputText: string;
  isLoading: boolean;
  authLoading: boolean;
  userId: string | null;
  recipientId: string;
  conversationId: string | null;
  isRecording: boolean;
  recordingDuration: number;
  audioBlob: Blob | null;
  previewUrl: string | null;
  selectedFile: File | null;
  uploadProgress: number;
  showEmojiPicker: boolean;
  commonEmojis: string[];
  replyTo: { id: string; text?: string | null } | null;
  isPlaying: boolean;
  audioPreviewUrl: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  waveformRef: RefObject<HTMLCanvasElement | null>;
  audioRef: RefObject<HTMLAudioElement | null>;
  onInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSend: () => void;
  onAttachmentClick: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onEmojiToggle: () => void;
  onEmojiClick: (emoji: string) => void;
  onPreviewRemove: () => void;
  onReplyCancel: () => void;
  onRecordingClear: () => void;
  onTogglePlayPreview: () => void;
  formatRecordingTime: (seconds: number) => string;
  onFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function ChatComposer({
  isVibesPro,
  sendError,
  inputText,
  isLoading,
  authLoading,
  userId,
  recipientId,
  conversationId,
  isRecording,
  recordingDuration,
  audioBlob,
  previewUrl,
  selectedFile,
  uploadProgress,
  showEmojiPicker,
  commonEmojis,
  replyTo,
  isPlaying,
  audioPreviewUrl,
  fileInputRef,
  waveformRef,
  audioRef,
  onInputChange,
  onSend,
  onAttachmentClick,
  onStartRecording,
  onStopRecording,
  onEmojiToggle,
  onEmojiClick,
  onPreviewRemove,
  onReplyCancel,
  onRecordingClear,
  onTogglePlayPreview,
  formatRecordingTime,
  onFileSelect,
}: ChatComposerProps) {
  const messageBoxClassName = isVibesPro
    ? "bg-[#181818]/90 backdrop-blur-3xl border border-[#D4AF37]/20 rounded-3xl md:rounded-4xl p-2 md:p-4 shadow-[0_0_30px_rgba(212,175,55,0.12)]"
    : "bg-white/80 backdrop-blur-3xl border border-pink-100 rounded-3xl md:rounded-4xl p-2 md:p-4 shadow-[0_10px_35px_rgba(168,85,247,0.12)]";

  const inputClassName = isVibesPro
    ? "w-full bg-transparent outline-none text-[#F7E7B2] placeholder-[#E8C96F]/50 text-sm md:text-base px-2 font-serif"
    : "w-full bg-transparent outline-none text-slate-900 placeholder-slate-500 text-sm md:text-base px-2";

  const sendButtonClassName = isVibesPro
    ? "bg-linear-to-r from-[#D4AF37] to-[#F0C75E] text-[#111111] h-10 w-10 md:w-auto md:px-4 rounded-full md:rounded-2xl font-bold shadow-lg hover:scale-105 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center shrink-0 text-sm md:text-base active:scale-95"
    : "bg-linear-to-r from-fuchsia-500 via-violet-500 to-cyan-400 text-white h-10 w-10 md:w-auto md:px-4 rounded-full md:rounded-2xl font-bold shadow-lg hover:scale-105 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center shrink-0 text-sm md:text-base active:scale-95";

  const audioButtonClassName = isVibesPro ? "bg-white/10 text-white hover:bg-white/20" : "bg-slate-900/10 text-slate-800 hover:bg-slate-900/20";

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 p-3 md:p-6 ${isVibesPro ? "bg-[#111111]/95 border-t border-[#D4AF37]/20 shadow-[0_0_40px_rgba(212,175,55,0.10)]" : "bg-white/70 backdrop-blur-xl border-t border-white/70 shadow-[0_-10px_35px_rgba(236,72,153,0.08)]"}`}>
      <div className="max-w-xl mx-auto">
        {replyTo && (
          <div className={`mb-3 rounded-2xl border px-3 py-2 text-sm flex items-center justify-between ${isVibesPro ? "border-white/10 bg-white/10 text-white/80" : "border-pink-100 bg-white/90 text-slate-700 shadow-sm"}`}>
            <div className="min-w-0">
              <div className={`text-[11px] uppercase tracking-[0.2em] ${isVibesPro ? "text-white/50" : "text-slate-500"}`}>Replying to</div>
              <div className="truncate">{replyTo.text ?? "message"}</div>
            </div>
            <button onClick={onReplyCancel} className={`ml-2 rounded-full p-1 ${isVibesPro ? "hover:bg-white/10" : "hover:bg-slate-100"}`} aria-label="Cancel reply">
              <X size={16} />
            </button>
          </div>
        )}

        {audioBlob ? (
          <div className="mb-3 p-3 rounded-2xl bg-white/10 flex items-center gap-3">
            <button
              onClick={onTogglePlayPreview}
              className={`h-9 w-9 rounded-full flex items-center justify-center ${audioButtonClassName}`}
              aria-label={isPlaying ? "Pause preview" : "Play preview"}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>

            <div className="flex-1">
              <canvas ref={waveformRef} className="w-full h-8" />
              <div className={`text-xs mt-1 ${isVibesPro ? "text-white/70" : "text-slate-600"}`}>Voice note ready</div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onRecordingClear}
                className={`h-8 w-8 rounded-full flex items-center justify-center ${isVibesPro ? "bg-slate-900/60 text-white" : "bg-slate-900/10 text-slate-800"}`}
                aria-label="Remove voice note"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {audioPreviewUrl ? <audio ref={audioRef} src={audioPreviewUrl ?? undefined} hidden /> : null}
          </div>
        ) : null}

        {previewUrl && selectedFile ? (
          <div className={`mb-3 rounded-[28px] backdrop-blur-3xl border shadow-lg overflow-hidden transition-opacity duration-300 ease-out opacity-100 ${isVibesPro ? "bg-white/10 border-white/10" : "bg-white/90 border-pink-100"}`}>
            <div className="relative">
              <img
                src={previewUrl}
                alt={selectedFile.name}
                className="w-full max-h-50 object-contain bg-slate-950"
              />
              <button
                type="button"
                onClick={onPreviewRemove}
                className={`absolute top-3 right-3 h-9 w-9 rounded-full shadow-lg transition shrink-0 ${isVibesPro ? "bg-slate-900/80 text-white hover:bg-slate-800" : "bg-slate-900/10 text-slate-800 hover:bg-slate-900/20"}`}
              >
                ✕
              </button>
            </div>
            <div className={`px-4 py-3 text-sm ${isVibesPro ? "text-white/80" : "text-slate-700"}`}>
              {selectedFile.name}
            </div>
            {uploadProgress > 0 && isLoading ? (
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden mx-4 mb-3">
                <div
                  className="h-full bg-cyan-400 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <div className={messageBoxClassName}>
          {sendError ? (
            <div className="mb-2 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {sendError}
            </div>
          ) : null}

          <div className="flex gap-1 md:gap-2 items-center">
            <div className="flex items-center gap-2">
              <button
                onClick={onAttachmentClick}
                className={`h-10 w-10 rounded-full transition flex items-center justify-center shrink-0 ${audioButtonClassName}`}
                title="Add attachment"
              >
                <Paperclip className="h-4 w-4" />
              </button>

              {isRecording ? (
                <button
                  onClick={onStopRecording}
                  className="h-10 w-10 rounded-full bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse flex items-center justify-center shrink-0"
                  title="Stop recording"
                >
                  <Square className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={onStartRecording}
                  className={`h-10 w-10 rounded-full transition flex items-center justify-center shrink-0 ${audioButtonClassName}`}
                  title="Start recording"
                >
                  <Mic className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex-1">
              {isRecording ? (
                <div className="mb-2 flex items-center gap-2 rounded-full bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-200 border border-red-400/30 w-fit">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  <span>Recording • {formatRecordingTime(recordingDuration)}</span>
                </div>
              ) : null}
              <label htmlFor="message-input" className="sr-only">Message</label>
              <input
                id="message-input"
                name="message"
                type="text"
                placeholder="Type a message..."
                value={inputText}
                onChange={onInputChange}
                onKeyDown={(e) => e.key === "Enter" && onSend()}
                className={inputClassName}
                autoComplete="off"
              />
            </div>

            <div className="relative shrink-0">
              <button
                onClick={onEmojiToggle}
                className={`h-10 w-10 rounded-full transition flex items-center justify-center ${audioButtonClassName}`}
                title="Add emoji"
              >
                <Smile className="h-4 w-4" />
              </button>

              {showEmojiPicker && (
                <div className="absolute bottom-full right-0 mb-2 bg-slate-800/95 backdrop-blur-xl border border-white/20 rounded-2xl p-2 md:p-3 shadow-xl grid grid-cols-6 gap-1 md:gap-2 w-44 md:w-48 z-50">
                  {commonEmojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => onEmojiClick(emoji)}
                      className="text-lg md:text-xl hover:scale-125 transition cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={onSend}
              disabled={isLoading || authLoading || !userId || !recipientId || !conversationId || (!inputText.trim() && !selectedFile && !audioBlob)}
              className={sendButtonClassName}
            >
              {isLoading ? (
                <span className="hidden md:inline">Uploading... {uploadProgress}%</span>
              ) : (
                <span className="hidden md:inline">Send</span>
              )}
              {isLoading ? (
                <span className="md:hidden">{uploadProgress}%</span>
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        onChange={onFileSelect}
        className="hidden"
        accept="image/*"
      />
    </div>
  );
}
