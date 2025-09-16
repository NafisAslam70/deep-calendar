// app/(tabs)/account.js
import React, { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, Text, View, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth, getApiBase, DEFAULT_API_BASE } from "../../lib/auth";

/* ------- Tiny UI bits ------- */
function Row({ label, value }) {
  return (
    <View style={{ paddingVertical: 8 }}>
      <Text style={{ fontSize: 12, color: "#6b7280" }}>{label}</Text>
      <Text style={{ marginTop: 2, fontSize: 16, color: "#111827" }}>{value || "—"}</Text>
    </View>
  );
}
function Button({ title, onPress, kind = "default", disabled }) {
  const styles = {
    default: { bg: "#111827", fg: "#ffffff", brd: "#111827" },
    outline: { bg: "#ffffff", fg: "#111827", brd: "#e5e7eb" },
    danger:  { bg: "#ef4444", fg: "#ffffff", brd: "#ef4444" },
    plain:   { bg: "transparent", fg: "#111827", brd: "transparent" },
  }[kind];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        backgroundColor: styles.bg,
        borderColor: styles.brd,
        borderWidth: 1,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 10,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Text style={{ color: styles.fg, fontWeight: "700", textAlign: "center" }}>{title}</Text>
    </Pressable>
  );
}

/* ------- Reusable confirm modal ------- */
function ConfirmModal({
  open,
  title,
  body,
  confirmText = "Confirm",
  destructive = false,
  busy = false,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;
  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 16 }}>
        <View style={{ backgroundColor: "white", borderRadius: 16, padding: 16, maxWidth: 480, alignSelf: "center", width: "100%" }}>
          <Text style={{ fontSize: 16, fontWeight: "700" }}>{title}</Text>
          {body ? <Text style={{ marginTop: 8, color: "#374151" }}>{body}</Text> : null}
          <View style={{ marginTop: 14, flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
            <Button title="Cancel" kind="outline" onPress={onCancel} disabled={busy} />
            <Button
              title={busy ? "Please wait…" : confirmText}
              onPress={onConfirm}
              disabled={busy}
              kind={destructive ? "danger" : "default"}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ------- Screen ------- */
export default function AccountScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const [webBase, setWebBase] = useState(DEFAULT_API_BASE);
  useEffect(() => { getApiBase().then(b => setWebBase(b || DEFAULT_API_BASE)); }, []);
  const webAccountUrl = `${String(webBase || DEFAULT_API_BASE).replace(/\/+$/, "")}/account`;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function openWebAccount() {
    try { await Linking.openURL(webAccountUrl); }
    catch { /* noop; users can copy from below */ }
  }

  async function copyUrl() {
    try {
      const mod = await import("expo-clipboard");
      await mod.setStringAsync(webAccountUrl);
    } catch {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        try { await navigator.clipboard.writeText(webAccountUrl); } catch {}
      }
    }
  }

  async function doSignOut() {
    try {
      setSigningOut(true);
      await signOut();
      setConfirmOpen(false);
      router.replace("/(auth)/signin");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff" }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: "700" }}>Account</Text>
        <Text style={{ color: "#6b7280" }}>
          Your profile. Manage your public API token on the web.
        </Text>

        <View style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 16, padding: 14, gap: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: "700" }}>Profile</Text>
          <Row label="Name" value={user?.name} />
          <Row label="Email" value={user?.email} />
        </View>

        <View style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 16, padding: 14, gap: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: "700" }}>Public API Token</Text>
          <Text style={{ color: "#6b7280" }}>
            Token creation/rotation is available on the <Text style={{ fontWeight: "700" }}>DeepCalendar web app</Text>.
            Open your account page in the browser to manage it.
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button title="Open Web Account" onPress={openWebAccount} />
            <Button title="Copy URL" kind="outline" onPress={copyUrl} />
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Button title="Sign out" kind="danger" onPress={() => setConfirmOpen(true)} />
          <Text style={{ textAlign: "center", color: "#9ca3af", marginTop: 2 }}>
            Powered by DeepCalendar
          </Text>
        </View>
      </ScrollView>

      <ConfirmModal
        open={confirmOpen}
        title="Sign out?"
        body="You’ll return to the sign-in screen."
        confirmText="Sign out"
        destructive
        busy={signingOut}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={doSignOut}
      />
    </SafeAreaView>
  );
}
