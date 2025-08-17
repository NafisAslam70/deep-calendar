import { Slot, usePathname, useRouter, useSegments } from "expo-router";
import React, { useEffect } from "react";
import { AuthProvider, useAuth } from "../lib/auth";
import { ActivityIndicator, View } from "react-native";

/** Redirects based on auth + route */
function NavigationGate() {
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const { user, loading } = useAuth();

  // Groups: (auth) => /signin, /signup ; (tabs) => /dashboard, etc.
  const inAuthGroup = segments[0] === "(auth)";

  useEffect(() => {
    if (loading) return;

    if (!user && !inAuthGroup) {
      // Logged out anywhere outside auth → go to /signin
      if (pathname !== "/signin") router.replace("/signin");
    } else if (user && inAuthGroup) {
      // Logged in but on auth screens → go to dashboard
      if (pathname !== "/dashboard") router.replace("/dashboard");
    }
  }, [user, loading, inAuthGroup, pathname, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
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
