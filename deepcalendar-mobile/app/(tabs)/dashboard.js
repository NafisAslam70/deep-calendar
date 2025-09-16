// app/(tabs)/dashboard.js
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
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth, fetchJson } from "../../lib/auth";

/* ---------- Helpers ---------- */
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n) => String(n).padStart(2, "0");
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const nowMinutes = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};
const fromMinutes = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

// Safe (no Intl) HH:MM for Android release
const fmtHM = (v) => {
  const d = typeof v === "number" ? new Date(v) : new Date(String(v));
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${hh}:${mm}`;
};

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

function Tile({ label, value, icon }) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: "#e5e7eb",
        borderRadius: 12,
        padding: 10,
        flex: 1,
        minWidth: 120,
        backgroundColor: "#fff",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {icon ? <Ionicons name={icon} size={14} color="#6b7280" /> : null}
        <Text style={{ fontSize: 11, color: "#6b7280" }}>{label}</Text>
      </View>
      <Text style={{ marginTop: 2, fontSize: 16, fontWeight: "700" }}>{value}</Text>
    </View>
  );
}

function StatusChip({ label, active, disabled, onPress }) {
  return (
    <Pressable
      onPress={() => (!disabled ? onPress?.() : null)}
      style={{
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: active ? "black" : "#e5e7eb",
        backgroundColor: active ? "black" : "white",
        marginRight: 8,
        marginBottom: 8,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ color: active ? "white" : "#111827", fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

function StatusGroup({ value, onChange, disabled }) {
  const items = ["planned", "active", "done", "skipped"];
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
      {items.map((s) => (
        <StatusChip key={s} label={s} active={value === s} disabled={disabled} onPress={() => onChange(s)} />
      ))}
    </View>
  );
}

/* ---------- Toast ---------- */
function Toast({ message }) {
  if (!message) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 20,
        alignItems: "center",
      }}
    >
      <View
        style={{
          backgroundColor: "rgba(17,24,39,0.95)",
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 12,
          maxWidth: 360,
        }}
      >
        <Text style={{ color: "white", fontWeight: "600" }}>{message}</Text>
      </View>
    </View>
  );
}

/* ---------- Confirm modal ---------- */
function ConfirmDialog({
  open,
  title,
  body,
  confirmText = "Confirm",
  destructive = false,
  busy = false,
  onCancel,
  onConfirm,
}) {
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
            <Pressable
              onPress={!busy ? onCancel : null}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderWidth: 1,
                borderColor: "#e5e7eb",
                borderRadius: 10,
                marginRight: 8,
                opacity: busy ? 0.6 : 1,
              }}
            >
              <Text>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={!busy ? onConfirm : null}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: destructive ? "#dc2626" : "black",
                opacity: busy ? 0.6 : 1,
              }}
            >
              <Text style={{ color: "white" }}>{busy ? "Please wait…" : confirmText}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ---------- Screen ---------- */
export default function DashboardScreen() {
  const { user, loading: authLoading } = useAuth();

  const [goals, setGoals] = useState([]);
  const [windowToday, setWindowToday] = useState(null);
  const [pack, setPack] = useState(null);

  const [loadingOpen, setLoadingOpen] = useState(false);
  const [loadingClose, setLoadingClose] = useState(false);

  const [toast, setToast] = useState("");
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 1400);
  };

  const [nowMin, setNowMin] = useState(nowMinutes());
  useEffect(() => {
    const t = setInterval(() => setNowMin(nowMinutes()), 30_000);
    return () => clearInterval(t);
  }, []);

  const date = todayISO();
  const weekday = new Date().getDay();

  async function loadGoals() {
    try {
      const r = await fetchJson("/api/deepcal/goals");
      if (r.ok) setGoals(r.json.goals || []);
    } catch {}
  }
  async function loadWindow() {
    try {
      const r = await fetchJson(`/api/deepcal/routine?weekday=${weekday}`);
      if (r.ok) setWindowToday(r.json.window || null);
    } catch {}
  }
  async function loadDay() {
    try {
      const r = await fetchJson(`/api/deepcal/day?date=${encodeURIComponent(date)}`);
      setPack(r.ok ? r.json.pack || null : null);
    } catch {
      setPack(null);
    }
  }

  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      await Promise.all([loadGoals(), loadWindow(), loadDay()]);
    })();
  }, [authLoading, user]);

  // gate windows
  const OPEN_GRACE_BEFORE = 10,
    OPEN_GRACE_AFTER = 10,
    CLOSE_GRACE_BEFORE = 15,
    CLOSE_GRACE_AFTER = 5;
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

  const goalMap = useMemo(() => Object.fromEntries(goals.map((g) => [g.id, g])), [goals]);

  const activeBlock = useMemo(() => {
    if (!pack?.blocks?.length) return null;
    return pack.blocks.find((b) => b.startMin <= nowMin && nowMin < b.endMin) || null;
  }, [pack, nowMin]);

  // per-block saving state
  const [statusBusy, setStatusBusy] = useState({}); // { [blockId]: true }
  async function setStatus(b, nextStatus) {
    if (statusBusy[b.id]) return;
    setStatusBusy((s) => ({ ...s, [b.id]: true }));

    // optimistic
    const prev = pack;
    setPack((p) =>
      p
        ? { ...p, blocks: p.blocks.map((x) => (x.id === b.id ? { ...x, status: nextStatus } : x)) }
        : p
    );
    try {
      const r = await fetchJson(`/api/deepcal/blocks?id=${b.id}`, {
        method: "PATCH",
        body: { status: nextStatus },
      });
      if (!r.ok) throw new Error("Failed to update");
      showToast(`Marked ${nextStatus}`);
    } catch (e) {
      // revert on failure
      setPack(prev);
    } finally {
      setStatusBusy((s) => ({ ...s, [b.id]: false }));
    }
  }

  /* ---------- Confirm modal plumbing ---------- */
  const [cOpen, setCOpen] = useState(false);
  const cActionRef = useRef(null);
  const [cTitle, setCTitle] = useState("");
  const [cBody, setCBody] = useState(null);
  const [cText, setCText] = useState("Confirm");
  const [cDes, setCDes] = useState(false);
  const [cBusy, setCBusy] = useState(false);

  function askConfirm(opts) {
    setCTitle(opts.title);
    setCBody(opts.body || null);
    setCText(opts.confirmText || "Confirm");
    setCDes(!!opts.destructive);
    cActionRef.current = opts.onConfirm;
    setCBusy(false);
    setCOpen(true);
  }

  async function handleConfirm() {
    if (!cActionRef.current) return;
    setCBusy(true);
    try {
      await cActionRef.current();
    } finally {
      setCBusy(false);
    }
  }

  /* ---------- Open / Shutdown flows ---------- */
  async function doOpenDay() {
    setLoadingOpen(true);
    try {
      const r = await fetchJson(`/api/deepcal/day?date=${encodeURIComponent(date)}&autocreate=true`);
      if (r.ok) {
        setPack(r.json.pack || null);
        showToast("Day opened");
      }
    } finally {
      setLoadingOpen(false);
      setCOpen(false);
    }
  }

  function openDay() {
    const within = canOpenNow || bypassOpen;
    askConfirm({
      title: "Open your day now?",
      body: (
        <Text style={{ fontSize: 13, color: "#374151" }}>
          {within
            ? "This will create today’s deep-work plan based on your routine."
            : "You’re outside the recommended opening window. Continue anyway?"}
        </Text>
      ),
      confirmText: loadingOpen ? "Opening…" : "Open day",
      onConfirm: doOpenDay,
    });
  }

  async function shutdownDay() {
    if (!pack) return;
    const summary = {
      date: pack.dateISO,
      closedAtClient: new Date().toISOString(),
      blocks: (pack.blocks || []).map((b) => ({
        id: b.id,
        time: `${fromMinutes(b.startMin)}–${fromMinutes(b.endMin)}`,
        depth: b.depthLevel,
        goal: b.goalId ? goalMap[b.goalId]?.label ?? `#${b.goalId}` : null,
        status: b.status,
        note: (logNote[b.id] || "").trim() || null,
      })),
      journal: journal.trim() || null,
    };
    askConfirm({
      title: "Close your day?",
      body: <Text style={{ fontSize: 13, color: "#374151" }}>This will store today’s report.</Text>,
      confirmText: "Close day",
      destructive: false,
      onConfirm: async () => {
        setLoadingClose(true);
        try {
          const r = await fetchJson("/api/deepcal/day/shutdown", {
            method: "POST",
            body: { dateISO: pack.dateISO, journal: JSON.stringify(summary, null, 2) },
          });
          if (r.ok) {
            await loadDay();
            showToast("Day closed");
          }
        } finally {
          setLoadingClose(false);
          setCOpen(false);
        }
      },
    });
  }

  const [logNote, setLogNote] = useState({});
  const [journal, setJournal] = useState("");

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
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 80 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Routine window & timestamps */}
          <View style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 16, padding: 12, backgroundColor: "#fff" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <View>
                <Text style={{ color: "#6b7280", fontSize: 12 }}>Routine window (today)</Text>
                <Text style={{ fontSize: 16, fontWeight: "700" }}>
                  {windowToday
                    ? `${fromMinutes(windowToday.openMin)}–${fromMinutes(windowToday.closeMin)}`
                    : "Not set"}
                </Text>
              </View>
              <Text style={{ color: "#6b7280", fontSize: 12 }}>
                Current time: <Text style={{ fontWeight: "600", color: "#111827" }}>{fromMinutes(nowMin)}</Text>
              </Text>
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Tile
                label="Full window"
                icon="time-outline"
                value={windowToday ? `${fromMinutes(windowToday.openMin)}–${fromMinutes(windowToday.closeMin)}` : "—"}
              />
              <Tile label="Day opened" icon="play-circle-outline" value={pack?.openedAt ? fmtHM(pack.openedAt) : "Not opened yet"} />
              <Tile label="Day closed" icon="stop-circle-outline" value={pack?.shutdownAt ? fmtHM(pack.shutdownAt) : "Not closed yet"} />
            </View>
          </View>

          {/* Open Day */}
          {showOpenPanel && (
            <View style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 16, padding: 12, backgroundColor: "#fff" }}>
              <Text style={{ fontSize: 16, fontWeight: "700" }}>Open your day</Text>
              <Text style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
                Open within <Text style={{ fontWeight: "700", color: "#111827" }}>±10 minutes</Text> of the start time.
              </Text>

              <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12, marginTop: 10 }}>
                <Pressable
                  onPress={openDay}
                  disabled={loadingOpen}
                  style={{
                    backgroundColor: loadingOpen ? "#9ca3af" : "black",
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Ionicons name="play" size={16} color="#fff" />
                  <Text style={{ color: "white", fontWeight: "600" }}>{loadingOpen ? "Opening…" : "Open day now"}</Text>
                </Pressable>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Switch value={bypassOpen} onValueChange={setBypassOpen} />
                  <Text style={{ fontSize: 12 }}>Allow bypass (testing)</Text>
                </View>
              </View>
            </View>
          )}

          {/* Now */}
          {!!pack?.openedAt && (
            <View style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 16, padding: 12, backgroundColor: "#fff" }}>
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
                    {activeBlock.goalId ? goalMap[activeBlock.goalId]?.label ?? `Goal #${activeBlock.goalId}` : "No goal"}
                  </Text>
                  <View style={{ marginTop: 8 }}>
                    <StatusGroup value={activeBlock.status} disabled={!!statusBusy[activeBlock.id]} onChange={(s) => setStatus(activeBlock, s)} />
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Today’s blocks */}
          {!!pack?.openedAt && (
            <View style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 16, padding: 12, backgroundColor: "#fff" }}>
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
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <DepthPill d={b.depthLevel} />
                          <Text style={{ fontWeight: "700", fontSize: 16 }}>
                            {fromMinutes(b.startMin)}–{fromMinutes(b.endMin)}
                          </Text>
                        </View>
                        <Text style={{ color: "#6b7280", fontSize: 12, marginTop: 4 }}>
                          {b.goalId ? goalMap[b.goalId]?.label ?? `Goal #${b.goalId}` : "No goal"}
                        </Text>
                        <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center" }}>
                          <StatusGroup value={b.status} disabled={!!statusBusy[b.id]} onChange={(s) => setStatus(b, s)} />
                          {statusBusy[b.id] ? (
                            <ActivityIndicator size="small" style={{ marginLeft: 6 }} />
                          ) : null}
                        </View>
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
          {!!pack?.openedAt && !pack?.shutdownAt && (
            <View style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 16, padding: 12, backgroundColor: "#fff" }}>
              <Text style={{ fontSize: 16, fontWeight: "700" }}>Shutdown report</Text>
              <Text style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
                Preferably close within{" "}
                <Text style={{ fontWeight: "700", color: "#111827" }}>the last 15 minutes</Text> of your window.
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
                  disabled={loadingClose}
                  style={{
                    backgroundColor: loadingClose ? "#9ca3af" : "black",
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Ionicons name="stop" size={16} color="#fff" />
                  <Text style={{ color: "white", fontWeight: "600" }}>
                    {loadingClose ? "Closing…" : "Close day & save report"}
                  </Text>
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
            <View style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 16, padding: 12, backgroundColor: "#fff" }}>
              <Text style={{ fontSize: 16, fontWeight: "700" }}>Get started</Text>
              <View style={{ marginTop: 6 }}>
                <Text style={{ color: "#374151", marginBottom: 4 }}>
                  1) Set your goals in <Text style={{ fontWeight: "700" }}>Goals</Text>.
                </Text>
                <Text style={{ color: "#374151", marginBottom: 4 }}>
                  2) Build your routine in <Text style={{ fontWeight: "700" }}>Your Deep Routine</Text>.
                </Text>
                <Text style={{ color: "#374151" }}>3) Then come back here to open your day.</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Global confirm dialog */}
        <ConfirmDialog
          open={cOpen}
          title={cTitle}
          body={cBody}
          confirmText={cBusy ? "Please wait…" : cText}
          destructive={cDes}
          busy={cBusy}
          onCancel={() => (!cBusy ? setCOpen(false) : null)}
          onConfirm={handleConfirm}
        />

        {/* Toast */}
        <Toast message={toast} />
      </View>
    </KeyboardAvoidingView>
  );
}
