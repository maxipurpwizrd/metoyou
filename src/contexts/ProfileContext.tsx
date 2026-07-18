import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ProfileData } from '../types/profile';
import { getProfile } from '../utils/profileStorage';

type ProfileContextValue = {
  profile: ProfileData | null;
  setProfile: (p: ProfileData | null) => void;
};

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

let setProfileGlobal: ((p: ProfileData | null) => void) | null = null;

export function setGlobalProfile(p: ProfileData | null) {
  if (setProfileGlobal) setProfileGlobal(p);
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<ProfileData | null>(() => getProfile() ?? null);

  useEffect(() => {
    setProfileGlobal = setProfile;
    return () => { setProfileGlobal = null };
  }, []);

  return (
    <ProfileContext.Provider value={{ profile, setProfile }}>
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
