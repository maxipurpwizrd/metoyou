import { supabase } from "./supabase";
import { normalizeLanguage } from "./i18n";

export async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function signUpWithOAuth(provider: "google" | "apple") {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/feed`,
    },
  });

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
  const normalizedLanguage = normalizeLanguage(language);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        first_name: firstName,
        last_name: lastName,
        language: normalizedLanguage,
      },
    },
  });

  if (error) throw error;

  if (data.user) {
    const { error: profileError } =
      await supabase.from("profiles").insert({
        id: data.user.id,
        username,
        email,
        bio: "",
        interests: [],
        hommies_count: 0,
        vibes_count: 0,
        snapshots_count: 0,
        language: normalizedLanguage,
      });

    if (profileError) throw profileError;
  }

  return data;
}

