import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";

export default function SignIn() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setErr("");
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace("/dashboard");
    } catch (e) {
      setErr(e.message || "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "700", textAlign: "center", marginVertical: 12 }}>
        Welcome back
      </Text>

      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 12 }}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 12 }}
      />
      {!!err && <Text style={{ color: "#dc2626" }}>{err}</Text>}

      <Pressable
        onPress={onSubmit}
        disabled={loading}
        style={{ backgroundColor: loading ? "#9ca3af" : "black", padding: 14, borderRadius: 10 }}
      >
        <Text style={{ color: "white", fontWeight: "600", textAlign: "center" }}>
          {loading ? "Signing in…" : "Sign in"}
        </Text>
      </Pressable>
    </View>
  );
}
