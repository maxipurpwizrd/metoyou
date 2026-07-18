import { Link } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";

export default function AuthChoice() {
  const { t } = useLanguage();

  return (
    <div className="app-screen min-h-screen bg-linear-to-br from-pink-100 via-purple-100 to-blue-100 px-6 py-16 sm:px-8 lg:px-10">
      <div className="mx-auto flex max-w-5xl flex-col items-center text-center px-2 sm:px-4">
        <div className="mb-8 max-w-2xl rounded-full border border-white/60 bg-white/50 px-5 py-2 text-sm font-semibold text-slate-700 shadow-lg backdrop-blur-xl">
          {t("app.title")}
        </div>

        <h1 className="mb-4 text-4xl font-black text-slate-800 sm:text-5xl">
          {t("auth.chooseLanguage")}
        </h1>
        <p className="mb-10 max-w-xl text-lg text-slate-700 sm:text-xl">
          {t("home.description")}
        </p>

        <div className="grid w-full gap-4 sm:gap-6 grid-cols-2">
          <Link
            to="/signup"
            className="group rounded-[32px] border border-white/70 bg-white/70 p-8 text-left shadow-2xl backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-3xl"
          >
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-400 to-rose-500 text-3xl text-white shadow-lg">
              ✨
            </div>
            <h2 className="mb-3 text-2xl font-black text-slate-800">
              {t("auth.createAccount.title")}
            </h2>
            <p className="mb-6 text-base leading-7 text-slate-600">
              {t("auth.createAccount.description")}
            </p>
            <span className="inline-flex items-center rounded-full bg-pink-500 px-4 py-2 text-sm font-semibold text-white transition group-hover:bg-pink-600">
              {t("signup.button")} →
            </span>
          </Link>

          <Link
            to="/login"
            className="group rounded-[32px] border border-white/70 bg-gradient-to-br from-slate-900 to-slate-700 p-8 text-left text-white shadow-2xl transition duration-300 hover:-translate-y-1 hover:shadow-3xl"
          >
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-3xl shadow-lg">
              💬
            </div>
            <h2 className="mb-3 text-2xl font-black">
              {t("auth.login.title")}
            </h2>
            <p className="mb-6 text-base leading-7 text-slate-200">
              {t("auth.login.description")}
            </p>
            <span className="inline-flex items-center rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white transition group-hover:bg-white/25">
              {t("login.button")} →
            </span>
          </Link>
        </div>

        <Link
          to="/"
          className="mt-8 text-sm font-semibold text-slate-700 underline decoration-pink-400 underline-offset-4"
        >
          {t("auth.backHome")}
        </Link>
      </div>
    </div>
  );
}
