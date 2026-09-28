import React from 'react';
import { VibesProNavbar } from './VibesProNavbar';

interface VibesProFeedProps {
  children?: React.ReactNode;
  hideNavbar?: boolean;
}

/**
 * VibesPro Feed Theme Wrapper
 * Reuses the exact same components as MeToYou but with premium styling
 */
export const VibesProFeed: React.FC<VibesProFeedProps> = ({
  children,
  hideNavbar = false,
}) => {
  return (
    <div className="min-h-screen bg-[#0B0B0B]">
      {!hideNavbar && <VibesProNavbar />}

      <div className="relative pt-[3.5rem] sm:pt-[4.25rem] md:pt-[4.75rem]">
        {/* Subtle premium gradient overlay */}
        <div className="fixed inset-0 pointer-events-none bg-linear-to-br from-[#7C5CFF]/5 via-transparent to-[#00D4FF]/5 z-0" />

        {/* Content */}
        <div className="relative z-10 space-y-2">
          {children}
        </div>
      </div>
    </div>
  );
};
