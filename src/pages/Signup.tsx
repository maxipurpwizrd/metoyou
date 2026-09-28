import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { signUp } from "../lib/auth";
import { useLanguage } from "../contexts/LanguageContext";
import { CloudSun, Eye, EyeOff, Sparkles } from "lucide-react";

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

export default function Signup() {
  const { language, setLanguage, t } = useLanguage();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [oauthComingSoon, setOauthComingSoon] = useState<"Google" | "Apple" | null>(null);

  async function handleSignup(e?: FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setSignupError(null);

    try {
      const result = await signUp(email, password, firstName, lastName, language);
      const hasUser = Boolean(result?.user);

      if (!hasUser) {
        throw new Error("Signup failed: no user returned");
      }

      setLanguage(language);
      window.dispatchEvent(new Event("metoyou:signup-welcome"));
    } catch (error) {
      setSignupError("SignUp Failed, Please Try Again");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuthSignup(provider: "google" | "apple") {
    void provider;
    setOauthComingSoon(provider === "google" ? "Google" : "Apple");
    window.setTimeout(() => setOauthComingSoon(null), 3000);
  }

  return (
    <>
      {signupError ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sky-950/25 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-3xl border border-rose-200 bg-white p-6 text-center shadow-[0_24px_80px_rgba(14,116,144,0.22)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-500">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v6" />
                <circle cx="12" cy="16.5" r="1" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-black text-sky-950">SignUp Failed</h2>
            <p className="mt-2 text-sm font-medium text-sky-800/75">Please Try Again</p>
            <button
              type="button"
              onClick={() => setSignupError(null)}
              className="mt-5 w-full rounded-2xl bg-linear-to-r from-sky-500 to-cyan-400 px-4 py-3 font-bold text-white shadow-lg shadow-sky-400/25 transition hover:-translate-y-0.5"
            >
              Try Again
            </button>
          </div>
        </div>
      ) : null}

      <div className="app-screen min-h-screen overflow-hidden bg-linear-to-b from-sky-300 via-sky-100 to-white px-0 py-0">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-20 top-16 h-44 w-44 rounded-full bg-white/55 blur-2xl" />
        <div className="absolute -right-16 top-36 h-56 w-56 rounded-full bg-white/45 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-cyan-200/45 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-none items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
        <form onSubmit={handleSignup} className="w-full max-w-md rounded-none border-0 bg-white/78 p-6 shadow-none backdrop-blur-2xl sm:p-8">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-linear-to-br from-sky-500 to-cyan-400 text-white shadow-lg shadow-sky-400/30">
              <CloudSun className="h-9 w-9" aria-hidden="true" />
            </div>
            <h1 className="text-4xl font-black tracking-tight text-sky-950">Join And Shine</h1>
            <p className="mt-2 text-sky-800/70">A little space for your people and your moments.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-sky-950">{t("signup.firstName")}</label>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            className="w-full rounded-2xl border border-sky-200 bg-white/90 px-4 py-3 text-sky-950 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-200/70"
            placeholder={t("signup.firstName")}
          />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-sky-950">{t("signup.lastName")}</label>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            className="w-full rounded-2xl border border-sky-200 bg-white/90 px-4 py-3 text-sky-950 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-200/70"
            placeholder={t("signup.lastName")}
          />
            </div>
          </div>

          <label className="mb-2 mt-4 block text-sm font-semibold text-sky-950">{t("signup.email")}</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            className="mb-4 w-full rounded-2xl border border-sky-200 bg-white/90 px-4 py-3 text-sky-950 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-200/70"
            placeholder={t("signup.email")}
          />

          <label className="mb-2 block text-sm font-semibold text-sky-950">{t("signup.password")}</label>
          <div className="relative mb-5">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              className="w-full rounded-2xl border border-sky-200 bg-white/90 px-4 py-3 pr-12 text-sky-950 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-200/70"
              placeholder={t("signup.password")}
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

          <button type="submit" className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-sky-500 to-cyan-400 py-3.5 font-bold text-white shadow-lg shadow-sky-400/25 transition hover:-translate-y-0.5 disabled:opacity-60" disabled={loading}>
            <Sparkles className="h-5 w-5" aria-hidden="true" />
            {loading ? t("signup.creating") : t("signup.button")}
          </button>

          <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700/55">
            <span className="h-px flex-1 bg-sky-200" />
            <span>or</span>
            <span className="h-px flex-1 bg-sky-200" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => void handleOAuthSignup("google")} disabled={loading} className="flex items-center justify-center gap-2 rounded-2xl border border-sky-200 bg-white/90 px-4 py-3 font-semibold text-sky-950 transition hover:bg-white disabled:opacity-60">
              <GoogleIcon />
              {oauthComingSoon === "Google" ? "Coming soon" : "Google"}
            </button>
            <button type="button" onClick={() => void handleOAuthSignup("apple")} disabled={loading} className="flex items-center justify-center gap-2 rounded-2xl border border-sky-200 bg-white/90 px-4 py-3 font-semibold text-sky-950 transition hover:bg-white disabled:opacity-60">
              <AppleIcon />
              {oauthComingSoon === "Apple" ? "Coming soon" : "Apple"}
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-sky-900/70">
            {t("signup.loginText")} <Link to="/login" className="font-bold text-sky-700 hover:text-sky-900">{t("signup.loginLink")}</Link>
          </p>
        </form>
      </div>

    </div>
    </>
  );
}

