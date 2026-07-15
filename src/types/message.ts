export type MessageStatus = "sent" | "delivered" | "read" | null;

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  text?: string | null;
  image_url?: string | null;
  audio_url?: string | null;
  video_url?: string | null;
  status?: MessageStatus;
  message_type?: string | null;
  metadata?: Record<string, unknown> | null;
  reactions?: Record<string, string[]>;
  created_at: string;
  edited_at?: string | null;
  reply_to_id?: string | null;
  reply_to_text?: string | null;
};

export type PresenceState = Record<string, { last_active?: number; username?: string }>;

export type Conversation = {
  id: string;
  user_1: string;
  user_2: string;
  created_at: string;
  last_message_at?: string | null;
};

export type MessageThread = {
  otherId: string;
  otherUsername: string;
  lastText?: string | null;
  lastTime?: string;
};
