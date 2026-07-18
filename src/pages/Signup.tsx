import { useEffect, useMemo, useState, type FormEvent } from "react";
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
  const [showPassword, setShowPassword] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [gender, setGender] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(language);

  useEffect(() => {
    setSelectedLanguage(language);
  }, [language]);

  const monthOptions = useMemo(() => [
    { value: "01", label: "January" },
    { value: "02", label: "February" },
    { value: "03", label: "March" },
    { value: "04", label: "April" },
    { value: "05", label: "May" },
    { value: "06", label: "June" },
    { value: "07", label: "July" },
    { value: "08", label: "August" },
    { value: "09", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ], []);

  const dayOptions = useMemo(() => Array.from({ length: 30 }, (_, index) => String(index + 1).padStart(2, "0")), []);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 100 }, (_, index) => String(currentYear - index));
  }, []);

  const birthDateValue = useMemo(() => {
    if (!selectedYear || !selectedMonth || !selectedDay) return "";
    return `${selectedYear}-${selectedMonth}-${selectedDay}`;
  }, [selectedDay, selectedMonth, selectedYear]);

  useMemo(() => {
    setDateOfBirth(birthDateValue);
  }, [birthDateValue]);

  async function handleSignup(e?: FormEvent) {
    e?.preventDefault();
    setLoading(true);
    try {
      await signUp(email, password, firstName, lastName, selectedLanguage, birthDateValue, gender);
      setLanguage(selectedLanguage);
      alert(t("auth.accountCreated"));
      navigate("/login");
    } catch (error) {
      alert(t("auth.signupFailed"));
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-screen bg-linear-to-br from-pink-100 via-purple-100 to-blue-100 p-6 pt-32">
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
          <div className="grid grid-cols-1 gap-3 mb-4">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full rounded-2xl border px-3 py-2"
            >
              <option value="">Month</option>
              {monthOptions.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>

            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="w-full rounded-2xl border px-3 py-2"
            >
              <option value="">Day</option>
              {dayOptions.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full rounded-2xl border px-3 py-2"
            >
              <option value="">Year</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <input type="hidden" name="dateOfBirth" value={dateOfBirth} />

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
          <div className="relative mb-4">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? "text" : "password"}
              className="w-full rounded-2xl border px-3 py-2 pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-3 flex items-center text-sm font-semibold text-slate-600"
            >
              {showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
            </button>
          </div>

          <p className="text-sm text-slate-600 mb-4">
            {t("signup.language")}: <span className="font-semibold">{selectedLanguage === "en-basic" ? t("lang.en-basic") : selectedLanguage === "en-street" ? t("lang.en-street") : t("lang.fr-fr")}</span>
          </p>

          <button type="submit" className="w-full bg-linear-to-r from-pink-500 to-pink-600 text-white py-3 rounded-2xl font-semibold mb-3" disabled={loading}>
            {loading ? t("signup.creating") : t("signup.button")}
          </button>

          <p className="text-center text-sm text-slate-600">
            {t("signup.loginText")} <Link to="/login" className="text-pink-600 font-semibold">{t("signup.loginLink")}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

