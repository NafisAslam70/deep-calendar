import React from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth";
import { API_BASE } from "../../lib/config";

/* Small UI helpers */
function Row({ label, value }) {
  return (
    <View style={{ paddingVertical: 8 }}>
      <Text style={{ fontSize: 12, color: "#6b7280" }}>{label}</Text>
      <Text style={{ marginTop: 2, fontSize: 16, color: "#111827" }}>
        {value || "—"}
      </Text>
    </View>
  );
}
function Button({ title, onPress, kind = "default" }) {
  const styles = {
    default: { bg: "#111827", fg: "#ffffff", brd: "#111827" },
    outline: { bg: "#ffffff", fg: "#111827", brd: "#e5e7eb" },
    danger: { bg: "#ef4444", fg: "#ffffff", brd: "#ef4444" },
    ghost: { bg: "transparent", fg: "#111827", brd: "transparent" },
  }[kind];
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: styles.bg,
        borderColor: styles.brd,
        borderWidth: 1,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 10,
      }}
    >
      <Text
        style={{ color: styles.fg, fontWeight: "700", textAlign: "center" }}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export default function AccountScreen() {
  const { user, signOut } = useAuth();

  const webAccountUrl = `${API_BASE.replace(/\/+$/, "")}/account`;

  function openWebAccount() {
    Linking.openURL(webAccountUrl).catch(() =>
      Alert.alert(
        "Could not open",
        `Please open this URL in your browser:\n\n${webAccountUrl}`
      )
    );
  }

  function confirmSignOut() {
    Alert.alert("Sign out?", "You’ll return to the sign-in screen.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: signOut },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff" }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: "700" }}>Account</Text>
        <Text style={{ color: "#6b7280" }}>
          Your profile. Manage your public API token on the web.
        </Text>

        {/* Profile */}
        <View
          style={{
            borderWidth: 1,
            borderColor: "#e5e7eb",
            borderRadius: 16,
            padding: 14,
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700" }}>Profile</Text>
          <Row label="Name" value={user?.name} />
          <Row label="Email" value={user?.email} />
        </View>

        {/* Public token info (no token in-app) */}
        <View
          style={{
            borderWidth: 1,
            borderColor: "#e5e7eb",
            borderRadius: 16,
            padding: 14,
            gap: 10,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700" }}>
            Public API Token
          </Text>
          <Text style={{ color: "#6b7280" }}>
            Token creation/rotation is available on the{" "}
            <Text style={{ fontWeight: "700" }}>DeepCalendar web app</Text>.
            Please sign in on the web to view or manage your token.
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button title="Open Web Account" onPress={openWebAccount} />
            <Button
              title="Copy URL"
              kind="outline"
              onPress={async () => {
                try {
                  const mod = await import("expo-clipboard");
                  await mod.setStringAsync(webAccountUrl);
                  Alert.alert("Copied", "Account URL copied.");
                } catch {
                  if (typeof navigator !== "undefined" && navigator.clipboard) {
                    await navigator.clipboard.writeText(webAccountUrl);
                    Alert.alert("Copied", "Account URL copied.");
                  } else {
                    Alert.alert(
                      "Copy failed",
                      `URL: ${webAccountUrl}\n\nCopy manually.`
                    );
                  }
                }
              }}
            />
          </View>
        </View>

        {/* Sign out */}
        <View style={{ gap: 8 }}>
          <Button title="Sign out" kind="danger" onPress={confirmSignOut} />
          <Text style={{ textAlign: "center", color: "#9ca3af", marginTop: 2 }}>
            Powered by DeepCalendar
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
