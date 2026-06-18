import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!data?.user) {
          navigate("/login");
        }
      } catch (e) {
        navigate("/login");
      } finally {
        if (isMounted) setChecking(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate("/login");
    });

    return () => {
      isMounted = false;
      try {
        sub?.subscription?.unsubscribe();
      } catch {}
    };
  }, [navigate]);

  if (checking) return null;
  return children;
}
