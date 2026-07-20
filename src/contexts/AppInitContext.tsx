import React, { createContext, useContext, useState } from 'react';

type AppInitContextValue = {
  appReady: boolean;
  progress: number;
  currentTask: string;
  setProgress?: (p: number) => void;
  setCurrentTask?: (t: string) => void;
  setAppReady?: (v: boolean) => void;
};

const AppInitContext = createContext<AppInitContextValue | undefined>(undefined);

export function AppInitProvider({ children }: { children: React.ReactNode }) {
  const [appReady, setAppReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTask, setCurrentTask] = useState('Preparing your account...');

  return (
    <AppInitContext.Provider
      value={{ appReady, progress, currentTask, setProgress, setCurrentTask, setAppReady }}
    >
      {children}
    </AppInitContext.Provider>
  );
}

export function useAppInit() {
  const ctx = useContext(AppInitContext);
  if (!ctx) throw new Error('useAppInit must be used within AppInitProvider');
  return ctx;
}

export default AppInitContext;
