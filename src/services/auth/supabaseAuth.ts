import { supabase } from "@/lib/supabase";

export type AuthUser = {
  id: string;
  email: string;
};

export type AuthStateChangeCallback = (user: AuthUser | null) => void;

export async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  const user = data.user;
  if (!user || !user.id) {
    throw new Error("Authentication failed.");
  }

  return { user: { id: user.id, email: user.email ?? email } };
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function signUp(
  email: string,
  password: string,
  firstName?: string,
  lastName?: string,
  language?: string
) {
  const username = `${firstName || ""} ${lastName || ""}`.trim();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        first_name: firstName,
        last_name: lastName,
        language,
      },
    },
  });

  if (error) throw error;

  const user = data.user;
  if (!user || !user.id) {
    throw new Error("Sign up failed.");
  }

  if (user.id) {
    const { error: profileError } = await supabase.from("profiles").insert({
      id: user.id,
      username,
      email,
      bio: "",
      interests: [],
      hommies_count: 0,
      vibes_count: 0,
      snapshots_count: 0,
      language: language ?? null,
    });

    if (profileError) throw profileError;
  }

  return { user: { id: user.id, email: user.email ?? email } };
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;

  const user = data?.user;
  if (!user || !user.id) return null;
  return { id: user.id, email: user.email ?? "" };
}

export function onAuthStateChange(callback: AuthStateChangeCallback) {
  const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user;
    callback(user && user.id ? { id: user.id, email: user.email ?? "" } : null);
  });

  return () => {
    try {
      listener.subscription.unsubscribe();
    } catch {
      // ignore unsubscribe failures
    }
  };
}

export const authService = {
  login,
  logout,
  signUp,
  getCurrentUser,
  onAuthStateChange,
};
