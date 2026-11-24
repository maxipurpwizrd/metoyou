import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { nativeSupabase } from "../lib/supabase";
import { useNativeAuth } from "../contexts/NativeAuthProvider";
import { useNativeEntitlement } from "../contexts/NativeEntitlementProvider";
import { DEFAULT_LANGUAGE, normalizeLanguage, type AppLanguage } from "../../lib/i18n";
import type { NativeProfile } from "../lib/profile";
import { NATIVE_THEME_COLORS, NATIVE_THEME_OPTIONS, NATIVE_TYPE_SCALE, useNativeTheme } from "../contexts/NativeThemeProvider";
import NativeGlassSurface, { NATIVE_LIQUID_GLASS_PRESSED } from "./NativeGlassSurface";
import NativeBlurBackdrop from "./NativeBlurBackdrop";
import NativeHoldToConfirmDialog from "./NativeHoldToConfirmDialog";
import { NativeSettingsSkeleton } from "./NativeScreenSkeletons";
import {
  getNativePushRegistrationStatus,
  NATIVE_PUSH_REGISTRATION_STAGES,
  subscribeToNativePushRegistrationStatus,
  type NativePushRegistrationStatus,
} from "../lib/pushRegistration";

type EditField = "name" | "username" | "picture" | null;
type ProfileSettings = NativeProfile & {
  first_name?: string | null;
  is_admin?: boolean | null;
  language?: string | null;
};

const LANGUAGE_OPTIONS: Array<{ value: AppLanguage; label: string; helper: string }> = [
  { value: "en-basic", label: "Basic English", helper: "Clear, standard English" },
  { value: "en-street", label: "Street Slang", helper: "MeToYou street style" },
  { value: "fr-fr", label: "French", helper: "Français" },
];

const PUSH_REGISTRATION_LABELS: Record<NativePushRegistrationStatus["state"], string> = {
  checking: "Checking",
  registered: "Registered",
  "permission-denied": "Permission needed",
  unsupported: "Unavailable",
  failed: "Registration failed",
};

function decodeBase64(value: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const binaryLength = Math.floor((value.length * 3) / 4) -
    (value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0);
  const bytes = new Uint8Array(binaryLength);
  let byteIndex = 0;
  for (let index = 0; index < value.length; index += 4) {
    const first = alphabet.indexOf(value[index]);
    const second = alphabet.indexOf(value[index + 1]);
    const third = alphabet.indexOf(value[index + 2]);
    const fourth = alphabet.indexOf(value[index + 3]);
    const combined = (first << 18) | (second << 12) | ((third & 63) << 6) | (fourth & 63);
    if (byteIndex < binaryLength) bytes[byteIndex++] = (combined >> 16) & 255;
    if (byteIndex < binaryLength) bytes[byteIndex++] = (combined >> 8) & 255;
    if (byteIndex < binaryLength) bytes[byteIndex++] = combined & 255;
  }
  return bytes;
}

