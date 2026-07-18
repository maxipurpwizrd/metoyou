import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Plus } from 'lucide-react';
import { PremiumCard } from './components/PremiumCard';

interface Story {
  id: string;
  name: string;
  image?: string;
  timeRemaining?: string;
}

interface VibesProStoriesProps {
  stories?: Story[];
  onAddStory?: () => void;
}

export const VibesProStories: React.FC<VibesProStoriesProps> = ({
  stories = [],
  onAddStory,
}) => {
  const { t } = useLanguage();
  // Default stories if none provided
  const defaultStories: Story[] = [
    { id: '1', name: 'Jay', timeRemaining: '19h 3m' },
    { id: '2', name: 'Mike', timeRemaining: '19h 3m' },
    { id: '3', name: 'Sarah', timeRemaining: '19h 3m' },
  ];

  const displayStories = stories.length > 0 ? stories : defaultStories;

  return (
    <div className="px-4 py-6 overflow-x-auto bg-[#0B0B0B]">
      <div className="flex gap-4 min-w-min">
        {/* Your Story Card */}
        <button
          onClick={onAddStory}
          className="shrink-0 w-24 h-32"
        >
          <PremiumCard withGlow className="w-full h-full flex flex-col items-center justify-center gap-3 hover:shadow-[0_0_40px_rgba(212,175,55,0.2)]">
            <Plus size={24} className="text-[#F0C75E]" />
            <span className="text-xs font-semibold text-[#D6D6D6] text-center">{t('vibespro.yourStory')}</span>
          </PremiumCard>
        </button>

        {/* Story Cards */}
        {displayStories.map((story) => (
          <button
            key={story.id}
            className="shrink-0 w-24 h-32 group"
          >
            <PremiumCard
              withGlow
              className={`
                w-full h-full
                bg-linear-to-br from-[#D4AF37]/15 to-[#F0C75E]/15
                flex flex-col items-center justify-between p-3
                group-hover:shadow-[0_0_40px_rgba(212,175,55,0.2)]
              `}
            >
              {/* Story Decorative Corner */}
              <div className="absolute top-2 right-2 w-4 h-4 border-t border-r border-[#D4AF37]/50" />
              
              {/* Story Name */}
              <div className="text-center flex-1 flex items-center justify-center">
                <span className="text-sm font-bold text-[#F0C75E]">{story.name}</span>
              </div>

              {/* Timer */}
              {story.timeRemaining && (
                <span className="text-xs text-[#B88A2D] font-medium">⏳ {story.timeRemaining}</span>
              )}

              {/* Bottom Decorative Corner */}
              <div className="absolute bottom-2 left-2 w-4 h-4 border-b border-l border-[#D4AF37]/50" />
            </PremiumCard>
          </button>
        ))}
      </div>
    </div>
  );
};
