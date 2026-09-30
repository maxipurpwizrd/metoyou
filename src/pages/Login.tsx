import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CloudSun, Eye, EyeOff } from "lucide-react";
import { login } from "../lib/auth";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path d="M21.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5.4c-.2 1.1-1.4 3.4-5.4 3.4-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.5.8 4.8 2.1l2.8-2.8C17.2 2.6 14.8 1.8 12 1.8 6.9 1.8 2.8 5.9 2.8 11c0 5.2 4.1 9.3 9.2 9.3 5.3 0 9-3.9 9-9.2Z" fill="#4285F4"/>
      <path d="M12 20.3c2.6 0 4.8-.8 6.4-2.2l-3.1-2.5c-.8.5-1.8.8-3.3.8-2.6 0-4.7-1.8-5.4-4.1H.8v2.6A9.3 9.3 0 0 0 12 20.3Z" fill="#34A853"/>
      <path d="M6.6 14.1A5.6 5.6 0 0 1 6.2 12c0-.6.1-1.2.4-1.7V7.7H3.4A9.2 9.2 0 0 0 2.5 12c0 1.5.4 2.9 1 4.1l3.1-2Z" fill="#FBBC05"/>
      <path d="M12 4.8c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.1 9.1 0 0 0 12 1.8 9.3 9.3 0 0 0 3.4 7.7l3.2 2.6c.7-2.3 2.8-4 5.4-4Z" fill="#EA4335"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M16.7 12.7c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-2-1.5-.2-2.9.9-3.6.9-.8 0-2-.9-3.2-.9-1.7 0-3.2 1-4.1 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.1 1.7 2.4 3 2.3 1.2-.1 1.7-.8 3.1-.8s1.9.8 3.1.8c1.3 0 2.1-1.1 3-2.2.9-1.4 1.3-2.8 1.3-2.9-.1 0-2.8-1.1-4.2-3.4ZM15.8 4.5c.7-.8 1.1-1.9 1-3.1-.9.1-2.1.6-2.8 1.4-.6.7-1.2 1.8-1 3 .9.1 2.1-.5 2.8-1.3Z"/>
    </svg>
  );
}
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
      window.dispatchEvent(new Event("metoyou:login-welcome"));
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
    <div className="app-screen min-h-screen overflow-hidden bg-linear-to-b from-sky-300 via-sky-100 to-white px-0 py-0">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-20 top-16 h-44 w-44 rounded-full bg-white/55 blur-2xl" />
        <div className="absolute -right-16 top-36 h-56 w-56 rounded-full bg-white/45 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-cyan-200/45 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-none items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-md rounded-none border-0 bg-white/78 p-6 shadow-none backdrop-blur-2xl sm:p-8"
        >
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-linear-to-br from-sky-500 to-cyan-400 text-white shadow-lg shadow-sky-400/30">
              <CloudSun className="h-9 w-9" aria-hidden="true" />
            </div>
            <h1 className="text-4xl font-black tracking-tight text-sky-950">{t("login.welcomeTitle")}</h1>
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
            <span>{t("auth.or")}</span>
            <span className="h-px flex-1 bg-sky-200" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => void handleOAuthLogin("google")} disabled={loading} className="flex items-center justify-center gap-2 rounded-2xl border border-sky-200 bg-white/90 px-4 py-3 font-semibold text-sky-950 transition hover:bg-white disabled:opacity-60">
              <GoogleIcon />
              {oauthComingSoon === "Google" ? t("auth.comingSoon") : "Google"}
            </button>
            <button type="button" onClick={() => void handleOAuthLogin("apple")} disabled={loading} className="flex items-center justify-center gap-2 rounded-2xl border border-sky-200 bg-white/90 px-4 py-3 font-semibold text-sky-950 transition hover:bg-white disabled:opacity-60">
              <AppleIcon />
              {oauthComingSoon === "Apple" ? t("auth.comingSoon") : "Apple"}
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
