import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";

export default function LoginWelcomePopup() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = () => setVisible(true);
    window.addEventListener("metoyou:login-welcome", show);
    return () => window.removeEventListener("metoyou:login-welcome", show);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timeout = window.setTimeout(() => {
      setVisible(false);
      navigate("/feed", { replace: true });
    }, 4000);
    return () => window.clearTimeout(timeout);
  }, [navigate, visible]);

  const close = () => {
    setVisible(false);
    navigate("/feed", { replace: true });
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-10000 grid place-items-center bg-sky-950/25 p-4 backdrop-blur-sm" role="status" aria-live="polite" onClick={close}>
      <div className="w-full max-w-sm animate-[fade-in_220ms_ease-out] rounded-4xl border border-white/80 bg-white/90 p-7 text-center text-sky-950 shadow-[0_24px_80px_rgba(14,116,144,0.28)]" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-linear-to-br from-sky-500 to-cyan-400 text-white shadow-lg shadow-cyan-400/30">
          <Sparkles className="h-8 w-8" aria-hidden="true" />
        </div>
        <h2 className="mt-5 text-2xl font-black">Welcome Back Twin</h2>
        <p className="mt-2 text-sm font-medium leading-6 text-sky-800/75">There is no time to waste, your homies are waiting for you.</p>
        <div className="mx-auto mt-5 h-1.5 w-32 overflow-hidden rounded-full bg-sky-100">
          <div className="h-full w-full origin-left animate-[shrink_4s_linear] rounded-full bg-linear-to-r from-sky-500 to-cyan-400" />
        </div>
      </div>
    </div>
  );
}