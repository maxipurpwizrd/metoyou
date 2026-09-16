export type PostMediaType = "image" | "video" | "audio" | "text" | "mixed" | null;
export type ContentKind = "text" | "image" | "video" | "track";

export type PostRecord = {
  id: string;
  author_id: string;
  text?: string | null;
  image_url?: string | null;
  image_original_url?: string | null;
  video_url?: string | null;
  audio_url?: string | null;
  media_type?: PostMediaType;
  content_kind?: ContentKind | null;
  likes_count?: number;
  comments_count?: number;
  highlighted?: boolean;
  created_at: string;
  profiles?: {
    username?: string;
    profile_pic?: string | null;
    is_vibes_pro?: boolean | null;
    vibes_pro?: boolean | null;
  } | null;
};

export type FeedPost = {
  id: string | number;
  author: {
    id: string;
    username: string;
    profilePic?: string | null;
    isVibesPro?: boolean;
  };
  text?: string;
  image?: string;
  imageOriginal?: string;
  video?: string;
  audio?: string;
  mediaType?: PostMediaType;
  likes: number;
  comments: number;
  liked?: boolean;
  createdAt: string;
  highlighted?: boolean;
};
