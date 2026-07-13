import React from 'react';

interface PremiumButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
  disabled?: boolean;
}

export const PremiumButton: React.FC<PremiumButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  className = '',
  disabled = false,
}) => {
  const variantStyles = {
    primary: `
      bg-gradient-to-r from-[#D4AF37] to-[#F0C75E]
      text-[#0B0B0B] font-semibold
      shadow-[0_8px_24px_rgba(212,175,55,0.3)]
      hover:shadow-[0_12px_32px_rgba(212,175,55,0.4)]
    `,
    secondary: `
      bg-[#181818]
      text-[#F0C75E]
      border border-[#D4AF37]/40
      shadow-sm
      hover:shadow-[0_6px_20px_rgba(212,175,55,0.15)]
    `,
    ghost: `
      bg-transparent
      text-[#F0C75E]
      border border-[#D4AF37]/40
      hover:bg-[#D4AF37]/10
    `,
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        px-6 py-3
        rounded-full
        transition-all duration-200
        ${variantStyles[variant]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}
        ${className}
      `}
    >
      {children}
    </button>
  );
};
