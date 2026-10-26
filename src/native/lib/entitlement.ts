export type NativeVibesProEntitlement = {
  isVibesPro: boolean;
  expiresAt: string | null;
};

export type NativeEntitlementState =
  | {
      status: "unknown";
      userId: null;
      isVibesPro: null;
      expiresAt: null;
      error: null;
    }
  | {
      status: "loading";
      userId: string;
      isVibesPro: null;
      expiresAt: null;
      error: null;
    }
  | {
      status: "error";
      userId: string;
      isVibesPro: null;
      expiresAt: null;
      error: Error;
    }
  | {
      status: "free";
      userId: string;
      isVibesPro: false;
      expiresAt: string | null;
      error: Error | null;
    }
  | {
      status: "vibesPro";
      userId: string;
      isVibesPro: true;
      expiresAt: string | null;
      error: Error | null;
    };

export function normalizeNativeVibesProEntitlement(profile: {
  is_vibes_pro?: boolean | null;
  is_vibespro?: boolean | null;
  vibes_pro?: boolean | null;
  vibes_pro_until?: string | null;
}): NativeVibesProEntitlement {
  return {
    isVibesPro: (profile.is_vibes_pro ?? profile.is_vibespro ?? profile.vibes_pro) === true,
    expiresAt: profile.vibes_pro_until ?? null,
  };
}

export function createNativeEntitlementState(
  userId: string | null,
  data: NativeVibesProEntitlement | undefined,
  error: Error | null,
): NativeEntitlementState {
  if (!userId) {
    return { status: "unknown", userId: null, isVibesPro: null, expiresAt: null, error: null };
  }
  if (data) {
    return data.isVibesPro
      ? { status: "vibesPro", userId, isVibesPro: true, expiresAt: data.expiresAt, error }
      : { status: "free", userId, isVibesPro: false, expiresAt: data.expiresAt, error };
  }
  if (error) {
    return { status: "error", userId, isVibesPro: null, expiresAt: null, error };
  }
  return { status: "loading", userId, isVibesPro: null, expiresAt: null, error: null };
}