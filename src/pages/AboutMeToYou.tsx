import { Link } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";

export default function AboutMeToYou() {
  const { t } = useLanguage();

  return (
    <div className="app-screen min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(244,114,182,0.25),_transparent_40%),linear-gradient(135deg,_#fef2f2_0%,_#f5f3ff_45%,_#eff6ff_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="rounded-[32px] border border-white/70 bg-white/75 p-5 shadow-[0_20px_80px_rgba(15,23,42,0.12)] backdrop-blur-2xl sm:p-8 lg:p-10">
          <div className="mb-6 flex items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-pink-600">{t("about.royalMessage")}</p>
              <h1 className="text-3xl font-black text-slate-900 sm:text-4xl">{t("app.title")}</h1>
            </div>
            <Link
              to="/"
              className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white"
            >
              {t("profile.back")}
            </Link>
          </div>

          <div className="space-y-6 text-slate-700">
            <p className="text-lg leading-8">
              {t("about.intro")}
            </p>

            <div className="rounded-[28px] border border-pink-100 bg-gradient-to-br from-pink-50/80 to-white p-6 shadow-inner">
              <h2 className="mb-3 text-2xl font-black text-slate-900">{t("home.card.conversations.title")}</h2>
              <ul className="space-y-3 text-base leading-7">
                <li>• {t("about.feature1")}</li>
                <li>• {t("about.feature2")}</li>
                <li>• {t("about.feature3")}</li>
                <li>• {t("about.feature4")}</li>
              </ul>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-6">
              <h2 className="mb-3 text-2xl font-black text-slate-900">{t("home.vision.title")}</h2>
              <p className="text-base leading-8">
                {t("about.vision")}
              </p>
            </div>

            <div className="rounded-[28px] border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6">
              <h2 className="mb-3 text-2xl font-black text-slate-900">{t("settings.profileLabel")}</h2>
              <p className="text-base leading-8">
                {t("about.founder")}
              </p>
            </div>

            <div className="rounded-[28px] border border-indigo-200 bg-indigo-50/70 p-6">
              <h2 className="mb-3 text-2xl font-black text-slate-900">{t("about.contactTitle")}</h2>
              <div className="space-y-2 text-base leading-7">
                <p><span className="font-semibold">{t("about.contactLabel")}:</span> wwwmaxipop48@gmail.com</p>
                <p><span className="font-semibold">{t("about.contactLabel")}:</span> www.metoyouvibes@gmail.com</p>
                <p><span className="font-semibold">{t("about.contactLabel")}:</span> wizrdai@gmail.com</p>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white/80 p-6 text-center">
              <p className="text-xl font-black uppercase tracking-[0.25em] text-slate-800">{t("app.title")}</p>
              <p className="mt-2 text-base text-slate-600">{t("about.cta")}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
