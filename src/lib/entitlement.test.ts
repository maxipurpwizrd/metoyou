import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createNativeEntitlementState, normalizeNativeVibesProEntitlement } from "../native/lib/entitlement";
import { nativeAccountQueryFilter, nativeEntitlementQueryKey } from "../native/lib/queryKeys";

describe("native VibesPro entitlement", () => {
  it("normalizes canonical and legacy flags and keeps the expiry detail", () => {
    expect(normalizeNativeVibesProEntitlement({
      is_vibes_pro: null,
      is_vibespro: true,
      vibes_pro: false,
      vibes_pro_until: "2026-11-01T00:00:00Z",
    })).toEqual({ isVibesPro: true, expiresAt: "2026-11-01T00:00:00Z" });

    expect(normalizeNativeVibesProEntitlement({ is_vibes_pro: false, vibes_pro: true }))
      .toEqual({ isVibesPro: false, expiresAt: null });
    expect(normalizeNativeVibesProEntitlement({ vibes_pro: true }))
      .toEqual({ isVibesPro: true, expiresAt: null });
  });

  it("keeps unresolved and failed lookups distinct from confirmed free", () => {
    expect(createNativeEntitlementState(null, undefined, null).status).toBe("unknown");
    expect(createNativeEntitlementState("user-a", undefined, null).status).toBe("loading");
    expect(createNativeEntitlementState("user-a", undefined, new Error("offline")).status).toBe("error");
    expect(createNativeEntitlementState("user-a", { isVibesPro: false, expiresAt: null }, null).status)
      .toBe("free");
    expect(createNativeEntitlementState("user-a", { isVibesPro: true, expiresAt: null }, null).status)
      .toBe("vibesPro");
  });

  it("deduplicates concurrent requests per account without sharing across accounts", async () => {
    const client = new QueryClient();
    let resolveRequest!: (value: { isVibesPro: boolean; expiresAt: null }) => void;
    const request = vi.fn(() => new Promise<{ isVibesPro: boolean; expiresAt: null }>((resolve) => {
      resolveRequest = resolve;
    }));
    const accountAKey = nativeEntitlementQueryKey("user-a");
    const accountBKey = nativeEntitlementQueryKey("user-b");

    const first = client.fetchQuery({ queryKey: accountAKey, queryFn: request });
    const concurrent = client.fetchQuery({ queryKey: accountAKey, queryFn: request });
    expect(request).toHaveBeenCalledTimes(1);
    resolveRequest({ isVibesPro: true, expiresAt: null });
    await Promise.all([first, concurrent]);

    await client.fetchQuery({
      queryKey: accountBKey,
      queryFn: async () => ({ isVibesPro: false, expiresAt: null }),
    });
    expect(accountAKey).not.toEqual(accountBKey);
    expect(client.getQueryData(accountAKey)).toEqual({ isVibesPro: true, expiresAt: null });
    expect(client.getQueryData(accountBKey)).toEqual({ isVibesPro: false, expiresAt: null });
    client.removeQueries(nativeAccountQueryFilter("user-a"));
    expect(client.getQueryData(accountAKey)).toBeUndefined();
    expect(client.getQueryData(accountBKey)).toEqual({ isVibesPro: false, expiresAt: null });
    client.clear();
  });
});