import { View, Text } from "react-native";
export default function Viewer() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: "600" }}>Viewer</Text>
      <Text style={{ marginTop: 8, color: "#555", textAlign: "center" }}>
        Plug your DeepCalendar public API here later.
      </Text>
    </View>
  );
}
