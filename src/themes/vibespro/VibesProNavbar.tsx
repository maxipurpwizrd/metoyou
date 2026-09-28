import React, { useEffect, useState } from 'react';
import { Home, Search, MessageCircle, Bell, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';

export const VibesProNavbar: React.FC = () => {
  const { t } = useLanguage();
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [isStoryComposerOpen, setIsStoryComposerOpen] = useState(false);
  const [isFeedPostOpen, setIsFeedPostOpen] = useState(false);

  useEffect(() => {
    const handleCreatePostVisibility = (event: Event) => {
      setIsCreatePostOpen((event as CustomEvent<boolean>).detail === true);
    };

    const handleFeedPostVisibility = (event: Event) => {
      setIsFeedPostOpen((event as CustomEvent<boolean>).detail === true);
    };

    window.addEventListener('metoyou:create-post-visibility', handleCreatePostVisibility);
    const handleStoryVisibility = (event: Event) => {
      setIsStoryComposerOpen((event as CustomEvent<boolean>).detail === true);
    };
    window.addEventListener('metoyou:create-story-visibility', handleStoryVisibility);
    window.addEventListener('metoyou:feed-post-visibility', handleFeedPostVisibility);
    return () => {
      window.removeEventListener('metoyou:create-post-visibility', handleCreatePostVisibility);
      window.removeEventListener('metoyou:create-story-visibility', handleStoryVisibility);
      window.removeEventListener('metoyou:feed-post-visibility', handleFeedPostVisibility);
    };
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 border-b border-white/8 bg-[#0B0B0B] shadow-lg transition-transform duration-200 ${isCreatePostOpen || isStoryComposerOpen || isFeedPostOpen ? '-translate-y-full pointer-events-none' : 'translate-y-0'}`}>
      <div className="w-full max-w-full px-2 pt-[max(env(safe-area-inset-top),0px)] sm:px-3 md:px-4 lg:px-6">
        <div className="mx-auto flex h-[4.75rem] max-w-[980px] items-center justify-between gap-2 sm:h-[5.25rem] md:h-[5.9rem]">
          <Link to="/feed" className="flex min-w-0 shrink-0 items-center overflow-hidden transition-opacity hover:opacity-80">
            <span className="block truncate bg-linear-to-r from-[#7C5CFF] to-[#00D4FF] bg-clip-text text-[clamp(1.3rem,4.4vw,2.1rem)] font-bold tracking-tight text-transparent whitespace-nowrap">
              {t('vibespro.title')}
            </span>
          </Link>

          <div className="ml-auto flex min-w-0 max-w-full items-center justify-end gap-2 sm:gap-3">
            <Link to="/feed" className="flex h-[3.3rem] w-[3.3rem] items-center justify-center rounded-full text-white/60 transition-colors hover:text-[#7C5CFF] sm:h-[3.8rem] sm:w-[3.8rem] md:h-[4.1rem] md:w-[4.1rem]">
              <Home className="h-[1.3rem] w-[1.3rem] sm:h-[1.8rem] sm:w-[1.8rem]" />
            </Link>
            <Link to="/search" className="flex h-[3.3rem] w-[3.3rem] items-center justify-center rounded-full text-white/60 transition-colors hover:text-[#00D4FF] sm:h-[3.8rem] sm:w-[3.8rem] md:h-[4.1rem] md:w-[4.1rem]">
              <Search className="h-[1.3rem] w-[1.3rem] sm:h-[1.8rem] sm:w-[1.8rem]" />
            </Link>

            <Link to="/messages" className="relative flex h-[3.3rem] w-[3.3rem] items-center justify-center rounded-full text-white/60 transition-colors hover:text-[#00D4FF] sm:h-[3.8rem] sm:w-[3.8rem] md:h-[4.1rem] md:w-[4.1rem]">
              <MessageCircle className="h-[1.3rem] w-[1.3rem] sm:h-[1.8rem] sm:w-[1.8rem]" />
              <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-[#00D4FF] animate-pulse" />
            </Link>

            <Link to="/notifications" className="relative flex h-[3.3rem] w-[3.3rem] items-center justify-center rounded-full text-white/60 transition-colors hover:text-[#7C5CFF] sm:h-[3.8rem] sm:w-[3.8rem] md:h-[4.1rem] md:w-[4.1rem]">
              <Bell className="h-[1.3rem] w-[1.3rem] sm:h-[1.8rem] sm:w-[1.8rem]" />
              <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-[#7C5CFF]" />
            </Link>

            <Link to="/profile" className="flex h-[3.3rem] w-[3.3rem] items-center justify-center rounded-full text-white/60 transition-colors hover:text-[#00D4FF] sm:h-[3.8rem] sm:w-[3.8rem] md:h-[4.1rem] md:w-[4.1rem]">
              <User className="h-[1.3rem] w-[1.3rem] sm:h-[1.8rem] sm:w-[1.8rem]" />
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};
