import { useCallback, useState, type ChangeEvent } from "react";
import type { Message } from "../lib/messageApi";

interface UseChatComposerStateOptions {
  onTyping?: (value: string) => void;
}

export function useChatComposerState({ onTyping }: UseChatComposerStateOptions = {}) {
  const [inputText, setInputText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const val = event.target.value;
      setInputText(val);
      onTyping?.(val);
    },
    [onTyping]
  );

  const handleEmojiClick = useCallback((emoji: string) => {
    setInputText((prev) => prev + emoji);
    setShowEmojiPicker(false);
  }, []);

  const resetComposer = useCallback(() => {
    setInputText("");
    setReplyingTo(null);
    setShowEmojiPicker(false);
  }, []);

  return {
    inputText,
    setInputText,
    showEmojiPicker,
    setShowEmojiPicker,
    replyingTo,
    setReplyingTo,
    handleInputChange,
    handleEmojiClick,
    resetComposer,
  };
}
