import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { API_BASE } from "../../lib/config";
import { useAuth } from "../../lib/auth";

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
      const r = await fetch(`${API_BASE}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      if (!r.ok) throw new Error("Sign-up failed");
      // immediately sign in after sign-up
      await signIn(email, password);
      router.replace("/dashboard");
    } catch (e) {
      setErr(e.message || "Sign-up failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "700", textAlign: "center", marginVertical: 12 }}>
        Create your account
      </Text>

      <TextInput placeholder="Name" value={name} onChangeText={setName}
        style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 12 }} />
      <TextInput placeholder="Email" autoCapitalize="none" keyboardType="email-address"
        value={email} onChangeText={setEmail}
        style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 12 }} />
      <TextInput placeholder="Password" secureTextEntry value={password} onChangeText={setPassword}
        style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 12 }} />
      {!!err && <Text style={{ color: "#dc2626" }}>{err}</Text>}

      <Pressable
        onPress={onSubmit}
        disabled={loading}
        style={{ backgroundColor: loading ? "#9ca3af" : "black", padding: 14, borderRadius: 10 }}
      >
        <Text style={{ color: "white", fontWeight: "600", textAlign: "center" }}>
          {loading ? "Creating…" : "Sign up"}
        </Text>
      </Pressable>
    </View>
  );
}
