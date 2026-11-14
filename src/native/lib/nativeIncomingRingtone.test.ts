import { describe, expect, it, vi } from "vitest";
import { createIncomingRingtoneController, type NativeRingtoneManager } from "./nativeIncomingRingtone";

function createManager() {
  return {
    startRingtone: vi.fn<NativeRingtoneManager["startRingtone"]>(),
    stopRingtone: vi.fn<NativeRingtoneManager["stopRingtone"]>(),
  };
}

const availableNativeModule = {
  startRingtone: vi.fn(),
  stopRingtone: vi.fn(),
};

describe("native incoming ringtone", () => {
  it("starts the documented Android default ringtone for an incoming invitation", () => {
    const manager = createManager();
    const ringtone = createIncomingRingtoneController("android", manager, availableNativeModule);

    ringtone.sync("invitation-1");

    expect(manager.startRingtone).toHaveBeenCalledOnce();
    expect(manager.startRingtone).toHaveBeenCalledWith("_DEFAULT_", 0, "default", -1);
  });

  it("does not restart the ringtone when the same invitation is updated", () => {
    const manager = createManager();
    const ringtone = createIncomingRingtoneController("android", manager, availableNativeModule);

    ringtone.sync("invitation-1");
    ringtone.sync("invitation-1");

    expect(manager.startRingtone).toHaveBeenCalledOnce();
    expect(manager.stopRingtone).not.toHaveBeenCalled();
  });

  it("stops the old ringtone before starting a replacement invitation", () => {
    const manager = createManager();
    const ringtone = createIncomingRingtoneController("android", manager, availableNativeModule);

    ringtone.sync("invitation-1");
    ringtone.sync("invitation-2");

    expect(manager.stopRingtone).toHaveBeenCalledOnce();
    expect(manager.startRingtone).toHaveBeenCalledTimes(2);
    expect(manager.stopRingtone.mock.invocationCallOrder[0])
      .toBeLessThan(manager.startRingtone.mock.invocationCallOrder[1]);
  });

  it.each(["accept", "decline", "caller cancellation", "expiration", "call end", "provider unmount"])(
    "stops the ringtone on %s",
    () => {
      const manager = createManager();
      const ringtone = createIncomingRingtoneController("android", manager, availableNativeModule);

      ringtone.sync("invitation-1");
      ringtone.stop();
      ringtone.stop();

      expect(manager.stopRingtone).toHaveBeenCalledOnce();
    },
  );

  it("does not start an incoming ringtone for an outgoing call", () => {
    const manager = createManager();
    const ringtone = createIncomingRingtoneController("android", manager, availableNativeModule);

    ringtone.sync(null);

    expect(manager.startRingtone).not.toHaveBeenCalled();
  });

  it("does not call native audio APIs on web", () => {
    const manager = createManager();
    const ringtone = createIncomingRingtoneController("web", manager, availableNativeModule);

    ringtone.sync("invitation-1");
    ringtone.stop();

    expect(manager.startRingtone).not.toHaveBeenCalled();
    expect(manager.stopRingtone).not.toHaveBeenCalled();
  });

  it("does not crash when the native audio module is unavailable", () => {
    const manager = createManager();
    const ringtone = createIncomingRingtoneController("android", manager, undefined);

    expect(() => ringtone.sync("invitation-1")).not.toThrow();
    expect(() => ringtone.stop()).not.toThrow();
    expect(manager.startRingtone).not.toHaveBeenCalled();
    expect(manager.stopRingtone).not.toHaveBeenCalled();
  });
});
