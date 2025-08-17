import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Modal,
  ActivityIndicator,
  Platform,
} from "react-native";

/* ---------- tiny helpers ---------- */
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const fromMinutes = (m) => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
};
const depthBadge = (d) => (d === 3 ? "L3" : d === 2 ? "L2" : "L1");
const depthColor = (d) =>
  d === 3 ? "#6366f1" : d === 2 ? "#0ea5e9" : "#f59e0b";

function Button({ title, onPress, kind = "primary", small }) {
  const bg =
    kind === "primary" ? "#111827" :
    kind === "danger" ? "#dc2626" :
    "white";
  const color = kind === "plain" ? "#111827" : "white";
  const border = kind === "plain" ? "#e5e7eb" : "transparent";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: bg,
        borderColor: border,
        borderWidth: kind === "plain" ? 1 : 0,
        paddingVertical: small ? 8 : 12,
        paddingHorizontal: small ? 12 : 16,
        borderRadius: 10,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <Text style={{ color, fontWeight: "600" }}>{title}</Text>
    </Pressable>
  );
}

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

function useLocalStore() {
  // super-lightweight storage (web only). On native it just no-ops.
  const get = (k) => (Platform.OS === "web" ? window.localStorage.getItem(k) : null);
  const set = (k, v) => {
    if (Platform.OS === "web") window.localStorage.setItem(k, v);
  };
  return { get, set };
}

