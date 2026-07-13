import React from 'react';

interface PremiumBackgroundProps {
  children: React.ReactNode;
  className?: string;
}

export const PremiumBackground: React.FC<PremiumBackgroundProps> = ({
  children,
  className = '',
}) => {
  return (
    <div
      className={`
        min-h-screen
        bg-linear-to-br from-[#0B0B0B] via-[#121212] to-[#181818]
        ${className}
      `}
    >
      {/* Subtle luxury gradient overlay */}
      <div className="fixed inset-0 pointer-events-none bg-linear-to-br from-transparent via-transparent to-[#D4AF37]/3" />
      
      {children}
    </div>
  );
};
