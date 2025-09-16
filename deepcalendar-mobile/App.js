
// App.js
import "expo-router/entry";
import { Platform } from "react-native";

if (typeof ErrorUtils !== "undefined") {
  const prev = ErrorUtils.getGlobalHandler?.();
  ErrorUtils.setGlobalHandler((err, isFatal) => {
    // Log a clear marker you can grep
    // eslint-disable-next-line no-console
    console.error(
      "DC_FATAL",
      isFatal,
      err?.message || String(err),
      err?.stack || "(no stack)"
    );
    // pass through to default handler
    prev && prev(err, isFatal);
  });
}