/* ---------- screen ---------- */
export default function Viewer() {
  const { token: tokenParam, base: baseParam } = useLocalSearchParams();
  const storage = useLocalStore();

  const [base, setBase] = useState(() => (baseParam || storage.get("dc_base") || "http://localhost:3001"));
  const [token, setToken] = useState(() => (tokenParam || storage.get("dc_token") || ""));
  const [saving, setSaving] = useState(false);

  // day modal
  const [dayOpen, setDayOpen] = useState(false);
  const [dayLoading, setDayLoading] = useState(false);
  const [dayErr, setDayErr] = useState(null);
  const [windowForDay, setWindowForDay] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [goalsById, setGoalsById] = useState({});

  // stats modal
  const [statsOpen, setStatsOpen] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsErr, setStatsErr] = useState(null);
  const [stats, setStats] = useState(null);

  function saveCreds() {
    setSaving(true);
    try {
      storage.set("dc_base", String(base || "").trim());
      storage.set("dc_token", String(token || "").trim());
    } finally {
      setSaving(false);
    }
  }

  // computed weekday
  const weekday = useMemo(() => new Date().getDay(), []);

  async function loadDay() {
    setDayLoading(true);
    setDayErr(null);
    try {
      const root = String(base || "").replace(/\/+$/,"");
      const tok = String(token || "").trim();
      if (!tok) throw new Error("Token missing");
      const routine = await fetchJSON(`${root}/api/public/${tok}/routine?weekday=${weekday}`);
      const goals = await fetchJSON(`${root}/api/public/${tok}/goals`);
      const byId = {};
      (goals?.goals || []).forEach((g) => (byId[g.id] = g));
      setGoalsById(byId);
      setWindowForDay(routine?.window || null);
      setBlocks((routine?.items || []).sort((a,b)=>a.startMin-b.startMin));
      setDayOpen(true);
    } catch (e) {
      setDayErr(e.message || "Failed to load");
      setDayOpen(true);
    } finally {
      setDayLoading(false);
    }
  }

  async function loadStats() {
    setStatsLoading(true);
    setStatsErr(null);
    try {
      const root = String(base || "").replace(/\/+$/,"");
      const tok = String(token || "").trim();
      if (!tok) throw new Error("Token missing");
      const s = await fetchJSON(`${root}/api/public/${tok}/stats?range=7d`);
      setStats(s || null);
      setStatsOpen(true);
    } catch (e) {
      setStatsErr(e.message || "Failed to load");
      setStatsOpen(true);
    } finally {
      setStatsLoading(false);
    }
  }

  // is a block active now?
  function activeBlockIdx() {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    return blocks.findIndex((b) => mins >= b.startMin && mins < b.endMin);
  }

  const activeIdx = activeBlockIdx();

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "800" }}>Viewer</Text>
      <Text style={{ color: "#6b7280" }}>
        Plug your DeepCalendar public API token, then view your day or stats. (Mobile-friendly)
      </Text>

      {/* creds */}
      <View style={{ gap: 8, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 14, padding: 12 }}>
        <Text style={{ fontWeight: "600", marginBottom: 4 }}>Connection</Text>

        <Text style={{ color: "#6b7280", fontSize: 12 }}>DeepCalendar Base URL</Text>
        <TextInput
          value={base}
          onChangeText={setBase}
          placeholder="https://your-deepcalendar.app"
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 10, marginBottom: 8,
          }}
        />

        <Text style={{ color: "#6b7280", fontSize: 12 }}>Public API Token</Text>
        <TextInput
          value={token}
          onChangeText={setToken}
          placeholder="paste token"
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 10,
          }}
        />

        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <Button title={saving ? "Saved" : "Save"} onPress={saveCreds} kind="plain" />
          <Button title="View my day" onPress={loadDay} />
          <Button title="View stats" onPress={loadStats} kind="plain" />
        </View>

        <Text style={{ marginTop: 8, color: "#9ca3af", fontSize: 12 }}>
          Tip: This is a read-only viewer. To edit routine or blocks, visit your DeepCalendar app.
        </Text>
      </View>

      <Text style={{ textAlign: "center", color: "#9ca3af", fontSize: 12 }}>
        Powered by DeepCalendar — build focus, every day.
      </Text>

      {/* Day Modal */}
      <Modal visible={dayOpen} animationType="slide" onRequestClose={() => setDayOpen(false)}>
        <View style={{ flex: 1, padding: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 18, fontWeight: "700" }}>
              {`My Day • ${WEEKDAYS[weekday]}`}
            </Text>
            <Button title="Close" onPress={() => setDayOpen(false)} kind="plain" />
          </View>

          {dayLoading ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator />
            </View>
          ) : dayErr ? (
            <Text style={{ color: "#dc2626" }}>{dayErr}</Text>
          ) : (
            <ScrollView contentContainerStyle={{ gap: 10 }}>
              {/* window info */}
              <View style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, padding: 12 }}>
                <Text style={{ fontWeight: "600", marginBottom: 6 }}>Day window</Text>
                {windowForDay ? (
                  <Text style={{ color: "#111827" }}>
                    {fromMinutes(windowForDay.openMin)} – {fromMinutes(windowForDay.closeMin)}
                  </Text>
                ) : (
                  <Text style={{ color: "#6b7280" }}>Not set</Text>
                )}
              </View>

              {/* blocks list */}
              <View style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, padding: 12, gap: 8 }}>
                <Text style={{ fontWeight: "600" }}>Blocks</Text>
                {blocks.length === 0 ? (
                  <Text style={{ color: "#6b7280" }}>No blocks for today.</Text>
                ) : (
                  blocks.map((b, i) => {
                    const isActive = i === activeIdx;
                    const goalTitle = b.goalId && goalsById[b.goalId]?.label ? ` • ${goalsById[b.goalId].label}` : "";
                    return (
                      <View
                        key={b.id ?? i}
                        style={{
                          borderWidth: 1,
                          borderColor: isActive ? "#10b981" : "#e5e7eb",
                          backgroundColor: isActive ? "#ecfdf5" : "white",
                          padding: 10,
                          borderRadius: 10,
                        }}
                      >
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={{ fontWeight: "600" }}>
                            {fromMinutes(b.startMin)} – {fromMinutes(b.endMin)}
                            {goalTitle}
                          </Text>
                          <View
                            style={{
                              backgroundColor: depthColor(b.depthLevel),
                              paddingVertical: 2,
                              paddingHorizontal: 8,
                              borderRadius: 999,
                            }}
                          >
                            <Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>
                              {depthBadge(b.depthLevel)}
                            </Text>
                          </View>
                        </View>
                        {b.label ? (
                          <Text style={{ color: "#6b7280", marginTop: 4 }}>{b.label}</Text>
                        ) : null}
                        {isActive ? (
                          <Text style={{ color: "#065f46", marginTop: 6, fontSize: 12 }}>Active now</Text>
                        ) : null}
                      </View>
                    );
                  })
                )}
              </View>

              <Text style={{ textAlign: "center", color: "#9ca3af", fontSize: 12 }}>
                Explore more on DeepCalendar.
              </Text>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Stats Modal */}
      <Modal visible={statsOpen} animationType="slide" onRequestClose={() => setStatsOpen(false)}>
        <View style={{ flex: 1, padding: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 18, fontWeight: "700" }}>My Stats (7d)</Text>
            <Button title="Close" onPress={() => setStatsOpen(false)} kind="plain" />
          </View>

          {statsLoading ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator />
            </View>
          ) : statsErr ? (
            <Text style={{ color: "#dc2626" }}>{statsErr}</Text>
          ) : !stats ? (
            <Text style={{ color: "#6b7280" }}>No data.</Text>
          ) : (
            <ScrollView contentContainerStyle={{ gap: 12 }}>
              {/* totals */}
              <View style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, padding: 12 }}>
                <Text style={{ fontWeight: "600", marginBottom: 6 }}>Totals</Text>
                <Text>Deep time: {Math.round((stats.totalDeepMins || 0) / 60 * 10) / 10} hrs</Text>
                <Text>Blocks done: {stats.blocksDone ?? 0}</Text>
              </View>

              {/* by goal */}
              {Array.isArray(stats.byGoal) && stats.byGoal.length > 0 && (
                <View style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, padding: 12 }}>
                  <Text style={{ fontWeight: "600", marginBottom: 6 }}>By Goal</Text>
                  {stats.byGoal.map((g, i) => (
                    <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
                      <Text style={{ color: "#111827" }}>{g.label || `Goal #${g.goalId}`}</Text>
                      <Text style={{ color: "#6b7280" }}>
                        {Math.round((g.mins || 0) / 60 * 10) / 10} hrs
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <Text style={{ textAlign: "center", color: "#9ca3af", fontSize: 12 }}>
                Explore DeepCalendar for richer analytics.
              </Text>
            </ScrollView>
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}
