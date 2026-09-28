import { useCallback, useEffect, useState } from "react";
import { getMyModerationStatus, type ModerationStatus } from "../lib/moderationApi";

export function useProfileStatus() {
  const [status, setStatus] = useState<ModerationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await getMyModerationStatus());
      setError(null);
    } catch (caught) {
      console.error("Unable to load moderation status", caught);
      setError("Unable to load account status right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return { status, loading, error, refresh };
}