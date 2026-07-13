import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchProfileFromSupabase } from "../lib/profileApi";
import { getProfile, saveProfile } from "../utils/profileStorage";

export default function VibesProSuccess() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Refreshing your Pro access...");

  useEffect(() => {
    const refreshAccess = async () => {
      const currentProfile = getProfile();
      try {
        const refreshedProfile = await fetchProfileFromSupabase(currentProfile.id);
        if (refreshedProfile) {
          saveProfile(refreshedProfile);
          setStatus("Your VibesPro access is ready. Redirecting...");
          window.setTimeout(() => navigate("/settings"), 1200);
          return;
        }
      } catch (error) {
        console.error("VibesPro success refresh error", error);
      }

      setStatus("We couldn’t refresh your access automatically. You can return to Settings and try again.");
      window.setTimeout(() => navigate("/settings"), 2500);
    };

    void refreshAccess();
  }, [navigate]);

  return (
    <div className="app-screen bg-[radial-gradient(circle_at_top,_rgba(255,215,0,0.2),_transparent_40%),linear-gradient(135deg,_#0f172a,_#1e293b)] p-6 pb-24 text-white">
      <div className="mx-auto flex max-w-2xl flex-col items-center justify-center rounded-[32px] border border-amber-300/40 bg-black/30 p-8 text-center shadow-2xl backdrop-blur-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-amber-300">VibesPro</p>
        <h1 className="mt-3 text-4xl font-black sm:text-5xl">Payment successful</h1>
        <p className="mt-4 text-sm leading-7 text-white/80 sm:text-base">{status}</p>
      </div>
    </div>
  );
}
