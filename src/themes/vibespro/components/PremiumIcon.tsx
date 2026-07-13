import React from 'react';

interface PremiumIconProps {
  children: React.ReactNode;
  className?: string;
  withGlow?: boolean;
}

export const PremiumIcon: React.FC<PremiumIconProps> = ({
  children,
  className = '',
  withGlow = false,
}) => {
  return (
    <span
      className={`
        text-[#F0C75E]
        transition-all duration-200
        ${withGlow ? 'drop-shadow-[0_0_8px_rgba(240,199,94,0.4)]' : ''}
        hover:text-[#D4AF37]
        ${className}
      `}
    >
      {children}
    </span>
  );
};
