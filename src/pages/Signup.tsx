import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signUp } from "../lib/auth";
import { useLanguage } from "../contexts/LanguageContext";
import type { AppLanguage as Language } from "../lib/i18n";

export default function Signup() {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [loading, setLoading] = useState(false);
  const [languageStep, setLanguageStep] = useState<"choose-lang" | "choose-english-variant" | "continue">("choose-lang");
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(language);

  async function handleSignup(e?: FormEvent) {
    e?.preventDefault();
    setLoading(true);
    try {
      await signUp(email, password, firstName, lastName, selectedLanguage, dateOfBirth, gender);
      setLanguage(selectedLanguage);
      alert("Account created 🔥");
      navigate("/login");
    } catch (error) {
      alert("Signup failed");
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
        <form onSubmit={handleSignup} className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/60">
          <h1 className="text-4xl font-black text-center mb-2">{t("app.title")}</h1>
          <p className="text-center text-slate-600 mb-6">{t("signup.subtitle")}</p>

          <label className="block text-sm mb-2">{t("signup.firstName")}</label>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full rounded-2xl border px-3 py-2 mb-4"
            placeholder={t("signup.firstName")}
          />

          <label className="block text-sm mb-2">{t("signup.lastName")}</label>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full rounded-2xl border px-3 py-2 mb-4"
            placeholder={t("signup.lastName")}
          />

          <label className="block text-sm mb-2">{t("signup.dob")}</label>
          <input
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            type="date"
            className="w-full rounded-2xl border px-3 py-2 mb-4"
          />

          <label className="block text-sm mb-2">{t("signup.gender")}</label>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="w-full rounded-2xl border px-3 py-2 mb-4"
          >
            <option value="">{t("signup.genderSelect")}</option>
            <option value="female">{t("signup.gender.female")}</option>
            <option value="male">{t("signup.gender.male")}</option>
            <option value="nonbinary">{t("signup.gender.nonbinary")}</option>
            <option value="other">{t("signup.gender.other")}</option>
            <option value="prefer_not_to_say">{t("signup.gender.preferNotToSay")}</option>
          </select>

          <label className="block text-sm mb-2">{t("signup.email")}</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            className="w-full rounded-2xl border px-3 py-2 mb-4"
            placeholder={t("signup.email")}
          />

          <label className="block text-sm mb-2">{t("signup.password")}</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="w-full rounded-2xl border px-3 py-2 mb-4" />

          <p className="text-sm text-slate-600 mb-4">
            {t("signup.language")}: <span className="font-semibold">{selectedLanguage === "en-basic" ? t("lang.en-basic") : selectedLanguage === "en-street" ? t("lang.en-street") : t("lang.fr-fr")}</span>
          </p>

          <button type="submit" className="w-full bg-linear-to-r from-pink-500 to-pink-600 text-white py-3 rounded-2xl font-semibold mb-3" disabled={loading}>
            {loading ? t("signup.creating") : t("signup.button")}
          </button>

          <p className="text-center text-sm text-slate-600">
            {t("signup.loginText")} <Link to="/login" className="text-pink-600 font-semibold">{t("signup.loginLink")}</Link>
          </p>

          <button
            type="button"
            onClick={() => {
              setLanguageStep("choose-lang");
            }}
            className="w-full mt-4 text-sm text-slate-500 rounded-2xl border px-4 py-2"
          >
            Change Language
          </button>
        </form>
      </div>
    </div>
  );
}

