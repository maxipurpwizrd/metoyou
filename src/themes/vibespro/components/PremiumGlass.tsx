import React from 'react';

interface PremiumGlassProps {
  children: React.ReactNode;
  className?: string;
}

export const PremiumGlass: React.FC<PremiumGlassProps> = ({
  children,
  className = '',
}) => {
  return (
    <div
      className={`
        bg-white/5
        backdrop-blur-2xl
        border border-[#D4AF37]/20
        rounded-2xl
        shadow-[0_8px_32px_rgba(212,175,55,0.1),inset_0_1px_1px_rgba(212,175,55,0.1)]
        ${className}
      `}
    >
      {children}
    </div>
  );
};
