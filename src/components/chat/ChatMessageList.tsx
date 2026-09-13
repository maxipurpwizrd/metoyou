import ChatBubble from "../ChatBubble";
import type { Message } from "../../lib/messageApi";

interface ChatMessageListProps {
  messages: Message[];
  messagesLoading: boolean;
  loadingMore: boolean;
  searchQuery: string;
  isVibesPro: boolean;
  userId: string | null;
  onEdit: (messageId: string, newText: string) => void;
  onDelete: (messageId: string) => void;
  onReply: (message: Message) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  recipientId: string;
}

export function ChatMessageList({
  messages,
  messagesLoading,
  loadingMore,
  searchQuery,
  isVibesPro,
  userId,
  onEdit,
  onDelete,
  onReply,
  messagesEndRef,
  recipientId,
}: ChatMessageListProps) {
  const emptyStateClassName = isVibesPro
    ? "bg-[#181818]/80 backdrop-blur-3xl border border-[#D4AF37]/20 rounded-4xl p-8 text-center text-[#EBD39A]/70 shadow-[0_0_30px_rgba(212,175,55,0.08)]"
    : "bg-white/80 backdrop-blur-3xl border border-pink-100 rounded-4xl p-8 text-center text-slate-700 shadow-[0_10px_35px_rgba(236,72,153,0.08)]";

  return (
    <div className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden pt-28 md:pt-32 pb-28 md:pb-32 px-3 md:px-6 bg-transparent">
      <div className="max-w-xl mx-auto">
        {recipientId ? (
          <div className="space-y-4">
            {loadingMore && (
              <div className="text-center text-white/50 text-sm py-2">Loading older messages…</div>
            )}
            {messagesLoading ? (
              <div className="space-y-4 py-8">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-white/10" />
                    <div className="flex-1">
                      <div className="h-3 bg-white/10 rounded w-1/3 mb-2" />
                      <div className="h-8 bg-white/5 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-white/50 py-8">
                No messages yet. Start the conversation! 💬
              </div>
            ) : (() => {
              const filteredMessages = searchQuery.trim()
                ? messages.filter((msg) => {
                    const text = `${msg.text ?? ""} ${msg.reply_to_text ?? ""}`.toLowerCase();
                    return text.includes(searchQuery.trim().toLowerCase());
                  })
                : messages;

              if (filteredMessages.length === 0) {
                return (
                  <div className={`text-center py-8 ${isVibesPro ? "text-[#EBD39A]/70" : "text-white/50"}`}>
                    No messages match your search. 🔎
                  </div>
                );
              }

              return filteredMessages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  mine={msg.sender_id === userId}
                  message={msg}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onReply={onReply}
                />
              ));
            })()}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <div className={emptyStateClassName}>
            Open a message thread or tap a profile message icon to start chatting.
          </div>
        )}
      </div>
    </div>
  );
}
