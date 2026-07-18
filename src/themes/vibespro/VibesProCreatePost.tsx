import React, { useState } from 'react';
import { useLanguage } from "../../contexts/LanguageContext";
import { Image, Music, Smile } from 'lucide-react';
import { PremiumCard } from './components/PremiumCard';
import { PremiumButton } from './components/PremiumButton';
import { PremiumIcon } from './components/PremiumIcon';

interface VibesProCreatePostProps {
  onPost?: (content: string) => void;
  userAvatar?: string;
  userName?: string;
}

export const VibesProCreatePost: React.FC<VibesProCreatePostProps> = ({
  onPost,
  userAvatar,
  userName = 'You',
}) => {
  const [content, setContent] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const { t } = useLanguage();

  const handlePost = () => {
    if (content.trim() && onPost) {
      onPost(content);
      setContent('');
    }
  };

  return (
    <div className="px-4 py-6">
      <PremiumCard className="p-6">
        {/* Header with Avatar */}
        <div className="flex items-center gap-4 mb-4">
          {/* Premium Avatar */}
          <div className="shrink-0">
            {userAvatar ? (
              <img
                src={userAvatar}
                alt={userName}
                className="w-12 h-12 rounded-full ring-2 ring-[#D4AF37]/30 shadow-[0_0_16px_rgba(212,175,55,0.2)]"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-linear-to-br from-[#D4AF37] to-[#F0C75E] flex items-center justify-center text-[#0B0B0B] font-bold shadow-[0_0_16px_rgba(212,175,55,0.2)]">
                {userName.charAt(0)}
              </div>
            )}
          </div>

          {/* User Info */}
          <div>
            <p className="font-semibold text-[#FFFFFF]">{userName}</p>
            <p className="text-xs text-[#D6D6D6]">{t("vibespro.create.dropVibe")}</p>
          </div>
        </div>

        {/* Input Area */}
        <div
          className={`
            transition-all duration-300
            rounded-2xl border-2
            ${isFocused
              ? 'border-[#F0C75E] shadow-[0_0_24px_rgba(240,199,94,0.2),inset_0_0_8px_rgba(240,199,94,0.08)]'
              : 'border-[#D4AF37]/30 shadow-[0_2px_8px_rgba(212,175,55,0.08)]'
            }
            bg-[#181818]/80 backdrop-blur-sm
            p-4
          `}
        >
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={t("vibespro.create.placeholder")}
            className="w-full bg-transparent text-[#FFFFFF] placeholder-[#D6D6D6]/40 focus:outline-none resize-none"
            rows={3}
          />
        </div>

        {/* Action Bar */}
        {(isFocused || content) && (
          <div className="mt-4 flex items-center justify-between">
            {/* Icons */}
            <div className="flex items-center gap-3">
              <button className="p-2 hover:bg-[#D4AF37]/10 rounded-lg transition-colors">
                <PremiumIcon withGlow>
                  <Image size={20} />
                </PremiumIcon>
              </button>
              <button className="p-2 hover:bg-[#D4AF37]/10 rounded-lg transition-colors">
                <PremiumIcon withGlow>
                  <Music size={20} />
                </PremiumIcon>
              </button>
              <button className="p-2 hover:bg-[#D4AF37]/10 rounded-lg transition-colors">
                <PremiumIcon withGlow>
                  <Smile size={20} />
                </PremiumIcon>
              </button>
            </div>

            {/* Post Button */}
            <PremiumButton
              variant="primary"
              onClick={handlePost}
              disabled={!content.trim()}
            >
              {t("vibespro.create.post")}
            </PremiumButton>
          </div>
        )}
      </PremiumCard>
    </div>
  );
};
