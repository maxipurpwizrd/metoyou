import type { FC } from 'react';
import throneTemplate from '../assets/throne-template.png';

export type ThroneCardProps = {
  username: string;
  imageUrl: string;
  isOnline?: boolean;
};

const ThroneCard: FC<ThroneCardProps> = ({ username, imageUrl, isOnline = false }) => {
  return (
    <div className="relative w-full h-65 rounded-[40px] overflow-hidden shadow-2xl">
      {/* Background image */}
      <img src={imageUrl} alt={`${username} avatar`} className="absolute inset-0 w-full h-full object-cover" />

      {/* Throne template overlay */}
      <img src={throneTemplate} alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10" />

      {/* Bottom gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-28 bg-linear-to-t from-black/90 to-transparent" />

      {/* Username and online indicator */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-2xl">{username}</span>
          <span
            aria-hidden
            className={`inline-block w-3 h-3 rounded-full ${isOnline ? 'bg-green-400' : 'bg-gray-400'} shadow-sm`}
            title={isOnline ? 'Online' : 'Offline'}
          />
        </div>
      </div>
    </div>
  );
};

export default ThroneCard;
