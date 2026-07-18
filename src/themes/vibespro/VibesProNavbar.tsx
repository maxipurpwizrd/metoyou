import React from 'react';
import { Home, Search, MessageCircle, Bell, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';

export const VibesProNavbar: React.FC = () => {
  const { t } = useLanguage();
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0B0B0B] border-b border-white/8 shadow-lg">
      <div className="w-full px-2 sm:px-3 md:px-4 lg:px-6">
        <div className="flex items-center justify-between h-20 sm:h-24">
          {/* Logo */}
          <Link to="/feed" className="flex items-center min-w-0 shrink-0 hover:opacity-80 transition-opacity">
            <span className="text-[1.35rem] sm:text-[1.6rem] font-bold bg-linear-to-r from-[#7C5CFF] to-[#00D4FF] bg-clip-text text-transparent tracking-tight whitespace-nowrap">
              {t('vibespro.title')}
            </span>
          </Link>

          {/* Navigation Icons - Always visible */}
          <div className="flex items-center gap-1 sm:gap-2 md:gap-3 flex-1 justify-center mx-2 sm:mx-3">
            <Link to="/feed" className="p-3 sm:p-3.5 md:p-4 text-white/60 hover:text-[#7C5CFF] transition-colors">
              <Home size={24} className="sm:hidden" />
              <Home size={28} className="hidden sm:block" />
            </Link>
            <Link to="/search" className="p-3 sm:p-3.5 md:p-4 text-white/60 hover:text-[#00D4FF] transition-colors">
              <Search size={24} className="sm:hidden" />
              <Search size={28} className="hidden sm:block" />
            </Link>
          </div>

          {/* Right Icons - Always visible */}
          <div className="flex items-center gap-1 sm:gap-2 md:gap-3 shrink-0">
            {/* Messages */}
            <Link to="/messages" className="relative p-3 sm:p-3.5 md:p-4 text-white/60 hover:text-[#00D4FF] transition-colors">
              <MessageCircle size={24} className="sm:hidden" />
              <MessageCircle size={28} className="hidden sm:block" />
              <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-[#00D4FF] rounded-full animate-pulse" />
            </Link>

            {/* Notifications */}
            <Link to="/notifications" className="relative p-3 sm:p-3.5 md:p-4 text-white/60 hover:text-[#7C5CFF] transition-colors">
              <Bell size={24} className="sm:hidden" />
              <Bell size={28} className="hidden sm:block" />
              <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-[#7C5CFF] rounded-full" />
            </Link>

            {/* Profile */}
            <Link to="/profile" className="p-3 sm:p-3.5 md:p-4 text-white/60 hover:text-[#00D4FF] transition-colors">
              <User size={24} className="sm:hidden" />
              <User size={28} className="hidden sm:block" />
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};
