// app/(auth)/signup.js
import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useRouter, Link } from "expo-router";
import { useAuth, fetchJson } from "../../lib/auth";

export default function SignUp() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setErr("");
    setLoading(true);
    try {
      const r = await fetchJson("/api/auth/signup", {
        method: "POST",
        body: { name, email: email.trim().toLowerCase(), password },
      });
      if (!r.ok) throw new Error(r.json?.error || "Sign-up failed");
      // immediately sign in after sign-up
      await signIn(email.trim().toLowerCase(), password);
      router.replace("/(tabs)/dashboard");
    } catch (e) {
      setErr(e?.message || "Sign-up failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "800" }}>Create your account</Text>
      <Text style={{ color: "#6b7280" }}>Start your deep work routine in minutes.</Text>

      <TextInput
        placeholder="Name"
        value={name}
        onChangeText={setName}
        style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 12 }}
      />
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
        style={{ backgroundColor: loading ? "#9ca3af" : "#111827", padding: 14, borderRadius: 10 }}
      >
        <Text style={{ color: "white", fontWeight: "700", textAlign: "center" }}>
          {loading ? "Creating…" : "Sign up"}
        </Text>
      </Pressable>

      <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 6 }}>
        <Text style={{ color: "#6b7280" }}>Already have an account? </Text>
        <Link href="/(auth)/signin" style={{ fontWeight: "700", color: "#111827" }}>
          Sign in
        </Link>
      </View>
    </View>
  );
}
