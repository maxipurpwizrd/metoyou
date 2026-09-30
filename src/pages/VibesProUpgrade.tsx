import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../contexts/SessionContext";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../contexts/LanguageContext";

const FEATURES = [
  "vibespro.feature.goldBadge",
  "vibespro.feature.goldenPostcards",
  "vibespro.feature.voicePosts",
  "vibespro.feature.viewers",
  "vibespro.feature.customThemes",
  "vibespro.feature.falconSend",
  "vibespro.feature.faceToFace",
];

export default function VibesProUpgrade() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { profile: profileFromContext } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!profileFromContext) return null;

  async function handleSubscribe() {
    setLoading(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error(t("vibespro.checkoutAuthRequired"));

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({}),
      });

      const payload = await response.json();
      if (!response.ok || !payload.url) {
        throw new Error(payload.error || t("vibespro.checkoutError"));
      }

      window.location.assign(payload.url);
    } catch (err) {
      setError(err instanceof Error ? t("vibespro.checkoutError") : t("vibespro.checkoutError"));
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
          ← {t("vibespro.backSettings")}
        </button>

        <div className="rounded-[32px] border border-amber-300/40 bg-black/30 p-6 shadow-2xl backdrop-blur-2xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-amber-300">VibesPro</p>
              <h1 className="mt-3 text-4xl font-black sm:text-5xl">{t("vibespro.upgradeTitle")}</h1>
              <p className="mt-4 text-sm leading-7 text-white/80 sm:text-base">
                {t("vibespro.upgradeDescription")}
              </p>
            </div>

            <div className="rounded-3xl border border-amber-300/40 bg-amber-400/10 p-4 text-center">
              <p className="text-sm text-amber-200">{t("vibespro.monthly")}</p>
              <p className="mt-2 text-4xl font-black text-amber-300">$4.99</p>
              <p className="text-sm text-white/70">{t("vibespro.perMonth")}</p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {FEATURES.map((featureKey) => (
              <div key={featureKey} className="rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-white/85">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <span className="text-amber-300">✦</span>
                  {t(featureKey)}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-white/70">
              {t("vibespro.testCheckout")}
            </div>
            <button
              type="button"
              onClick={handleSubscribe}
              disabled={loading}
              className="rounded-full bg-amber-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? t("vibespro.preparingCheckout") : t("vibespro.subscribe")}
            </button>
          </div>

          {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
