import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getProfile } from "../utils/profileStorage";

const FEATURES = [
  "Gold badge",
  "Golden postcards",
  "2-minute voice posts",
  "Profile/Post viewers",
  "Custom themes",
  "Falcon Send",
  "FaceToFace",
];

export default function VibesProUpgrade() {
  const navigate = useNavigate();
  const profile = getProfile();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profile.id, email: profile.email }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.url) {
        throw new Error(payload.error || "Unable to start checkout.");
      }

      window.location.assign(payload.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start checkout.");
      setLoading(false);
    }
  }

  return (
    <div className="app-screen bg-[radial-gradient(circle_at_top,_rgba(255,215,0,0.2),_transparent_40%),linear-gradient(135deg,_#0f172a,_#1e293b)] p-6 pb-24 text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-fit rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur"
        >
          ← Back to Settings
        </button>

        <div className="rounded-[32px] border border-amber-300/40 bg-black/30 p-6 shadow-2xl backdrop-blur-2xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-amber-300">VibesPro</p>
              <h1 className="mt-3 text-4xl font-black sm:text-5xl">Upgrade to unlock the next level</h1>
              <p className="mt-4 text-sm leading-7 text-white/80 sm:text-base">
                This is the subscription gateway only. The premium features are gated behind the same infrastructure so they can be unlocked safely later.
              </p>
            </div>

            <div className="rounded-3xl border border-amber-300/40 bg-amber-400/10 p-4 text-center">
              <p className="text-sm text-amber-200">Monthly</p>
              <p className="mt-2 text-4xl font-black text-amber-300">$4.99</p>
              <p className="text-sm text-white/70">per month</p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {FEATURES.map((feature) => (
              <div key={feature} className="rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-white/85">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <span className="text-amber-300">✦</span>
                  {feature}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-white/70">
              Test mode checkout is enabled. No real card charges will be created.
            </div>
            <button
              type="button"
              onClick={handleSubscribe}
              disabled={loading}
              className="rounded-full bg-amber-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Preparing checkout…" : "Subscribe for $4.99/month"}
            </button>
          </div>

          {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
