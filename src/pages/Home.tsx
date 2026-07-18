import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";
import type { AppLanguage } from "../lib/i18n";

export default function Home() {
  const { language, setLanguage, t } = useLanguage();
  const [showThemeNotice, setShowThemeNotice] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);

  useEffect(() => {
    if (!showThemeNotice) return;

    const timer = window.setTimeout(() => {
      setShowThemeNotice(false);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [showThemeNotice]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-language-menu-root]")) {
        setShowLanguageMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatLanguageLabel = (value: string) => {
    if (value === "en-basic") return "EN";
    if (value === "en-street") return "SL";
    if (value === "fr-fr") return "FR";
    return value.toUpperCase();
  };

  const languageOptions: Array<{ value: AppLanguage; label: string; short: string }> = [
    { value: "en-basic", label: t("lang.en-basic"), short: "EN" },
    { value: "en-street", label: t("lang.en-street"), short: "SL" },
    { value: "fr-fr", label: t("lang.fr-fr"), short: "FR" },
  ];

  return (
    <>

      <div className="app-screen relative bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 overflow-hidden">
        <div className="absolute top-4 left-4 z-20" data-language-menu-root>
          <div className="relative">
            <button
              onClick={() => setShowLanguageMenu((prev) => !prev)}
              className="flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-700 shadow-lg backdrop-blur-xl transition hover:scale-105"
            >
              <span className="text-base">🌐</span>
              <span>{formatLanguageLabel(language)}</span>
            </button>

            {showLanguageMenu && (
              <div className="absolute left-0 mt-2 w-48 rounded-2xl border border-white/70 bg-white/90 p-2 shadow-2xl backdrop-blur-xl">
                {languageOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setLanguage(option.value);
                      setShowLanguageMenu(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium transition ${language === option.value ? "bg-pink-100 text-pink-700" : "text-slate-700 hover:bg-slate-100"}`}
                  >
                    <span>{option.label}</span>
                    <span className="text-xs font-semibold opacity-70">{option.short}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2">
          <button
            onClick={() => setShowThemeNotice(true)}
            className="rounded-full border border-white/60 bg-white/60 px-4 py-2 text-sm font-semibold text-slate-700 shadow-lg backdrop-blur-xl"
          >
            🎨 {t("home.theme")}
          </button>
          {showThemeNotice && (
            <div className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 shadow-md">
              {t("home.themeComingSoon")}
            </div>
          )}
        </div>

        {/* Hero */}
        <section className="px-6 py-20 text-center">

          <div className="max-w-5xl mx-auto">

            <div className="inline-flex px-5 py-2 rounded-full bg-white/40 backdrop-blur-2xl border border-white/50 shadow-xl mb-8">
              {t("home.heroLabel")}
            </div>

            <h1 className="text-7xl md:text-8xl font-black text-gray-800 mb-6">
              {t("home.title")}
            </h1>

            <p className="text-xl md:text-2xl text-gray-700 max-w-3xl mx-auto mb-10">
              {t("home.description")}
            </p>

            <div className="flex flex-wrap justify-center gap-4">

              <Link
                to="/welcome"
                className="bg-linear-to-r from-pink-500 to-purple-500 text-white px-8 py-4 rounded-2xl font-bold shadow-xl hover:scale-105 transition"
              >
                {t("home.enter")}
              </Link>

              <Link
                to="/about"
                className="bg-white/40 backdrop-blur-2xl border border-white/50 px-8 py-4 rounded-2xl font-bold shadow-xl"
              >
                {t("home.learnMore")}
              </Link>

            </div>

          </div>

        </section>

        {/* Showcase Cards */}
        <section className="px-6 pb-20">

          <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6">

            <div className="bg-white/40 backdrop-blur-2xl border border-white/50 rounded-3xl p-8 shadow-xl">
              <div className="text-5xl mb-4">💬</div>

              <h2 className="text-2xl font-bold mb-3">
                {t("home.card.conversations.title")}
              </h2>

              <p className="text-gray-700">
                {t("home.card.conversations.description")}
              </p>
            </div>

            <div className="bg-white/40 backdrop-blur-2xl border border-white/50 rounded-3xl p-8 shadow-xl">
              <div className="text-5xl mb-4">❤️</div>

              <h2 className="text-2xl font-bold mb-3">
                {t("home.card.family.title")}
              </h2>

              <p className="text-gray-700">
                {t("home.card.family.description")}
              </p>
            </div>

            <div className="bg-white/40 backdrop-blur-2xl border border-white/50 rounded-3xl p-8 shadow-xl">
              <div className="text-5xl mb-4">🌍</div>

              <h2 className="text-2xl font-bold mb-3">
                {t("home.card.community.title")}
              </h2>

              <p className="text-gray-700">
                {t("home.card.community.description")}
              </p>
            </div>

          </div>

        </section>

        {/* Vision */}
        <section className="px-6 pb-24">

          <div className="max-w-4xl mx-auto bg-white/40 backdrop-blur-2xl border border-white/50 rounded-3xl p-10 shadow-xl text-center">

            <h2 className="text-4xl font-black mb-6">
              {t("home.vision.title")}
            </h2>

            <p className="text-lg text-gray-700 leading-relaxed">
              {t("home.vision.description")}
            </p>

          </div>

        </section>

      </div>

    </>
  );
}