// app/(auth)/signin.js
import React, { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { useRouter, Link } from "expo-router";
import { useAuth } from "../../lib/auth";

export default function SignIn() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setErr("");
    setLoading(true);
    try {
      await signIn(email.trim().toLowerCase(), password);
      router.replace("/(tabs)/dashboard");
    } catch (e) {
      setErr(e?.message || "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 14 }}>
      <Text style={{ fontSize: 24, fontWeight: "800" }}>Welcome back</Text>
      <Text style={{ color: "#6b7280" }}>Sign in to continue.</Text>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 12 }}
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 12 }}
      />

      {!!err && <Text style={{ color: "#dc2626" }}>{err}</Text>}

      <Pressable
        onPress={onSubmit}
        disabled={loading}
        style={{
          backgroundColor: loading ? "#9ca3af" : "#111827",
          padding: 14,
          borderRadius: 10,
        }}
      >
        <Text style={{ color: "white", fontWeight: "700", textAlign: "center" }}>
          {loading ? "Signing in…" : "Sign in"}
        </Text>
      </Pressable>

      <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 6 }}>
        <Text style={{ color: "#6b7280" }}>New here? </Text>
        <Link href="/(auth)/signup" style={{ fontWeight: "700", color: "#111827" }}>
          Create an account
        </Link>
      </View>
    </View>
  );
}
