import React from 'react';

interface PremiumCardProps {
  children: React.ReactNode;
  className?: string;
  withGlow?: boolean;
}

export const PremiumCard: React.FC<PremiumCardProps> = ({
  children,
  className = '',
  withGlow = true,
}) => {
  return (
    <div
      className={`
        bg-[#181818] 
        rounded-3xl 
        border border-[#D4AF37]/40
        ${withGlow ? 'shadow-[0_0_40px_rgba(212,175,55,0.15),inset_0_1px_2px_rgba(212,175,55,0.05)]' : 'shadow-lg'}
        ${className}
      `}
    >
      {children}
    </div>
  );
};
