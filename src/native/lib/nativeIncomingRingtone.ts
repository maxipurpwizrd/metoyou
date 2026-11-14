export type NativeRingtoneManager = {
  startRingtone: (ringtone: string, vibratePattern: number | number[], iosCategory: string, seconds: number) => void;
  stopRingtone: () => void;
};

type NativeRingtoneModule = {
  startRingtone?: unknown;
  stopRingtone?: unknown;
} | null | undefined;

export type IncomingRingtoneController = {
  sync: (invitationId: string | null) => void;
  stop: () => void;
};

export function createIncomingRingtoneController(
  platform: string,
  manager: NativeRingtoneManager,
  nativeModule: NativeRingtoneModule,
): IncomingRingtoneController {
  let activeInvitationId: string | null = null;
  const nativeMethodsAvailable = platform !== "web"
    && typeof manager.startRingtone === "function"
    && typeof manager.stopRingtone === "function"
    && typeof nativeModule?.startRingtone === "function"
    && typeof nativeModule.stopRingtone === "function";

  const stop = () => {
    if (!activeInvitationId) return;
    activeInvitationId = null;
    if (!nativeMethodsAvailable) return;

    try {
      manager.stopRingtone();
    } catch (cause) {
      console.warn("Could not stop the native incoming-call ringtone.", cause);
    }
  };

  const sync = (invitationId: string | null) => {
    if (!invitationId) {
      stop();
      return;
    }
    if (activeInvitationId === invitationId) return;

    stop();
    if (!nativeMethodsAvailable) return;

    activeInvitationId = invitationId;
    try {
      manager.startRingtone("_DEFAULT_", 0, "default", -1);
    } catch (cause) {
      console.warn("Could not start the native incoming-call ringtone.", cause);
    }
  };

  return { sync, stop };
}
