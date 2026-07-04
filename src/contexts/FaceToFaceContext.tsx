import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { startFaceToFace as apiStartFaceToFace, endFaceToFace as apiEndFaceToFace, saveFaceToFace as apiSaveFaceToFace, getFaceToFaceHistory } from "../lib/FaceToFaceApi";

type FaceToFaceSession = {
  id: string;
  started_at: number;
  ended_at?: number;
  duration?: number;
  saved?: boolean;
  title?: string;
  metadata?: Record<string, unknown>;
};

interface FaceToFaceContextType {
  activeCall: FaceToFaceSession | null;
  isCalling: boolean;
  callHistory: FaceToFaceSession[];
  startCall: () => Promise<void>;
  endCall: () => Promise<void>;
  saveCall: (session: FaceToFaceSession) => Promise<void>;
}

const FaceToFaceContext = createContext<FaceToFaceContextType | undefined>(undefined);

export function FaceToFaceProvider({ children }: { children: ReactNode }) {
  const [activeCall, setActiveCall] = useState<FaceToFaceSession | null>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [callHistory, setCallHistory] = useState<FaceToFaceSession[]>([]);

  const startCall = async () => {
    const session = await apiStartFaceToFace();
    setActiveCall(session);
    setIsCalling(true);
  };

  const endCall = async () => {
    if (!activeCall) return;
    const ended = await apiEndFaceToFace(activeCall.id);
    const finished: FaceToFaceSession = {
      ...activeCall,
      ...ended,
      ended_at: ended.ended_at ?? Date.now(),
      duration:
        ended.duration ??
        Math.max(0, Date.now() - activeCall.started_at),
      saved: true,
    };
    await saveCall(finished);
    setIsCalling(false);
    setActiveCall(null);
  };

  const saveCall = async (session: FaceToFaceSession) => {
    await apiSaveFaceToFace(session);
    setCallHistory((prev) => [session, ...prev.filter((item) => item.id !== session.id)]);
  };

  useEffect(() => {
    getFaceToFaceHistory().then((history) => setCallHistory(history));
  }, []);

  const value = {
    activeCall,
    isCalling,
    callHistory,
    startCall,
    endCall,
    saveCall,
  };

  return <FaceToFaceContext.Provider value={value}>{children}</FaceToFaceContext.Provider>;
}

export function useFaceToFace() {
  const context = useContext(FaceToFaceContext);
  if (!context) {
    throw new Error("useFaceToFace must be used within FaceToFaceProvider");
  }
  return context;
}
