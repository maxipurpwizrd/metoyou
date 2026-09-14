import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { clearClientCaches } from "../lib/clearClientCaches";
import { queryClient } from "../lib/queryClient";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const previousUserRef = useRef<User | null>(null);

  useEffect(() => {
    let mounted = true;
    const clearOnLogout = () => {
      clearClientCaches();
      queryClient.clear();
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session && previousUserRef.current) {
        clearOnLogout();
      }
      setUser(data.session?.user ?? null);
      previousUserRef.current = data.session?.user ?? null;
      setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "SIGNED_OUT" || (!session && previousUserRef.current)) {
        clearOnLogout();
      }
      setUser(session?.user ?? null);
      previousUserRef.current = session?.user ?? null;
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      try {
        listener.subscription.unsubscribe();
      } catch (e) {}
    };
  }, []);

  return <AuthContext.Provider value={{ user, isLoading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
