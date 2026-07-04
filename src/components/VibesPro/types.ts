export type VibesProMessage = {
  id: string;
  text: string;
  role: 'user' | 'assistant';
  createdAt?: string;
  isRead?: boolean;
};

export type VibesProPostType = {
  id: string | number;
  title?: string;
  description?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  badgeLabel?: string;
  likes?: number;
  comments?: number;
};

export type VibesProProfileProps = {
  username?: string;
  avatarUrl?: string;
  badgeLabel?: string;
  subtitle?: string;
  title?: string;
  posts?: VibesProPostType[];
  hommiesCount?: number;
  snapshotsCount?: number;
  vibesCount?: number;
  isOnline?: boolean;
  isFollowing?: boolean;
  followLabel?: string;
  onFollow?: () => void;
  onMessage?: () => void;
  onGift?: () => void;
};

export type VibesProChatProps = {
  messages: VibesProMessage[];
  currentUserId?: string;
  onSend?: (text: string) => void;
};

export type VibesProMessageProps = {
  message: VibesProMessage;
  isOwn?: boolean;
};

export type VibesProInputProps = {
  value?: string;
  onChange?: (value: string) => void;
  onSend?: () => void;
  placeholder?: string;
};

export type VibesProFalconSendProps = {
  onSend?: () => void;
  disabled?: boolean;
};

export type VibesProHeroProps = {
  username: string;
  portraitUrl: string;
  isOnline?: boolean;
  hommiesCount?: number;
  badgeLabel?: string;
  isFollowing?: boolean;
  followLabel?: string;
  onFollow?: () => void;
  onMessage?: () => void;
  onGift?: () => void;
  viewingOwn?: boolean;
};

export type VibesProPortraitProps = {
  imageUrl: string;
  alt?: string;
};

export type VibesProActionsProps = {
  isFollowing?: boolean;
  onFollow?: () => void;
  onMessage?: () => void;
  onGift?: () => void;
};

export type VibesProPostsProps = {
  children: ReactNode;
};

export type VibesProPostCardProps = {
  title?: string;
  description?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  badgeLabel?: string;
  likeCount?: number;
  commentCount?: number;
  onClick?: () => void;
};
