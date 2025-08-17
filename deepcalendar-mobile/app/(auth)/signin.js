import React, { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";
import { DEFAULT_API_BASE } from "../../lib/config";

function Btn({ title, onPress }) {
  return (
    <Pressable onPress={onPress} style={{ backgroundColor: "#111827", padding: 12, borderRadius: 10 }}>
      <Text style={{ color: "white", fontWeight: "700", textAlign: "center" }}>{title}</Text>
    </Pressable>
  );
}

export default function SignIn() {
  const router = useRouter();
  const { signIn, setBase, base } = useAuth();

  // 👇 default to deployed Vercel API instead of localhost
  const [server, setServer] = useState(base || DEFAULT_API_BASE);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function onSubmit() {
    setErr("");
    try {
      await setBase(server);
      await signIn(email.trim().toLowerCase(), password);
      router.replace("/(tabs)/dashboard");
    } catch (e) {
      setErr(e?.message || "Sign-in failed");
    }
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "800" }}>Sign in</Text>

      <Text style={{ color: "#6b7280", fontSize: 12 }}>DeepCalendar server</Text>
      <TextInput
        value={server}
        onChangeText={setServer}
        autoCapitalize="none"
        inputMode="url"
        style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 10 }}
        placeholder={DEFAULT_API_BASE}
      />

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        inputMode="email"
        style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 10 }}
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 10 }}
      />

      {err ? <Text style={{ color: "#dc2626" }}>{err}</Text> : null}
      <Btn title="Sign in" onPress={onSubmit} />
    </View>
  );
}
