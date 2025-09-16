// app/landing.js
import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter, Link } from "expo-router";

export default function Landing() {
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Text style={{ fontSize: 28, fontWeight: "800" }}>DeepCalendar</Text>
      <Text style={{ color: "#6b7280", fontSize: 14 }}>
        Plan deep work, stick to a weekly routine, and close your day with a simple report.
      </Text>

      <View style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 14, padding: 14, gap: 8 }}>
        <Text style={{ fontWeight: "700" }}>What you get</Text>
        <Text>• Goals you can actually execute</Text>
        <Text>• Weekly routine windows + deep blocks</Text>
        <Text>• Daily open/close with fast status logging</Text>
        <Text>• Lightweight end-of-day summary</Text>
      </View>

      <Pressable
        onPress={() => router.push("/(auth)/signup")}
        style={{ backgroundColor: "#111827", padding: 14, borderRadius: 10 }}
      >
        <Text style={{ color: "white", textAlign: "center", fontWeight: "700" }}>Get started</Text>
      </Pressable>

      <Link
        href="/(auth)/signin"
        style={{ textAlign: "center", color: "#111827", fontWeight: "600", padding: 6 }}
      >
        I already have an account
      </Link>

      <Text style={{ textAlign: "center", color: "#9ca3af", marginTop: 6, fontSize: 12 }}>
        Powered by DeepCalendar
      </Text>
    </ScrollView>
  );
}
