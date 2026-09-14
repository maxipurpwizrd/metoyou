import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signUp } from "../lib/auth";
import { useLanguage } from "../contexts/LanguageContext";
import { CloudSun, Eye, EyeOff, Sparkles } from "lucide-react";

export default function Signup() {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthComingSoon, setOauthComingSoon] = useState<"Google" | "Apple" | null>(null);

  async function handleSignup(e?: FormEvent) {
    e?.preventDefault();
    setLoading(true);
    try {
      await signUp(email, password, firstName, lastName, language);
      setLanguage(language);
      alert(t("auth.accountCreated"));
      navigate("/login");
    } catch (error) {
      alert(t("auth.signupFailed"));
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
    <div className="app-screen min-h-screen overflow-hidden bg-linear-to-b from-sky-300 via-sky-100 to-white px-4 py-8 sm:px-6 sm:py-12">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-20 top-16 h-44 w-44 rounded-full bg-white/55 blur-2xl" />
        <div className="absolute -right-16 top-36 h-56 w-56 rounded-full bg-white/45 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-cyan-200/45 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-6rem)] max-w-md items-center justify-center">
        <form onSubmit={handleSignup} className="w-full rounded-4xl border border-white/80 bg-white/78 p-6 shadow-[0_24px_80px_rgba(14,116,144,0.2)] backdrop-blur-2xl sm:p-8">
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
              <span className="font-black text-blue-600" aria-hidden="true">G</span>
              {oauthComingSoon === "Google" ? "Coming soon" : "Google"}
            </button>
            <button type="button" onClick={() => void handleOAuthSignup("apple")} disabled={loading} className="flex items-center justify-center gap-2 rounded-2xl border border-sky-200 bg-white/90 px-4 py-3 font-semibold text-sky-950 transition hover:bg-white disabled:opacity-60">
              <span className="text-lg" aria-hidden="true"></span>
              {oauthComingSoon === "Apple" ? "Coming soon" : "Apple"}
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-sky-900/70">
            {t("signup.loginText")} <Link to="/login" className="font-bold text-sky-700 hover:text-sky-900">{t("signup.loginLink")}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

