import Constants, { AppOwnership, ExecutionEnvironment } from "expo-constants";
import { NativeModules, Platform } from "react-native";

export type NativeRuntimeDiagnostics = {
  runtimeClassification: string;
  executionEnvironment: string;
  appOwnership: string;
  isExpoGo: boolean;
  webRtcModuleAvailable: boolean;
  nativeCallSupported: boolean;
  firebaseConfigConfigured: boolean;
  firebasePackageMatch: string;
};

export function getNativeRuntimeDiagnostics(): NativeRuntimeDiagnostics {
  const isExpoGo = Constants.appOwnership === AppOwnership.Expo
    || (Constants.executionEnvironment === ExecutionEnvironment.StoreClient
      && typeof Constants.expoVersion === "string"
      && Constants.expoVersion.length > 0);
  const executionEnvironment = Constants.executionEnvironment ?? "unknown";
  const runtimeClassification = isExpoGo
    ? "Expo Go"
    : executionEnvironment === ExecutionEnvironment.Standalone
      ? "Standalone"
      : executionEnvironment === ExecutionEnvironment.Bare
        ? "Bare React Native"
        : executionEnvironment === ExecutionEnvironment.StoreClient
          ? "Development client"
          : "Unknown";
  const webRtcModule = NativeModules.WebRTCModule as Record<string, unknown> | null | undefined;
  const webRtcModuleAvailable = typeof webRtcModule?.peerConnectionInit === "function"
    && typeof webRtcModule.peerConnectionCreateOffer === "function"
    && typeof webRtcModule.getUserMedia === "function";
  const supportedPlatform = Platform.OS === "android" || Platform.OS === "ios";
  const googleServicesFile = Constants.expoConfig?.android?.googleServicesFile;
  const firebaseConfigConfigured = typeof googleServicesFile === "string" && googleServicesFile.trim().length > 0;

  return {
    runtimeClassification,
    executionEnvironment,
    appOwnership: Constants.appOwnership ?? "none",
    isExpoGo,
    webRtcModuleAvailable,
    nativeCallSupported: supportedPlatform && !isExpoGo && webRtcModuleAvailable,
    firebaseConfigConfigured,
    firebasePackageMatch: firebaseConfigConfigured
      ? "Not verifiable at runtime"
      : "Unavailable: google-services.json is not configured",
  };
}

export function getNativeCallUnavailableReason(): string {
  const diagnostics = getNativeRuntimeDiagnostics();
  if (diagnostics.isExpoGo) {
    return "Calls require an installed development build. Expo Go does not include the native WebRTC module.";
  }
  if (Platform.OS !== "android" && Platform.OS !== "ios") {
    return "Native calls are only supported on Android and iOS.";
  }
  if (!diagnostics.webRtcModuleAvailable) {
    return "The native WebRTC module is unavailable in this app build.";
  }
  return "Native calls are unavailable in this runtime.";
}