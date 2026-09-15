import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CloudSun, Eye, EyeOff } from "lucide-react";
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
  const [oauthComingSoon, setOauthComingSoon] = useState<"Google" | "Apple" | null>(null);
  const selectedLanguage: Language = language;

  // Always return to the feed after login to avoid returning to previous protected pages
  const returnTo = "/feed";

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
        };
        const created = await upsertProfileToSupabase(newProfile);
        if (created) await refreshSession();
      }

      setLanguage(selectedLanguage);
      navigate(returnTo, { replace: true });
    } catch (error) {
      alert(t("auth.loginFailed"));
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuthLogin(provider: "google" | "apple") {
    void provider;
    setOauthComingSoon(provider === "google" ? "Google" : "Apple");
    window.setTimeout(() => setOauthComingSoon(null), 3000);
  }

  return (
    <div className="app-screen min-h-screen overflow-hidden bg-linear-to-b from-sky-300 via-sky-100 to-white px-4 py-8 sm:px-6 sm:py-12">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-20 top-16 h-44 w-44 rounded-full bg-white/55 blur-2xl" />
        <div className="absolute -right-16 top-36 h-56 w-56 rounded-full bg-white/45 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-cyan-200/45 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-6rem)] max-w-md items-center justify-center">
        <form
          onSubmit={handleLogin}
          className="w-full rounded-4xl border border-white/80 bg-white/78 p-6 shadow-[0_24px_80px_rgba(14,116,144,0.2)] backdrop-blur-2xl sm:p-8"
        >
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-linear-to-br from-sky-500 to-cyan-400 text-white shadow-lg shadow-sky-400/30">
              <CloudSun className="h-9 w-9" aria-hidden="true" />
            </div>
            <h1 className="text-4xl font-black tracking-tight text-sky-950">Welcome back</h1>
            <p className="mt-2 text-sky-800/70">{t("login.subtitle")}</p>
          </div>

          <label className="mb-2 block text-sm font-semibold text-sky-950">{t("login.email")}</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="mb-4 w-full rounded-2xl border border-sky-200 bg-white/90 px-4 py-3 text-sky-950 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-200/70" />

          <label className="mb-2 block text-sm font-semibold text-sky-950">{t("login.password")}</label>
          <div className="relative mb-5">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? "text" : "password"}
              required
              className="w-full rounded-2xl border border-sky-200 bg-white/90 px-4 py-3 pr-12 text-sky-950 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-200/70"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-3 flex items-center text-sky-700"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          <button type="submit" className="mb-4 w-full rounded-2xl bg-linear-to-r from-sky-500 to-cyan-400 py-3.5 font-bold text-white shadow-lg shadow-sky-400/25 transition hover:-translate-y-0.5 disabled:opacity-60" disabled={loading}>
            {loading ? t("login.entering") : t("login.button")}
          </button>

          <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700/55">
            <span className="h-px flex-1 bg-sky-200" />
            <span>or</span>
            <span className="h-px flex-1 bg-sky-200" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => void handleOAuthLogin("google")} disabled={loading} className="flex items-center justify-center gap-2 rounded-2xl border border-sky-200 bg-white/90 px-4 py-3 font-semibold text-sky-950 transition hover:bg-white disabled:opacity-60">
              <span className="font-black text-blue-600" aria-hidden="true">G</span>
              {oauthComingSoon === "Google" ? "Coming soon" : "Google"}
            </button>
            <button type="button" onClick={() => void handleOAuthLogin("apple")} disabled={loading} className="flex items-center justify-center gap-2 rounded-2xl border border-sky-200 bg-white/90 px-4 py-3 font-semibold text-sky-950 transition hover:bg-white disabled:opacity-60">
              <span className="text-lg" aria-hidden="true"></span>
              {oauthComingSoon === "Apple" ? "Coming soon" : "Apple"}
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-sky-900/70">
            {t("login.signupText")} <Link to="/signup" className="font-bold text-sky-700 hover:text-sky-900">{t("login.signupLink")}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
