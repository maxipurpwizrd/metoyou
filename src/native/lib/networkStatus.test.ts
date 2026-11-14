import { beforeEach, describe, expect, it } from "vitest";
import {
  getNativeNetworkStatus,
  reportNativeNetworkRequestFailure,
  reportNativeNetworkRequestSuccess,
  setNativeConnectivityOffline,
} from "./networkStatus";

describe("native network status", () => {
  beforeEach(() => {
    setNativeConnectivityOffline(false, true, true);
    reportNativeNetworkRequestSuccess();
  });

  it("keeps request failures separate from physical connectivity", () => {
    reportNativeNetworkRequestFailure(new Error("Network request failed"));

    expect(getNativeNetworkStatus()).toMatchObject({
      isOffline: false,
      isConnectivityOffline: false,
      hasRequestFailure: true,
    });
  });

  it("does not let a successful request clear reported physical offline state", () => {
    setNativeConnectivityOffline(true, false, true);

    reportNativeNetworkRequestSuccess();

    expect(getNativeNetworkStatus()).toMatchObject({
      isOffline: true,
      isConnectivityOffline: true,
      hasRequestFailure: false,
    });
  });

  it("clears request failure after a successful request", () => {
    reportNativeNetworkRequestFailure(new Error("Network request failed"));

    reportNativeNetworkRequestSuccess();

    expect(getNativeNetworkStatus()).toMatchObject({
      isOffline: false,
      isConnectivityOffline: false,
      hasRequestFailure: false,
    });
  });
});
