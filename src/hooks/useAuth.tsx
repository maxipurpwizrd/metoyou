import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { clearClientCaches } from "../lib/clearClientCaches";
import { queryClient } from "../lib/queryClient";
import { clearUserScopedClientState } from "../lib/authStateIsolation";
import { setAuthBoundaryUser, teardownUserRealtimeChannels } from "../lib/authBoundary";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const previousUserRef = useRef<User | null>(null);
  const authTransitionRef = useRef(0);

  useEffect(() => {
    let mounted = true;

    const applyAuthState = async (nextUser: User | null) => {
      const previousUserId = previousUserRef.current?.id ?? null;
      const nextUserId = nextUser?.id ?? null;
      const changed = previousUserId !== nextUserId;
      const transitionId = ++authTransitionRef.current;
      previousUserRef.current = nextUser;

      if (changed) {
        setAuthBoundaryUser(nextUserId);
        await teardownUserRealtimeChannels();
        clearUserScopedClientState({ previousUserId, nextUserId, routeKey: 'metoyou:last-auth-route' });
      }

      if (!nextUser && previousUserId) {
        clearClientCaches();
        queryClient.clear();
      }

      if (!mounted || transitionId !== authTransitionRef.current) return;
      setUser(nextUser);
      setIsLoading(false);
    };

    const clearOnLogout = () => {
      clearUserScopedClientState({ previousUserId: previousUserRef.current?.id, nextUserId: null, routeKey: 'metoyou:last-auth-route' });
      clearClientCaches();
      queryClient.clear();
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const nextUser = data.session?.user ?? null;
      void applyAuthState(nextUser);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      const nextUser = session?.user ?? null;
      if (event === "SIGNED_OUT" || (!session && previousUserRef.current)) {
        clearOnLogout();
      }
      void applyAuthState(nextUser);
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
