import { Slot, Redirect, usePathname, useSegments } from "expo-router";
import React from "react";
import { AuthProvider, useAuth } from "../lib/auth";
import { ActivityIndicator, View } from "react-native";

/** Gate redirects, but WITHOUT useEffect/router.replace */
function NavigationGate() {
  const segments = useSegments();
  const pathname = usePathname();
  const { user, loading } = useAuth();

  const inAuthGroup = segments[0] === "(auth)";

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  // Declarative redirects (safe at first render)
  if (!user && !inAuthGroup && pathname !== "/signin") {
    return <Redirect href="/signin" />;
  }
  if (user && inAuthGroup && pathname !== "/(tabs)/dashboard") {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <NavigationGate />
    </AuthProvider>
  );
}
