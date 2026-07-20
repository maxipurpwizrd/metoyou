import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../lib/auth";
import { fetchProfileFromSupabase, upsertProfileToSupabase } from "../lib/profileApi";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../contexts/LanguageContext";
import { useSession } from "../contexts/SessionContext";
import type { Language } from "../lib/i18n";

export default function Login() {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  const { refreshSession } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(language);

  useEffect(() => {
    setSelectedLanguage(language);
  }, [language]);

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
        }
        await refreshSession();
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
        const created = await upsertProfileToSupabase(newProfile as any);
        if (created) await refreshSession();
      }

      setLanguage(selectedLanguage);
      navigate("/feed");
    } catch (error) {
      alert(t("auth.loginFailed"));
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-screen min-h-screen bg-linear-to-br from-pink-100 via-purple-100 to-blue-100 px-4 py-6 sm:px-7 lg:px-8">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center py-8 sm:py-12">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-md rounded-[32px] border border-white/70 bg-white/75 p-6 shadow-[0_20px_70px_rgba(15,23,42,0.14)] backdrop-blur-2xl sm:p-8"
        >
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-pink-500 to-purple-500 text-3xl text-white shadow-lg">
              💜
            </div>
            <h1 className="text-4xl font-black text-slate-900">{t("app.title")}</h1>
            <p className="mt-2 text-base text-slate-600">{t("login.subtitle")}</p>
          </div>

          <label className="mb-2 block text-sm font-semibold text-slate-700">{t("login.email")}</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="mb-4 w-full rounded-2xl border border-slate-200 bg-white/90 px-3 py-3 outline-none ring-0 transition focus:border-pink-400" />

          <label className="mb-2 block text-sm font-semibold text-slate-700">{t("login.password")}</label>
          <div className="relative mb-4">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? "text" : "password"}
              className="w-full rounded-2xl border border-slate-200 bg-white/90 px-3 py-3 pr-16 outline-none transition focus:border-pink-400"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-3 flex items-center text-sm font-semibold text-slate-600"
            >
              {showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
            </button>
          </div>

          <div className="mb-4 rounded-2xl bg-slate-50/80 px-3 py-3 text-sm text-slate-600">
            {t("login.language")}: <span className="font-semibold text-slate-800">{selectedLanguage === "en-basic" ? t("lang.en-basic") : selectedLanguage === "en-street" ? t("lang.en-street") : t("lang.fr-fr")}</span>
          </div>

          <button type="submit" onClick={(e) => handleLogin(e)} className="mb-4 w-full rounded-2xl bg-linear-to-r from-pink-500 to-purple-500 py-3 font-semibold text-white shadow-lg transition hover:scale-[1.01]" disabled={loading}>
            {loading ? t("login.entering") : t("login.button")}
          </button>

          <p className="text-center text-sm text-slate-600">
            {t("login.signupText")} <Link to="/signup" className="font-semibold text-pink-600">{t("login.signupLink")}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
