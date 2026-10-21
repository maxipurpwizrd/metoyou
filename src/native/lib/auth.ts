import { DEFAULT_LANGUAGE, normalizeLanguage } from "../../lib/i18n";
import { nativeSupabase } from "./supabase";

export async function signIn(email: string, password: string) {
  const { data, error } = await nativeSupabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  const metadata = data.user.user_metadata;
  const metadataUsername = metadata.username;
  const username =
    typeof metadataUsername === "string" && metadataUsername.trim()
      ? metadataUsername
      : email.split("@")[0];
  const metadataLanguage = metadata.language;
  const language =
    typeof metadataLanguage === "string"
      ? normalizeLanguage(metadataLanguage)
      : DEFAULT_LANGUAGE;

  const { data: profile, error: profileError } = await nativeSupabase
    .from("profiles")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) throw profileError;

  if (!profile) {
    const { error: insertError } = await nativeSupabase.from("profiles").upsert({
      id: data.user.id,
      username,
      email,
      bio: "",
      profile_pic: null,
      interests: [],
      hommies_count: 0,
      snapshots_count: 0,
      vibes_count: 0,
      language,
    });
    if (insertError) throw insertError;
  }

  return data;
}

export async function signUp(email: string, password: string, firstName: string, lastName: string) {
  const username = `${firstName} ${lastName}`.trim();
  const language = normalizeLanguage(DEFAULT_LANGUAGE);

  const { data, error } = await nativeSupabase.auth.signUp({
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

  if (data.user && data.session) {
    const { error: profileError } = await nativeSupabase.from("profiles").insert({
      id: data.user.id,
      username,
      email,
      bio: "",
      interests: [],
      hommies_count: 0,
      vibes_count: 0,
      snapshots_count: 0,
      language,
    });
    if (profileError) throw profileError;
  }

  return data;
}