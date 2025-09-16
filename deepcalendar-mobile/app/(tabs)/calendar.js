// app/(tabs)/calendar.js
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { api } from "../../lib/api";
import { WEEKDAYS, fromMinutes } from "../../lib/dc";
import { useAuth } from "../../lib/auth";

/* ---------- Small helpers ---------- */
const nowMinutes = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};
const hexToRgb = (hex) => {
  const h = hex.replace("#", "");
  const b = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return { r: (b >> 16) & 255, g: (b >> 8) & 255, b: b & 255 };
};
const withAlpha = (hex, a) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};
const depthColors = (d) => {
  if (d === 3) return { border: "#6366f1", bg: withAlpha("#6366f1", 0.15), pill: "#7c3aed" };
  if (d === 2) return { border: "#0ea5e9", bg: withAlpha("#0ea5e9", 0.18), pill: "#2563eb" };
  return { border: "#f59e0b", bg: withAlpha("#f59e0b", 0.2), pill: "#f59e0b" }; // L1
};

function Card({ children }) {
  return (
    <View style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 16, padding: 12, gap: 6, backgroundColor: "#fff" }}>
      {children}
    </View>
  );
}
function DepthPill({ d }) {
  const label = d === 1 ? "L1" : d === 2 ? "L2" : "L3";
  const { pill } = depthColors(d);
  return (
    <View style={{ backgroundColor: pill, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 }}>
      <Text style={{ color: "white", fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}
function DayChip({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: active ? "#111827" : "#e5e7eb",
        backgroundColor: active ? "#111827" : "#ffffff",
        marginRight: 8,
      }}
    >
      <Text style={{ color: active ? "#ffffff" : "#111827", fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

/* ---------- Screen ---------- */
export default function Calendar() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [wins, setWins] = useState({});   // { [weekday]: {openMin,closeMin} | null }
  const [items, setItems] = useState({}); // { [weekday]: {startMin,endMin,depthLevel,label,goalId?}[] }
  const [goals, setGoals] = useState([]); // [{id,label,color,...}]
  const goalMap = useMemo(() => Object.fromEntries(goals.map((g) => [g.id, g])), [goals]);

  const [nowMin, setNowMin] = useState(nowMinutes());
  const todayIdx = new Date().getDay();
  const [day, setDay] = useState(todayIdx);

  useEffect(() => {
    const t = setInterval(() => setNowMin(nowMinutes()), 30_000);
    return () => clearInterval(t);
  }, []);

  async function loadGoals() {
    try {
      const r = await api.get("/api/deepcal/goals");
      setGoals(r?.goals || []);
    } catch {}
  }
  async function loadRoutine() {
    try {
      const w = {}, r = {};
      const results = await Promise.all(
        [0, 1, 2, 3, 4, 5, 6].map((d) => api.get(`/api/deepcal/routine?weekday=${d}`))
      );
      results.forEach((res, idx) => {
        w[idx] = res?.window || null;
        r[idx] = (res?.items || []).slice().sort((a, b) => a.startMin - b.startMin);
      });
      setWins(w);
      setItems(r);
    } catch (e) {
      Alert.alert("Failed to load routine", e?.message || String(e));
    }
  }

  useEffect(() => {
    if (authLoading || !user) return;
    loadGoals();
    loadRoutine();
  }, [authLoading, user]);

  // Range for the selected day – prefer window, fallback to items, else 08:00–20:00
  const range = useMemo(() => {
    const win = wins[day];
    if (win && win.closeMin > win.openMin) return { start: win.openMin, end: win.closeMin };
    const its = items[day] || [];
    if (its.length) {
      const start = Math.min(...its.map((i) => i.startMin));
      const end = Math.max(...its.map((i) => i.endMin));
      if (end > start) return { start, end };
    }
    return { start: 8 * 60, end: 20 * 60 };
  }, [wins, items, day]);

  const pxPerMin = 1.05;
  const height = Math.max(260, (range.end - range.start) * pxPerMin);

  const ticks = useMemo(() => {
    const arr = [];
    for (let t = Math.ceil(range.start / 60) * 60; t <= range.end; t += 60) arr.push(t);
    return arr;
  }, [range]);

  const dayItems = items[day] || [];
  const selectedWin = wins[day];

  // Find active block for this day
  const activeItem = useMemo(() => {
    if (day !== todayIdx) return null;
    return (dayItems || []).find((it) => it.startMin <= nowMin && nowMin < it.endMin) || null;
  }, [day, todayIdx, dayItems, nowMin]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12, backgroundColor: "#fff" }}>
      {/* Header + builder shortcut */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 22, fontWeight: "800" }}>Your Deep Calendar</Text>
        <Pressable
          onPress={() => router.push("/(tabs)/routine")}
          style={{
            flexDirection: "row",
            gap: 6,
            alignItems: "center",
            backgroundColor: "#111827",
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 12,
          }}
        >
          <Ionicons name="construct" size={16} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "700" }}>Routine builder</Text>
        </Pressable>
      </View>
      <Text style={{ color: "#6b7280" }}>Single-day timeline with window and blocks. Tap a day below.</Text>

      {/* Day chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {WEEKDAYS.map((w, i) => (
            <DayChip key={w} label={w} active={day === i} onPress={() => setDay(i)} />
          ))}
        </View>
      </ScrollView>

      {/* Legend */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {[3, 2, 1].map((lvl) => {
          const c = depthColors(lvl);
          return (
            <View
              key={lvl}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: c.bg,
                paddingHorizontal: 8,
                paddingVertical: 6,
                borderRadius: 999,
              }}
            >
              <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: c.border }} />
              <Text style={{ fontSize: 12, color: "#111827", fontWeight: "600" }}>
                {lvl === 3 ? "L3 Deep" : lvl === 2 ? "L2 Medium" : "L1 Light"}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Timeline */}
      <Card>
        {/* Top row labels */}
        <View
          style={{
            flexDirection: "row",
            borderBottomWidth: 1,
            borderBottomColor: "#e5e7eb",
            backgroundColor: "#ffffff",
          }}
        >
          <View style={{ width: 72, padding: 8 }}>
            <Text style={{ color: "#6b7280", fontSize: 12 }}>Time</Text>
          </View>
          <View style={{ flex: 1, padding: 8, borderLeftWidth: 1, borderLeftColor: "#e5e7eb" }}>
            <Text style={{ fontWeight: "700" }}>{WEEKDAYS[day]}</Text>
            <Text style={{ color: "#6b7280", fontSize: 12 }}>
              Window:{" "}
              {selectedWin
                ? `${fromMinutes(selectedWin.openMin)} – ${fromMinutes(selectedWin.closeMin)}`
                : "not set"}
            </Text>
          </View>
        </View>

        {/* Grid */}
        <View style={{ flexDirection: "row", backgroundColor: "#ffffff" }}>
          {/* Time rail */}
          <View style={{ width: 72, height, borderRightWidth: 1, borderRightColor: "#e5e7eb", position: "relative" }}>
            {ticks.map((t) => (
              <View key={t} style={{ position: "absolute", left: 0, right: 0, top: (t - range.start) * pxPerMin }}>
                <Text style={{ fontSize: 10, color: "#6b7280", paddingHorizontal: 8, transform: [{ translateY: -8 }] }}>
                  {fromMinutes(t)}
                </Text>
                <View style={{ marginTop: 6, height: 1, backgroundColor: "#e5e7eb" }} />
              </View>
            ))}
          </View>

          {/* Day column */}
          <View style={{ flex: 1, height, position: "relative", backgroundColor: "#ffffff" }}>
            {/* Hour grid lines */}
            {ticks.map((t) => (
              <View
                key={`grid-${t}`}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: (t - range.start) * pxPerMin,
                  height: 1,
                  backgroundColor: "#f3f4f6",
                }}
              />
            ))}

            {/* Day window band */}
            {selectedWin && (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: Math.max(0, (selectedWin.openMin - range.start) * pxPerMin),
                  height: Math.max(0, (selectedWin.closeMin - selectedWin.openMin) * pxPerMin),
                  backgroundColor: withAlpha("#34d399", 0.22),
                  borderRadius: 2,
                }}
              />
            )}

            {/* NEW: Day open & close mini blocks */}
            {selectedWin && selectedWin.openMin >= range.start && selectedWin.openMin <= range.end && (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: 6,
                  right: 6,
                  top: (selectedWin.openMin - range.start) * pxPerMin - 10,
                  height: 20,
                  borderWidth: 1,
                  borderColor: "#10b981",
                  backgroundColor: withAlpha("#10b981", 0.08),
                  borderRadius: 8,
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 3,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: "700", color: "#065f46" }}>
                  Day open • {fromMinutes(selectedWin.openMin)}
                </Text>
              </View>
            )}
            {selectedWin && selectedWin.closeMin >= range.start && selectedWin.closeMin <= range.end && (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: 6,
                  right: 6,
                  top: (selectedWin.closeMin - range.start) * pxPerMin - 10,
                  height: 20,
                  borderWidth: 1,
                  borderColor: "#ef4444",
                  backgroundColor: withAlpha("#ef4444", 0.08),
                  borderRadius: 8,
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 3,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: "700", color: "#991b1b" }}>
                  Day close • {fromMinutes(selectedWin.closeMin)}
                </Text>
              </View>
            )}

            {/* Now line + floating tag */}
            {day === todayIdx && nowMin >= range.start && nowMin <= range.end && (
              <>
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: (nowMin - range.start) * pxPerMin,
                    height: 3,
                    backgroundColor: "#ef4444",
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    right: 6,
                    top: (nowMin - range.start) * pxPerMin - 14,
                    backgroundColor: "#111827",
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 999,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
                    {activeItem ? "Current block" : "Now"}
                  </Text>
                </View>
              </>
            )}

            {/* Blocks */}
            {(dayItems || []).map((it, idx) => {
              const { border, bg } = depthColors(it.depthLevel);
              const top = (it.startMin - range.start) * pxPerMin;
              const heightPx = Math.max(22, (it.endMin - it.startMin) * pxPerMin);
              const outside = selectedWin ? it.startMin < selectedWin.openMin || it.endMin > selectedWin.closeMin : false;
              const isActive = activeItem && activeItem.id === it.id;

              const goalName =
                (it.goalId && goalMap[it.goalId]?.label) ||
                (it.goal_id && goalMap[it.goal_id]?.label) ||
                null;

              return (
                <View
                  key={it.id ?? idx}
                  style={{
                    position: "absolute",
                    left: 6,
                    right: 6,
                    top,
                    height: heightPx,
                    backgroundColor: isActive ? withAlpha(border, 0.22) : bg,
                    borderWidth: 1.5,
                    borderColor: isActive ? "#111827" : outside ? "#ef4444" : border,
                    borderRadius: 10,
                    overflow: "hidden",
                    paddingVertical: 6,
                    paddingHorizontal: 8,
                  }}
                >
                  {isActive && (
                    <View
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        bottom: 0,
                        width: 3,
                        backgroundColor: "#111827",
                        borderTopLeftRadius: 10,
                        borderBottomLeftRadius: 10,
                      }}
                    />
                  )}

                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                      <DepthPill d={it.depthLevel} />
                      <Text style={{ fontWeight: "700" }} numberOfLines={1}>
                        {it.label || "Block"}
                      </Text>
                    </View>
                    <Text style={{ color: "#374151", fontSize: 12, marginLeft: 8 }}>
                      {fromMinutes(it.startMin)}–{fromMinutes(it.endMin)}
                    </Text>
                  </View>

                  {goalName ? (
                    <Text style={{ marginTop: 2, fontSize: 11, color: "#374151" }} numberOfLines={1}>
                      Goal: <Text style={{ fontWeight: "600" }}>{goalName}</Text>
                    </Text>
                  ) : (
                    <Text style={{ marginTop: 2, fontSize: 11, color: "#6b7280" }} numberOfLines={1}>
                      No goal linked
                    </Text>
                  )}

                  {isActive && (
                    <View
                      style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        backgroundColor: "#111827",
                        paddingHorizontal: 6,
                        paddingVertical: 3,
                        borderRadius: 999,
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>Current</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      </Card>

      {/* Actions */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          onPress={() => {
            loadGoals();
            loadRoutine();
          }}
          style={{
            backgroundColor: "#ffffff",
            borderWidth: 1,
            borderColor: "#e5e7eb",
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 10,
          }}
        >
          <Text style={{ fontWeight: "600" }}>Refresh</Text>
        </Pressable>
      </View>

      <Text style={{ textAlign: "center", color: "#9ca3af", fontSize: 12, marginTop: 4 }}>
        Powered by DeepCalendar
      </Text>
    </ScrollView>
  );
}
