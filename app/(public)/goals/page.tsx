"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";

/* Types */
type AuthState = "loading" | "authed" | "anon";
type Goal = {
  id: number;
  label: string;
  color: string;
  deadlineISO?: string | null;
  parentGoalId?: number | null;
  priority?: number | null;
};
type PlanSnapshot = {
  id: number;
  label: string;
  createdAt: string;
  goalCount: number;
  routineBlockCount: number;
};
type SnapshotGoal = Goal & { priority?: number | null };
type OpenSnapshot = {
  id: number;
  label: string;
  createdAt: string;
  goalsData: SnapshotGoal[];
  routineData: { items?: Array<{ weekday: number; startMin: number; endMin: number; label?: string | null; goalId?: number | null }>; windows?: unknown[] };
};

/* Utils */
const COLORS = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-fuchsia-500"] as const;
type Color = typeof COLORS[number];
function isColor(x: string): x is Color {
  return (COLORS as readonly string[]).includes(x);
}
function fromMinutes(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

type ApiResp<T> = { ok: boolean; status: number; json: T };
async function apiJson<T>(input: RequestInfo, init?: RequestInit): Promise<ApiResp<T>> {
  const r = await fetch(input, init);
  const isJson = r.headers.get("content-type")?.includes("application/json");
  const j = (isJson ? await r.json().catch(() => ({})) : {}) as T;
  return { ok: r.ok, status: r.status, json: j };
}

/* Confirm dialog */
function ConfirmDialog({
  open, title, body, confirmText = "Confirm", destructive = false, onCancel, onConfirm,
}:{
  open: boolean; title: string; body?: React.ReactNode; confirmText?: string; destructive?: boolean; onCancel: () => void; onConfirm: () => void | Promise<void>;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <div className="text-lg font-semibold">{title}</div>
        {body && <div className="mt-2 text-sm text-gray-700">{body}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded-lg border px-4 py-2" onClick={onCancel}>Cancel</button>
          <button className={`rounded-lg px-4 py-2 text-white ${destructive ? "bg-red-600" : "bg-black"}`} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GoalsPage() {
  const router = useRouter();

  const [authState, setAuthState] = useState<AuthState>("loading");
  const triedRef = useRef(false);

  const [goals, setGoals] = useState<Goal[]>([]);
  const [snapshots, setSnapshots] = useState<PlanSnapshot[]>([]);
  const [snapshotLabel, setSnapshotLabel] = useState("");
  const [snapshotSaving, setSnapshotSaving] = useState(false);
  const [snapshotPanelOpen, setSnapshotPanelOpen] = useState(false);
  const [openedSnapshot, setOpenedSnapshot] = useState<OpenSnapshot | null>(null);
  const [snapshotLoadingId, setSnapshotLoadingId] = useState<number | null>(null);
  const [gLabel, setGLabel] = useState("");
  const [gColor, setGColor] = useState<Color>(COLORS[0]);
  const [gDeadline, setGDeadline] = useState("");
  const [sgLabel, setSgLabel] = useState("");
  const [sgColor, setSgColor] = useState<Color>(COLORS[1]);
  const [sgDeadline, setSgDeadline] = useState("");
  const [sgParentId, setSgParentId] = useState<number | null>(null);
  const [createMode, setCreateMode] = useState<"goal" | "sub-goal">("goal");
  const [createOpen, setCreateOpen] = useState(false);

  const [editingGoalId, setEditingGoalId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editColor, setEditColor] = useState<Color>(COLORS[0]);
  const [editDeadline, setEditDeadline] = useState("");
  const [editParentId, setEditParentId] = useState<number | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmBody, setConfirmBody] = useState<React.ReactNode>(null);
  const [confirmText, setConfirmText] = useState("Confirm");
  const [confirmDestructive, setConfirmDestructive] = useState(false);
  const confirmActionRef = useRef<null | (() => void | Promise<void>)>(null);
  function askConfirm(opts: { title: string; body?: React.ReactNode; confirmText?: string; destructive?: boolean; onConfirm: () => void | Promise<void>; }) {
    setConfirmTitle(opts.title); setConfirmBody(opts.body ?? null); setConfirmText(opts.confirmText ?? "Confirm");
    setConfirmDestructive(!!opts.destructive); confirmActionRef.current = opts.onConfirm; setConfirmOpen(true);
  }

  const loadMe = useCallback(async () => {
    if (triedRef.current) return; triedRef.current = true;
    const { ok, status } = await apiJson<Record<string, unknown>>("/api/auth/me");
    if (ok) setAuthState("authed"); else if (status === 401) setAuthState("anon");
  }, []);

  const loadGoals = useCallback(async () => {
    const { ok, status, json } = await apiJson<{ goals: Goal[] }>("/api/deepcal/goals");
    if (ok) { setGoals(json.goals ?? []); if (authState !== "authed") setAuthState("authed"); }
    else if (status === 401) setAuthState("anon");
  }, [authState]);

  const loadSnapshots = useCallback(async () => {
    const { ok, json } = await apiJson<{ snapshots: PlanSnapshot[] }>("/api/deepcal/snapshots");
    if (ok) setSnapshots(json.snapshots ?? []);
  }, []);

  useEffect(() => { if (authState === "anon") router.replace(`/auth/signin?next=${encodeURIComponent("/goals")}`); }, [authState, router]);
  useEffect(() => { void loadMe(); void loadGoals(); void loadSnapshots(); }, [loadMe, loadGoals, loadSnapshots]);

  async function saveSnapshot() {
    setSnapshotSaving(true);
    const { ok } = await apiJson("/api/deepcal/snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: snapshotLabel }),
    });
    if (ok) {
      setSnapshotLabel("");
      await loadSnapshots();
    }
    setSnapshotSaving(false);
  }

  async function openSnapshot(id: number) {
    setSnapshotLoadingId(id);
    const { ok, json } = await apiJson<{ snapshot: OpenSnapshot }>(`/api/deepcal/snapshots/${id}`);
    if (ok && json.snapshot) setOpenedSnapshot(json.snapshot);
    setSnapshotLoadingId(null);
  }

  const topLevelGoals = useMemo(() => goals.filter((g) => !g.parentGoalId), [goals]);
  const hasNoGoals = goals.length === 0;

  useEffect(() => {
    if (hasNoGoals) setCreateOpen(true);
  }, [hasNoGoals]);
  const childMap = useMemo(() => {
    const m = new Map<number, Goal[]>();
    for (const g of goals) {
      if (g.parentGoalId) {
        const arr = m.get(g.parentGoalId) ?? [];
        arr.push(g);
        m.set(g.parentGoalId, arr);
      }
    }
    return m;
  }, [goals]);
  const roots = topLevelGoals.length ? topLevelGoals : goals;
  const goalById = useMemo<Record<number, Goal>>(
    () => Object.fromEntries(goals.map((g) => [g.id, g])) as Record<number, Goal>,
    [goals]
  );
  const totalSubGoals = Math.max(0, goals.length - topLevelGoals.length);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [priority, setPriority] = useState<Record<number, number>>({});
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [savingPriority, setSavingPriority] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // hydrate and align priority / collapsed state with localStorage + current goals
  useEffect(() => {
    const storedRaw =
      typeof window !== "undefined" ? window.localStorage.getItem("dc_goal_priority") : null;
    let stored: Record<number, number> = {};
    if (storedRaw) {
      try {
        stored = JSON.parse(storedRaw) as Record<number, number>;
      } catch {
        stored = {};
      }
    }

    setPriority((prev) => {
      const next: Record<number, number> = {};
      for (const g of goals) {
        const serverPrio = typeof g.priority === "number" ? g.priority : null;
        if (serverPrio != null) next[g.id] = serverPrio;
        else if (stored[g.id] != null) next[g.id] = stored[g.id];
        else if (prev[g.id] != null) next[g.id] = prev[g.id];
        else next[g.id] = 0;
      }
      return next;
    });
    setCollapsed((prev) => {
      const next: Record<number, boolean> = {};
      for (const g of goals) {
        next[g.id] = prev[g.id] ?? false;
      }
      return next;
    });
  }, [goals]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: Record<number, number> = {};
    for (const g of goals) {
      if (priority[g.id] != null) payload[g.id] = priority[g.id];
    }
    window.localStorage.setItem("dc_goal_priority", JSON.stringify(payload));
  }, [priority, goals]);

  const moveGoal = (goalId: number, bucket: number) => {
    setPriority((prev) => ({ ...prev, [goalId]: bucket }));
  };

  async function savePriorities() {
    if (!goals.length) return;
    setSavingPriority("saving");
    const { ok } = await apiJson("/api/deepcal/goals/priorities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priorities: priority }),
    });
    setSavingPriority(ok ? "saved" : "error");
    if (ok) setTimeout(() => setSavingPriority("idle"), 1500);
  }

  async function createGoal() {
    if (!gLabel.trim()) return;
    await createGoalSubmit({
      label: gLabel.trim(),
      color: gColor,
      deadlineISO: gDeadline || undefined,
      parentGoalId: null,
    });
    setGLabel("");
    setGDeadline("");
  }

  async function createSubGoal() {
    if (!sgLabel.trim() || !sgParentId) return;
    const parentBucket = priority[sgParentId] ?? 0;
    await createGoalSubmit({
      label: sgLabel.trim(),
      color: sgColor,
      deadlineISO: sgDeadline || undefined,
      parentGoalId: sgParentId,
    }, parentBucket);
    setSgLabel("");
    setSgDeadline("");
    setSgParentId(null);
  }

  async function createGoalSubmit(payload: { label: string; color: Color; deadlineISO?: string; parentGoalId: number | null; }, bucketOverride?: number) {
    const priorityValue =
      bucketOverride ?? (payload.parentGoalId ? priority[payload.parentGoalId] ?? 0 : 0);
    const { ok, json } = await apiJson<{ goal: Goal }>("/api/deepcal/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, priority: priorityValue }),
    });
    if (ok) {
      const newGoal = (json as { goal?: Goal })?.goal;
      if (newGoal) {
        setPriority((prev) => ({ ...prev, [newGoal.id]: priorityValue }));
      }
      await loadGoals();
    }
  }

  function beginEdit(g: Goal) {
    setEditingGoalId(g.id);
    setEditLabel(g.label);
    setEditColor(isColor(g.color) ? g.color : COLORS[0]);
    setEditDeadline(g.deadlineISO || "");
    setEditParentId(g.parentGoalId ?? null);
  }

  function cancelEdit() { setEditingGoalId(null); setEditParentId(null); }

  function saveEditModal() {
    askConfirm({
      title: "Save goal changes?",
      confirmText: "Save",
      onConfirm: async () => {
        if (!editingGoalId) return;
        const { ok } = await apiJson(`/api/deepcal/goals?id=${editingGoalId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: editLabel.trim(),
            color: editColor,
            deadlineISO: editDeadline || null,
            parentGoalId: editParentId ?? null,
          }),
        });
        if (ok) { setEditingGoalId(null); await loadGoals(); }
        setConfirmOpen(false);
      },
    });
  }

  function deleteGoalModal(id: number, label: string) {
    const childCount = (childMap.get(id) ?? []).length;
    askConfirm({
      title: "Delete goal?",
      body: (
        <span>
          This removes <b>{label}</b>.
          {childCount > 0 ? (
            <span> It will also archive {childCount} sub-goal{childCount > 1 ? "s" : ""}.</span>
          ) : null}
        </span>
      ),
      confirmText: "Delete", destructive: true,
      onConfirm: async () => { await apiJson(`/api/deepcal/goals?id=${id}`, { method: "DELETE" }); await loadGoals(); setConfirmOpen(false); },
    });
  }

  function renderGoalRow(goal: Goal, opts?: { isChild?: boolean; orderIndex?: number }) {
    const isEditing = editingGoalId === goal.id;
    const parentName =
      goal.parentGoalId != null
        ? goalById[goal.parentGoalId]?.label ?? `Goal #${goal.parentGoalId}`
        : null;
    const parentOptions = topLevelGoals.filter((p) => p.id !== goal.id);

    if (!isEditing) {
      return (
        <div className={`flex items-center justify-between ${opts?.isChild ? "flex-col gap-2 sm:flex-row" : ""}`}>
          <div className="flex items-center gap-3">
            <span className={`inline-block h-3 w-3 rounded-full ${goal.color || "bg-gray-400"}`} />
            <div>
              <div className="font-medium">
                {goal.label}
              </div>
              {parentName && (
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                    Sub-goal
                  </span>
                  <span className="text-gray-500">of {parentName}</span>
                </div>
              )}
              {goal.deadlineISO && <div className="text-xs text-gray-500">Due: {goal.deadlineISO}</div>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-lg border px-3 py-1.5 text-sm" onClick={() => beginEdit(goal)}>Edit</button>
            <button className="rounded-lg border px-3 py-1.5 text-sm" onClick={() => deleteGoalModal(goal.id, goal.label)}>Delete</button>
          </div>
        </div>
      );
    }

    return (
      <div className={`grid gap-3 ${opts?.isChild ? "" : "sm:grid-cols-5"}`}>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-sm text-gray-500">Title</span>
          <input className="w-full rounded-lg border px-3 py-2" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-gray-500">Deadline</span>
          <input type="date" className="w-full rounded-lg border px-3 py-2" value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} />
        </label>
        <div className="space-y-1 sm:col-span-2">
          <span className="text-sm text-gray-500">Color</span>
          <div className="flex items-center gap-2">
            {COLORS.map((c) => (
              <button key={c} onClick={() => setEditColor(c)} className={`h-7 w-7 rounded-full ring-2 ring-offset-2 ${c} ${editColor === c ? "ring-gray-800" : "ring-gray-200"}`} />
            ))}
          </div>
        </div>
        <label className="space-y-1 sm:col-span-3">
          <span className="text-sm text-gray-500">Parent</span>
          <select
            className="w-full rounded-lg border px-3 py-2"
            value={editParentId ?? ""}
            onChange={(e) => setEditParentId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">No parent (top-level)</option>
            {parentOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>
        <div className="sm:col-span-5 flex gap-2">
          <button className="rounded-lg border px-3 py-1.5 text-sm" onClick={cancelEdit}>Cancel</button>
          <button className="rounded-lg bg-black px-3 py-1.5 text-sm text-white" onClick={saveEditModal}>Save</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-5 space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-gray-200/80 bg-gradient-to-r from-sky-500/10 via-fuchsia-500/10 to-amber-500/10 p-6 shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Deep work focus</p>
            <h1 className="text-3xl font-bold text-gray-900">Goals & Priorities</h1>
            <p className="text-sm text-gray-600">Keep priorities lean, park extras in Least Priority, and nest sub-goals for clarity.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-gray-800"
              onClick={() => { setCreateOpen(true); setSnapshotPanelOpen(false); }}
            >
              Create goal
            </button>
            <button
              className="rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100"
              onClick={() => { setSnapshotPanelOpen(true); setCreateOpen(false); }}
            >
              Past goals {snapshots.length > 0 ? `(${snapshots.length})` : ""}
            </button>
            <a className="rounded-full border px-4 py-2 text-sm font-semibold bg-white/70 shadow hover:shadow-md transition" href="/routine">Open Routine</a>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border bg-white/70 p-3 shadow-sm">
            <div className="text-xs text-gray-500">Top-level goals</div>
            <div className="text-2xl font-semibold text-gray-900">{topLevelGoals.length}</div>
          </div>
          <div className="rounded-2xl border bg-white/70 p-3 shadow-sm">
            <div className="text-xs text-gray-500">Sub-goals</div>
            <div className="text-2xl font-semibold text-gray-900">{totalSubGoals}</div>
          </div>
          <div className="rounded-2xl border bg-white/70 p-3 shadow-sm">
            <div className="text-xs text-gray-500">Total</div>
            <div className="text-2xl font-semibold text-gray-900">{goals.length}</div>
          </div>
        </div>
      </div>

      {(createOpen || snapshotPanelOpen) && (
      <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/45 p-4 sm:items-center">
      <div className="relative my-4 w-full max-w-4xl rounded-3xl bg-white p-4 shadow-2xl sm:p-5">
        <button
          className="absolute right-4 top-4 rounded-full border bg-white px-3 py-1 text-sm font-medium hover:border-black"
          onClick={() => { setCreateOpen(false); setSnapshotPanelOpen(false); }}
          aria-label="Close"
        >
          Close
        </button>
      <div className="flex flex-col gap-4 lg:flex-row">
        <section className={`rounded-3xl border border-amber-200 bg-amber-50/70 shadow-sm transition-all ${snapshotPanelOpen ? "p-4" : "hidden"}`}>
          {snapshotPanelOpen ? (
            <>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-700">Keep a record</p>
                  <h2 className="text-lg font-semibold text-gray-900">Plan snapshots</h2>
                </div>
                <button className="rounded-full border px-3 py-1 text-xs" onClick={() => setSnapshotPanelOpen(false)}>Collapse</button>
              </div>
              <p className="mt-2 text-sm text-gray-600">Save your current goals and weekly routine before changing them.</p>
              <div className="mt-3 space-y-2">
                <input className="w-full rounded-full border bg-white px-4 py-2 text-sm" value={snapshotLabel} onChange={(e) => setSnapshotLabel(e.target.value)} placeholder="e.g. August plan" aria-label="Snapshot name" />
                <button className="w-full rounded-full bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={saveSnapshot} disabled={snapshotSaving}>{snapshotSaving ? "Saving…" : "Save snapshot"}</button>
              </div>
              {snapshots.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {snapshots.map((snapshot) => (
                    <button key={snapshot.id} className="w-full rounded-2xl border border-amber-200 bg-white p-3 text-left text-sm shadow-sm transition hover:border-amber-400 hover:shadow" onClick={() => void openSnapshot(snapshot.id)} disabled={snapshotLoadingId === snapshot.id}>
                      <div className="font-semibold text-gray-900">{snapshotLoadingId === snapshot.id ? "Opening…" : snapshot.label}</div>
                      <div className="mt-1 text-xs text-gray-500">{new Date(snapshot.createdAt).toLocaleDateString()} · {snapshot.goalCount} goals · {snapshot.routineBlockCount} blocks</div>
                    </button>
                  ))}
                </div>
              ) : <p className="mt-3 text-sm text-gray-600">No snapshots yet.</p>}
            </>
          ) : null}
        </section>

        {/* Create */}
        <section className={`min-w-0 rounded-3xl border bg-white/80 p-4 shadow-lg backdrop-blur ${createOpen ? "" : "hidden"} ${hasNoGoals ? "border-amber-400 ring-2 ring-amber-200" : "border-gray-200/80"}`}>
        {createOpen ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Create</p>
              <div className={`text-sm ${hasNoGoals ? "font-medium text-amber-800" : "text-gray-600"}`}>
                {hasNoGoals ? "Start here: create your first goal." : "Add focused goals or nest sub-goals."}
              </div>
            </div>
            <div className="flex gap-2">
            <button
              className={`rounded-full px-4 py-2 text-sm transition ${createMode === "goal" ? "bg-black text-white shadow" : "border bg-white/70 hover:border-black/40"}`}
              onClick={() => { setCreateMode("goal"); setCreateOpen(true); }}
            >
              Goal
            </button>
            <button
              className={`rounded-full px-4 py-2 text-sm transition ${createMode === "sub-goal" ? "bg-black text-white shadow" : "border bg-white/70 hover:border-black/40"}`}
              onClick={() => { setCreateMode("sub-goal"); setCreateOpen(true); }}
            >
              Sub-goal
            </button>
            <button
              className="rounded-full border px-4 py-2 text-sm transition hover:border-black/40"
              onClick={() => setCreateOpen((v) => !v)}
            >
              Hide create
            </button>
          </div>
          </div>
        ) : null}

        {createOpen && (
          <div className="space-y-3 rounded-2xl bg-white/90 p-4 shadow-sm">
            {createMode === "goal" ? (
              <>
                <h2 className="text-lg font-semibold">Create a goal</h2>
                <div className="space-y-2">
                  <label className="space-y-1 block">
                    <span className="text-sm text-gray-500">Goal title</span>
                    <input className="w-full rounded-lg border px-3 py-2" value={gLabel} onChange={(e) => setGLabel(e.target.value)} placeholder="e.g. DeepWork AI" />
                  </label>
                  <label className="space-y-1 block">
                    <span className="text-sm text-gray-500">Deadline</span>
                    <input type="date" className="w-full rounded-lg border px-3 py-2" value={gDeadline} onChange={(e) => setGDeadline(e.target.value)} />
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-gray-500">Color</span>
                    {COLORS.map((c) => (
                      <button key={c} onClick={() => setGColor(c)} className={`h-7 w-7 rounded-full ring-2 ring-offset-2 ${c} ${gColor === c ? "ring-gray-800" : "ring-gray-200"}`} />
                    ))}
                  </div>
                </div>
                <button
                  onClick={createGoal}
                  disabled={!gLabel.trim()}
                  className="w-full rounded-full bg-black px-4 py-2 text-white shadow disabled:opacity-50"
                >
                  Add goal
                </button>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold">Create a sub-goal</h2>
                <div className="space-y-2">
                  <label className="space-y-1 block">
                    <span className="text-sm text-gray-500">Sub-goal title</span>
                    <input className="w-full rounded-lg border px-3 py-2" value={sgLabel} onChange={(e) => setSgLabel(e.target.value)} placeholder="e.g. Write outline" />
                  </label>
                  <label className="space-y-1 block">
                    <span className="text-sm text-gray-500">Parent goal</span>
                    <select
                      className="w-full rounded-lg border px-3 py-2"
                      value={sgParentId ?? ""}
                      onChange={(e) => setSgParentId(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">Select parent goal</option>
                      {topLevelGoals.map((g) => (
                        <option key={g.id} value={g.id}>{g.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 block">
                    <span className="text-sm text-gray-500">Deadline</span>
                    <input type="date" className="w-full rounded-lg border px-3 py-2" value={sgDeadline} onChange={(e) => setSgDeadline(e.target.value)} />
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-gray-500">Color</span>
                    {COLORS.map((c) => (
                      <button key={c} onClick={() => setSgColor(c)} className={`h-7 w-7 rounded-full ring-2 ring-offset-2 ${c} ${sgColor === c ? "ring-gray-800" : "ring-gray-200"}`} />
                    ))}
                  </div>
                </div>
                <button
                  onClick={createSubGoal}
                  disabled={!sgLabel.trim() || !sgParentId}
                  className="w-full rounded-full bg-black px-4 py-2 text-white shadow disabled:opacity-50"
                >
                  Add sub-goal
                </button>
              </>
            )}
          </div>
        )}
        </section>
      </div>
      </div>
      </div>
      )}

      {/* List & Edit */}
      <section className="mt-2 rounded-3xl border border-gray-200/80 bg-white/80 p-4 shadow-lg backdrop-blur">
        <div className="relative mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="w-full text-center text-lg font-semibold sm:absolute sm:left-1/2 sm:w-auto sm:-translate-x-1/2">Your Goals</h2>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-500">Drag goals across lanes; toggle sub-goals per card.</span>
            <button
              className="rounded-full border px-3 py-1.5 text-xs transition hover:border-black/40"
              onClick={savePriorities}
              disabled={savingPriority === "saving"}
            >
              {savingPriority === "saving"
                ? "Saving..."
                : savingPriority === "saved"
                ? "Saved"
                : savingPriority === "error"
                ? "Retry save"
                : "Save priorities"}
            </button>
          </div>
        </div>
        {goals.length === 0 ? (
          <p className="text-gray-500">No goals yet.</p>
        ) : (
          <div className="space-y-4 overflow-x-auto pb-1">
            {["First Priority", "Second Priority", "Third Priority", "Least Priority"].map((title, bucket) => {
              const bucketGoals = roots.filter((g) => (priority[g.id] ?? 0) === bucket);
              const isActiveDrop = draggingId != null;
              return (
                <div
                  key={title}
                  className={`min-w-[320px] rounded-2xl bg-white/90 shadow-sm ${
                    bucket === 0
                      ? "focus-sparkle p-5 shadow-md"
                      : "border border-gray-200/80 p-4"
                  }`}
                  onDragOver={(e) => {
                    if (draggingId != null) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggingId != null) moveGoal(draggingId, bucket);
                    setDraggingId(null);
                  }}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black text-xs font-bold text-white">
                        {bucket + 1}
                      </span>
                      <h3 className="text-sm font-semibold">{title}</h3>
                      {bucket === 0 && <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950">Main focus</span>}
                    </div>
                    <span className="text-xs text-gray-500">{bucketGoals.length} goal{bucketGoals.length === 1 ? "" : "s"}</span>
                  </div>
                  <div
                    className={`flex min-h-[120px] flex-wrap gap-3 rounded-xl p-3 sm:flex-row transition ${
                      isActiveDrop ? "border border-amber-300 bg-amber-50/70" : "bg-gray-50/80"
                    }`}
                  >
                    {bucketGoals.length === 0 ? (
                      <div
                        className={`flex-1 rounded-lg border border-dashed p-3 text-center text-xs transition ${
                          isActiveDrop ? "border-amber-300 bg-white/80 text-amber-700" : "text-gray-500"
                        }`}
                      >
                        Drag a goal here{bucket === 3 ? " (cap flexes here)" : ""}
                      </div>
                    ) : (
                      bucketGoals.map((g, idx) => {
                        const children = childMap.get(g.id) ?? [];
                        return (
                          <div
                            key={g.id}
                            className="min-w-[260px] flex-1 space-y-2 rounded-xl border border-gray-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                            draggable
                            onDragStart={() => setDraggingId(g.id)}
                            onDragEnd={() => setDraggingId(null)}
                          >
                            {renderGoalRow(g, { orderIndex: idx })}
                            {children.length > 0 && (
                              <div className="space-y-2 rounded-lg border border-dashed bg-gray-50 p-2">
                                <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                                  <span>Sub-goals</span>
                                  <button
                                    className="rounded-full border px-2 py-0.5 text-[11px] transition hover:border-black/50"
                                    onClick={() => setCollapsed((prev) => ({ ...prev, [g.id]: !prev[g.id] }))}
                                    aria-label="Toggle sub-goals"
                                  >
                                    {collapsed[g.id] ? "▸" : "▾"}
                                  </button>
                                </div>
                                {!collapsed[g.id] ? (
                                  <div className="space-y-2">
                                    {children.map((child) => (
                                      <div
                                        key={child.id}
                                        className="rounded-lg bg-white p-2 shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-50/70"
                                      >
                                        {renderGoalRow(child, { isChild: true })}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-xs text-gray-500">Sub-goals hidden</div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title={confirmTitle}
        body={confirmBody}
        confirmText={confirmText}
        destructive={confirmDestructive}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => { confirmActionRef.current?.(); }}
      />

      {openedSnapshot && (() => {
        const savedGoals = Array.isArray(openedSnapshot.goalsData) ? openedSnapshot.goalsData : [];
        const byParent = new Map<number, SnapshotGoal[]>();
        savedGoals.forEach((goal) => {
          if (goal.parentGoalId != null) byParent.set(goal.parentGoalId, [...(byParent.get(goal.parentGoalId) ?? []), goal]);
        });
        const roots = savedGoals.filter((goal) => goal.parentGoalId == null || !savedGoals.some((parent) => parent.id === goal.parentGoalId));
        const savedGoalById = new Map(savedGoals.map((goal) => [goal.id, goal]));
        const routineItems = Array.isArray(openedSnapshot.routineData?.items) ? openedSnapshot.routineData.items : [];
        return (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Saved plan snapshot">
            <div className="mx-auto my-6 w-full max-w-6xl rounded-3xl bg-white p-5 shadow-2xl">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-700">Read-only saved plan</p>
                  <h2 className="text-2xl font-bold text-gray-900">{openedSnapshot.label}</h2>
                  <p className="text-sm text-gray-500">Saved {new Date(openedSnapshot.createdAt).toLocaleString()}</p>
                </div>
                <button className="rounded-full border px-4 py-2 text-sm font-medium hover:border-black" onClick={() => setOpenedSnapshot(null)}>Close</button>
              </div>

              <div className="mt-5">
                <h3 className="text-lg font-semibold">Goals & priorities</h3>
                {savedGoals.length === 0 ? <p className="mt-2 text-sm text-gray-500">No goals were saved in this snapshot.</p> : (
                  <div className="mt-3 grid gap-3 lg:grid-cols-4">
                    {["First Priority", "Second Priority", "Third Priority", "Least Priority"].map((title, bucket) => (
                      <div key={title} className="rounded-2xl border bg-gray-50 p-3">
                        <div className="mb-3 text-sm font-semibold">{title}</div>
                        <div className="space-y-3">
                          {roots.filter((goal) => (goal.priority ?? 0) === bucket).map((goal) => (
                            <div key={goal.id} className="rounded-xl border bg-white p-3 shadow-sm">
                              <div className="flex items-start gap-2">
                                <span className={`mt-1 inline-block h-3 w-3 shrink-0 rounded-full ${goal.color || "bg-gray-400"}`} />
                                <div>
                                  <div className="font-medium">{goal.label}</div>
                                  {goal.deadlineISO && <div className="text-xs text-gray-500">Due: {goal.deadlineISO}</div>}
                                </div>
                              </div>
                              {(byParent.get(goal.id) ?? []).length > 0 && (
                                <div className="mt-3 space-y-2 border-l-2 border-amber-200 pl-3">
                                  {(byParent.get(goal.id) ?? []).map((child) => (
                                    <div key={child.id} className="text-sm">
                                      <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${child.color || "bg-gray-400"}`} />
                                      {child.label}
                                      {child.deadlineISO && <span className="ml-2 text-xs text-gray-500">Due: {child.deadlineISO}</span>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                          {roots.filter((goal) => (goal.priority ?? 0) === bucket).length === 0 && <p className="text-xs text-gray-500">No goals</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6 border-t pt-5">
                <h3 className="text-lg font-semibold">Saved weekly routine</h3>
                {routineItems.length === 0 ? <p className="mt-2 text-sm text-gray-500">No routine blocks were saved.</p> : (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {routineItems.slice().sort((a, b) => a.weekday - b.weekday || a.startMin - b.startMin).map((item, index) => (
                      <div key={`${item.weekday}-${item.startMin}-${index}`} className="rounded-xl border p-3 text-sm">
                        <div className="font-medium">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][item.weekday]} · {fromMinutes(item.startMin)}–{fromMinutes(item.endMin)}</div>
                        <div className="mt-1 text-xs text-gray-500">{item.label || savedGoalById.get(item.goalId ?? -1)?.label || "Routine block"}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
