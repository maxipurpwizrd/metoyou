import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Heart, MessageCircle, Share2, MoreVertical } from 'lucide-react';
import { PremiumCard } from './components/PremiumCard';
import { PremiumIcon } from './components/PremiumIcon';

interface VibesProPostCardProps {
  id: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  text: string;
  image?: string;
  createdAt?: string;
  likesCount?: number;
  commentsCount?: number;
  isLiked?: boolean;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
}

export const VibesProPostCard: React.FC<VibesProPostCardProps> = ({
  author,
  text,
  image,
  createdAt,
  likesCount = 0,
  commentsCount = 0,
  isLiked = false,
  onLike,
  onComment,
  onShare,
}) => {
  const [liked, setLiked] = useState(isLiked);
  const [likes, setLikes] = useState(likesCount);

  const handleLike = () => {
    setLiked(!liked);
    setLikes(liked ? likes - 1 : likes + 1);
    onLike?.();
  };

  const { t } = useLanguage();

  const timeString = createdAt
    ? new Date(createdAt).toLocaleDateString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '2m ago';

  return (
    <div className="px-4 py-3">
      <PremiumCard className="overflow-hidden">
        {/* Card Header */}
        <div className="px-6 pt-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            {author.avatar ? (
              <img
                src={author.avatar}
                alt={author.name}
                className="w-12 h-12 rounded-full ring-2 ring-[#D4AF37]/30 shadow-[0_0_12px_rgba(212,175,55,0.15)]"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-linear-to-br from-[#D4AF37] to-[#F0C75E] flex items-center justify-center text-[#0B0B0B] font-bold shadow-[0_0_12px_rgba(212,175,55,0.15)]">
                {author.name.charAt(0)}
              </div>
            )}

            {/* User Info */}
            <div>
              <p className="font-semibold text-[#FFFFFF]">{author.name}</p>
              <p className="text-xs text-[#D6D6D6]">{timeString}</p>
            </div>
          </div>

          {/* Menu Button */}
          <button className="p-2 hover:bg-[#D4AF37]/10 rounded-lg transition-colors">
            <MoreVertical size={18} className="text-[#B88A2D]" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p className="text-[#FFFFFF] leading-relaxed">{text}</p>
        </div>

        {/* Image */}
        {image && (
          <div className="px-6 pb-4">
            <img
              src={image}
              alt="Post"
              className="w-full rounded-2xl border border-[#D4AF37]/20 shadow-md"
            />
          </div>
        )}

        {/* Action Footer */}
        <div className="px-6 py-4 border-t border-[#D4AF37]/10 flex items-center justify-around">
          {/* Like Button */}
          <button
            onClick={handleLike}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#D4AF37]/10 transition-all group"
          >
            <PremiumIcon withGlow={liked}>
              <Heart
                size={18}
                fill={liked ? 'currentColor' : 'none'}
                className={liked ? 'text-[#F0C75E]' : 'text-[#B88A2D]'}
              />
            </PremiumIcon>
            <span className="text-sm font-medium text-[#D6D6D6] group-hover:text-[#F0C75E] transition-colors">
              {likes > 0 ? likes : t('vibespro.like')}
            </span>
          </button>

          {/* Comment Button */}
          <button
            onClick={onComment}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#D4AF37]/10 transition-all"
          >
            <PremiumIcon>
              <MessageCircle size={18} className="text-[#B88A2D]" />
            </PremiumIcon>
            <span className="text-sm font-medium text-[#D6D6D6] hover:text-[#F0C75E]">
              {commentsCount > 0 ? commentsCount : t('vibespro.comment')}
            </span>
          </button>

          {/* Share Button */}
          <button
            onClick={onShare}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#D4AF37]/10 transition-all"
          >
            <PremiumIcon>
              <Share2 size={18} className="text-[#B88A2D]" />
            </PremiumIcon>
            <span className="text-sm font-medium text-[#D6D6D6] hover:text-[#F0C75E]">{t('vibespro.share')}</span>
          </button>
        </div>
      </PremiumCard>
    </div>
  );
};
