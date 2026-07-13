import React from 'react';

interface PremiumSectionProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export const PremiumSection: React.FC<PremiumSectionProps> = ({
  children,
  className = '',
  title,
}) => {
  return (
    <section className={`px-4 py-6 ${className}`}>
      {title && (
        <h2 className="text-xs font-semibold text-[#D6D6D6] mb-4 tracking-widest uppercase">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
};
