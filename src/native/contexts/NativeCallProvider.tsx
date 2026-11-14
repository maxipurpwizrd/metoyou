import type { ReactNode } from "react";
import { NativeCallContext } from "./NativeCallContext";
import { getNativeCallUnavailableReason, getNativeRuntimeDiagnostics } from "../lib/nativeRuntimeDiagnostics";

const unavailableCallContext = {
  isStartingCall: false,
  startCall: async () => {
    throw new Error(getNativeCallUnavailableReason());
  },
};

export function NativeCallProvider({ children }: { children: ReactNode }) {
  if (!getNativeRuntimeDiagnostics().nativeCallSupported) {
    return (
      <NativeCallContext.Provider value={unavailableCallContext}>
        {children}
      </NativeCallContext.Provider>
    );
  }

  const { NativeCallProviderImpl } = require("./NativeCallProviderImpl") as typeof import("./NativeCallProviderImpl");
  return <NativeCallProviderImpl>{children}</NativeCallProviderImpl>;
}
