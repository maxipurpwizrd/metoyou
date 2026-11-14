import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DevicePushToken } from "expo-notifications";

const mocks = vi.hoisted(() => ({
  addPushTokenListener: vi.fn(),
  getExpoPushTokenAsync: vi.fn(),
  invoke: vi.fn(),
  getItem: vi.fn(),
  setItem: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  getPermissionsAsync: vi.fn(),
  setNotificationHandler: vi.fn(),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: mocks.getItem,
    setItem: mocks.setItem,
  },
}));

vi.mock("expo-constants", () => ({
  default: { easConfig: { projectId: "test-project" } },
}));

vi.mock("react-native", () => ({
  Platform: { OS: "android" },
}));

vi.mock("expo-device", () => ({
  isDevice: true,
}));

vi.mock("expo-notifications", () => ({
  AndroidImportance: { MAX: 5 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  addPushTokenListener: mocks.addPushTokenListener,
  getExpoPushTokenAsync: mocks.getExpoPushTokenAsync,
  getPermissionsAsync: mocks.getPermissionsAsync,
  setNotificationChannelAsync: mocks.setNotificationChannelAsync,
  setNotificationHandler: mocks.setNotificationHandler,
}));

vi.mock("./supabase", () => ({
  nativeSupabase: {
    functions: { invoke: mocks.invoke },
  },
}));

const deviceToken: DevicePushToken = { type: "android", data: "test-device-token" };
const otherDeviceToken: DevicePushToken = { type: "android", data: "changed-device-token" };

async function loadRegistrationForUser(userId: string) {
  const registration = await import("./pushRegistration");
  registration.setNativePushRegistrationIdentity(userId);
  return registration;
}

describe("native push registration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.getItem.mockImplementation(async (key: string) =>
      key.includes("installation-id") ? "installation-id" : null,
    );
    mocks.setItem.mockResolvedValue(undefined);
    mocks.setNotificationChannelAsync.mockResolvedValue(undefined);
    mocks.getPermissionsAsync.mockResolvedValue({ status: "granted" });
    mocks.setNotificationHandler.mockImplementation(() => undefined);
    mocks.getExpoPushTokenAsync.mockResolvedValue({ data: "expo-push-token" });
    mocks.invoke.mockResolvedValue({ data: null, error: null });
  });

  it("passes the event's device token to Expo instead of fetching it again", async () => {
    let listener: ((token: DevicePushToken) => void) | undefined;
    const remove = vi.fn();
    mocks.addPushTokenListener.mockImplementation((callback) => {
      listener = callback;
      return { remove };
    });
    const { subscribeToNativePushTokenRefresh } = await loadRegistrationForUser("user-a");

    const registration = subscribeToNativePushTokenRefresh("user-a");
    await vi.waitFor(() => expect(listener).toBeTypeOf("function"));
    listener?.(deviceToken);
    await vi.waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(2));

    expect(mocks.getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: "test-project",
      devicePushToken: deviceToken,
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(1, "native-device", {
      body: { action: "prepare", installationId: "installation-id", previousExpoPushToken: null },
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(2, "native-device", {
      body: {
        action: "register",
        installationId: "installation-id",
        expoPushToken: "expo-push-token",
        previousExpoPushToken: null,
        platform: "android",
      },
    });

    registration.remove();
    expect(remove).toHaveBeenCalledOnce();
  });

  it("coalesces the token event emitted by Android's initial device-token getter", async () => {
    let listener: ((token: DevicePushToken) => void) | undefined;
    mocks.addPushTokenListener.mockImplementation((callback) => {
      listener = callback;
      return { remove: vi.fn() };
    });
    mocks.getExpoPushTokenAsync.mockImplementation(async (options) => {
      if (!options.devicePushToken) listener?.(deviceToken);
      return { data: "expo-push-token" };
    });
    const { registerNativePushTokenForCurrentUser, subscribeToNativePushTokenRefresh } =
      await loadRegistrationForUser("user-feedback");

    subscribeToNativePushTokenRefresh("user-feedback");
    await vi.waitFor(() => expect(listener).toBeTypeOf("function"));
    await registerNativePushTokenForCurrentUser("user-feedback", "session");
    await vi.waitFor(() => expect(mocks.getExpoPushTokenAsync).toHaveBeenCalledTimes(2));

    expect(mocks.getExpoPushTokenAsync).toHaveBeenCalledTimes(2);
    expect(mocks.invoke).toHaveBeenCalledTimes(2);
  });

  it("coalesces overlapping token events and skips a successfully registered unchanged token", async () => {
    let listener: ((token: DevicePushToken) => void) | undefined;
    mocks.addPushTokenListener.mockImplementation((callback) => {
      listener = callback;
      return { remove: vi.fn() };
    });
    let finishPrepare: ((result: { data: null; error: null }) => void) | undefined;
    mocks.invoke.mockImplementation((functionName: string) => {
      if (functionName === "native-device" && !finishPrepare) {
        return new Promise((resolve) => {
          finishPrepare = resolve;
        });
      }
      return Promise.resolve({ data: null, error: null });
    });
    const { subscribeToNativePushTokenRefresh } = await loadRegistrationForUser("user-b");

    subscribeToNativePushTokenRefresh("user-b");
    await vi.waitFor(() => expect(listener).toBeTypeOf("function"));
    listener?.(deviceToken);
    listener?.(deviceToken);
    await vi.waitFor(() => expect(mocks.invoke).toHaveBeenCalledOnce());
    finishPrepare?.({ data: null, error: null });
    await vi.waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(2));

    listener?.(deviceToken);
    await vi.waitFor(() => expect(mocks.getExpoPushTokenAsync).toHaveBeenCalledTimes(3));
    expect(mocks.invoke).toHaveBeenCalledTimes(2);
  });

  it("does not install a listener if cleanup runs before the dynamic import resolves", async () => {
    let resolveNotifications: ((module: typeof import("expo-notifications")) => void) | undefined;
    vi.doMock("expo-notifications", () => new Promise((resolve) => {
      resolveNotifications = resolve;
    }));
    const { subscribeToNativePushTokenRefresh } = await loadRegistrationForUser("user-c");

    const registration = subscribeToNativePushTokenRefresh("user-c");
    registration.remove();
    resolveNotifications?.({
      addPushTokenListener: mocks.addPushTokenListener,
    } as unknown as typeof import("expo-notifications"));
    await Promise.resolve();

    expect(mocks.addPushTokenListener).not.toHaveBeenCalled();
    vi.doUnmock("expo-notifications");
    vi.doMock("expo-notifications", () => ({
      AndroidImportance: { MAX: 5 },
      AndroidNotificationVisibility: { PUBLIC: 1 },
      addPushTokenListener: mocks.addPushTokenListener,
      getExpoPushTokenAsync: mocks.getExpoPushTokenAsync,
      getPermissionsAsync: mocks.getPermissionsAsync,
      setNotificationChannelAsync: mocks.setNotificationChannelAsync,
      setNotificationHandler: mocks.setNotificationHandler,
    }));
  });

  it("serializes logout and a new user's registration after an in-flight old-user prepare", async () => {
    let finishPrepare: ((result: { data: null; error: null }) => void) | undefined;
    const actions: string[] = [];
    mocks.getExpoPushTokenAsync
      .mockResolvedValueOnce({ data: "expo-token-a" })
      .mockResolvedValueOnce({ data: "expo-token-b" });
    mocks.invoke.mockImplementation((_name: string, options: { body: { action: string; expoPushToken?: string } }) => {
      actions.push(options.body.action);
      if (options.body.action === "prepare" && !finishPrepare) {
        return new Promise((resolve) => {
          finishPrepare = resolve;
        });
      }
      return Promise.resolve({ data: null, error: null });
    });
    const registration = await loadRegistrationForUser("user-a");

    const userARegistration = registration.registerNativePushTokenForCurrentUser("user-a", "session");
    await vi.waitFor(() => expect(mocks.invoke).toHaveBeenCalledOnce());
    const logoutRevocation = registration.clearNativePushRegistrationForUser("user-a");
    registration.setNativePushRegistrationIdentity("user-b");
    const userBRegistration = registration.registerNativePushTokenForCurrentUser("user-b", "session");

    expect(mocks.getExpoPushTokenAsync).toHaveBeenCalledOnce();
    finishPrepare?.({ data: null, error: null });
    await Promise.all([userARegistration, logoutRevocation, userBRegistration]);

    expect(actions).toEqual(["prepare", "revoke", "prepare", "register"]);
    expect(mocks.invoke).toHaveBeenLastCalledWith("native-device", {
      body: expect.objectContaining({ action: "register", expoPushToken: "expo-token-b" }),
    });
  });

  it("does not overlap logout revocation with a new user's registration", async () => {
    let finishRevoke: ((result: { data: null; error: null }) => void) | undefined;
    const actions: string[] = [];
    mocks.invoke.mockImplementation((_name: string, options: { body: { action: string } }) => {
      actions.push(options.body.action);
      if (options.body.action === "revoke") {
        return new Promise((resolve) => {
          finishRevoke = resolve;
        });
      }
      return Promise.resolve({ data: null, error: null });
    });
    const registration = await loadRegistrationForUser("user-a");

    const logoutRevocation = registration.clearNativePushRegistrationForUser("user-a");
    await vi.waitFor(() => expect(mocks.invoke).toHaveBeenCalledOnce());
    registration.setNativePushRegistrationIdentity("user-b");
    const userBRegistration = registration.registerNativePushTokenForCurrentUser("user-b", "session");

    expect(mocks.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(actions).toEqual(["revoke"]);
    finishRevoke?.({ data: null, error: null });
    await Promise.all([logoutRevocation, userBRegistration]);

    expect(actions).toEqual(["revoke", "prepare", "register"]);
  });

  it("ignores an old user's token event after the identity changes", async () => {
    let listener: ((token: DevicePushToken) => void) | undefined;
    mocks.addPushTokenListener.mockImplementation((callback) => {
      listener = callback;
      return { remove: vi.fn() };
    });
    const registration = await loadRegistrationForUser("user-a");
    const subscription = registration.subscribeToNativePushTokenRefresh("user-a");
    await vi.waitFor(() => expect(listener).toBeTypeOf("function"));

    registration.setNativePushRegistrationIdentity("user-b");
    listener?.(deviceToken);
    await Promise.resolve();
    subscription.remove();

    expect(mocks.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("deduplicates a successful token for the same installation and user", async () => {
    const registration = await loadRegistrationForUser("user-dedupe");

    await registration.registerNativePushTokenForCurrentUser("user-dedupe", "token-refresh", deviceToken);
    await registration.registerNativePushTokenForCurrentUser("user-dedupe", "token-refresh", deviceToken);

    expect(mocks.invoke).toHaveBeenCalledTimes(2);
  });

  it("does not trust a successful-token cache after ownership changes", async () => {
    const registration = await loadRegistrationForUser("user-a");
    await registration.registerNativePushTokenForCurrentUser("user-a", "token-refresh", deviceToken);

    registration.setNativePushRegistrationIdentity("user-b");
    await registration.registerNativePushTokenForCurrentUser("user-b", "token-refresh", deviceToken);

    expect(mocks.invoke).toHaveBeenCalledTimes(4);
    expect(mocks.invoke).toHaveBeenNthCalledWith(4, "native-device", {
      body: expect.objectContaining({ action: "register", expoPushToken: "expo-push-token" }),
    });
  });

  it("allows retry after the exponential cooldown expires", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(10_000);
    mocks.invoke.mockResolvedValueOnce({ data: null, error: new Error("Network request failed") });
    const registration = await loadRegistrationForUser("user-retry");

    await registration.registerNativePushTokenForCurrentUser("user-retry", "token-refresh", deviceToken);
    now.mockReturnValue(11_001);
    await registration.registerNativePushTokenForCurrentUser("user-retry", "token-refresh", deviceToken);

    expect(mocks.invoke).toHaveBeenCalledTimes(3);
  });

  it("suppresses repeated failures during the cooldown", async () => {
    mocks.invoke.mockResolvedValueOnce({ data: null, error: new Error("Network request failed") });
    const registration = await loadRegistrationForUser("user-cooldown");

    await registration.registerNativePushTokenForCurrentUser("user-cooldown", "token-refresh", deviceToken);
    await registration.registerNativePushTokenForCurrentUser("user-cooldown", "token-refresh", deviceToken);

    expect(mocks.invoke).toHaveBeenCalledOnce();
    expect(mocks.getExpoPushTokenAsync).toHaveBeenCalledOnce();
  });

  it("allows a changed device token through the failure cooldown", async () => {
    mocks.getExpoPushTokenAsync
      .mockResolvedValueOnce({ data: "expo-token-old" })
      .mockResolvedValueOnce({ data: "expo-token-new" });
    mocks.invoke.mockResolvedValueOnce({ data: null, error: new Error("Network request failed") });
    const registration = await loadRegistrationForUser("user-changed-token");

    await registration.registerNativePushTokenForCurrentUser("user-changed-token", "token-refresh", deviceToken);
    await registration.registerNativePushTokenForCurrentUser("user-changed-token", "token-refresh", otherDeviceToken);

    expect(mocks.invoke).toHaveBeenCalledTimes(3);
    expect(mocks.invoke).toHaveBeenLastCalledWith("native-device", {
      body: expect.objectContaining({ action: "register", expoPushToken: "expo-token-new" }),
    });
  });

  it("logs useful network diagnostics without credentials, tokens, URLs, or response bodies", async () => {
    const secretValues = [
      "access-secret",
      "refresh-secret",
      "api-key-secret",
      "x-api-key-secret",
      "password-secret",
      "expo-device-secret",
      "fcm-device-secret",
      "raw-response-secret",
      "query-secret",
    ];
    const networkCause = new TypeError(
      `Network request failed access_token=${secretValues[0]} refresh_token=${secretValues[1]} ` +
      `api-key=${secretValues[2]} x-api-key=${secretValues[3]} password=${secretValues[4]} ` +
      `ExpoPushToken[${secretValues[5]}] fcm device token=${secretValues[6]} ` +
      `response body=${secretValues[7]} https://example.invalid/path?access_token=${secretValues[8]}`,
    ) as TypeError & { code: string };
    networkCause.code = "ETIMEDOUT";
    const error = new Error("Function invocation failed") as Error & { cause: TypeError };
    error.name = "FunctionsFetchError";
    Object.defineProperty(error, "cause", { value: networkCause });
    mocks.invoke.mockResolvedValueOnce({ data: null, error });
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const registration = await loadRegistrationForUser("user-diagnostics");

    await registration.registerNativePushTokenForCurrentUser("user-diagnostics", "token-refresh", deviceToken);

    const output = log.mock.calls.flat().join(" ");
    expect(output).toContain("FunctionsFetchError");
    expect(output).toContain("ETIMEDOUT");
    expect(output).toContain("Network request failed");
    for (const secret of secretValues) expect(output).not.toContain(secret);
    expect(output).not.toContain("response body");
    expect(output).not.toContain("example.invalid");
  });
});
