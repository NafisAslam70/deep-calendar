"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../../lib/auth";
import { API_BASE } from "../../lib/config";

/* ---------- Helpers ---------- */
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const pad = (n) => String(n).padStart(2, "0");
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};
const nowMinutes = () => {
  const d = new Date();
  return d.getHours()*60 + d.getMinutes();
};
const fromMinutes = (m) => `${pad(Math.floor(m/60))}:${pad(m%60)}`;
const fmtHM = (ms) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

async function apiJson(path, token, init = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const headers = {
    ...(init.headers || {}),
    ...(init.body && !init.headers?.["Content-Type"] ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const r = await fetch(url, { ...init, headers });
  const type = r.headers.get("content-type") || "";
  const json = type.includes("application/json") ? await r.json().catch(() => ({})) : {};
  return { ok: r.ok, status: r.status, json };
}

/* ---------- Tiny UI atoms ---------- */
function DepthPill({ d }) {
  const label = d === 1 ? "L1" : d === 2 ? "L2" : "L3";
  const bg = d === 1 ? "#10b981" : d === 2 ? "#2563eb" : "#a21caf";
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 }}>
      <Text style={{ color: "white", fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

function Tile({ label, value }) {
  return (
    <View style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, padding: 10, flex: 1, minWidth: 120 }}>
      <Text style={{ fontSize: 11, color: "#6b7280" }}>{label}</Text>
      <Text style={{ marginTop: 2, fontSize: 16, fontWeight: "700" }}>{value}</Text>
    </View>
  );
}

function StatusChip({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: active ? "black" : "#e5e7eb",
        backgroundColor: active ? "black" : "white",
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Text style={{ color: active ? "white" : "#111827", fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

function StatusGroup({ value, onChange }) {
  const items = ["planned", "active", "done", "skipped"];
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
      {items.map((s) => (
        <StatusChip key={s} label={s} active={value === s} onPress={() => onChange(s)} />
      ))}
    </View>
  );
}

/* ---------- Confirm modal ---------- */
function ConfirmDialog({ open, title, body, confirmText = "Confirm", destructive = false, onCancel, onConfirm }) {
  return (
    <Modal visible={open} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 16 }}>
        <View style={{ backgroundColor: "white", borderRadius: 16, padding: 16, maxHeight: 480 }}>
          <Text style={{ fontSize: 16, fontWeight: "700" }}>{title}</Text>
          {!!body && (
            <ScrollView style={{ marginTop: 8 }} contentContainerStyle={{ paddingBottom: 8 }}>
              {body}
            </ScrollView>
          )}
          <View style={{ marginTop: 12, flexDirection: "row", justifyContent: "flex-end" }}>
            <Pressable onPress={onCancel} style={{ paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, marginRight: 8 }}>
              <Text>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={{ paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: destructive ? "#dc2626" : "black" }}
            >
              <Text style={{ color: "white" }}>{confirmText}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ---------- Screen ---------- */
export default function DashboardScreen() {
  const { user, token, loading: authLoading } = useAuth();

  const [goals, setGoals] = useState([]);
  const [windowToday, setWindowToday] = useState(null);
  const [pack, setPack] = useState(null);
  const [loading, setLoading] = useState(false);

  const [nowMin, setNowMin] = useState(nowMinutes());
  useEffect(() => {
    const t = setInterval(() => setNowMin(nowMinutes()), 30_000);
    return () => clearInterval(t);
  }, []);

  const date = todayISO();
  const weekday = new Date().getDay();

  async function loadGoals() {
    const r = await apiJson("/api/deepcal/goals", token);
    if (r.ok) setGoals(r.json.goals || []);
  }
  async function loadWindow() {
    const r = await apiJson(`/api/deepcal/routine?weekday=${weekday}`, token);
    if (r.ok) setWindowToday(r.json.window || null);
  }
  async function loadDay() {
    const r = await apiJson(`/api/deepcal/day?date=${encodeURIComponent(date)}`, token);
    setPack(r.ok ? (r.json.pack || null) : null);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    (async () => {
      await Promise.all([loadGoals(), loadWindow(), loadDay()]);
    })();
  }, [authLoading, user]);

  // gate windows
  const OPEN_GRACE_BEFORE = 10, OPEN_GRACE_AFTER = 10, CLOSE_GRACE_BEFORE = 15, CLOSE_GRACE_AFTER = 5;
  const [bypassOpen, setBypassOpen] = useState(true);
  const [bypassClose, setBypassClose] = useState(true);

  const canOpenNow = useMemo(() => {
    if (!windowToday) return true;
    const start = windowToday.openMin;
    return nowMin >= start - OPEN_GRACE_BEFORE && nowMin <= start + OPEN_GRACE_AFTER;
  }, [windowToday, nowMin]);

  const inCloseWindow = useMemo(() => {
    if (!windowToday) return false;
    const end = windowToday.closeMin;
    return nowMin >= end - CLOSE_GRACE_BEFORE && nowMin <= end + CLOSE_GRACE_AFTER;
  }, [windowToday, nowMin]);

  const goalMap = useMemo(() => Object.fromEntries(goals.map(g => [g.id, g])), [goals]);

  const activeBlock = useMemo(() => {
    if (!pack?.blocks?.length) return null;
    return pack.blocks.find(b => b.startMin <= nowMin && nowMin < b.endMin) || null;
  }, [pack, nowMin]);

  async function openDay() {
    setLoading(true);
    const r = await apiJson(`/api/deepcal/day?date=${encodeURIComponent(date)}&autocreate=true`, token);
    setLoading(false);
    if (r.ok) setPack(r.json.pack || null);
  }

  async function setStatus(b, nextStatus) {
    const r = await apiJson(`/api/deepcal/blocks?id=${b.id}`, token, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus }),
    });
    if (r.ok && pack) {
      setPack({ ...pack, blocks: pack.blocks.map(x => (x.id === b.id ? { ...x, status: nextStatus } : x)) });
    }
  }

  const [logNote, setLogNote] = useState({});
  const [journal, setJournal] = useState("");

  const [cOpen, setCOpen] = useState(false);
  const cActionRef = useRef(null);
  const [cTitle, setCTitle] = useState("");
  const [cBody, setCBody] = useState(null);
  const [cText, setCText] = useState("Confirm");
  const [cDes, setCDes] = useState(false);

  function askConfirm(opts) {
    setCTitle(opts.title);
    setCBody(opts.body || null);
    setCText(opts.confirmText || "Confirm");
    setCDes(!!opts.destructive);
    cActionRef.current = opts.onConfirm;
    setCOpen(true);
  }

  async function shutdownDay() {
    if (!pack) return;
    const summary = {
      date: pack.dateISO,
      closedAtClient: new Date().toISOString(),
      blocks: (pack.blocks || []).map(b => ({
        id: b.id,
        time: `${fromMinutes(b.startMin)}–${fromMinutes(b.endMin)}`,
        depth: b.depthLevel,
        goal: b.goalId ? (goalMap[b.goalId]?.label ?? `#${b.goalId}`) : null,
        status: b.status,
        note: (logNote[b.id] || "").trim() || null,
      })),
      journal: journal.trim() || null,
    };
    askConfirm({
      title: "Close your day?",
      body: <Text style={{ fontSize: 13, color: "#374151" }}>This will store today’s report.</Text>,
      confirmText: "Close day",
      onConfirm: async () => {
        setCOpen(false);
        const r = await apiJson("/api/deepcal/day/shutdown", token, {
          method: "POST",
          body: JSON.stringify({ dateISO: pack.dateISO, journal: JSON.stringify(summary, null, 2) }),
        });
        if (r.ok) await loadDay();
      },
    });
  }

  if (authLoading || !user) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  const showOpenPanel = !pack?.openedAt;
  const showShutdownPanel = !!pack?.openedAt && !pack?.shutdownAt;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.select({ ios: "padding", android: undefined })}
      keyboardVerticalOffset={Platform.select({ ios: 72, android: 0 })}
    >
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        {/* Routine window & timestamps */}
        <View style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 16, padding: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <View>
              <Text style={{ color: "#6b7280", fontSize: 12 }}>Routine window (today)</Text>
              <Text style={{ fontSize: 16, fontWeight: "700" }}>
                {windowToday ? `${fromMinutes(windowToday.openMin)}–${fromMinutes(windowToday.closeMin)}` : "Not set"}
              </Text>
            </View>
            <Text style={{ color: "#6b7280", fontSize: 12 }}>
              Current time: <Text style={{ fontWeight: "600", color: "#111827" }}>{fromMinutes(nowMin)}</Text>
            </Text>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Tile label="Full window" value={windowToday ? `${fromMinutes(windowToday.openMin)}–${fromMinutes(windowToday.closeMin)}` : "—"} />
            <Tile label="Day opened" value={pack?.openedAt ? fmtHM(pack.openedAt) : "Not opened yet"} />
            <Tile label="Day closed" value={pack?.shutdownAt ? fmtHM(pack.shutdownAt) : "Not closed yet"} />
          </View>
        </View>

        {/* Open Day */}
        {showOpenPanel && (
          <View style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 16, padding: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: "700" }}>Open your day</Text>
            <Text style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
              Open within <Text style={{ fontWeight: "700", color: "#111827" }}>±10 minutes</Text> of the start time.
            </Text>

            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12, marginTop: 10 }}>
              <Pressable
                onPress={openDay}
                disabled={(!bypassOpen && !canOpenNow) || loading}
                style={{
                  backgroundColor: (!bypassOpen && !canOpenNow) || loading ? "#9ca3af" : "black",
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 10,
                }}
              >
                <Text style={{ color: "white", fontWeight: "600" }}>{loading ? "Opening…" : "Open day now"}</Text>
              </Pressable>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Switch value={bypassOpen} onValueChange={setBypassOpen} />
                <Text style={{ fontSize: 12 }}>Allow bypass (testing)</Text>
              </View>
            </View>

            {windowToday && !canOpenNow && !bypassOpen && (
              <Text style={{ color: "#6b7280", fontSize: 12, marginTop: 6 }}>
                Allowed {fromMinutes(windowToday.openMin - 10)} → {fromMinutes(windowToday.openMin + 10)}.
              </Text>
            )}
          </View>
        )}

        {/* Now (time = full row, chips below) */}
        {!!pack?.openedAt && (
          <View style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 16, padding: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: "700" }}>Now</Text>
            {!activeBlock ? (
              <Text style={{ color: "#6b7280", fontSize: 13, marginTop: 6 }}>No active deep block right now.</Text>
            ) : (
              <View style={{ marginTop: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <DepthPill d={activeBlock.depthLevel} />
                  <Text style={{ fontWeight: "700", fontSize: 16 }}>
                    {fromMinutes(activeBlock.startMin)}–{fromMinutes(activeBlock.endMin)}
                  </Text>
                </View>
                <Text style={{ color: "#6b7280", fontSize: 12, marginTop: 4 }}>
                  {activeBlock.goalId ? (goalMap[activeBlock.goalId]?.label ?? `Goal #${activeBlock.goalId}`) : "No goal"}
                </Text>

                <View style={{ marginTop: 8 }}>
                  <StatusGroup value={activeBlock.status} onChange={(s) => setStatus(activeBlock, s)} />
                </View>
              </View>
            )}
          </View>
        )}

        {/* Today’s blocks (time = full row, chips below) */}
        {!!pack?.openedAt && (
          <View style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 16, padding: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: "700" }}>Today’s blocks</Text>
            {!pack?.blocks?.length ? (
              <Text style={{ color: "#6b7280", fontSize: 13, marginTop: 6 }}>
                No blocks today. Create a routine in “Your Deep Routine”.
              </Text>
            ) : (
              <View style={{ marginTop: 8, gap: 10 }}>
                {pack.blocks.map((b) => {
                  const isActive = activeBlock?.id === b.id;
                  return (
                    <View
                      key={b.id}
                      style={{
                        borderWidth: 1,
                        borderColor: "#e5e7eb",
                        borderRadius: 12,
                        padding: 10,
                        backgroundColor: isActive ? "#eef2ff" : "white",
                      }}
                    >
                      {/* header row: pill + full-width time */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <DepthPill d={b.depthLevel} />
                        <Text style={{ fontWeight: "700", fontSize: 16 }}>
                          {fromMinutes(b.startMin)}–{fromMinutes(b.endMin)}
                        </Text>
                      </View>
                      {/* goal under it */}
                      <Text style={{ color: "#6b7280", fontSize: 12, marginTop: 4 }}>
                        {b.goalId ? (goalMap[b.goalId]?.label ?? `Goal #${b.goalId}`) : "No goal"}
                      </Text>
                      {/* chips on their own line */}
                      <View style={{ marginTop: 6 }}>
                        <StatusGroup value={b.status} onChange={(s) => setStatus(b, s)} />
                      </View>

                      {/* quick note */}
                      <TextInput
                        placeholder="Quick note: what did you do in this block?"
                        value={logNote[b.id] ?? ""}
                        onChangeText={(t) => setLogNote((s) => ({ ...s, [b.id]: t }))}
                        multiline
                        numberOfLines={3}
                        style={{
                          borderWidth: 1,
                          borderColor: "#e5e7eb",
                          borderRadius: 8,
                          padding: 8,
                          fontSize: 13,
                          minHeight: 40,
                          maxHeight: 120,
                          marginTop: 8,
                        }}
                      />
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Shutdown */}
        {showShutdownPanel && (
          <View style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 16, padding: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: "700" }}>Shutdown report</Text>
            <Text style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
              Preferably close within <Text style={{ fontWeight: "700", color: "#111827" }}>the last 15 minutes</Text> of your window.
            </Text>

            <Text style={{ marginTop: 10, fontWeight: "600" }}>Daily journal (optional)</Text>
            <TextInput
              placeholder="How did the day go overall?"
              value={journal}
              onChangeText={setJournal}
              multiline
              numberOfLines={4}
              style={{
                borderWidth: 1,
                borderColor: "#e5e7eb",
                borderRadius: 8,
                padding: 8,
                fontSize: 13,
                minHeight: 60,
                maxHeight: 160,
                marginTop: 6,
              }}
            />

            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
              <Pressable
                onPress={shutdownDay}
                disabled={!bypassClose && !inCloseWindow}
                style={{
                  backgroundColor: (!bypassClose && !inCloseWindow) ? "#9ca3af" : "black",
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 10,
                }}
              >
                <Text style={{ color: "white", fontWeight: "600" }}>Close day & save report</Text>
              </Pressable>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Switch value={bypassClose} onValueChange={setBypassClose} />
                <Text style={{ fontSize: 12 }}>Allow bypass (testing)</Text>
              </View>
            </View>

            {windowToday && !inCloseWindow && !bypassClose && (
              <Text style={{ color: "#6b7280", fontSize: 12, marginTop: 6 }}>
                Allowed {fromMinutes(windowToday.closeMin - 15)} → {fromMinutes(windowToday.closeMin + 5)}.
              </Text>
            )}
          </View>
        )}

        {!pack?.openedAt && (
          <View style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 16, padding: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: "700" }}>Get started</Text>
            <View style={{ marginTop: 6 }}>
              <Text style={{ color: "#374151", marginBottom: 4 }}>1) Set your goals in <Text style={{ fontWeight: "700" }}>Goals</Text>.</Text>
              <Text style={{ color: "#374151", marginBottom: 4 }}>2) Build your routine in <Text style={{ fontWeight: "700" }}>Your Deep Routine</Text>.</Text>
              <Text style={{ color: "#374151" }}>3) Then come back here to open your day.</Text>
            </View>
          </View>
        )}

        <ConfirmDialog
          open={cOpen}
          title={cTitle}
          body={cBody}
          confirmText={cText}
          destructive={cDes}
          onCancel={() => setCOpen(false)}
          onConfirm={() => cActionRef.current?.()}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