export default function NativeSettingsScreen() {
  const router = useRouter();
  const { session, signOutNative } = useNativeAuth();
  const { entitlement, refresh: refreshEntitlement } = useNativeEntitlement();
  const { theme, setTheme, isVibesPro: accountCanUseBlueSky } = useNativeTheme();
  const isBlueSky = theme === "bluesky";
  const colors = NATIVE_THEME_COLORS[theme];
  const isLiquidGlass = theme === "liquidGlass";
  const userId = session?.user.id;
  const [profile, setProfile] = useState<ProfileSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [editField, setEditField] = useState<EditField>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [language, setLanguage] = useState<AppLanguage>(DEFAULT_LANGUAGE);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportDescription, setSupportDescription] = useState("");
  const [supportBusy, setSupportBusy] = useState(false);
  const [supportMessage, setSupportMessage] = useState<string | null>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [pushRegistrationStatus, setPushRegistrationStatus] = useState(getNativePushRegistrationStatus);

  useEffect(() => subscribeToNativePushRegistrationStatus(setPushRegistrationStatus), []);

  const isVibesPro = entitlement.status === "vibesPro";
  const firstName =
    profile?.first_name ??
    (typeof session?.user.user_metadata.first_name === "string" ? session.user.user_metadata.first_name : "") ??
    "";
  const displayName = firstName || profile?.username || session?.user.email?.split("@")[0] || "MeToYou member";

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setScreenError(null);
    try {
      const { data, error } = await nativeSupabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Your profile could not be found.");
      setProfile(data as ProfileSettings);
      const storedLanguage = await AsyncStorage.getItem("metoyou-language");
      setLanguage(normalizeLanguage(
        storedLanguage ??
        (typeof data.language === "string" ? data.language : undefined) ??
        (typeof session?.user.user_metadata.language === "string" ? session.user.user_metadata.language : undefined),
      ));
    } catch (cause) {
      setScreenError(cause instanceof Error ? cause.message : "Could not load settings.");
    } finally {
      setLoading(false);
    }
  }, [session?.user.user_metadata.language, userId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const openBlockedUsers = () => {
    router.push("/(app)/settings/blocked-users");
  };

  const openEdit = (field: Exclude<EditField, null>) => {
    setEditValue(field === "name" ? displayName : field === "username" ? profile?.username ?? "" : "");
    setEditField(field);
  };

  const saveName = async () => {
    if (!profile || !editValue.trim()) throw new Error("Enter a name before saving.");
    const name = editValue.trim();
    const { data, error } = await nativeSupabase.auth.updateUser({
      data: { ...session?.user.user_metadata, first_name: name },
    });
    if (error) throw error;
    setProfile({ ...profile, first_name: name });
    if (!data.user) throw new Error("The name was updated but the signed-in account could not be refreshed.");
  };

  const saveUsername = async () => {
    if (!profile || !session || !editValue.trim()) throw new Error("Enter a username before saving.");
    const username = editValue.trim();
    if (username === profile.username) return;
    const { data: existing, error: lookupError } = await nativeSupabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing && existing.id !== profile.id) throw new Error("That username is already taken.");

    const previousUsername = profile.username;
    const { error: metadataError } = await nativeSupabase.auth.updateUser({
      data: { ...session.user.user_metadata, username },
    });
    if (metadataError) throw metadataError;
    const { error: updateError } = await nativeSupabase
      .from("profiles")
      .update({ username })
      .eq("id", profile.id);
    if (updateError) {
      const { error: rollbackError } = await nativeSupabase.auth.updateUser({
        data: { ...session.user.user_metadata, username: previousUsername },
      });
      if (rollbackError) {
        throw new Error(`${updateError.message}. The account username could not be rolled back: ${rollbackError.message}`);
      }
      throw updateError;
    }
    setProfile({ ...profile, username });
  };

  const saveProfilePicture = async (pictureUrl: string | null) => {
    if (!profile) throw new Error("Your profile is not ready.");
    const { error } = await nativeSupabase
      .from("profiles")
      .update({ profile_pic: pictureUrl })
      .eq("id", profile.id);
    if (error) throw error;
    setProfile({ ...profile, profile_pic: pictureUrl });
  };

  const uploadProfilePicture = async () => {
    if (!profile || saving) return;
    setSaving(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Photo access needed", "Allow photo access to choose a profile picture.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const image = await manipulateAsync(
        asset.uri,
        [{ resize: { width: Math.min(asset.width, 1200) } }],
        { base64: true, compress: 0.82, format: SaveFormat.JPEG },
      );
      if (!image.base64) throw new Error("The selected photo could not be processed.");
      const path = `${profile.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const storage = nativeSupabase.storage.from("profile-pictures");
      const { error: uploadError } = await storage.upload(path, decodeBase64(image.base64), {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const url = storage.getPublicUrl(path).data.publicUrl;
      try {
        await saveProfilePicture(url);
      } catch (cause) {
        const { error: cleanupError } = await storage.remove([path]);
        if (cleanupError) {
          throw new Error(
            `Could not save the profile picture: ${cause instanceof Error ? cause.message : "Unknown error"}. The uploaded file could not be removed: ${cleanupError.message}`,
          );
        }
        throw cause;
      }
      setEditField(null);
    } catch (cause) {
      Alert.alert("Could not update profile picture", cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const removeProfilePicture = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await saveProfilePicture(null);
      setEditField(null);
    } catch (cause) {
      Alert.alert("Could not remove profile picture", cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const saveCurrentField = async () => {
    if (!editField || editField === "picture") return;
    setSaving(true);
    try {
      if (editField === "name") await saveName();
      else await saveUsername();
      setEditField(null);
    } catch (cause) {
      Alert.alert("Could not save changes", cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const saveLanguage = async (nextLanguage: AppLanguage) => {
    if (!profile || !session) return;
    setSaving(true);
    const previousLanguage = normalizeLanguage(profile.language ?? session.user.user_metadata.language);
    try {
      const { error: metadataError } = await nativeSupabase.auth.updateUser({
        data: { ...session.user.user_metadata, language: nextLanguage },
      });
      if (metadataError) throw metadataError;
      const { error: profileError } = await nativeSupabase
        .from("profiles")
        .update({ language: nextLanguage })
        .eq("id", profile.id);
      if (profileError) {
        const { error: rollbackError } = await nativeSupabase.auth.updateUser({
          data: { ...session.user.user_metadata, language: previousLanguage },
        });
        if (rollbackError) {
          throw new Error(`${profileError.message}. The account language could not be rolled back: ${rollbackError.message}`);
        }
        throw profileError;
      }
      await AsyncStorage.setItem("metoyou-language", nextLanguage);
      setLanguage(nextLanguage);
      setProfile({ ...profile, language: nextLanguage });
    } catch (cause) {
      Alert.alert("Could not save language", cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const submitSupportTicket = async () => {
    if (!userId || !supportDescription.trim()) return;
    setSupportBusy(true);
    setSupportMessage(null);
    try {
      const { error } = await nativeSupabase.from("support_tickets").insert({
        user_id: userId,
        category: "other",
        description: supportDescription.trim(),
        status: "open",
        technical_context: {
          app_version: "native",
          platform: Platform.OS,
          route: "/settings",
          timestamp: new Date().toISOString(),
        },
      });
      if (error) throw error;
      setSupportDescription("");
      setSupportMessage("Thanks. Your report was sent.");
    } catch (cause) {
      setSupportMessage(cause instanceof Error ? cause.message : "Could not send your report.");
    } finally {
      setSupportBusy(false);
    }
  };

  const signOut = async () => {
    setSaving(true);
    try {
      const result = await signOutNative();
      if (!result.remoteRevocationConfirmed) {
        Alert.alert(
          "Signed out on this device",
          "Your local session and account cache were cleared. Remote sign-out could not be confirmed while offline.",
        );
      }
    } catch (cause) {
      setSaving(false);
      Alert.alert("Could not sign out", cause instanceof Error ? cause.message : "Please try again.");
    }
  };

  const section = (title: string, subtitle: string, children: ReactNode) => (
    <View style={[styles.section, isBlueSky && styles.blueSkySection, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>{subtitle}</Text>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );

  const row = (
    icon: string,
    title: string,
    detail: string,
    onPress: () => void,
  ) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        isBlueSky && styles.blueSkyOption,
        { borderColor: colors.border, backgroundColor: colors.raised },
        pressed && (isLiquidGlass ? NATIVE_LIQUID_GLASS_PRESSED : styles.pressed),
      ]}
    >
      <View style={[styles.rowIcon, isBlueSky && styles.blueSkyControl, { backgroundColor: colors.control, borderColor: colors.border }]}>
        <Text style={[styles.rowIconText, { color: colors.text }]}>{icon}</Text>
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        <Text numberOfLines={2} style={[styles.rowDetail, { color: colors.muted }]}>{detail}</Text>
      </View>
      <Text style={[styles.rowArrow, { color: colors.muted }]}>›</Text>
    </Pressable>
  );

  if (loading && !profile) {
    return (
      <LinearGradient colors={NATIVE_THEME_COLORS[theme].background} style={styles.root}>
        <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
          <NativeGlassSurface enabled={isLiquidGlass} style={[styles.header, isBlueSky && styles.blueSkyHeader, { borderBottomColor: colors.border, backgroundColor: isLiquidGlass ? "transparent" : colors.surface }]}>
            <Pressable
              accessibilityLabel="Go back"
              onPress={() => router.replace("/(app)/(tabs)/profile")}
              style={[styles.backButton, isBlueSky && styles.blueSkyControl, { borderColor: colors.border, backgroundColor: colors.control }]}
            >
              <Text style={[styles.backButtonText, { color: colors.text }]}>‹</Text>
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={[styles.headerOverline, { color: colors.muted }]}>ACCOUNT</Text>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
            </View>
            <View style={styles.headerSpacer} />
          </NativeGlassSurface>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <NativeSettingsSkeleton />
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={NATIVE_THEME_COLORS[theme].background}
      style={styles.root}
    >
      <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
        <NativeGlassSurface enabled={isLiquidGlass} style={[styles.header, isBlueSky && styles.blueSkyHeader, { borderBottomColor: colors.border, backgroundColor: isLiquidGlass ? "transparent" : colors.surface }]}>
          <Pressable
            accessibilityLabel="Go back"
            onPress={() => router.replace("/(app)/(tabs)/profile")}
            style={[styles.backButton, isBlueSky && styles.blueSkyControl, { borderColor: colors.border, backgroundColor: colors.control }]}
          >
            <Text style={[styles.backButtonText, { color: colors.text }]}>‹</Text>
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.headerOverline, { color: colors.muted }]}>ACCOUNT</Text>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
          </View>
          <View style={styles.headerSpacer} />
        </NativeGlassSurface>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {entitlement.status === "error" ? (
            <View style={[styles.errorCard, isBlueSky && styles.blueSkyOption, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Text style={[styles.errorText, { color: colors.text }]}>VibesPro status could not be checked: {entitlement.error.message}</Text>
              <Pressable onPress={() => void refreshEntitlement()} style={[styles.retryButton, { backgroundColor: colors.control }]}>
                <Text style={[styles.retryText, { color: colors.text }]}>Retry account status</Text>
              </Pressable>
            </View>
          ) : null}
          {screenError ? (
            <View style={[styles.errorCard, isBlueSky && styles.blueSkyOption, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Text style={[styles.errorText, { color: colors.text }]}>{screenError}</Text>
              <Pressable onPress={() => void loadProfile()} style={[styles.retryButton, { backgroundColor: colors.control }]}>
                <Text style={[styles.retryText, { color: colors.text }]}>Try again</Text>
              </Pressable>
            </View>
          ) : null}

          {entitlement.status === "free" ? (
            <View style={[styles.upgradeCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Text style={[styles.upgradeOverline, { color: colors.accent }]}>VIBESPRO</Text>
              <Text style={[styles.upgradeTitle, { color: colors.text }]}>Unlock your premium profile</Text>
              <Text style={[styles.upgradeBody, { color: colors.muted }]}>Bring your profile to life with the VibesPro experience.</Text>
              <Pressable
                onPress={() => Alert.alert("VibesPro", "VibesPro upgrades are not available in the native app yet.")}
                style={[styles.upgradeButton, { borderColor: colors.border, backgroundColor: colors.control }]}
              >
                <Text style={[styles.upgradeButtonText, { color: colors.text }]}>Explore VibesPro</Text>
              </Pressable>
            </View>
          ) : null}

          {section("Profile", "YOUR ACCOUNT", (
            <>
              {row("👤", "Name", displayName, () => openEdit("name"))}
              {row("@", "Username", `@${profile?.username ?? ""}`, () => openEdit("username"))}
              {row("🖼", "Profile picture", profile?.profile_pic ? "A profile picture is set" : "Add a profile picture", () => openEdit("picture"))}
            </>
          ))}

          {section("Privacy", "WHO YOU CONNECT WITH", (
            row("⊘", "Blocked users", "Review and unblock accounts", openBlockedUsers)
          ))}

          {section("Security", "ACCOUNT ACCESS", (
            <>
              <View style={[styles.infoRow, { borderColor: colors.border }]}>
                <View style={[styles.rowIcon, { backgroundColor: colors.control, borderColor: colors.border }]}><Text style={[styles.rowIconText, { color: colors.text }]}>✉</Text></View>
                <View style={styles.rowText}>
                    <Text style={[styles.rowTitle, { color: colors.text }]}>Email address</Text>
                    <Text style={[styles.rowDetail, { color: colors.muted }]}>{session?.user.email ?? "No email available"}</Text>
                </View>
              </View>
              <View style={[styles.infoRow, { borderColor: colors.border }]}>
                <View style={[styles.rowIcon, { backgroundColor: colors.control, borderColor: colors.border }]}><Text style={[styles.rowIconText, { color: colors.text }]}>🔒</Text></View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>Password</Text>
                  <Text style={[styles.rowDetail, { color: colors.muted }]}>Password changes are managed through your account sign-in.</Text>
                </View>
              </View>
            </>
          ))}

          {section("Language", "APP LANGUAGE", (
            <View style={styles.optionList}>
              {LANGUAGE_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  disabled={saving}
                  onPress={() => void saveLanguage(option.value)}
                  style={[
                    styles.languageOption,
                    isBlueSky && styles.blueSkyOption,
                    language === option.value && styles.selectedLanguage,
                    language === option.value && isBlueSky && styles.blueSkySelectedOption,
                    { borderColor: colors.border, backgroundColor: language === option.value ? colors.control : colors.raised },
                  ]}
                >
                  <View style={styles.languageCopy}>
                    <Text style={[styles.rowTitle, { color: colors.text }]}>{option.label}</Text>
                    <Text style={[styles.rowDetail, { color: colors.muted }]}>{option.helper}</Text>
                  </View>
                  <Text style={[styles.radio, language === option.value && styles.radioSelected]}>{language === option.value ? "●" : "○"}</Text>
                </Pressable>
              ))}
              <Text style={[styles.note, { color: colors.muted }]}>
                Your selection is saved on this device for your VibesPro account. Native screen translations are still being added.
              </Text>
            </View>
          ))}

          {accountCanUseBlueSky ? section("Display", "APPEARANCE", (
            <View style={styles.optionList}>
              {NATIVE_THEME_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: theme === option.value }}
                  onPress={() => void setTheme(option.value).catch((cause: unknown) => Alert.alert("Theme could not be saved", cause instanceof Error ? cause.message : "Please try again."))}
                  style={[
                    styles.languageOption,
                    {
                      borderColor: theme === option.value ? colors.accent : colors.border,
                      backgroundColor: theme === option.value ? colors.control : colors.raised,
                    },
                  ]}
                >
                  <LinearGradient
                    colors={option.swatch.length > 1 ? option.swatch : [option.swatch[0], option.swatch[0]]}
                    style={styles.themeSwatch}
                  />
                  <View style={styles.languageCopy}>
                    <Text style={[styles.rowTitle, { color: colors.text }]}>{option.label}</Text>
                    <Text style={[styles.rowDetail, { color: colors.muted }]}>
                      {theme === option.value
                        ? "Current theme"
                        : option.value === "white"
                          ? "Bright and minimal"
                          : "Colorful app theme"}
                    </Text>
                  </View>
                  <Text style={[styles.radio, { color: colors.accent }]}>
                    {theme === option.value ? "●" : "○"}
                  </Text>
                </Pressable>
              ))}
            </View>
          )) : null}

          {section("Notifications", "DEVICE ALERTS", (
            <View style={styles.notificationRow}>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>Push notifications</Text>
                <Text style={[styles.rowDetail, { color: colors.muted }]}>{pushRegistrationStatus.detail}</Text>
                <View style={styles.notificationDiagnostics}>
                  {NATIVE_PUSH_REGISTRATION_STAGES.map(({ key, label }) => (
                    <Text key={key} style={[styles.rowDetail, { color: colors.muted }]}>
                      {label}: {pushRegistrationStatus.stages[key]?.detail ?? "Not run"}
                    </Text>
                  ))}
                </View>
              </View>
              <Text style={[styles.unavailableTag, { borderColor: colors.border, color: colors.text, backgroundColor: colors.control }]}>
                {PUSH_REGISTRATION_LABELS[pushRegistrationStatus.state]}
              </Text>
            </View>
          ))}

          {section("Help & support", "WE’RE HERE TO HELP", (
            <>
              {row("?", "Help center", "Browse help resources", () => Alert.alert("Help center", "Help center links are coming in a later native update."))}
              {row("⚑", "Report a problem", "Send a note to the MeToYou team", () => { setSupportMessage(null); setSupportOpen(true); })}
            </>
          ))}

          {section("About MeToYou", "APP INFORMATION", (
            <>
              {row("ℹ", "About MeToYou", "Learn more about the app", () => Alert.alert("About MeToYou", "The About screen is not available in the native app yet."))}
              <View style={styles.versionRow}>
                <Text style={styles.rowTitle}>App version</Text>
                <Text style={styles.versionTag}>1.0.0 · Native</Text>
              </View>
              {profile?.is_admin ? row("▦", "Admin dashboard", "Administration tools are web-only", () => Alert.alert("Admin dashboard", "The admin dashboard is not available in the native app.")) : null}
            </>
          ))}

          {section("Sign out", "END THIS SESSION", (
            <Pressable onPress={() => setLogoutOpen(true)} style={[styles.logoutButton, { borderColor: "#f87171", backgroundColor: "#dc2626" }]}>
              <Text style={[styles.logoutText, { color: "#ffffff" }]}>Sign out</Text>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>

      <Modal animationType="fade" onRequestClose={() => setEditField(null)} transparent visible={editField !== null}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
          <NativeBlurBackdrop intensity={22} overlayColor="rgba(0,0,0,0.55)" />
          <Pressable onPress={() => setEditField(null)} style={StyleSheet.absoluteFill} />
          <View style={[styles.editCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalOverline, { color: colors.muted }]}>EDIT PROFILE</Text>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {editField === "name" ? "Name" : editField === "username" ? "Username" : "Profile picture"}
                </Text>
              </View>
              <Pressable accessibilityLabel="Close editor" onPress={() => setEditField(null)} style={[styles.modalClose, { borderColor: colors.border, backgroundColor: colors.control }]}>
                <Text style={[styles.modalCloseText, { color: colors.text }]}>×</Text>
              </Pressable>
            </View>
            {editField === "picture" ? (
              <View style={styles.pictureActions}>
                {profile?.profile_pic ? <Image source={{ uri: profile.profile_pic }} style={styles.picturePreview} /> : null}
                <Pressable disabled={saving} onPress={() => void uploadProfilePicture()} style={styles.pictureButton}>
                  {saving ? <ActivityIndicator color={colors.accentText} /> : <Text style={[styles.pictureButtonText, { color: colors.text }]}>Choose from gallery</Text>}
                </Pressable>
                {profile?.profile_pic ? (
                  <Pressable disabled={saving} onPress={() => void removeProfilePicture()} style={styles.removePictureButton}>
                    <Text style={[styles.removePictureText, { color: colors.text }]}>Remove profile picture</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <>
                <TextInput
                  autoCapitalize={editField === "username" ? "none" : "words"}
                  autoCorrect={false}
                  onChangeText={setEditValue}
                  placeholder={editField === "name" ? "Your name" : "Username"}
                  placeholderTextColor={colors.muted}
                  style={[styles.editInput, { borderColor: colors.border, backgroundColor: colors.raised, color: colors.text }]}
                  value={editValue}
                />
                {editField === "username" ? <Text style={[styles.editHint, { color: colors.muted }]}>Your username appears on your MeToYou profile.</Text> : null}
                <Pressable disabled={saving || !editValue.trim()} onPress={() => void saveCurrentField()} style={[styles.saveButton, { borderColor: colors.border, backgroundColor: colors.accent }, (saving || !editValue.trim()) && styles.disabled]}>
                  {saving ? <ActivityIndicator color={colors.accentText} /> : <Text style={[styles.saveButtonText, { color: colors.accentText }]}>Save changes</Text>}
                </Pressable>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal animationType="fade" onRequestClose={() => setSupportOpen(false)} transparent visible={supportOpen}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
          <NativeBlurBackdrop intensity={22} overlayColor="rgba(0,0,0,0.55)" />
          <Pressable onPress={() => setSupportOpen(false)} style={StyleSheet.absoluteFill} />
          <View style={[styles.editCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalOverline, { color: colors.muted }]}>SUPPORT</Text>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Report a problem</Text>
              </View>
              <Pressable accessibilityLabel="Close support form" onPress={() => setSupportOpen(false)} style={[styles.modalClose, { borderColor: colors.border, backgroundColor: colors.control }]}>
                <Text style={[styles.modalCloseText, { color: colors.text }]}>×</Text>
              </Pressable>
            </View>
            <TextInput
              multiline
              onChangeText={setSupportDescription}
              placeholder="Describe the problem"
              placeholderTextColor={colors.muted}
              style={[styles.editInput, styles.multilineInput, { borderColor: colors.border, backgroundColor: colors.raised, color: colors.text }]}
              value={supportDescription}
            />
            {supportMessage ? <Text style={[styles.supportMessage, { color: colors.muted }]}>{supportMessage}</Text> : null}
            <Pressable
              disabled={supportBusy || !supportDescription.trim()}
              onPress={() => void submitSupportTicket()}
              style={[styles.saveButton, { borderColor: colors.border, backgroundColor: colors.accent }, (supportBusy || !supportDescription.trim()) && styles.disabled]}
            >
              {supportBusy ? <ActivityIndicator color={colors.accentText} /> : <Text style={[styles.saveButtonText, { color: colors.accentText }]}>Send report</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <NativeHoldToConfirmDialog
        busy={saving}
        onCancel={() => setLogoutOpen(false)}
        onConfirm={() => void signOut()}
        visible={logoutOpen}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#05070b" },
  header: { minHeight: 68, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: "#252a33", backgroundColor: "rgba(5,7,11,0.92)" },
  blueSkyHeader: { borderBottomColor: "#3478bd", backgroundColor: "rgba(6,26,58,0.94)" },
  backButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#353b46", borderRadius: 15, backgroundColor: "#151a22" },
  backButtonText: { color: "#ffffff", fontSize: 34, lineHeight: 38 },
  headerCopy: { flex: 1, alignItems: "center" },
  headerOverline: { color: "#ffffff", fontSize: 9, fontWeight: "800", letterSpacing: 2 },
  headerTitle: { ...NATIVE_TYPE_SCALE.screenTitle, color: "#ffffff" },
  headerSpacer: { width: 42 },
  content: { gap: 14, padding: 14, paddingTop: 16, paddingBottom: 30 },
  errorCard: { padding: 16, borderWidth: 1, borderColor: "#454b55", borderRadius: 20, backgroundColor: "#151a22" },
  errorText: { color: "#ffffff", fontSize: 14 },
  retryButton: { alignSelf: "flex-start", marginTop: 9, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: "#303743" },
  retryText: { color: "#ffffff", fontWeight: "800" },
  upgradeCard: { padding: 18, borderWidth: 1, borderColor: "#353b46", borderRadius: 24, backgroundColor: "#11161e" },
  upgradeOverline: { color: "#ffffff", fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  upgradeTitle: { marginTop: 7, color: "#ffffff", fontSize: 19, fontWeight: "900" },
  upgradeBody: { marginTop: 5, color: "#ffffff", fontSize: 13, lineHeight: 19 },
  upgradeButton: { alignSelf: "flex-start", marginTop: 13, paddingHorizontal: 15, paddingVertical: 10, borderWidth: 1, borderColor: "#4b5563", borderRadius: 99, backgroundColor: "#252b35" },
  upgradeButtonText: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
  section: { padding: 16, borderWidth: 1, borderColor: "#292f39", borderRadius: 26, backgroundColor: "#10141b", shadowColor: "#000000", shadowOpacity: 0.28, shadowRadius: 16, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  blueSkySection: { borderColor: "rgba(84,184,255,0.44)", backgroundColor: "#0b2d5b" },
  sectionSubtitle: { ...NATIVE_TYPE_SCALE.overline, color: "#ffffff" },
  sectionTitle: { ...NATIVE_TYPE_SCALE.sectionTitle, marginTop: 4, color: "#ffffff" },
  sectionContent: { gap: 8, marginTop: 12 },
  row: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: "#2e3540", borderRadius: 20, backgroundColor: "#171c25" },
  themeSwatch: { width: 30, height: 30, borderWidth: 1, borderColor: "rgba(255,255,255,0.5)", borderRadius: 15 },
  blueSkyOption: { borderColor: "#3478bd", backgroundColor: "#104078" },
  infoRow: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 10, paddingVertical: 8 },
  rowIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#252b35" },
  blueSkyControl: { borderColor: "#3478bd", backgroundColor: "#155192" },
  dangerIcon: { backgroundColor: "#252b35" },
  rowIconText: { color: "#ffffff", fontSize: 18, fontWeight: "800" },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { ...NATIVE_TYPE_SCALE.body, color: "#ffffff", fontWeight: "700" },
  rowDetail: { color: "#ffffff", fontSize: 11, lineHeight: 16 },
  notificationDiagnostics: { gap: 2, marginTop: 4 },
  rowArrow: { color: "#ffffff", fontSize: 24 },
  pressed: { opacity: 0.7, backgroundColor: "#252b35" },
  optionList: { gap: 7 },
  languageOption: { minHeight: 58, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, borderWidth: 1, borderColor: "#303743", borderRadius: 17, backgroundColor: "#171c25" },
  selectedLanguage: { borderColor: "#ffffff", backgroundColor: "#252b35" },
  blueSkySelectedOption: { borderColor: "#54b8ff", backgroundColor: "#155192" },
  languageCopy: { flex: 1, gap: 3 },
  radio: { color: "#ffffff", fontSize: 19 },
  radioSelected: { color: "#ffffff" },
  note: { color: "#ffffff", fontSize: 11, lineHeight: 16 },
  notificationRow: { minHeight: 58, flexDirection: "row", alignItems: "flex-start", gap: 10, paddingHorizontal: 10 },
  unavailableTag: { overflow: "hidden", paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1, borderColor: "#454b55", borderRadius: 99, color: "#ffffff", backgroundColor: "#252b35", fontSize: 9, fontWeight: "800" },
  versionRow: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10 },
  versionTag: { overflow: "hidden", paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "#454b55", borderRadius: 99, color: "#ffffff", backgroundColor: "#252b35", fontSize: 10, fontWeight: "800" },
  logoutButton: { minHeight: 50, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#454b55", borderRadius: 17, backgroundColor: "#252b35" },
  logoutText: { color: "#ffffff", fontSize: 15, fontWeight: "900" },
  modalBackdrop: { flex: 1, justifyContent: "center", padding: 22, backgroundColor: "rgba(0,0,0,0.78)" },
  editCard: { padding: 20, borderWidth: 1, borderColor: "#353b46", borderRadius: 27, backgroundColor: "#10141b" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  modalOverline: { color: "#ffffff", fontSize: 9, fontWeight: "900", letterSpacing: 2 },
  modalTitle: { marginTop: 4, color: "#ffffff", fontSize: 22, fontWeight: "900" },
  modalClose: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#454b55", borderRadius: 18, backgroundColor: "#252b35" },
  modalCloseText: { color: "#ffffff", fontSize: 24, lineHeight: 27 },
  editInput: { minHeight: 48, paddingHorizontal: 13, borderWidth: 1, borderColor: "#454b55", borderRadius: 15, color: "#ffffff", backgroundColor: "#171c25", fontSize: 15 },
  editHint: { marginTop: 7, color: "#ffffff", fontSize: 11 },
  saveButton: { minHeight: 47, alignItems: "center", justifyContent: "center", marginTop: 14, borderWidth: 1, borderColor: "#555d69", borderRadius: 15, backgroundColor: "#303743" },
  saveButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
  disabled: { opacity: 0.55 },
  pictureActions: { gap: 10 },
  picturePreview: { width: 100, height: 100, alignSelf: "center", marginBottom: 6, borderRadius: 50 },
  pictureButton: { minHeight: 47, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#555d69", borderRadius: 15, backgroundColor: "#303743" },
  pictureButtonText: { color: "#ffffff", fontWeight: "800" },
  removePictureButton: { minHeight: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#454b55", borderRadius: 15, backgroundColor: "#171c25" },
  removePictureText: { color: "#ffffff", fontWeight: "800" },
  multilineInput: { minHeight: 130, textAlignVertical: "top", paddingTop: 12 },
  supportMessage: { marginTop: 9, color: "#ffffff", fontSize: 12, fontWeight: "700" },
  cancelButton: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#454b55", borderRadius: 15, backgroundColor: "#171c25" },
  cancelText: { color: "#ffffff", fontWeight: "800" },
});
