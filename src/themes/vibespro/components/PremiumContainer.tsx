import React from 'react';

interface PremiumContainerProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'glass' | 'card';
}

export const PremiumContainer: React.FC<PremiumContainerProps> = ({
  children,
  className = '',
  variant = 'default',
}) => {
  const variantStyles = {
    default: 'bg-[#0B0B0B]',
    glass: 'bg-white/5 backdrop-blur-xl border border-[#D4AF37]/20',
    card: 'bg-[#181818] border border-[#D4AF37]/30',
  };

  return (
    <div className={`${variantStyles[variant]} ${className}`}>
      {children}
    </div>
  );
};
