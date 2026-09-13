import {
  getMessageThreads,
  findOrCreateConversation,
  fetchMessagesPage,
  sendChatMessage,
  markMessagesAsRead,
  updateConversationLastMessageTime,
} from "../../lib/chatApi";

export const chatService = {
  getMessageThreads,
  findOrCreateConversation,
  fetchMessagesPage,
  sendChatMessage,
  markMessagesAsRead,
  updateConversationLastMessageTime,
};
