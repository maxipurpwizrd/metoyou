import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../lib/auth";
import { fetchProfileFromSupabase, upsertProfileToSupabase } from "../lib/profileApi";
import { saveProfile } from "../utils/profileStorage";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../contexts/LanguageContext";
import type { Language } from "../lib/i18n";

export default function Login() {
  const navigate = useNavigate();
  const { setLanguage, t } = useLanguage();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [languageStep, setLanguageStep] = useState<"choose-lang" | "choose-english-variant" | "continue">("choose-lang");
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("en-basic");

  async function handleLogin(e?: FormEvent) {
    e?.preventDefault();
    setLoading(true);
    try {
      await login(email, password);

      // after login, load or create profile and apply language choice
      const remote = await fetchProfileFromSupabase();
      if (remote) {
        // if remote language differs from selection, update remote
        if (remote.language !== selectedLanguage) {
          await upsertProfileToSupabase({ ...remote, language: selectedLanguage });
          saveProfile({ ...remote, language: selectedLanguage });
        } else {
          saveProfile(remote);
        }
      } else {
        // create minimal profile with selected language
        const { data } = await supabase.auth.getUser();
        const userId = data?.user?.id;
        const newProfile = {
          id: userId ?? "",
          username: email.split("@")[0],
          email,
          bio: "",
          profilePic: null,
          interests: [],
          hommies_count: 0,
          snapshots_count: 0,
          vibes_count: 0,
          language: selectedLanguage,
          dateOfBirth: "",
          gender: "",
        };
        await upsertProfileToSupabase(newProfile as any);
        saveProfile(newProfile as any);
      }

      setLanguage(selectedLanguage);
      navigate("/feed");
    } catch (error) {
      alert("Login failed");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  if (languageStep === "choose-lang") {
    return (
      <div className="min-h-screen bg-linear-to-br from-pink-100 via-purple-100 to-blue-100 p-6 pt-32">
        <div className="max-w-md mx-auto">
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/60">
            <h1 className="text-4xl font-black text-center mb-2">{t("app.title")}</h1>
            <p className="text-center text-slate-600 mb-6">Choose your language</p>

            <div className="space-y-3">
              <button
                onClick={() => {
                  setSelectedLanguage("en-basic");
                  setLanguageStep("choose-english-variant");
                }}
                className="w-full rounded-2xl border px-4 py-3 text-left hover:bg-blue-50"
              >
                {t("lang.en-basic")}
              </button>
              <button
                onClick={() => {
                  setSelectedLanguage("en-street");
                  setLanguageStep("choose-english-variant");
                }}
                className="w-full rounded-2xl border px-4 py-3 text-left hover:bg-blue-50"
              >
                {t("lang.en-street")}
              </button>
              <button
                onClick={() => {
                  setSelectedLanguage("fr-fr");
                  setLanguageStep("continue");
                }}
                className="w-full rounded-2xl border px-4 py-3 text-left hover:bg-blue-50"
              >
                {t("lang.fr-fr")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (languageStep === "choose-english-variant") {
    return (
      <div className="min-h-screen bg-linear-to-br from-pink-100 via-purple-100 to-blue-100 p-6 pt-32">
        <div className="max-w-md mx-auto">
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/60">
            <h1 className="text-4xl font-black text-center mb-2">{t("app.title")}</h1>
            <p className="text-center text-slate-600 mb-6">Pick your vibe</p>

            <div className="space-y-3 mb-4">
              <label className="flex items-center gap-3 rounded-2xl border px-4 py-3 cursor-pointer">
                <input
                  type="radio"
                  checked={selectedLanguage === "en-basic"}
                  onChange={() => setSelectedLanguage("en-basic")}
                />
                <span>Basic English</span>
              </label>
              <label className="flex items-center gap-3 rounded-2xl border px-4 py-3 cursor-pointer">
                <input
                  type="radio"
                  checked={selectedLanguage === "en-street"}
                  onChange={() => setSelectedLanguage("en-street")}
                />
                <span>Street Slang</span>
              </label>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setLanguageStep("choose-lang")} className="flex-1 rounded-2xl border px-4 py-2">
                Back
              </button>
              <button onClick={() => setLanguageStep("continue")} className="flex-1 rounded-2xl bg-blue-600 text-white px-4 py-2">
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-pink-100 via-purple-100 to-blue-100 p-6 pt-32">
      <div className="max-w-md mx-auto">
        <form onSubmit={handleLogin} className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/60">
          <h1 className="text-4xl font-black text-center mb-2">{t("app.title")}</h1>
          <p className="text-center text-slate-600 mb-6">{t("login.subtitle")}</p>

          <label className="block text-sm mb-2">{t("login.email")}</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full rounded-2xl border px-3 py-2 mb-4" />

          <label className="block text-sm mb-2">{t("login.password")}</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="w-full rounded-2xl border px-3 py-2 mb-4" />

          <p className="text-sm text-slate-600 mb-4">
            {t("login.language")}: <span className="font-semibold">{selectedLanguage === "en-basic" ? t("lang.en-basic") : selectedLanguage === "en-street" ? t("lang.en-street") : t("lang.fr-fr")}</span>
          </p>

          <button type="submit" onClick={(e) => handleLogin(e)} className="w-full bg-linear-to-r from-pink-500 to-pink-600 text-white py-3 rounded-2xl font-semibold mb-3" disabled={loading}>
            {loading ? t("login.entering") : t("login.button")}
          </button>

          <p className="text-center text-sm text-slate-600">
            {t("login.signupText")} <Link to="/signup" className="text-pink-600 font-semibold">{t("login.signupLink")}</Link>
          </p>

          <button
            type="button"
            onClick={() => setLanguageStep("choose-lang")}
            className="w-full mt-4 text-sm text-slate-500 rounded-2xl border px-4 py-2"
          >
            Change Language
          </button>
        </form>
      </div>
    </div>
  );
}
