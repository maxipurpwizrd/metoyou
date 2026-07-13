import React from 'react';
import { Home, Search, MessageCircle, Bell, User } from 'lucide-react';
import { Link } from 'react-router-dom';

export const VibesProNavbar: React.FC = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0B0B0B] border-b border-white/8 shadow-lg">
      <div className="w-full px-2 sm:px-3 md:px-4 lg:px-6">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo */}
          <Link to="/feed" className="flex items-center min-w-0 shrink-0 hover:opacity-80 transition-opacity">
            <span className="text-xl sm:text-2xl font-bold bg-linear-to-r from-[#7C5CFF] to-[#00D4FF] bg-clip-text text-transparent tracking-tight whitespace-nowrap">
              VibesPro ✨
            </span>
          </Link>

          {/* Navigation Icons - Always visible */}
          <div className="flex items-center gap-0.5 sm:gap-1 md:gap-2 flex-1 justify-center mx-2 sm:mx-3">
            <Link to="/feed" className="p-2 sm:p-2.5 text-white/60 hover:text-[#7C5CFF] transition-colors">
              <Home size={20} className="sm:hidden" />
              <Home size={24} className="hidden sm:block" />
            </Link>
            <Link to="/search" className="p-2 sm:p-2.5 text-white/60 hover:text-[#00D4FF] transition-colors">
              <Search size={20} className="sm:hidden" />
              <Search size={24} className="hidden sm:block" />
            </Link>
          </div>

          {/* Right Icons - Always visible */}
          <div className="flex items-center gap-0.5 sm:gap-1 md:gap-2 shrink-0">
            {/* Messages */}
            <Link to="/messages" className="relative p-2 sm:p-2.5 text-white/60 hover:text-[#00D4FF] transition-colors">
              <MessageCircle size={20} className="sm:hidden" />
              <MessageCircle size={24} className="hidden sm:block" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-[#00D4FF] rounded-full animate-pulse" />
            </Link>

            {/* Notifications */}
            <Link to="/notifications" className="relative p-2 sm:p-2.5 text-white/60 hover:text-[#7C5CFF] transition-colors">
              <Bell size={20} className="sm:hidden" />
              <Bell size={24} className="hidden sm:block" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-[#7C5CFF] rounded-full" />
            </Link>

            {/* Profile */}
            <Link to="/profile" className="p-2 sm:p-2.5 text-white/60 hover:text-[#00D4FF] transition-colors">
              <User size={20} className="sm:hidden" />
              <User size={24} className="hidden sm:block" />
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};
