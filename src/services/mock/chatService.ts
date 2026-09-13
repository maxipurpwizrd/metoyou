export const chatService = {
  getMessageThreads: async () => [],
  findOrCreateConversation: async () => ({ id: "mock-conversation" }),
  fetchMessagesPage: async () => ({ messages: [], hasMore: false }),
  sendChatMessage: async () => ({ success: true }),
  markMessagesAsRead: async () => ({ success: true }),
  updateConversationLastMessageTime: async () => ({ success: true }),
};
