import { Stack } from "expo-router";
import React from "react";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerTitleAlign: "center" }}>
      <Stack.Screen name="signin" options={{ title: "Sign in" }} />
      <Stack.Screen name="signup" options={{ title: "Sign up" }} />
    </Stack>
  );
}
