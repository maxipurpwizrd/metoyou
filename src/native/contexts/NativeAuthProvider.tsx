import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { nativeSupabase } from "../lib/supabase";

type NativeAuthContextValue = {
  session: Session | null;
  loading: boolean;
};

const NativeAuthContext = createContext<NativeAuthContextValue | undefined>(undefined);

export function NativeAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void nativeSupabase.auth.getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    const { data: { subscription } } = nativeSupabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <NativeAuthContext.Provider value={{ session, loading }}>
      {children}
    </NativeAuthContext.Provider>
  );
}

export function useNativeAuth() {
  const context = useContext(NativeAuthContext);
  if (!context) throw new Error("useNativeAuth must be used within NativeAuthProvider");
  return context;
}