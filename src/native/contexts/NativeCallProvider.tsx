import Constants from "expo-constants";
import type { ReactNode } from "react";
import { NativeCallContext } from "./NativeCallContext";

const unavailableCallContext = {
  startCall: async () => {
    throw new Error("Calls require the MeToYou development build.");
  },
};

export function NativeCallProvider({ children }: { children: ReactNode }) {
  if (Constants.appOwnership === "expo") {
    return (
      <NativeCallContext.Provider value={unavailableCallContext}>
        {children}
      </NativeCallContext.Provider>
    );
  }

  const { NativeCallProviderImpl } = require("./NativeCallProviderImpl") as typeof import("./NativeCallProviderImpl");
  return <NativeCallProviderImpl>{children}</NativeCallProviderImpl>;
}
