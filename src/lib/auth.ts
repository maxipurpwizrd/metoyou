import { supabase } from "./supabase";

export async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
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
        language: language ?? "English",
      });

    if (profileError) {
      console.log("PROFILE INSERT ERROR:", profileError);
    }
  }

  return data;
}

export async function logout() {
  await supabase.auth.signOut();
}
