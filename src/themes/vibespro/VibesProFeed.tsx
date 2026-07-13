import React from 'react';
import { VibesProNavbar } from './VibesProNavbar';

interface VibesProFeedProps {
  children?: React.ReactNode;
}

/**
 * VibesPro Feed Theme Wrapper
 * Reuses the exact same components as MeToYou but with premium styling
 */
export const VibesProFeed: React.FC<VibesProFeedProps> = ({
  children,
}) => {
  return (
    <div className="min-h-screen bg-[#0B0B0B]">
      {/* Premium Navbar */}
      <VibesProNavbar />

      {/* Feed with premium theme */}
      <div className="relative pt-16 sm:pt-20">
        {/* Subtle premium gradient overlay */}
        <div className="fixed inset-0 pointer-events-none bg-linear-to-br from-[#7C5CFF]/5 via-transparent to-[#00D4FF]/5 z-0" />

        {/* Content */}
        <div className="relative z-10">
          {children}
        </div>
      </div>
    </div>
  );
};
