import { useNavigate } from "react-router-dom";
import { useProfileStatus } from "../../hooks/useProfileStatus";

export default function RestrictedModeBanner() {
  const navigate = useNavigate();
  const { status } = useProfileStatus();
  if (status?.account_status !== "restricted") return null;
  return <button type="button" onClick={() => navigate("/profile/status")} className="fixed bottom-4 left-4 z-9000 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 shadow-lg">⚠️ Restricted Mode</button>;
}