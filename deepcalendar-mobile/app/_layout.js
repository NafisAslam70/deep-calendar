import { Slot, usePathname, useRouter, useSegments } from "expo-router";
import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { AuthProvider, useAuth } from "../lib/auth";

function NavigationGate() {
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const inAuthGroup = segments[0] === "(auth)";

  useEffect(() => {
    if (loading) return;
    if (!user && !inAuthGroup) {
      if (pathname !== "/signin") router.replace("/signin");
    } else if (user && inAuthGroup) {
      if (pathname !== "/(tabs)/dashboard") router.replace("/(tabs)/dashboard");
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
