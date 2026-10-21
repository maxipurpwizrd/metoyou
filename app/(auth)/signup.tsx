import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { signUp } from "../../src/native/lib/auth";

export default function SignupScreen() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationRequired, setConfirmationRequired] = useState(false);
  const [oauthMessage, setOauthMessage] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setOauthMessage(null);
    setConfirmationRequired(false);
    setLoading(true);
    try {
      const result = await signUp(email.trim(), password, firstName.trim(), lastName.trim());
      if (!result.user) throw new Error("Your account could not be created. Please try again.");
      setConfirmationRequired(!result.session);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create your account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.flex}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
          <View style={styles.brandMark}><Text style={styles.brandSymbol}>☀</Text></View>
          <Text style={styles.title}>Join MeToYou</Text>
          <Text style={styles.subtitle}>Create your account</Text>

          <View style={styles.nameRow}>
            <View style={styles.nameField}>
              <Text style={styles.label}>First name</Text>
              <TextInput accessibilityLabel="First name" autoComplete="given-name" onChangeText={setFirstName} placeholder="First name" placeholderTextColor="#64748b" returnKeyType="next" style={styles.input} textContentType="givenName" value={firstName} />
            </View>
            <View style={styles.nameField}>
              <Text style={styles.label}>Last name</Text>
              <TextInput accessibilityLabel="Last name" autoComplete="family-name" onChangeText={setLastName} placeholder="Last name" placeholderTextColor="#64748b" returnKeyType="next" style={styles.input} textContentType="familyName" value={lastName} />
            </View>
          </View>

          <Text style={styles.label}>Email</Text>
          <TextInput accessibilityLabel="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" onChangeText={setEmail} placeholder="Email address" placeholderTextColor="#64748b" returnKeyType="next" style={styles.input} textContentType="emailAddress" value={email} />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput accessibilityLabel="Password" autoCapitalize="none" autoComplete="new-password" onChangeText={setPassword} onSubmitEditing={() => void submit()} placeholder="At least 6 characters" placeholderTextColor="#64748b" returnKeyType="go" secureTextEntry={!showPassword} style={[styles.input, styles.passwordInput]} textContentType="newPassword" value={password} />
            <Pressable accessibilityLabel={showPassword ? "Hide password" : "Show password"} accessibilityRole="button" onPress={() => setShowPassword((visible) => !visible)} style={styles.visibilityButton}>
              <Text style={styles.visibilityText}>{showPassword ? "Hide" : "Show"}</Text>
            </Pressable>
          </View>

          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {confirmationRequired ? (
            <View style={styles.confirmationBox}>
              <Text style={styles.confirmationTitle}>Check your email</Text>
              <Text style={styles.confirmationText}>Confirm your email address, then return here to sign in.</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={loading || !firstName.trim() || !lastName.trim() || !email.trim() || password.length < 6}
            onPress={() => void submit()}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, (loading || !firstName.trim() || !lastName.trim() || !email.trim() || password.length < 6) && styles.disabled]}
          >
            {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryText}>Create Account</Text>}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.divider} /><Text style={styles.dividerText}>OR</Text><View style={styles.divider} />
          </View>
          <View style={styles.oauthRow}>
            {(["Google", "Apple"] as const).map((provider) => (
              <Pressable key={provider} accessibilityRole="button" onPress={() => setOauthMessage(`${provider} sign-up is coming soon.`)} style={styles.oauthButton}>
                <Text style={styles.oauthText}>{provider}</Text>
              </Pressable>
            ))}
          </View>
          {oauthMessage ? <Text style={styles.notice}>{oauthMessage}</Text> : null}

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <Pressable accessibilityRole="link"><Text style={styles.link}>Sign in</Text></Pressable>
            </Link>
          </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#e8f8ff" },
  scrollContent: { flexGrow: 1, justifyContent: "center", padding: 20 },
  form: { width: "100%", maxWidth: 440, alignSelf: "center", borderWidth: 1, borderColor: "#dbeafe", borderRadius: 24, padding: 24, backgroundColor: "rgba(255,255,255,0.94)" },
  brandMark: { width: 58, height: 58, borderRadius: 20, alignSelf: "center", alignItems: "center", justifyContent: "center", backgroundColor: "#0ea5e9" },
  brandSymbol: { color: "#ffffff", fontSize: 32, fontWeight: "700" },
  title: { marginTop: 18, color: "#082f49", fontSize: 28, fontWeight: "800", textAlign: "center" },
  subtitle: { marginTop: 6, marginBottom: 24, color: "#0369a1", fontSize: 16, textAlign: "center" },
  nameRow: { flexDirection: "row", gap: 10 },
  nameField: { flex: 1 },
  label: { marginBottom: 7, color: "#0c4a6e", fontSize: 14, fontWeight: "700" },
  input: { minHeight: 50, marginBottom: 18, borderWidth: 1, borderColor: "#bae6fd", borderRadius: 14, paddingHorizontal: 14, color: "#0c4a6e", backgroundColor: "#ffffff", fontSize: 16 },
  passwordRow: { position: "relative", justifyContent: "center" },
  passwordInput: { width: "100%", paddingRight: 72 },
  visibilityButton: { position: "absolute", right: 8, top: 4, minHeight: 42, justifyContent: "center", paddingHorizontal: 10 },
  visibilityText: { color: "#0369a1", fontWeight: "700" },
  error: { marginBottom: 14, color: "#be123c", fontSize: 14, lineHeight: 20 },
  confirmationBox: { marginBottom: 14, borderWidth: 1, borderColor: "#bae6fd", borderRadius: 14, padding: 13, backgroundColor: "#f0f9ff" },
  confirmationTitle: { color: "#075985", fontSize: 15, fontWeight: "800" },
  confirmationText: { marginTop: 4, color: "#334155", fontSize: 14, lineHeight: 20 },
  primaryButton: { minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#0284c7" },
  primaryText: { color: "#ffffff", fontSize: 16, fontWeight: "800" },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.55 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 22 },
  divider: { flex: 1, height: 1, backgroundColor: "#bae6fd" },
  dividerText: { color: "#64748b", fontSize: 12, fontWeight: "700" },
  oauthRow: { flexDirection: "row", gap: 10 },
  oauthButton: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#bae6fd", borderRadius: 13, backgroundColor: "#ffffff" },
  oauthText: { color: "#0c4a6e", fontWeight: "700" },
  notice: { marginTop: 10, color: "#475569", textAlign: "center" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  footerText: { color: "#475569" },
  link: { color: "#0369a1", fontWeight: "800" },
});