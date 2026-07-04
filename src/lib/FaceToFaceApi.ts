const STORAGE_KEY = "metoyou:facetoface-sessions";

export type FaceToFaceSession = {
  id: string;
  started_at: number;
  ended_at?: number;
  duration?: number;
  saved?: boolean;
  title?: string;
  metadata?: Record<string, unknown>;
};

function loadHistory(): FaceToFaceSession[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FaceToFaceSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistHistory(sessions: FaceToFaceSession[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // ignore storage errors for now
  }
}

export async function startFaceToFace(metadata?: Partial<FaceToFaceSession>): Promise<FaceToFaceSession> {
  return {
    id: `fft-${Date.now()}`,
    started_at: Date.now(),
    title: metadata?.title ?? "FaceToFace session",
    metadata: metadata?.metadata ?? metadata,
  };
}

export async function endFaceToFace(sessionId: string): Promise<Partial<FaceToFaceSession>> {
  console.debug("ending FaceToFace session", sessionId);
  const endedAt = Date.now();
  return {
    ended_at: endedAt,
    duration: 0,
  };
}

export async function saveFaceToFace(session: FaceToFaceSession): Promise<void> {
  const history = loadHistory();
  const next = [session, ...history.filter((item) => item.id !== session.id)];
  persistHistory(next);
}

export async function getFaceToFaceHistory(): Promise<FaceToFaceSession[]> {
  return loadHistory();
}
