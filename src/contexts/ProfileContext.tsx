import React, { createContext, useContext } from 'react';
import { useSession } from './SessionContext';
import type { ProfileData } from '../types/profile';

type ProfileContextValue = {
  profile: ProfileData | null;
  setProfile: (p: ProfileData | null) => void;
};

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export function setGlobalProfile(p: ProfileData | null) {
  const session = (window as Window & { __metoyouSessionSetter?: (p: ProfileData | null) => void }).__metoyouSessionSetter;
  session?.(p);
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const session = useSession();

  return (
    <ProfileContext.Provider value={{ profile: session.profile, setProfile: session.setProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const c = useContext(ProfileContext);
  if (!c) throw new Error('useProfile must be used within ProfileProvider');
  return c;
}

export default ProfileContext;
